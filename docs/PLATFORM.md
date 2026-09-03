# Steward Platform

StewardTable is one app in the Steward platform. This file records the
platform-level constraints that apply to *this repository* and points at the
decision record that explains why they exist.

**Decision record:** https://claude.ai/code/artifact/fffcde73-8186-4c63-83f9-979d80f82f42

It covers seven decisions - hosting model, identity, tenancy, where platform
code lives, billing and entitlements, routing, and cross-app integration - plus
the phased roadmap this repository is working through.

## Where this repo sits

Table is the **reference implementation for tenancy**. Its ORM-level guard in
`lib/db.ts` throws on any unscoped query, and that guard is the pattern the
other Steward apps adopt. Changes that weaken it are platform-level changes, not
app-level ones.

Table is also the first app to be sold on the pooled platform, which is why the
Phase 0 and Phase 1 work lands here first.

## Invariants

Both are enforced by `scripts/ci/check-platform-boundaries.sh`, which runs as
the `Platform Boundaries` job in CI.

### 1. The platform root domain is configuration

No production domain appears in source. Every host, storefront URL and default
email sender derives from `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` through
`lib/platform-domain.ts`:

| Value                              | Derived from                              |
| ---------------------------------- | ----------------------------------------- |
| `table.<root>`                     | `appHost()` - the admin app               |
| `<slug>.table.<root>`              | `tenantHost(slug)` - a church storefront  |
| `orders@table.<root>`              | `defaultSenderAddress("orders")`          |
| slug resolution from a Host header | `extractTenantSlug(host)`                 |

In local development the root is `localhost:3000`, the app host collapses to the
bare root, and storefronts fall back to the path-prefixed route the middleware
rewrites to. `NEXT_PUBLIC_APP_URL` still overrides the base URL for preview
deployments and tunnels.

Add new derivations to `lib/platform-domain.ts`. Do not reach for the env var
directly, and do not reintroduce a literal domain.

### 2. Platform billing is not this app's business

Three Steward apps run Stripe for the *church's own* money - Table's food sales
among them. That is entirely separate from the money churches pay Steward for
the subscription itself.

- `STRIPE_PLATFORM_*` credentials exist only in the console's environment and
  must never appear in this repository.
- Platform webhooks go to the console host. Tenant commerce webhooks stay on
  this app's existing `/api/webhooks/stripe`.
- This app never imports the console's Stripe client. It knows about
  entitlements; it does not know about invoices.

## Roadmap position

- **Phase 0 (done here):** domain configuration, the boundary guard in CI.
- **Phase 1 (next):** `Church.id = orgId` at provisioning, `POST
  /internal/provision`, `requireEntitlement("table")` in `middleware.ts`, and
  the DMMF test that fails CI when a Prisma model is classified as neither
  tenanted nor global.

See the decision record for the full sequence.
