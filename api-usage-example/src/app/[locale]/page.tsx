import { setRequestLocale, getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { Finder } from "@/components/Finder";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations("finder");
  return (
    <>
      <noscript>
        <p className="noscript">{t("noScript")}</p>
      </noscript>
      <Finder />
    </>
  );
}
