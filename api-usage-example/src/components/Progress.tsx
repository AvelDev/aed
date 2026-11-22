"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./Icon";

type StepState = "done" | "active" | "todo";
type Step = { key: "data" | "location" | "nearest"; state: StepState };

/** Ładowanie jako lista kroków: widać, co aplikacja robi teraz, co już zrobiła i co jeszcze czeka. */
export function Progress({ steps }: { steps: Step[] }) {
  const t = useTranslations("finder.progress");
  const labels = { data: t("data"), location: t("location"), nearest: t("nearest") };
  const states = { done: t("done"), active: t("active"), todo: t("todo") };
  const doing = steps.find((s) => s.state === "active");

  return (
    <div className="progress" role="status">
      <h2 className="progress__title">{t("title")}</h2>
      <ol className="progress__steps">
        {steps.map((s) => (
          <li key={s.key} data-state={s.state}>
            <span className="progress__mark" aria-hidden="true">
              {s.state === "done" && <Icon name="checkCircle" />}
              {s.state === "active" && <span className="spinner" />}
              {s.state === "todo" && <span className="progress__dot" />}
            </span>
            <span>
              {labels[s.key]}
              <span className="sr-only">: {states[s.state]}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="progress__bar" aria-hidden="true">
        <span />
      </div>
      {doing && <p className="help">{t("help")}</p>}
    </div>
  );
}
