import type { Metadata, Viewport } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { resolveLocale } from "@/i18n/locale";
import { BottomNav, Header, SkipLink } from "@/components/Chrome";
import { LocaleShell } from "@/components/LocaleShell";
import { PrefsScript } from "@/components/PrefsScript";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import pl from "../../../messages/pl.json";
import en from "../../../messages/en.json";
import uk from "../../../messages/uk.json";
import "../globals.css";

const ALL_MESSAGES = { pl, en, uk };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    applicationName: "Misja AED",
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "Misja AED", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

// Zoom nie jest blokowany (WCAG 1.4.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <PrefsScript />
        <LocaleShell initial={locale} messages={ALL_MESSAGES}>
          <SkipLink />
          <div className="app">
            <Header />
            <main id="main" className="main" tabIndex={-1}>
              {children}
            </main>
            <BottomNav />
          </div>
          <ServiceWorkerRegister />
        </LocaleShell>
      </body>
    </html>
  );
}
