// Wykaz zbiorczy AED z API dane-gov-pl-mirror (dane.gov.pl): odczyt odpowiedzi API i mapowanie na rekordy aplikacji.
// Czyste funkcje, bez sieci; pobieranie robi src/server/aed-source.ts.
//
// Źródło: GET {AED_API_URL}/resources/{AED_RESOURCE_ID}/data, zasób „Defibrylatory AED – wykaz zbiorczy”
// w zbiorze „Defibrylatory AED w Polsce – zbiór łączony”. API zwraca wiersze jako col1…colN,
// a nazwy kolumn podaje w meta.headers_map.

import type { AccessCode, Aed } from "./dataset-format.ts";
import { isInPoland } from "./region.ts";

/** Kolumny wykazu zbiorczego (kolejność jak w API). */
export const WYKAZ_COLUMNS = [
  "id", "zrodlo_zbior_id", "zrodlo_zbior_tytul", "zrodlo_url", "dysponent", "licencja", "id_zrodlowe",
  "nazwa", "adres", "miejscowosc", "opis", "godziny", "dostep", "kontakt", "producent",
  "szerokosc", "dlugosc", "korekty", "dane_zrodlowe",
] as const;

export type WykazColumn = (typeof WYKAZ_COLUMNS)[number];
export type WykazValue = string | number | null;
export type WykazRow = Partial<Record<WykazColumn, WykazValue>>;

/** Strona odpowiedzi API danych zasobu (JSON:API portalu dane.gov.pl). */
export type ApiDataPage = {
  data?: { attributes?: Record<string, { val?: WykazValue } | undefined> }[];
  meta?: { count?: number; headers_map?: Record<string, string> };
  links?: { next?: string | null };
};

/** Wiersze jednej strony API z nazwami kolumn zamiast col1…colN. Nieznane kolumny są pomijane. */
export function rowsFromPage(page: ApiDataPage): WykazRow[] {
  const map = page.meta?.headers_map ?? {};
  return (page.data ?? []).map((item) => {
    const row: WykazRow = {};
    for (const [col, cell] of Object.entries(item.attributes ?? {})) {
      const name = map[col] as WykazColumn | undefined;
      if (name && (WYKAZ_COLUMNS as readonly string[]).includes(name)) row[name] = cell?.val ?? null;
    }
    return row;
  });
}

const text = (v: WykazValue | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);

const num = (v: WykazValue | undefined) => {
  if (v === null || v === undefined || v === "") return NaN;
  return typeof v === "number" ? v : Number(String(v).replace(",", "."));
};

/**
 * Pole „dostep” wykazu ma postać „<całodobowo>; <rodzaj>”, np. „Tak; Publiczny”, „Nie; Prywatny”,
 * „Ograniczona; Publiczny”. Pierwsza część mówi, czy AED jest dostępny przez całą dobę, druga, czy miejsce jest publiczne.
 */
export function parseDostep(raw: WykazValue | undefined): { access: AccessCode; allDay: boolean } {
  const parts = text(raw).toLowerCase().split(";").map((s) => s.trim());
  const kind = parts.find((p) => /publiczn|prywatn/.test(p)) ?? "";
  const access: AccessCode = kind.includes("publiczn") ? "yes" : kind.includes("prywatn") ? "customers" : "unknown";
  return { access, allDay: parts[0] === "tak" };
}

/** Adres w jednym wierszu; miejscowość dopisana, jeśli nie ma jej już w adresie. */
export function fullAddress(row: WykazRow): string {
  const adres = text(row.adres);
  const miasto = text(row.miejscowosc);
  if (!miasto || adres.toLowerCase().includes(miasto.toLowerCase())) return adres;
  return adres ? `${adres}, ${miasto}` : miasto;
}

/**
 * Rekord wykazu na rekord aplikacji. Zwraca null, gdy punktu nie da się pokazać na mapie
 * (brak współrzędnych albo punkt poza obszarem danych): taki rekord nie może wskazać drogi do AED.
 */
export function wykazToAed(row: WykazRow): Aed | null {
  const id = text(row.id);
  const lat = num(row.szerokosc);
  const lon = num(row.dlugosc);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || !isInPoland(lat, lon)) return null;

  const { access, allDay } = parseDostep(row.dostep);
  const godziny = text(row.godziny);
  const nazwa = text(row.nazwa);
  const adres = fullAddress(row);
  const opis = text(row.opis);
  const miejsce = [nazwa, adres].filter(Boolean).join(" · ");

  return {
    id,
    lat,
    lon,
    access,
    indoor: null,
    // „Tak” w polu dostępu oznacza dostęp całodobowy; wtedy zapisujemy go składnią, którą rozumie parser godzin.
    hours: allDay && !godziny ? "24/7" : godziny,
    level: "",
    location: opis ? `${miejsce} — ${opis}` : miejsce,
    locationPl: "",
    locationEn: "",
    operator: text(row.dysponent),
    checked: "",
  };
}

/** Licencja wykazu: wspólna wartość kolumny „licencja”, a przy różnych wartościach ich lista. */
export function wykazLicense(rows: readonly WykazRow[]): string {
  const set = new Set(rows.map((r) => text(r.licencja)).filter(Boolean));
  return [...set].sort().join(", ");
}
