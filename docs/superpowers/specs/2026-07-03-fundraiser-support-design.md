# Fundraiser Support — Design Spec

**Date:** 2026-07-03
**Status:** Approved (brainstorm session with Emerson)

## Problem

Churches run food fundraisers announced ~2 weeks before a Friday/Saturday event. Today, order intake is one ministry member standing at the back of church after service with pen and paper (or iPhone notes). This is a single point of intake, orders must be re-typed later, and handwriting/reconciliation errors follow. QR-code self-service was tried and failed — members don't engage with passive QR codes; ordering at church is a social interaction.

**Goal:** keep the human interaction, digitize what's in the volunteer's hand. Multiple volunteers take orders in parallel on their phones; orders land directly in the existing order → kitchen → delivery pipeline.

## Scope (four features)

1. **New Fundraiser wizard + clone-from-past** — fast catalog authoring for occasional users.
2. **Volunteer quick-entry** — POS-style order-taking screen, dual access (account or shareable link).
3. **Min-items-for-delivery rule** — per-fundraiser item-count threshold for delivery eligibility.
4. **Ministry entity** — name-only tag on fundraisers for tracking/reporting.

Out of scope (explicitly rejected for now): SMS confirmations, full offline mode, ministry membership management, approval workflows, self-service kiosk hardware flows, collecting payment at intake (orders are created unpaid; payment reconciled at pickup/delivery as today).

## Architecture decision

**A fundraiser IS a `Catalog`** — no wrapper entity. All four features extend existing models and rails; the order pipeline (kitchen displays, driver routing, receipts, reporting) is untouched.

## Data model

### New: `Ministry`

```prisma
model Ministry {
  id        String    @id @default(cuid())
  churchId  String
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  church   Church    @relation(fields: [churchId], references: [id], onDelete: Cascade)
  catalogs Catalog[]

  @@unique([churchId, name])
  @@index([churchId])
}
```

Church-scoped, soft-deleted, unique name per church. Created on the fly from the wizard combobox.

### `Catalog` additions (all optional; no data migration for existing rows)

```prisma
ministryId          String?  // tag for tracking/reporting
minItemsForDelivery Int?     // null = no item-count rule
createdById         String?  // User who created it (own-edit RBAC)
```

### `Order` additions

```prisma
takenById   String?  // User account that entered the order (account door)
takenByName String?  // free-text volunteer name (link door)
```

Plus new `Channel` enum value `VOLUNTEER`.

### New: `VolunteerLink`

```prisma
model VolunteerLink {
  id          String    @id @default(cuid())
  churchId    String
  catalogId   String
  tokenHash   String    @unique  // hash at rest; raw token only in the URL
  createdById String
  expiresAt   DateTime            // defaults to catalog closesAt
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
}
```

## Permissions (RBAC, `lib/rbac/can.ts`)

New actions, following existing conditional patterns:

| Action | ADMIN/OWNER | STAFF |
|---|---|---|
| `fundraiser.create` | allow | allow |
| `fundraiser.edit` | any fundraiser | only where `ctx.catalogCreatedById === ctx.userId` |
| `fundraiser.publish` | any fundraiser | own only (same condition) |

- Add `catalogCreatedById` to `CanContext`.
- Existing `catalog.edit` / `catalog.publish` stay ADMIN-only, untouched.
- Quick-entry account door uses the **existing** `order.create` (STAFF+).
- Volunteer-link door: token validation (hash lookup, not expired, not revoked, catalog OPEN) authorizes exactly one capability — creating orders for that one fundraiser. No read access to other orders, customers, or settings. Endpoint rate-limited like the public storefront order endpoint.

## Feature design

### 1. Fundraiser wizard + clone

- Entry: primary "New Fundraiser" button on the existing Catalog dashboard page. Fundraisers appear in the same catalog list with a ministry badge.
- Layout: **single page with collapsible sections** (chosen over multi-step wizard):
  1. **Basics** — name, ministry combobox (pick or type-to-create), event/pickup date, order window (default: opens now, closes day before event), kitchen (only shown for multi-kitchen churches).
  2. **Menu items** — rapid rows (name + price, optional photo); "+ Options" opens modifier setup reusing existing `ModifierGroup` machinery.
  3. **Delivery & pickup** — fulfillment method toggles, min-items-for-delivery, time slots.
  4. **Review & publish** — summary; publish now or save draft. Publish shows share screen: storefront link + QR, and "Generate volunteer link".
- **Clone:** "Duplicate" action on any past fundraiser → wizard pre-filled with items, options, prices, delivery rules, ministry. Dates and volunteer links reset; orders never copied.

### 2. Volunteer quick-entry

- One shared form component, two routes:
  - `/(dashboard)/fundraisers/[id]/take-orders` — signed-in, `order.create` check.
  - `/v/[token]` — public volunteer-link door; helper types their name once per session.
- Layout: **POS-style tap grid** (chosen over list-with-steppers). Per order: tap item tiles to build the order (items with modifiers pop a quick option picker) → "Customer info" sheet slides up → submit → grid clears for the next person, with a "last order: #47 Rosa ✓" confirmation strip.
- Customer info: name (required), phone (required), email (optional). Pickup default; delivery only offered when the cart meets `minItemsForDelivery` AND delivery is enabled — then address + time slot fields appear.
- Confirmation: if email provided, send the existing order confirmation with magic tracking link. No email → no notification (paper parity).
- Payment: none collected. Orders land unpaid (existing cash/pay-on-pickup semantics). Optional "mark paid — cash" toggle, default off.
- **Send queue (resilient-online):** submits enqueue to browser storage first; failed requests retry in the background while the volunteer keeps working. Badge shows pending sends; loud warning if unsent orders exist on page close. Each submit carries a client-generated idempotency key so retries cannot double-create orders.

### 3. Min-items-for-delivery

- `Catalog.minItemsForDelivery: Int?` set in the wizard; null = no rule.
- Enforced in quick-entry AND the public storefront checkout (delivery option hidden/disabled until the cart qualifies, with an "add N more to unlock delivery" nudge).
- Server-side validation on order create (both endpoints) — never client-only.
- Composes with existing per-zone rules (`minOrderCents`, postal codes).

### 4. Ministry tracking & reporting

- Catalog list: ministry badge + ministry filter.
- Fundraiser detail: orders/revenue split by channel (storefront vs volunteer) and per-volunteer counts from attribution fields.
- Reports: per-ministry roll-up (fundraisers run, orders, revenue, date-range filter) via `Catalog.ministryId`.
- Exports include ministry, channel, taken-by columns (existing `report.export` gate).

## Edge cases & error handling

- **Fundraiser closes mid-shift:** new submits rejected with "This fundraiser has closed"; already-accepted orders stand; volunteer links expire at `closesAt` automatically.
- **Token abuse:** hashed at rest, single-fundraiser scope, revocable from the fundraiser page, rate-limited endpoint.
- **Delivery rule edge:** dropping below min items with delivery selected flips the form back to pickup with a visible notice — never silent.
- **Duplicate submits:** idempotency key per queued order (new backend behavior on the volunteer/order create path).

## Testing

- **Unit:** RBAC additions (own-edit conditions, `fundraiser.*` matrix), token validation (expiry/revocation/hash), min-items eligibility logic.
- **API:** volunteer order endpoint — valid/expired/revoked token, idempotency replay, closed-catalog rejection, min-items server validation.
- **E2E (Playwright):** wizard → publish → generate volunteer link → take an order via link → order visible in kitchen view.
- **Visual:** quick-entry grid at phone widths (320/375/768).

## Decisions log (from brainstorm)

| Question | Decision |
|---|---|
| Volunteer accounts | Mix: accounts for core team, shareable tokenized link for ad-hoc helpers |
| Min-items rule scope | Per fundraiser (field on Catalog) |
| Member confirmation | Email if provided (existing infra); phone required, email optional; no SMS |
| Wizard access | New `fundraiser.create` permission (STAFF+), not ADMIN-only, not loosened `catalog.edit` |
| Own-edit scope | Creator manages own fundraisers only; ADMIN manages all |
| Connectivity | Online-required with resilient browser send queue; no full offline mode |
| Ministry entity | Name only |
| Overall approach | Extend Catalog (A); rejected storefront-only (B) and full fundraiser module (C) |
| Wizard layout | Single page, collapsible sections |
| Quick-entry layout | POS-style tap grid |
