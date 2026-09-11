/**
 * Which requests the entitlement gate applies to.
 *
 * Kept separate from `middleware.ts` because the interesting part is a decision
 * table, and a decision table that can only be exercised by standing up Next.js
 * and a session is a decision table nobody exercises. This function is pure:
 * a pathname in, a verdict out.
 *
 * Four verdicts, differing in what they do about a *missing* session and about
 * tenant-host rewriting:
 *
 *   bypass             Not an application request, or one that must survive
 *                      everything. Returned before the storefront rewrite, so
 *                      these paths are never relocated under a church's slug.
 *   none               No entitlement check, but still rewritten on a tenant
 *                      host. This is the public storefront.
 *   session-required   A staff surface. No session means sign in first.
 *   session-optional   An API route. A signed-in caller is checked against
 *                      their organization's entitlement; an anonymous one is
 *                      left alone, because that is a customer on the public
 *                      storefront and the route does its own authentication.
 *
 * Why API routes are in here at all: enforcement used to live inside a branch
 * guarded by the dashboard page prefixes, so `/api/...` never reached it. The
 * 402 response the middleware already knew how to produce was unreachable, and
 * a REVOKED organization could still write through every endpoint its own
 * dashboard calls. Pages were gated; the API behind them was not.
 */

export type GateKind = "bypass" | "none" | "session-required" | "session-optional";

export interface GateDecision {
  gate: GateKind;
}

/**
 * Paths the middleware hands straight back.
 *
 * Each is here for its own reason, and none of them is "it seemed harmless":
 *
 * - `/_next` is not an application request. (Favicons and other static files
 *   are caught by `isStaticAsset` before this is consulted at all.)
 * - `/auth` is Auth.js and the sign-in pages. A church whose subscription
 *   lapsed has to be able to sign in, or it cannot pay.
 * - `/billing/required` is where the gate redirects. Gating it loops, and
 *   rewriting it under a church's slug would 404 the page it redirects to.
 * - `/api/internal` is the console calling in with a service token. It is how
 *   a church that failed to provision gets un-stuck, so it cannot depend on
 *   that church being entitled.
 * - `/api/cron` is a scheduler. There is no session and so no organization to
 *   check; the route authenticates its caller itself.
 */
const BYPASS_PREFIXES = [
  "/_next",
  "/auth",
  "/billing/required",
  "/api/internal",
  "/api/cron",
] as const;

/** The staff surfaces. Everything else that renders is storefront or public. */
const DASHBOARD_PREFIXES = [
  "/orders",
  "/kitchen",
  "/catalog",
  "/customers",
  "/inventory",
  "/drivers",
  "/settings",
  "/reports",
] as const;

/**
 * Prefix match on a path *segment* boundary.
 *
 * `/ordersomething` is not under `/orders`. A bare `startsWith` would gate a
 * storefront path that merely begins with the same letters, and - worse in the
 * other direction - a future `/api/internals` would inherit `/api/internal`'s
 * exemption.
 */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function gateFor(pathname: string): GateDecision {
  if (BYPASS_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    return { gate: "bypass" };
  }

  if (DASHBOARD_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    return { gate: "session-required" };
  }

  if (isUnder(pathname, "/api")) {
    return { gate: "session-optional" };
  }

  return { gate: "none" };
}

/**
 * Whether a path is a static asset rather than an application request.
 *
 * A dot in the last segment means a file. API routes are excluded on purpose:
 * a route parameter is free to contain a dot, and treating `/api/items/a.b` as
 * a static file would hand an ungated request straight through the gate this
 * module exists to close.
 */
export function isStaticAsset(pathname: string): boolean {
  if (isUnder(pathname, "/api")) return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}
