import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pl", "en", "uk"],
  defaultLocale: "pl",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

// Nazwy języków zawsze we własnym języku (nie są tłumaczone).
export const LANGUAGE_NAMES: Record<Locale, string> = {
  pl: "Polski",
  en: "English",
  uk: "Українська",
};

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/** Zamienia prefiks języka w ścieżce (np. "/pl/rko" → "/en/rko"); pusty `next` usuwa prefiks. */
export function replaceLocalePrefix(pathname: string, next: Locale | ""): string {
  return pathname.replace(LOCALE_PREFIX, next ? `/${next}` : "") || "/";
}
