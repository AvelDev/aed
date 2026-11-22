// Kontrakt pliku /data/aed.json. Jedyne źródło prawdy dla trasy, która plik buduje z API
// dane-gov-pl-mirror (src/app/data/aed.json/route.ts), i aplikacji, która go czyta (aed-data.ts).
// Format kolumnowy (tablice równoległe) dobrze się kompresuje; zmiana układu wymaga podbicia DATASET_VERSION.
// Wersja 2: identyfikatory są tekstem z wykazu zbiorczego („<id zbioru>:<id w źródle>”), licencja pochodzi ze źródła.

export const DATASET_VERSION = 2;

/** Kody dostępu; indeks w tablicy to kod zapisany w pliku. Kolejność jest częścią formatu. */
export const ACCESS_CODES = ["unknown", "yes", "customers", "permit", "private", "permissive", "no"] as const;
export type AccessCode = (typeof ACCESS_CODES)[number];

export type Aed = {
  id: string;
  lat: number;
  lon: number;
  access: AccessCode;
  indoor: boolean | null;
  hours: string;
  level: string;
  location: string;
  locationPl: string;
  locationEn: string;
  operator: string;
  checked: string;
};

export type Dataset = { generatedAt: string; license: string; items: Aed[] };

export type DatasetColumns = {
  v: typeof DATASET_VERSION;
  generatedAt: string;
  count: number;
  license: string;
  id: string[]; lat: number[]; lon: number[]; acc: number[]; ind: number[];
  hrs: string[]; lvl: string[]; loc: string[]; locPl: string[]; locEn: string[]; op: string[]; chk: string[];
};

const TEXT_COLUMNS = ["id", "hrs", "lvl", "loc", "locPl", "locEn", "op", "chk"] as const;
const NUMBER_COLUMNS = ["lat", "lon", "acc", "ind"] as const;

/** Wartość dostępu na kod formatu; wszystko spoza listy to "unknown". */
export function toAccessCode(raw: string | null | undefined): AccessCode {
  return (ACCESS_CODES as readonly string[]).includes(raw ?? "") ? (raw as AccessCode) : "unknown";
}

export function encodeDataset(items: readonly Aed[], generatedAt: string, license: string): DatasetColumns {
  const c: DatasetColumns = {
    v: DATASET_VERSION, generatedAt, count: items.length, license,
    id: [], lat: [], lon: [], acc: [], ind: [], hrs: [], lvl: [], loc: [], locPl: [], locEn: [], op: [], chk: [],
  };
  for (const a of items) {
    c.id.push(a.id);
    c.lat.push(Math.round(a.lat * 1e6) / 1e6);
    c.lon.push(Math.round(a.lon * 1e6) / 1e6);
    c.acc.push(ACCESS_CODES.indexOf(a.access));
    c.ind.push(a.indoor === true ? 1 : a.indoor === false ? 0 : -1);
    c.hrs.push(a.hours);
    c.lvl.push(a.level);
    c.loc.push(a.location);
    c.locPl.push(a.locationPl);
    c.locEn.push(a.locationEn);
    c.op.push(a.operator);
    c.chk.push(a.checked);
  }
  return c;
}

/**
 * Dekoduje plik danych. Niezgodna wersja lub kolumny różnej długości to błąd: lepiej pokazać
 * „nie udało się wczytać danych” niż wskazać defibrylator z pomieszanymi współrzędnymi.
 */
export function decodeDataset(c: DatasetColumns): Dataset {
  if (c?.v !== DATASET_VERSION) throw new Error(`aed.json: wersja ${c?.v}, oczekiwano ${DATASET_VERSION}`);
  for (const k of [...NUMBER_COLUMNS, ...TEXT_COLUMNS]) {
    if (!Array.isArray(c[k]) || c[k].length !== c.count) throw new Error(`aed.json: kolumna ${k} ma złą długość`);
  }
  const items: Aed[] = new Array(c.count);
  for (let i = 0; i < c.count; i++) {
    items[i] = {
      id: c.id[i], lat: c.lat[i], lon: c.lon[i],
      access: ACCESS_CODES[c.acc[i]] ?? "unknown",
      indoor: c.ind[i] === 1 ? true : c.ind[i] === 0 ? false : null,
      hours: c.hrs[i], level: c.lvl[i], location: c.loc[i], locationPl: c.locPl[i],
      locationEn: c.locEn[i], operator: c.op[i], checked: c.chk[i],
    };
  }
  return { generatedAt: c.generatedAt, license: c.license, items };
}
