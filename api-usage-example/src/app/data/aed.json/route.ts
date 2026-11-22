// Plik danych dla telefonu, budowany z wykazu zbiorczego API dane-gov-pl-mirror. Telefon pobiera go raz
// i liczy odległości lokalnie, więc lokalizacja nie opuszcza urządzenia. Układ: src/lib/dataset-format.ts.
import { connection } from "next/server";
import { encodeDataset } from "@/lib/dataset-format";
import { aedSnapshot } from "@/server/aed-source";

export async function GET() {
  await connection(); // zawsze w czasie żądania, nigdy podczas buildu
  try {
    const { aeds, source } = await aedSnapshot();
    return Response.json(encodeDataset(aeds, source.dataDate, source.license), {
      headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return Response.json({ error: "source" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
