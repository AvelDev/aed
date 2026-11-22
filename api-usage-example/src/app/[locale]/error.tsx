"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <div className="page">
      <div className="page__inner" role="alert">
        <h1>{t("errorTitle")}</h1>
        <p className="lead">{t("errorBody")}</p>
        <button type="button" className="btn" onClick={reset}>
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
