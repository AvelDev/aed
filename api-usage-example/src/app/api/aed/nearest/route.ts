import { nearestTo } from "@/lib/aed-data";
import { parseNearestQuery } from "@/lib/api-contracts";
import { aedSnapshot } from "@/server/aed-source";

// GET /api/aed/nearest?lat=52.23&lon=21.01&limit=5
export async function GET(request: Request) {
  const query = parseNearestQuery(new URL(request.url).searchParams);
  if (!query.ok) return Response.json({ error: query.error }, { status: 400 });

  const { lat, lon, limit } = query.value;
  try {
    const { aeds, source } = await aedSnapshot();
    const dataset = { generatedAt: source.dataDate, license: source.license, items: aeds };
    const items = nearestTo(dataset, lat, lon, limit, new Date())
      .slice(0, limit)
      .map((f) => ({
        id: f.id, lat: f.lat, lon: f.lon, distance_m: Math.round(f.distance), availability: f.availability,
        access: f.access, hours: f.hours, location: f.location, operator: f.operator,
      }));
    return Response.json(
      { items, source: source.datasetUrl, license: source.license },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "source" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
