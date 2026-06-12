# Steward — Build Plan

> Open-source order, fulfillment, and operations platform for churches and ministry-led food/goods sales.

---

## 0. Why this exists

This project is born from a real church pupusas sale: paper orders, three people taking calls at once, no shared view of what was ordered, no clean way to coordinate delivery, no view for the cooks of "what's next." Churches and small ministries deserve software that respects their workflow without forcing them into restaurant-POS pricing or DoorDash dependence.

**Steward Table is the order-to-delivery operations backbone for churches** — and the first app in the **Steward** family of open-source ministry tools (alongside *stewardChMs* and future siblings). It is opinionated about being:
- **Calm** — quiet UI, no emojis, clear iconography
- **Modern** — DoorDash/Uber Eats-grade UX, but ministry-appropriate
- **Self-hostable** — a church can run it on a small VPS
- **Multi-tenant by design** — one deploy can serve many congregations
- **Open source** — community-improvable, no vendor lock-in

---

## 1. Product principles

1. **The cook is the most important user.** Every decision is filtered through "does this make the kitchen calmer?"
2. **No emojis. Iconography only.** Lucide icons throughout. Tone is professional, warm, neutral.
3. **Mobile-first.** Most volunteers will use phones. Desktop is for admins and reporting.
4. **Offline-tolerant for ops screens.** A kitchen display should not blank out on flaky Wi-Fi.
5. **English + Spanish out of the box.** First-class i18n. Many target churches are bilingual.
6. **Payment-agnostic but Stripe-first.** Cash, Zelle, and "pay on pickup" are first-class statuses.
7. **Audit everything.** Money + ministry = full audit trail, no exceptions.

---

## 2. Brand: "Steward"

A steward manages what isn't theirs with diligence and care. The brand tone:
- **Voice:** calm, competent, never salesy
- **Color direction:** neutral base (slate/stone), one accent (deep evergreen or deep indigo — TBD in design pass)
- **Type:** Inter for UI, optionally a humanist serif for marketing
- **Iconography:** Lucide React, single stroke weight
- **Photography (marketing only):** real church kitchens, real volunteers, no stock smiles

---

## 3. Reference experiences

Study and borrow patterns from:
- **DoorDash / Uber Eats** — order intake, order status timeline, driver assignment, customer receipt UX
- **Square for Restaurants** — kitchen display, item modifiers, tax handling
- **Toast** — staff role separation, shift handoff
- **Stripe Checkout / Stripe Dashboard** — payment UX, receipts, refunds
- **Linear** — keyboard speed, command palette, dense but calm admin UI

Do NOT copy gamified, gradient-heavy, or aggressive marketing UI.

---

## 4. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15+ (App Router)** | One repo, RSC, edge-ready, great DX |
| Language | **TypeScript (strict)** | Non-negotiable |
| UI | **Tailwind CSS + shadcn/ui** | Headless primitives, easy to theme per church |
| Icons | **lucide-react** | Matches "no emoji" requirement |
| Auth | **Auth.js (NextAuth v5)** | Multi-provider: Credentials, Google, Apple, Magic Link |
| DB | **PostgreSQL** | Relational + JSONB for menu modifiers |
| ORM | **Prisma** | Type-safe, migrations, good with Postgres |
| Payments | **Stripe** (primary), pluggable adapter for Square later | Stripe handles receipts, tax, refunds, Apple/Google Pay |
| File storage | **S3-compatible** (R2, B2, MinIO for self-host) | Menu photos, branding assets |
| Realtime | **Postgres LISTEN/NOTIFY → SSE** | Avoid adding Redis until proven necessary |
| Email | **Resend** (cloud) / **SMTP** (self-host) | Receipts, magic links, staff invites |
| SMS | **Twilio** (optional) | Order-ready notifications |
| Testing | **Vitest + Playwright** | Unit + e2e |
| Hosting | **Vercel** (cloud) / **Docker Compose** (self-host) | Two first-class deploy paths |
| Observability | **OpenTelemetry → Grafana Cloud or self-hosted** | Optional, off by default |
| Package mgr | **pnpm** | Speed, monorepo-friendly later |
| Lint/format | **Biome** | One tool, fast |

---

## 5. Repository structure

Two repositories. The application code lives in **`steward-table`**. The Steward family's shared design system lives in **`steward-shared`**. Per §5.3, `steward-shared` starts intentionally minimal — only the parts that benefit from being shared today. Auth, RBAC, i18n, notifications, and the Church/User/Membership models all live inside `steward-table` for v1 and migrate to `@steward/*` packages when stewardChMs forces a second consumer.

### 5.1 `steward-table` (this repo — the application)

```
steward-table/
├── app/                             # Next.js App Router
│   ├── (marketing)/                 # Public landing
│   ├── (storefront)/                # Per-church public ordering at {slug}.table.steward.app
│   ├── (dashboard)/                 # Admin / staff / cook / driver / viewer
│   ├── api/                         # Route handlers
│   └── auth/
├── components/                      # App-specific components (built on @steward/ui primitives)
├── lib/                             # App-specific business logic
│   ├── auth/                        # Auth.js config + providers     [→ extract to @steward/auth when shared]
│   ├── rbac/                        # Permission + policy engine     [→ extract to @steward/rbac when shared]
│   ├── i18n/                        # en/es catalogs                 [→ extract to @steward/i18n when shared]
│   ├── notifications/               # Email + SMS adapter interface  [→ extract to @steward/notifications when shared]
│   ├── payments/                    # Stripe BYO + Connect adapters  (app-specific, stays here)
│   ├── orders/
│   ├── kitchen/
│   ├── delivery/
│   ├── inventory/
│   └── reporting/
├── prisma/
│   ├── schema.prisma                # Owns Church / User / Membership + all app tables (extractable later)
│   ├── migrations/
│   └── seed.ts                      # Seeded from Iglesia Alfa y Omega's real ops
├── styles/
├── public/
├── tests/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── RBAC.md
│   ├── DEPLOY_SELFHOST.md
│   ├── DEPLOY_VERCEL.md
│   ├── EXTRACTION_PLAN.md           # Tracks which lib/* folders graduate to @steward/* and when
│   └── CONTRIBUTING.md
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile
├── .github/workflows/
├── LICENSE                          # AGPL-3.0 (see §15)
├── COMMERCIAL_LICENSE.md            # Commercial license terms
├── README.md
├── STEWARD_TABLE_PLAN.md            # this file
└── package.json                     # depends on @steward/ui, @steward/icons
```

### 5.2 `steward-shared` (separate repo — minimal v1 scope)

```
steward-shared/
├── packages/
│   ├── ui/                          # @steward/ui — design system, primitives, brand tokens
│   └── icons/                       # @steward/icons — Lucide presets + Steward custom marks
├── .changeset/                      # Changesets for versioning
├── .github/workflows/               # Auto-publish on merge to main
├── LICENSE                          # AGPL-3.0
├── COMMERCIAL_LICENSE.md
└── README.md
```

**Future extraction targets** (move from `steward-table/lib/*` into `steward-shared/packages/*` when stewardChMs is real):

- `@steward/auth` — Auth.js config + providers + invitation flow
- `@steward/db-church` — Church / User / Membership Prisma fragments + zod schemas
- `@steward/rbac` — permission + policy engine (apps extend with their own actions)
- `@steward/i18n` — en/es message catalog primitives
- `@steward/notifications` — email + SMS adapter interface

`docs/EXTRACTION_PLAN.md` in `steward-table` tracks the intended boundaries so the eventual extraction stays clean instead of becoming archaeology.

### 5.3 Cross-repo concerns

- **Registry target** — public npm under the `@steward` scope is the recommended default (good OSS reach, normal for dual-licensed packages). GitHub Packages or JSR remain options if private hosting is ever needed.
- **Cross-app database strategy** — deferred per §18. Steward Table v1 is self-contained. Decided when stewardChMs actually forces the question.
- **Local dev loop** — when iterating on `@steward/ui` + Steward Table together, `pnpm link` in `steward-shared/packages/ui`, then point `steward-table` at the linked version. Document in `CONTRIBUTING.md`.

---

## 6. Core domain model

Tenancy: a **Church** (org) owns everything. Users can belong to multiple churches via **Memberships**.

```
Church
  ├── Memberships ──→ User
  ├── Locations              (a church may have multiple campuses)
  ├── Catalogs               (versioned menu sets — "Pupusa Sale June 6")
  │     └── Items
  │           └── Modifiers / Options
  ├── Orders
  │     ├── OrderItems
  │     ├── Payments
  │     ├── Fulfillment (pickup | delivery | dine-in)
  │     └── StatusEvents     (audit trail)
  ├── Customers              (church-scoped, dedupe by phone/email)
  ├── Inventory
  │     └── StockMovements
  ├── DeliveryZones / Routes
  └── Branding               (logo, colors, subdomain/slug)
```

### Prisma schema first pass (excerpt)

```prisma
model Church {
  id          String   @id @default(cuid())
  slug        String   @unique          // steward.app/c/alfaomega
  name        String
  timezone    String   @default("America/New_York")
  locale      String   @default("en")
  branding    Json?
  createdAt   DateTime @default(now())

  memberships Membership[]
  catalogs    Catalog[]
  orders      Order[]
  customers   Customer[]
  inventory   InventoryItem[]
}

model User {
  id            String   @id @default(cuid())
  email         String?  @unique
  emailVerified DateTime?
  phone         String?  @unique
  name          String?
  image         String?
  accounts      Account[]      // Auth.js
  sessions      Session[]      // Auth.js
  memberships   Membership[]
}

model Membership {
  id        String   @id @default(cuid())
  userId    String
  churchId  String
  role      Role     // OWNER | ADMIN | STAFF | COOK | DRIVER | VIEWER
  status    MembershipStatus // INVITED | ACTIVE | SUSPENDED
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  church Church @relation(fields: [churchId], references: [id])

  @@unique([userId, churchId])
}

model Order {
  id           String   @id @default(cuid())
  churchId     String
  customerId   String
  number       Int                // human-friendly per-church sequence
  channel      Channel            // ONLINE | PHONE | IN_PERSON
  fulfillment  FulfillmentType    // PICKUP | DELIVERY | DINE_IN
  status       OrderStatus        // see §8
  subtotal     Int                // cents
  tax          Int
  tip          Int
  total        Int
  notes        String?
  scheduledFor DateTime?
  createdAt    DateTime @default(now())

  items        OrderItem[]
  payments     Payment[]
  events       OrderEvent[]
  delivery     DeliveryInfo?

  church   Church   @relation(fields: [churchId], references: [id])
  customer Customer @relation(fields: [customerId], references: [id])

  @@unique([churchId, number])
}
```

Full schema lives in `packages/db/prisma/schema.prisma`.

### 6.1 Currency model

- Each **Church** picks a single currency at setup (USD, EUR, MXN, GBP, etc.) and all of its orders, payments, refunds, inventory costs, and reports use that currency.
- `currency` is stored on `Church`, and denormalized to `Order` and `Payment` so historical records survive even if a church ever changes its setting (which forces a confirmation flow and only affects future orders).
- All monetary amounts are stored as **integer minor units** (cents, centavos, pence), never floats.
- Display formatting uses `Intl.NumberFormat` with the church's currency code and the user's locale.
- Multi-currency *within* a single church (e.g., one church taking USD and MXN) is **v2**. The column is already in place, so it's an additive change, not a migration.
- Cross-church platform-wide aggregation (the Steward operator viewing totals across all churches) is **v2** and will require stored FX rates.

---

## 7. RBAC

Six roles, additive permissions, scoped to a single church per membership:

| Role | Can do |
|---|---|
| **OWNER** | Everything; manage billing; delete church |
| **ADMIN** | Manage staff, catalogs, settings, refunds, reports |
| **STAFF** | Take orders, mark statuses, view customers, partial refunds |
| **COOK** | Kitchen display, mark items prepared, view notes |
| **DRIVER** | View assigned deliveries, mark out-for-delivery / delivered |
| **VIEWER** | Read-only reporting (e.g. pastor, board) |

Policy lives in `packages/rbac` as a single file of pure functions: `can(user, action, resource)`. Every API route and server action calls it explicitly. **No implicit permissions.**

Example:
```ts
can(currentMembership, "order:refund", order)
can(currentMembership, "catalog:edit", catalog)
```

Every denied attempt is logged with reason. Audit log is its own table, append-only.

---

## 8. Order lifecycle

```
DRAFT → SUBMITTED → CONFIRMED → IN_KITCHEN → READY →
   ├── PICKUP:   AWAITING_PICKUP → PICKED_UP → COMPLETED
   ├── DELIVERY: OUT_FOR_DELIVERY → DELIVERED → COMPLETED
   └── DINE_IN:  SERVED → COMPLETED

Any state → CANCELED (with reason) or REFUNDED (with reason + amount)
```

Every transition writes an `OrderEvent` (who, when, from, to, reason). The customer status page and the staff dashboard both render the same timeline from this log.

---

## 9. Feature breakdown

### 9.1 Order intake
- **Public storefront** at `/c/{church-slug}` — catalog, cart, checkout
- **Phone-order entry** screen for staff: same flow, with quick customer lookup
- **In-person / cash** mode for events: stripped-down tablet UI
- **Scheduled orders** — pick window (event-day batching)
- **Order capacity limits** — cap orders per window so the kitchen doesn't blow up

### 9.2 Order processing (Kitchen Display)
- Big-text, high-contrast view designed for a tablet on the wall
- Cards sorted by scheduled time, then submission time
- One tap to mark item or order ready
- Auto-refresh via SSE (no manual reload)
- Visual indication when an order is approaching its scheduled time

### 9.3 Order tracking
- **Customer**: public order status page accessible by link + last-4-of-phone
- **Staff**: live dashboard with filters by status, channel, fulfillment type
- **Driver**: list of assigned deliveries, address, customer phone, mark statuses

### 9.4 Payments
- **Stripe** primary: card, Apple Pay, Google Pay, Cash App
- **Cash** / **Zelle** / **Pay on pickup**: first-class statuses, not afterthoughts
- **Tips** optional, configurable per church
- **Refunds**: full and partial, with required reason, RBAC-gated
- **Reconciliation report**: daily payouts vs. orders

**Stripe connection — dual mode:**
- **BYO Stripe (OSS default):** each church pastes their Stripe publishable + secret keys into Settings. Keys are encrypted at rest using envelope encryption (deployment-level master key in env or KMS). Each church manages their own Stripe dashboard.
- **Stripe Connect Standard (opt-in for hosted operators):** flip `STRIPE_CONNECT_ENABLED=true` to expose a "Connect with Stripe" OAuth flow. Steward Table never sees keys. Requires the operator to be a registered Stripe platform.
- Either mode: customer funds flow **directly** to the church's Stripe account. Steward Table never holds money — eliminates the money-transmitter compliance question entirely.
- Webhook routing supports both: per-church webhook endpoint URLs for BYO, single endpoint with `account` field for Connect.

**Tax handling — hybrid model:**
- When checkout goes through **Stripe**, use **Stripe Tax** for calculation, jurisdiction logic, and reporting. No manual rate entry needed.
- When payment is **cash / Zelle / pay on pickup / non-Stripe processor**, the church configures **manual tax rates** in Settings → Tax. One or more named rates (e.g., "MD 6% sales tax"), applied per item category or as a flat order-level percentage.
- Items may be marked **tax-exempt** at the catalog level.
- Receipts always show line-item or summarized tax, regardless of which engine calculated it.

### 9.5 Receipts
- Stripe-generated for card payments (free, hosted)
- Steward-generated PDF for cash/Zelle (using @react-pdf/renderer)
- Branded per church (logo, name, EIN or registration number if applicable)
- Auto-emailed; downloadable from customer status page

**Configurable tax-receipt language — per church, toggle, defaults off:**
- **Off (default):** standard sales receipt — no deductibility claims, no charitable language.
- **On → US 501(c)(3) preset:** receipt includes the church's EIN and IRS-compliant *quid-pro-quo* disclosure. For any sale priced above the fair-market value of the goods received, the deductible portion is calculated automatically. Fair-market-value is declared per item once in the catalog; Steward handles the math per order.
- **On → Custom:** church writes its own receipt footer in Markdown (en/es). Intended for international churches, non-US tax frameworks, or any US church that prefers its own wording over the preset.
- Receipt language is **versioned**: changing it does not retroactively rewrite historical receipts.

### 9.6 Customer database
- Per-church scoped (no cross-church leakage — privacy is non-negotiable)
- Dedupe on normalized phone + email
- Fields: name, phone, email, addresses (multiple), notes, tags, allergies/dietary, marketing opt-in
- Customer order history, lifetime value
- CSV export (admin only, audit-logged)

### 9.7 Authentication
- Auth.js with these providers enabled by default:
  - **Credentials** (email + password, bcrypt, optional 2FA via TOTP)
  - **Google**
  - **Apple**
  - **Magic Link** (email)
- Phone OTP via Twilio is a v2 follow-up
- Customers can check out as guest (no account required) but get a magic-link upgrade prompt post-order

### 9.8 Inventory
- Track ingredient or finished-good stock per item or modifier
- Manual adjustments + automatic decrement on order confirmation
- Low-stock threshold alerts
- Stocktake mode: scan-style quick count UI
- Cost of goods captured per stock movement for margin reporting

### 9.9 Reporting & dashboard
- **Today**: live orders, revenue, items sold, kitchen queue depth
- **Sales**: by day/week/month, by item, by channel
- **Costs**: COGS pulled from inventory movements
- **Margins**: per-item and per-event
- **Customer**: new vs. returning, top customers
- **Event mode**: a single "Pupusas Sale June 6" view with everything rolled up
- Export to CSV; print-friendly PDF summaries

### 9.10 Branding per church
- Subdomain-based storefront at `{churchslug}.table.steward.app` (see §18 storefront URL decision)
- Upload logo + choose accent color
- Optional Spanish-default toggle
- Custom receipt footer text (see §9.5 for the full receipt-language model)
- Custom "About this sale" markdown block

### 9.11 SMS notifications (optional, off by default)
- Order-ready and out-for-delivery texts via the configured SMS adapter (Twilio default; pluggable).
- **Opt-in is required**, captured at checkout via a separate **unchecked** checkbox — never pre-checked, never bundled with order submission or marketing consent.
- TCPA-compliant copy, locale-aware:

  > **English:** By checking this box and providing your phone number, you agree to receive transactional SMS messages from {ChurchName} about your order via Steward. Message frequency varies. Message and data rates may apply. Reply HELP for help, STOP to unsubscribe. Consent is not a condition of purchase.

  > **Español:** Al marcar esta casilla y proporcionar su número de teléfono, usted acepta recibir mensajes SMS transaccionales de {ChurchName} sobre su pedido a través de Steward. La frecuencia de los mensajes varía. Pueden aplicarse tarifas por mensajes y datos. Responda HELP para ayuda, STOP para cancelar. El consentimiento no es una condición de la compra.

- **STOP** and **HELP** keywords handled by the SMS adapter; opt-out state stored on the Customer record and respected across future orders, including across churches if the same phone number opts out.
- Every outbound SMS is logged: timestamp, body, delivery status, opt-in proof. Audit table is append-only.

---

## 10. UI/UX rules

1. **No emojis anywhere in product UI.** Lucide icons only.
2. **One accent color per church.** Everything else is neutral.
3. **Typography hierarchy**: 12 / 14 / 16 / 20 / 24 / 32 px. Stop inventing sizes.
4. **Touch targets**: 44px minimum.
5. **Loading states**: skeletons, not spinners, where the layout is known.
6. **Empty states**: always include a single primary action.
7. **Errors**: plain language, no stack traces, with a "what to do next" line.
8. **Confirmation** for destructive actions only. Don't ask "are you sure?" for trivial ones.
9. **Keyboard**: every admin action has a shortcut. Command palette (`⌘K`) is required.
10. **Print**: kitchen tickets and receipts must print cleanly to thermal and letter.

---

## 11. API design

- Server actions for in-app mutations (Next.js)
- Public REST API under `/api/v1/*` for integrations (future webhook recipients, marketing tools)
- All endpoints take a `churchId` either explicitly (admin tools) or implicitly via session
- Idempotency keys required for any payment-affecting POST
- Webhooks out: order.created, order.status_changed, payment.succeeded, payment.refunded
- Webhooks in: Stripe events (signature-verified)

---

## 12. Internationalization

- `packages/i18n` with `en.json` and `es.json` at minimum
- All UI strings keyed; lint rule against bare strings in JSX
- Per-church default locale; per-user override
- Receipts and emails render in the customer's locale

---

## 13. Security & privacy baseline

- Argon2id or bcrypt for credential passwords
- Cookies: httpOnly, sameSite=lax, secure in prod
- CSRF protection on all mutating routes (Auth.js handles most)
- Rate limiting on auth and order submission (Upstash or in-Postgres token bucket)
- PII (phone, email, address) encrypted at rest column-level for customer records
- No customer data leaves the church's tenant — strict row-level filters in every query
- Full audit log: who touched which order/customer/payment, when, from which IP
- Backups: daily Postgres dump for self-host docs; Vercel/Neon handles cloud
- Stripe handles card data — Steward never sees a PAN

### 13.1 Deployment modularity (non-functional requirement)

Steward must run cleanly in two reference configurations from day one, and nothing in the codebase may assume one over the other:

| Concern | Cloud reference | Self-host reference | Abstraction |
|---|---|---|---|
| Hosting | Vercel | Single VPS via Docker Compose | Standard Next.js — no Vercel-specific runtime APIs |
| Database | Neon Postgres | Postgres container | Prisma |
| Storage | Cloudflare R2 | MinIO | S3-compatible API behind storage adapter |
| Email | Resend | SMTP (church-provided) | `packages/notifications` adapter |
| SMS | Twilio | Twilio (or none) | `packages/notifications` adapter |
| Payments | Stripe | Stripe | `packages/payments` adapter |
| Realtime | Postgres LISTEN/NOTIFY → SSE | Same | No Redis dependency |
| Cron jobs | Vercel Cron OR external scheduler hitting `/api/cron/*` | OS cron OR a worker container | Same endpoint contract |

Rule: every external service goes through an interface in `packages/*`. Provider choice is configured by environment variables. A church or operator should be able to switch providers without touching application code.

---

## 14. Phased delivery

**Phase 0 — Foundations (week 1)**
- Repo, CI, lint, format, Prisma, Auth.js, base layout, theming, i18n scaffolding
- Church + User + Membership models, sign-up flow, RBAC engine, audit log table

**Phase 1 — MVP that beats paper (weeks 2–4)**
- Catalog + Items + Modifiers
- Public storefront
- Phone-order entry by staff
- Order lifecycle + kitchen display
- Stripe checkout + cash status
- Customer status page
- Customer database

**Phase 2 — Delivery + receipts (weeks 5–6)**
- Delivery zones, driver role, driver view
- Receipt PDF generation, email sending
- Refunds with audit

**Phase 3 — Inventory + reporting (weeks 7–8)**
- Inventory model, stock movements, low-stock alerts
- Reporting dashboard, CSV exports

**Phase 4 — Polish + multi-tenant ops (weeks 9–10)**
- Per-church branding, subdomain support
- Self-host docs + docker-compose
- Public website + open-source launch

This is aggressive on purpose. Cut scope, never quality.

---

## 15. Open-source posture

- **License: AGPL-3.0.** Forces SaaS forks to share improvements back. If a more permissive feel is preferred long-term, dual-license with a commercial option later — but start protective.
- **CONTRIBUTING.md** with conventional commits, PR template, code-of-conduct (Contributor Covenant 2.1).
- **Issues** labeled `good-first-issue` from week one to attract contributors.
- **CHANGELOG.md** maintained with Changesets.
- **Security policy** with a private disclosure email.
- **Trademark**: "Steward" wordmark and logo reserved; forks may use the code, not the brand.

---

## 16. Pre-build dependencies (Phase 0 — resolve before §17 step 1)

The codebase can't move forward usefully until a handful of things outside the codebase are decided or stood up. None are huge individually, but a couple have real-world wait times (especially **10DLC SMS registration**) and one — the **Steward brand-family architecture** — affects how the monorepo is organized. Tackle this section first.

### 16.1 Critical decisions (must resolve before scaffolding)

| Decision | Default if not specified now | Why it matters early |
|---|---|---|
| **Steward family architecture** — is this app *Steward* (standalone) or a sibling of *stewardChMs* under a Steward umbrella? | Treat as standalone, extract shared packages later | Determines whether `packages/ui`, `packages/auth`, and the `Church` model live in this repo or in a shared `@steward/*` workspace |
| **App's own product name** if Steward is an umbrella | Working title: *Steward Orders* | Package names, default email sender identity, README, marketing copy all reference it |
| **Stripe model** — platform-level Stripe Connect, or **each church brings their own Stripe key (BYO)** | **BYO Stripe** — strongly recommended | Stripe Connect makes Steward a money-handling platform (heavy compliance, possible money-transmitter scrutiny). BYO keeps funds flowing **directly** from customer to church — Steward never touches the money |
| **Legal entity holding the project** | Personal copyright until a hosted version exists | Which of Vera Lumen Group, 24 Industries, or a new entity owns the repo, brand, and any hosted deploy. Affects `CONTRIBUTING.md` attribution and any future trademark filing |
| **License — reconfirm AGPL-3.0** | AGPL-3.0 (per §15) | First commit pins this; switching later requires every contributor's agreement |

### 16.2 External accounts to provision (do in parallel)

| Account | Cost | Lead time | Used for |
|---|---|---|---|
| GitHub organization | Free | minutes | Repo + open source presence |
| Domain (e.g. `steward.app`, `getsteward.com`, `usesteward.com`) | ~$10–50/yr | minutes | Storefront subdomains, email sender |
| Google Cloud project + OAuth client | Free | minutes | Google sign-in provider |
| Apple Developer (optional in v1) | $99/yr | 24–48h | Sign in with Apple |
| Stripe (test mode) | Free | minutes | Payments in dev. Each church provisions their own for production |
| Twilio | Free trial | minutes | SMS adapter |
| **10DLC brand + campaign registration (Twilio / The Campaign Registry)** | ~$50 one-time + ~$10/mo | **1–2 weeks** | **Required** for TCPA-compliant US SMS at any meaningful volume. **Start this the same day you create the Twilio account** — it's the longest pole in the tent |
| Resend (or SMTP) | Free tier | minutes | Transactional email |
| Cloudflare | Free | minutes | DNS + R2 storage (cloud reference deploy) |
| Neon Postgres | Free tier | minutes | Cloud reference deploy |
| Sentry (optional) | Free tier | minutes | Error tracking |

### 16.3 Email deliverability (do once domain exists)

- Sending subdomain (e.g. `mail.steward.app`)
- **SPF, DKIM, DMARC** records — Resend provides exact values; DMARC starts at `p=none` for monitoring, then tightens to `quarantine` then `reject`
- Plain-text fallback for every transactional email
- Bounce + complaint webhook handling

### 16.4 Legal & policy scaffolding (lightweight v1)

- **Privacy Policy** — what's collected, why, who sees it, retention
- **Terms of Service** for any hosted version (skip if pure OSS until first hosted deploy)
- `SECURITY.md` with a private disclosure email
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
- `LICENSE` (AGPL-3.0)
- **Trademark posture:** common-law *Steward™* on the wordmark is fine until product traction warrants a USPTO filing. *Steward* is a common word, so a registration won't be straightforward — defer that fight

### 16.5 Reference-church partnership

- **Iglesia Alfa y Omega AD** is the natural first design partner — the use case is already in hand
- Capture the real-world inputs that should drive v1: actual catalog (pupusas, sides, drinks), pricing, fair-market values for any quid-pro-quo math, delivery zones in Bowie / Beltsville / Laurel, who plays which role (admin / staff / cook / driver), tax setup
- These become the seed data — v1 ships ready to run for them on day one

### 16.6 What Claude Code can do vs. what Emerson must do

| Claude Code can do | Emerson must do |
|---|---|
| Scaffold `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md` | Create the GitHub organization |
| Draft Privacy Policy and ToS templates | Sign up for Stripe, Twilio, Google Cloud, Apple Developer |
| Configure CI/CD workflows | Register the domain and configure DNS |
| Build `.env.example` with every variable Steward needs | **Submit 10DLC brand registration** |
| Stand up the `packages/*` skeleton | Make the §16.1 architecture calls |
| Write seed data shaped like Iglesia Alfa y Omega's real operation | Coordinate with Iglesia Alfa y Omega as design partner |

### 16.7 Suggested resolution order

1. **This week — decisions:** make the §16.1 calls (brand-family architecture, Stripe model, legal entity, license). Doesn't have to be perfect; commit and move.
2. **This week — long-tail signups:** register the domain, create the GitHub org, sign up for Twilio, **submit the 10DLC brand registration**. Everything else can wait until needed.
3. **This week — partnership:** brief conversation with Iglesia Alfa y Omega about being the v1 design partner and contributing their real operational data as seed input.
4. **Once domain exists:** email deliverability (SPF/DKIM/DMARC).
5. **Then:** proceed to §17 Claude Code kickoff checklist.

---

## 17. Claude Code kickoff checklist

Run these in order **after §16 is resolved**. Each step should be a small, reviewable Claude Code session.

1. **Bootstrap** — `pnpm create next-app`, TS strict, Tailwind, Biome, Vitest, Playwright wired into CI
2. **Add Prisma + Postgres**, run with Docker Compose locally
3. **Implement schema from §6**, write seed script with one demo church + demo catalog
4. **Add Auth.js** with Credentials + Google + Magic Link; build sign-in, sign-up, accept-invite flows
5. **Build `packages/rbac`** with unit tests covering each role × each action
6. **Build the public storefront** (`/c/{slug}`) with catalog browsing and cart (no checkout yet)
7. **Stripe integration** behind the `packages/payments` interface; checkout + webhook handler
8. **Phone-order entry screen** for staff with customer lookup
9. **Kitchen display** with SSE updates
10. **Customer status page** with timeline
11. **Driver view + delivery flow**
12. **Receipt PDF service**
13. **Inventory module**
14. **Reporting dashboard**
15. **Per-church branding + subdomains**
16. **Self-host Docker Compose + DEPLOY docs**
17. **Public site + AGPL-3.0 launch**

For each, give Claude Code: the file paths it may touch, the acceptance criteria, and the tests it must add. Resist the urge to give it open-ended "build the kitchen display" prompts — scope every session.

---

## 18. Decisions log

- [x] **§16.1 Family architecture — Steward is a family.** This app is one of several Steward-family apps (alongside *stewardChMs*). Shared UI, auth, and the Church record live in `@steward/*` packages designed for cross-app reuse from day one. Repository structure (§5) will be updated once the repo-strategy decision is made.
- [x] **§16.1 Repo strategy — polyrepo.** Each Steward app lives in its own repo. Shared code lives in a dedicated `steward-shared` (working title) repo and is consumed as published `@steward/*` packages. Registry target (public npm vs. GitHub Packages vs. JSR) is a downstream decision, not a blocker. Local cross-repo dev uses `pnpm link`, documented in `CONTRIBUTING.md`.
- [x] **§16.1 App name — Steward Table.** Repo slug `steward-table`, README headline, default email sender, marketing copy all derive from this. Carries biblical/hospitality resonance (the table as sacred fellowship space) and translates cleanly to *mesa* for the Spanish-language ministry context.
- [x] **§16.1 Stripe payment model — both, BYO default + Connect opt-in.** OSS reference implementation uses literal BYO (church pastes Stripe keys, encrypted at rest via envelope encryption + deployment master key). Hosted deployments can flip `STRIPE_CONNECT_ENABLED=true` to expose Stripe Connect Standard OAuth onboarding instead — better UX, no key storage, but requires the operator to register as a Stripe platform. **Either mode, funds flow directly from customer to the church's Stripe account; Steward Table never holds money** — which eliminates the money-transmitter compliance question entirely. Adapter in `lib/payments/`. Webhook routing handles both modes.
- [x] **§16.1 Legal entity — new entity dedicated to the Steward family.** A new LLC will be formed to hold Steward Table, stewardChMs, and future Steward apps along with the family's trademarks. Working name TBD (e.g., *Steward Software LLC*, *Steward Labs LLC*). Entity formation is a parallel Phase 0 task — Structum Consulting handles this routinely. Open follow-up: whether to wait for entity formation before first commit, or commit under personal copyright with planned IP assignment to the entity once formed.
- [x] **§16.1 License — dual: AGPL-3.0 + commercial.** OSS path under AGPL-3.0 (strong copyleft, hosted forks must share back). A reserved commercial license is available for orgs that don't want AGPL obligations. **Implication:** all copyright must rest with the new Steward entity for relicensing to be possible — every external contributor signs a CLA (via `cla-assistant.io` or similar) that grants the entity full relicensing rights. `LICENSE` carries AGPL-3.0 text; `COMMERCIAL_LICENSE.md` holds the commercial terms. SPDX header in every file: `AGPL-3.0-or-later OR LicenseRef-Steward-Commercial-1.0`. The shared `steward-shared` repo and all `@steward/*` packages carry the same dual-license posture so relicensing composes cleanly across the stack.
- [x] **§16.1 Commit timing — personal copyright now, assign to entity later.** First commits land under "Copyright (c) 2026 Emerson Ramos." External PRs are disabled in repo settings until the Steward entity exists and CLA infrastructure is live. Once the entity is formed, a one-page IP assignment moves all copyright over, LICENSE is updated, and the CLA bot activates.
- [x] **§16.2 Domain structure — one family apex, apps as subdomains.** Steward Table at `table.steward.{tld}`, stewardChMs at `chms.steward.{tld}`, marketing at `steward.{tld}`, transactional email from `mail.steward.{tld}`. **Apex candidates to verify and acquire, in preference order:** `steward.app` (HTTPS-enforced, modern, fits a multi-app family), `steward.church` (perfect audience fit if `.app` is taken), `steward.io` (tech-default), `getsteward.com` / `trysteward.com` (SaaS-style fallbacks). Emerson to check availability at a registrar and purchase as a Phase 0 task. Customer-storefront URL pattern (path-based `table.steward.app/c/{slug}` vs. subdomain-based `{slug}.steward.app`) is a downstream UX call and not blocking.
- [x] **§5.3 Cross-app DB strategy — deferred.** Steward Table v1 ships with its own self-contained Postgres database. `Church` / `User` / `Membership` live in the Steward Table schema. The cross-app sharing question (shared DB vs. API sync vs. dedicated identity service) is revisited when stewardChMs is actually being built — at which point the choice can be informed by what stewardChMs really needs rather than guesses now.
- [x] **§5.3 Repo split scope — polyrepo confirmed, minimal `steward-shared`.** Two repos exist from day one. `steward-shared` contains only `@steward/ui` (design system, primitives, brand tokens) and `@steward/icons` (Lucide presets + Steward marks). Everything else (auth, RBAC, i18n, notifications, the Church/User/Membership schema) lives inside `steward-table/lib/*` and `steward-table/prisma/` for v1, with `docs/EXTRACTION_PLAN.md` tracking intended boundaries. When stewardChMs starts, those folders graduate to `@steward/*` packages driven by real second-consumer needs. Registry target for the initial two packages defaults to public npm.
- [x] **§16.2 Storefront URL pattern — subdomain under app.** Customer storefronts live at `{churchslug}.table.steward.app`. Clean three-tier separation: family apex (`steward.app`) hosts marketing; app subdomains (`table.steward.app`, `chms.steward.app`) host each app's admin dashboard; storefront subdomains (`{slug}.table.steward.app`) host per-church customer ordering. **Implementation:** wildcard SSL for `*.table.steward.app` via Let's Encrypt DNS-01, wildcard DNS, Next.js middleware reads the `Host` header and rewrites to a storefront route. Reserved-names list at the app-subdomain level is minimal — just `www` and `admin`.
- [x] **§16.2 GitHub location — personal account now, migrate to Steward org later.** `steward-table` and `steward-shared` start at `github.com/{personal-username}/...`. When the Steward entity exists and the Steward family org is created, both repos transfer in one click (GitHub auto-redirects clones). Migration touches: org transfer, `package.json` repository URLs, CLA bot target, README badges, deploy webhook URLs. README notes the pending migration so contributors aren't surprised.
- [x] **§16.3 Email sender structure — hybrid (platform default + BYO domain upgrade).** Default: emails arrive as `Church Name <orders@table.steward.app>` — church-controlled display name, platform sending domain. SPF/DKIM/DMARC configured once on the family apex; churches need zero email setup to receive value. **BYO upgrade in church Settings → Email:** Steward Table generates the required DNS records, the church adds them to their domain, the email provider's domain API (Resend supports this natively) verifies. Once verified, that church's emails send from `orders@theirchurch.org`. Reply-To always points at a church-configurable contact address regardless of mode, so customer replies reach the church. Bounce/complaint webhooks are scoped per sending domain. Lives in `lib/notifications/email/`.
- [x] **§16.5 Seed data shape — realistic operational history.** Default seed models Iglesia Alfa y Omega AD with 6 months of sales activity: multiple past catalogs, dozens of orders in completed/refunded states, a populated customer database, reporting data developers can actually interact with. Real menu (revueltas/queso/frijol/chicharrón pupusas, curtido, atoles, drinks), real pricing, real delivery zones (Bowie/Beltsville/Laurel/Greenbelt/College Park), real staff role distribution — all coordinated with IAYO. **Customer PII is synthesized, never copied** — a faker library with Spanish-locale weighting generates realistically-shaped names/phones/addresses. Additional seed scripts: `pnpm seed:fresh` (empty church), `pnpm seed:active` (one current sale, kitchen-display testing), `pnpm seed:multi` (multiple churches, tenant-isolation testing).
- [x] **§16.4 CI quality bar — standard gates + auto-merge.** PRs auto-merge once all required checks pass. Gates: Biome lint + format check, TypeScript strict typecheck (`tsc --noEmit`), Vitest unit + integration tests, Playwright smoke e2e, Prisma schema validation, Next.js build check. **Branch protection on `main`:** required status checks, linear history (squash-and-merge only), auto-delete head branches after merge, no direct pushes. **Dependency automation:** Renovate (or Dependabot) configured for auto-merge on green for patch + minor bumps; major bumps require manual review. Coverage is tracked but not threshold-gated initially; revisit once the codebase has shape.
- [x] **§16.4 Release workflow — conventional commits + Changesets + automated release.** Every PR adds a `.changeset/*.md` file describing the change (Changeset bot nags if missing). Merging to `main` triggers Changesets to open a "Version Packages" PR; merging that PR auto-tags, updates `CHANGELOG.md`, publishes `@steward/*` packages to npm, and triggers the production deploy. Both repos start at `0.1.0` (pre-1.0 signals "v1 surface still being defined") and reach `1.0.0` when §19's definition of done is met. **PR titles enforced as conventional commits** by `amannn/action-semantic-pull-request` since squash-merge promotes the PR title to the commit on `main`. Commit types follow the standard set (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `build`, `ci`, `revert`); breaking changes use `!` or `BREAKING CHANGE:` footer.
- [x] **§12 / §16 i18n scope for v1.0 — fully bilingual, native-reviewed.** Every UI string, transactional email, receipt PDF, SMS template, status page, error message, and empty state ships in English and Spanish at v1.0. **Workflow:** English in `lib/i18n/locales/en.json` is canonical; Spanish in `lib/i18n/locales/es.json` matches it key-for-key (CI gate enforces parity). LLM first-pass acceptable only when followed by IAYO native-speaker review before merge. Biome lint rule rejects bare strings in JSX. Per-customer locale stored on the Customer record, defaulting to the church's locale; customer can override at checkout. Receipts, emails, SMS, and status pages render in the customer's stored locale. **Coordination:** identify 1–2 IAYO volunteers willing to review Spanish translations during the build as part of the design-partner relationship. **Timeline:** translation + review adds ~1–2 weeks to v1 critical path, parallelizable with development if strings are extracted continuously rather than at the end. To reflect in §14: translation work is a Phase 1–3 deliverable, not a Phase 4 polish item.

### Schema design decisions (begun §17)

- [x] **Catalog mutability — always mutable, OrderItem snapshots at order creation.** Catalogs and Items remain editable forever. Each `OrderItem` captures denormalized snapshot fields at order time: `itemName`, `unitPrice`, `currency`, plus a JSONB `modifierSnapshot` of every selected modifier with its name and price at the moment of sale. `OrderItem.itemId` is a nullable FK for reporting joins; the snapshot fields are canonical for receipt rendering, refund math, and historical reporting. Standard restaurant-POS pattern (Square, Toast both do this).
- [x] **Item reuse — Items are church-level templates, Catalogs reference via `CatalogItem` junction.** `Item` lives at the Church level with `defaultPrice` and canonical attributes. `Catalog` is a curated event (status: DRAFT / OPEN / CLOSED / ARCHIVED, optional open/close window). `CatalogItem` junction carries per-catalog levers: `priceOverride` (null = use default), `isAvailable` (sold out today vs. removed), `sortOrder`, and `maxQuantityPerOrder` (per-order capacity cap to protect the kitchen). Storefront effective price is `priceOverride ?? Item.defaultPrice`; OrderItem snapshots the effective value at sale time. Matches how restaurants actually think about menus.
- [x] **Modifier rules — hybrid (defaults on Group, overrides on junction).** `ModifierGroup` carries `defaultMinSelections`, `defaultMaxSelections`, `defaultIsRequired`. `ItemModifierGroup` junction carries nullable `overrideMin`, `overrideMax`, `overrideIsRequired`. Effective rules resolved as `override ?? default` via a single helper used by both the storefront and admin UIs. Lets one ModifierGroup ("Pupusa Filling") serve both regular pupusas (pick 1) and combo items (pick 2) without duplicating the group.
- [x] **Soft-delete policy — selective + immutable history.** Soft-delete (`deletedAt DateTime?` + index) on user-editable entities: Church, User, Customer, Address, Catalog, CatalogItem, Item, ItemPhoto, ModifierGroup, ModifierOption, ItemModifierGroup, InventoryItem, DeliveryZone, ApiKey, SubdomainReservation, ChurchSettings. **Status-enum instead** where "delete" is really a state change: `Membership.status` (ACTIVE / SUSPENDED / REMOVED), `Invitation.status` (PENDING / ACCEPTED / EXPIRED / REVOKED). **Immutable / hard-delete only** for transactional and audit history: Order, OrderItem, OrderItemModifier, OrderEvent, Payment, Refund, DeliveryInfo, DriverAssignment, StockMovement, AuditLog, WebhookEvent, EmailLog, SmsLog, Notification, Account, Session, VerificationToken. Prisma middleware auto-filters `deletedAt IS NULL` on soft-deletable reads; admin "trash" views opt-in via `withDeleted: true`. Missing the filter is the canonical soft-delete bug — middleware enforces correctness by default.
- [x] **Inventory granularity — finished goods (Item-level).** `InventoryItem` is 1:1 with `Item`, carrying `quantityOnHand`, optional `lowStockThreshold`, and `trackingEnabled` flag (some items like napkins skip tracking). `StockMovement` records every change (kind: RESTOCK / ORDER_DECREMENT / REFUND_INCREMENT / MANUAL_ADJUSTMENT / STOCKTAKE / SHRINKAGE), with `delta`, `reason`, and optional `orderId` / `actorId`. Modifiers are pricing-only in v1, no inventory effect. Recipe-based ingredient decrementing is v2 when a church says "I want to see how much masa we go through per month."

### RBAC design (begun §17)

- [x] **Multi-role per membership — `Membership.roles Role[]`.** A single volunteer can hold multiple roles at the same church (the cook who also drives between rushes, the admin who also cooks). `Membership.roles` is a Postgres enum array; `Membership.role` (singular) is gone. `can()` resolves positive if **any** of the user's roles grants the requested action. Query pattern for "who has role X here": `where: { churchId, status: ACTIVE, roles: { has: 'COOK' } }`. Schema updated in `schema.prisma`.
- [x] **Permission granularity — hybrid (coarse actions + context-aware `can()`).** ~25 coarse action names (`order.refund`, `catalog.edit`, `customer.export`, etc.) gate every protected operation. Nuance handled in the `can(membership, action, resource?)` function rather than the action names: refund caps by role, "DRIVER can only update deliveries they're assigned to," "STAFF can mark any order ready but only edit orders they took" — all encoded as resource-aware logic, not as separate action names. The matrix stays scannable for security audit; the resource-aware logic lives in one tested place (`lib/rbac/`). This also satisfies the resource-attribute-check dimension implicitly — the resource arg is the mechanism.
- [x] **Role inheritance — admin chain + sibling specialized.** OWNER ⊇ ADMIN ⊇ STAFF form an inheritance chain (escalation): higher roles automatically have all the permissions of the role below them in the chain. **COOK, DRIVER, VIEWER are independent specialized roles** outside the chain — they have their own purpose-built permission sets and don't inherit from each other or from the admin chain. An OWNER who wants to operate the kitchen display or do deliveries adds COOK or DRIVER to their roles array (per the multi-role decision); the system doesn't pretend OWNER inherits these automatically. Full matrix in `RBAC_MATRIX.md`.

### Order lifecycle state machine (begun §17)

- [x] **Customer self-cancel — yes, configurable per church.** `ChurchSettings.customerSelfCancelWindowMinutes` (default 5; value 0 disables). Customer status page renders the cancel button only when within the window AND `Order.status` has not reached CONFIRMED. After cancellation, inventory restocks automatically and any captured payment is refunded. Beyond the window, cancellation requires staff intervention via `order.cancel`.
- [x] **No-show pickup timeout — configurable per church, 2-hour default.** `ChurchSettings.noShowTimeoutHours Int @default(2)`; value 0 disables auto-timeout. A scheduled job (`/api/cron/no-show-sweep`, every 15 minutes per §13.1 cron mechanism) sweeps orders in `AWAITING_PICKUP` past their threshold (relative to `scheduledFor ?? createdAt`), transitions them to CANCELED with reason `no_show`, restocks inventory (food is still there for late walk-ins), and sends a courtesy notification to the customer. Staff still see the canceled order in the day's history.
- [x] **Scheduled-order activation — configurable per church, IMMEDIATE default.** `ChurchSettings.kitchenDisplayMode KitchenDisplayMode @default(IMMEDIATE)` (values `IMMEDIATE | JUST_IN_TIME`); paired `ChurchSettings.prepLeadTimeMinutes Int @default(30)` used by JIT mode. IMMEDIATE: all CONFIRMED orders appear on the kitchen display sorted by `scheduledFor ?? createdAt` with urgency colors (red ≤10 min, amber ≤1h, neutral beyond). JIT: an order appears only when `(scheduledFor - prepLeadTimeMinutes) ≤ now`, otherwise stays in CONFIRMED state hidden from the kitchen display. Full spec in `STATE_MACHINE.md`.

### Kitchen display (begun §17)

- [x] **Multi-station — single-station v1, design seams for v2.** Each church runs one kitchen display in v1. `Item.station String?` nullable column reserved on Item (ignored by v1 kitchen-display query, which filters as if station were always-null-or-matching). v2 introduces a `Station` model, station picker on the display, station tagging in catalog admin — all additive, no migration. Cheap-insurance pattern consistent with prior schema decisions.
- [x] **Ready granularity — order-level only.** A single "Ready" tap per order card transitions the whole order to READY. No item-level checkboxes in v1. Aligns with §1.1 "the cook is the most important user" — fewer taps, flour-covered fingers, rubber gloves friendly. For typical church-sale order sizes (1–3 items) this is not a real limitation. Item-level progress is a v2 feature if real cooks ask for it.

### Catalog / modifier admin UX (begun §17)

- [x] **Information architecture — hybrid (library + in-context creation).** Top-level admin pages exist for the libraries: `/admin/items`, `/admin/modifier-groups`, `/admin/catalogs`. Admins use these for hygiene work (rename items, adjust default prices, edit modifier options globally). The Catalog editor surfaces in-context creation: "Add Item" from within a catalog lets the admin either pick from the existing library or create a new item right there — the new item is added to the library AND attached to the catalog atomically. Same dual-path for modifier groups. Matches how mature POS systems (Square, Toast) handle the library-vs-event-workflow tension. Full spec in `CATALOG_ADMIN.md`.
- [x] **Bilingual editing — tabbed EN / ES per form.** Every form with translatable fields renders a language tab control at the top; one locale at a time is visible. Switching tabs preserves unsaved state. **Visual completion indicators:** yellow dot on the ES tab when any ES field is missing or empty; a "X items missing Spanish translations" badge surfaces on the catalog and item-library views. **Save is never blocked** by incomplete translations — volunteers shouldn't lose work. The catalog's DRAFT → OPEN transition warns about missing translations but doesn't hard-block (a church might temporarily run an EN-only sale and intentionally publish without ES). Native-speaker review workflow per §18 still applies for any text that ships to customers.
- [x] **Catalog creation — blank + clone-from-previous + curated template library.** Three entry points in the "Create Catalog" flow: start blank, clone any prior catalog (duplicates `CatalogItem` rows with their overrides, sort orders, capacity caps; new slug + dates), or pick from Steward-curated templates. **v1 ships four templates** in `lib/catalog-templates/` as TypeScript modules: **Pupusa Sale** (IAYO-shaped, native-reviewed Spanish), **Bake Sale**, **Coffee Hour**, **Fundraiser Dinner** — each fully bilingual. Selecting a template materializes its items, modifier groups, and options as church-scoped DB records, then opens the catalog editor on the newly-created catalog. Templates are PR-updatable (and community-contributable later).

### Customer storefront (begun §17)

- [x] **Authentication — hybrid (guest checkout + post-order magic-link upgrade).** Customers order without creating an account; contact info (name, phone, optional email) is captured at checkout. Steward Table dedupes by normalized phone/email per the Customer model. After successful order placement, the confirmation page invites: "Want to track this order and save your info for next time? We'll text you a link." Single tap → magic link → User account created and linked to the existing Customer record. **SMS opt-in is captured in the same moment** with the TCPA copy from §9.11 — high-quality opt-in moment because the customer just had a positive ordering experience.
- [x] **Cart pattern — sticky bottom bar expanding to bottom-sheet drawer.** When cart has items, a slim bar pins to the bottom of every storefront screen: "View cart · 3 items · $12.00" rendered in the church's accent color, currency formatted per `Intl.NumberFormat` from `Church.currency`. Tap reveals a full-height bottom-sheet drawer with the line items and "Checkout" CTA. Bar disappears when cart is empty. Mobile-native pattern (matches DoorDash, Uber Eats); scales correctly to desktop with the bar still pinning to the bottom.
- [x] **Modifier selection UX — bottom-sheet drawer.** Tap an item card → bottom-sheet drawer slides up (full-screen on phone, modal on desktop) showing item photo, description, modifier groups with required/optional rules surfaced, quantity stepper, "Add to cart" CTA. Catalog browse state preserved when the sheet closes. Food-app native — what customers expect from ordering apps. Full storefront spec in `CUSTOMER_STOREFRONT.md`.

### Driver view (begun §17)

- [x] **Delivery assignment — hybrid (admin pre-assign + driver self-claim).** When an order goes READY with `fulfillment = DELIVERY`, it enters one of two paths: (a) admin pre-assigns via the orders dashboard (sets `DeliveryInfo.driverId`), and the order appears in that driver's personal queue, OR (b) admin leaves it unassigned, and any active DRIVER membership sees it in a shared "Available" pool that they can claim with a single tap. Self-claim handled by row lock + first-claim-wins. Gives admins control when they want it (regular driver for a known route) without bottlenecking on them when they don't. Full driver view spec in `DRIVER_VIEW.md`.

- [~] **Brand: accent color + logo direction.** *Deferred.* Will inherit from existing **stewardChMs** brand work (or be pulled from the relevant Steward repo on GitHub) once UI work starts. Until then, use neutral slate-on-white with a single placeholder accent so screens stay buildable and theming is trivial to swap.
- [x] **Tax handling — hybrid.** Stripe Tax when Stripe is the processor; per-church manual tax rules for cash / Zelle / non-Stripe payments. Items can be tax-exempt at the catalog level. See §9.4.
- [x] **Donation / tithe line — out of scope.** Steward is for event-based sales (food, goods, ticketed dinners), not for collecting tithes or general donations. Churches keep their existing giving platform for that. The one nuance: *quid-pro-quo* sales (price above fair-market value, with the difference deductible) are supported through the receipt-language toggle in §9.5, not as a separate donation line at checkout.
- [x] **Tax-receipt language — configurable toggle per church.** Defaults off (plain sales receipt). Options: US 501(c)(3) preset with IRS-compliant disclosure and auto-calculated deductible portion, or custom Markdown footer for international churches and any church that prefers its own wording. Versioned so historical receipts don't get rewritten. See §9.5.
- [x] **SMS opt-in — TCPA-compliant template added.** Unchecked checkbox at checkout, en/es copy, STOP / HELP handling, audit log, opt-out portable across churches. See §9.11.
- [x] **Hosting — modular by design, two reference paths.** No vendor lock-in. Cloud reference: Vercel + Neon + Resend + Stripe + Cloudflare R2. Self-host reference: Docker Compose with Postgres + MinIO + SMTP + Stripe, runnable on a single VPS. All providers swappable via adapter interfaces. See §13.1.
- [x] **Multi-currency — single currency per church in v1.** Each church picks one currency at setup; all their orders, payments, costs, and reports use that currency. The `currency` column exists at the data layer from day one, so v2 multi-currency *within* a church is additive. Cross-church FX aggregation is v2. **Effort delta vs hardcoded-USD in v1: roughly 2–3 days of Claude Code work** — schema columns, `Intl.NumberFormat` plumbing, settings UI, Stripe currency wiring. Cheap insurance against a painful future migration. See §6.1.

---

## 19. What "done" looks like for v1.0

A church can:
1. Sign up, brand their storefront, invite staff with appropriate roles
2. Build a catalog for an upcoming sale in under 15 minutes
3. Take orders online, by phone, and in person — all into one queue
4. Run the kitchen from a tablet with no paper
5. Dispatch deliveries with route-aware ordering
6. Collect card, cash, and Zelle payments with clean receipts
7. Close the event with a one-page financial summary
8. Re-run it next month in half the time

When that loop works for two real churches without hand-holding, v1.0 ships.
