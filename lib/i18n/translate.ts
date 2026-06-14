/**
 * translate — resolves a localized field value from a Prisma Json? translations blob.
 *
 * Expected blob shape:
 *   { "es": { "name": "...", "description": "..." } }
 *
 * @param defaultValue  The field's base (English) value stored on the model
 * @param translations  The raw `Json?` value from Prisma (may be null/undefined)
 * @param locale        Customer locale from the Locale enum
 * @param field         Which field to look up inside the locale key (default: 'name')
 * @returns             Translated string when available, otherwise `defaultValue`
 */
export function translate(
  defaultValue: string,
  translations: unknown,
  locale: "EN" | "ES",
  field = "name",
): string {
  if (locale === "EN") {
    return defaultValue;
  }

  // Guard: translations must be a plain object
  if (translations === null || typeof translations !== "object") {
    return defaultValue;
  }

  const blob = translations as Record<string, unknown>;
  const esBlock = blob.es;

  if (esBlock === null || typeof esBlock !== "object") {
    return defaultValue;
  }

  const esFields = esBlock as Record<string, unknown>;
  const translated = esFields[field];

  if (typeof translated === "string" && translated.length > 0) {
    return translated;
  }

  return defaultValue;
}
