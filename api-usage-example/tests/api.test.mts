import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlaces, parseGeocodeQuery, parseNearestQuery, NEAREST_MAX_LIMIT } from "../src/lib/api-contracts.ts";
import {
  csvCell, EXPORT_COLUMNS, FIELDS, metadata, toCsv, toExportRow, toGeoJson, type ExportRow, type Source,
} from "../src/lib/open-data.ts";

const sp = (q: string) => new URLSearchParams(q);

test("nearest: poprawne zapytanie i domyślny limit", () => {
  assert.deepEqual(parseNearestQuery(sp("lat=52.23&lon=21.01")), { ok: true, value: { lat: 52.23, lon: 21.01, limit: 5 } });
});

test("nearest: limit przycięty do 1…max, śmieci dają domyślny", () => {
  const limit = (q: string) => {
    const r = parseNearestQuery(sp(`lat=52&lon=21&${q}`));
    return r.ok ? r.value.limit : null;
  };
  assert.equal(limit("limit=500"), NEAREST_MAX_LIMIT);
  assert.equal(limit("limit=-3"), 1);
  assert.equal(limit("limit=abc"), 5);
  assert.equal(limit("limit=2.7"), 2);
});

test("nearest: brak, NaN i współrzędne spoza Polski to błąd", () => {
  assert.equal(parseNearestQuery(sp("")).ok, false);
  assert.equal(parseNearestQuery(sp("lat=&lon=")).ok, false);
  assert.equal(parseNearestQuery(sp("lat=abc&lon=21")).ok, false);
  assert.equal(parseNearestQuery(sp("lat=48.85&lon=2.35")).ok, false);
});

test("geocode: tekst znormalizowany, język z listy lub domyślny", () => {
  assert.deepEqual(parseGeocodeQuery(sp("q=  Plac   Zamkowy &lang=uk")), { ok: true, value: { q: "Plac Zamkowy", lang: "uk" } });
  const r = parseGeocodeQuery(sp("q=Rynek&lang=de"));
  assert.ok(r.ok && r.value.lang === "pl");
  assert.equal(parseGeocodeQuery(sp("q=a")).ok, false);
  const long = parseGeocodeQuery(sp(`q=${"x".repeat(300)}`));
  assert.ok(long.ok && long.value.q.length === 120);
});

test("wyniki geokodera: poza Polską odrzucone, powtórzenia usunięte, nazwa skrócona", () => {
  const places = normalizePlaces([
    { name: "A, B, C, D, E, F, G", lat: 52, lon: 21 },
    { name: "A, B, C, D, E, inne", lat: 52.1, lon: 21.1 },
    { name: "Berlin", lat: 52.52, lon: 13.4 },
  ]);
  assert.deepEqual(places, [{ name: "A, B, C, D, E", lat: 52, lon: 21 }]);
});

test("CSV: ochrona przed formułami i cudzysłowy", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-5 piętro"), "'-5 piętro");
  assert.equal(csvCell(-5), "-5"); // liczby bez apostrofu
  assert.equal(csvCell('Hol "A", parter'), '"Hol ""A"", parter"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(false), "false");
});

const sample: ExportRow = toExportRow({
  id: "4:622", zrodlo_zbior_id: 4, nazwa: "Urząd", szerokosc: 52.1, dlugosc: 21.2,
  kontakt: "lo1@example.pl", dane_zrodlowe: "{}",
});
const source: Source = {
  datasetUrl: "http://localhost:4200/pl/dataset/5,defibrylatory-aed-w-polsce-zbior-aczony",
  apiUrl: "http://localhost:8001/1.4/resources/24/data",
  license: "CC BY 4.0",
  dataDate: "2026-11-22",
};

test("eksport: tylko kolumny z listy, bez danych kontaktowych i surowego rekordu", () => {
  assert.deepEqual(Object.keys(sample), EXPORT_COLUMNS);
  assert.equal("kontakt" in sample, false);
  assert.equal("dane_zrodlowe" in sample, false);
});

test("CSV: BOM, nagłówek z listy pól, CRLF", () => {
  const csv = toCsv([sample]);
  assert.ok(csv.startsWith("﻿id,zrodlo_zbior_id,zrodlo_zbior_tytul,"));
  const cells = csv.split("\r\n")[1].split(",");
  assert.equal(cells.length, EXPORT_COLUMNS.length);
  assert.equal(cells[EXPORT_COLUMNS.indexOf("id")], "4:622");
  assert.equal(cells[EXPORT_COLUMNS.indexOf("szerokosc")], "52.1");
  assert.ok(csv.endsWith("\r\n"));
});

test("GeoJSON: punkt [długość, szerokość], znacznik emergency, licencja i źródło", () => {
  const g = toGeoJson([sample], source);
  assert.deepEqual(g.features[0].geometry.coordinates, [21.2, 52.1]);
  assert.equal(g.features[0].properties.emergency, "defibrillator");
  assert.equal("szerokosc" in g.features[0].properties, false);
  assert.equal(g.license, "CC BY 4.0");
  assert.equal(g.source, source.datasetUrl);
});

test("metadane opisują dokładnie kolumny eksportu i wskazują źródło", () => {
  const m = metadata(42, source);
  assert.equal(m.records, 42);
  assert.deepEqual(Object.keys(m.fields), EXPORT_COLUMNS);
  assert.equal(m.fields, FIELDS);
  assert.equal(m.api, source.apiUrl);
  assert.equal(m.license, "CC BY 4.0");
});
