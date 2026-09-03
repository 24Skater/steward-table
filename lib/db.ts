import { PrismaClient } from "@prisma/client";

/**
 * Models carrying a non-nullable `churchId`. Every read must be scoped and every
 * create must supply one. Enforced below, and the classification itself is
 * enforced by tests/unit/tenancy/model-classification.test.ts.
 */
export const TENANTED_MODELS = new Set([
  "catalog",
  "kitchen",
  "ministry",
  "volunteerlink",
  "item",
  "modifiergroup",
  "customer",
  "order",
  "ordercounter",
  "deliveryzone",
  "inventoryitem",
  "auditlog",
  "webhookevent",
  "emaillog",
  "smslog",
  "notification",
  "membership",
  "invitation",
  "apikey",
  "churchsettings",
  "stripeaccount",
]);

/**
 * Models with no `churchId` of their own, reachable only through a tenanted
 * parent. The guard cannot check them - there is no column to check - so they
 * are listed here rather than in TENANTED_MODELS, where the guard would demand
 * a `churchId` that does not exist and throw on every query.
 *
 * Their isolation depends on callers scoping the parent. That is a weaker
 * guarantee than the guard gives, and it is the honest description of it.
 */
export const PARENT_SCOPED_MODELS = new Set([
  "address",
  "catalogitem",
  "customernote",
  "customertag",
  "deliveryinfo",
  "itemmodifiergroup",
  "itemphoto",
  "modifieroption",
  "orderevent",
  "orderitem",
  "payment",
  "refund",
  "smsoptout",
  "stockmovement",
]);

/**
 * Models that are genuinely not tenant data.
 *
 * `user` is here because one person may belong to several churches - the
 * church-scoped part of identity is `membership`. `church` is the tenant root
 * itself. `subdomainreservation` is a platform-wide registry whose `churchId`
 * is nullable precisely because a reservation may exist before, or without, a
 * church.
 */
export const GLOBAL_MODELS = new Set([
  "account",
  "church",
  "session",
  "subdomainreservation",
  "user",
  "verificationtoken",
]);

const SOFT_DELETE_MODELS = new Set([
  "user",
  "church",
  "churchsettings",
  "catalog",
  "kitchen",
  "ministry",
  "item",
  "itemphoto",
  "catalogitem",
  "modifiergroup",
  "modifieroption",
  "itemmodifiergroup",
  "customer",
  "address",
  "inventoryitem",
  "apikey",
  "deliveryzone",
]);

const READ_OPS = new Set(["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy"]);
const WRITE_OPS = new Set(["create", "createMany", "update", "updateMany", "upsert"]);

type CreationPayload = { churchId?: unknown; church?: unknown } | undefined;

/**
 * The row payloads an operation is about to create, if any.
 *
 * Returns an empty array for operations that create nothing (update, updateMany),
 * so the caller loops over zero payloads rather than special-casing them.
 */
function creationPayloads(
  operation: string,
  args: { data?: unknown; create?: unknown },
): CreationPayload[] {
  if (operation === "create") return [args?.data as CreationPayload];
  if (operation === "upsert") return [args?.create as CreationPayload];
  if (operation === "createMany") {
    const data = args?.data;
    return Array.isArray(data) ? (data as CreationPayload[]) : [data as CreationPayload];
  }
  return [];
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelLower = model?.toLowerCase() ?? "";

          // ── Tenancy bypass ───────────────────────────────────────────
          // Prisma's per-operation args union is too wide to narrow here;
          // this structural view covers exactly the keys the middleware touches.
          const anyArgs = args as {
            _bypassTenancyCheck?: boolean;
            where?: {
              withDeleted?: boolean;
              deletedAt?: unknown;
              churchId?: unknown;
              church?: unknown;
            };
            data?: { churchId?: unknown; church?: unknown };
            create?: { churchId?: unknown; church?: unknown };
          };
          let bypassTenancy = false;

          if (anyArgs?._bypassTenancyCheck === true) {
            bypassTenancy = true;
            // biome-ignore lint/performance/noDelete: must remove the key so Prisma never receives the unknown arg
            delete anyArgs._bypassTenancyCheck;
          }

          // ── Soft-delete filter ───────────────────────────────────────
          if (SOFT_DELETE_MODELS.has(modelLower) && READ_OPS.has(operation)) {
            if (anyArgs?.where?.withDeleted) {
              // biome-ignore lint/performance/noDelete: must remove the key so Prisma never receives the unknown arg
              delete anyArgs.where.withDeleted;
            } else {
              anyArgs.where ??= {};
              if (!("deletedAt" in anyArgs.where)) {
                anyArgs.where.deletedAt = null;
              }
            }
          }

          // ── Tenancy enforcement ──────────────────────────────────────
          if (!bypassTenancy && TENANTED_MODELS.has(modelLower)) {
            if (READ_OPS.has(operation)) {
              const hasChurchId =
                anyArgs?.where?.churchId !== undefined || anyArgs?.where?.church !== undefined;
              if (!hasChurchId) {
                throw new Error(
                  `[Tenancy] Unscoped read on ${model} — add churchId to where, or pass _bypassTenancyCheck: true for system-level ops.`,
                );
              }
            }

            if (WRITE_OPS.has(operation)) {
              // Prisma puts the row payload under a different key per operation:
              // `data` for create, `create` for upsert, and an array under `data`
              // for createMany. Reading only `data` silently passed createMany
              // through unchecked and made every upsert on a tenanted model throw
              // "Missing churchId" even when the churchId was right there.
              const payloads = creationPayloads(operation, anyArgs);

              for (const payload of payloads) {
                if (payload?.churchId === undefined && payload?.church === undefined) {
                  throw new Error(
                    `[Tenancy] Missing churchId on ${operation} for ${model}. Every tenanted model must be created with an explicit churchId.`,
                  );
                }
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Standard Next.js singleton to prevent hot-reload connection leaks
const globalForPrisma = globalThis as unknown as { __prisma: ExtendedPrismaClient | undefined };

// Cast to PrismaClient so model accessors and query arg types are visible to TypeScript.
// The runtime value is the extended client (with tenancy/soft-delete middleware applied).
export const db = (globalForPrisma.__prisma ??
  (() => {
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.__prisma = client;
    }
    return client;
  })()) as unknown as PrismaClient;
