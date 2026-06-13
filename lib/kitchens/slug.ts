const FALLBACK_SLUG = "kitchen";

/**
 * Convert a kitchen name into a URL-safe slug: lowercase, alphanumeric words
 * joined by hyphens. Returns "kitchen" when nothing usable remains.
 */
export function slugifyKitchenName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : FALLBACK_SLUG;
}

/**
 * Produce a slug unique within the given set of existing slugs by appending
 * -2, -3, … on collision.
 */
export function generateUniqueKitchenSlug(name: string, existingSlugs: string[]): string {
  const base = slugifyKitchenName(name);
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
