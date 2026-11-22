// Otwarty zbiór AED do pobrania: CSV, GeoJSON i opis metadanych. Format opisuje lib/open-data,
// dane pochodzą z wykazu zbiorczego API dane-gov-pl-mirror.
import { metadata, toCsv, toExportRow, toGeoJson } from "@/lib/open-data";
import { aedSnapshot } from "@/server/aed-source";

export const dynamic = "force-dynamic";

const headers = (type: string, name?: string) => ({
  "Content-Type": `${type}; charset=utf-8`,
  "Cache-Control": "public, max-age=300",
  "X-Content-Type-Options": "nosniff",
  ...(name ? { "Content-Disposition": `attachment; filename="${name}"` } : {}),
});

const FILES: Record<string, () => Promise<Response>> = {
  "aed.csv": async () => {
    const { rows } = await aedSnapshot();
    return new Response(toCsv(rows.map(toExportRow)), { headers: headers("text/csv", "aed-polska.csv") });
  },
  "aed.geojson": async () => {
    const { aeds, rows, source } = await aedSnapshot();
    // Do GeoJSON trafiają tylko punkty, które da się pokazać na mapie (te same co w aplikacji).
    const ids = new Set(aeds.map((a) => a.id));
    const mappable = rows.filter((r) => ids.has(String(r.id ?? ""))).map(toExportRow);
    return new Response(JSON.stringify(toGeoJson(mappable, source)), {
      headers: headers("application/geo+json", "aed-polska.geojson"),
    });
  },
  "metadata.json": async () => {
    const { rows, source } = await aedSnapshot();
    return new Response(JSON.stringify(metadata(rows.length, source), null, 2), { headers: headers("application/json") });
  },
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const build = Object.hasOwn(FILES, file) ? FILES[file] : undefined;
  if (!build) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return await build();
  } catch {
    return Response.json({ error: "export" }, { status: 503 });
  }
}
