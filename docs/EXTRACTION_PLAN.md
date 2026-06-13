# Extraction Plan

This document maps each `lib/*` folder to its intended future `@steward/*` package.
Extraction is triggered only when stewardChMs (or another Steward family app) needs the functionality.
Premature extraction adds coordination overhead without benefit.

## Current: Everything lives in `steward-table`

All business logic lives in `lib/` inside this repo. The Steward family currently has one app.

---

## Extraction Candidates

### `lib/auth/` -> `@steward/auth`

**Trigger:** When stewardChMs needs auth (login, invitation flow, magic links).

**What extraction involves:**
- Move `lib/auth/config.ts`, `lib/auth/helpers.ts`, `lib/auth/types.ts` to a new `steward-shared/packages/auth/` directory
- Create an `@steward/auth` package with its own `package.json`
- Both `steward-table` and `stewardChMs` install `@steward/auth` and pass their own `PrismaAdapter`
- The invitation flow (which today is app-specific) may need to be made generic or kept per-app

---

### `lib/rbac/` -> `@steward/rbac`

**Trigger:** When stewardChMs needs role-based permission checks.

**What extraction involves:**
- Move `lib/rbac/can.ts` and types to `steward-shared/packages/rbac/`
- The `Action` type union is app-specific — extraction would need a way for each app to extend the action set (discriminated union or string-branded types)
- `AuditLog` writes are currently hardcoded to the `steward-table` schema — the extracted package would need an injectable audit sink

---

### `lib/i18n/` -> `@steward/i18n`

**Trigger:** When stewardChMs needs English/Spanish UI strings.

**What extraction involves:**
- Move message catalogs and `t()` helper to `steward-shared/packages/i18n/`
- Each app provides its own message catalog (app-specific strings) that extends the shared base
- `next-intl` or similar can be used as a peer dep

---

### `lib/notifications/` -> `@steward/notifications`

**Trigger:** When stewardChMs needs email or SMS sending.

**What extraction involves:**
- Move the `NotificationAdapter` interface and Resend/Twilio implementations to `steward-shared`
- Each app provides its own email templates (kept in-app)
- The shared package provides the send interface and provider implementations

---

## Stays in `steward-table` forever

These are application-specific and will never be extracted:

| Module | Reason |
|---|---|
| `lib/payments/` | Stripe BYO + Connect is specific to food-sales commerce |
| `lib/orders/` | Order lifecycle is specific to food-order management |
| `lib/kitchen/` | Kitchen display logic is specific to food ops |
| `lib/delivery/` | Driver assignment is specific to food delivery |
| `lib/inventory/` | Finished-goods tracking is specific to food sales |
| `lib/reporting/` | Revenue/queue reports are specific to food sales ops |
| `lib/catalog-templates/` | Pupusa sale, bake sale, etc. are context-specific |

---

## Extraction Process (when the time comes)

1. Create `steward-shared/packages/<name>/` with its own `package.json` and `tsconfig.json`
2. Move files, update imports
3. Publish to npm (or GitHub Packages) as `@steward/<name>`
4. Install in both apps; verify both still build and test green
5. Remove the in-app copy
6. Update this document
