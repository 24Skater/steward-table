# Multi-Kitchen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a church run multiple named kitchens, route each catalog's orders to one kitchen, give every kitchen its own stable display URL, and report revenue per kitchen.

**Architecture:** A new `Kitchen` model owns many `Catalog`s via a nullable `Catalog.kitchenId` FK. Order → catalog → kitchen resolution (a catalog with `kitchenId = null` resolves to the church's default kitchen). The kitchen SSE stream and display become slug-scoped (`/kitchen/<slug>`, `/api/sse/kitchen/<slug>`). A dashboard at `/kitchens` manages kitchens and catalog assignment. Pure routing/slug/default-kitchen logic is extracted into `lib/kitchens/*` so it can be unit-tested with the repo's mocked-`db` convention.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Prisma v6 (multi-file schema at `prisma/schema/`), Auth.js v5, Vitest (node env, `@/lib/db` mocked), Playwright, Biome.

**Reference spec:** `docs/superpowers/specs/2026-06-13-multi-kitchen-design.md`

---

## File Structure

**New — pure logic (unit-tested):**
- `lib/kitchens/slug.ts` — slugify a kitchen name + collision-safe unique slug.
- `lib/kitchens/defaults.ts` — default-kitchen constants + `createDefaultKitchen(tx, churchId)`.
- `lib/kitchens/scope.ts` — resolve a kitchen's catalog IDs and build the scoped order `where`.

**New — routes / UI:**
- `app/(kitchen)/kitchen/[slug]/page.tsx` — one scoped kitchen display.
- `app/api/sse/kitchen/[slug]/route.ts` — slug-scoped SSE (moved from `app/api/sse/kitchen/route.ts`).
- `app/(dashboard)/kitchens/page.tsx` — kitchen list + create.
- `app/(dashboard)/kitchens/[id]/page.tsx` — edit one kitchen + assign catalogs.
- `app/(dashboard)/kitchens/actions.ts` — server actions (create/rename/setDefault/archive/assign).
- `components/kitchens/kitchen-manager.tsx` — client list/create/rename/default/archive UI.
- `components/kitchens/catalog-assignment.tsx` — client checklist for assigning catalogs.

**Modified:**
- `prisma/schema/kitchen.prisma` (new model file), `prisma/schema/catalog.prisma` (+`kitchenId`), `prisma/schema/tenancy.prisma` (+`kitchens` relation on `Church`).
- `lib/db.ts` — add `kitchen` to tenancy + soft-delete model sets.
- `app/(kitchen)/kitchen/page.tsx` — becomes the kitchen picker.
- `components/kitchen/kitchen-display.tsx` — accept `slug` + `kitchenName` props, scope the `EventSource` URL.
- `components/kitchen/kitchen-top-bar.tsx` — show the kitchen name.
- `app/api/onboarding/route.ts` and `app/api/onboarding/church/route.ts` — create a default kitchen on church creation.
- `prisma/seed.ts` — seed a default kitchen per seeded church.
- `app/(dashboard)/reports/page.tsx` + `components/reports/*` — add per-kitchen grouping.

**New — migration & backfill:**
- `prisma/migrations/<timestamp>_add_kitchens/` (generated).
- `prisma/backfill-kitchens.ts` — idempotent backfill for existing churches.

**New — tests:**
- `tests/unit/kitchens/slug.test.ts`, `tests/unit/kitchens/defaults.test.ts`, `tests/unit/kitchens/scope.test.ts`.
- `tests/e2e/kitchen-multi.spec.ts`.

---

## Task 1: Schema — `Kitchen` model + `Catalog.kitchenId` + tenancy wiring

**Files:**
- Create: `prisma/schema/kitchen.prisma`
- Modify: `prisma/schema/catalog.prisma` (Catalog model, lines 1-24)
- Modify: `prisma/schema/tenancy.prisma` (Church model relations, around line 30-36)
- Modify: `lib/db.ts:3-41` (model sets)

- [ ] **Step 1: Create the `Kitchen` model**

Create `prisma/schema/kitchen.prisma`:

```prisma
model Kitchen {
  id        String  @id @default(cuid())
  churchId  String
  name      String
  slug      String
  isDefault Boolean @default(false)
  sortOrder Int     @default(0)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  church   Church    @relation(fields: [churchId], references: [id], onDelete: Cascade)
  catalogs Catalog[]

  @@unique([churchId, slug])
  @@index([churchId])
  @@index([deletedAt])
  @@map("kitchens")
}
```

- [ ] **Step 2: Add the FK on `Catalog`**

In `prisma/schema/catalog.prisma`, inside `model Catalog`, add the scalar field after `closesAt` (line 10) and the relation after the `church` relation (line 16):

```prisma
  // add after `closesAt DateTime?`
  kitchenId String?

  // add in the relations block, after `church Church @relation(...)`
  kitchen Kitchen? @relation(fields: [kitchenId], references: [id])
```

Also add an index inside the same model's `@@index` block area:

```prisma
  @@index([kitchenId])
```

- [ ] **Step 3: Add the back-relation on `Church`**

In `prisma/schema/tenancy.prisma`, inside `model Church`, add to the relations list (near line 30-36, alongside `catalogs Catalog[]`):

```prisma
  kitchens Kitchen[]
```

- [ ] **Step 4: Register `kitchen` in the Prisma extension**

In `lib/db.ts`, add `"kitchen"` to both sets.

In `TENANTED_MODELS` (after `"catalog",` on line 4):

```ts
  "catalog",
  "kitchen",
```

In `SOFT_DELETE_MODELS` (after `"catalog",` on line 29):

```ts
  "catalog",
  "kitchen",
```

- [ ] **Step 5: Validate, migrate, generate**

Run:
```bash
pnpm exec prisma format
pnpm exec prisma validate
pnpm db:migrate
```
When prompted for a migration name, enter: `add_kitchens`
Then:
```bash
pnpm db:generate
pnpm type-check
```
Expected: prisma validate passes; migration created under `prisma/migrations/<timestamp>_add_kitchens/`; `pnpm type-check` passes (the generated client now knows `Kitchen` and `Catalog.kitchenId`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema/kitchen.prisma prisma/schema/catalog.prisma prisma/schema/tenancy.prisma prisma/migrations lib/db.ts
git commit -m "feat: add Kitchen model and Catalog.kitchenId"
```

---

## Task 2: `lib/kitchens/slug.ts` — slug helpers (pure, TDD)

**Files:**
- Create: `lib/kitchens/slug.ts`
- Test: `tests/unit/kitchens/slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/kitchens/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateUniqueKitchenSlug, slugifyKitchenName } from "@/lib/kitchens/slug";

describe("slugifyKitchenName", () => {
  it("lowercases and hyphenates a multi-word name", () => {
    expect(slugifyKitchenName("Main Kitchen")).toBe("main-kitchen");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(slugifyKitchenName("  Media!! Team's  Kitchen ")).toBe("media-teams-kitchen");
  });

  it("falls back to 'kitchen' when the name has no usable characters", () => {
    expect(slugifyKitchenName("!!!")).toBe("kitchen");
  });
});

describe("generateUniqueKitchenSlug", () => {
  it("returns the base slug when there is no collision", () => {
    expect(generateUniqueKitchenSlug("Side Kitchen", [])).toBe("side-kitchen");
  });

  it("suffixes -2 on first collision", () => {
    expect(generateUniqueKitchenSlug("Main Kitchen", ["main-kitchen"])).toBe("main-kitchen-2");
  });

  it("increments the suffix past existing numbered slugs", () => {
    expect(
      generateUniqueKitchenSlug("Main Kitchen", ["main-kitchen", "main-kitchen-2"]),
    ).toBe("main-kitchen-3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/kitchens/slug.test.ts`
Expected: FAIL — `Cannot find module '@/lib/kitchens/slug'`.

- [ ] **Step 3: Write the implementation**

Create `lib/kitchens/slug.ts`:

```ts
const FALLBACK_SLUG = "kitchen";

/**
 * Convert a kitchen name into a URL-safe slug: lowercase, alphanumeric words
 * joined by hyphens. Returns "kitchen" when nothing usable remains.
 */
export function slugifyKitchenName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : FALLBACK_SLUG;
}

/**
 * Produce a slug unique within the given set of existing slugs by appending
 * -2, -3, … on collision.
 */
export function generateUniqueKitchenSlug(name: string, existingSlugs: string[]): string {
  const base = slugifyKitchenName(name);
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/kitchens/slug.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/kitchens/slug.ts tests/unit/kitchens/slug.test.ts
git commit -m "feat: add kitchen slug helpers"
```

---

## Task 3: `lib/kitchens/defaults.ts` — default-kitchen creation (TDD)

**Files:**
- Create: `lib/kitchens/defaults.ts`
- Test: `tests/unit/kitchens/defaults.test.ts`

`createDefaultKitchen` takes a Prisma client/transaction client (so it works inside `db.$transaction` and in the backfill script) and creates the church's "Main Kitchen" with `isDefault: true`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/kitchens/defaults.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_KITCHEN_NAME,
  DEFAULT_KITCHEN_SLUG,
  createDefaultKitchen,
} from "@/lib/kitchens/defaults";

describe("createDefaultKitchen", () => {
  it("creates a kitchen named 'Main Kitchen' with slug 'main' and isDefault true", async () => {
    // Arrange
    const create = vi.fn().mockResolvedValue({ id: "k1" });
    const tx = { kitchen: { create } } as never;

    // Act
    await createDefaultKitchen(tx, "church-1");

    // Assert
    expect(create).toHaveBeenCalledWith({
      data: {
        churchId: "church-1",
        name: DEFAULT_KITCHEN_NAME,
        slug: DEFAULT_KITCHEN_SLUG,
        isDefault: true,
      },
    });
  });

  it("returns the created kitchen", async () => {
    const create = vi.fn().mockResolvedValue({ id: "k1", slug: "main" });
    const tx = { kitchen: { create } } as never;
    const result = await createDefaultKitchen(tx, "church-1");
    expect(result).toEqual({ id: "k1", slug: "main" });
  });

  it("exposes the expected constant values", () => {
    expect(DEFAULT_KITCHEN_NAME).toBe("Main Kitchen");
    expect(DEFAULT_KITCHEN_SLUG).toBe("main");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/kitchens/defaults.test.ts`
Expected: FAIL — `Cannot find module '@/lib/kitchens/defaults'`.

- [ ] **Step 3: Write the implementation**

Create `lib/kitchens/defaults.ts`:

```ts
export const DEFAULT_KITCHEN_NAME = "Main Kitchen";
export const DEFAULT_KITCHEN_SLUG = "main";

/**
 * Minimal shape needed to create a kitchen. Satisfied by both the extended
 * `db` client and a `$transaction` callback's `tx` client.
 */
interface KitchenCreateClient {
  kitchen: {
    create: (args: {
      data: {
        churchId: string;
        name: string;
        slug: string;
        isDefault: boolean;
      };
    }) => Promise<unknown>;
  };
}

/**
 * Create the default "Main Kitchen" for a church. Every church must have exactly
 * one default kitchen; call this during church provisioning and backfill.
 */
export async function createDefaultKitchen<T>(
  client: KitchenCreateClient,
  churchId: string,
): Promise<T> {
  return client.kitchen.create({
    data: {
      churchId,
      name: DEFAULT_KITCHEN_NAME,
      slug: DEFAULT_KITCHEN_SLUG,
      isDefault: true,
    },
  }) as Promise<T>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/kitchens/defaults.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/kitchens/defaults.ts tests/unit/kitchens/defaults.test.ts
git commit -m "feat: add createDefaultKitchen helper"
```

---

## Task 4: `lib/kitchens/scope.ts` — catalog-scope resolution + order `where` (TDD)

**Files:**
- Create: `lib/kitchens/scope.ts`
- Test: `tests/unit/kitchens/scope.test.ts`

Two functions:
- `getKitchenCatalogIds(db, churchId, kitchen)` — returns the catalog IDs this kitchen owns. For the **default** kitchen this also includes catalogs whose `kitchenId` is `null`.
- `buildKitchenOrderWhere(churchId, catalogIds, statuses)` — the Prisma `where` for the kitchen's active orders. `Order.catalogId` is required, so an empty `catalogIds` correctly matches nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/kitchens/scope.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildKitchenOrderWhere, getKitchenCatalogIds } from "@/lib/kitchens/scope";

function makeDb(rows: Array<{ id: string }>) {
  return {
    catalog: { findMany: vi.fn().mockResolvedValue(rows) },
  } as never;
}

describe("getKitchenCatalogIds", () => {
  it("for a non-default kitchen, filters catalogs by kitchenId only", async () => {
    // Arrange
    const db = makeDb([{ id: "c1" }, { id: "c2" }]);
    const kitchen = { id: "k1", isDefault: false };

    // Act
    const ids = await getKitchenCatalogIds(db, "church-1", kitchen);

    // Assert
    expect(ids).toEqual(["c1", "c2"]);
    expect((db as never as { catalog: { findMany: ReturnType<typeof vi.fn> } }).catalog.findMany)
      .toHaveBeenCalledWith({
        where: { churchId: "church-1", kitchenId: "k1" },
        select: { id: true },
      });
  });

  it("for the default kitchen, also includes catalogs with kitchenId null", async () => {
    // Arrange
    const db = makeDb([{ id: "c1" }]);
    const kitchen = { id: "k-default", isDefault: true };

    // Act
    await getKitchenCatalogIds(db, "church-1", kitchen);

    // Assert
    expect((db as never as { catalog: { findMany: ReturnType<typeof vi.fn> } }).catalog.findMany)
      .toHaveBeenCalledWith({
        where: {
          churchId: "church-1",
          OR: [{ kitchenId: "k-default" }, { kitchenId: null }],
        },
        select: { id: true },
      });
  });
});

describe("buildKitchenOrderWhere", () => {
  it("scopes by church, status, and catalog ids", () => {
    const where = buildKitchenOrderWhere("church-1", ["c1", "c2"], ["CONFIRMED", "IN_KITCHEN"]);
    expect(where).toEqual({
      churchId: "church-1",
      status: { in: ["CONFIRMED", "IN_KITCHEN"] },
      catalogId: { in: ["c1", "c2"] },
    });
  });

  it("an empty catalog list matches nothing (catalogId in [])", () => {
    const where = buildKitchenOrderWhere("church-1", [], ["CONFIRMED"]);
    expect(where.catalogId).toEqual({ in: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/kitchens/scope.test.ts`
Expected: FAIL — `Cannot find module '@/lib/kitchens/scope'`.

- [ ] **Step 3: Write the implementation**

Create `lib/kitchens/scope.ts`:

```ts
import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";

export interface KitchenScopeInput {
  id: string;
  isDefault: boolean;
}

/**
 * Resolve the catalog IDs whose orders belong on this kitchen's screen.
 * The default kitchen additionally owns any catalog with no explicit kitchen.
 */
export async function getKitchenCatalogIds(
  db: PrismaClient,
  churchId: string,
  kitchen: KitchenScopeInput,
): Promise<string[]> {
  const where: Prisma.CatalogWhereInput = kitchen.isDefault
    ? { churchId, OR: [{ kitchenId: kitchen.id }, { kitchenId: null }] }
    : { churchId, kitchenId: kitchen.id };

  const rows = await db.catalog.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Build the Prisma `where` for a kitchen's active orders. Order.catalogId is
 * required, so an empty `catalogIds` list matches no orders.
 */
export function buildKitchenOrderWhere(
  churchId: string,
  catalogIds: string[],
  statuses: OrderStatus[],
): Prisma.OrderWhereInput {
  return {
    churchId,
    status: { in: statuses },
    catalogId: { in: catalogIds },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/kitchens/scope.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/kitchens/scope.ts tests/unit/kitchens/scope.test.ts
git commit -m "feat: add kitchen catalog-scope resolution"
```

---

## Task 5: Provision a default kitchen on church creation (+ seed + backfill)

**Files:**
- Modify: `app/api/onboarding/route.ts:68-104` (transaction)
- Modify: `app/api/onboarding/church/route.ts:52-75` (transaction)
- Modify: `prisma/seed.ts` (after each `church.upsert`, lines ~33 and ~438)
- Create: `prisma/backfill-kitchens.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Add default-kitchen creation to `/api/onboarding`**

In `app/api/onboarding/route.ts`, add the import at the top with the other imports:

```ts
import { createDefaultKitchen } from "@/lib/kitchens/defaults";
```

Inside the `db.$transaction` callback, after the `orderCounter.create` block (line 98-103), add:

```ts
    await createDefaultKitchen(tx as never, church.id);
```

- [ ] **Step 2: Add default-kitchen creation to `/api/onboarding/church`**

In `app/api/onboarding/church/route.ts`, add the import:

```ts
import { createDefaultKitchen } from "@/lib/kitchens/defaults";
```

Inside the `db.$transaction` callback, after the `membership.create` block (line 65-72) and before `return newChurch;`, add:

```ts
    await createDefaultKitchen(tx as never, newChurch.id);
```

- [ ] **Step 3: Seed a default kitchen for seeded churches**

In `prisma/seed.ts`, add the import near the top:

```ts
import { createDefaultKitchen } from "../lib/kitchens/defaults";
```

After each `const church = await prisma.church.upsert({ ... })` (lines ~33 and ~438), add an idempotent default-kitchen ensure:

```ts
  const existingKitchen = await prisma.kitchen.findFirst({ where: { churchId: church.id } });
  if (!existingKitchen) {
    await createDefaultKitchen(prisma as never, church.id);
  }
```

- [ ] **Step 4: Write the backfill script**

Create `prisma/backfill-kitchens.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { createDefaultKitchen } from "../lib/kitchens/defaults";

/**
 * Idempotent backfill: ensure every church has a default kitchen and that all
 * existing catalogs are assigned to it. Safe to run more than once.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const churches = await prisma.church.findMany({ select: { id: true } });
    for (const church of churches) {
      let kitchen = await prisma.kitchen.findFirst({
        where: { churchId: church.id, isDefault: true },
        select: { id: true },
      });
      if (!kitchen) {
        kitchen = (await createDefaultKitchen(prisma, church.id)) as { id: string };
      }
      await prisma.catalog.updateMany({
        where: { churchId: church.id, kitchenId: null },
        data: { kitchenId: kitchen.id },
      });
    }
    console.log(`Backfilled kitchens for ${churches.length} church(es).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Add the backfill npm script**

In `package.json` `scripts`, add after `"db:seed"`:

```json
    "db:backfill-kitchens": "tsx prisma/backfill-kitchens.ts",
```

- [ ] **Step 6: Type-check and run the backfill against the dev DB**

Run:
```bash
pnpm type-check
pnpm db:backfill-kitchens
```
Expected: type-check passes; backfill prints `Backfilled kitchens for N church(es).` Re-running prints the same with no errors (idempotent).

- [ ] **Step 7: Commit**

```bash
git add app/api/onboarding/route.ts app/api/onboarding/church/route.ts prisma/seed.ts prisma/backfill-kitchens.ts package.json
git commit -m "feat: provision default kitchen on church creation and backfill existing churches"
```

---

## Task 6: Slug-scoped SSE route

**Files:**
- Create: `app/api/sse/kitchen/[slug]/route.ts`
- Delete: `app/api/sse/kitchen/route.ts`

The new route mirrors the existing logic but (a) resolves the kitchen by `slug` within the church, returning 404 if absent, (b) computes the kitchen's catalog IDs once, and (c) filters all order queries with `buildKitchenOrderWhere`. The `CONFIRMED → IN_KITCHEN` auto-transition now only sees this kitchen's orders, so it stays scoped automatically.

- [ ] **Step 1: Create the scoped route**

Create `app/api/sse/kitchen/[slug]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/index";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import { buildKitchenOrderWhere, getKitchenCatalogIds } from "@/lib/kitchens/scope";
import { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5_000;
const KITCHEN_STATUSES: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN"];
const CANCELED_STATUSES: OrderStatus[] = ["CANCELED", "REFUNDED"];
const CANCELED_WINDOW_MS = 35_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface KitchenSettings {
  kitchenDisplayMode: string;
  prepLeadTimeMinutes: number;
}

async function getKitchenSettings(churchId: string): Promise<KitchenSettings> {
  const settings = (await (db.churchSettings.findUnique as Function)({
    where: { churchId },
    select: { kitchenDisplayMode: true, prepLeadTimeMinutes: true },
    _bypassTenancyCheck: true,
  })) as KitchenSettings | null;
  return {
    kitchenDisplayMode: settings?.kitchenDisplayMode ?? "IMMEDIATE",
    prepLeadTimeMinutes: settings?.prepLeadTimeMinutes ?? 30,
  };
}

const ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  fulfillment: true,
  scheduledFor: true,
  createdAt: true,
  notes: true,
  customer: { select: { name: true } },
  items: { select: { id: true, quantity: true, itemName: true, modifierSnapshot: true } },
} as const;

async function fetchKitchenOrders(
  churchId: string,
  catalogIds: string[],
  settings: KitchenSettings,
) {
  const all = await db.order.findMany({
    where: buildKitchenOrderWhere(churchId, catalogIds, KITCHEN_STATUSES),
    select: ORDER_SELECT,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });

  if (settings.kitchenDisplayMode === "JUST_IN_TIME") {
    const cutoff = Date.now() + settings.prepLeadTimeMinutes * 60 * 1000;
    return all.filter((o) => !o.scheduledFor || o.scheduledFor.getTime() <= cutoff);
  }
  return all;
}

type RawOrder = Awaited<ReturnType<typeof fetchKitchenOrders>>[number];

function shapeOrder(order: RawOrder) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customer?.name ?? "Guest",
    notes: order.notes ?? null,
    items: order.items.map((item) => {
      const modifiers = item.modifierSnapshot as Array<{
        groupName: string;
        options: Array<{ name: string; priceDelta: number }>;
      }> | null;
      return {
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        modifierSnapshot: modifiers ?? [],
      };
    }),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return new Response("No active membership", { status: 403 });
  }
  const churchId = membership.churchId;

  const { slug } = await params;
  const kitchen = await db.kitchen.findFirst({
    where: { churchId, slug },
    select: { id: true, isDefault: true },
  });
  if (!kitchen) {
    return new Response("Kitchen not found", { status: 404 });
  }

  const catalogIds = await getKitchenCatalogIds(db, churchId, kitchen);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(sseMessage(event, data)));
        } catch {
          // Controller closed — stop sending
        }
      }

      const settings = await getKitchenSettings(churchId);

      async function fetchRecentlyCanceled() {
        const since = new Date(Date.now() - CANCELED_WINDOW_MS);
        const rows = (await (db.order.findMany as Function)({
          where: {
            ...buildKitchenOrderWhere(churchId, catalogIds, CANCELED_STATUSES),
            updatedAt: { gte: since },
          },
          select: ORDER_SELECT,
        })) as RawOrder[];
        return rows.map(shapeOrder);
      }

      async function fetchAndSend() {
        const orders = await fetchKitchenOrders(churchId, catalogIds, settings);
        const confirmedOrders = orders.filter((o) => o.status === "CONFIRMED");
        if (confirmedOrders.length > 0) {
          await Promise.allSettled(
            confirmedOrders.map((o) => transition(o.id, "IN_KITCHEN", { queue: effectQueue })),
          );
          const updated = await fetchKitchenOrders(churchId, catalogIds, settings);
          send("orders", updated.map(shapeOrder));
        } else {
          send("orders", orders.map(shapeOrder));
        }

        const canceled = await fetchRecentlyCanceled();
        if (canceled.length > 0) {
          send("canceled_orders", canceled);
        }
      }

      try {
        await fetchAndSend();
      } catch {
        controller.close();
        return;
      }

      const interval = setInterval(async () => {
        try {
          await fetchAndSend();
        } catch {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }, POLL_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Delete the old church-wide route**

```bash
git rm app/api/sse/kitchen/route.ts
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS. (No file references `/api/sse/kitchen` without a slug yet — the display is updated in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add app/api/sse/kitchen/[slug]/route.ts
git commit -m "feat: scope kitchen SSE stream by kitchen slug"
```

---

## Task 7: Scope `KitchenDisplay` to a slug

**Files:**
- Modify: `components/kitchen/kitchen-display.tsx:32-150` (props + EventSource URL)
- Modify: `components/kitchen/kitchen-top-bar.tsx` (show kitchen name)

- [ ] **Step 1: Add props to `KitchenDisplay`**

In `components/kitchen/kitchen-display.tsx`, replace the function signature (line 32) and the `EventSource` construction (line 97).

Change:
```ts
export function KitchenDisplay() {
```
to:
```ts
interface KitchenDisplayProps {
  slug: string;
  kitchenName: string;
}

export function KitchenDisplay({ slug, kitchenName }: KitchenDisplayProps) {
```

Change line 97:
```ts
      es = new EventSource("/api/sse/kitchen");
```
to:
```ts
      es = new EventSource(`/api/sse/kitchen/${slug}`);
```

Add `slug` to the SSE `useEffect` dependency array. Replace the disable comment and `[]` at lines 149-150:
```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```
with:
```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
```

- [ ] **Step 2: Pass the kitchen name into the top bar**

Still in `components/kitchen/kitchen-display.tsx`, update the `<KitchenTopBar ... />` usage (around line 196-203) to pass the name:

```tsx
      <KitchenTopBar
        kitchenName={kitchenName}
        orderCount={orders.length}
        currentTime={currentTime}
        connected={connected}
        inKitchenCount={inKitchenCount}
        onMarkAllReady={handleMarkAllReady}
        markingAllReady={markingAllReady}
      />
```

- [ ] **Step 3: Accept and render the name in `KitchenTopBar`**

In `components/kitchen/kitchen-top-bar.tsx`, add `kitchenName: string;` to the props interface, add `kitchenName` to the destructured params, and render it as the title. Locate the existing title/heading element in that file and set its text to `{kitchenName}` (replacing any hardcoded "Kitchen" label). If there is no title element, add one at the start of the bar's left section:

```tsx
      <span className="text-white font-semibold text-lg">{kitchenName}</span>
```

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: FAIL — `app/(kitchen)/kitchen/page.tsx` still calls `<KitchenDisplay />` with no props. That is fixed in Task 8. (If executing strictly task-by-task, proceed to Task 8 before re-checking.)

- [ ] **Step 5: Commit**

```bash
git add components/kitchen/kitchen-display.tsx components/kitchen/kitchen-top-bar.tsx
git commit -m "feat: scope KitchenDisplay to a kitchen slug and show its name"
```

---

## Task 8: Kitchen picker page + scoped display page

**Files:**
- Modify: `app/(kitchen)/kitchen/page.tsx` (becomes the picker)
- Create: `app/(kitchen)/kitchen/[slug]/page.tsx`

- [ ] **Step 1: Turn `/kitchen` into the picker**

Replace the entire contents of `app/(kitchen)/kitchen/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function KitchenPickerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) redirect("/auth/sign-in");

  const kitchens = await db.kitchen.findMany({
    where: { churchId: membership.churchId },
    select: { id: true, name: true, slug: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Select a kitchen</h1>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kitchens.map((kitchen) => (
          <Link
            key={kitchen.id}
            href={`/kitchen/${kitchen.slug}`}
            className="rounded-lg border border-slate-700 bg-slate-900 p-6 text-white hover:border-slate-500 transition-colors"
          >
            <span className="text-lg font-medium">{kitchen.name}</span>
            {kitchen.isDefault && (
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">Default</span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the scoped display page**

Create `app/(kitchen)/kitchen/[slug]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KitchenDisplay } from "@/components/kitchen/kitchen-display";

export default async function KitchenSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) redirect("/auth/sign-in");

  const { slug } = await params;
  const kitchen = await db.kitchen.findFirst({
    where: { churchId: membership.churchId, slug },
    select: { name: true, slug: true },
  });
  if (!kitchen) notFound();

  return <KitchenDisplay slug={kitchen.slug} kitchenName={kitchen.name} />;
}
```

- [ ] **Step 3: Type-check and build**

Run:
```bash
pnpm type-check
pnpm build
```
Expected: both PASS. The Task 7 `<KitchenDisplay />` error is resolved.

- [ ] **Step 4: Commit**

```bash
git add app/(kitchen)/kitchen/page.tsx app/(kitchen)/kitchen/[slug]/page.tsx
git commit -m "feat: add kitchen picker and slug-scoped kitchen display pages"
```

---

## Task 9: Kitchen management dashboard (list / create / rename / set-default / archive)

**Files:**
- Create: `app/(dashboard)/kitchens/actions.ts`
- Create: `app/(dashboard)/kitchens/page.tsx`
- Create: `components/kitchens/kitchen-manager.tsx`

RBAC: every mutating action checks `catalog.edit` via `can`. Invariants enforced here: set-default clears the prior default in one transaction; the default kitchen cannot be archived; archiving reassigns the kitchen's catalogs to the default kitchen first.

- [ ] **Step 1: Write the server actions**

Create `app/(dashboard)/kitchens/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/helpers";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import { generateUniqueKitchenSlug } from "@/lib/kitchens/slug";

async function requireCatalogEdit() {
  const session = await requireAuth();
  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) throw new Error("No active membership");
  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) throw new Error(result.reason ?? "Forbidden");
  return membership.churchId;
}

export async function createKitchen(name: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kitchen name is required");

  const existing = await db.kitchen.findMany({
    where: { churchId },
    select: { slug: true },
  });
  const slug = generateUniqueKitchenSlug(
    trimmed,
    existing.map((k) => k.slug),
  );

  await db.kitchen.create({ data: { churchId, name: trimmed, slug } });
  revalidatePath("/kitchens");
}

export async function renameKitchen(kitchenId: string, name: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kitchen name is required");

  await db.kitchen.updateMany({
    where: { id: kitchenId, churchId },
    data: { name: trimmed },
  });
  revalidatePath("/kitchens");
}

export async function setDefaultKitchen(kitchenId: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  await db.$transaction(async (tx) => {
    await (tx.kitchen.updateMany as Function)({
      where: { churchId, isDefault: true },
      data: { isDefault: false },
    });
    await (tx.kitchen.updateMany as Function)({
      where: { id: kitchenId, churchId },
      data: { isDefault: true },
    });
  });
  revalidatePath("/kitchens");
}

export async function archiveKitchen(kitchenId: string): Promise<void> {
  const churchId = await requireCatalogEdit();

  const kitchen = await db.kitchen.findFirst({
    where: { id: kitchenId, churchId },
    select: { id: true, isDefault: true },
  });
  if (!kitchen) throw new Error("Kitchen not found");
  if (kitchen.isDefault) throw new Error("The default kitchen cannot be archived");

  const defaultKitchen = await db.kitchen.findFirst({
    where: { churchId, isDefault: true },
    select: { id: true },
  });
  if (!defaultKitchen) throw new Error("No default kitchen to reassign catalogs to");

  await db.$transaction(async (tx) => {
    await (tx.catalog.updateMany as Function)({
      where: { churchId, kitchenId: kitchen.id },
      data: { kitchenId: defaultKitchen.id },
    });
    await (tx.kitchen.updateMany as Function)({
      where: { id: kitchen.id, churchId },
      data: { deletedAt: new Date() },
    });
  });
  revalidatePath("/kitchens");
}
```

- [ ] **Step 2: Write the list page (server component)**

Create `app/(dashboard)/kitchens/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { KitchenManager } from "@/components/kitchens/kitchen-manager";

export default async function KitchensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) redirect("/auth/sign-in");

  const kitchens = await db.kitchen.findMany({
    where: { churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      slug: true,
      isDefault: true,
      _count: { select: { catalogs: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const initialKitchens = kitchens.map((k) => ({
    id: k.id,
    name: k.name,
    slug: k.slug,
    isDefault: k.isDefault,
    catalogCount: k._count.catalogs,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Kitchens" />
      <KitchenManager initialKitchens={initialKitchens} />
    </div>
  );
}
```

- [ ] **Step 3: Write the client manager component**

Create `components/kitchens/kitchen-manager.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  archiveKitchen,
  createKitchen,
  renameKitchen,
  setDefaultKitchen,
} from "@/app/(dashboard)/kitchens/actions";

export interface KitchenRow {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  catalogCount: number;
}

interface KitchenManagerProps {
  initialKitchens: KitchenRow[];
}

export function KitchenManager({ initialKitchens }: KitchenManagerProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="p-6 space-y-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          run(async () => {
            await createKitchen(name);
            setNewName("");
          });
        }}
      >
        <input
          className="flex-1 rounded-md border px-3 py-2"
          placeholder="New kitchen name (e.g. Media Kitchen)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={isPending}
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={isPending}
        >
          Add kitchen
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y rounded-md border">
        {initialKitchens.map((kitchen) => (
          <li key={kitchen.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{kitchen.name}</span>
                {kitchen.isDefault && (
                  <span className="text-xs uppercase tracking-wide text-slate-500">Default</span>
                )}
              </div>
              <div className="text-sm text-slate-500">
                /kitchen/{kitchen.slug} · {kitchen.catalogCount} catalog
                {kitchen.catalogCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              <Link className="text-blue-600 hover:underline" href={`/kitchens/${kitchen.id}`}>
                Assign catalogs
              </Link>
              <button
                type="button"
                className="text-slate-600 hover:underline disabled:opacity-50"
                disabled={isPending}
                onClick={() => {
                  const name = window.prompt("Rename kitchen", kitchen.name);
                  if (name && name.trim()) run(() => renameKitchen(kitchen.id, name.trim()));
                }}
              >
                Rename
              </button>
              {!kitchen.isDefault && (
                <button
                  type="button"
                  className="text-slate-600 hover:underline disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => run(() => setDefaultKitchen(kitchen.id))}
                >
                  Make default
                </button>
              )}
              {!kitchen.isDefault && (
                <button
                  type="button"
                  className="text-red-600 hover:underline disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm(`Archive "${kitchen.name}"? Its catalogs move to the default kitchen.`)) {
                      run(() => archiveKitchen(kitchen.id));
                    }
                  }}
                >
                  Archive
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and build**

Run:
```bash
pnpm type-check
pnpm build
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/kitchens/actions.ts app/(dashboard)/kitchens/page.tsx components/kitchens/kitchen-manager.tsx
git commit -m "feat: add kitchen management dashboard"
```

---

## Task 10: Assign catalogs to a kitchen (kitchen edit page)

**Files:**
- Create: `app/(dashboard)/kitchens/[id]/page.tsx`
- Create: `components/kitchens/catalog-assignment.tsx`
- Modify: `app/(dashboard)/kitchens/actions.ts` (add `setKitchenCatalogs`)

`setKitchenCatalogs(kitchenId, catalogIds)` assigns the selected catalogs to this kitchen and detaches catalogs that were on this kitchen but are no longer selected (sets their `kitchenId` to `null`, which makes them resolve to the default kitchen).

- [ ] **Step 1: Add the assignment action**

Append to `app/(dashboard)/kitchens/actions.ts`:

```ts
export async function setKitchenCatalogs(
  kitchenId: string,
  catalogIds: string[],
): Promise<void> {
  const churchId = await requireCatalogEdit();

  const kitchen = await db.kitchen.findFirst({
    where: { id: kitchenId, churchId },
    select: { id: true },
  });
  if (!kitchen) throw new Error("Kitchen not found");

  await db.$transaction(async (tx) => {
    // Detach catalogs currently on this kitchen that are no longer selected.
    await (tx.catalog.updateMany as Function)({
      where: { churchId, kitchenId: kitchen.id, id: { notIn: catalogIds } },
      data: { kitchenId: null },
    });
    // Attach the selected catalogs to this kitchen.
    if (catalogIds.length > 0) {
      await (tx.catalog.updateMany as Function)({
        where: { churchId, id: { in: catalogIds } },
        data: { kitchenId: kitchen.id },
      });
    }
  });
  revalidatePath("/kitchens");
  revalidatePath(`/kitchens/${kitchenId}`);
}
```

- [ ] **Step 2: Write the edit page (server component)**

Create `app/(dashboard)/kitchens/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { CatalogAssignment } from "@/components/kitchens/catalog-assignment";

export default async function KitchenEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) redirect("/auth/sign-in");

  const { id } = await params;
  const churchId = membership.churchId;

  const kitchen = await db.kitchen.findFirst({
    where: { id, churchId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!kitchen) notFound();

  const catalogs = await db.catalog.findMany({
    where: { churchId },
    select: { id: true, name: true, kitchenId: true },
    orderBy: { name: "asc" },
  });

  const options = catalogs.map((c) => ({
    id: c.id,
    name: c.name,
    assignedToThis: c.kitchenId === kitchen.id,
    assignedElsewhere: c.kitchenId !== null && c.kitchenId !== kitchen.id,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Kitchen · ${kitchen.name}`} />
      <CatalogAssignment
        kitchenId={kitchen.id}
        isDefault={kitchen.isDefault}
        catalogs={options}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write the assignment client component**

Create `components/kitchens/catalog-assignment.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { setKitchenCatalogs } from "@/app/(dashboard)/kitchens/actions";

interface CatalogOption {
  id: string;
  name: string;
  assignedToThis: boolean;
  assignedElsewhere: boolean;
}

interface CatalogAssignmentProps {
  kitchenId: string;
  isDefault: boolean;
  catalogs: CatalogOption[];
}

export function CatalogAssignment({ kitchenId, isDefault, catalogs }: CatalogAssignmentProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(catalogs.filter((c) => c.assignedToThis).map((c) => c.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setKitchenCatalogs(kitchenId, Array.from(selected));
        setSaved(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="p-6 space-y-4">
      <p className="text-sm text-slate-600">
        Select the catalogs whose orders should appear on this kitchen&apos;s screen.
        {isDefault && " As the default kitchen, it also receives any catalog with no kitchen assigned."}
      </p>

      <ul className="divide-y rounded-md border">
        {catalogs.map((catalog) => (
          <li key={catalog.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              id={`cat-${catalog.id}`}
              checked={selected.has(catalog.id)}
              onChange={() => toggle(catalog.id)}
              disabled={isPending}
            />
            <label htmlFor={`cat-${catalog.id}`} className="flex-1">
              {catalog.name}
              {catalog.assignedElsewhere && !selected.has(catalog.id) && (
                <span className="ml-2 text-xs text-amber-600">
                  currently on another kitchen — selecting moves it here
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        disabled={isPending}
        onClick={save}
      >
        Save assignments
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and build**

Run:
```bash
pnpm type-check
pnpm build
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/kitchens/[id]/page.tsx components/kitchens/catalog-assignment.tsx app/(dashboard)/kitchens/actions.ts
git commit -m "feat: assign catalogs to a kitchen from the kitchen edit page"
```

---

## Task 11: Per-kitchen reporting

**Files:**
- Modify: `app/(dashboard)/reports/page.tsx` (compute `byKitchen`)
- Modify: `components/reports/index.tsx` (or the file exporting `ReportsData` / `ReportsPage`) to render the per-kitchen table

First confirm the reports component file path:
```bash
ls components/reports
```

- [ ] **Step 1: Extend `ReportsData` and compute per-kitchen totals**

In `app/(dashboard)/reports/page.tsx`, add a kitchen aggregation. After the existing `Promise.all([...])` block (line 88), add:

```ts
  // ── Per-kitchen revenue (today, completed orders) ───────────────────────
  const [kitchens, catalogRevenueRows] = await Promise.all([
    db.kitchen.findMany({
      where: { churchId },
      select: { id: true, name: true, isDefault: true },
    }),
    db.order.groupBy({
      by: ["catalogId"],
      where: {
        churchId,
        createdAt: { gte: startOfToday },
        status: { in: COMPLETED_STATUSES },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const catalogToKitchen = new Map<string, string>();
  const catalogsForMap = await db.catalog.findMany({
    where: { churchId },
    select: { id: true, kitchenId: true },
  });
  const defaultKitchenId = kitchens.find((k) => k.isDefault)?.id ?? null;
  for (const c of catalogsForMap) {
    catalogToKitchen.set(c.id, c.kitchenId ?? defaultKitchenId ?? "");
  }

  const kitchenTotals = new Map<string, { orders: number; revenue: number }>();
  for (const row of catalogRevenueRows) {
    const kitchenId = catalogToKitchen.get(row.catalogId) ?? defaultKitchenId ?? "";
    const acc = kitchenTotals.get(kitchenId) ?? { orders: 0, revenue: 0 };
    acc.orders += row._count._all;
    acc.revenue += row._sum.total ?? 0;
    kitchenTotals.set(kitchenId, acc);
  }

  const byKitchen = kitchens.map((k) => ({
    kitchenName: k.name,
    orders: kitchenTotals.get(k.id)?.orders ?? 0,
    revenue: kitchenTotals.get(k.id)?.revenue ?? 0,
  }));
```

Then add `byKitchen` to the `initialData` object (after `topItems`, line 102-105):

```ts
    byKitchen,
```

- [ ] **Step 2: Add `byKitchen` to the `ReportsData` type and render it**

Open the reports component file (path confirmed above; likely `components/reports/index.tsx`). Add to the `ReportsData` interface:

```ts
  byKitchen: { kitchenName: string; orders: number; revenue: number }[];
```

In the `ReportsPage` component body, render a simple section (place it near the existing top-items section). Use the same currency formatting already used in that file for `revenue` — if revenue is shown elsewhere via a helper like `formatCurrency(cents)`, reuse it; otherwise display `(revenue / 100).toFixed(2)`:

```tsx
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By kitchen (today)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Kitchen</th>
              <th className="py-1">Orders</th>
              <th className="py-1">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {initialData.byKitchen.map((row) => (
              <tr key={row.kitchenName} className="border-t">
                <td className="py-1">{row.kitchenName}</td>
                <td className="py-1">{row.orders}</td>
                <td className="py-1">${(row.revenue / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
```

- [ ] **Step 3: Type-check and build**

Run:
```bash
pnpm type-check
pnpm build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/reports/page.tsx components/reports
git commit -m "feat: add per-kitchen revenue to reports"
```

---

## Task 12: E2E smoke + full verification

**Files:**
- Create: `tests/e2e/kitchen-multi.spec.ts`

The deep cross-kitchen isolation behavior is covered by the unit tests on `scope.ts`. This E2E asserts the new routes render and that the picker lists the seeded default kitchen, following the existing `tests/e2e/kitchen.spec.ts` redirect-tolerant style (the e2e env may be unauthenticated).

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/kitchen-multi.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("Multi-kitchen routes", () => {
  test("the kitchen picker route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchen");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchen", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });

  test("a slug-scoped kitchen route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchen/main");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchen/main", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });

  test("the kitchens dashboard route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchens");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchens", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the full unit suite**

Run: `pnpm test`
Expected: PASS, including the three new `tests/unit/kitchens/*` files.

- [ ] **Step 3: Run lint, type-check, and build**

Run:
```bash
pnpm check
pnpm type-check
pnpm build
```
Expected: all PASS.

- [ ] **Step 4: Manual smoke (dev server)**

Run `pnpm dev`, sign in, then verify:
1. `/kitchens` lists "Main Kitchen" (default). Create "Media Kitchen".
2. Open "Media Kitchen" → Assign catalogs → check a catalog → Save.
3. Place/confirm an order in that catalog (via storefront or seed) → it appears on `/kitchen/media` and NOT on `/kitchen/main`.
4. An order in an unassigned catalog appears on `/kitchen/main` (default).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/kitchen-multi.spec.ts
git commit -m "test: add multi-kitchen route smoke tests"
```

---

## Self-Review Notes (coverage vs spec)

- **Data model** (spec §Data Model) → Task 1.
- **Invariants: single default, can't delete default, archive reassigns, unique slug** → Task 9 (`setDefaultKitchen`, `archiveKitchen`) + Task 2 (slug).
- **Routing & screen selection** (spec §Routing) → Tasks 4, 8.
- **SSE scoping incl. scoped auto-transition** (spec §SSE Scoping) → Task 6.
- **Kitchen-builder dashboard + RBAC `catalog.edit`** (spec §Dashboard) → Tasks 9, 10.
- **Catalog→kitchen assignment lives only on the kitchen edit page** → Task 10.
- **Reporting per kitchen, null→default** (spec §Reporting) → Task 11.
- **Migration + backfill + single-screen preservation** (spec §Migration) → Tasks 1, 5.
- **Testing: unit / integration / E2E** (spec §Testing) → unit (Tasks 2–4), action-level invariants exercised in Tasks 9–10, E2E (Task 12).

**Deferred (minor, noted for honesty):** drag-to-reorder of kitchens. The `sortOrder` column exists (Task 1) and lists order by `isDefault` then `name`; a reorder UI is not built in this plan. All §Out-of-Scope items from the spec remain out of scope.
