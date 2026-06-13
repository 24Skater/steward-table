import type { Locale } from "./locales";

const LOCALE_BCP47: Record<Locale, string> = {
  EN: "en-US",
  ES: "es-US",
};

/**
 * formatCurrency — formats a cents integer into a locale-aware currency string.
 *
 * @param cents     Amount in the smallest currency unit (e.g. 150 → $1.50)
 * @param currency  ISO 4217 currency code (e.g. 'USD')
 * @param locale    Customer locale from the Locale enum
 * @returns         Formatted string, e.g. "$1.50" or "US$1.50"
 */
export function formatCurrency(cents: number, currency: string, locale: Locale): string {
  const amount = cents / 100;

  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
