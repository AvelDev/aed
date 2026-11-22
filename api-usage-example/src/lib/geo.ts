const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Odległość wielkokołowa w metrach. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Azymut początkowy 0–360° (0 = północ). */
export function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export type CompassKey = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
const KEYS: CompassKey[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

export function compassKey(bearing: number): CompassKey {
  return KEYS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** Szacunkowy czas marszu: 5 km/h z naddatkiem 25% na kręte drogi, min. 1 minuta. */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil((meters * 1.25) / (5000 / 60)));
}

/**
 * Połowa boku prostokąta (w stopniach) obejmującego okrąg o danym promieniu, na tej samej kuli
 * co distanceMeters. Tani prefiltr przed dokładną odległością, w przeglądarce i w zapytaniu SQL.
 */
export function boundingBox(lat: number, radiusKm: number): { dLat: number; dLon: number } {
  const angular = (radiusKm * 1000) / R;
  const dLat = (angular * 180) / Math.PI;
  const ratio = Math.sin(angular) / Math.max(Math.cos(rad(lat)), 1e-6);
  const dLon = ratio >= 1 ? 180 : (Math.asin(ratio) * 180) / Math.PI;
  return { dLat, dLon };
}
