"use client";

import { ChevronDown } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const LOCALES = ["EN", "ES"] as const;
type Locale = (typeof LOCALES)[number];

const LOCALE_STORAGE_KEY = "steward-locale";

export function LangSwitcher({ churchSlug }: { churchSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [locale, setLocale] = useState<Locale>("EN");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Resolution order: URL param → stored locale → browser Accept-Language → default (EN)
    const fromParam = searchParams.get("lang")?.toUpperCase();
    if (fromParam === "EN" || fromParam === "ES") {
      setLocale(fromParam);
      localStorage.setItem(`${LOCALE_STORAGE_KEY}-${churchSlug}`, fromParam);
      return;
    }
    const stored = localStorage.getItem(`${LOCALE_STORAGE_KEY}-${churchSlug}`);
    if (stored === "EN" || stored === "ES") {
      setLocale(stored);
      return;
    }
    // Detect browser language — prefer Spanish if any Spanish variant present
    const browserLangs = navigator.languages ?? [navigator.language];
    const hasSpanish = browserLangs.some((l) => l.toLowerCase().startsWith("es"));
    if (hasSpanish) {
      setLocale("ES");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchLocale(next: Locale) {
    setLocale(next);
    setOpen(false);
    localStorage.setItem(`${LOCALE_STORAGE_KEY}-${churchSlug}`, next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", next.toLowerCase());
    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch language"
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
      >
        {locale}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                  l === locale ? "font-semibold" : "text-slate-700"
                }`}
                style={l === locale ? { color: "var(--color-accent, #10b981)" } : undefined}
              >
                {l === "EN" ? "English" : "Español"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
