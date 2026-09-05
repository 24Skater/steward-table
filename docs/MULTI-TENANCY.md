# Multi-tenancy

One StewardTable database can hold many churches. This file is the developer
reference for how that is enforced here, and for the two configuration knobs a
self-hosted install may want.

Everything below works standalone. Nothing in this repository requires a Steward
account, a Steward server, or anything Steward hosts.

## The guard

`lib/db.ts` wraps Prisma. On a model that holds a church's data it **throws** on
a read that names no `churchId`, and on a create that supplies none.

```
[Tenancy] Unscoped read on Order — add churchId to where, or pass
_bypassTenancyCheck: true for system-level ops.
```

That is the whole design: forgetting is a loud error rather than a query that
quietly returns every church's rows. Three sets in that file classify every
model — tenanted, parent-scoped, and global — and
`tests/unit/tenancy/model-classification.test.ts` reads Prisma's DMMF and fails
the build if a model is in none of them. A model added next year is a model
nobody remembers to classify; that test is what stops it from silently becoming
an unguarded one.

### The bypass audit

`_bypassTenancyCheck: true` is the escape hatch. There are 187 of them, and an
escape hatch nobody reviews stops being an escape hatch and becomes the default.

`scripts/ci/check-tenancy-bypasses.mjs` runs in CI and fails on a bypass that is
on a tenanted model, has no `churchId` anywhere in the enclosing query, and
carries no comment explaining why. It finds the enclosing call by brace-matching
rather than a line window, because a long `select` routinely puts the `where`
twenty lines above the bypass.

Nine sites needed justifying when it was written. All nine turned out to be the
same safe shape — a row fetched scoped by `churchId`, then mutated by the primary
key that fetch had just proven — plus unguessable invitation tokens and Stripe
webhooks, which have no session to scope by. Each now says so.

## Hostnames

No production domain appears in source. Every host, storefront URL and default
email sender derives from `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` through
`lib/platform-domain.ts`:

| Value                              | Derived from                             |
| ---------------------------------- | ---------------------------------------- |
| `table.<root>`                     | `appHost()` — the admin app              |
| `<slug>.table.<root>`              | `tenantHost(slug)` — a church storefront |
| `orders@table.<root>`              | `defaultSenderAddress("orders")`         |
| slug resolution from a Host header | `extractTenantSlug(host)`                |

In local development the root is `localhost:3000`, the app host collapses to the
bare root, and storefronts fall back to the path-prefixed route the middleware
rewrites to. `NEXT_PUBLIC_APP_URL` still overrides the base URL for preview
deployments and tunnels.

Add new derivations to `lib/platform-domain.ts`. Do not reach for the
environment variable directly, and do not reintroduce a literal domain.
`scripts/ci/check-platform-boundaries.sh` enforces both.

## Optional: hosted entitlements

If you run this app as part of a hosted Steward subscription, it can ask a
console what each organization is allowed to do. `lib/platform/client.ts`
fetches a short-lived signed token and verifies it **offline** against a cached
JWKS, so the check costs no network call on the request path.

**This is off unless you turn it on.** With `PLATFORM_CONSOLE_URL` or
`PLATFORM_SERVICE_TOKEN` unset there is no client, every check passes, and the
app behaves exactly as it did before any of this existed. There are tests
asserting that. Enforcement is opt-in by deployment, and a self-hosted church
should never need it.

When it *is* configured:

| State                 | Dashboard                                  |
| --------------------- | ------------------------------------------ |
| `ACTIVE` / `GRACE`    | Full access                                |
| `READ_ONLY`           | Reads and exports; writes get 402          |
| `REVOKED`             | Redirected to `/billing/required`          |
| absent (not bought)   | Redirected to `/billing/required`          |

Two behaviours that look like leniency and are deliberate. **The storefront is
never gated** — cutting off a church's customers mid-order punishes the wrong
people. And **an unverifiable request is allowed, not refused**: if the client
cannot reach the console and has no cached answer, the request goes through and
the reason is logged, because refusing would lock out a church whose first
request of the day happened to land during an outage.
