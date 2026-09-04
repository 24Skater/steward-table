import { auth } from "@/lib/auth";
import { extractTenantSlug } from "@/lib/platform-domain";
import { checkEntitlement, isMutationMethod } from "@/lib/platform/entitlements";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Tenant host: {slug}.{appHost}, derived from PLATFORM_ROOT_DOMAIN.
// Production: grace.table.<root>. Local dev: grace.localhost:3000 via
// /etc/hosts, or localhost:3000/grace with the slug in the path.
function extractChurchSlug(req: NextRequest): string | null {
  return extractTenantSlug(req.headers.get("host"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass through Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    // Must stay reachable, or the entitlement redirect below loops onto itself.
    pathname.startsWith("/billing/required") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Resolve church slug from subdomain
  const churchSlug = extractChurchSlug(req);

  // Rewrite storefront routes for subdomain access
  if (churchSlug && !pathname.startsWith("/(storefront)")) {
    const url = req.nextUrl.clone();
    url.pathname = `/${churchSlug}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Protect dashboard routes — require authentication
  if (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/drivers") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reports")
  ) {
    const session = await auth();

    if (!session?.user?.id) {
      const signInUrl = new URL("/auth/sign-in", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Entitlement enforcement.
    //
    // The org id is already in the session: Church.id IS the console's orgId, so
    // a membership's churchId needs no lookup and no extra round trip.
    //
    // Only the dashboard is gated here. The storefront is public and stays
    // reachable — cutting off a church's customers mid-order would punish the
    // wrong people, and the plan puts public-traffic refusal at the edge.
    const orgId = session.user.memberships?.[0]?.churchId;

    if (orgId) {
      const decision = await checkEntitlement(orgId, isMutationMethod(req.method));

      if (!decision.allow) {
        // 402 for anything programmatic, a page for a person. An API client
        // needs a status it can branch on; a human needs somewhere to go.
        if (pathname.startsWith("/api")) {
          return NextResponse.json(
            { error: "subscription_required", reason: decision.reason },
            { status: 402 },
          );
        }

        const billingUrl = new URL("/billing/required", req.url);
        billingUrl.searchParams.set("reason", decision.reason);
        return NextResponse.redirect(billingUrl);
      }

      const response = NextResponse.next();
      response.headers.set("x-user-id", session.user.id);
      // Lets the dashboard render a read-only banner without asking again.
      if (decision.readOnly) response.headers.set("x-entitlement-read-only", "1");
      return response;
    }

    // Attach userId to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set("x-user-id", session.user.id);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
