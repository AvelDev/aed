"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { loadDataset } from "@/lib/aed-data";
import { Icon } from "./Icon";

type Meta = { count: number; generatedAt: string; license: string };

export function AboutContent() {
  const t = useTranslations("about");
  const format = useFormatter();
  // Te same dane co w wyszukiwarce (wykaz zbiorczy z API dane-gov-pl-mirror); po pierwszym pobraniu są w pamięci karty.
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    loadDataset(ctrl.signal)
      .then((ds) => setMeta({ count: ds.items.length, generatedAt: ds.generatedAt, license: ds.license }))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  const date = meta
    ? format.dateTime(new Date(`${meta.generatedAt}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" })
    : "…";

  return (
    <div className="page">
      <div className="page__inner">
        <h1>{t("title")}</h1>
        <p className="lead">{t("lead")}</p>

        <div className="sections">
          <section aria-labelledby="s-data">
            <h2 id="s-data">{t("data.title")}</h2>
            <p>
              {t("data.body", {
                count: meta ? format.number(meta.count) : "…",
                license: meta?.license || "…",
              })}
            </p>
            <p>{t("data.generated", { date })}</p>
          </section>

          <section aria-labelledby="s-privacy">
            <h2 id="s-privacy">{t("privacy.title")}</h2>
            <p>{t("privacy.body")}</p>
          </section>

          <section aria-labelledby="s-a11y">
            <h2 id="s-a11y">{t("accessibility.title")}</h2>
            <p>{t("accessibility.body")}</p>
          </section>

          <section aria-labelledby="s-open">
            <h2 id="s-open">{t("openData.title")}</h2>
            <p>{t("openData.body")}</p>
            <div className="downloads">
              <a className="btn btn--quiet" href="/api/export/aed.csv" download>
                <Icon name="route" />
                {t("openData.csv")}
              </a>
              <a className="btn btn--quiet" href="/api/export/aed.geojson" download>
                <Icon name="map" />
                {t("openData.geojson")}
              </a>
              <a className="btn btn--quiet" href="/api/export/metadata.json">
                <Icon name="info" />
                {t("openData.metadata")}
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
