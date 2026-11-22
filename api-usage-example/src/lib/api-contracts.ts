// Kontrakty wejścia publicznych tras API: walidacja w jednym miejscu, przed jakąkolwiek pracą.
// Zwracają albo poprawne, znormalizowane dane, albo komunikat błędu dla odpowiedzi 400.
import { routing, type Locale } from "../i18n/routing.ts";
import { isInPoland } from "./region.ts";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const NEAREST_MAX_LIMIT = 20;
export const GEOCODE_MIN_LENGTH = 2;
export const GEOCODE_MAX_LENGTH = 120;

/** GET /api/aed/nearest?lat=52.23&lon=21.01&limit=5 */
export function parseNearestQuery(sp: URLSearchParams): Parsed<{ lat: number; lon: number; limit: number }> {
  const lat = Number(sp.get("lat") ?? Number.NaN);
  const lon = Number(sp.get("lon") ?? Number.NaN);
  if (!isInPoland(lat, lon)) return { ok: false, error: "lat/lon poza obszarem Polski lub nieprawidłowe" };
  const limit = Math.min(Math.max(Math.trunc(Number(sp.get("limit") ?? 5)) || 5, 1), NEAREST_MAX_LIMIT);
  return { ok: true, value: { lat, lon, limit } };
}

/** GET /api/geocode?q=Marszałkowska 1&lang=pl */
export function parseGeocodeQuery(sp: URLSearchParams): Parsed<{ q: string; lang: Locale }> {
  const q = (sp.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, GEOCODE_MAX_LENGTH);
  if (q.length < GEOCODE_MIN_LENGTH) return { ok: false, error: "q" };
  const raw = sp.get("lang");
  const lang = (routing.locales as readonly string[]).includes(raw ?? "") ? (raw as Locale) : routing.defaultLocale;
  return { ok: true, value: { q, lang } };
}

/** Wynik wyszukiwania adresu: odpowiedź /api/geocode i dane formularza wyszukiwarki. */
export type Place = { name: string; lat: number; lon: number };
export type GeocodeResponse = { places: Place[] };

/** Porządkuje wyniki dowolnego geokodera: tylko obszar danych, bez powtórzeń nazw, skrócone nazwy. */
export function normalizePlaces(raw: readonly Place[]): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const p of raw) {
    const name = p.name.split(", ").slice(0, 5).join(", ").slice(0, 110);
    if (!isInPoland(p.lat, p.lon) || seen.has(name)) continue;
    seen.add(name);
    places.push({ name, lat: p.lat, lon: p.lon });
  }
  return places;
}
