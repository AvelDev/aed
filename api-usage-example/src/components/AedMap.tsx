"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { classify, type Dataset } from "@/lib/aed-data";
import { WIDE_QUERY } from "@/hooks/useMediaQuery";
import { BRAND_COLORS } from "@/lib/brand";
import { Icon } from "./Icon";

type Props = {
  dataset: Dataset | null;
  user: { lat: number; lon: number } | null;
  selected: { id: string; lat: number; lon: number } | null;
  bottomPad: number;
  manual: boolean;
  onLocate: () => void;
  onSelect: (id: string) => void;
};

// Next.js (Turbopack) emituje worker MapLibre jako zahaszowany plik; bez tego mapa się nie rysuje.
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const { red: RED, ink: INK, white: WHITE } = BRAND_COLORS;

export default function AedMap({ dataset, user, selected, bottomPad, manual, onLocate, onSelect }: Props) {
  const t = useTranslations("finder.map");
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userMarker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [sizeTick, setSizeTick] = useState(0);
  const userMoved = useRef(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  const reduced = useRef(false);

  // Punkty z klasą dostępności: tier 0 = pełne kółko, pozostałe = puste (nie tylko kolor).
  const geojson = useMemo(() => {
    if (!dataset) return EMPTY;
    const now = new Date();
    return {
      type: "FeatureCollection" as const,
      features: dataset.items.map((a) => ({
        type: "Feature" as const,
        properties: { id: a.id, tier: classify(a, now).tier === 0 ? 0 : 1 },
        geometry: { type: "Point" as const, coordinates: [a.lon, a.lat] },
      })),
    };
  }, [dataset]);

  useEffect(() => {
    if (!box.current || mapRef.current) return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [19.4, 52.1],
      zoom: 5.4,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
      locale: { "Map.Title": t("label") },
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    const init = () => {
      map.addSource("aed", { type: "geojson", data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 12 });
      map.addLayer({
        id: "aed-clusters",
        type: "circle",
        source: "aed",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": INK,
          "circle-stroke-color": WHITE,
          "circle-stroke-width": 3,
          "circle-radius": ["step", ["get", "point_count"], 12, 20, 16, 100, 20, 500, 26],
        },
      });
      map.addLayer({
        id: "aed-points",
        type: "circle",
        source: "aed",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["==", ["get", "tier"], 0], RED, WHITE],
          "circle-stroke-color": ["case", ["==", ["get", "tier"], 0], WHITE, RED],
          "circle-stroke-width": 3,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 12, 9, 17, 13],
        },
      });
      map.addSource("selected", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "selected",
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": INK,
          "circle-stroke-width": 4,
          "circle-radius": 17,
        },
      });

      map.on("click", "aed-points", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      map.on("click", "aed-clusters", (e: MapLayerMouseEvent) => {
        map.easeTo({ center: e.lngLat, zoom: Math.min(map.getZoom() + 2, 15), duration: reduced.current ? 0 : 400 });
      });
      for (const layer of ["aed-points", "aed-clusters"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      setReady(true);
    };
    if (map.isStyleLoaded()) init();
    else map.once("style.load", init);

    map.on("error", () => setTileErrors((n) => n + 1));

    // Po zmianie rozmiaru kontenera dopasowujemy widok ponownie, dopóki użytkownik sam nie przesunął mapy.
    map.on("dragstart", () => (userMoved.current = true));
    const ro = new ResizeObserver(() => {
      map.resize();
      if (!userMoved.current) setSizeTick((n) => n + 1);
    });
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Mapa tworzona raz; etykieta języka ustawiana przy starcie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("aed") as GeoJSONSource | undefined)?.setData(geojson);
  }, [ready, geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("selected") as GeoJSONSource | undefined)?.setData(
      selected
        ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [selected.lon, selected.lat] } }
        : EMPTY,
    );
  }, [ready, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    let marker = userMarker.current;
    if (!marker) {
      const el = document.createElement("div");
      el.className = "user-dot";
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", t("youAreHere"));
      marker = new maplibregl.Marker({ element: el });
      userMarker.current = marker;
    }
    marker.setLngLat([user.lon, user.lat]).addTo(map);
  }, [ready, user, t]);

  // Kadrowanie: użytkownik i wybrany AED w polu widzenia, ponad arkuszem na telefonie.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    userMoved.current = false;
    const duration = reduced.current ? 0 : 700;
    // Odstępy z rzeczywistych nakładek: wyszukiwarka u góry i arkusz u dołu nie mogą zasłaniać punktów.
    const wide = window.matchMedia(WIDE_QUERY).matches;
    const mapTop = map.getContainer().getBoundingClientRect().top;
    const searchBottom = document.querySelector(".search")?.getBoundingClientRect().bottom ?? mapTop;
    const { clientHeight: height, clientWidth: width } = map.getContainer();
    if (height < 200 || width < 200) return; // kontener jeszcze bez rozmiaru; sizeTick wywoła kadrowanie ponownie
    let top = (wide ? 0 : Math.max(0, searchBottom - mapTop)) + 36;
    let bottom = bottomPad + 36;
    // Przy bardzo wysokim arkuszu zostaw choć kawałek mapy do kadrowania (inaczej MapLibre odmawia dopasowania).
    const room = height - 120;
    if (top + bottom > room) {
      const k = Math.max(0, room) / (top + bottom);
      top = Math.round(top * k);
      bottom = Math.round(bottom * k);
    }
    const padding = { top, bottom, left: 48, right: 72 };
    if (user && selected) {
      const b = new maplibregl.LngLatBounds([user.lon, user.lat], [user.lon, user.lat]).extend([selected.lon, selected.lat]);
      map.fitBounds(b, { padding, maxZoom: 17, duration });
    } else if (user) {
      map.easeTo({ center: [user.lon, user.lat], zoom: 14, padding, duration });
    }
    // sizeTick: ponowne dopasowanie po ustaleniu rozmiaru kontenera.
  }, [ready, user, selected, bottomPad, sizeTick]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine && tileErrors > 3;

  return (
    <div className="map">
      <div ref={box} className="map__canvas" aria-describedby="map-hint" />
      <p id="map-hint" className="sr-only">
        {t("hint")} {t("legend")}
      </p>
      <div className="map__ctrl" style={{ "--map-pad": `${bottomPad}px` } as CSSProperties}>
        <button
          type="button"
          className="map__btn"
          aria-label={t("recenter")}
          onClick={() => {
            // Wybrane miejsce albo brak lokalizacji: wróć do GPS; w przeciwnym razie tylko wycentruj mapę.
            if (!user || manual) onLocate();
            else mapRef.current?.easeTo({ center: [user.lon, user.lat], zoom: 15, duration: reduced.current ? 0 : 500 });
          }}
        >
          <Icon name="locate" />
        </button>
        <button type="button" className="map__btn" aria-label={t("zoomIn")} onClick={() => mapRef.current?.zoomIn()}>
          <Icon name="plus" />
        </button>
        <button type="button" className="map__btn" aria-label={t("zoomOut")} onClick={() => mapRef.current?.zoomOut()}>
          <Icon name="minus" />
        </button>
      </div>
      {offline && (
        <p className="map__offline" role="status">
          {t("unavailable")}
        </p>
      )}
    </div>
  );
}
