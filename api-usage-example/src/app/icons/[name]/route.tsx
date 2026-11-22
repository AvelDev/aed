import { ImageResponse } from "next/og";
import { BOLT_PATH, BRAND_COLORS, HEART_PATH } from "@/lib/brand";

// Ikony PWA rysowane w kodzie: czerwone pole z białym sercem i błyskawicą.
const SPECS: Record<string, { size: number; inset: number }> = {
  "icon-192.png": { size: 192, inset: 0.14 },
  "icon-512.png": { size: 512, inset: 0.14 },
  "maskable-512.png": { size: 512, inset: 0.26 }, // strefa bezpieczna dla masek systemowych
  "apple-touch-icon.png": { size: 180, inset: 0.14 },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SPECS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const spec = SPECS[name];
  if (!spec) return new Response("Not found", { status: 404 });
  const pad = Math.round(spec.size * spec.inset);
  const inner = spec.size - pad * 2;

  return new ImageResponse(
    (
      <div style={{ width: spec.size, height: spec.size, background: BRAND_COLORS.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={inner} height={inner} viewBox="0 0 24 24">
          <path
            fill={BRAND_COLORS.white}
            d={HEART_PATH}
          />
          <path fill={BRAND_COLORS.red} d={BOLT_PATH} />
        </svg>
      </div>
    ),
    { width: spec.size, height: spec.size },
  );
}
