import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="page">
      <div className="page__inner">
        <h1>{t("notFoundTitle")}</h1>
        <p className="lead">{t("notFoundBody")}</p>
        <Link href="/" className="btn">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
