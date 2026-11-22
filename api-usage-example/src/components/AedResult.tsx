"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { localizedLocation, type Found } from "@/lib/aed-data";
import { formatSchedule } from "@/lib/openingHours";
import { compassKey, walkMinutes } from "@/lib/geo";
import { AVAILABILITY } from "./availability";
import { Icon } from "./Icon";
import { useFormatDistance } from "./useFormatDistance";

export function routeUrl(a: { lat: number; lon: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=walking`;
}

export function StatusBadge({ availability }: { availability: Found["availability"] }) {
  // i18n-dynamic: status.*
  const t = useTranslations("status");
  const v = AVAILABILITY[availability];
  return (
    <span className={`badge badge--${v.kind}`}>
      <Icon name={v.icon} />
      {t(availability)}
    </span>
  );
}

export function AedResult({
  found,
  title,
}: {
  found: Found;
  title: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const distance = useFormatDistance();
  const place = localizedLocation(found, locale);
  const v = AVAILABILITY[found.availability];
  const compass = {
    n: t("finder.compass.n"), ne: t("finder.compass.ne"), e: t("finder.compass.e"), se: t("finder.compass.se"),
    s: t("finder.compass.s"), sw: t("finder.compass.sw"), w: t("finder.compass.w"), nw: t("finder.compass.nw"),
  }[compassKey(found.bearing)];

  const hoursLabels = { off: t("status.hoursOff"), publicHolidays: t("status.hoursPublicHolidays") };
  const hours = found.schedule
    ? formatSchedule(found.schedule, locale, hoursLabels)
    : found.hours
      ? t("status.hoursRaw", { raw: found.hours })
      : t("status.hoursUnknown");

  const checked = found.checked
    ? t("finder.checked", {
        date: format.dateTime(new Date(`${found.checked}T12:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }),
      })
    : t("finder.notChecked");

  return (
    <>
      <h2 className="result__title">{title}</h2>

      <div className="result__distance">
        <span className="result__number">{distance(found.distance)}</span>
      </div>
      <p className="result__meta">
        <span>{t("finder.walk", { minutes: walkMinutes(found.distance) })}</span>
        <span className="result__dir">
          <Icon name="arrowUp" className="result__arrow" style={{ transform: `rotate(${Math.round(found.bearing)}deg)` }} />
          {t("finder.direction", { direction: compass })}
        </span>
      </p>

      <div>
        <StatusBadge availability={found.availability} />
      </div>
      {v.help && <p className="help">{t(`status.${v.help}`)}</p>}

      <h3 className="result__place">
        {place.text ? (
          <span lang={place.original ? "pl" : undefined}>{place.text}</span>
        ) : (
          t("finder.noDescription")
        )}
        {place.original && <span className="result__original">{t("finder.originalLanguage")}</span>}
      </h3>

      <dl className="facts">
        <div>
          <dt>{t("status.hoursLabel")}:</dt>
          <dd>{hours}</dd>
        </div>
        {found.indoor !== null && (
          <div>
            <dd>
              {found.indoor ? t("finder.indoor") : t("finder.outdoor")}
              {found.level && ` · ${t("finder.level", { level: found.level })}`}
            </dd>
          </div>
        )}
        {found.operator && (
          <div>
            <dd>{t("finder.operator", { operator: found.operator })}</dd>
          </div>
        )}
        <div>
          <dd>{checked}</dd>
        </div>
      </dl>

    </>
  );
}

// Przyciski stoją poza przewijaną treścią arkusza, więc są widoczne zawsze.
export function AedActions({ found, onShowOnMap }: { found: Found; onShowOnMap: () => void }) {
  const t = useTranslations();
  return (
    <div className="actions">
      <a className="btn" href={routeUrl(found)} target="_blank" rel="noopener noreferrer">
        <Icon name="route" />
        {t("finder.route")}
        <span className="sr-only">
          {" "}
          {t("finder.routeExternal")}. {t("a11y.externalLink")}
        </span>
      </a>
      <button type="button" className="btn btn--quiet" onClick={onShowOnMap}>
        <Icon name="pin" />
        {t("finder.showOnMap")}
      </button>
    </div>
  );
}
