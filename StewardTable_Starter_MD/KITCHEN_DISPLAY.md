# Steward Table — Kitchen Display UX

The single most operationally important screen in the product. The cook is the most important user (§1.1); this screen is designed for them.

## 1. Physical context

Picture the real environment:

- **A tablet mounted on a wall** in a church kitchen. Sometimes a foot from a flour-dusted counter. Sometimes across the room.
- **The cook has flour, grease, sauce, or curtido on their hands.** May be wearing rubber gloves. Touch input must work through gloves and gentle finger pressure.
- **Lighting is variable.** Some church kitchens are bright; some have one overhead bulb. Display must hold up in both.
- **Audio is variable.** Some kitchens are quiet; some have a radio, conversation, kids in the next room.
- **The cook glances, doesn't read.** Information must be scannable in 1–2 seconds. The most important data is the largest.
- **The tablet must not sleep.** Wakelock kept active for the lifetime of the display session.
- **Network is iffy.** Church Wi-Fi varies. The display must survive brief disconnects without the cook noticing or losing work.

## 2. Layout

**Responsive card grid** sized to the device:

- Tablet portrait (~768 × 1024): **2 columns**
- Tablet landscape (~1024 × 768): **3 columns**
- Larger displays / desktop: **3–4 columns**
- Phone: **1 column** (fallback, not a primary surface)

Cards are tall, not wide. Each card is roughly **300 px wide × 400 px tall** at the recommended tablet size. Big enough to read details from across the room.

The display **does not scroll vertically** at typical volume. If the grid overflows the viewport (rare; would mean many simultaneous orders), the bottom row pages, not scrolls. Scrolling on a wall-mounted tablet is hostile to a cook with flour on their fingers.

Top bar (slim, ~48 px):

- Church name (small, left)
- Current time (center, large — useful for "when did this order come in" math)
- Active-order count (right)
- Settings cog (right-of-right) — opens a small overlay for sound on/off, full-screen, log out

That's it. No tabs, no filters, no nav. The cook came here to cook.

## 3. Card anatomy

Each order card shows, top to bottom:

```
┌─────────────────────────────────┐
│ #47 · 12:00 PM                  │ ← header: order number + scheduled or submitted time
│ ──────────────────────────────  │
│                                 │
│ 3 × Revuelta                    │ ← items: large, readable from across the room
│       Pupusa Filling: Revuelta  │   modifier groups + selected options below each
│                                 │
│ 2 × Queso                       │
│       Pupusa Filling: Queso     │
│                                 │
│ 1 × Atol de elote               │
│                                 │
│ ──────────────────────────────  │
│ Note: No onions, please         │ ← customer note (only if present)
│ ──────────────────────────────  │
│ For: María González · Pickup    │ ← customer name + fulfillment type
│                                 │
│ ┌───────────────────────────┐   │
│ │       MARK READY          │   │ ← big tap target — minimum 88 px tall
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Visual rules:**

- Item lines: largest type on the card (~24 pt).
- Modifiers: ~16 pt, indented, neutral color (cooks need to know but it's secondary).
- Customer note: visually distinct (light yellow background, dark text, slightly larger than modifiers — notes are mission-critical).
- "MARK READY" button: full width of card, minimum 88 px tall (well above the 44 px touch-target minimum — kitchen UX needs more forgiveness), high-contrast.
- The whole card is **not** tappable. Only the explicit "MARK READY" button is. Prevents accidental ready-marks from touching the screen to push a falling card or whatever.

**What's deliberately not on the card:**

- Customer phone, email, address — not relevant to the cook; visible on the order detail screen if needed.
- Payment status — not the cook's concern.
- Total / pricing — not the cook's concern.
- Driver assignment — not the cook's concern (separate driver view).

## 4. Sort and filter

**Sort key:** `scheduledFor ?? createdAt`, ascending. Orders due sooner appear earlier (top-left, reading order).

**What appears on the display** (depends on `ChurchSettings.kitchenDisplayMode`):

- **IMMEDIATE**: every order with `status IN (CONFIRMED, IN_KITCHEN)`.
- **JUST_IN_TIME**: every order with `status IN (CONFIRMED, IN_KITCHEN)` AND `(scheduledFor IS NULL OR scheduledFor - prepLeadTimeMinutes ≤ now)`.

**Visual urgency** (applies the per-card background tint, regardless of mode):

| Time to scheduled (or null) | Tint | Meaning |
|---|---|---|
| ≤ 10 min, or already overdue, or no schedule | Red wash + animated subtle pulse | "Make this now" |
| 10–60 min | Amber wash | "Heads up" |
| > 60 min | Neutral background | "Plenty of time" |

The pulse on red is *subtle* — gentle opacity oscillation, not a flashing emergency. Cooks ignore flashing.

**No filters in v1.** No "by station," no "by fulfillment type," no "by customer." The display shows everything actionable; the cook picks the next card based on urgency and items they can prep.

## 5. Interaction model

**Tap targets:**

- "MARK READY" button: 88 px tall, full card width, capital-letter label.
- Settings cog: 56 px square.
- Order detail (opening a card for full details — for staff, not cooks): tap the card header, NOT the body. Body tap does nothing to avoid accidents.

**Mark-ready confirmation:**

- Single tap on "MARK READY" transitions the order to READY immediately.
- Card animates: 2-second hold showing "READY ✓" in green with the marked-at time, then card fades out and the grid reflows.
- **No "are you sure" dialog.** Cooks tap "Ready" intentionally; an extra tap is an insult. If a cook taps by mistake, staff can revert via the order detail screen (admin-tier).
- Idempotent: tapping "Ready" twice within the 2-second hold does nothing the second time.

**No drag, no swipe.** Just taps. Cooks with one wet hand can't drag.

**Auto-refresh via SSE** — the client opens a persistent SSE connection to `/api/kitchen-display/stream?churchId=X`. New orders appear in the grid with a brief slide-in animation. Status changes elsewhere (cancellations, refunds) are reflected immediately. No polling, no manual refresh button — the display is live by design.

## 6. New-order arrival

When a new order joins the display:

- **Visual:** the new card slides in from the top with a brief highlight (1-second neutral accent border). Existing cards shift to accommodate.
- **Audio (off by default, toggle in settings):** soft single chime, ~400 ms, gentle. Not a buzzer. The cook is in a kitchen; loud alerts are stressful. Sound is opt-in.
- **No "you have a new order" modal.** The card appearing IS the notification.

## 7. Order cancellation mid-cook

If an admin cancels an order that's currently on the display (e.g., customer called, requested cancellation):

- Card immediately gets a red banner overlay: "**CANCELED — STOP**" with the reason (e.g., "Customer requested cancellation").
- Card stays visible for 30 seconds, then disappears.
- Audio cue (if enabled): a different sound from new-order — slightly lower pitch, briefer.
- No tap interaction needed; the card just leaves on its own. Cook acknowledges by reading.

## 8. Network and offline behavior

- **SSE reconnect** is automatic with exponential backoff (1s, 2s, 4s, 8s, cap 30s).
- **During disconnect:** a slim red bar appears at the top of the display: "Reconnecting…" — informational, doesn't block work.
- **Optimistic UI on Mark Ready:** the tap is acknowledged locally immediately. The HTTP request to `/api/orders/:id/transition` happens in the background. If the request fails (offline, server error), the card reverts to its prior state and a small toast appears: "Couldn't mark ready — try again." Cook re-taps.
- **Idempotency token** on every Mark Ready request prevents double-processing if a retry succeeds after the cook already re-tapped.
- **No work is lost** during network blips. The local state holds the cook's intent; sync catches up.

## 9. Accessibility

- **High contrast** is the default — light cards on dark background. Avoid relying on color alone for urgency (the wash tints are paired with text size and ordering, not standalone signals).
- **Min font sizes:** body text 16 pt, item lines 24 pt, "MARK READY" button text 20 pt.
- **No motion that can't be disabled** — the urgency pulse can be turned off in display settings for users sensitive to motion.
- **Voiceover / screen reader friendly** — cards have semantic order announcing structure (heading, list of items, action button). Realistically not used in a kitchen, but the structure costs nothing and helps when staff use the same screen on other devices.

## 10. Display settings (per-church)

Stored on `ChurchSettings` or a sibling table. Accessed via the cog in the top bar (admin-gated):

- **Sound on/off** (default off)
- **Show customer name on cards** (default on; some churches want anonymized for privacy)
- **Show customer notes on cards** (default on; notes are critical, hard to imagine turning off)
- **Card density:** compact / regular / large (default regular)
- **Idle timeout:** after N minutes of no activity, lock the screen with a tap-to-resume overlay (default 0 = never; useful for kitchens that leave the tablet visible)

## 11. Staff vs cook view

Same screen, with a small difference:

- **Cook view (default for COOK role)**: as specified above. One tap target per card.
- **Staff view (STAFF / ADMIN / OWNER)**: card header is tappable, opening an order detail overlay showing payment, customer contact, audit timeline. Allows triggering edge transitions (mark canceled with reason, override "Ready" state, etc.). Cooks can't access this because the body tap is inert for them, and the role gates the overlay.

A volunteer holding both COOK and STAFF roles (per multi-role) sees the staff version. The display deliberately doesn't expose a "switch to cook view" toggle — if you have staff permissions, you get the richer interaction.

## 12. Edge cases

- **Display loaded but no active church Membership / wrong subdomain:** redirect to login or the right subdomain. No data leakage.
- **Multiple cooks on multiple tablets, same church:** every tablet sees the same data, marks-ready propagate via SSE. The first to tap wins; second sees the card already gone.
- **An order with 0 items somehow:** edge case, but the card renders "Order #X has no items — admin attention needed" and Mark Ready is disabled. Shouldn't happen; defensive.
- **Order in `IN_KITCHEN` for > 1 hour:** card gets a small "⏱ in kitchen 1h+" badge. Not an error, just a nudge. Helps staff notice forgotten work.
- **`ChurchSettings.kitchenDisplayMode` flipped while orders are live:** display re-queries on settings change. JIT-hidden orders may appear or disappear; this is fine and rare.

## 13. Implementation notes

- Route: `/(dashboard)/kitchen` (under the auth-protected dashboard segment).
- Real-time: SSE via `/api/kitchen-display/stream`. SSE chosen over WebSockets for simpler deployment (works on Vercel, Cloudflare, single VPS without sticky-session config; sufficient for one-way server→client updates).
- Wakelock: `navigator.wakeLock.request("screen")` on display open, released on close. Graceful fallback if API unavailable.
- Component lives in `app/(dashboard)/kitchen/` with the order card extracted as a primitive in `components/kitchen/OrderCard.tsx`.
- Tests: Playwright e2e covering the cook happy path (new order arrives, mark ready, card disappears) and at least the cancellation overlay edge case.

## 14. Out of scope for v1

- **Multi-station** — the seam is in (`Item.station String?` on Item) but the UI does not expose station picking. v2.
- **Item-level ready marking** — order-level only. Item-level is v2 if real cooks ask for it.
- **Thermal print backup** — no printer integration in v1. The tablet is the source of truth. v2 can add ESC/POS thermal print as a fallback for kitchens that want paper.
- **Prep-time forecasting** — "estimated 12 minutes until ready" displayed to customers. Requires per-item prep-time estimates we don't have yet. v2.
- **Bumped-bar / completed bin** — a separate visual zone showing the last 10 marked-ready orders, useful in some kitchens. Cards just fade out in v1; v2 can add a "recently completed" tray.
- **Audio profiles** — only single-on/off. No "different sound for different order types." v2.
