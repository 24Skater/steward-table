#!/usr/bin/env bash
# This script sets up Steward Table for local development.
set -e

# ── Color helpers ──────────────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput &>/dev/null && tput colors &>/dev/null; then
  GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1); RESET=$(tput sgr0)
else
  GREEN=''; YELLOW=''; RED=''; RESET=''
fi

ok()   { echo "${GREEN}✓ $*${RESET}"; }
warn() { echo "${YELLOW}⚠ $*${RESET}"; }
err()  { echo "${RED}✗ $*${RESET}" >&2; exit 1; }

# ── 1. Check required tools ────────────────────────────────────────────────────
echo ""
echo "Checking required tools..."

command -v node &>/dev/null || err "node is not installed. Install Node.js >=20 from https://nodejs.org"
NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node) < 20 ? 1 : 0)" 2>/dev/null) \
  || err "Node.js >=20 is required. Current: $(node --version). Upgrade at https://nodejs.org"
ok "node $(node --version)"

command -v pnpm &>/dev/null || err "pnpm is not installed. Install with: npm install -g pnpm"
ok "pnpm $(pnpm --version)"

command -v psql &>/dev/null || err "psql is not installed. Install PostgreSQL client tools first."
ok "psql $(psql --version | head -1)"

# ── 2. Copy .env.example → .env.local ─────────────────────────────────────────
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  warn "Created .env.local from .env.example — fill in your database URL and auth secrets before continuing."
else
  ok ".env.local already exists — skipping copy"
fi

# ── 3. Install dependencies ────────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
pnpm install
ok "Dependencies installed"

# ── 4. Generate Prisma client ──────────────────────────────────────────────────
echo ""
echo "Generating Prisma client..."
npx prisma generate
ok "Prisma client generated"

# ── 5. Run database migrations (optional) ─────────────────────────────────────
echo ""
echo -n "${YELLOW}Run database migrations? (y/N): ${RESET}"
read -r RUN_MIGRATE
if [[ "$RUN_MIGRATE" =~ ^[Yy]$ ]]; then
  npx prisma migrate dev --name init --skip-seed
  ok "Migrations applied"
else
  warn "Skipped migrations — run 'npx prisma migrate dev' when ready"
fi

# ── 6. Seed database (optional) ───────────────────────────────────────────────
echo ""
echo -n "${YELLOW}Seed database with demo data? (y/N): ${RESET}"
read -r RUN_SEED
if [[ "$RUN_SEED" =~ ^[Yy]$ ]]; then
  pnpm tsx prisma/seed.ts
  ok "Database seeded"
else
  warn "Skipped seeding — run 'pnpm tsx prisma/seed.ts' whenever you want demo data"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
ok "Setup complete. Run \`pnpm dev\` to start the development server."
echo ""
