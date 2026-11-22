import { connection } from "next/server";
import { aedSnapshot } from "@/server/aed-source";

export async function GET() {
  await connection(); // zawsze w czasie żądania, nigdy podczas buildu
  try {
    const { rows, aeds, skipped, source, fetchedAt } = await aedSnapshot();
    return Response.json(
      { ok: true, aed: aeds.length, records: rows.length, skipped, source: source.apiUrl, fetchedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
