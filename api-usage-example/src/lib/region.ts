// Obszar działania aplikacji: jedno miejsce na wiedzę „gdzie i w jakiej strefie czasu” działamy.

/** Strefa czasu godzin otwarcia z OSM, świąt i formatowania dat. */
export const TIME_ZONE = "Europe/Warsaw";

/** Prostokąt danych (punkty: lat 49,16–54,83; lon 14,14–24,04) z niewielkim marginesem. */
export const POLAND_BOUNDS = { south: 48.9, north: 55.1, west: 13.9, east: 24.3 } as const;

/** Czy współrzędne są liczbami i leżą w obszarze danych. Odrzuca NaN i resztę świata. */
export function isInPoland(lat: number, lon: number): boolean {
  const b = POLAND_BOUNDS;
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east
  );
}
