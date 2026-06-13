# Steward Table — Claude Code Context

## What Is Steward Table

Steward Table is an open-source, multi-tenant church order management platform. Churches self-host the app, bring their own Stripe account, and use it to run food/product orders for their congregation. Each church is a fully isolated tenant. The platform handles catalogs, orders, kitchen fulfillment, delivery routing, and member management under a role-based permission system.

## Tech Stack

- **Next.js 15** — App Router, Turbopack in dev
- **TypeScript** — strict mode, no `any` shortcuts
- **Prisma v6** — multi-file schema at `prisma/schema/`
- **Auth.js v5** — session-based auth
- **shadcn/ui + Tailwind v4** — UI layer

## Critical Architecture

### Database Client (`lib/db.ts`)

```ts
export const db = prismaClientWithExtensions as unknown as PrismaClient;
```

The `as unknown as PrismaClient` cast is **required** — Prisma `$extends` erases the return type. Do not remove or simplify this cast.

### Multi-Tenancy

Tenancy is enforced via a Prisma query extension in `lib/db.ts` that automatically injects `churchId` on every query. To bypass for cross-tenant or ID-only lookups (e.g., looking up a church by its own ID during auth):

```ts
db.church.findUnique({
  where: { id: churchId, ...({ _bypassTenancyCheck: true } as object) },
});
```

### Soft Deletes

Most models have a `deletedAt` field. The Prisma extension filters `deletedAt: null` automatically. Do not add manual `deletedAt: null` filters unless bypassing the extension.

### RBAC (`lib/auth/permissions.ts`)

```ts
await requirePermission(session, "catalog.edit");
```

Valid action strings:

| Action | Scope |
|---|---|
| `catalog.edit` | Create/edit/archive catalog items |
| `order.update` | Edit order status/contents |
| `order.kitchen` | Access kitchen view |
| `member.invite` | Invite new members |
| `member.update` | Change member roles |
| `member.remove` | Remove members |
| `church.update` | Edit church profile |
| `settings.payment` | Manage Stripe keys |

### Stripe Keys

Stripe credentials are stored **encrypted** in the `ApiKey` table — **not** in `ChurchSettings`.

- `provider = "stripe"` — publishable + secret key
- `provider = "stripe_webhook"` — webhook secret

Encryption: AES-256-GCM via `lib/crypto/aes.ts`.

### Route Groups

| Group | Layout | Purpose |
|---|---|---|
| `(dashboard)` | Sidebar layout | Admin/member dashboard |
| `(kitchen)` | Full-screen, no sidebar | Kitchen display |
| `(storefront)` | Customer-facing | Order placement |
| `(marketing)` | Public | Landing/marketing pages |

## Schema Gotchas

- `Catalog.status`: enum `OPEN | CLOSED` — not a boolean `isActive`
- `Item.defaultPrice` — not `basePrice`
- `Item.status`: enum `ItemStatus` — not `isAvailable`
- `Order` default status: `SUBMITTED`
- Driver assignment lives on `DeliveryInfo.driverId`, not on `Order`
- `ItemModifierGroup.groupId` — not `modifierGroupId`
- `ChurchSettings.replyToEmail` — there is no `contactEmail` on the `Church` model
- Fulfillment method toggles are stored in `ChurchSettings.brandTokens: Json?`

## Dev Commands

```bash
pnpm dev                    # Start dev server (Turbopack)
pnpm build                  # Production build
npx prisma generate         # Regenerate Prisma client
npx prisma migrate dev      # Run migrations
npx tsc --noEmit            # Type check only
```

## Environment Variables

See `.env.example` for the full list. Minimum required for local dev:

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
```

## Do Not

- **Don't use `$use` middleware** — removed in Prisma v6. Use `$extends` instead.
- **Don't put `"use server"` inside `"use client"` components** — extract server actions to a separate file.
- **Don't invent `catalog.manage`** — this RBAC action does not exist. Use `catalog.edit`.
- **Don't store Stripe keys in `ChurchSettings`** — they belong in the `ApiKey` table with AES encryption.
- **Don't remove the `as unknown as PrismaClient` cast** in `lib/db.ts` — it is load-bearing.
