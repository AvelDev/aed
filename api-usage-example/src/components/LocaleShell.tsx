"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { replaceLocalePrefix, type Locale } from "@/i18n/routing";
import { TIME_ZONE } from "@/lib/region";

type Messages = Record<Locale, Record<string, unknown>>;

const Switch = createContext<(l: Locale) => void>(() => {});

/** Przełącza język bez nawigacji: wszystkie tłumaczenia są już w przeglądarce, adres zmienia się przez history.replaceState. */
export function useSwitchLocale() {
  return useContext(Switch);
}

function DocumentMeta({ locale }: { locale: Locale }) {
  const t = useTranslations("meta");
  // Surowa ścieżka z przeglądarki: tuż po zmianie języka może mieć już nowy prefiks, a router jeszcze stary.
  const path = replaceLocalePrefix(usePathname(), "");
  const title = path === "/rko" ? t("rkoTitle") : path === "/about" ? t("aboutTitle") : t("title");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = title;
  }, [locale, title]);
  return null;
}

export function LocaleShell({
  initial,
  messages,
  children,
}: {
  initial: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initial);

  const change = (next: Locale) => {
    if (next === locale) return;
    const { pathname, search, hash } = window.location;
    const path = replaceLocalePrefix(pathname, next);
    window.history.replaceState(window.history.state, "", path + search + hash);
    setLocale(next);
  };

  return (
    <Switch.Provider value={change}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone={TIME_ZONE}>
        <DocumentMeta locale={locale} />
        {children}
      </NextIntlClientProvider>
    </Switch.Provider>
  );
}
