"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { loadDataset, nearestTo, pickPrimary, localizedLocation, NEARBY_LIMIT_M, type Dataset } from "@/lib/aed-data";
import { walkMinutes } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useMediaQuery, WIDE_QUERY } from "@/hooks/useMediaQuery";
import { useOnline } from "@/hooks/useOnline";
import { AddressSearch, type Place } from "./AddressSearch";
import { AedActions, AedResult, StatusBadge } from "./AedResult";
import { Icon } from "./Icon";
import { Progress } from "./Progress";
import { clampLevel, SheetHandle, type SheetLevel } from "./SheetHandle";
import { useFormatDistance } from "./useFormatDistance";

// MapLibre jest duży i potrzebny dopiero po stronie klienta.
const AedMap = dynamic(() => import("./AedMap"), { ssr: false, loading: () => <div className="map" /> });

type Manual = { lat: number; lon: number; name: string } | null;

/** Ile najbliższych punktów rozważamy przy wyborze głównego AED. */
const CANDIDATES = 12;

// Zmiana języka odtwarza ekran (Next montuje segment [locale] od nowa). Stan widoku trzymamy w module,
// żeby wybrane miejsce i rozwinięty arkusz przetrwały zmianę języka. Nic z tego nie jest zapisywane na dysku.
const kept: { manual: Manual; level: SheetLevel } = { manual: null, level: 0 };

export function Finder() {
  const t = useTranslations("finder");
  const ta = useTranslations("a11y");
  const ts = useTranslations("status");
  const locale = useLocale();
  const format = useFormatter();
  const distance = useFormatDistance();
  const online = useOnline();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [dataError, setDataError] = useState(false);
  const [dataTry, setDataTry] = useState(0);
  const { gps, retry } = useGeolocation();
  const [manual, setManualState] = useState<Manual>(kept.manual);
  const setManual = (m: Manual) => {
    kept.manual = m;
    setManualState(m);
  };
  const [sel, setSel] = useState<{ forPrimary: string | null; id: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [level, setLevelState] = useState<SheetLevel>(kept.level);
  const setLevel = (v: number | ((l: SheetLevel) => number)) => {
    const next = clampLevel(typeof v === "function" ? v(kept.level) : v);
    kept.level = next;
    setLevelState(next);
  };
  const wide = useMediaQuery(WIDE_QUERY);
  const [now, setNow] = useState(() => new Date());
  const [bottomPad, setBottomPad] = useState(0);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    loadDataset(ctrl.signal)
      .then(setDataset)
      .catch((e: Error) => e.name !== "AbortError" && setDataError(true));
    return () => ctrl.abort();
  }, [dataTry]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Wysokość arkusza na telefonie: mapa kadruje wynik ponad nim.
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const mq = window.matchMedia(WIDE_QUERY);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      clearTimeout(timer);
      // Poczekaj, aż animacja arkusza się skończy, żeby mapa nie kadrowała się w trakcie ruchu.
      timer = setTimeout(() => setBottomPad(mq.matches ? 0 : el.getBoundingClientRect().height), 160);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    mq.addEventListener("change", measure);
    measure();
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      mq.removeEventListener("change", measure);
    };
  }, []);

  const origin = manual
    ? { lat: manual.lat, lon: manual.lon }
    : gps.status === "ok"
      ? { lat: gps.lat, lon: gps.lon }
      : null;
  const originLat = origin?.lat;
  const originLon = origin?.lon;

  const pick = useMemo(() => {
    if (!dataset || originLat === undefined || originLon === undefined) return null;
    return pickPrimary(nearestTo(dataset, originLat, originLon, CANDIDATES, now));
    // "now" zmienia się co minutę, żeby stan "otwarte teraz" był aktualny.
  }, [dataset, originLat, originLon, now]);

  // Wybór obowiązuje tylko dla bieżącego głównego wyniku; nowa lokalizacja wraca do najbliższego.
  const primaryId = pick?.primary?.id ?? null;
  const selectedId = sel && sel.forPrimary === primaryId ? sel.id : null;
  const selected = pick?.primary
    ? ([pick.primary, ...pick.others].find((f) => f.id === selectedId) ?? pick.primary)
    : null;
  const isPrimary = !!selected && selected.id === pick?.primary?.id;

  // Komunikat dla czytnika ekranu: strefa aria-live jest w DOM od początku, więc zmiana tekstu jest ogłaszana.
  const announce = pick?.primary
    ? ta("nearestFound", {
        name: localizedLocation(pick.primary, locale).text || t("noDescription"),
        distance: distance(pick.primary.distance),
        status: ts(pick.primary.availability),
      })
    : "";

  const onPick = useCallback((p: Place) => setManual({ lat: p.lat, lon: p.lon, name: p.name }), []);

  const showOnMap = (id: string) => {
    setSel({ forPrimary: primaryId, id });
    sheet.current?.scrollTo({ top: 0 });
  };

  const farAway = pick?.primary && pick.primary.distance > NEARBY_LIMIT_M;
  const hasResult = !!selected && !farAway;
  const collapsed = hasResult && level === 0 && !wide;

  return (
    <div className="finder" data-full={hasResult && level === 2 && !wide ? "" : undefined}>
      <AddressSearch onPick={onPick} />

      <section
        ref={sheet}
        className={`sheet${hasResult ? " sheet--rise" : ""}`}
        data-state={collapsed ? "peek" : level === 2 && !wide ? "max" : "full"}
        aria-labelledby="sheet-title"
        onClick={(e) => {
          // Dotknięcie paska (poza uchwytem) rozwija szczegóły.
          if (collapsed && !(e.target as HTMLElement).closest(".sheet__handle")) setLevel(1);
        }}
      >
        {hasResult && !wide && <SheetHandle sheet={sheet} level={level} onLevel={setLevel} />}
        <div className="sheet__scroll" id="sheet-body" inert={collapsed}>
          <h1 className="sr-only" id="sheet-title">
            {t("title")}
          </h1>

          {!online && dataset && <p className="notice">{t("offlineNotice")}</p>}

          {dataError && (
            <div className="state" role="alert">
              <p className="state__title">{t("dataError")}</p>
              <p className="help">{t("dataErrorHelp")}</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDataError(false);
                  setDataTry((n) => n + 1);
                }}
              >
                {t("retry")}
              </button>
            </div>
          )}

          {!dataError && (!dataset || (!origin && gps.status === "locating")) && (
            <Progress
              steps={[
                { key: "data", state: dataset ? "done" : "active" },
                { key: "location", state: origin ? "done" : "active" },
                { key: "nearest", state: dataset && origin ? "active" : "todo" },
              ]}
            />
          )}

          {!dataError && dataset && !origin && (gps.status === "denied" || gps.status === "unavailable") && (
            <div className="state" role="alert">
              <p className="state__title">{gps.status === "denied" ? t("denied") : t("unavailable")}</p>
              <p className="help">{gps.status === "denied" ? t("deniedHelp") : t("unavailableHelp")}</p>
              <button type="button" className="btn" onClick={retry}>
                <Icon name="locate" />
                {t("retry")}
              </button>
            </div>
          )}

          {!dataError && dataset && origin && pick && farAway && pick.primary && (
            <div className="state">
              <p className="state__title">{t("noneNearby", { km: NEARBY_LIMIT_M / 1000 })}</p>
              <p className="help">{t("noneNearbyHelp", { distance: distance(pick.primary.distance) })}</p>
            </div>
          )}

          {!dataError && dataset && selected && !farAway && (
            <>
              <AedResult
                found={selected}
                title={isPrimary ? (pick?.restricted ? t("nearestRestricted") : t("nearest")) : t("selected")}
              />

              {!isPrimary && pick?.primary && (
                <button type="button" className="btn btn--quiet btn--small" onClick={() => setSel(null)}>
                  <Icon name="arrowUp" />
                  {t("backToNearest")}
                </button>
              )}

              {pick && pick.others.length > 0 && (
                <>
                  <button
                    type="button"
                    className="more"
                    aria-expanded={expanded}
                    aria-controls="others"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    <span>{t("others")}</span>
                    <Icon name="chevronDown" />
                  </button>
                  <ol id="others" className="others" hidden={!expanded}>
                    {pick.others.map((o) => {
                      const place = localizedLocation(o, locale);
                      return (
                        <li key={o.id}>
                          <button type="button" className="other" onClick={() => showOnMap(o.id)}>
                            <span className="other__distance">{distance(o.distance)}</span>
                            <span className="other__place" lang={place.original ? "pl" : undefined}>
                              {place.text || t("noDescription")}
                            </span>
                            <span className="other__status">
                              <StatusBadge availability={o.availability} />{" "}
                              {t("walk", { minutes: walkMinutes(o.distance) })}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
              <p className="legend">{t("map.legend")}</p>
            </>
          )}

          {dataset && (
            <p className="legend">
              {t("dataDate", { date: format.dateTime(new Date(`${dataset.generatedAt}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" }) })}
            </p>
          )}
        </div>
        {!dataError && dataset && selected && !farAway && (
          <AedActions found={selected} onShowOnMap={() => showOnMap(selected.id)} />
        )}
      </section>

      <AedMap
        dataset={dataset}
        user={origin}
        selected={selected ? { id: selected.id, lat: selected.lat, lon: selected.lon } : null}
        bottomPad={bottomPad}
        manual={!!manual}
        onLocate={() => {
          setManual(null);
          if (gps.status !== "ok") retry();
        }}
        onSelect={showOnMap}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
