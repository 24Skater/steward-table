# Steward Table — RBAC Matrix v1

Permission system spec for Steward Table. Lives in `lib/rbac/` (becomes `@steward/rbac` when promoted to the shared repo).

## 1. Roles

Six roles, scoped per-Church via `Membership.roles Role[]`. A user can hold multiple roles at the same church.

**Admin chain** (inheritance — higher inherits lower):

| Role | Purpose |
|---|---|
| **OWNER** | Final authority. Manages billing, deletes the church, can demote/remove ADMINs. |
| **ADMIN** | Day-to-day administrator. Manages staff, catalogs, settings, tax, payments, branding, full refunds, exports, audit log. |
| **STAFF** | Front-of-house. Takes orders by phone or in-person, manages customer service, handles partial refunds up to a cap. |

**Sibling specialized** (no inheritance — independent purpose-built scopes):

| Role | Purpose |
|---|---|
| **COOK** | Kitchen-display operator. Reads active orders only, marks items prepared and orders ready, adjusts inventory. |
| **DRIVER** | Delivery operator. Sees only their assigned deliveries with the customer info needed to deliver; marks out-for-delivery and delivered. |
| **VIEWER** | Read-only oversight (pastor, board member). Aggregated reports and counts; no customer PII, no individual order access. |

Multi-role stacking: an OWNER who also cooks adds `COOK` to their `roles` array. The system doesn't pretend the admin chain inherits the specialized scopes — adding them is explicit.

## 2. Actions catalog

Coarse action names, ~25 total. Resource context drives nuance via `can(membership, action, resource?)`.

```
church.update         church.delete         church.billing
member.invite         member.update         member.remove
catalog.read          catalog.edit          catalog.publish
inventory.read        inventory.adjust
customer.read         customer.edit         customer.export
order.read            order.create          order.update
order.kitchen         order.deliver         order.cancel         order.refund
payment.read          settings.payment      settings.tax
settings.receipt      settings.email        settings.branding
report.read           report.export         audit.read
```

## 3. Matrix

Rows = roles. Columns = actions. Cells:

- `✓` — granted unconditionally
- `▲` — granted with resource-context conditions (see §4)
- empty — denied

Admin-chain columns are cumulative (ADMIN includes STAFF, OWNER includes ADMIN).

| Action | STAFF | ADMIN | OWNER | COOK | DRIVER | VIEWER |
|---|---|---|---|---|---|---|
| `church.update`      |   | ✓ | ✓ |   |   |   |
| `church.delete`      |   |   | ✓ |   |   |   |
| `church.billing`     |   |   | ✓ |   |   |   |
| `member.invite`      |   | ✓ | ✓ |   |   |   |
| `member.update`      |   | ▲ | ✓ |   |   |   |
| `member.remove`      |   | ▲ | ✓ |   |   |   |
| `catalog.read`       | ✓ | ✓ | ✓ | ▲ |   | ✓ |
| `catalog.edit`       |   | ✓ | ✓ |   |   |   |
| `catalog.publish`    |   | ✓ | ✓ |   |   |   |
| `inventory.read`     | ✓ | ✓ | ✓ | ✓ |   |   |
| `inventory.adjust`   | ▲ | ✓ | ✓ | ✓ |   |   |
| `customer.read`      | ✓ | ✓ | ✓ |   | ▲ |   |
| `customer.edit`      | ✓ | ✓ | ✓ |   |   |   |
| `customer.export`    |   | ✓ | ✓ |   |   |   |
| `order.read`         | ✓ | ✓ | ✓ | ▲ | ▲ | ▲ |
| `order.create`       | ✓ | ✓ | ✓ |   |   |   |
| `order.update`       | ✓ | ✓ | ✓ |   |   |   |
| `order.kitchen`      | ✓ | ✓ | ✓ | ✓ |   |   |
| `order.deliver`      |   | ✓ | ✓ |   | ▲ |   |
| `order.cancel`       | ▲ | ✓ | ✓ |   |   |   |
| `order.refund`       | ▲ | ✓ | ✓ |   |   |   |
| `payment.read`       | ✓ | ✓ | ✓ |   |   |   |
| `settings.payment`   |   | ✓ | ✓ |   |   |   |
| `settings.tax`       |   | ✓ | ✓ |   |   |   |
| `settings.receipt`   |   | ✓ | ✓ |   |   |   |
| `settings.email`     |   | ✓ | ✓ |   |   |   |
| `settings.branding`  |   | ✓ | ✓ |   |   |   |
| `report.read`        | ▲ | ✓ | ✓ |   |   | ▲ |
| `report.export`      |   | ✓ | ✓ |   |   |   |
| `audit.read`         |   | ✓ | ✓ |   |   |   |

## 4. Context-aware conditions

Where the matrix shows `▲`, `can()` evaluates these rules using the resource argument.

### `member.update` and `member.remove` (ADMIN)
- ADMIN cannot update or remove an OWNER membership.
- OWNER cannot remove themselves; ownership must be transferred first (a separate `church.transferOwnership` flow, OWNER-only).

### `catalog.read` (COOK)
- COOK sees only catalogs with `status = OPEN`. Draft, closed, and archived catalogs are filtered out.

### `inventory.adjust` (STAFF)
- STAFF can adjust inventory only for items linked to currently-OPEN catalogs (front-of-house stocktake during a sale). Out-of-sale items require ADMIN.
- COOK can adjust any inventory item (recording what's left after the kitchen runs).

### `customer.read` (DRIVER)
- DRIVER can read Customer records only when the customer has an Order with `DeliveryInfo.driverId = self.userId`. Other customers are not visible.
- The view returns only the fields needed to deliver: name, phone, address. No order history, no notes, no tags.

### `order.read` (COOK / DRIVER / VIEWER)
- **COOK**: only orders with `status IN (CONFIRMED, IN_KITCHEN, READY)` for an OPEN catalog. Completed and historical orders are not visible.
- **DRIVER**: only orders where `DeliveryInfo.driverId = self.userId`. The view shows the items, delivery address, recipient phone, and special instructions.
- **VIEWER**: returns aggregated counts and totals only — no individual order rows, no customer PII. Powered by a reporting view, not direct `Order` reads.

### `order.deliver` (DRIVER)
- DRIVER can transition status (`READY → OUT_FOR_DELIVERY → DELIVERED`) only on orders where `DeliveryInfo.driverId = self.userId`.

### `order.cancel` (STAFF)
- STAFF can cancel an order only if:
  - `status IN (DRAFT, SUBMITTED, CONFIRMED)` (kitchen hasn't started), OR
  - the order was created by this user within the last hour (mistake correction).
- All other cancellations require ADMIN.

### `order.refund` (STAFF)
- STAFF can issue partial refunds up to **$50** (configurable per church via `ChurchSettings.staffRefundCapCents`, default 5000).
- STAFF cannot issue full refunds. Anything beyond the partial cap requires ADMIN.

### `report.read` (STAFF / VIEWER)
- **STAFF**: operational reports only (today's queue, today's revenue, items sold today). Historical financial reports require ADMIN.
- **VIEWER**: aggregated reports of any time range, with no customer-level rows. Suitable for board summaries and pastor dashboards.

## 5. `can()` function

Signature lives in `lib/rbac/can.ts`:

```ts
type Action =
  | "church.update" | "church.delete" | "church.billing"
  | "member.invite" | "member.update" | "member.remove"
  | "catalog.read" | "catalog.edit" | "catalog.publish"
  | "inventory.read" | "inventory.adjust"
  | "customer.read" | "customer.edit" | "customer.export"
  | "order.read" | "order.create" | "order.update"
  | "order.kitchen" | "order.deliver" | "order.cancel" | "order.refund"
  | "payment.read"
  | "settings.payment" | "settings.tax" | "settings.receipt"
  | "settings.email" | "settings.branding"
  | "report.read" | "report.export"
  | "audit.read";

interface CanContext {
  membership: Membership;       // includes roles: Role[], churchId, userId
  action: Action;
  resource?: unknown;            // shape varies per action; typed below
  reason?: string;               // optional, recorded if denied
}

function can(ctx: CanContext): { allowed: boolean; reason?: string };
```

**Resolution algorithm:**

1. If `membership.status !== ACTIVE`: deny.
2. Resolve effective role set: expand admin-chain inheritance.
   - If `OWNER ∈ roles`: add `ADMIN`, `STAFF` to effective set.
   - If `ADMIN ∈ roles`: add `STAFF`.
   - Specialized roles (COOK, DRIVER, VIEWER) added as-is.
3. For each role in the effective set, check the matrix:
   - Cell is `✓`: return `{ allowed: true }` immediately.
   - Cell is `▲`: evaluate the role's context-aware rule against `resource`. If allowed, return `{ allowed: true }`. Otherwise continue checking other roles.
   - Cell is empty: continue.
4. If no role granted access: return `{ allowed: false, reason: "no matching role" }`.

**Every deny is logged** to `AuditLog` with action, resource, attempted-by, reason, IP, and user-agent. Failed-permission patterns are a signal — useful for detecting confused UI, misconfigured roles, or active probing.

## 6. Server enforcement

The `can()` function is the *only* gate. No bypasses:

- Every API route handler and server action calls `can()` at entry; denial throws `ForbiddenError` with the deny reason.
- Every multi-row query that includes tenanted data also calls `can()` for the scoping action (`order.read`, etc.) and the result drives the Prisma `where` filter — so a DRIVER's order list query at the DB level filters to `DeliveryInfo.driverId = self.userId`, never relying on app-layer trimming.
- The Next.js middleware that resolves the church from the subdomain also resolves the user's Membership for that church; if the user has no active Membership for the resolved church, the request short-circuits to 404 (not 403, to avoid disclosing church existence).
- Webhook handlers (Stripe) bypass `can()` because they're not user-initiated; they identify the church from the event's `account` field (Connect) or webhook endpoint URL (BYO).

## 7. Tests

Every cell in §3 generates at least one test. Every condition in §4 generates a positive and negative test. Coverage target for `lib/rbac/`: 100% line, 100% branch. RBAC is one of the few places where 100% is the right target — every uncovered branch is a potential authorization bug.

Test structure:

```ts
describe("can() — STAFF role", () => {
  const staffMembership = makeMembership({ roles: ["STAFF"] });

  it("allows order.read", () => {
    expect(can({ membership: staffMembership, action: "order.read" }).allowed).toBe(true);
  });

  it("allows order.refund within cap", () => {
    const order = makeOrder({ total: 4000 });
    expect(can({
      membership: staffMembership,
      action: "order.refund",
      resource: { order, refundAmount: 4000 }
    }).allowed).toBe(true);
  });

  it("denies order.refund above cap", () => {
    const order = makeOrder({ total: 10000 });
    expect(can({
      membership: staffMembership,
      action: "order.refund",
      resource: { order, refundAmount: 7500 }
    }).allowed).toBe(false);
  });

  it("denies settings.payment", () => {
    expect(can({ membership: staffMembership, action: "settings.payment" }).allowed).toBe(false);
  });
});
```

## 8. Future considerations (out of scope for v1)

- **Custom roles** — churches defining their own role bundles. Real desire from larger churches eventually; not needed for v1.
- **Time-of-day scoping** — "STAFF can refund only during business hours." Easy to add to `can()` later.
- **Per-catalog scoping** — "STAFF assigned to this catalog only." Useful for very large churches running multiple simultaneous sales; v2.
- **Field-level permissions** — "STAFF can read Customer but not Customer.notes." Add when a real use case surfaces.
- **API tokens with scoped permissions** — for integrations, machine-to-machine. v2.
