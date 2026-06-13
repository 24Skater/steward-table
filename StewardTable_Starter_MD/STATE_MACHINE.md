# Steward Table — Order Lifecycle State Machine

Operational spine. Lives in `lib/orders/transitions.ts`. Every order status change in the system flows through `transition()` — no direct writes to `Order.status` anywhere else.

## 1. Principles

- **Idempotent.** Re-applying the same transition (double-press, retry after network failure) is a safe no-op.
- **Strictly validated.** Transitions only follow declared edges. Invalid transitions throw `InvalidTransitionError`; the offending request is rejected, not silently corrected.
- **Atomic.** `Order.status` update, `OrderEvent` insert, and side-effect kicks happen in one Postgres transaction. Either everything commits or nothing does.
- **Audited.** Every transition writes an `OrderEvent` row (from-status, to-status, actor, reason, metadata, timestamp).
- **RBAC-gated.** Every transition resolves to an RBAC action and calls `can()` before executing.
- **Side-effect contract.** A transition's side effects (notifications, inventory moves, status webhooks) are declared as a list, queued for execution post-commit, and retried with idempotency keys if they fail.

## 2. States

| State | Meaning | Visible to |
|---|---|---|
| **DRAFT**            | Order being assembled but not yet submitted. Cart in progress, or staff entering a phone order. | Owner of the draft only |
| **SUBMITTED**        | Order placed; awaiting payment confirmation or church acknowledgment. | Customer, all staff |
| **CONFIRMED**        | Order accepted by the church; payment captured (or pay-on-pickup acknowledged); will appear on kitchen display. | Customer, all staff, kitchen |
| **IN_KITCHEN**       | Kitchen display has seen this order (first-view timestamp captured automatically — no cook tap required). | Customer, all staff, kitchen |
| **READY**            | All items prepared; awaiting handoff per the fulfillment type. | Customer, all staff |
| **AWAITING_PICKUP**  | (PICKUP only) Order is ready and the customer has been notified to come pick it up. | Customer, all staff |
| **PICKED_UP**        | (PICKUP only) Customer collected the order. | Customer, all staff |
| **OUT_FOR_DELIVERY** | (DELIVERY only) Driver has the order and is en route. | Customer, all staff, assigned driver |
| **DELIVERED**        | (DELIVERY only) Driver completed the handoff. | Customer, all staff |
| **SERVED**           | (DINE_IN only) Order delivered to the customer's table. | Staff |
| **COMPLETED**        | Terminal — successful close. Reporting picks this up. | Customer, all staff |
| **CANCELED**         | Terminal — exception close, with reason. Inventory restocked, payment refunded if captured. | Customer, all staff |
| **REFUNDED**         | Terminal — order was completed but later fully reversed. Partial refunds do NOT enter this state; they leave the order in COMPLETED with a `Refund` record. | Customer, all staff |

## 3. Transition diagram

```
                       DRAFT
                         │
                  submit │ (customer or staff)
                         ▼
                     SUBMITTED ──────────────┐
                         │                   │
            payment OK   │ (auto via webhook)│ payment failed / customer changed mind
              or staff   │  or staff ack     │ → CANCELED
              confirm    ▼                   │
                     CONFIRMED ──────────────┤
                         │                   │
                 kitchen │ first-view        │ admin/staff cancel → CANCELED
                  (auto) ▼                   │ admin full-refund → REFUNDED
                     IN_KITCHEN ─────────────┤
                         │                   │
                  cook   │ "Ready" tap       │
                         ▼                   │
                       READY ────────────────┤
                         │                   │
              ┌──────────┼──────────┐        │
              │          │          │        │
        PICKUP│   DELIVERY│   DINE_IN│        │
              ▼          ▼          ▼        │
       AWAITING_  OUT_FOR_       SERVED      │
        PICKUP   DELIVERY          │         │
          │         │              │         │
   pickup │   driver│              │         │
          ▼         ▼              │         │
      PICKED_UP DELIVERED          │         │
          │         │              │         │
          └─────────┴──────┬───────┘         │
                           ▼                 │
                       COMPLETED ─────────┐  │
                                          │  │
                              full refund │  │
                                          ▼  ▼
                                       REFUNDED / CANCELED
```

## 4. Transition table

Each row: `(from → to)`, the trigger, the actor + RBAC action, and the side effects that fire post-commit.

| From | To | Trigger | Actor / `can()` action | Side effects |
|---|---|---|---|---|
| `DRAFT` | `SUBMITTED` | Customer hits "Place Order" or staff hits "Submit" | Customer (no auth) or STAFF/ADMIN/OWNER `order.create` | Send confirmation email/SMS; reserve inventory (decrement counter); notify staff if `notify-on-new-order` is on |
| `DRAFT` | `CANCELED` | Cart abandoned (TTL sweep) or staff aborts entry | Cron OR STAFF+ `order.cancel` | Release any reserved inventory |
| `SUBMITTED` | `CONFIRMED` | Stripe webhook (payment captured) OR staff ack for cash/Zelle | System (webhook) OR STAFF+ `order.update` | Hard-decrement inventory (writes `StockMovement` kind=ORDER_DECREMENT); push to kitchen display (SSE); send "we got it" notification if not already sent |
| `SUBMITTED` | `CANCELED` | Payment failed / customer self-cancel within window / staff cancel | System (webhook) OR Customer (within `customerSelfCancelWindowMinutes`) OR STAFF+ `order.cancel` | Restock any reserved inventory; refund any captured payment; notify customer |
| `CONFIRMED` | `IN_KITCHEN` | **Auto** — first time the order is rendered on a kitchen display | System (no explicit actor; recorded as actor=null) | Set `firstSeenByKitchenAt`; no other side effect |
| `CONFIRMED` | `CANCELED` | Admin/staff cancel | STAFF+ `order.cancel` | Restock inventory (writes `StockMovement` kind=REFUND_INCREMENT); refund payment; notify customer |
| `IN_KITCHEN` | `READY` | Cook taps "Ready" on the kitchen display | COOK/STAFF+ `order.kitchen` | Send "your order is ready" notification per fulfillment type; push to customer status page; auto-advance to next state based on fulfillment |
| `IN_KITCHEN` | `CANCELED` | Admin cancels mid-prep (rare, requires explicit reason) | ADMIN+ `order.cancel` | Restock inventory; refund payment; flag for cook attention (kitchen display shows a banner) |
| `READY` | `AWAITING_PICKUP` | Auto-advance (when `fulfillment = PICKUP`) | System | Send "ready for pickup" SMS/email; start no-show timer |
| `READY` | `OUT_FOR_DELIVERY` | Driver taps "Picked Up" (when assigned) | DRIVER `order.deliver` | Send "on the way" SMS; stop no-show timer |
| `READY` | `SERVED` | Staff taps "Served" (when `fulfillment = DINE_IN`) | STAFF+ `order.update` | None beyond audit |
| `AWAITING_PICKUP` | `PICKED_UP` | Staff scans or marks pickup | STAFF+ `order.update` | Stop no-show timer; send thank-you notification |
| `AWAITING_PICKUP` | `CANCELED` | No-show sweep OR explicit cancel | Cron (`/api/cron/no-show-sweep`) OR STAFF+ `order.cancel` | Restock; refund (if applicable); send courtesy "we missed you" notification |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Driver taps "Delivered" | DRIVER `order.deliver` (own assignment) | Send "delivered" notification |
| `OUT_FOR_DELIVERY` | `CANCELED` | Delivery failed (customer not home, address bad) | DRIVER `order.deliver` OR ADMIN+ `order.cancel` | Notify customer; admin queue for resolution |
| `PICKED_UP` | `COMPLETED` | Auto (immediately after PICKED_UP commit) | System | Increment customer LTV; send review-request email (if configured); update reporting |
| `DELIVERED` | `COMPLETED` | Auto (immediately after DELIVERED commit) | System | Same as PICKED_UP→COMPLETED |
| `SERVED` | `COMPLETED` | Auto OR staff close-out at end of service | System OR STAFF+ `order.update` | Same as PICKED_UP→COMPLETED |
| `COMPLETED` | `REFUNDED` | Admin issues full refund | ADMIN+ `order.refund` (full amount) | Restock inventory if items were physical; reverse the payment via Stripe; send refund-issued notification |
| Any non-terminal | `REFUNDED` | Admin issues full refund pre-completion | ADMIN+ `order.refund` (full amount) | Same as above; if order is already cooked, no restock |

**Partial refunds** never change `Order.status`. They write a `Refund` row (status `PENDING → COMPLETED`) and an `OrderEvent` of kind `partial_refund`. The order remains in its current state.

## 5. Side-effect catalog

Side effects are declared per transition, queued for post-commit execution, executed via a worker (or inline if not separated), and **must be idempotent** because retries are real.

```ts
type SideEffect =
  | { kind: "email"; template: string; to: string; locale: Locale; payload: Json }
  | { kind: "sms"; template: string; to: string; locale: Locale; payload: Json }
  | { kind: "inventory.decrement"; itemId: string; quantity: number; orderId: string }
  | { kind: "inventory.increment"; itemId: string; quantity: number; orderId: string }
  | { kind: "payment.capture"; paymentId: string }
  | { kind: "payment.refund"; paymentId: string; amountCents: number; reason: string }
  | { kind: "kitchen.push"; orderId: string }
  | { kind: "kitchen.remove"; orderId: string }
  | { kind: "customer.ltv_increment"; customerId: string; amountCents: number }
  | { kind: "notification.staff"; orderId: string; type: string }
  | { kind: "webhook.outbound"; event: string; orderId: string };
```

Each side effect has an **idempotency key** derived from `(transitionId, kind, payload-hash)`. If a side effect's executor fails partway and retries, the receiver (email provider, Stripe, kitchen SSE channel) deduplicates by this key.

## 6. Edge cases

### Idempotency
Re-applying the same transition (`(from=X, to=X)` or a duplicate `(from=X, to=Y)` after Y already happened) is a no-op. The function checks `order.status` after taking the transaction lock and bails out cleanly if the desired state is already reached.

### Network failure on the client side
The kitchen display, customer status page, and driver view all use optimistic updates locally with a server-confirmed canonical state. If a "Ready" tap submits but the response is lost, the next page render reconciles. The tap itself is idempotent server-side.

### Concurrent transitions
Two cooks both tap "Ready" simultaneously. The transaction acquires a row lock on `Order`. The second commits successfully too because READY→READY is idempotent. Both get a 200 response. Only one `OrderEvent` is written (the first; the second is a no-op).

### Cancellation during cook
Admin cancels while order is `IN_KITCHEN`. The kitchen display shows a red banner on the order card ("CANCELED — stop work"). Cook acknowledges by tapping a confirm — this is informational, not a state transition.

### Out-of-order transitions
Anything not on the transition table throws `InvalidTransitionError`. The error includes the invalid edge for debugging. Examples: `COMPLETED → IN_KITCHEN`, `CANCELED → ANYTHING`, `READY → COMPLETED` (must go through AWAITING_PICKUP / OUT_FOR_DELIVERY / SERVED first).

### Late payment failure
Stripe webhook delivers a `payment_intent.payment_failed` event after the order is already `CONFIRMED` (rare — usually means a chargeback days later). Don't transition state automatically. Open an admin notification: "Payment for order #123 was disputed/failed after confirmation. Decide on refund/follow-up."

### Refund of already-shipped delivery
Admin refunds an order that's already `DELIVERED`. Transition to REFUNDED is valid; no inventory restock (the food is consumed); the refund record is created and Stripe is asked to reverse the original charge.

### Customer self-cancel race with confirmation
Customer hits "Cancel" at the same moment the church confirms. The transaction locks the row. Whichever transaction commits first wins. If `SUBMITTED → CANCELED` won, the subsequent `SUBMITTED → CONFIRMED` throws `InvalidTransitionError` and the staff user sees "order was canceled by customer." Vice versa: if confirmation won, the customer's cancel attempt returns "cancellation window has closed."

## 7. Scheduled orders

`Order.scheduledFor` is a UTC timestamp; null means "fulfill ASAP."

**IMMEDIATE mode** (`ChurchSettings.kitchenDisplayMode = IMMEDIATE`):
- All `CONFIRMED` and `IN_KITCHEN` orders appear on the kitchen display.
- Sorted by `scheduledFor ?? createdAt` ascending.
- Urgency colors per `scheduledFor`:
  - Red — ≤ 10 minutes until scheduled time (or already overdue)
  - Amber — ≤ 1 hour
  - Neutral — beyond 1 hour
- Cooks see the full picture and plan ahead.

**JUST_IN_TIME mode** (`ChurchSettings.kitchenDisplayMode = JUST_IN_TIME`, with `prepLeadTimeMinutes`):
- An order appears on the kitchen display only when `scheduledFor - prepLeadTimeMinutes ≤ now`.
- Until then, the order stays in `CONFIRMED` state but is hidden from the kitchen display.
- Once visible, behaves identically to IMMEDIATE.
- Implemented as a query-time filter in the kitchen display API, not a state transition (avoids needing a cron to "activate" orders).

## 8. Cancellation policy

**Who can cancel, and when:**

| State at cancel time | Customer | STAFF | ADMIN+ |
|---|---|---|---|
| `DRAFT`, `SUBMITTED` | ✓ within `customerSelfCancelWindowMinutes` | ✓ | ✓ |
| `CONFIRMED` | ✗ | ✓ (with reason) | ✓ |
| `IN_KITCHEN` | ✗ | ✗ | ✓ (with reason) |
| `READY`, `AWAITING_PICKUP`, `OUT_FOR_DELIVERY`, `SERVED` | ✗ | ✗ | ✓ (with reason) |
| `COMPLETED`, `CANCELED`, `REFUNDED` | ✗ (use refund) | ✗ | ✗ |

Cancellation always:
1. Writes the transition + `OrderEvent` with `reason` mandatory.
2. Restocks inventory if items were already decremented.
3. Initiates a refund if any payment was captured.
4. Notifies the customer with the cancellation reason (or a generic message if the reason is internal).

## 9. Refund flow

Two modes, both write a `Refund` row:

**Partial refund** — order stays in current state. `Refund.amount < Payment.amount`. Multiple partial refunds against the same payment are allowed (sum must not exceed payment total). Each partial writes an `OrderEvent` of kind `partial_refund`.

**Full refund** — order transitions to `REFUNDED`. `Refund.amount = Payment.amount`. If the order had a fulfilled physical good (DELIVERED, PICKED_UP, SERVED), inventory is *not* restocked. Pre-fulfillment full refunds DO restock.

**Refund execution** delegates to the payment adapter:
- Stripe (BYO or Connect): call `stripe.refunds.create` with idempotency key
- Cash/Zelle/PayOnPickup: marked as `Refund.status = COMPLETED` immediately (church handles the physical refund off-platform; the system just records that it happened)

**Refund authorization** uses the RBAC matrix nuance:
- STAFF: partial only, up to `staffRefundCapCents`
- ADMIN+: any amount, full or partial

## 10. Implementation

```ts
// lib/orders/transitions.ts

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT:            ["SUBMITTED", "CANCELED"],
  SUBMITTED:        ["CONFIRMED", "CANCELED"],
  CONFIRMED:        ["IN_KITCHEN", "CANCELED", "REFUNDED"],
  IN_KITCHEN:       ["READY", "CANCELED", "REFUNDED"],
  READY:            ["AWAITING_PICKUP", "OUT_FOR_DELIVERY", "SERVED", "CANCELED", "REFUNDED"],
  AWAITING_PICKUP:  ["PICKED_UP", "CANCELED", "REFUNDED"],
  PICKED_UP:        ["COMPLETED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELED", "REFUNDED"],
  DELIVERED:        ["COMPLETED"],
  SERVED:           ["COMPLETED"],
  COMPLETED:        ["REFUNDED"],
  CANCELED:         [],
  REFUNDED:         [],
};

interface TransitionInput {
  orderId: string;
  toStatus: OrderStatus;
  actor: { membershipId: string; userId: string } | { kind: "system"; source: string };
  reason?: string;
  metadata?: Json;
}

async function transition(input: TransitionInput): Promise<Order>;
```

The function:
1. Opens a Postgres transaction with row-lock on `Order`.
2. Reads current `Order.status`.
3. If `currentStatus === toStatus`: returns the order (idempotent no-op, no `OrderEvent` written).
4. If `toStatus` not in `ALLOWED_TRANSITIONS[currentStatus]`: throws `InvalidTransitionError`.
5. Resolves the RBAC action for this transition and calls `can()` for human-initiated transitions (system-initiated skip the check).
6. Updates `Order.status`; inserts `OrderEvent`.
7. Computes the side-effect list for this transition (from a declared table).
8. Enqueues side effects with idempotency keys (post-commit).
9. Commits.
10. Returns the updated order.

Hand-rolled over a state-machine library (xstate, etc.) because the surface is small enough (~30 transitions) and the overhead of a library would be hard to justify. Re-evaluate if v2 adds significant complexity.

## 11. Tests

Each transition is a test case. Each edge case in §6 is a test case. Each cancellation policy row in §8 is a test case. Coverage target on `lib/orders/transitions.ts`: 100% line, 100% branch — same as RBAC, because every uncovered branch is a potential workflow bug or money bug.

## 12. Out of scope for v1

- **Modifications mid-flight** — customer wants to add an item after submit. Current answer: cancel and reorder. v2 may allow staff-mediated edits up to CONFIRMED.
- **Partial fulfillment** — some items can be made, others can't. Current answer: the whole order is the unit; out-of-stock at confirmation = cancellation. v2 could split fulfillment.
- **Multi-driver assignment** — a single delivery handled by handoff between two drivers. v2.
- **Order merging / splitting** — combining two orders for one customer, or splitting one big order across two cooks. v2.
