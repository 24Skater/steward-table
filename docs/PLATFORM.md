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

## Provisioning

`POST /api/internal/provision` is how an organization comes to exist in this
app. The console calls it with this app's service token
(`PLATFORM_SERVICE_TOKEN`) when someone signs up for Table.

Two properties the console depends on:

- **`Church.id` is the console's `orgId`.** Not a mapping table, not a foreign
  key — the same value. One organization has one id across all four Steward
  apps, forever, and the console mints it.
- **Idempotent by `orgId`.** The console retries with backoff, so a repeat call
  for an existing org succeeds and changes nothing. In particular it does not
  rename a church the owner may have renamed since.

A slug already held by a *different* church returns **409**, not 500. The
console's classifier fails fast on any 4xx other than 429, so a collision
reaches the operator instead of being retried five times into the same wall.

There is no DNS or certificate work in provisioning. The wildcard record and
wildcard certificate already resolve `{slug}-stewardtable.app.<root>`.

## The tenancy bypass audit

`_bypassTenancyCheck: true` is the escape hatch from the guard in `lib/db.ts`.
There are 187 of them, and an escape hatch nobody reviews stops being an escape
hatch and becomes the default.

`scripts/ci/check-tenancy-bypasses.mjs` runs in CI and fails the build on a
bypass that is on a **tenanted** model, has **no `churchId`** anywhere in the
enclosing query, and carries **no comment** explaining why. It finds the
enclosing call by brace-matching rather than a line window, because a long
`select` routinely puts the `where` twenty lines above the bypass.

Nine sites needed justifying when it was written. All nine turned out to be the
same safe shape — a row fetched scoped by `churchId`, then mutated by the
primary key that fetch had just proven — plus unguessable invitation tokens and
Stripe webhooks, which have no session to scope by. Each now says so.
## Entitlement enforcement

`middleware.ts` checks the org's entitlement on every dashboard request, via
`@steward-apps/platform-client`. Verification is offline against a cached JWKS,
so the check costs no network call on the request path.

**The org id needs no lookup.** `Church.id` *is* the console's `orgId`, so the
`churchId` already on the session membership is the value the console keys on.

| State                 | Dashboard                                  |
| --------------------- | ------------------------------------------ |
| `ACTIVE` / `GRACE`    | Full access                                |
| `READ_ONLY`           | Reads and exports; writes get 402          |
| `REVOKED`             | Redirected to `/billing/required`          |
| absent (not bought)   | Redirected to `/billing/required`          |

API routes get a **402** they can branch on; people get a page that explains
which of the three situations they are in. Telling a church "subscription
required" when they never had one, or asking them to pay when they only need to
stop writing, is how support tickets get made.

**The storefront is not gated.** Cutting off a church's customers mid-order
punishes the wrong people, and the plan puts refusal of public traffic at the
edge, where it costs nothing.

### Self-hosted installs are unaffected

Table is AGPL and self-hostable. With `PLATFORM_CONSOLE_URL` or
`PLATFORM_SERVICE_TOKEN` unset, there is no client and every check passes —
the app behaves exactly as it did before the platform existed. Enforcement is
opt-in by deployment.

The same instinct applies during an outage: if the client has no cached
entitlement at all and cannot reach the console, the request is **allowed** and
the reason logged. Refusing would lock out a church whose first request of the
day happened to land during a console outage.

## Roadmap position

- **Phase 0 (done):** domain configuration, the boundary guard in CI.
- **Phase 1 (done here):** the DMMF classification test and the tenancy fixes
  it surfaced; `POST /api/internal/provision` creating `Church` with
  `id = orgId`; entitlement enforcement in `middleware.ts`.

See the decision record for the full sequence.
