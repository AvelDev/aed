import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "./routing";

/** Zwraca zwalidowany język z parametrów trasy; nieznany język to 404. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}
