import { auth } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Production domain: {slug}.table.steward.app
// Development: localhost:3000/{slug} or subdomain via /etc/hosts
const _APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function extractChurchSlug(req: NextRequest): string | null {
  const host = req.headers.get("host") ?? "";

  // Subdomain pattern: {slug}.table.steward.app
  const subdomainMatch = host.match(/^([a-z0-9-]+)\.table\.steward\.app$/i);
  if (subdomainMatch?.[1]) {
    return subdomainMatch[1];
  }

  // Development fallback: first path segment if it looks like a slug
  // This is only for local dev — production always uses subdomains
  return null;
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
