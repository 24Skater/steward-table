/**
 * Slug format, as this app needs it.
 *
 * The console is the authority on which slugs may be claimed — it owns the
 * reservation list and the uniqueness check across all four products. This is
 * the narrower question of whether a slug is *shaped* like a usable DNS label,
 * re-checked here because the slug arrives over the network and ends up in a
 * hostname this app serves.
 *
 * Deliberately not a copy of the console's reservation rules. Duplicating those
 * would mean two lists to keep in sync and a guaranteed drift; duplicating the
 * format check costs six lines and removes a trust assumption.
 */

/** Starts with a letter; 2-31 characters of lowercase alphanumerics and hyphens. */
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

export function checkSlugFormat(slug: string): boolean {
  if (!SLUG_PATTERN.test(slug)) return false;

  // Both pass the pattern but are invalid as DNS labels: a label may not end in
  // a hyphen, and "--" is reserved as the punycode prefix marker.
  if (slug.endsWith("-")) return false;
  if (slug.includes("--")) return false;

  return true;
}
