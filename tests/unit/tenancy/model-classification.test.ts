import { GLOBAL_MODELS, PARENT_SCOPED_MODELS, TENANTED_MODELS } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

/**
 * Tenancy classification, checked against the schema itself.
 *
 * The guard in lib/db.ts decides what to enforce by looking a model up in a
 * hand-maintained set. A hand-maintained set drifts from the schema silently,
 * and every way it can drift is a real defect:
 *
 *  - A model gains `churchId` and nobody adds it to TENANTED_MODELS, so
 *    unscoped reads of tenant data pass straight through.
 *  - A model is listed as tenanted but has no `churchId`, so the guard demands
 *    a column that does not exist and every query to it throws.
 *  - A new model is added and classified nowhere, so nobody has decided.
 *
 * These tests read Prisma's DMMF - the schema as Prisma itself understands it -
 * so the sets cannot drift without CI saying so.
 */

const models = Prisma.dmmf.datamodel.models;

const nameOf = (model: (typeof models)[number]) => model.name.toLowerCase();

function fieldNames(model: (typeof models)[number]): string[] {
  return model.fields.map((field) => field.name);
}

function hasRequiredChurchId(model: (typeof models)[number]): boolean {
  const field = model.fields.find((f) => f.name === "churchId");
  return field?.isRequired === true;
}

function hasOptionalChurchId(model: (typeof models)[number]): boolean {
  const field = model.fields.find((f) => f.name === "churchId");
  return field?.isRequired === false;
}

describe("schema coverage", () => {
  it("classifies every model exactly once", () => {
    const unclassified: string[] = [];
    const duplicated: string[] = [];

    for (const model of models) {
      const name = nameOf(model);
      const memberships = [
        TENANTED_MODELS.has(name),
        PARENT_SCOPED_MODELS.has(name),
        GLOBAL_MODELS.has(name),
      ].filter(Boolean).length;

      if (memberships === 0) unclassified.push(model.name);
      if (memberships > 1) duplicated.push(model.name);
    }

    expect(
      unclassified,
      "New models must be classified in lib/db.ts as tenanted, parent-scoped or global. " +
        "Leaving one out means nobody has decided whether it holds tenant data.",
    ).toEqual([]);
    expect(duplicated, "A model must appear in exactly one classification set.").toEqual([]);
  });

  it("names only models that actually exist", () => {
    const known = new Set(models.map(nameOf));
    const stale = [...TENANTED_MODELS, ...PARENT_SCOPED_MODELS, ...GLOBAL_MODELS].filter(
      (name) => !known.has(name),
    );

    expect(stale, "These names are in a classification set but not in the schema.").toEqual([]);
  });
});

describe("the classification matches the schema", () => {
  it("guards every model that carries a required churchId", () => {
    // The dangerous direction. A model with churchId that the guard does not
    // know about accepts unscoped reads, which return other churches' rows.
    const unguarded = models
      .filter(hasRequiredChurchId)
      .filter((model) => !TENANTED_MODELS.has(nameOf(model)))
      .map((model) => model.name);

    expect(
      unguarded,
      "These models have a required churchId but are not in TENANTED_MODELS, so " +
        "unscoped reads of their rows are not blocked.",
    ).toEqual([]);
  });

  it("only guards models that have a churchId to be scoped by", () => {
    // The other direction is not a leak but a hard outage: the guard demands
    // `where.churchId` on a model that has no such column, so every read throws
    // with an error the caller cannot satisfy.
    const unsatisfiable = [...TENANTED_MODELS]
      .map((name) => models.find((model) => nameOf(model) === name))
      .filter((model): model is (typeof models)[number] => model !== undefined)
      .filter((model) => !fieldNames(model).includes("churchId"))
      .map((model) => model.name);

    expect(
      unsatisfiable,
      "These models are in TENANTED_MODELS but have no churchId column, so the " +
        "guard would demand a filter that cannot be written and every read throws.",
    ).toEqual([]);
  });

  it("keeps parent-scoped models free of a churchId of their own", () => {
    // A parent-scoped model that grows its own churchId can and should be
    // promoted to TENANTED_MODELS - it is now directly scopable.
    const promotable = [...PARENT_SCOPED_MODELS]
      .map((name) => models.find((model) => nameOf(model) === name))
      .filter((model): model is (typeof models)[number] => model !== undefined)
      .filter((model) => fieldNames(model).includes("churchId"))
      .map((model) => model.name);

    expect(
      promotable,
      "These now have a churchId, so they can be enforced directly. Move them to " +
        "TENANTED_MODELS.",
    ).toEqual([]);
  });

  it("allows a global model only an optional churchId, if any", () => {
    // SubdomainReservation is the case this exists for: a platform-wide registry
    // whose churchId is nullable precisely because a reservation may exist
    // before, or without, a church. A required churchId means tenant data.
    const misfiled = [...GLOBAL_MODELS]
      .map((name) => models.find((model) => nameOf(model) === name))
      .filter((model): model is (typeof models)[number] => model !== undefined)
      .filter(hasRequiredChurchId)
      .map((model) => model.name);

    expect(
      misfiled,
      "A required churchId means the model holds tenant data and belongs in " +
        "TENANTED_MODELS, not GLOBAL_MODELS.",
    ).toEqual([]);
  });
});

describe("known classifications", () => {
  it("keeps the tenant root and identity tables global", () => {
    // Regression guards for the judgement calls, so a future edit has to be
    // deliberate rather than accidental.
    for (const name of ["church", "user", "session", "account"]) {
      expect(GLOBAL_MODELS.has(name), name).toBe(true);
    }
  });

  it("treats optional-churchId models as global, not tenanted", () => {
    expect(GLOBAL_MODELS.has("subdomainreservation")).toBe(true);
    const reservation = models.find((model) => nameOf(model) === "subdomainreservation");
    expect(reservation && hasOptionalChurchId(reservation)).toBe(true);
  });

  it("guards the models that hold payment credentials", () => {
    expect(TENANTED_MODELS.has("stripeaccount")).toBe(true);
    expect(TENANTED_MODELS.has("apikey")).toBe(true);
  });
});
