// Wyszukiwanie adresów przez serwer (patrz server/geocoder.ts: co i dlaczego tędy przechodzi).
import { parseGeocodeQuery, type GeocodeResponse } from "@/lib/api-contracts";
import { geocoder } from "@/server/geocoder";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const query = parseGeocodeQuery(new URL(request.url).searchParams);
  if (!query.ok) return Response.json({ error: query.error }, { status: 400, headers: NO_STORE });

  try {
    const body: GeocodeResponse = { places: await geocoder.search(query.value.q, query.value.lang) };
    return Response.json(body, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502, headers: NO_STORE });
  }
}
