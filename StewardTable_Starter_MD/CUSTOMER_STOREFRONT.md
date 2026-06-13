# Steward Table — Customer Storefront UX

The customer-facing surface. Where every person who buys a pupusa from IAYO meets Steward Table.

## 1. Context

Picture the actual customer:

- **Doña Carmen, 67**, gets a WhatsApp message from her daughter: "Mami, the church is selling pupusas this Sunday, here's the link: https://alfayomega.table.steward.app". She taps the link on her iPhone in Spanish. She wants to order three pupusas, pay with her card, pick up after Sunday service. She needs to be able to do this without learning a new app, without creating an account, without translating anything in her head.
- **Marcos, 28**, sees the same link on his work laptop. He's bilingual, fine in English. He wants to order pupusas for delivery to his apartment.
- **Pastor Luis** sends the same link to his entire congregation list. Three hundred people hit it within ten minutes of the morning service ending.

The storefront must work for all three of them, simultaneously, on any device, in either language, with zero training. The cart icon, the modifier picker, the payment screen — none of these are surfaces a customer should ever wonder about.

## 2. URL structure

Per §18, every church gets a subdomain at `{slug}.table.steward.app`. Storefront lives at the apex of that subdomain.

| URL | Purpose |
|---|---|
| `alfayomega.table.steward.app` | Storefront — shows the current OPEN catalog if there is one, or the "we're not selling right now" state |
| `alfayomega.table.steward.app/c/[catalogSlug]` | Specific catalog (only used if the church runs multiple simultaneous OPEN catalogs — rare) |
| `alfayomega.table.steward.app/order/[orderToken]` | Customer order status page (link sent in confirmation email/SMS) |
| `alfayomega.table.steward.app/welcome` | Magic-link account upgrade landing |

Marketing site and admin do NOT live here — those are `steward.app` and `table.steward.app` respectively.

## 3. Layout

Single-page experience. **No client-side navigation between catalog browse, cart, and item details** — those are all overlays / drawers on the same page. Only checkout and the post-order confirmation are separate routes.

```
┌─────────────────────────────────────────────────┐
│ ┌─[Logo] Iglesia Alfa y Omega   [ES ▾]  [☰] ─┐ │  ← header (slim, sticky)
│ └──────────────────────────────────────────────┘ │
│                                                 │
│ Pupusa Sale — June 8, 2026                      │  ← catalog hero (name, dates, optional photo)
│ Sunday, 12:00–6:00 PM · Pickup or delivery      │
│                                                 │
│ ─── Items ───                                   │
│ ┌─────────────┐  ┌─────────────┐                │
│ │ [photo]     │  │ [photo]     │                │  ← item cards
│ │ Pupusa      │  │ Pupusa      │                │
│ │ Revuelta    │  │ Queso       │                │
│ │ $3.00       │  │ $3.00       │                │
│ │ Pick filling│  │ Pick filling│                │
│ └─────────────┘  └─────────────┘                │
│ ...                                             │
│                                                 │
└─────────────────────────────────────────────────┘
┌─[ View cart · 3 items · $9.00 ────────────────]─┐  ← sticky bottom bar
└─────────────────────────────────────────────────┘
```

Tapping an item → bottom-sheet drawer (modifier selection + add to cart).
Tapping the sticky cart bar → bottom-sheet drawer (cart + checkout CTA).
Tapping "Checkout" in cart drawer → navigates to `/checkout`.

## 4. Header

Three elements, slim (~56 px):

- **Logo + church name** (left) — `Church.logoUrl` if set, otherwise initial-based avatar in the church's accent color
- **Language switcher** (right-center) — current locale shown, dropdown to switch (`EN | ES`)
- **Menu button** (right) — opens a slim drawer with: "About this sale" (if `Catalog.description` set), "Contact the church" (`replyToEmail` from settings), "View my order" (if a recent order exists in localStorage)

Header is sticky. Doesn't shrink or transform on scroll — sticky design that does too much on scroll creates wobble.

## 5. Catalog browse

**Layout:**

- Mobile (< 640px): 1-column item cards, ~340 px tall each
- Tablet (640–1024px): 2-column grid
- Desktop (≥ 1024px): 3-column grid, max page width ~1200 px

**Item card anatomy:**

```
┌───────────────────────────────┐
│  ┌──────────────────────────┐ │
│  │                          │ │
│  │     [item photo]         │ │  ← 1:1 aspect, lazy-loaded
│  │                          │ │
│  └──────────────────────────┘ │
│                               │
│  Pupusa Revuelta              │  ← name (locale-aware)
│  $3.00                        │  ← effective price
│  Pick a filling               │  ← short modifier hint (only if has required modifiers)
└───────────────────────────────┘
```

- Tapping anywhere on the card opens the modifier drawer.
- If `CatalogItem.isAvailable === false`: card renders with a "Sold out" overlay and is not tappable.
- If `Item.imageUrl` is missing: card renders a neutral placeholder with the item name centered. Not aggressive about photo emptiness — churches will roll out incomplete catalogs.

**Categorization in v1:** none. All items render in a single grid sorted by `CatalogItem.sortOrder`. Categories (`Pupusas`, `Sides`, `Drinks`) are a v2 add via the `Category` model (per `CATALOG_ADMIN.md` §17 out-of-scope).

## 6. Modifier drawer

Opened on item-card tap. Bottom-sheet on mobile (slides up from bottom, fills ~85% of viewport); centered modal on desktop (~480 px wide). Dismissible by close button, swipe-down (mobile), Escape key (desktop), or backdrop tap.

```
┌─────────────────────────────────────┐
│  ✕                                  │
│  ┌───────────────────────────────┐  │
│  │      [item photo, large]      │  │
│  └───────────────────────────────┘  │
│                                     │
│  Pupusa Revuelta             $3.00  │
│  A traditional Salvadoran pupusa…   │
│                                     │
│  ─── Pupusa Filling · Required ───  │
│  ⦿ Revuelta                         │
│  ◯ Queso (+$0.50)                   │
│  ◯ Frijol                           │
│  ◯ Chicharrón (+$0.50)              │
│                                     │
│  ─── Side Choice · Optional ───     │
│  ☐ Curtido (+$1.00)                 │
│  ☐ Atol de elote (+$2.00)           │
│                                     │
│  Quantity:  [-]  3  [+]             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Add 3 to cart  ·  $10.50   │    │  ← sticky CTA inside the sheet
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Behavior rules:**

- Required modifier groups show "Required" badge; "Add to cart" CTA is disabled until requirements satisfied (e.g., must pick one filling).
- Validation messages render inline below the group when the customer taps the CTA before satisfying requirements: "Please pick a filling."
- Quantity stepper minimum is 1 (you can't add 0 of an item); maximum is `CatalogItem.maxQuantityPerOrder ?? 99`.
- The CTA text updates live: "Add 3 to cart · $10.50" — reflects quantity × (base price + modifier deltas).
- Selecting a modifier with a price delta updates the price live.
- "Add to cart" closes the drawer with a brief confirmation toast: "Added 3 × Pupusa Revuelta." Returns to catalog browse.

**Editing an item already in cart:** from the cart drawer, tapping a line item re-opens the modifier drawer with current selections pre-populated; "Add" becomes "Update" and overwrites the existing cart line. No duplicate lines.

## 7. Cart drawer

Opened by tapping the sticky bottom bar. Bottom-sheet on mobile (fills ~90% of viewport); right-side drawer on desktop (~420 px wide).

```
┌─────────────────────────────────────┐
│  ✕  Your cart                       │
│                                     │
│  3 × Pupusa Revuelta       $10.50   │  ← tap row to edit
│      Filling: Revuelta              │
│      Side: Curtido                  │
│                                     │
│  2 × Pupusa Queso          $7.00    │
│      Filling: Queso                 │
│                                     │
│  ─────────────────────────────      │
│  Subtotal                  $17.50   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Checkout — $17.50       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

- Tap row → re-opens modifier drawer for that line (edit existing).
- Long-press or swipe-left on row → reveals "Remove" action.
- Subtotal only — tax/tip/delivery fees calculated at checkout (need fulfillment + address first).
- Tap Checkout → navigate to `/checkout`.

**Empty cart state:** the cart drawer can't actually open if the cart is empty (the sticky bar is hidden in that case). But if a customer hits `/cart` directly somehow (deep link), they see an empty state with a "Browse items" CTA back to the catalog.

## 8. Checkout (`/checkout`)

Single-page checkout. No multi-step wizard. Sections flow vertically; the customer can scroll up to revise anything.

```
┌─────────────────────────────────────┐
│  ← Back to cart                     │
│                                     │
│  ─── Contact ───                    │
│  Name [____________]                │
│  Phone [____________]                │
│  Email (optional) [____________]    │
│                                     │
│  ─── How would you like it? ───     │
│  ⦿ Pickup                           │
│  ◯ Delivery                         │
│  ◯ Dine in                          │
│                                     │
│  (if Pickup:)                       │
│  When? [Anytime · ▾]                │
│  (or scheduled time picker)         │
│                                     │
│  (if Delivery:)                     │
│  Address [________________]         │
│  …                                  │
│  Delivery fee will be calculated.   │
│                                     │
│  ─── Notes for the kitchen ───      │
│  [____________________________]     │
│                                     │
│  ─── Payment ───                    │
│  ⦿ Card                             │
│  ◯ Cash on pickup                   │
│  ◯ Zelle (instructions emailed)     │
│                                     │
│  [Stripe Card Element when "Card"]  │
│                                     │
│  ─── Summary ───                    │
│  Subtotal              $17.50       │
│  Tax                    $1.05       │
│  Delivery               $5.00       │
│  Tip   (optional, slider/buttons)   │
│  ──────────────────                 │
│  Total                 $23.55       │
│                                     │
│  ☐ I agree to receive SMS updates   │
│    about this order (TCPA copy)     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Place order — $23.55    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Rules:**

- Available fulfillment types depend on what the catalog and church support (e.g., delivery only appears if the church has any `DeliveryZone` records).
- Schedule picker appears only if the catalog has an active window AND ASAP is feasible. If a sale is structured as "pickup between 12–2pm," show a single window indicator and only ask for ASAP / specific time within window if needed.
- Tax line is real-time recalculated as cart + fulfillment + address change. For Stripe Tax mode, uses Stripe Tax preview API; for manual mode, applies configured rates.
- Delivery fee is the matching `DeliveryZone.feeCents` based on entered ZIP. If no zone matches, show: "Sorry, we don't deliver to that ZIP. You can switch to pickup instead."
- Tip is optional, configurable per church (`ChurchSettings.acceptTips`). Presentation: three preset percentage buttons (15% / 18% / 20%) + custom input, all in the church's currency. Slider on mobile feels gimmicky; buttons are cleaner.
- Payment method options depend on `ChurchSettings.acceptCash`, `acceptZelle`, and Stripe connection status. Card always first if Stripe is configured.
- The SMS-opt-in checkbox uses the exact TCPA copy from §9.11, locale-aware, unchecked by default.
- "Place order" submits with a loading state; on success, navigate to `/order/[orderToken]` (the confirmation page).

**Validation:**

- Name + phone required.
- Email required only if the customer wants the magic-link upgrade later (we ask post-order, so it's optional here).
- Delivery requires address; pickup doesn't.
- Card payment requires Stripe Element completion.

## 9. Post-order confirmation (`/order/[orderToken]`)

After successful submission, customer lands on the order status page (also reachable from emailed/SMS link). This page is the customer status page — same URL serves "just placed" and "track your order" use cases.

```
┌─────────────────────────────────────┐
│  Order #47                          │
│                                     │
│  ✓ Submitted at 11:23 AM            │
│    Confirmed at 11:24 AM            │
│    In the kitchen                   │
│    Ready                            │
│    Picked up                        │
│    Completed                        │  ← timeline (filled steps in green, current pulsing)
│                                     │
│  ─── Your order ───                 │
│  3 × Pupusa Revuelta       $10.50   │
│  2 × Pupusa Queso          $7.00    │
│  Tax                       $1.05    │
│  Total                     $18.55   │
│                                     │
│  ─── Pickup at ───                  │
│  Iglesia Alfa y Omega AD            │
│  [address, phone]                   │
│  Today, 2:00 PM                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Track via SMS              │    │  ← if not yet opted in
│  │  + save info for next time  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Cancel order               │    │  ← only if within self-cancel window AND status ≤ SUBMITTED
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Magic-link upgrade prompt** (only on first visit, dismissible):
"**Want to track this order and save your info for next time?**  
We'll text you a link. No password, no signup form — just one tap."  
[ Send me the link ] [ No thanks ]

If the customer accepts: they get a magic link by SMS (or email if no phone), the click upgrades them from "guest customer" to "User-linked Customer," and the Customer record's `userId` is populated. Magic link also serves as the SMS opt-in moment with TCPA copy.

**Timeline update:** the page polls every 15 seconds (via SSE if browser supports, polling fallback) for state changes. Status badges advance in real time. No manual refresh needed.

## 10. Bilingual experience

- Locale resolution at page-load:
  1. URL query param `?lang=es` wins
  2. Stored locale on logged-in customer (if magic-link upgraded)
  3. Browser `Accept-Language` header if matches available locales
  4. Church's default locale
- Language switcher in header (top-right) shows current; tapping reveals options.
- All catalog content (item names, descriptions, modifier names) renders the customer's locale, falling back to the canonical (default-locale) value if a translation is missing — never blanks, never shows the locale code.
- Receipts and emails render in the customer's stored locale (per Customer.locale, set from the order checkout).

## 11. Empty / closed states

**Catalog closed (no OPEN catalogs for this church):**
```
Iglesia Alfa y Omega AD

We're not running a sale right now.
Check back soon, or get in touch:
[contact info]
```

Friendly, no app-shame. If the church has scheduled future catalogs visible publicly, list them: "Next sale: Pupusa Sale — June 8, 2026 · 12:00 PM."

**Catalog OPEN but no items available (all `isAvailable === false`):**
"We're sold out. Thanks for stopping by!" — same calm framing.

**Church doesn't exist (404 — invalid subdomain):**
Plain "page not found" — Steward Table doesn't disclose church existence per RBAC §6 principle.

**Catalog open, customer attempts to add an unavailable item:**
Modifier drawer shows "Sold out" overlay; can't add. Edge case — should be prevented by card-level overlay, but defensive.

## 12. Performance and SEO

- **Catalog page is SSR'd** by Next.js for fast first paint and SEO. Customer arrives via WhatsApp share link → sees a fully rendered page in well under a second on a 3G connection.
- **Catalog data + item photos** are static-enough to cache aggressively (Next.js ISR with short revalidation, or full static if catalog isn't actively being edited).
- **Cart and modifier state** is client-side only (localStorage + React state). No round-trip to add to cart.
- **OG/Twitter card metadata** auto-generated per church: church logo + name + current catalog title. WhatsApp / iMessage previews look intentional.
- **Storefront pages don't require authentication** to render. Robots-friendly for OPEN catalogs; OPEN catalogs may show in church search results.
- **No tracking pixels by default.** A church can opt-in to Google Analytics or Plausible via settings, but the v1 default is clean.

## 13. Accessibility

- Color contrast meets WCAG AA throughout.
- All interactive controls reachable by keyboard; focus rings visible.
- Modifier drawers and cart drawer have proper ARIA dialog semantics; focus traps; Escape to dismiss.
- Item photos have `alt` text from `ItemPhoto.altText` (and `Item.name` as fallback).
- The catalog page has a single H1 ("Iglesia Alfa y Omega AD — Pupusa Sale"). Section headings use H2/H3 in logical order.
- Forms have explicit `<label>` associations; error messages are programmatically linked via `aria-describedby`.

## 14. Implementation notes

- Routes: `/` (catalog), `/checkout`, `/order/[orderToken]`, `/welcome`, all under the `(storefront)` route group (per `schema.prisma` §5.1 structure).
- Resolved church from subdomain via Next.js middleware (per §18 storefront URL pattern) and passed via route segment data.
- Modifier drawer and cart drawer use shadcn/ui `<Sheet>` for the mobile bottom-sheet behavior; on desktop they automatically become a modal/right-drawer respectively via responsive className.
- Stripe Elements (Stripe.js + React Stripe.js) for card input in checkout.
- Cart state lives in client-side state managed by Zustand or React Context (lean toward simpler — Context with a reducer is enough). Persisted to localStorage so a customer returning later sees their in-progress cart.
- SSE channel for the order status page; polling fallback if SSE unavailable.
- Magic-link flow uses Auth.js's email provider; the link points to `/welcome?token=…` which logs the user in and then forwards back to the order status page.

## 15. Out of scope for v1

- **Multiple OPEN catalogs at once** in the same church. The storefront just shows the first OPEN one. v2 can add a catalog picker if churches need to run simultaneous sales.
- **Saved payment methods.** Customer enters card each time. Saved payment methods would require either Stripe Customer objects per Customer (Connect-compatible) or storing payment-method IDs — both feasible but not v1.
- **Order modifications after submit.** Per §18 state machine, the v1 answer is cancel + reorder.
- **Reviews / ratings.** Out of scope for a church sale.
- **Recommendations** ("you may also like"). v2 once there's data.
- **Multi-church search / browse** from the family apex (`steward.app`). v2.
- **Apple Pay / Google Pay** explicit buttons. Available via Stripe Elements automatically, but no separate native-style button in v1.
- **Gift orders** (buy on someone else's behalf with their delivery address). v2.
- **Group orders** (multiple people pile into one order before submit). v2.
