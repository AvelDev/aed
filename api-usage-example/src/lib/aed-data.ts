import { bearingDegrees, boundingBox, distanceMeters } from "./geo.ts";
import { openStateAt, parseOpeningHours, type OpenState, type Schedule } from "./openingHours.ts";
import { decodeDataset, type Aed, type DatasetColumns, type Dataset } from "./dataset-format.ts";

export type { AccessCode, Aed, Dataset } from "./dataset-format.ts";

/** Główny AED musi być „do podejścia” w tym promieniu; dalej pokazujemy najbliższy w ogóle. */
export const OPEN_AED_MAX_DISTANCE_M = 10_000;
/** Powyżej tej odległości nie prowadzimy do AED, tylko mówimy, że w pobliżu nic nie ma. */
export const NEARBY_LIMIT_M = 50_000;

// Zdekodowane dane zostają w pamięci karty: zmiana języka odtwarza ekran, ale nie pobiera ani nie dekoduje ich ponownie.
let cached: Dataset | null = null;

export async function loadDataset(signal?: AbortSignal): Promise<Dataset> {
  if (cached) return cached;
  const res = await fetch("/data/aed.json", { signal });
  if (!res.ok) throw new Error(`aed.json: ${res.status}`);
  cached = decodeDataset((await res.json()) as DatasetColumns);
  return cached;
}

export type Tier = 0 | 1 | 2;

/** Dostępność AED w danej chwili i jej poziom: 0 = można podejść, 1 = niepewne, 2 = ograniczone. */
export const AVAILABILITY_TIER = {
  open247: 0, openNow: 0, publicHoursUnknown: 0,
  customers: 1, unknown: 1, closedNow: 1,
  permit: 2, private: 2, noAccess: 2,
} as const satisfies Record<string, Tier>;

export type Availability = keyof typeof AVAILABILITY_TIER;

export type Classified = {
  availability: Availability;
  tier: Tier;
  schedule: Schedule | null;
  openState: OpenState;
};

export function classify(a: Aed, now: Date): Classified {
  const schedule = a.hours ? parseOpeningHours(a.hours) : null;
  const openState = openStateAt(schedule, now);

  let availability: Availability;
  switch (a.access) {
    case "yes":
    case "permissive":
      if (schedule?.kind === "24/7") availability = "open247";
      else if (openState === "open") availability = "openNow";
      else if (openState === "closed") availability = "closedNow";
      else availability = "publicHoursUnknown";
      break;
    case "customers":
      availability = openState === "closed" ? "closedNow" : "customers";
      break;
    case "permit": availability = "permit"; break;
    case "private": availability = "private"; break;
    case "no": availability = "noAccess"; break;
    default: availability = "unknown";
  }
  const tier: Tier = AVAILABILITY_TIER[availability];
  return { availability, tier, schedule, openState };
}

export type Found = Aed & { distance: number; bearing: number } & Classified;

/** Najbliższe punkty (K najbliższych w całym zbiorze), z odległością i azymutem. */
export function nearestTo(ds: Dataset, lat: number, lon: number, k: number, now: Date): Found[] {
  // Prefiltr prostokątem, przy braku wyników poszerzany; potem dokładna odległość.
  for (const radiusKm of [2, 8, 30, 120, 800]) {
    const { dLat, dLon } = boundingBox(lat, radiusKm);
    const found: Found[] = [];
    for (const a of ds.items) {
      if (Math.abs(a.lat - lat) > dLat || Math.abs(a.lon - lon) > dLon) continue;
      found.push({
        ...a,
        distance: distanceMeters(lat, lon, a.lat, a.lon),
        bearing: bearingDegrees(lat, lon, a.lat, a.lon),
        ...classify(a, now),
      });
    }
    if (found.length >= k || radiusKm === 800) {
      return found.sort((x, y) => x.distance - y.distance).slice(0, Math.max(k, 1) * 3);
    }
  }
  return [];
}

export type Pick = { primary: Found | null; restricted: boolean; others: Found[] };

/**
 * Główny AED: najbliższy z tier 0 (można podejść). Jeśli w OPEN_AED_MAX_DISTANCE_M nie ma takiego,
 * pokazujemy najbliższy w ogóle i oznaczamy go jako o ograniczonym dostępie.
 */
export function pickPrimary(list: Found[], listSize = 8): Pick {
  if (!list.length) return { primary: null, restricted: false, others: [] };
  const open = list.find((f) => f.tier === 0 && f.distance <= OPEN_AED_MAX_DISTANCE_M);
  const primary = open ?? list[0];
  return {
    primary,
    restricted: !open,
    others: list.filter((f) => f.id !== primary.id).slice(0, listSize),
  };
}

export function localizedLocation(a: Aed, locale: string): { text: string; original: boolean } {
  if (locale === "pl" && a.locationPl) return { text: a.locationPl, original: false };
  if (locale === "en" && a.locationEn) return { text: a.locationEn, original: false };
  const fallback = a.location || a.locationPl || a.locationEn;
  // Opis bez tłumaczenia jest zwykle po polsku; dla en/uk oznaczamy go jako oryginał.
  return { text: fallback, original: locale !== "pl" && fallback.length > 0 };
}
