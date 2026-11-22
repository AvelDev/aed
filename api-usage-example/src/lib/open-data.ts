// Otwarty zbiór AED do pobrania: kolumny, serializacja CSV/GeoJSON i metadane.
// Czyste funkcje bez sieci; wiersze dostarcza src/server/aed-source.ts z wykazu zbiorczego API dane-gov-pl-mirror.
// Kolumny „kontakt” (adresy e-mail i telefony) i „dane_zrodlowe” (surowy rekord) nie są eksportowane.

import type { WykazRow } from "./wykaz.ts";

/** Kolumny eksportu i ich opisy: jedno źródło dla nagłówka CSV, właściwości GeoJSON i metadanych. */
export const FIELDS = {
  id: "Identyfikator w wykazie zbiorczym: <id zbioru źródłowego>:<id w źródle>",
  zrodlo_zbior_id: "Identyfikator zbioru źródłowego w portalu",
  zrodlo_zbior_tytul: "Tytuł zbioru źródłowego",
  zrodlo_url: "Adres zbioru źródłowego w portalu",
  dysponent: "Instytucja udostępniająca dane źródłowe",
  licencja: "Licencja zbioru źródłowego",
  id_zrodlowe: "Identyfikator punktu w zbiorze źródłowym",
  nazwa: "Nazwa miejsca",
  adres: "Adres",
  miejscowosc: "Miejscowość",
  opis: "Opis lokalizacji urządzenia",
  godziny: "Godziny dostępności (zapis ze źródła)",
  dostep: "Dostęp: całodobowo (Tak/Nie/Ograniczona); rodzaj miejsca (Publiczny/Prywatny)",
  producent: "Producent urządzenia",
  szerokosc: "Szerokość geograficzna (WGS 84)",
  dlugosc: "Długość geograficzna (WGS 84)",
  korekty: "Poprawki wprowadzone podczas łączenia (np. zamienione współrzędne)",
} as const;

export type ExportColumn = keyof typeof FIELDS;
export type ExportValue = string | number | boolean | null;
export type ExportRow = Record<ExportColumn, ExportValue>;
export const EXPORT_COLUMNS = Object.keys(FIELDS) as ExportColumn[];

/** Wiersz wykazu ograniczony do kolumn eksportu (brakujące jako null). */
export function toExportRow(row: WykazRow): ExportRow {
  return Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, row[c] ?? null])) as ExportRow;
}

/** Komórka CSV; tekst zaczynający się od = + - @ dostaje apostrof (ochrona przed formułami w arkuszu). */
export function csvCell(v: ExportValue | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV z BOM (Excel poprawnie czyta polskie znaki) i końcami linii CRLF. */
export function toCsv(rows: readonly ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(","), ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export type Source = {
  /** Adres zbioru łączonego w portalu (strona dla ludzi). */
  datasetUrl: string;
  /** Adres API danych zasobu, z którego pochodzi wykaz. */
  apiUrl: string;
  license: string;
  /** Data danych zasobu (RRRR-MM-DD). */
  dataDate: string;
};

export function toGeoJson(rows: readonly ExportRow[], source: Source) {
  return {
    type: "FeatureCollection" as const,
    license: source.license,
    source: source.datasetUrl,
    features: rows.map(({ szerokosc, dlugosc, ...props }) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(dlugosc), Number(szerokosc)] },
      properties: { ...props, emergency: "defibrillator" },
    })),
  };
}

export function metadata(records: number, source: Source) {
  return {
    title: "Defibrylatory AED w Polsce",
    description:
      "Lokalizacje defibrylatorów AED z wykazu zbiorczego „Defibrylatory AED w Polsce – zbiór łączony” w portalu dane.gov.pl, " +
      "który łączy zbiory AED opublikowane przez różnych dostawców. Zbiór przygotowany w ramach konkursu „Misja AED – Dane na ratunek”.",
    source: source.datasetUrl,
    api: source.apiUrl,
    license: source.license,
    dataDate: source.dataDate,
    records,
    format: ["text/csv", "application/geo+json"],
    coordinateSystem: "WGS 84 (EPSG:4326)",
    personalData: {
      removed: ["kontakt", "dane_zrodlowe"],
      note: "Dane kontaktowe z wykazu (e-mail, telefon) i surowe rekordy źródłowe nie są częścią eksportu.",
    },
    fields: FIELDS,
  };
}
