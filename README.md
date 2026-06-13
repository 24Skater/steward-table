# Steward Table

Order management and fulfillment for churches and ministry-led food sales.

Steward Table is an open-source, multi-tenant platform that gives churches a calm, modern alternative to paper orders, spreadsheets, and consumer-grade food apps. It handles the full order lifecycle: online ordering, kitchen display, driver assignment, and customer receipts.

---

## Who It Is For

Churches and ministries that run food sales — pupusa sales, bake sales, fundraiser dinners, coffee hours — and need:

- A shared, real-time view of every order for the kitchen, cashier, and drivers
- Guest checkout with no app download required
- SMS and email notifications in English and Spanish
- Self-hosted or cloud-deployed options with no vendor lock-in
- A calm UI that respects the volunteer context (no emojis, no gamification)

---

## v1 Features

- **Multi-tenant** — one deployment, many churches; complete data isolation
- **Guest checkout** — customers order without creating an account
- **Kitchen display** — real-time order cards, urgency coloring, wakelock for tablets
- **Order lifecycle** — 13-state machine: DRAFT through COMPLETED and REFUNDED
- **RBAC** — 6 roles (OWNER, ADMIN, STAFF, COOK, DRIVER, VIEWER) with inheritance
- **Payments** — BYO Stripe keys (church owns their money) or Stripe Connect
- **Delivery** — driver assignment, zone-based routing, real-time status
- **Inventory** — finished-goods tracking with automatic reserve/restock on order events
- **English + Spanish** — every customer-visible string has an `es` translation field
- **Audit log** — full immutable audit trail; every permission deny is logged
- **Self-hostable** — Docker Compose with Postgres and MinIO

---

## Self-Host Quickstart

```bash
# 1. Clone
git clone https://github.com/steward-app/steward-table.git
cd steward-table

# 2. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your secrets

# 3. Start services
docker compose -f docker/docker-compose.yml up -d

# 4. Run migrations
docker compose exec app pnpm db:migrate

# 5. Open the app
open http://localhost:3000
```

---

## Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/steward-app/steward-table)

Set the environment variables from `.env.example` in your Vercel project settings.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Icons | lucide-react |
| Auth | Auth.js (NextAuth v5) |
| Database | PostgreSQL 16 |
| ORM | Prisma with prismaSchemaFolder |
| Payments | Stripe (BYO default, Connect opt-in) |
| File storage | S3-compatible (R2 cloud / MinIO self-host) |
| Realtime | Postgres LISTEN/NOTIFY -> SSE |
| Email | Resend (cloud) / SMTP (self-host) |
| SMS | Twilio (optional) |
| Testing | Vitest (unit) + Playwright (e2e) |
| Package manager | pnpm |
| Lint / format | Biome |

---

## RBAC Summary

Six roles with admin-chain inheritance (OWNER supersedes ADMIN supersedes STAFF):

| Role | Description |
|---|---|
| OWNER | Full authority including billing and church deletion |
| ADMIN | Day-to-day admin; inherits all STAFF permissions |
| STAFF | Order taking, customer service, capped refunds |
| COOK | Kitchen display only; marks orders ready, adjusts inventory |
| DRIVER | Sees and delivers their own assigned orders |
| VIEWER | Aggregated reports only; no customer PII |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). External PRs are currently paused pending LLC formation and CLA infrastructure.

---

## License

Steward Table is dual-licensed:

- **AGPL-3.0** for open-source use (see [LICENSE](LICENSE))
- **Commercial license** for organizations that cannot comply with AGPL-3.0 (see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md))

Copyright (c) 2025 Emerson Ramos. IP assignment to the Steward entity pending LLC formation.
