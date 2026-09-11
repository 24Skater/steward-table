import { auth } from "@/lib/auth";
import { extractTenantSlug } from "@/lib/platform-domain";
import { checkEntitlement, isMutationMethod } from "@/lib/platform/entitlements";
import { gateFor, isStaticAsset } from "@/lib/platform/request-gate";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Tenant host: {slug}.{appHost}, derived from PLATFORM_ROOT_DOMAIN.
// Production: grace.table.<root>. Local dev: grace.localhost:3000 via
// /etc/hosts, or localhost:3000/grace with the slug in the path.
function extractChurchSlug(req: NextRequest): string | null {
  return extractTenantSlug(req.headers.get("host"));
}

/**
 * Refuse a request the entitlement gate turned down.
 *
 * 402 for anything programmatic, a page for a person. An API client needs a
 * status it can branch on; a human needs somewhere to go.
 */
function refuse(req: NextRequest, pathname: string, reason: string): NextResponse {
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "subscription_required", reason }, { status: 402 });
  }

  const billingUrl = new URL("/billing/required", req.url);
  billingUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(billingUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const { gate } = gateFor(pathname);

  // Handed straight back, before the storefront rewrite could relocate them
  // under a church's slug.
  if (gate === "bypass") {
    return NextResponse.next();
  }

  // Resolve church slug from subdomain. Storefront rewriting happens before the
  // entitlement gate: the storefront is public, and cutting off a church's
  // customers mid-order would punish the wrong people. The plan puts
  // public-traffic refusal at the edge, not here.
  const churchSlug = extractChurchSlug(req);

  if (churchSlug && !pathname.startsWith("/(storefront)")) {
    const url = req.nextUrl.clone();
    url.pathname = `/${churchSlug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (gate === "none") {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session?.user?.id) {
    // An API route with no session is anonymous storefront traffic. It has no
    // organization to check, and the route authenticates its own callers.
    if (gate === "session-optional") return NextResponse.next();

    const signInUrl = new URL("/auth/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Entitlement enforcement.
  //
  // The org id is already in the session: Church.id IS the console's orgId, so
  // a membership's churchId needs no lookup and no extra round trip.
  const orgId = session.user.memberships?.[0]?.churchId;

  if (orgId) {
    const entitlement = await checkEntitlement(orgId, isMutationMethod(req.method));

    if (!entitlement.allow) {
      return refuse(req, pathname, entitlement.reason);
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", session.user.id);
    // Lets the dashboard render a read-only banner without asking again.
    if (entitlement.readOnly) response.headers.set("x-entitlement-read-only", "1");
    return response;
  }

  // Attach userId to request headers for downstream use
  const response = NextResponse.next();
  response.headers.set("x-user-id", session.user.id);
  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
