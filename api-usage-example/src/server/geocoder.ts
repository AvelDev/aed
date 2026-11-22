import "server-only";
import { normalizePlaces, type Place } from "@/lib/api-contracts";
import type { Locale } from "@/i18n/routing";

/** Dostawca wyszukiwania adresów. Trasa API zna tylko ten interfejs, nie konkretną usługę. */
export interface Geocoder {
  search(q: string, lang: Locale): Promise<Place[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Nominatim (OpenStreetMap). Przez serwer idzie wyłącznie wpisany tekst: adres IP użytkownika nie
 * trafia do zewnętrznej usługi, a współrzędne użytkownika nie są tu w ogóle wysyłane. Zapytań nie logujemy.
 * Polityka usługi: maks. 1 zapytanie na sekundę, więc kolejkujemy i cache'ujemy wyniki na godzinę.
 */
export function createNominatimGeocoder({ ttlMs = 60 * 60 * 1000, gapMs = 1100, maxEntries = 500 } = {}): Geocoder {
  const cache = new Map<string, { at: number; places: Place[] }>();
  let nextSlot = 0;

  return {
    async search(q, lang) {
      const key = `${lang}|${q.toLowerCase()}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.places;

      const wait = Math.max(0, nextSlot - Date.now());
      nextSlot = Date.now() + wait + gapMs;
      if (wait) await sleep(wait);

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.search = new URLSearchParams({ q, format: "jsonv2", countrycodes: "pl", limit: "5", "accept-language": lang }).toString();
      const res = await fetch(url, {
        headers: { "User-Agent": "MisjaAED-prototype/0.1", Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`nominatim: ${res.status}`);
      const raw = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
      const places = normalizePlaces(raw.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) })));

      if (cache.size >= maxEntries) cache.clear();
      cache.set(key, { at: Date.now(), places });
      return places;
    },
  };
}

/** Geokoder aplikacji: jedna instancja na proces (wspólna kolejka i cache). */
export const geocoder: Geocoder = createNominatimGeocoder();
