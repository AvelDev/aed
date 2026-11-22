import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/locale";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RkoContent } from "@/components/RkoContent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("rkoTitle") };
}

export default async function RkoPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  return <RkoContent />;
}
