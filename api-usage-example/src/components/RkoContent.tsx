"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "./Icon";
import { Metronome } from "./Metronome";

const STEPS = ["reaction", "help", "airway", "call", "compress", "breaths", "aed", "continue"] as const;

export function RkoContent() {
  const t = useTranslations("rko");

  return (
    <div className="page">
      <div className="page__inner">
        <h1>{t("title")}</h1>
        <p className="lead">{t("intro")}</p>

        <section className="call112" aria-labelledby="call112-title">
          <h2 id="call112-title">{t("callTitle")}</h2>
          <p>{t("callHint")}</p>
          <a className="btn btn--red" href="tel:112">
            <Icon name="phone" />
            {t("callButton")}
          </a>
        </section>

        <ol className="steps" aria-label={t("stepsLabel")}>
          {STEPS.map((key) => (
            <li key={key}>
              {/* i18n-dynamic: rko.steps.* */}
              <h2>{t(`steps.${key}.title`)}</h2>
              <p>{t(`steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>

        <Metronome />

        <p className="draft">{t("draftNotice")}</p>

        <Link href="/" className="btn">
          <Icon name="map" />
          {t("findAed")}
        </Link>
        <p className="help">{t("source")}</p>
      </div>
    </div>
  );
}
