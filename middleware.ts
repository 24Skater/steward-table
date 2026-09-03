import { auth } from "@/lib/auth";
import { extractTenantSlug } from "@/lib/platform-domain";
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
