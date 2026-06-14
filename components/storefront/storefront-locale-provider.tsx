"use client";

import { STOREFRONT_STRINGS } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/locales";
import { useSearchParams } from "next/navigation";
import { createContext, useContext } from "react";

type AnyLocaleStrings = (typeof STOREFRONT_STRINGS)[Locale];

const StorefrontLocaleContext = createContext<AnyLocaleStrings>(STOREFRONT_STRINGS.EN);

export function StorefrontLocaleProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang")?.toUpperCase();
  const locale: Locale = lang === "ES" ? "ES" : "EN";
  return (
    <StorefrontLocaleContext.Provider value={STOREFRONT_STRINGS[locale]}>
      {children}
    </StorefrontLocaleContext.Provider>
  );
}

export function useStorefrontStrings(): AnyLocaleStrings {
  return useContext(StorefrontLocaleContext);
}
