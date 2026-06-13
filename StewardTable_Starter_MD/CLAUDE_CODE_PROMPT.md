# Steward Table — Claude Code Scaffolding Prompt

Use this as your starting prompt in Claude Code after cloning `https://github.com/24Skater/steward-table`.

---

## The prompt

You are scaffolding **Steward Table** — an open-source, multi-tenant order management and fulfillment platform built for churches and ministry-led food sales. This is a production-quality application, not a prototype. Every file you create should be ready for a real codebase.

The full project plan, schema, RBAC matrix, state machine, and UX specs are attached below. Read them completely before writing any code. Do not improvise decisions that have already been made.

---

### What to scaffold

Produce the complete project skeleton for `steward-table`. This means:

1. **Initialize the Next.js 15 app** with App Router, TypeScript strict mode, Tailwind CSS, and pnpm. Use `create-next-app` conventions.

2. **Install all dependencies** from the tech stack below. Do not skip any.

3. **Create the full directory structure** exactly as specified in §5.1 of the plan. Every folder should exist with at minimum a placeholder file (`.gitkeep` or a stub module) so the intended architecture is visible.

4. **Write `prisma/schema.prisma`** in full — the complete 36-model schema is provided below. Split it into per-domain files using the `prismaSchemaFolder` preview feature:
   - `prisma/schema/auth.prisma` — Account, Session, VerificationToken
   - `prisma/schema/identity.prisma` — User
   - `prisma/schema/tenancy.prisma` — Church, ChurchSettings, Membership, Invitation, Location
   - `prisma/schema/catalog.prisma` — Catalog, CatalogItem, Item, ModifierGroup, ModifierOption, ItemModifierGroup
   - `prisma/schema/orders.prisma` — Order, OrderItem, OrderEvent, OrderCounter, Payment, Refund
   - `prisma/schema/customers.prisma` — Customer, CustomerNote, CustomerTag
   - `prisma/schema/delivery.prisma` — DeliveryZone, DeliveryInfo
   - `prisma/schema/inventory.prisma` — InventoryItem, StockMovement
   - `prisma/schema/ops.prisma` — AuditLog, WebhookEvent, EmailLog, SmsLog, Notification
   - `prisma/schema/enums.prisma` — all enums
   - `prisma/schema.prisma` — datasource + generator only (references above files)

5. **Scaffold `lib/rbac/can.ts`** — the full `can()` function with the Action type union, CanContext interface, and the resolution algorithm. Include the admin-chain inheritance expansion and all context-aware conditional rules from the RBAC matrix. Wire in `AuditLog` writes on every deny. Include the full test file at `tests/unit/rbac/can.test.ts` with at least one positive and one negative test per matrix cell.

6. **Scaffold `lib/orders/transitions.ts`** — the `transition()` function with the full transition table. Every valid `(from → to)` edge. Invalid transitions throw `InvalidTransitionError`. Every successful transition writes an `OrderEvent` in the same Prisma transaction. Side effects (notifications, inventory moves) are declared as a typed list and queued post-commit via a `SideEffectQueue` interface (stub the queue; mark with TODO for implementation).

7. **Scaffold Auth.js (NextAuth v5)** in `lib/auth/` with:
   - Providers: Credentials, Google, Magic Link (email)
   - Session strategy: database
   - Callbacks: attach `Membership[]` context after sign-in, resolve active church from session
   - Route handler at `app/auth/[...nextauth]/route.ts`

8. **Scaffold the Prisma client singleton** at `lib/db.ts` with:
   - The soft-delete middleware (auto-filters `deletedAt IS NULL` on reads; `withDeleted` opt-in)
   - The churchId-scope enforcement middleware (rejects unscoped queries on tenanted models)
   - Standard singleton pattern for Next.js (avoid hot-reload connection leaks)

9. **Scaffold the App Router route groups** with stub layouts and pages:
   - `app/(marketing)/` — public landing page stub
   - `app/(storefront)/[churchSlug]/` — per-church storefront with middleware that resolves Church from subdomain/slug
   - `app/(dashboard)/` — authenticated shell with sidebar nav stub; nested route groups for `/orders`, `/kitchen`, `/catalog`, `/customers`, `/inventory`, `/drivers`, `/settings`, `/reports`
   - `app/api/` — route handler stubs for: `orders`, `catalog`, `customers`, `inventory`, `payments/stripe/webhook`, `cron/no-show-sweep`, `sse/kitchen`, `sse/orders`

10. **Scaffold the Next.js middleware** at `middleware.ts`:
    - Reads `Host` header to resolve church slug from subdomain (`{slug}.table.steward.app`)
    - Rewrites storefront routes
    - Resolves active Membership for the current user + church; attaches to request headers for downstream use
    - Returns 404 (not 403) if user has no active Membership for the resolved church (see RBAC §6)

11. **Write `lib/payments/`** with:
    - `adapter.ts` — `PaymentAdapter` interface with methods: `createPaymentIntent`, `capturePayment`, `refund`, `constructWebhookEvent`
    - `stripe-byo.ts` — BYO Stripe adapter (reads church's encrypted keys)
    - `stripe-connect.ts` — Stripe Connect adapter stub (TODO marker)
    - `index.ts` — factory that returns the correct adapter based on `ChurchSettings.stripeMode`

12. **Write `.env.example`** with every environment variable the app needs, grouped and commented. Include: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `STRIPE_WEBHOOK_SECRET`, `ENCRYPTION_KEY` (for BYO Stripe key encryption), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_APP_URL`.

13. **Write `docker/docker-compose.yml`** for local development: Postgres 16, the Next.js app, and a MinIO instance for S3-compatible storage. Include health checks and volume mounts.

14. **Write `docs/EXTRACTION_PLAN.md`** — a document that maps each `lib/*` folder to its intended future `@steward/*` package, the trigger condition for extraction (i.e., "when stewardChMs needs it"), and what the extraction would involve.

15. **Write a production-quality `README.md`** that covers: what Steward Table is, who it's for, the v1 feature set, self-host quickstart (Docker Compose), Vercel deploy button placeholder, tech stack table, RBAC summary, contributing guide pointer, and license (AGPL-3.0 + commercial dual-license notice).

16. **Write `CONTRIBUTING.md`** noting that external PRs are currently disabled pending LLC formation and CLA infrastructure, and that copyright currently rests with Emerson Ramos with planned IP assignment to the Steward entity.

17. **Configure Biome** (`biome.json`) as the single linter/formatter. No ESLint, no Prettier.

18. **Configure Vitest** (`vitest.config.ts`) for unit tests in `tests/unit/`. Include a `tests/setup.ts` for Prisma test client setup.

19. **Write `.github/workflows/ci.yml`** — on push/PR: type-check, biome lint, vitest unit tests. Do not include deployment steps yet.

---

### Tech stack (exact versions where specified)

| Layer | Choice |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Icons | lucide-react |
| Auth | Auth.js (NextAuth v5) |
| DB | PostgreSQL 16 |
| ORM | Prisma (with `prismaSchemaFolder` preview feature) |
| Payments | Stripe (BYO default, Connect opt-in) |
| File storage | S3-compatible (R2 cloud / MinIO self-host) |
| Realtime | Postgres LISTEN/NOTIFY → SSE (no Redis) |
| Email | Resend (cloud) / SMTP (self-host) |
| SMS | Twilio (optional) |
| Testing | Vitest (unit) + Playwright (e2e, scaffold only) |
| Package mgr | pnpm |
| Lint/format | Biome |

---

### Non-negotiable constraints

These decisions are locked. Do not deviate or offer alternatives.

- **No emojis anywhere in the UI.** Lucide icons only. This is a product principle.
- **Money is always stored as integer minor units (cents).** Never use `Float` for currency in the schema or in TypeScript.
- **Every tenanted model query must be scoped by `churchId`.** The Prisma middleware enforces this. No exceptions.
- **`Order.status` is only ever written by `transition()` in `lib/orders/transitions.ts`.** No direct `prisma.order.update({ data: { status: ... } })` calls anywhere else. Throw a lint error or comment wherever this would otherwise happen.
- **`can()` is the only permission gate.** Every API route handler and server action calls `can()` at entry. No ad-hoc role checks inline.
- **`Membership.roles` is a Postgres enum array** (`Role[]`), not a single role field. A user can hold multiple roles at the same church.
- **Admin-chain inheritance:** OWNER ⊇ ADMIN ⊇ STAFF. COOK, DRIVER, VIEWER are independent sibling roles with no inheritance from the chain or from each other.
- **Soft-delete is selective.** Only user-editable entities have `deletedAt`. Order, OrderItem, OrderEvent, Payment, Refund, AuditLog, WebhookEvent, EmailLog, SmsLog, StockMovement are immutable history — never soft-deleted.
- **OrderItem snapshots.** At order time, `itemName`, `unitPrice`, and `modifierSnapshot` are written from the live catalog. Changes to the catalog after the order is placed do not affect existing orders.
- **BYO Stripe is the default.** Churches paste their own Stripe keys; Steward Table never holds money. Stripe Connect is an opt-in mode for hosted deployments.
- **Single currency per church in v1.** `Church.currency` is ISO 4217; immutable after the first order is placed. Use `Intl.NumberFormat` for all display formatting — never hardcode "$".
- **English + Spanish from v1.** Every customer-visible string has an `en` value on the row and a `translations` JSONB field for `es`. UI forms for translatable fields use a tabbed EN/ES control.
- **Bilingual catalog editing has visual completion indicators.** A yellow dot on the ES tab when any ES field is empty; a badge count on the item library and catalog views.

---

### RBAC specification

The complete RBAC matrix and `can()` spec is embedded below. Implement it exactly.

**Six roles:**
- `OWNER` — full authority including billing, church deletion, ownership transfer
- `ADMIN` — day-to-day admin; inherits all STAFF permissions
- `STAFF` — front-of-house order taking, customer service, capped refunds
- `COOK` — kitchen display only; sees active orders, marks ready, adjusts inventory
- `DRIVER` — sees only their assigned deliveries; marks out-for-delivery and delivered
- `VIEWER` — aggregated reports only; no customer PII, no individual orders

**Admin-chain inheritance:** OWNER inherits ADMIN which inherits STAFF. COOK, DRIVER, VIEWER do not inherit from each other or from the chain.

**Action catalog (exact strings):**
```
church.update, church.delete, church.billing
member.invite, member.update, member.remove
catalog.read, catalog.edit, catalog.publish
inventory.read, inventory.adjust
customer.read, customer.edit, customer.export
order.read, order.create, order.update, order.kitchen, order.deliver, order.cancel, order.refund
payment.read
settings.payment, settings.tax, settings.receipt, settings.email, settings.branding
report.read, report.export
audit.read
```

**Permission matrix** (✓ = unconditional, ▲ = context-conditional, blank = denied):

| Action | STAFF | ADMIN | OWNER | COOK | DRIVER | VIEWER |
|---|---|---|---|---|---|---|
| church.update | | ✓ | ✓ | | | |
| church.delete | | | ✓ | | | |
| church.billing | | | ✓ | | | |
| member.invite | | ✓ | ✓ | | | |
| member.update | | ▲ | ✓ | | | |
| member.remove | | ▲ | ✓ | | | |
| catalog.read | ✓ | ✓ | ✓ | ▲ | | ✓ |
| catalog.edit | | ✓ | ✓ | | | |
| catalog.publish | | ✓ | ✓ | | | |
| inventory.read | ✓ | ✓ | ✓ | ✓ | | |
| inventory.adjust | ▲ | ✓ | ✓ | ✓ | | |
| customer.read | ✓ | ✓ | ✓ | | ▲ | |
| customer.edit | ✓ | ✓ | ✓ | | | |
| customer.export | | ✓ | ✓ | | | |
| order.read | ✓ | ✓ | ✓ | ▲ | ▲ | ▲ |
| order.create | ✓ | ✓ | ✓ | | | |
| order.update | ✓ | ✓ | ✓ | | | |
| order.kitchen | ✓ | ✓ | ✓ | ✓ | | |
| order.deliver | | ✓ | ✓ | | ▲ | |
| order.cancel | ▲ | ✓ | ✓ | | | |
| order.refund | ▲ | ✓ | ✓ | | | |
| payment.read | ✓ | ✓ | ✓ | | | |
| settings.payment | | ✓ | ✓ | | | |
| settings.tax | | ✓ | ✓ | | | |
| settings.receipt | | ✓ | ✓ | | | |
| settings.email | | ✓ | ✓ | | | |
| settings.branding | | ✓ | ✓ | | | |
| report.read | ▲ | ✓ | ✓ | | | ▲ |
| report.export | | ✓ | ✓ | | | |
| audit.read | | ✓ | ✓ | | | |

**Context-aware conditions for ▲ cells:**
- `member.update / member.remove` (ADMIN): cannot target an OWNER membership
- `catalog.read` (COOK): only catalogs with `status = OPEN`
- `inventory.adjust` (STAFF): only items in currently-OPEN catalogs
- `customer.read` (DRIVER): only customers with `DeliveryInfo.driverId = self.userId`; returns name, phone, address only
- `order.read` (COOK): only `status IN (CONFIRMED, IN_KITCHEN, READY)` for OPEN catalogs
- `order.read` (DRIVER): only orders where `DeliveryInfo.driverId = self.userId`
- `order.read` (VIEWER): aggregated counts/totals only; no individual rows, no customer PII
- `order.deliver` (DRIVER): only orders where `DeliveryInfo.driverId = self.userId`
- `order.cancel` (STAFF): only if `status IN (DRAFT, SUBMITTED, CONFIRMED)` OR created by this user within the last hour
- `order.refund` (STAFF): partial refunds only, up to `ChurchSettings.staffRefundCapCents` (default 5000)
- `report.read` (STAFF): today's operational reports only (queue, revenue, items sold today)
- `report.read` (VIEWER): aggregated reports of any time range, no customer-level rows

**Every deny writes to `AuditLog`** with: action, resource, attempted-by, reason, IP, user-agent.

---

### Order lifecycle state machine

The complete state machine lives in `lib/orders/transitions.ts`. Implement `transition()` exactly as specified.

**13 states:** DRAFT, SUBMITTED, CONFIRMED, IN_KITCHEN, READY, AWAITING_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, SERVED, COMPLETED, CANCELED, REFUNDED

**Core transition table (implement all edges):**

| From | To | Actor / `can()` action | Key side effects |
|---|---|---|---|
| DRAFT | SUBMITTED | customer (no auth) or STAFF+ `order.create` | Email/SMS confirmation; inventory reserve; notify staff |
| SUBMITTED | CONFIRMED | auto (payment webhook) or STAFF+ `order.update` | Notify customer; inventory confirm |
| SUBMITTED | CANCELED | STAFF+ `order.cancel` | Restock; refund if captured; notify customer |
| CONFIRMED | IN_KITCHEN | auto (first kitchen display view) | No actor required; timestamp captured |
| CONFIRMED | CANCELED | STAFF+ `order.cancel` / ADMIN `order.cancel` | Restock; refund; notify customer |
| IN_KITCHEN | READY | COOK/STAFF+ `order.kitchen` | Notify customer (order ready); fulfillment branch |
| READY | AWAITING_PICKUP | auto (fulfillment=PICKUP) | SMS "your order is ready for pickup" |
| READY | OUT_FOR_DELIVERY | DRIVER `order.deliver` (after claim) | SMS "your order is on the way" |
| READY | SERVED | STAFF+ `order.kitchen` (fulfillment=DINE_IN) | |
| AWAITING_PICKUP | PICKED_UP | STAFF+ `order.update` | |
| AWAITING_PICKUP | CANCELED | STAFF+ `order.cancel` (no-show sweep) | Restock; no refund for no-show; notify |
| OUT_FOR_DELIVERY | DELIVERED | DRIVER `order.deliver` | |
| PICKED_UP | COMPLETED | auto | Reporting event |
| DELIVERED | COMPLETED | auto | Reporting event |
| SERVED | COMPLETED | auto | Reporting event |
| COMPLETED | REFUNDED | ADMIN `order.refund` | Stripe refund; restock |

**Principles:**
- Idempotent: re-applying the same transition is a safe no-op
- Atomic: status update + OrderEvent write in one Prisma transaction
- Invalid transitions throw `InvalidTransitionError`
- Side effects are declared as a typed list, queued post-commit, retried with idempotency keys

---

### Kitchen display notes (for `app/(dashboard)/kitchen/` stub)

The kitchen display is the most important screen. When scaffolding the route and component stubs, set up:
- SSE connection to `/api/sse/kitchen` for real-time order updates
- Wakelock API call on mount (keep screen awake)
- Card grid layout (2 col portrait tablet, 3 col landscape)
- Orders filtered to `status IN (CONFIRMED, IN_KITCHEN, READY)` only
- Urgency coloring system based on `scheduledFor ?? createdAt`: red ≤10 min, amber ≤1h, neutral beyond

---

### Catalog admin notes (for `app/(dashboard)/catalog/` stub)

Scaffold the catalog admin with:
- Three entry points for catalog creation: blank, clone-from-previous, template library
- v1 ships four templates as TypeScript modules in `lib/catalog-templates/`: `pupusa-sale.ts`, `bake-sale.ts`, `coffee-hour.ts`, `fundraiser-dinner.ts` (stub these with shape, not content)
- Item form: tabbed EN/ES editor with yellow dot completion indicator on ES tab
- Modifier groups: hybrid library + in-context creation (pick existing OR create new inline)

---

### Customer storefront notes (for `app/(storefront)/[churchSlug]/` stub)

Scaffold the storefront with:
- Guest checkout flow (no account required)
- Sticky bottom bar for cart (slim bar → bottom-sheet drawer on tap)
- Item detail as bottom-sheet drawer (modifier selection, quantity stepper, add to cart)
- Post-order magic-link upgrade prompt ("want to track this and save your info?")
- TCPA SMS opt-in checkbox (unchecked by default) with bilingual copy

---

### Prisma schema

The complete schema is in the attached `schema.prisma` file. Use it verbatim. Do not modify any model, field, enum, index, or relation. Split into the per-domain files listed in step 4 above.

[ATTACH: `schema.prisma` from the project root]

---

### When you are done

The repo should be in a state where:
1. `pnpm install` succeeds
2. `pnpm db:push` (or `prisma db push`) against a local Postgres instance succeeds
3. `pnpm build` succeeds (with expected stub/empty component warnings, not errors)
4. `pnpm test` runs the RBAC unit tests and they pass
5. `pnpm dev` starts the dev server without crashing

Do not wire up real Stripe, Twilio, or Resend calls — stub the adapter methods with `throw new Error("TODO: implement")` and a clear comment. The goal of this scaffolding pass is a correct skeleton, not a working product.

After scaffolding, output a summary of every file created, grouped by directory, so I can review coverage against this spec.
