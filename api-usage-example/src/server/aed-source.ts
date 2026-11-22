import "server-only";
import type { Aed } from "@/lib/dataset-format";
import type { Source } from "@/lib/open-data";
import { rowsFromPage, wykazLicense, wykazToAed, type ApiDataPage, type WykazRow } from "@/lib/wykaz";

// Jedyne źródło danych aplikacji: wykaz zbiorczy AED w API dane-gov-pl-mirror (kopia portalu dane.gov.pl).
// Trasy (/data/aed.json, /api/aed/nearest, /api/export/*, /api/health) pytają tylko o funkcje z tego pliku.

const PAGE_SIZE = 100; // maksimum przyjmowane przez API danych zasobu
const MAX_PAGES = 500; // bezpiecznik przy błędnym meta.count

export type AedSnapshot = {
  rows: WykazRow[];
  aeds: Aed[];
  /** Rekordy wykazu, których nie da się pokazać na mapie (brak współrzędnych lub poza obszarem). */
  skipped: number;
  source: Source;
  fetchedAt: string;
};

function config() {
  const apiUrl = (process.env.AED_API_URL ?? "").replace(/\/+$/, "");
  const resourceId = (process.env.AED_RESOURCE_ID ?? "").trim();
  if (!apiUrl || !resourceId) throw new Error("Brak AED_API_URL lub AED_RESOURCE_ID (patrz .env.example)");
  const portalUrl = (process.env.AED_PORTAL_URL ?? "").replace(/\/+$/, "");
  const ttlMs = Math.max(0, Number(process.env.AED_CACHE_SECONDS ?? 300)) * 1000;
  return { apiUrl, resourceId, portalUrl, ttlMs };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

type ResourceDoc = {
  data?: {
    attributes?: { data_date?: string | null; modified?: string | null };
    relationships?: { dataset?: { data?: { id?: string }; links?: { related?: string } } };
  };
};

async function fetchSnapshot(): Promise<AedSnapshot> {
  const { apiUrl, resourceId, portalUrl } = config();
  const resourceApi = `${apiUrl}/resources/${encodeURIComponent(resourceId)}`;

  const resource = await getJson<ResourceDoc>(resourceApi);
  const attrs = resource.data?.attributes ?? {};
  const ds = resource.data?.relationships?.dataset;
  // Ostatni człon adresu zbioru w API to „<id>,<slug>”, tak samo jak w adresie strony portalu.
  const datasetRef = ds?.links?.related?.split("/").pop() ?? ds?.data?.id ?? "";
  const datasetUrl = portalUrl && datasetRef ? `${portalUrl}/pl/dataset/${datasetRef}` : ds?.links?.related ?? resourceApi;

  const rows: WykazRow[] = [];
  let total = Infinity;
  for (let page = 1; page <= MAX_PAGES && rows.length < total; page++) {
    const body = await getJson<ApiDataPage>(`${resourceApi}/data?per_page=${PAGE_SIZE}&page=${page}`);
    total = body.meta?.count ?? 0;
    const pageRows = rowsFromPage(body);
    if (!pageRows.length) break;
    rows.push(...pageRows);
  }

  const aeds = rows.map(wykazToAed).filter((a): a is Aed => a !== null);
  const dataDate = (attrs.data_date ?? attrs.modified ?? new Date().toISOString()).slice(0, 10);
  return {
    rows,
    aeds,
    skipped: rows.length - aeds.length,
    source: { datasetUrl, apiUrl: `${resourceApi}/data`, license: wykazLicense(rows), dataDate },
    fetchedAt: new Date().toISOString(),
  };
}

// Jedna kopia na proces; w dev przeżywa przeładowania modułów. Równoległe żądania czekają na to samo pobranie.
const g = globalThis as unknown as { __aedSnapshot?: { at: number; value: Promise<AedSnapshot> } };

export function aedSnapshot(): Promise<AedSnapshot> {
  const { ttlMs } = config();
  const hit = g.__aedSnapshot;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = fetchSnapshot();
  g.__aedSnapshot = { at: Date.now(), value };
  // Błąd nie zostaje w pamięci: następne żądanie spróbuje ponownie.
  value.catch(() => {
    if (g.__aedSnapshot?.value === value) g.__aedSnapshot = undefined;
  });
  return value;
}
