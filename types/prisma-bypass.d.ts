/**
 * Callable escape-hatch type for Prisma delegate methods invoked with the
 * `_bypassTenancyCheck` flag — an extra top-level argument the tenancy query
 * extension reads and strips at runtime (see `lib/db.ts`). The flag is not part
 * of Prisma's generated argument types, so the method is cast to this type at
 * the call site to accept it.
 *
 * This replaces the previously-used `Function` cast (banned by Biome's
 * `noBannedTypes`): it is a precise callable signature and preserves the loose
 * result typing the existing call sites rely on (many follow the call with a
 * hand-written `as { ... }` result assertion).
 *
 * Ambient (no import needed) — picked up via the tsconfig include globs.
 */
// biome-ignore lint/suspicious/noExplicitAny: intentional loose escape hatch replacing the banned `Function` type
declare type PrismaBypass = (...args: any[]) => any;
