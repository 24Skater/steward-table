# Steward Table — Driver View UX

The screen volunteer drivers see while delivering. Smaller surface than the other deep-dives — the RBAC scoping and state-machine transitions already constrain most of the work.

## 1. Who this is for

- **The DRIVER role only.** Multi-role members (STAFF + DRIVER) get the staff view when they sign in, and switch to the driver view via a header toggle when they're actually delivering.
- **Pure mobile context.** Driver is in a car, on a porch, holding a tray of pupusas. Phone in one hand. Tap targets need to be generous; reading at a glance matters more than visual density.
- **Network may drop.** Apartment building elevator, basement parking, dead-zone neighborhoods. UI must survive disconnects without losing the driver's intent.
- **Privacy-first.** Drivers see only what they need to deliver — name, phone, address, special instructions. No order history, no notes, no full customer profile. Already enforced by RBAC (§4 of `RBAC_MATRIX.md`).

## 2. Routes

| URL | Purpose |
|---|---|
| `table.steward.app/d` | Driver home — list of available and assigned deliveries (the only screen drivers regularly use) |
| `table.steward.app/d/[orderId]` | Single-delivery detail — fully expanded view when actively delivering |
| `table.steward.app/d/history` | Past deliveries (today and prior days) for personal reference; no admin power |

The `/d/*` route group is COOK/DRIVER/VIEWER specialized routes, not under `/admin/*`.

## 3. Layout — driver home (`/d`)

Mobile-first single-column layout. Two sections, both visible:

```
┌─────────────────────────────────┐
│ [Logo] Steward Table     ⚙       │  ← slim header with sign-out / settings
│                                 │
│ ─── Your deliveries (2) ───     │  ← assigned to this driver
│ ┌────────────────────────────┐  │
│ │ Order #47 · Picked up      │  │  ← currently OUT_FOR_DELIVERY
│ │ Doña Carmen R.             │  │
│ │ 8401 Belvoir Dr, Bowie     │  │
│ │ 3 × Pupusa Revuelta + 2 …  │  │
│ │ ┌──────────────────────┐   │  │
│ │ │     Delivered        │   │  │  ← big tap target
│ │ └──────────────────────┘   │  │
│ │ ☎ Call · 🗺 Navigate        │  │
│ └────────────────────────────┘  │
│ ┌────────────────────────────┐  │
│ │ Order #51 · Ready          │  │  ← READY, assigned, not picked up yet
│ │ Marcos G.                  │  │
│ │ 12100 Riding Crop Ct, Beltsville │
│ │ 5 × Pupusa Queso           │  │
│ │ ┌──────────────────────┐   │  │
│ │ │   Picked up          │   │  │
│ │ └──────────────────────┘   │  │
│ └────────────────────────────┘  │
│                                 │
│ ─── Available (3) ───           │  ← unassigned pool, claimable
│ ┌────────────────────────────┐  │
│ │ Order #52 · Beltsville     │  │  ← summary view; tap to claim
│ │ 2 items                    │  │
│ │ Scheduled: 1:30 PM         │  │
│ │ ┌──────────────────────┐   │  │
│ │ │    Claim             │   │  │
│ │ └──────────────────────┘   │  │
│ └────────────────────────────┘  │
│ ┌────────────────────────────┐  │
│ │ Order #53 · Bowie          │  │
│ │ 4 items                    │  │
│ │ Scheduled: 2:00 PM         │  │
│ │ [Claim]                    │  │
│ └────────────────────────────┘  │
└─────────────────────────────────┘
```

### Sort and visibility rules

**Your deliveries section** (orders where `DeliveryInfo.driverId = self.userId`, `status IN (READY, OUT_FOR_DELIVERY)`):

- Sorted by current state then by scheduled time:
  - `OUT_FOR_DELIVERY` first (active deliveries you're carrying)
  - `READY` second (ready to pick up from the church)
- Each card shows everything the driver needs: customer first name + last initial, address, item summary, primary action button, secondary actions (call, navigate).
- Each card is one tap from action: "Picked up" (READY → OUT_FOR_DELIVERY) or "Delivered" (OUT_FOR_DELIVERY → DELIVERED).

**Available section** (orders with `fulfillment = DELIVERY`, `status = READY`, `DeliveryInfo.driverId IS NULL`):

- Sorted by `scheduledFor ?? createdAt` ascending — oldest/earliest first.
- Summary-only — no PII visible until claimed. Just rough location (city/zone name from `DeliveryZone`), item count, scheduled time. The driver can't see customer name or full address until they claim. This is intentional: drivers shouldn't be "shopping" for which customer to take based on neighborhood demographics or order size.
- "Claim" is a single tap. First driver to tap wins the row lock; others see the card disappear and a brief toast: "Order #52 was claimed by someone else."

**Both sections** auto-update via SSE — new available orders appear in real-time, claimed orders disappear from the available pool, deliveries marked complete by the driver drop out of their list.

## 4. Delivery card anatomy (assigned)

```
┌──────────────────────────────────────────┐
│ Order #47 · Picked up                    │  ← status text in chip
│                                          │
│ Doña Carmen R.                           │  ← customer first name + last initial
│ 8401 Belvoir Dr                          │
│ Bowie, MD 20720                          │
│                                          │
│ 3 × Pupusa Revuelta                      │  ← items overview (collapsed; tap to expand)
│ 2 × Pupusa Queso                         │
│ + curtido side                           │
│                                          │
│ ⚠ "Please leave at door, dog is friendly"│  ← delivery instructions (only if present)
│                                          │
│ ┌──────────────────────────────────┐     │
│ │         DELIVERED                │     │  ← primary action, 64 px tall
│ └──────────────────────────────────┘     │
│                                          │
│ ☎ Call Carmen   🗺 Navigate              │  ← secondary actions
└──────────────────────────────────────────┘
```

**Sizing:**

- Card width fills the screen (with 16 px margin).
- Primary action button: 64 px tall, full card width, contrast-strong.
- Secondary actions (Call, Navigate): 48 px tall, side-by-side, 50% width each.

**Items overview:**

- Collapsed by default (3 lines max). Tap to expand the full item + modifier list.
- Cart summary, not a full receipt — driver knows what's in the bag.

**Delivery instructions:**

- Only rendered if `DeliveryInfo.instructions` is non-empty.
- Visually distinct (yellow background like the kitchen notes pattern) — these are critical and easy to overlook.

**Tap-to-call:**

- Triggers `tel:` URI → opens native dialer with `Customer.phone` pre-filled.
- Driver action is to literally tap once and start dialing.

**Tap-to-navigate:**

- Triggers a `geo:lat,lon?q=address` URI (Android) or `maps://?address=...` (iOS) — opens the user's default map app. Falls back to `https://maps.google.com/?q=...` if those fail.
- Address is the full `DeliveryInfo.line1, line2, city, region, postalCode` URL-encoded.
- Steward Table does NOT pre-resolve coordinates — that's the maps app's job. Address-string-based navigation works universally.

**Status transitions (the primary button):**

- For `READY`: button reads **"Picked up"**. Single tap transitions to `OUT_FOR_DELIVERY` via the state machine.
- For `OUT_FOR_DELIVERY`: button reads **"Delivered"**. Single tap transitions to `DELIVERED` (which auto-advances to `COMPLETED` per state machine §4).
- After tap: optimistic UI confirms locally (button briefly shows "✓") then card animates out of the list. SSE refresh removes the order from any other open driver session.

## 5. Available card anatomy (unclaimed)

```
┌──────────────────────────────────────────┐
│ Order #52 · Beltsville                   │  ← rough location only
│                                          │
│ 2 items                                  │
│ Scheduled: 1:30 PM                       │
│                                          │
│ ┌──────────────────────────────────┐     │
│ │           CLAIM                  │     │
│ └──────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

- No customer name. No specific address. Just enough info to make a "do I want to take this?" decision.
- "Claim" is a single tap. On success: card moves from "Available" to "Your deliveries" with the now-visible full detail.
- On race-lost: card disappears with a toast.

## 6. Detail view (`/d/[orderId]`)

When the driver is actively working a delivery, they often want more space. Tapping the card header (not the action button) opens the full-screen detail.

This view shows the same content as the card but expanded:

- All items + modifiers + special notes per item (not just the summary).
- Full customer phone with one-tap call.
- Full address with map preview embedded inline (if connected) or just the address text.
- "Navigate" button that opens the maps app.
- "Picked up" / "Delivered" primary action.
- "Back to list" returns to `/d`.

Used less often than the list view but valuable when the driver wants to confirm what they're carrying before walking up to the door.

## 7. Driver assignment (admin side)

From the orders dashboard (`/admin/orders`), when an order is in READY state with `fulfillment = DELIVERY`:

- A "Driver" column shows current assignment (driver name or "Unassigned").
- Inline dropdown lets admin pick from active DRIVER memberships in this church.
- Selecting "Unassigned" leaves it in the pool for self-claim.
- Selecting a driver sets `DeliveryInfo.driverId` directly — no notification spam, the driver sees it appear in their queue next SSE tick.

Drivers can be re-assigned at any time while the order is in `READY`. Once `OUT_FOR_DELIVERY`, reassignment requires the current driver to release first (`OUT_FOR_DELIVERY → READY` with `clear driver`, then re-assign) — preserves the audit trail of who actually carried what.

## 8. Multiple simultaneous deliveries

A driver can have multiple deliveries in their queue at once. Common case: pick up three orders from the church, deliver in sequence.

- All assigned orders appear in the "Your deliveries" section regardless of state.
- The driver decides their own order of operations — Steward Table doesn't impose routing.
- A small inline indicator on each card hints at proximity if data is available ("0.3 mi away" between addresses), but this is computed client-side from the maps app's results, not a Steward Table feature in v1.

Multi-stop routing optimization is a v2 enhancement (Google Routes API or similar).

## 9. Offline behavior

- **Action buttons (Picked up, Delivered, Claim) use optimistic UI** — the local card updates immediately; the HTTP request goes in the background with retry + idempotency key.
- **If the request fails** (network drop, server error): card reverts, a small toast appears: "Couldn't update — try again when you have signal." Driver re-taps when reconnected.
- **A slim red bar** at the top of the screen shows "Reconnecting…" during a disconnect, removed when connection returns.
- **Idempotency keys** on every transition request prevent double-processing if the driver taps twice after a hung request.

## 10. Privacy

**No location tracking in v1.** Steward Table doesn't collect, store, transmit, or display driver location. The driver's phone has location services for the maps app; that's a Google/Apple problem, not a Steward problem. If a church ever wants driver-location features (real-time pin on a customer map, "your driver is 3 minutes away"), that's v2 with explicit driver opt-in, encrypted-at-rest location storage, short retention, and a privacy policy update.

Customer phone numbers are visible to assigned drivers via tap-to-call but are NOT extractable in bulk (no "export drivers' delivery list as CSV" — that's an `customer.export` action restricted to ADMIN per the RBAC matrix).

## 11. Notifications to driver

- **New assignment**: pushed via SSE to the driver's open session if they're on `/d`. If they're not on `/d`, push notifications could be valuable — but push requires service-worker setup and per-platform notification permissions, so v1 punts to **SMS-based notification** (driver gets a text from Steward Table: "New delivery assigned at the church — open Steward to see"). This piggybacks on the SMS infrastructure already in place for customer notifications.
- **Order canceled while assigned**: SSE update on open session OR SMS if not. Card on the driver view shows a red banner: "CANCELED — return to church" with the cancellation reason. Driver acknowledges by tapping; card disappears.

## 12. Implementation notes

- Route group: `app/(driver)/d/` with middleware enforcing DRIVER role membership in the church scope.
- Layout component is its own shell (different from admin), simpler header, big tap targets.
- SSE channel at `/api/driver/stream?churchId=X` scoped to the authenticated driver (filtered server-side; never trust client filtering for tenancy).
- All transition requests use the same `transition()` function from `lib/orders/transitions.ts` per `STATE_MACHINE.md` — driver actions are first-class state transitions, not special cases.
- Map link generation is a small utility in `lib/integrations/maps.ts` that handles the platform-specific URI schemes.
- Tests: Playwright e2e for the driver happy path (sign in → claim → picked up → delivered) plus the race-lost scenario for unassigned claims.

## 13. Out of scope for v1

- **Multi-stop route optimization** — drivers self-route by tapping addresses individually. v2.
- **Live driver location on customer map** — privacy-fraught and not needed for church-scale deliveries. v2 with opt-in.
- **Photo proof of delivery** — overkill for the use case. v2 if churches ask.
- **Signature capture** — same.
- **Background push notifications** — relies on service workers and per-platform permission flows. SMS-based assignment notifications cover v1.
- **Driver earnings / mileage tracking** — Steward Table is for unpaid volunteer drivers in v1. If paid-driver features ever matter, v2.
- **In-app messaging between driver and customer** — drivers call directly. v2.
