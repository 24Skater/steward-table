/**
 * Platform domain resolution.
 *
 * Every host, storefront URL and default email sender in this app is derived
 * from a single configured root domain. Nothing here may hardcode a production
 * domain - the platform root is a deployment decision, not a source constant.
 *
 * Set `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` (e.g. the platform root, "example.org"). It is
 * NEXT_PUBLIC_ because client components render tenant hostnames during
 * onboarding and in settings.
 */

/** This app's slot in the platform host scheme. */
export const APP_SLUG = "table";

const DEV_ROOT_DOMAIN = "localhost:3000";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const PORT_SUFFIX = /:[0-9]+$/;

/**
 * Platform root domain without protocol or leading dot, optionally with a port
 * in development. Example: "example.org" or "localhost:3000".
 */
export const PLATFORM_ROOT_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ?? DEV_ROOT_DOMAIN;

function isLocalRoot(root: string): boolean {
  return root.startsWith("localhost") || root.startsWith("127.0.0.1");
}

/** "http" for local development roots, "https" everywhere else. */
export function platformProtocol(root: string = PLATFORM_ROOT_DOMAIN): string {
  return isLocalRoot(root) ? "http" : "https";
}

/**
 * Host serving the Table admin app itself - "table.example.org".
 * In local development this collapses to the bare root ("localhost:3000") so
 * the app is reachable without /etc/hosts entries.
 */
export function appHost(root: string = PLATFORM_ROOT_DOMAIN): string {
  return isLocalRoot(root) ? root : `${APP_SLUG}.${root}`;
}

/** Host serving one church's storefront - "grace.table.example.org". */
export function tenantHost(slug: string, root: string = PLATFORM_ROOT_DOMAIN): string {
  return `${slug}.${appHost(root)}`;
}

/**
 * Absolute base URL of the admin app. An explicit NEXT_PUBLIC_APP_URL wins so
 * preview deployments and tunnels keep working.
 */
export function appBaseUrl(root: string = PLATFORM_ROOT_DOMAIN): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? `${platformProtocol(root)}://${appHost(root)}`;
}

/**
 * Absolute storefront URL for a church. Local development has no wildcard DNS,
 * so it falls back to the path-prefixed route the middleware rewrites to.
 */
export function storefrontUrl(slug: string, root: string = PLATFORM_ROOT_DOMAIN): string {
  if (isLocalRoot(root)) return `${appBaseUrl(root)}/${slug}`;
  return `${platformProtocol(root)}://${tenantHost(slug, root)}`;
}

/** Default sender for a mailbox: "orders" -> "orders@table.example.org". */
export function defaultSenderAddress(mailbox: string, root: string = PLATFORM_ROOT_DOMAIN): string {
  return `${mailbox}@${appHost(root).replace(PORT_SUFFIX, "")}`;
}

/**
 * Extract a church slug from a request Host header.
 *
 * Matches "{slug}.{appHost}" for whatever root is configured, which covers both
 * production ("grace.table.example.org") and a local /etc/hosts entry
 * ("grace.localhost:3000"). Returns null for the bare app host, where the slug
 * travels in the path instead.
 */
export function extractTenantSlug(
  host: string | null | undefined,
  root: string = PLATFORM_ROOT_DOMAIN,
): string | null {
  if (!host) return null;
  const suffix = `.${appHost(root)}`.toLowerCase();
  const lowered = host.toLowerCase();
  if (!lowered.endsWith(suffix)) return null;
  const slug = lowered.slice(0, -suffix.length);
  return SLUG_PATTERN.test(slug) ? slug : null;
}
