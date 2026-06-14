# Multi-Kitchen — Design Spec

**Date:** 2026-06-13
**Status:** Approved (pending spec review)
**Author:** Emerson Ramos (with Claude)

## Problem

Steward Table currently has a single, church-wide kitchen display fed by one SSE
stream (`/api/sse/kitchen`). Kitchen staff need:

1. **Multiple kitchen screens** — one operation may run from more than one physical
   location, and each location wants its own monitor.
2. **Separate kitchens per group/event** — different ministries running concurrent
   events (e.g. a media-team pupusa sale) need an isolated queue that shows only
   their orders.
3. **A kitchen-builder dashboard** — staff create and manage kitchens (Main, Side,
   External, Media, …) and assign work to them.
4. **Ministry attribution** — orders for an event should roll up under the
   responsible ministry for reporting (e.g. "media ministry sales").

## Decisions (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Routing model | **By catalog/event** | Orders already carry `catalogId`. A ministry event is naturally its own catalog. One order = one kitchen. |
| Screen selection | **Stable URL per kitchen** (`/kitchen/<slug>`) | Bookmark per monitor; survives reboots; no per-screen login. Two monitors on the same slug mirror the same queue. |
| Ministry tracking | **Kitchen is the reporting unit** | A kitchen owns its catalogs, so "Media Kitchen totals" = "media ministry sales." No separate Ministry entity. |
| Access control | **Single `order.kitchen` permission** | Any kitchen staff may open any kitchen URL; separation is physical. No new RBAC. |
| Catalog→kitchen cardinality | **One catalog → one kitchen; kitchen → many catalogs** | Simple FK. Mirroring handled by same URL, not many-to-many. |
| Unassigned catalogs | **Resolve to the church default kitchen** | An order can never fall off every screen. |

## Data Model

New `Kitchen` model plus a single nullable FK on `Catalog`.

```prisma
model Kitchen {
  id        String  @id @default(cuid())
  churchId  String
  name      String          // "Main Kitchen", "Media Kitchen"
  slug      String          // "main", "media"  ->  /kitchen/<slug>
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

// Catalog gains:
//   kitchenId String?
//   kitchen   Kitchen? @relation(fields: [kitchenId], references: [id])
// Church gains:
//   kitchens  Kitchen[]
```

- `kitchenId` is nullable; a null catalog resolves to the church default kitchen at
  query time.
- Follows the existing soft-delete (`deletedAt`) and tenancy-extension patterns in
  `lib/db.ts`. No manual `deletedAt: null` filters; no removal of the
  `as unknown as PrismaClient` cast.

### Invariants

- **Exactly one** `isDefault` kitchen per church. Setting a new default clears the
  previous one (single transaction).
- The default kitchen can be **renamed and reordered but not deleted/archived**.
- Archiving a non-default kitchen **reassigns its catalogs to the default kitchen**
  before soft-deleting it (no orphaned catalogs).
- `slug` is unique per church; auto-generated from name (kebab-case) with collision
  suffixing.

## Routing & Screen Selection

Resolution chain: `Order → catalogId → Catalog.kitchenId → Kitchen`
(null `kitchenId` → church default kitchen).

| Route | Purpose |
|---|---|
| `/kitchen` | Picker page listing all kitchens (cards/links to each screen). |
| `/kitchen/[slug]` | The existing `KitchenDisplay`, scoped to one kitchen. |

Two monitors opening the same `/kitchen/<slug>` mirror the same queue — covers the
"same operation, two rooms" case without many-to-many modeling.

## SSE Scoping

`app/api/sse/kitchen/route.ts` becomes **`app/api/sse/kitchen/[slug]/route.ts`**.

- On connect, resolve the kitchen by `slug` (404 if not found / not in church).
- Compute the kitchen's catalog ID set. If the kitchen is the default, also include
  orders whose catalog has `kitchenId = null`.
- Add a `catalogId: { in: [...] }` filter (plus the null case for default) to both
  `fetchKitchenOrders` and `fetchRecentlyCanceled`.
- The auto-transition `CONFIRMED → IN_KITCHEN` fires **only for orders in this
  kitchen's scope** — viewing the media screen must not pull the main kitchen's
  orders into prep.
- `EventSource` URL in `components/kitchen/kitchen-display.tsx` changes to include
  the slug. The component takes the slug as a prop from the page.
- `/api/orders/[orderId]/ready` and `/api/orders/bulk-status` are order-ID-based and
  "mark all ready" acts on currently-shown orders, so they remain naturally scoped —
  no change required.

## Kitchen-Builder Dashboard

| Route | Purpose |
|---|---|
| `/(dashboard)/kitchens` | List kitchens (name, slug, catalog count, default badge); create, rename, archive, set default, reorder. |
| `/(dashboard)/kitchens/[id]` | Edit one kitchen; assign its catalogs via a checklist that writes `Catalog.kitchenId`. |

- Catalog→kitchen assignment lives **only** on the kitchen edit page to avoid two
  competing UIs for one FK.
- Server actions in a dedicated `actions.ts` file (never `"use server"` inside a
  client component).
- **RBAC:** kitchen CRUD gated by the existing `catalog.edit` permission; viewing a
  kitchen screen stays `order.kitchen`. No new RBAC actions.

## Reporting

Extend the existing reports page (`app/(dashboard)/reports/page.tsx`) with a
**"by kitchen"** grouping: revenue and order count per kitchen, resolving
null-catalog orders to the default kitchen, plus an optional kitchen filter. This
realizes "media ministry sales = Media Kitchen totals." Scope is a grouping + filter,
not a new reporting subsystem.

## Migration

1. Prisma migration: add `kitchens` table and `Catalog.kitchenId` (nullable FK).
2. Data backfill (in the same migration or a follow-up script): for each church,
   create a **"Main Kitchen"** (`slug: "main"`, `isDefault: true`) and set every
   existing catalog's `kitchenId` to it.

After migration, `/kitchen/main` shows exactly what `/kitchen` shows today —
single-screen behavior is preserved.

## Testing

- **Unit:** routing resolution (catalog→kitchen, null→default); slug
  generation/uniqueness; default-kitchen invariant logic (set-default clears prior,
  archive-reassigns-to-default, cannot-delete-default).
- **Integration:** SSE returns only the kitchen's orders; scoped auto-transition;
  kitchen CRUD; archive reassigns catalogs to default.
- **E2E (Playwright):** create a kitchen, assign a catalog, place an order in that
  catalog → it appears on `/kitchen/<slug>` and is absent from another kitchen's
  screen.

Coverage target: 80%+ per project testing rules.

## Out of Scope (YAGNI for v1)

- Per-kitchen RBAC membership (media team *cannot* open the main kitchen).
- Splitting one order across kitchens by item/station (the existing `Item.station`
  field stays unused by this work).
- A first-class Ministry entity spanning multiple kitchens.
- Load-balancing one event's orders across two kitchens.

The model leaves room for each of these without rework.
