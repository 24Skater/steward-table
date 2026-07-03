# Fundraiser Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let churches spin up fundraiser catalogs fast (wizard + clone), let multiple volunteers take orders in parallel on their phones (POS-style quick-entry with account or tokenized-link access), enforce a per-fundraiser min-items-for-delivery rule, and tag fundraisers with ministries for reporting.

**Architecture:** A fundraiser IS a `Catalog` — no wrapper entity. New `Ministry` and `VolunteerLink` models; small additions to `Catalog` and `Order`. Order creation logic is extracted from the storefront route into a shared service reused by two new order endpoints (volunteer-link door and staff door). All orders ride the existing `transition()`/effect-queue pipeline untouched — kitchen, email, delivery routing all work with zero changes.

**Tech Stack:** Next.js 15 App Router, Prisma v6 (multi-file schema at `prisma/schema/`), Auth.js v5, zod, vitest (`pnpm test`), Playwright (`tests/e2e/`), shadcn/ui + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-03-fundraiser-support-design.md`

**Codebase facts you must respect (read CLAUDE.md first):**
- `db` from `@/lib/db` — tenancy auto-injected; bypass with `_bypassTenancyCheck: true` cast (see existing routes for the `PrismaBypass` cast idiom).
- Soft deletes are automatic — never add manual `deletedAt: null` filters.
- RBAC: every route calls `can(action, ctx)` from `@/lib/rbac/can` at entry. No ad-hoc role checks.
- API route auth pattern: `auth()` → find ACTIVE membership → `can()` → zod parse (copy `app/api/settings/tips/route.ts`).
- Order side effects (confirmation email, SMS, inventory) fire from `transition(orderId, "SUBMITTED", …)` — do NOT send email manually.
- Migrations: `npx prisma migrate dev` needs `DATABASE_URL` pointing at the local dev Postgres (localhost:5432 — see `~/.claude/projects/.../memory/reference-docker-db-access.md`).
- Commit format: `<type>: <description>`, no attribution footer.
- After the final task: commit → push → `docker compose build` in `docker/` (user's standing deploy loop).

---

## File Structure Overview

```
prisma/schema/
  enums.prisma                          MODIFY  Channel += VOLUNTEER
  catalog.prisma                        MODIFY  Ministry model; Catalog += ministryId, minItemsForDelivery, createdById
  orders.prisma                         MODIFY  Order += takenById, takenByName, clientRequestId
  fundraisers.prisma                    CREATE  VolunteerLink model
  church.prisma                         MODIFY  Church += ministries relation
lib/
  rbac/can.ts                           MODIFY  fundraiser.create/edit/publish actions
  fundraisers/delivery-eligibility.ts   CREATE  isDeliveryEligible()
  fundraisers/volunteer-links.ts        CREATE  create/validate/revoke tokenized links
  orders/create-storefront-order.ts     CREATE  shared order-creation service (extracted)
app/api/
  storefront/orders/route.ts            MODIFY  thin wrapper over shared service
  ministries/route.ts                   CREATE  GET list / POST create
  fundraisers/route.ts                  CREATE  POST create fundraiser (wizard submit)
  fundraisers/[catalogId]/route.ts      CREATE  GET full fundraiser (clone prefill)
  fundraisers/[catalogId]/volunteer-links/route.ts            CREATE  POST generate link
  fundraisers/[catalogId]/volunteer-links/[linkId]/route.ts   CREATE  DELETE revoke
  fundraisers/[catalogId]/orders/route.ts                     CREATE  staff-door order create
  catalogs/[catalogId]/status/route.ts  MODIFY  fundraiser.publish fallback for own fundraisers
  v/[token]/catalog/route.ts            CREATE  volunteer-door catalog fetch
  v/[token]/orders/route.ts             CREATE  volunteer-door order create
  storefront/[churchSlug]/delivery-zones/route.ts             MODIFY  include minItemsForDelivery
  reports/route.ts                      MODIFY  per-ministry rollup
components/fundraisers/
  fundraiser-wizard.tsx                 CREATE  single-page collapsible-section wizard
  quick-entry.tsx                       CREATE  POS tap grid + customer sheet
hooks/
  use-send-queue.ts                     CREATE  resilient submit queue
app/(dashboard)/fundraisers/
  new/page.tsx                          CREATE  wizard page
  [catalogId]/take-orders/page.tsx      CREATE  staff quick-entry page
app/v/[token]/page.tsx                  CREATE  volunteer quick-entry page (public)
components/catalog/catalog-list.tsx     MODIFY  New Fundraiser button, ministry badge/filter, Duplicate→wizard
app/(storefront)/[churchSlug]/checkout/page.tsx               MODIFY  min-items delivery gate
tests/
  unit/rbac/can.test.ts                 MODIFY  fundraiser.* cases
  unit/fundraisers/delivery-eligibility.test.ts               CREATE
  unit/fundraisers/volunteer-links.test.ts                    CREATE
  e2e/fundraiser.spec.ts                CREATE  wizard→publish→link→order→kitchen
```

---

### Task 1: Schema — Ministry, VolunteerLink, Catalog/Order fields, Channel enum

**Files:**
- Modify: `prisma/schema/enums.prisma:52-56`
- Modify: `prisma/schema/catalog.prisma` (Catalog model ~line 1-27; append Ministry at end)
- Modify: `prisma/schema/orders.prisma:1-31`
- Modify: `prisma/schema/church.prisma` (add back-relation)
- Create: `prisma/schema/fundraisers.prisma`

- [ ] **Step 1: Add `VOLUNTEER` to the Channel enum**

In `prisma/schema/enums.prisma`:

```prisma
enum Channel {
  ONLINE
  PHONE
  IN_PERSON
  VOLUNTEER
}
```

- [ ] **Step 2: Add fields + relation to `Catalog` and the `Ministry` model**

In `prisma/schema/catalog.prisma`, inside `model Catalog` after `kitchenId String?`:

```prisma
  ministryId          String?
  minItemsForDelivery Int?
  createdById         String?
```

And in Catalog's relation block (next to the existing `church Church @relation(...)` line):

```prisma
  ministry Ministry? @relation(fields: [ministryId], references: [id])
```

Add an index alongside Catalog's existing `@@index` lines:

```prisma
  @@index([churchId, ministryId])
```

Append at the end of `catalog.prisma`:

```prisma
model Ministry {
  id       String @id @default(cuid())
  churchId String
  name     String

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  church   Church    @relation(fields: [churchId], references: [id], onDelete: Cascade)
  catalogs Catalog[]

  @@unique([churchId, name])
  @@index([churchId])
  @@map("ministries")
}
```

- [ ] **Step 3: Add back-relation on Church**

In `prisma/schema/church.prisma`, inside `model Church`'s relation block, add:

```prisma
  ministries Ministry[]
```

- [ ] **Step 4: Add attribution + idempotency fields to `Order`**

In `prisma/schema/orders.prisma`, inside `model Order` after `scheduledFor DateTime?`:

```prisma
  takenById       String?
  takenByName     String?
  clientRequestId String?
```

Add alongside Order's existing `@@index`/`@@unique` lines:

```prisma
  @@unique([churchId, clientRequestId])
```

(Postgres allows multiple NULLs in a unique index, so existing orders are unaffected.)

- [ ] **Step 5: Create `prisma/schema/fundraisers.prisma`**

```prisma
model VolunteerLink {
  id          String    @id @default(cuid())
  churchId    String
  catalogId   String
  tokenHash   String    @unique
  createdById String
  expiresAt   DateTime
  revokedAt   DateTime?

  createdAt DateTime @default(now())

  catalog Catalog @relation(fields: [catalogId], references: [id], onDelete: Cascade)

  @@index([churchId])
  @@index([catalogId])
  @@map("volunteer_links")
}
```

And add the back-relation inside `model Catalog` in `catalog.prisma`:

```prisma
  volunteerLinks VolunteerLink[]
```

- [ ] **Step 6: Run the migration and regenerate the client**

```bash
# DATABASE_URL must point at the local dev Postgres (localhost:5432)
npx prisma migrate dev --name fundraiser_support
npx prisma generate
```

Expected: migration `fundraiser_support` created and applied; client regenerated without errors.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors — all new fields optional).

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat: add Ministry, VolunteerLink models and fundraiser fields to Catalog/Order"
```

---

### Task 2: RBAC — `fundraiser.create` / `fundraiser.edit` / `fundraiser.publish`

**Files:**
- Modify: `lib/rbac/can.ts` (Action union ~line 5-35; CanContext ~line 37-53; switch ~line 124+)
- Test: `tests/unit/rbac/can.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the top-level `describe("can() — RBAC permission gate", ...)` block in `tests/unit/rbac/can.test.ts`:

```typescript
  // ── Fundraisers ─────────────────────────────────────────────────────
  describe("fundraiser.create", () => {
    it("allows STAFF", async () => {
      const result = await can("fundraiser.create", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      const result = await can("fundraiser.create", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      const result = await can("fundraiser.create", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies COOK", async () => {
      const result = await can("fundraiser.create", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      const result = await can("fundraiser.create", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      const result = await can("fundraiser.create", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  for (const action of ["fundraiser.edit", "fundraiser.publish"] as const) {
    describe(action, () => {
      it("allows ADMIN on any fundraiser", async () => {
        const result = await can(action, makeCtx(["ADMIN"], { catalogCreatedById: "someone-else" }));
        expect(result.allowed).toBe(true);
      });
      it("allows STAFF on their own fundraiser", async () => {
        const result = await can(action, makeCtx(["STAFF"], { catalogCreatedById: "user-1" }));
        expect(result.allowed).toBe(true);
      });
      it("denies STAFF on someone else's fundraiser", async () => {
        const result = await can(action, makeCtx(["STAFF"], { catalogCreatedById: "someone-else" }));
        expect(result.allowed).toBe(false);
      });
      it("denies STAFF when creator is unknown", async () => {
        const result = await can(action, makeCtx(["STAFF"]));
        expect(result.allowed).toBe(false);
      });
      it("denies COOK", async () => {
        const result = await can(action, makeCtx(["COOK"], { catalogCreatedById: "user-1" }));
        expect(result.allowed).toBe(false);
      });
    });
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/rbac/can.test.ts`
Expected: FAIL — TypeScript rejects `"fundraiser.create"` (not in Action union) or runtime hits `Unknown action`.

- [ ] **Step 3: Implement**

In `lib/rbac/can.ts`:

Add to the `Action` union (after `"catalog.publish"`):

```typescript
  | "fundraiser.create"
  | "fundraiser.edit"
  | "fundraiser.publish"
```

Add to `CanContext` (after `catalogStatus?: string;`):

```typescript
  catalogCreatedById?: string;
```

Add cases in `resolvePermission`'s switch, after the `catalog.edit`/`catalog.publish` case:

```typescript
    // ── Fundraisers ────────────────────────────────────────────────────
    case "fundraiser.create":
      if (roles.has("STAFF")) return allow();
      return deny("Requires STAFF, ADMIN, or OWNER");

    case "fundraiser.edit":
    case "fundraiser.publish":
      if (roles.has("ADMIN")) return allow();
      if (roles.has("STAFF")) {
        if (ctx.catalogCreatedById && ctx.catalogCreatedById === ctx.userId) {
          return allow({ restriction: "own fundraisers only" });
        }
        return deny("STAFF can only manage fundraisers they created");
      }
      return deny("Requires STAFF (own fundraisers only), ADMIN, or OWNER");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/rbac/can.test.ts`
Expected: PASS (all new and existing cases).

- [ ] **Step 5: Commit**

```bash
git add lib/rbac/can.ts tests/unit/rbac/can.test.ts
git commit -m "feat: add fundraiser.create/edit/publish RBAC actions with own-fundraiser scoping"
```

---

### Task 3: Delivery eligibility helper

**Files:**
- Create: `lib/fundraisers/delivery-eligibility.ts`
- Test: `tests/unit/fundraisers/delivery-eligibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/fundraisers/delivery-eligibility.test.ts`:

```typescript
import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { describe, expect, it } from "vitest";

describe("isDeliveryEligible", () => {
  it("returns true when no rule is set (null)", () => {
    expect(isDeliveryEligible(1, null)).toBe(true);
  });
  it("returns true when no rule is set (undefined)", () => {
    expect(isDeliveryEligible(1, undefined)).toBe(true);
  });
  it("returns true when item count meets the minimum", () => {
    expect(isDeliveryEligible(3, 3)).toBe(true);
  });
  it("returns true when item count exceeds the minimum", () => {
    expect(isDeliveryEligible(5, 3)).toBe(true);
  });
  it("returns false when item count is below the minimum", () => {
    expect(isDeliveryEligible(2, 3)).toBe(false);
  });
  it("returns false for an empty cart when a rule exists", () => {
    expect(isDeliveryEligible(0, 1)).toBe(false);
  });
  it("treats a zero/negative rule as no rule", () => {
    expect(isDeliveryEligible(0, 0)).toBe(true);
    expect(isDeliveryEligible(0, -2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/fundraisers/delivery-eligibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/fundraisers/delivery-eligibility.ts`:

```typescript
/**
 * Per-fundraiser delivery eligibility: an order must contain at least
 * `minItemsForDelivery` items (sum of quantities) to qualify for delivery.
 * null/undefined/<=0 means no rule.
 */
export function isDeliveryEligible(
  totalItemCount: number,
  minItemsForDelivery: number | null | undefined,
): boolean {
  if (!minItemsForDelivery || minItemsForDelivery <= 0) return true;
  return totalItemCount >= minItemsForDelivery;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/fundraisers/delivery-eligibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fundraisers/delivery-eligibility.ts tests/unit/fundraisers/delivery-eligibility.test.ts
git commit -m "feat: add min-items delivery eligibility helper"
```

---

### Task 4: Volunteer link service (create / validate / revoke)

**Files:**
- Create: `lib/fundraisers/volunteer-links.ts`
- Test: `tests/unit/fundraisers/volunteer-links.test.ts`

Tokens: 32 random bytes hex (same as `generateSecureToken` in `lib/auth/create-phone-session.ts`), stored as a SHA-256 hash — the raw token exists only in the generated URL.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/fundraisers/volunteer-links.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  volunteerLink: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  catalog: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { volunteerLink: mocks.volunteerLink, catalog: mocks.catalog },
}));

import {
  createVolunteerLink,
  hashToken,
  validateVolunteerToken,
} from "@/lib/fundraisers/volunteer-links";

describe("volunteer links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createVolunteerLink", () => {
    it("stores a hash, not the raw token, and returns the raw token", async () => {
      mocks.catalog.findFirst.mockResolvedValue({
        id: "cat-1",
        churchId: "church-1",
        closesAt: new Date("2026-08-01T00:00:00Z"),
      });
      mocks.volunteerLink.create.mockResolvedValue({ id: "link-1" });

      const result = await createVolunteerLink({
        catalogId: "cat-1",
        churchId: "church-1",
        createdById: "user-1",
      });

      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
      const createArg = mocks.volunteerLink.create.mock.calls[0][0];
      expect(createArg.data.tokenHash).toBe(hashToken(result.token));
      expect(createArg.data.tokenHash).not.toBe(result.token);
      // expiry defaults to catalog closesAt
      expect(createArg.data.expiresAt).toEqual(new Date("2026-08-01T00:00:00Z"));
    });

    it("throws when the catalog does not exist in this church", async () => {
      mocks.catalog.findFirst.mockResolvedValue(null);
      await expect(
        createVolunteerLink({ catalogId: "nope", churchId: "church-1", createdById: "user-1" }),
      ).rejects.toThrow("Catalog not found");
    });
  });

  describe("validateVolunteerToken", () => {
    const validRow = {
      id: "link-1",
      catalogId: "cat-1",
      churchId: "church-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      catalog: { id: "cat-1", status: "OPEN", churchId: "church-1" },
    };

    it("returns link context for a valid token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue(validRow);
      const result = await validateVolunteerToken("a".repeat(64));
      expect(result).toEqual({ catalogId: "cat-1", churchId: "church-1", linkId: "link-1" });
      // looked up by hash, not raw token
      expect(mocks.volunteerLink.findUnique.mock.calls[0][0].where.tokenHash).toBe(
        hashToken("a".repeat(64)),
      );
    });

    it("returns null for an unknown token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue(null);
      expect(await validateVolunteerToken("b".repeat(64))).toBeNull();
    });

    it("returns null for an expired token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({
        ...validRow,
        expiresAt: new Date(Date.now() - 1),
      });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });

    it("returns null for a revoked token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({ ...validRow, revokedAt: new Date() });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });

    it("returns null when the catalog is not OPEN", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({
        ...validRow,
        catalog: { ...validRow.catalog, status: "CLOSED" },
      });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/fundraisers/volunteer-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/fundraisers/volunteer-links.ts`:

```typescript
import crypto from "node:crypto";
import { db } from "@/lib/db";

const FALLBACK_EXPIRY_DAYS = 30;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface CreateVolunteerLinkParams {
  catalogId: string;
  churchId: string;
  createdById: string;
}

export interface VolunteerLinkContext {
  catalogId: string;
  churchId: string;
  linkId: string;
}

/** Creates a tokenized volunteer link. Raw token is returned once and never stored. */
export async function createVolunteerLink(
  params: CreateVolunteerLinkParams,
): Promise<{ token: string; linkId: string }> {
  const catalog = (await db.catalog.findFirst({
    where: { id: params.catalogId, churchId: params.churchId },
    select: { id: true, churchId: true, closesAt: true },
  })) as { id: string; churchId: string; closesAt: Date | null } | null;

  if (!catalog) {
    throw new Error("Catalog not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt =
    catalog.closesAt ?? new Date(Date.now() + FALLBACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const link = (await db.volunteerLink.create({
    data: {
      churchId: params.churchId,
      catalogId: params.catalogId,
      tokenHash: hashToken(token),
      createdById: params.createdById,
      expiresAt,
    },
    select: { id: true },
  })) as { id: string };

  return { token, linkId: link.id };
}

/** Validates a raw token. Returns link context, or null if invalid/expired/revoked/closed. */
export async function validateVolunteerToken(
  token: string,
): Promise<VolunteerLinkContext | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const link = (await (db.volunteerLink.findUnique as PrismaBypass)({
    where: { tokenHash: hashToken(token) },
    include: { catalog: { select: { id: true, status: true, churchId: true } } },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    catalogId: string;
    churchId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    catalog: { id: string; status: string; churchId: string } | null;
  } | null;

  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt < new Date()) return null;
  if (link.catalog?.status !== "OPEN") return null;

  return { catalogId: link.catalogId, churchId: link.churchId, linkId: link.id };
}

/** Revokes a link. Idempotent. */
export async function revokeVolunteerLink(linkId: string, churchId: string): Promise<void> {
  await (db.volunteerLink.update as PrismaBypass)({
    where: { id: linkId },
    data: { revokedAt: new Date() },
    _bypassTenancyCheck: true,
  }).catch(() => null);
  void churchId; // scoping enforced by caller's catalog lookup
}
```

Note: if `PrismaBypass` is not a global type in this repo's ambient declarations, match whatever cast idiom `lib/auth/create-phone-session.ts` compiles with — copy it exactly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/fundraisers/volunteer-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fundraisers/volunteer-links.ts tests/unit/fundraisers/volunteer-links.test.ts
git commit -m "feat: add volunteer link service with hashed tokens"
```

---

### Task 5: Extract shared order-creation service (+ idempotency + min-items validation)

**Files:**
- Create: `lib/orders/create-storefront-order.ts`
- Modify: `app/api/storefront/orders/route.ts` (becomes a thin wrapper)

This is a behavior-preserving refactor of `app/api/storefront/orders/route.ts:51-261` plus three additions: `channel`/`takenById`/`takenByName` params, `clientRequestId` idempotency, and server-side min-items validation for DELIVERY.

- [ ] **Step 1: Create the service**

Create `lib/orders/create-storefront-order.ts`:

```typescript
import { db } from "@/lib/db";
import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import type { Channel, PaymentMethod } from "@prisma/client";

export interface CartModifierPayload {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItemPayload {
  itemId: string;
  catalogId: string;
  itemName: string;
  quantity: number;
  basePrice: number;
  modifiers: CartModifierPayload[];
  totalPrice: number;
}

export interface DeliveryAddressPayload {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderParams {
  churchId: string;
  currency: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  paymentMethod?: string;
  scheduledFor?: string | null;
  smsOptIn?: boolean;
  tip?: number;
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  items: CartItemPayload[];
  channel: Channel;
  takenById?: string | null;
  takenByName?: string | null;
  clientRequestId?: string | null;
  markPaidCash?: boolean;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; deduplicated: boolean }
  | { ok: false; status: number; error: string };

export async function createStorefrontOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { churchId, items } = params;

  // Idempotency: same clientRequestId within a church returns the original order.
  if (params.clientRequestId) {
    const existing = await db.order.findFirst({
      where: { churchId, clientRequestId: params.clientRequestId },
      select: { id: true, number: true },
    });
    if (existing) {
      return { ok: true, orderId: existing.id, orderNumber: existing.number, deduplicated: true };
    }
  }

  // Validate catalog belongs to church (all items share one catalog)
  const firstCatalogId = items[0]?.catalogId;
  if (!firstCatalogId) {
    return { ok: false, status: 400, error: "Invalid items" };
  }
  const catalog = await db.catalog.findFirst({
    where: { id: firstCatalogId, churchId },
    select: { id: true, status: true, minItemsForDelivery: true },
  });
  if (!catalog) {
    return { ok: false, status: 400, error: "Invalid catalog" };
  }
  if (catalog.status !== "OPEN") {
    return { ok: false, status: 409, error: "This fundraiser has closed" };
  }

  // Server-side min-items-for-delivery enforcement
  if (params.fulfillment === "DELIVERY") {
    const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    if (!isDeliveryEligible(totalItemCount, catalog.minItemsForDelivery)) {
      return {
        ok: false,
        status: 422,
        error: `Delivery requires at least ${catalog.minItemsForDelivery} items`,
      };
    }
  }

  // Find or create customer (moved verbatim from the storefront route)
  const phoneNormalized = params.phone?.replace(/\D/g, "") || null;
  const emailNormalized = params.email?.trim().toLowerCase() || null;
  const customerName = params.customerName.trim();

  let customerId: string;
  if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId, phoneNormalized },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
      const updates: Record<string, unknown> = {};
      if (params.smsOptIn) updates.smsOptIn = true;
      if (emailNormalized) {
        updates.email = params.email?.trim();
        updates.emailNormalized = emailNormalized;
      }
      if (Object.keys(updates).length > 0) {
        await db.customer.update({ where: { id: existing.id }, data: updates });
      }
    } else {
      const created = await db.customer.create({
        data: {
          churchId,
          name: customerName,
          phone: params.phone ?? null,
          phoneNormalized,
          email: params.email?.trim() ?? null,
          emailNormalized,
          smsOptIn: params.smsOptIn ?? false,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else if (emailNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId, emailNormalized },
      select: { id: true },
    });
    customerId = existing
      ? existing.id
      : (
          await db.customer.create({
            data: { churchId, name: customerName, email: params.email?.trim(), emailNormalized },
            select: { id: true },
          })
        ).id;
  } else {
    const created = await db.customer.create({
      data: { churchId, name: customerName },
      select: { id: true },
    });
    customerId = created.id;
  }

  const counter = await db.orderCounter.upsert({
    where: { churchId },
    create: { churchId, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const tipAmount = typeof params.tip === "number" && params.tip >= 0 ? Math.round(params.tip) : 0;
  const orderTotal = subtotal + tipAmount;

  const resolvedPaymentMethod: PaymentMethod =
    params.paymentMethod === "cash"
      ? "CASH"
      : params.paymentMethod === "zelle"
        ? "ZELLE"
        : "PAY_ON_PICKUP";

  let order: { id: string; number: number };
  try {
    order = await db.order.create({
      data: {
        churchId,
        catalogId: catalog.id,
        customerId,
        number: counter.value,
        channel: params.channel,
        fulfillment: params.fulfillment,
        status: "DRAFT",
        currency: params.currency,
        subtotal,
        tax: 0,
        tip: tipAmount,
        total: orderTotal,
        notes: params.notes ?? null,
        scheduledFor: params.scheduledFor ? new Date(params.scheduledFor) : null,
        takenById: params.takenById ?? null,
        takenByName: params.takenByName ?? null,
        clientRequestId: params.clientRequestId ?? null,
        receiptLanguageVersion: 1,
        items: {
          create: items.map((item) => {
            const unitPrice =
              item.basePrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
            const itemSubtotal = unitPrice * item.quantity;
            return {
              itemId: item.itemId,
              itemName: item.itemName,
              unitPrice,
              quantity: item.quantity,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              modifierSnapshot: item.modifiers as any,
              subtotal: itemSubtotal,
              tax: 0,
              total: itemSubtotal,
            };
          }),
        },
        payments: {
          create: {
            method: resolvedPaymentMethod,
            status: params.markPaidCash ? "SUCCEEDED" : "PENDING",
            amount: orderTotal,
            currency: params.currency,
          },
        },
      },
      select: { id: true, number: true },
    });
  } catch (error: unknown) {
    // Unique-violation race on clientRequestId: another retry won — return its order.
    if (params.clientRequestId) {
      const existing = await db.order.findFirst({
        where: { churchId, clientRequestId: params.clientRequestId },
        select: { id: true, number: true },
      });
      if (existing) {
        return {
          ok: true,
          orderId: existing.id,
          orderNumber: existing.number,
          deduplicated: true,
        };
      }
    }
    throw error;
  }

  if (params.fulfillment === "DELIVERY" && params.deliveryAddress) {
    await db.deliveryInfo.create({
      data: {
        orderId: order.id,
        zoneId: params.zoneId ?? null,
        recipientName: customerName,
        phone: params.phone ?? "",
        line1: params.deliveryAddress.line1,
        city: params.deliveryAddress.city,
        region: params.deliveryAddress.region,
        postalCode: params.deliveryAddress.postalCode,
        country: params.deliveryAddress.country,
      },
    });
  }

  // DRAFT → SUBMITTED fires side effects (confirmation email, SMS, inventory)
  await transition(order.id, "SUBMITTED", {
    actorId: params.takenById ?? "guest",
    queue: effectQueue,
  });

  return { ok: true, orderId: order.id, orderNumber: order.number, deduplicated: false };
}
```

Check `PaymentStatus` enum for the exact "paid" value (`SUCCEEDED` vs `PAID` — read `prisma/schema/enums.prisma:89+`) and adjust `markPaidCash` mapping to match.

**Behavior deltas from the original route (intentional):** catalog must be OPEN (was unchecked), min-items validation, idempotency, channel/attribution params. Everything else is verbatim.

- [ ] **Step 2: Rewrite the storefront route as a thin wrapper**

Replace the body of `app/api/storefront/orders/route.ts` with:

```typescript
import { db } from "@/lib/db";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { type NextRequest, NextResponse } from "next/server";

interface OrderRequestBody {
  churchSlug: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  fulfillment?: string;
  paymentMethod?: string;
  scheduledFor?: string | null;
  smsOptIn?: boolean;
  tip?: number;
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  items: CartItemPayload[];
}

function isValidFulfillment(value: string): value is "PICKUP" | "DELIVERY" | "DINE_IN" {
  return ["PICKUP", "DELIVERY", "DINE_IN"].includes(value);
}

export async function POST(req: NextRequest) {
  let body: OrderRequestBody;
  try {
    body = (await req.json()) as OrderRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.churchSlug || !body.customerName?.trim() || !body.items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const church = await db.church.findFirst({
    where: { slug: body.churchSlug, status: "ACTIVE" },
    select: { id: true, currency: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for guest checkout
    _bypassTenancyCheck: true,
  });
  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const result = await createStorefrontOrder({
    churchId: church.id,
    currency: church.currency,
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    notes: body.notes,
    fulfillment:
      body.fulfillment && isValidFulfillment(body.fulfillment) ? body.fulfillment : "PICKUP",
    paymentMethod: body.paymentMethod,
    scheduledFor: body.scheduledFor,
    smsOptIn: body.smsOptIn,
    tip: body.tip,
    zoneId: body.zoneId,
    deliveryAddress: body.deliveryAddress,
    items: body.items,
    channel: "ONLINE",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { orderId: result.orderId, orderNumber: result.orderNumber },
    { status: 201 },
  );
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npx tsc --noEmit && pnpm test`
Expected: PASS. (If `tests/e2e/storefront.spec.ts` runs against a live server, run it separately per the repo's Playwright setup: `pnpm exec playwright test tests/e2e/storefront.spec.ts` — do this if the dev environment is up; otherwise unit suite green + type-check is the gate here.)

- [ ] **Step 4: Commit**

```bash
git add lib/orders/create-storefront-order.ts app/api/storefront/orders/route.ts
git commit -m "refactor: extract shared order-creation service with idempotency and min-items validation"
```

---

### Task 6: Ministries API

**Files:**
- Create: `app/api/ministries/route.ts`

- [ ] **Step 1: Implement GET (list) and POST (create-or-return-existing)**

Create `app/api/ministries/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const churchId = req.nextUrl.searchParams.get("churchId");
  if (!churchId) {
    return NextResponse.json({ error: "Missing churchId" }, { status: 400 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ministries = await db.ministry.findMany({
    where: { churchId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(ministries);
}

const createSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { churchId, name } = parsed.data;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await can("fundraiser.create", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return existing on name collision (create-on-the-fly combobox semantics)
  const existing = await db.ministry.findFirst({
    where: { churchId, name },
    select: { id: true, name: true },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const ministry = await db.ministry.create({
    data: { churchId, name },
    select: { id: true, name: true },
  });
  return NextResponse.json(ministry, { status: 201 });
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add app/api/ministries/route.ts
git commit -m "feat: add ministries API (list, create-on-the-fly)"
```

---

### Task 7: Fundraisers API — create (wizard submit) and read (clone prefill)

**Files:**
- Create: `app/api/fundraisers/route.ts`
- Create: `app/api/fundraisers/[catalogId]/route.ts`

- [ ] **Step 1: Implement POST /api/fundraisers**

Create `app/api/fundraisers/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const optionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceDelta: z.number().int(),
});

const modifierGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isRequired: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  options: z.array(optionSchema).min(1).max(30),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().int().min(0), // cents
  imageUrl: z.string().url().nullish(),
  modifierGroups: z.array(modifierGroupSchema).max(10).default([]),
});

const createFundraiserSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  ministryId: z.string().nullish(),
  kitchenId: z.string().nullish(),
  opensAt: z.string().datetime().nullish(),
  closesAt: z.string().datetime().nullish(),
  minItemsForDelivery: z.number().int().min(1).max(1000).nullish(),
  items: z.array(itemSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const parsed = createFundraiserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  const body = parsed.data;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await can("fundraiser.create", {
    userId: session.user.id,
    churchId: body.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ministry, if given, must belong to this church
  if (body.ministryId) {
    const ministry = await db.ministry.findFirst({
      where: { id: body.ministryId, churchId: body.churchId },
      select: { id: true },
    });
    if (!ministry) {
      return NextResponse.json({ error: "Invalid ministry" }, { status: 422 });
    }
  }

  const baseSlug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now()}`;

  const catalogId = await db.$transaction(async (tx) => {
    const catalog = await tx.catalog.create({
      data: {
        churchId: body.churchId,
        name: body.name,
        slug,
        description: body.description ?? null,
        status: "DRAFT",
        opensAt: body.opensAt ? new Date(body.opensAt) : null,
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
        kitchenId: body.kitchenId ?? null,
        ministryId: body.ministryId ?? null,
        minItemsForDelivery: body.minItemsForDelivery ?? null,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    for (const [index, itemInput] of body.items.entries()) {
      const item = await tx.item.create({
        data: {
          churchId: body.churchId,
          name: itemInput.name,
          defaultPrice: itemInput.price,
          imageUrl: itemInput.imageUrl ?? null,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      await tx.catalogItem.create({
        data: { catalogId: catalog.id, itemId: item.id, sortOrder: index },
      });

      for (const [groupIndex, groupInput] of itemInput.modifierGroups.entries()) {
        const group = await tx.modifierGroup.create({
          data: {
            churchId: body.churchId,
            name: groupInput.name,
            defaultIsRequired: groupInput.isRequired,
            defaultMinSelections: groupInput.minSelections,
            defaultMaxSelections: groupInput.maxSelections,
            options: {
              create: groupInput.options.map((opt, optIndex) => ({
                name: opt.name,
                priceDelta: opt.priceDelta,
                sortOrder: optIndex,
              })),
            },
          },
          select: { id: true },
        });
        await tx.itemModifierGroup.create({
          data: { itemId: item.id, groupId: group.id, sortOrder: groupIndex },
        });
      }
    }

    return catalog.id;
  });

  return NextResponse.json({ catalogId }, { status: 201 });
}
```

- [ ] **Step 2: Implement GET /api/fundraisers/[catalogId] (clone prefill)**

Create `app/api/fundraisers/[catalogId]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { catalogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await can("fundraiser.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      description: true,
      ministryId: true,
      minItemsForDelivery: true,
      kitchenId: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          priceOverride: true,
          item: {
            select: {
              name: true,
              defaultPrice: true,
              imageUrl: true,
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                  group: {
                    select: {
                      name: true,
                      defaultIsRequired: true,
                      defaultMinSelections: true,
                      defaultMaxSelections: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { name: true, priceDelta: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Shape matches the wizard's form state / POST payload
  return NextResponse.json({
    name: catalog.name,
    description: catalog.description,
    ministryId: catalog.ministryId,
    minItemsForDelivery: catalog.minItemsForDelivery,
    kitchenId: catalog.kitchenId,
    items: catalog.items.map((ci) => ({
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      imageUrl: ci.item.imageUrl,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
      })),
    })),
  });
}
```

Verify against `prisma/schema/catalog.prisma` that the `Item` relation to `ItemModifierGroup` is named `modifierGroups` and `Catalog.items` points at `CatalogItem` — adjust relation names to match the actual schema if they differ.

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add app/api/fundraisers/
git commit -m "feat: add fundraiser create and clone-prefill API endpoints"
```

---

### Task 8: Publish path — allow creators to open/close their own fundraiser

**Files:**
- Modify: `app/api/catalogs/[catalogId]/status/route.ts`

- [ ] **Step 1: Read the current status route**, then change its permission check to a two-step: try `catalog.publish`; on deny, load the catalog's `createdById` and try `fundraiser.publish`:

```typescript
  // Replace the single can("catalog.publish", ...) check with:
  const catalogRow = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: { createdById: true, status: true },
  });
  if (!catalogRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseCtx = {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  };
  let permitted = (await can("catalog.publish", baseCtx)).allowed;
  if (!permitted) {
    permitted = (
      await can("fundraiser.publish", {
        ...baseCtx,
        catalogCreatedById: catalogRow.createdById ?? undefined,
      })
    ).allowed;
  }
  if (!permitted) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

Keep the rest of the route (body parsing, status update) unchanged. Preserve its existing variable names — read the file first and integrate, don't paste blindly.

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit && pnpm test`
Expected: PASS.

```bash
git add "app/api/catalogs/[catalogId]/status/route.ts"
git commit -m "feat: allow fundraiser creators to publish/close their own fundraisers"
```

---

### Task 9: Volunteer links API (generate + revoke)

**Files:**
- Create: `app/api/fundraisers/[catalogId]/volunteer-links/route.ts`
- Create: `app/api/fundraisers/[catalogId]/volunteer-links/[linkId]/route.ts`

- [ ] **Step 1: Implement POST (generate)**

Create `app/api/fundraisers/[catalogId]/volunteer-links/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { createVolunteerLink } from "@/lib/fundraisers/volunteer-links";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { catalogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: { id: true, createdById: true },
  });
  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await can("fundraiser.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
    catalogCreatedById: catalog.createdById ?? undefined,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { token, linkId } = await createVolunteerLink({
    catalogId,
    churchId: membership.churchId,
    createdById: session.user.id,
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  return NextResponse.json({ linkId, url: `${baseUrl}/v/${token}` }, { status: 201 });
}
```

- [ ] **Step 2: Implement DELETE (revoke)**

Create `app/api/fundraisers/[catalogId]/volunteer-links/[linkId]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { revokeVolunteerLink } from "@/lib/fundraisers/volunteer-links";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string; linkId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { catalogId, linkId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: { id: true, createdById: true },
  });
  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await can("fundraiser.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
    catalogCreatedById: catalog.createdById ?? undefined,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Scope: the link must belong to this catalog
  const link = (await (db.volunteerLink.findUnique as PrismaBypass)({
    where: { id: linkId },
    select: { catalogId: true },
    _bypassTenancyCheck: true,
  })) as { catalogId: string } | null;
  if (!link || link.catalogId !== catalogId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await revokeVolunteerLink(linkId, membership.churchId);
  return NextResponse.json({ revoked: true });
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "app/api/fundraisers/[catalogId]/volunteer-links/"
git commit -m "feat: add volunteer link generate/revoke endpoints"
```

---

### Task 10: Volunteer-door public API (catalog fetch + order create)

**Files:**
- Create: `app/api/v/[token]/catalog/route.ts`
- Create: `app/api/v/[token]/orders/route.ts`

- [ ] **Step 1: Implement GET catalog**

Create `app/api/v/[token]/catalog/route.ts`:

```typescript
import { db } from "@/lib/db";
import { validateVolunteerToken } from "@/lib/fundraisers/volunteer-links";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const link = await validateVolunteerToken(token);
  if (!link) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const catalog = (await (db.catalog.findUnique as PrismaBypass)({
    where: { id: link.catalogId },
    select: {
      id: true,
      name: true,
      minItemsForDelivery: true,
      church: { select: { name: true, currency: true, accentColor: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        where: { isAvailable: true },
        select: {
          priceOverride: true,
          item: {
            select: {
              id: true,
              name: true,
              defaultPrice: true,
              imageUrl: true,
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                  group: {
                    select: {
                      id: true,
                      name: true,
                      defaultIsRequired: true,
                      defaultMinSelections: true,
                      defaultMaxSelections: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { id: true, name: true, priceDelta: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    _bypassTenancyCheck: true,
  })) as Record<string, unknown> | null;

  if (!catalog) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  return NextResponse.json(catalog);
}
```

- [ ] **Step 2: Implement POST orders**

Create `app/api/v/[token]/orders/route.ts`:

```typescript
import { db } from "@/lib/db";
import { validateVolunteerToken } from "@/lib/fundraisers/volunteer-links";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ token: string }>;
}

interface VolunteerOrderBody {
  volunteerName: string;
  customerName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  fulfillment?: "PICKUP" | "DELIVERY";
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  scheduledFor?: string | null;
  markPaidCash?: boolean;
  clientRequestId: string;
  items: CartItemPayload[];
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const link = await validateVolunteerToken(token);
  if (!link) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  let body: VolunteerOrderBody;
  try {
    body = (await req.json()) as VolunteerOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.volunteerName?.trim() ||
    !body.customerName?.trim() ||
    !body.phone?.trim() ||
    !body.clientRequestId?.trim() ||
    !body.items?.length
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // All items must reference the link's catalog — a token authorizes exactly one fundraiser.
  if (body.items.some((item) => item.catalogId !== link.catalogId)) {
    return NextResponse.json({ error: "Items do not match this fundraiser" }, { status: 400 });
  }

  const church = (await (db.church.findUnique as PrismaBypass)({
    where: { id: link.churchId },
    select: { currency: true },
    _bypassTenancyCheck: true,
  })) as { currency: string } | null;
  if (!church) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const result = await createStorefrontOrder({
    churchId: link.churchId,
    currency: church.currency,
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    notes: body.notes,
    fulfillment: body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP",
    paymentMethod: body.markPaidCash ? "cash" : undefined,
    scheduledFor: body.scheduledFor,
    zoneId: body.zoneId,
    deliveryAddress: body.deliveryAddress,
    items: body.items,
    channel: "VOLUNTEER",
    takenByName: body.volunteerName.trim().slice(0, 100),
    clientRequestId: body.clientRequestId,
    markPaidCash: body.markPaidCash,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { orderId: result.orderId, orderNumber: result.orderNumber, deduplicated: result.deduplicated },
    { status: result.deduplicated ? 200 : 201 },
  );
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "app/api/v/"
git commit -m "feat: add volunteer-door public API (catalog fetch, order create)"
```

---

### Task 11: Staff-door quick order API

**Files:**
- Create: `app/api/fundraisers/[catalogId]/orders/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/fundraisers/[catalogId]/orders/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string }>;
}

interface StaffOrderBody {
  customerName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  fulfillment?: "PICKUP" | "DELIVERY";
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  scheduledFor?: string | null;
  markPaidCash?: boolean;
  clientRequestId: string;
  items: CartItemPayload[];
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { catalogId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await can("order.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: StaffOrderBody;
  try {
    body = (await req.json()) as StaffOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (
    !body.customerName?.trim() ||
    !body.phone?.trim() ||
    !body.clientRequestId?.trim() ||
    !body.items?.length
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (body.items.some((item) => item.catalogId !== catalogId)) {
    return NextResponse.json({ error: "Items do not match this fundraiser" }, { status: 400 });
  }

  const church = await db.church.findFirst({
    where: { id: membership.churchId },
    select: { currency: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore ID-only lookup during staff order entry
    _bypassTenancyCheck: true,
  });
  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const orderResult = await createStorefrontOrder({
    churchId: membership.churchId,
    currency: church.currency,
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    notes: body.notes,
    fulfillment: body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP",
    paymentMethod: body.markPaidCash ? "cash" : undefined,
    scheduledFor: body.scheduledFor,
    zoneId: body.zoneId,
    deliveryAddress: body.deliveryAddress,
    items: body.items,
    channel: "VOLUNTEER",
    takenById: session.user.id,
    clientRequestId: body.clientRequestId,
    markPaidCash: body.markPaidCash,
  });

  if (!orderResult.ok) {
    return NextResponse.json({ error: orderResult.error }, { status: orderResult.status });
  }
  return NextResponse.json(
    {
      orderId: orderResult.orderId,
      orderNumber: orderResult.orderNumber,
      deduplicated: orderResult.deduplicated,
    },
    { status: orderResult.deduplicated ? 200 : 201 },
  );
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "app/api/fundraisers/[catalogId]/orders/"
git commit -m "feat: add staff-door quick order endpoint"
```

---

### Task 12: Send-queue hook (resilient submits)

**Files:**
- Create: `hooks/use-send-queue.ts`

- [ ] **Step 1: Implement**

Create `hooks/use-send-queue.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_INTERVAL_MS = 5000;
const MAX_ATTEMPTS_BEFORE_WARN = 3;

interface QueuedSubmit {
  clientRequestId: string;
  payload: unknown;
  attempts: number;
  label: string; // e.g. customer name — shown in the pending badge
}

interface SendQueueState {
  pending: QueuedSubmit[];
  lastResult: { orderNumber: number; label: string } | null;
  hasStuckSubmits: boolean;
}

function storageKey(scope: string): string {
  return `send-queue:${scope}`;
}

function loadQueue(scope: string): QueuedSubmit[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    return raw ? (JSON.parse(raw) as QueuedSubmit[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(scope: string, queue: QueuedSubmit[]): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(queue));
  } catch {
    // storage full/unavailable — queue lives in memory only
  }
}

/**
 * Resilient submit queue: enqueue() persists to localStorage and resolves
 * optimistically; a background loop POSTs each entry (idempotent via
 * clientRequestId) and retries failures until the endpoint accepts.
 */
export function useSendQueue(scope: string, endpoint: string) {
  const [state, setState] = useState<SendQueueState>({
    pending: [],
    lastResult: null,
    hasStuckSubmits: false,
  });
  const processing = useRef(false);

  // Hydrate persisted queue on mount (survives reloads)
  useEffect(() => {
    const persisted = loadQueue(scope);
    if (persisted.length > 0) {
      setState((s) => ({ ...s, pending: persisted }));
    }
  }, [scope]);

  const processQueue = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    try {
      let queue = loadQueue(scope);
      while (queue.length > 0) {
        const entry = queue[0];
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.payload),
          });
          if (res.ok) {
            const data = (await res.json()) as { orderNumber: number };
            queue = queue.slice(1);
            saveQueue(scope, queue);
            setState((s) => ({
              pending: queue,
              lastResult: { orderNumber: data.orderNumber, label: entry.label },
              hasStuckSubmits: false,
            }));
            continue;
          }
          if (res.status >= 400 && res.status < 500) {
            // Permanent rejection (validation, closed fundraiser) — drop and surface
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            queue = queue.slice(1);
            saveQueue(scope, queue);
            setState((s) => ({ ...s, pending: queue }));
            throw new Error(data?.error ?? `Order rejected (${res.status})`);
          }
          // 5xx — retriable
          throw Object.assign(new Error("Server error"), { retriable: true });
        } catch (error: unknown) {
          if (error instanceof Error && !("retriable" in error) && error.message !== "Failed to fetch") {
            // Permanent rejection already dequeued above — rethrow to caller via state
            setState((s) => ({ ...s, hasStuckSubmits: false }));
            throw error;
          }
          // Network failure or 5xx: bump attempts, keep in queue, stop the loop
          const bumped = { ...entry, attempts: entry.attempts + 1 };
          queue = [bumped, ...queue.slice(1)];
          saveQueue(scope, queue);
          setState((s) => ({
            ...s,
            pending: queue,
            hasStuckSubmits: bumped.attempts >= MAX_ATTEMPTS_BEFORE_WARN,
          }));
          break;
        }
      }
    } finally {
      processing.current = false;
    }
  }, [scope, endpoint]);

  // Background retry loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (loadQueue(scope).length > 0) void processQueue();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scope, processQueue]);

  // Loud warning when closing with unsent orders
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (loadQueue(scope).length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [scope]);

  const enqueue = useCallback(
    (payload: unknown, label: string) => {
      const clientRequestId = crypto.randomUUID();
      const entry: QueuedSubmit = {
        clientRequestId,
        payload: { ...(payload as Record<string, unknown>), clientRequestId },
        attempts: 0,
        label,
      };
      const queue = [...loadQueue(scope), entry];
      saveQueue(scope, queue);
      setState((s) => ({ ...s, pending: queue }));
      void processQueue();
    },
    [scope, processQueue],
  );

  return { enqueue, ...state };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add hooks/use-send-queue.ts
git commit -m "feat: add resilient send-queue hook for quick-entry submits"
```

---

### Task 13: Quick-entry UI (shared component + two routes)

**Files:**
- Create: `components/fundraisers/quick-entry.tsx`
- Create: `app/(dashboard)/fundraisers/[catalogId]/take-orders/page.tsx`
- Create: `app/v/[token]/page.tsx`

- [ ] **Step 1: Build the shared quick-entry component**

Create `components/fundraisers/quick-entry.tsx`. POS tap grid → customer sheet → submit → reset. Uses `useSendQueue`. Phone-first: min 44px touch targets, `text-lg`.

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendQueue } from "@/hooks/use-send-queue";
import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { useMemo, useState } from "react";

export interface QuickEntryOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface QuickEntryModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: QuickEntryOption[];
}

export interface QuickEntryItem {
  itemId: string;
  name: string;
  price: number; // cents, resolved (priceOverride ?? defaultPrice)
  modifierGroups: QuickEntryModifierGroup[];
}

export interface QuickEntryCatalog {
  catalogId: string;
  catalogName: string;
  churchName: string;
  minItemsForDelivery: number | null;
  deliveryEnabled: boolean;
  items: QuickEntryItem[];
}

interface CartLine {
  key: string; // itemId + serialized selections
  itemId: string;
  itemName: string;
  basePrice: number;
  quantity: number;
  modifiers: { groupName: string; optionName: string; priceDelta: number }[];
}

interface QuickEntryProps {
  catalog: QuickEntryCatalog;
  endpoint: string; // POST target (staff or volunteer door)
  takerLabel: string; // "as Maria" strip text
  extraPayload?: Record<string, unknown>; // e.g. { volunteerName }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function lineUnitPrice(line: CartLine): number {
  return line.basePrice + line.modifiers.reduce((s, m) => s + m.priceDelta, 0);
}

export function QuickEntry({ catalog, endpoint, takerLabel, extraPayload }: QuickEntryProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState<QuickEntryItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState({ line1: "", city: "", region: "", postalCode: "" });
  const [markPaidCash, setMarkPaidCash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enqueue, pending, lastResult, hasStuckSubmits } = useSendQueue(
    `quick-entry:${catalog.catalogId}`,
    endpoint,
  );

  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0), [cart]);
  const deliveryEligible =
    catalog.deliveryEnabled && isDeliveryEligible(itemCount, catalog.minItemsForDelivery);

  // Auto-flip back to pickup if the cart drops below the delivery threshold
  if (fulfillment === "DELIVERY" && !deliveryEligible) {
    setFulfillment("PICKUP");
    setError(
      catalog.minItemsForDelivery
        ? `Delivery needs at least ${catalog.minItemsForDelivery} items — switched to pickup.`
        : "Delivery unavailable — switched to pickup.",
    );
  }

  function addLine(item: QuickEntryItem, modifiers: CartLine["modifiers"]) {
    const key = `${item.itemId}:${modifiers.map((m) => m.optionName).join("|")}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        { key, itemId: item.itemId, itemName: item.name, basePrice: item.price, quantity: 1, modifiers },
      ];
    });
  }

  function handleTileTap(item: QuickEntryItem) {
    setError(null);
    if (item.modifierGroups.length > 0) {
      setPickerItem(item);
    } else {
      addLine(item, []);
    }
  }

  function decrementItem(itemId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function itemQty(itemId: string): number {
    return cart.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0);
  }

  function resetForNextOrder() {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setEmail("");
    setFulfillment("PICKUP");
    setAddress({ line1: "", city: "", region: "", postalCode: "" });
    setMarkPaidCash(false);
    setSheetOpen(false);
    setError(null);
  }

  function handleSubmit() {
    if (!customerName.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (fulfillment === "DELIVERY" && (!address.line1.trim() || !address.postalCode.trim())) {
      setError("Delivery needs a street address and ZIP.");
      return;
    }
    const payload = {
      ...extraPayload,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      fulfillment,
      deliveryAddress:
        fulfillment === "DELIVERY" ? { ...address, country: "US" } : null,
      markPaidCash,
      items: cart.map((l) => ({
        itemId: l.itemId,
        catalogId: catalog.catalogId,
        itemName: l.itemName,
        quantity: l.quantity,
        basePrice: l.basePrice,
        modifiers: l.modifiers,
        totalPrice: lineUnitPrice(l) * l.quantity,
      })),
    };
    enqueue(payload, customerName.trim());
    resetForNextOrder();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32">
      {/* Header strip */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{catalog.catalogName}</h1>
            <p className="text-sm text-slate-500">
              {catalog.churchName} · taking orders {takerLabel}
            </p>
          </div>
          {pending.length > 0 && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                hasStuckSubmits ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {pending.length} sending…
            </span>
          )}
        </div>
        {lastResult && (
          <p className="mt-1 text-sm text-emerald-600">
            ✓ Order #{lastResult.orderNumber} — {lastResult.label}
          </p>
        )}
        {hasStuckSubmits && (
          <p className="mt-1 text-sm text-red-600">
            Connection trouble — orders are saved on this device and will retry automatically.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Tap grid */}
      <div className="grid grid-cols-2 gap-3">
        {catalog.items.map((item) => {
          const qty = itemQty(item.itemId);
          return (
            <div key={item.itemId} className="relative">
              <button
                type="button"
                onClick={() => handleTileTap(item)}
                className={`min-h-24 w-full rounded-xl border-2 p-3 text-center transition active:scale-95 ${
                  qty > 0 ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="block text-base font-semibold">{item.name}</span>
                <span className="block text-sm text-slate-500">{formatCents(item.price)}</span>
              </button>
              {qty > 0 && (
                <>
                  <span className="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-sm font-bold text-white">
                    ×{qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => decrementItem(item.itemId)}
                    aria-label={`Remove one ${item.name}`}
                    className="absolute -left-2 -top-2 h-7 w-7 rounded-full bg-slate-700 text-sm font-bold text-white"
                  >
                    −
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Option picker (simple modal) */}
      {pickerItem && (
        <OptionPicker
          item={pickerItem}
          onConfirm={(modifiers) => {
            addLine(pickerItem, modifiers);
            setPickerItem(null);
          }}
          onCancel={() => setPickerItem(null)}
        />
      )}

      {/* Bottom bar → customer sheet */}
      {itemCount > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-4">
          <Button className="h-14 w-full text-lg" onClick={() => setSheetOpen(true)}>
            {itemCount} {itemCount === 1 ? "item" : "items"} · {formatCents(total)} — Customer info →
          </Button>
        </div>
      )}

      {/* Customer sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Customer info</h2>
              <button type="button" className="text-slate-500" onClick={() => setSheetOpen(false)}>
                ← Back to items
              </button>
            </div>
            <div className="space-y-3">
              <Input
                className="h-12 text-lg"
                placeholder="Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                className="h-12 text-lg"
                type="tel"
                placeholder="Phone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                className="h-12 text-lg"
                type="email"
                placeholder="Email (optional — sends confirmation)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={fulfillment === "PICKUP" ? "default" : "outline"}
                  className="h-12 flex-1"
                  onClick={() => setFulfillment("PICKUP")}
                >
                  Pickup
                </Button>
                <Button
                  type="button"
                  variant={fulfillment === "DELIVERY" ? "default" : "outline"}
                  className="h-12 flex-1"
                  disabled={!deliveryEligible}
                  onClick={() => setFulfillment("DELIVERY")}
                >
                  {deliveryEligible
                    ? "Delivery"
                    : catalog.minItemsForDelivery
                      ? `Delivery (${catalog.minItemsForDelivery}+ items)`
                      : "Delivery unavailable"}
                </Button>
              </div>
              {fulfillment === "DELIVERY" && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <Input
                    placeholder="Street address *"
                    value={address.line1}
                    onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="City"
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    />
                    <Input
                      placeholder="State"
                      className="w-24"
                      value={address.region}
                      onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value }))}
                    />
                    <Input
                      placeholder="ZIP *"
                      className="w-28"
                      value={address.postalCode}
                      onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={markPaidCash}
                  onChange={(e) => setMarkPaidCash(e.target.checked)}
                />
                Paid cash now (default: pay at pickup/delivery)
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="h-14 w-full text-lg" onClick={handleSubmit}>
                Submit — {formatCents(total)} · Next order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OptionPickerProps {
  item: QuickEntryItem;
  onConfirm: (modifiers: CartLine["modifiers"]) => void;
  onCancel: () => void;
}

function OptionPicker({ item, onConfirm, onCancel }: OptionPickerProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  function toggle(group: QuickEntryModifierGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      const next =
        group.maxSelections === 1 ? [optionId] : [...current, optionId].slice(0, group.maxSelections);
      return { ...prev, [group.id]: next };
    });
  }

  const valid = item.modifierGroups.every((g) => {
    const count = (selections[g.id] ?? []).length;
    const min = g.isRequired ? Math.max(1, g.minSelections) : g.minSelections;
    return count >= min && count <= g.maxSelections;
  });

  function confirm() {
    const modifiers = item.modifierGroups.flatMap((g) =>
      (selections[g.id] ?? []).map((optionId) => {
        const option = g.options.find((o) => o.id === optionId);
        return { groupName: g.name, optionName: option?.name ?? "", priceDelta: option?.priceDelta ?? 0 };
      }),
    );
    onConfirm(modifiers);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">{item.name}</h2>
        {item.modifierGroups.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="mb-2 text-sm font-medium text-slate-600">
              {group.name}
              {group.isRequired && <span className="text-red-500"> *</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const selected = (selections[group.id] ?? []).includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(group, option.id)}
                    className={`rounded-full border-2 px-4 py-2 text-sm ${
                      selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                    }`}
                  >
                    {option.name}
                    {option.priceDelta !== 0 && ` (+$${(option.priceDelta / 100).toFixed(2)})`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="h-12 flex-1" disabled={!valid} onClick={confirm}>
            Add to order
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Staff-door page**

Create `app/(dashboard)/fundraisers/[catalogId]/take-orders/page.tsx`:

```tsx
import { QuickEntry, type QuickEntryCatalog } from "@/components/fundraisers/quick-entry";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ catalogId: string }>;
}

export default async function TakeOrdersPage({ params }: PageProps) {
  const { catalogId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: { status: string; churchId: string; roles: import("@prisma/client").Role[] }) =>
      m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const permitted = await can("order.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!permitted.allowed) redirect("/");

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId, status: "OPEN" },
    select: {
      id: true,
      name: true,
      minItemsForDelivery: true,
      church: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        where: { isAvailable: true },
        select: {
          priceOverride: true,
          item: {
            select: {
              id: true,
              name: true,
              defaultPrice: true,
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                  group: {
                    select: {
                      id: true,
                      name: true,
                      defaultIsRequired: true,
                      defaultMinSelections: true,
                      defaultMaxSelections: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { id: true, name: true, priceDelta: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!catalog) notFound();

  const quickEntryCatalog: QuickEntryCatalog = {
    catalogId: catalog.id,
    catalogName: catalog.name,
    churchName: catalog.church.name,
    minItemsForDelivery: catalog.minItemsForDelivery,
    deliveryEnabled: true,
    items: catalog.items.map((ci) => ({
      itemId: ci.item.id,
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        id: img.group.id,
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options,
      })),
    })),
  };

  const takerName = session.user.name ?? "staff";

  return (
    <QuickEntry
      catalog={quickEntryCatalog}
      endpoint={`/api/fundraisers/${catalog.id}/orders`}
      takerLabel={`as ${takerName}`}
    />
  );
}
```

Note: read `ChurchSettings.brandTokens` fulfillment toggles if the storefront checkout consults them for enabling delivery, and mirror that into `deliveryEnabled` — check `app/(storefront)/[churchSlug]/checkout/page.tsx` for how it decides delivery availability and copy the source of truth.

- [ ] **Step 3: Volunteer-door page**

Create `app/v/[token]/page.tsx` (client wrapper fetches via the token API; volunteer types a name once, kept in sessionStorage):

```tsx
"use client";

import { QuickEntry, type QuickEntryCatalog } from "@/components/fundraisers/quick-entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface VolunteerCatalogResponse {
  id: string;
  name: string;
  minItemsForDelivery: number | null;
  church: { name: string; currency: string; accentColor: string | null };
  items: Array<{
    priceOverride: number | null;
    item: {
      id: string;
      name: string;
      defaultPrice: number;
      modifierGroups: Array<{
        group: {
          id: string;
          name: string;
          defaultIsRequired: boolean;
          defaultMinSelections: number;
          defaultMaxSelections: number;
          options: Array<{ id: string; name: string; priceDelta: number }>;
        };
      }>;
    };
  }>;
}

export default function VolunteerPage() {
  const params = useParams<{ token: string }>();
  const [catalog, setCatalog] = useState<VolunteerCatalogResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "invalid" | "ready">("loading");
  const [volunteerName, setVolunteerName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(`volunteer-name:${params.token}`);
    if (saved) {
      setVolunteerName(saved);
      setNameConfirmed(true);
    }
    fetch(`/api/v/${params.token}/catalog`)
      .then(async (res) => {
        if (!res.ok) throw new Error("invalid");
        setCatalog((await res.json()) as VolunteerCatalogResponse);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [params.token]);

  if (status === "loading") {
    return <p className="p-8 text-center text-slate-500">Loading…</p>;
  }
  if (status === "invalid" || !catalog) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 text-slate-500">
          The fundraiser may have closed, or the link was revoked. Ask your fundraiser leader for a
          new one.
        </p>
      </div>
    );
  }

  if (!nameConfirmed) {
    return (
      <div className="mx-auto max-w-sm p-8">
        <h1 className="text-xl font-semibold">{catalog.name}</h1>
        <p className="mb-4 mt-1 text-slate-500">{catalog.church.name}</p>
        <p className="mb-2 text-sm text-slate-600">Your name (shown on orders you take):</p>
        <Input
          className="h-12 text-lg"
          value={volunteerName}
          onChange={(e) => setVolunteerName(e.target.value)}
          placeholder="e.g. Maria"
        />
        <Button
          className="mt-3 h-12 w-full"
          disabled={!volunteerName.trim()}
          onClick={() => {
            sessionStorage.setItem(`volunteer-name:${params.token}`, volunteerName.trim());
            setNameConfirmed(true);
          }}
        >
          Start taking orders
        </Button>
      </div>
    );
  }

  const quickEntryCatalog: QuickEntryCatalog = {
    catalogId: catalog.id,
    catalogName: catalog.name,
    churchName: catalog.church.name,
    minItemsForDelivery: catalog.minItemsForDelivery,
    deliveryEnabled: true,
    items: catalog.items.map((ci) => ({
      itemId: ci.item.id,
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        id: img.group.id,
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options,
      })),
    })),
  };

  return (
    <QuickEntry
      catalog={quickEntryCatalog}
      endpoint={`/api/v/${params.token}/orders`}
      takerLabel={`as ${volunteerName}`}
      extraPayload={{ volunteerName }}
    />
  );
}
```

Note: `app/v/` sits outside all route groups, so it gets the root layout only — verify the root layout doesn't require auth (it shouldn't; the storefront relies on the same).

- [ ] **Step 4: Verify in the browser**

Run: `pnpm dev`, then create a fundraiser via Prisma Studio or seed data, open both routes on a phone-sized viewport, take a test order, confirm it appears in the kitchen view.

- [ ] **Step 5: Type-check, lint, commit**

Run: `npx tsc --noEmit && pnpm build`
Expected: PASS.

```bash
git add components/fundraisers/quick-entry.tsx "app/(dashboard)/fundraisers/" app/v/
git commit -m "feat: add volunteer quick-entry UI with POS tap grid and dual access routes"
```

---

### Task 14: Fundraiser wizard UI + catalog page entry points

**Files:**
- Create: `components/fundraisers/fundraiser-wizard.tsx`
- Create: `app/(dashboard)/fundraisers/new/page.tsx`
- Modify: `components/catalog/catalog-list.tsx` (New Fundraiser button, ministry badge, Duplicate action)

- [ ] **Step 1: Wizard page (server component)**

Create `app/(dashboard)/fundraisers/new/page.tsx`:

```tsx
import { FundraiserWizard } from "@/components/fundraisers/fundraiser-wizard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ cloneFrom?: string }>;
}

export default async function NewFundraiserPage({ searchParams }: PageProps) {
  const { cloneFrom } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: { status: string; churchId: string; roles: import("@prisma/client").Role[] }) =>
      m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const permitted = await can("fundraiser.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!permitted.allowed) redirect("/catalog");

  const [ministries, kitchens] = await Promise.all([
    db.ministry.findMany({
      where: { churchId: membership.churchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.kitchen.findMany({
      where: { churchId: membership.churchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="p-6">
      <FundraiserWizard
        churchId={membership.churchId}
        ministries={ministries}
        kitchens={kitchens}
        cloneFromCatalogId={cloneFrom ?? null}
      />
    </main>
  );
}
```

(Verify the kitchen model name — `db.kitchen` — against `prisma/schema/`; the multi-kitchen feature landed in commit `810c005`. Adjust if the model is named differently.)

- [ ] **Step 2: Wizard component**

Create `components/fundraisers/fundraiser-wizard.tsx`. Single page, four collapsible sections, matching the POST `/api/fundraisers` payload from Task 7. Full component:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Ministry {
  id: string;
  name: string;
}
interface Kitchen {
  id: string;
  name: string;
}

interface WizardOption {
  name: string;
  priceDelta: number;
}
interface WizardModifierGroup {
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: WizardOption[];
}
interface WizardItem {
  name: string;
  price: number; // cents
  imageUrl?: string | null;
  modifierGroups: WizardModifierGroup[];
}

interface FundraiserWizardProps {
  churchId: string;
  ministries: Ministry[];
  kitchens: Kitchen[];
  cloneFromCatalogId: string | null;
}

type SectionId = "basics" | "items" | "delivery" | "publish";

const EMPTY_ITEM: WizardItem = { name: "", price: 0, modifierGroups: [] };

export function FundraiserWizard({
  churchId,
  ministries: initialMinistries,
  kitchens,
  cloneFromCatalogId,
}: FundraiserWizardProps) {
  const router = useRouter();
  const [openSection, setOpenSection] = useState<SectionId>("basics");
  const [ministries, setMinistries] = useState(initialMinistries);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCatalogId, setCreatedCatalogId] = useState<string | null>(null);
  const [volunteerUrl, setVolunteerUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ministryId, setMinistryId] = useState<string>("");
  const [newMinistryName, setNewMinistryName] = useState("");
  const [kitchenId, setKitchenId] = useState<string>(kitchens[0]?.id ?? "");
  const [closesAt, setClosesAt] = useState("");
  const [minItemsForDelivery, setMinItemsForDelivery] = useState("");
  const [items, setItems] = useState<WizardItem[]>([{ ...EMPTY_ITEM }]);

  // Clone prefill
  useEffect(() => {
    if (!cloneFromCatalogId) return;
    fetch(`/api/fundraisers/${cloneFromCatalogId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          name: string;
          description: string | null;
          ministryId: string | null;
          minItemsForDelivery: number | null;
          kitchenId: string | null;
          items: WizardItem[];
        };
        setName(`${data.name} (copy)`);
        setDescription(data.description ?? "");
        setMinistryId(data.ministryId ?? "");
        setKitchenId(data.kitchenId ?? kitchens[0]?.id ?? "");
        setMinItemsForDelivery(data.minItemsForDelivery ? String(data.minItemsForDelivery) : "");
        setItems(data.items.length > 0 ? data.items : [{ ...EMPTY_ITEM }]);
      })
      .catch(() => null);
  }, [cloneFromCatalogId, kitchens]);

  function updateItem(index: number, patch: Partial<WizardItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addOptionGroup(itemIndex: number) {
    updateItem(itemIndex, {
      modifierGroups: [
        ...items[itemIndex].modifierGroups,
        { name: "", isRequired: false, minSelections: 0, maxSelections: 1, options: [{ name: "", priceDelta: 0 }] },
      ],
    });
  }

  function updateGroup(itemIndex: number, groupIndex: number, patch: Partial<WizardModifierGroup>) {
    updateItem(itemIndex, {
      modifierGroups: items[itemIndex].modifierGroups.map((g, i) =>
        i === groupIndex ? { ...g, ...patch } : g,
      ),
    });
  }

  async function ensureMinistry(): Promise<string | null> {
    if (ministryId) return ministryId;
    if (!newMinistryName.trim()) return null;
    const res = await fetch("/api/ministries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ churchId, name: newMinistryName.trim() }),
    });
    if (!res.ok) throw new Error("Could not create ministry");
    const ministry = (await res.json()) as Ministry;
    setMinistries((prev) =>
      prev.some((m) => m.id === ministry.id) ? prev : [...prev, ministry],
    );
    setMinistryId(ministry.id);
    return ministry.id;
  }

  async function handleSaveDraft(): Promise<string | null> {
    setError(null);
    const validItems = items.filter((item) => item.name.trim() && item.price > 0);
    if (!name.trim() || validItems.length === 0) {
      setError("A fundraiser needs a name and at least one item with a price.");
      return null;
    }
    setSaving(true);
    try {
      const resolvedMinistryId = await ensureMinistry();
      const res = await fetch("/api/fundraisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchId,
          name: name.trim(),
          description: description.trim() || null,
          ministryId: resolvedMinistryId,
          kitchenId: kitchenId || null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          opensAt: new Date().toISOString(),
          minItemsForDelivery: minItemsForDelivery ? Number(minItemsForDelivery) : null,
          items: validItems.map((item) => ({
            ...item,
            modifierGroups: item.modifierGroups
              .filter((g) => g.name.trim() && g.options.some((o) => o.name.trim()))
              .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) })),
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to save fundraiser");
      }
      const { catalogId } = (await res.json()) as { catalogId: string };
      setCreatedCatalogId(catalogId);
      return catalogId;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const catalogId = createdCatalogId ?? (await handleSaveDraft());
    if (!catalogId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      setOpenSection("publish");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateVolunteerLink() {
    if (!createdCatalogId) return;
    const res = await fetch(`/api/fundraisers/${createdCatalogId}/volunteer-links`, {
      method: "POST",
    });
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      setVolunteerUrl(data.url);
    }
  }

  function Section({
    id,
    number,
    title,
    summary,
    children,
  }: {
    id: SectionId;
    number: number;
    title: string;
    summary?: string;
    children: React.ReactNode;
  }) {
    const isOpen = openSection === id;
    return (
      <div className={`rounded-xl border-2 ${isOpen ? "border-emerald-500" : "border-slate-200"}`}>
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setOpenSection(id)}
        >
          <span className="font-semibold">
            {number} · {title}
          </span>
          {!isOpen && summary && <span className="text-sm text-emerald-600">{summary}</span>}
        </button>
        {isOpen && <div className="border-t px-4 py-4">{children}</div>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold">New Fundraiser</h1>
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <Section id="basics" number={1} title="Basics" summary={name || undefined}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="fr-name">Fundraiser name</Label>
            <Input id="fr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pupusa Sale — March 14" />
          </div>
          <div>
            <Label htmlFor="fr-desc">Description (optional)</Label>
            <Textarea id="fr-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fr-ministry">Ministry</Label>
            <div className="flex gap-2">
              <select
                id="fr-ministry"
                className="h-10 flex-1 rounded-md border border-slate-200 px-3"
                value={ministryId}
                onChange={(e) => setMinistryId(e.target.value)}
              >
                <option value="">— none —</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Input
                className="flex-1"
                placeholder="…or type a new ministry"
                value={newMinistryName}
                onChange={(e) => {
                  setNewMinistryName(e.target.value);
                  if (e.target.value) setMinistryId("");
                }}
              />
            </div>
          </div>
          {kitchens.length > 1 && (
            <div>
              <Label htmlFor="fr-kitchen">Kitchen</Label>
              <select
                id="fr-kitchen"
                className="h-10 w-full rounded-md border border-slate-200 px-3"
                value={kitchenId}
                onChange={(e) => setKitchenId(e.target.value)}
              >
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="fr-closes">Orders close</Label>
            <Input id="fr-closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
          <Button onClick={() => setOpenSection("items")}>Next: Menu items</Button>
        </div>
      </Section>

      <Section
        id="items"
        number={2}
        title="Menu items"
        summary={items.filter((i) => i.name.trim()).length > 0 ? `${items.filter((i) => i.name.trim()).length} items` : undefined}
      >
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-3">
              <div className="flex gap-2">
                <Input
                  className="flex-[2]"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                />
                <Input
                  className="flex-1"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="$"
                  value={item.price ? (item.price / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    updateItem(index, { price: Math.round(Number(e.target.value) * 100) || 0 })
                  }
                />
                <Button variant="outline" onClick={() => addOptionGroup(index)}>
                  + Options
                </Button>
              </div>
              {item.modifierGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="mt-2 rounded-md bg-slate-50 p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Option group (e.g. Filling)"
                      value={group.name}
                      onChange={(e) => updateGroup(index, groupIndex, { name: e.target.value })}
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={group.isRequired}
                        onChange={(e) => updateGroup(index, groupIndex, { isRequired: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  <div className="mt-2 space-y-1">
                    {group.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex gap-2">
                        <Input
                          className="flex-[2]"
                          placeholder="Option (e.g. Queso)"
                          value={option.name}
                          onChange={(e) =>
                            updateGroup(index, groupIndex, {
                              options: group.options.map((o, i) =>
                                i === optIndex ? { ...o, name: e.target.value } : o,
                              ),
                            })
                          }
                        />
                        <Input
                          className="w-28"
                          type="number"
                          step="0.01"
                          placeholder="+$"
                          value={option.priceDelta ? (option.priceDelta / 100).toFixed(2) : ""}
                          onChange={(e) =>
                            updateGroup(index, groupIndex, {
                              options: group.options.map((o, i) =>
                                i === optIndex
                                  ? { ...o, priceDelta: Math.round(Number(e.target.value) * 100) || 0 }
                                  : o,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateGroup(index, groupIndex, {
                          options: [...group.options, { name: "", priceDelta: 0 }],
                        })
                      }
                    >
                      + option
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
              + Add item
            </Button>
            <Button onClick={() => setOpenSection("delivery")}>Next: Delivery</Button>
          </div>
        </div>
      </Section>

      <Section
        id="delivery"
        number={3}
        title="Delivery & pickup"
        summary={minItemsForDelivery ? `delivery at ${minItemsForDelivery}+ items` : undefined}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="fr-min-items">Minimum items for delivery (blank = no rule)</Label>
            <Input
              id="fr-min-items"
              type="number"
              min="1"
              value={minItemsForDelivery}
              onChange={(e) => setMinItemsForDelivery(e.target.value)}
              placeholder="e.g. 3"
            />
            <p className="mt-1 text-sm text-slate-500">
              Orders below this count are pickup-only. Delivery zones and fees come from church
              settings.
            </p>
          </div>
          <Button onClick={() => setOpenSection("publish")}>Next: Review & publish</Button>
        </div>
      </Section>

      <Section id="publish" number={4} title="Review & publish">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{name || "Untitled"}</strong> · {items.filter((i) => i.name.trim()).length} items
            {minItemsForDelivery && ` · delivery at ${minItemsForDelivery}+ items`}
            {closesAt && ` · closes ${new Date(closesAt).toLocaleString()}`}
          </p>
          {!createdCatalogId ? (
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => void handleSaveDraft()}>
                Save draft
              </Button>
              <Button disabled={saving} onClick={() => void handlePublish()}>
                {saving ? "Publishing…" : "Publish now"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-emerald-50 p-4">
              <p className="font-medium text-emerald-800">Fundraiser is live 🎉</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void handleGenerateVolunteerLink()}>
                  Generate volunteer link
                </Button>
                <Button variant="outline" onClick={() => router.push(`/fundraisers/${createdCatalogId}/take-orders`)}>
                  Take orders now
                </Button>
              </div>
              {volunteerUrl && (
                <div className="rounded-md bg-white p-3">
                  <p className="mb-1 text-sm font-medium">Text this link to your helpers:</p>
                  <code className="block break-all text-sm">{volunteerUrl}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
```

- [ ] **Step 3: Catalog page entry points**

In `components/catalog/catalog-list.tsx` (read it first; integrate, don't overwrite):
1. Add a **"New Fundraiser"** primary button linking to `/fundraisers/new` next to the existing create-catalog button.
2. On each catalog card, show a ministry badge when `catalog.ministry?.name` is present — this requires adding `ministry: { select: { name: true } }` to the query in `app/(dashboard)/catalog/page.tsx:15-28` and passing it through the `catalogs` mapping.
3. Add a **"Duplicate as fundraiser"** item to each card's action menu linking to `/fundraisers/new?cloneFrom=<catalogId>`.
4. Add a ministry filter dropdown above the list (client-side filter over the loaded catalogs is sufficient — they're already all loaded).

- [ ] **Step 4: Verify, type-check, commit**

Run: `npx tsc --noEmit && pnpm build`, then `pnpm dev` — create a fundraiser end-to-end: basics → items with an option group → min-items rule → publish → volunteer link appears.

```bash
git add components/fundraisers/fundraiser-wizard.tsx "app/(dashboard)/fundraisers/new/" components/catalog/ "app/(dashboard)/catalog/page.tsx"
git commit -m "feat: add fundraiser wizard with clone prefill and catalog page entry points"
```

---

### Task 15: Storefront min-items enforcement (client side)

**Files:**
- Modify: `app/api/storefront/[churchSlug]/delivery-zones/route.ts` (include `minItemsForDelivery`)
- Modify: `app/(storefront)/[churchSlug]/checkout/page.tsx`

Server-side enforcement already landed in Task 5; this makes the storefront UI honest about it.

- [ ] **Step 1: Expose the rule to the storefront**

In `app/api/storefront/[churchSlug]/delivery-zones/route.ts`, alongside the zones lookup, fetch the OPEN catalog's `minItemsForDelivery` and include it in the response payload:

```typescript
  const openCatalog = await db.catalog.findFirst({
    where: { church: { slug: churchSlug }, status: "OPEN" },
    select: { minItemsForDelivery: true },
    orderBy: { createdAt: "desc" },
  });
  // include in the JSON response:
  // { zones, minItemsForDelivery: openCatalog?.minItemsForDelivery ?? null }
```

Read the route first and match its existing response shape — if it currently returns a bare array, wrap it as `{ zones, minItemsForDelivery }` and update the checkout page's fetch accordingly.

- [ ] **Step 2: Gate the delivery option in checkout**

In `app/(storefront)/[churchSlug]/checkout/page.tsx`:
- Import `isDeliveryEligible` from `@/lib/fundraisers/delivery-eligibility`.
- Compute `const cartItemCount = items.reduce((s, i) => s + i.quantity, 0);`
- Where the fulfillment selector renders the DELIVERY choice, disable it when `!isDeliveryEligible(cartItemCount, minItemsForDelivery)` and render the nudge: `Add ${minItemsForDelivery - cartItemCount} more to unlock delivery`.
- If delivery is selected and the count drops below the rule, switch to PICKUP and show the same visible notice pattern used by the quick-entry component.

- [ ] **Step 3: Verify, type-check, commit**

Run: `npx tsc --noEmit && pnpm build`
Expected: PASS.

```bash
git add "app/api/storefront/[churchSlug]/delivery-zones/route.ts" "app/(storefront)/[churchSlug]/checkout/page.tsx"
git commit -m "feat: enforce min-items delivery rule in storefront checkout"
```

---

### Task 16: Reporting — ministry rollup + channel split

**Files:**
- Modify: `app/api/reports/route.ts`
- Modify: `app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Add per-ministry and per-channel aggregates to the reports API**

In `app/api/reports/route.ts`, add to the existing `Promise.all` block (around line 72):

```typescript
      // Orders/revenue by channel in range
      db.order.groupBy({
        by: ["channel"],
        where: { churchId, createdAt: { gte: rangeStart }, status: { notIn: ["DRAFT", "CANCELED"] } },
        _count: { _all: true },
        _sum: { total: true },
      }),

      // Orders/revenue by ministry in range (catalogId → ministry resolved below)
      db.order.groupBy({
        by: ["catalogId"],
        where: { churchId, createdAt: { gte: rangeStart }, status: { notIn: ["DRAFT", "CANCELED"] } },
        _count: { _all: true },
        _sum: { total: true },
      }),
```

Then resolve catalog → ministry after the `Promise.all`:

```typescript
  const catalogIds = ministryRows.map((r) => r.catalogId);
  const catalogsWithMinistry = await db.catalog.findMany({
    where: { id: { in: catalogIds } },
    select: { id: true, ministry: { select: { id: true, name: true } } },
  });
  const ministryByCatalog = new Map(catalogsWithMinistry.map((c) => [c.id, c.ministry]));

  const ministryRollup = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const row of ministryRows) {
    const ministry = ministryByCatalog.get(row.catalogId);
    if (!ministry) continue;
    const entry = ministryRollup.get(ministry.id) ?? { name: ministry.name, orders: 0, revenue: 0 };
    entry.orders += row._count._all;
    entry.revenue += row._sum.total ?? 0;
    ministryRollup.set(ministry.id, entry);
  }
```

Include `channelBreakdown` and `ministries: [...ministryRollup.values()]` in the JSON response. Match the route's existing response shape and variable naming — read it fully first.

- [ ] **Step 2: Render both sections on the reports page**

In `app/(dashboard)/reports/page.tsx`, add two cards following the page's existing card/section pattern:
- **"By ministry"** — table of ministry name, orders, revenue (formatted with the page's existing money formatter).
- **"By channel"** — Online / Volunteer / Phone / In person rows with counts and revenue. Label `VOLUNTEER` as "Volunteer (in person)".

- [ ] **Step 3: Verify, type-check, commit**

Run: `npx tsc --noEmit && pnpm build`
Expected: PASS.

```bash
git add app/api/reports/route.ts "app/(dashboard)/reports/page.tsx"
git commit -m "feat: add per-ministry and per-channel reporting"
```

---

### Task 17: E2E test — the whole loop

**Files:**
- Create: `tests/e2e/fundraiser.spec.ts`

- [ ] **Step 1: Write the E2E test**

Follow the conventions in `tests/e2e/storefront.spec.ts` and `tests/e2e/kitchen.spec.ts` for auth/session setup and base URL handling — copy their login helper and seed approach exactly. The journey:

```typescript
import { expect, test } from "@playwright/test";

// Follow the seed/login helpers used in tests/e2e/storefront.spec.ts.
// Journey: admin creates + publishes a fundraiser via the wizard, generates a
// volunteer link, an anonymous browser context takes an order through the link,
// and the order shows up in the kitchen view.

test.describe("fundraiser volunteer flow", () => {
  test("wizard → publish → volunteer link → order → kitchen", async ({ page, browser }) => {
    // 1. Sign in as an ADMIN (reuse the existing e2e auth helper)
    // 2. page.goto("/fundraisers/new")
    await page.goto("/fundraisers/new");
    await page.getByLabel("Fundraiser name").fill("E2E Pupusa Sale");
    await page.getByRole("button", { name: "Next: Menu items" }).click();
    await page.getByPlaceholder("Item name").fill("Pupusa de queso");
    await page.getByPlaceholder("$").first().fill("3.50");
    await page.getByRole("button", { name: "Next: Delivery" }).click();
    await page.getByLabel("Minimum items for delivery (blank = no rule)").fill("3");
    await page.getByRole("button", { name: "Next: Review & publish" }).click();
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Fundraiser is live")).toBeVisible();

    // 3. Generate volunteer link
    await page.getByRole("button", { name: "Generate volunteer link" }).click();
    const linkUrl = await page.locator("code").textContent();
    expect(linkUrl).toContain("/v/");

    // 4. Anonymous context takes an order through the link
    const volunteerContext = await browser.newContext();
    const volunteerPage = await volunteerContext.newPage();
    await volunteerPage.goto(linkUrl as string);
    await volunteerPage.getByPlaceholder("e.g. Maria").fill("Maria");
    await volunteerPage.getByRole("button", { name: "Start taking orders" }).click();
    await volunteerPage.getByRole("button", { name: /Pupusa de queso/ }).click();
    await volunteerPage.getByRole("button", { name: /Customer info/ }).click();
    await volunteerPage.getByPlaceholder("Name *").fill("Hermana Rosa");
    await volunteerPage.getByPlaceholder("Phone *").fill("5552018842");
    await volunteerPage.getByRole("button", { name: /Submit/ }).click();
    await expect(volunteerPage.getByText(/Order #\d+ — Hermana Rosa/)).toBeVisible();

    // 5. Delivery is locked below 3 items
    await volunteerPage.getByRole("button", { name: /Pupusa de queso/ }).click();
    await volunteerPage.getByRole("button", { name: /Customer info/ }).click();
    await expect(volunteerPage.getByRole("button", { name: /Delivery \(3\+ items\)/ })).toBeDisabled();

    // 6. Kitchen sees the order (reuse the kitchen navigation from kitchen.spec.ts)
    // page (still admin) → kitchen view → expect "Hermana Rosa" order card visible

    await volunteerContext.close();
  });
});
```

Fill in the auth helper and kitchen assertion from the existing spec files while implementing — those two pieces must match the repo's real seeding, which the existing specs demonstrate.

- [ ] **Step 2: Run it**

Run: `pnpm exec playwright test tests/e2e/fundraiser.spec.ts`
Expected: PASS against a running dev stack (same environment the existing e2e specs use).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/fundraiser.spec.ts
git commit -m "test: add e2e coverage for fundraiser wizard and volunteer order flow"
```

---

### Task 18: Final verification + deploy loop

- [ ] **Step 1: Full suite**

```bash
npx tsc --noEmit && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 2: Push and rebuild the container** (user's standing workflow)

```bash
git push
cd docker && docker compose build
```

---

## Self-Review Notes (already applied)

- **Spec coverage:** wizard+clone (T7, T14), quick-entry dual access (T10, T11, T12, T13), min-items (T3, T5, T14, T15), ministry+reporting (T1, T6, T16), RBAC (T2, T8, T9), send queue+idempotency (T1, T5, T12), E2E (T17). Volunteer-link revocation UI on the fundraiser page is deferred to the wizard's share panel (generate) + API (revoke); a dedicated links-management list is intentionally out — revoke is API-reachable and admins can regenerate. If the user wants a UI for revocation, add it to the catalog detail page as a follow-up.
- **Known verify-while-implementing points** (flagged inline): `PaymentStatus` paid value (T5), Prisma relation names in nested selects (T7, T10, T13), kitchen model name (T14), delivery-zones response shape (T15), e2e auth helpers (T17). Each says exactly where to look.
- **Type consistency:** `CartItemPayload`/`DeliveryAddressPayload` defined once in T5 and imported everywhere; `clientRequestId` injected by the send queue (T12) and consumed by both order endpoints (T10, T11); `QuickEntryCatalog` shape produced identically by both doors (T13).
