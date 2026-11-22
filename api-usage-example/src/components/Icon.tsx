// Ikony rysowane na siatce 24×24, jednolita kreska 2 px, zaokrąglone końce.
import { BOLT_PATH, BRAND_COLORS, HEART_PATH } from "@/lib/brand";

const PATHS = {
  arrowUp: ["M12 19V5", "M5 12l7-7 7 7"],
  pin: ["M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  route: ["M15 14l5-5-5-5", "M4 20v-7a4 4 0 0 1 4-4h12"],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  ],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  checkCircle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8 12l3 3 5-6"],
  alert: [
    "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    "M12 9v4",
    "M12 17h.01",
  ],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7", "M12 17h.01"],
  ban: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5.6 5.6l12.8 12.8"],
  users: [
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M23 21v-2a4 4 0 0 0-3-3.9",
    "M16 3.1a4 4 0 0 1 0 7.8",
  ],
  key: ["M15.5 7.5l3 3L22 7l-3-3", "M21 2l-9.6 9.6", "M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M21 21l-4.3-4.3"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  chevronDown: ["M6 9l6 6 6-6"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16v-4", "M12 8h.01"],
  map: ["M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z", "M8 2v16", "M16 6v16"],
  heart: [HEART_PATH],
  external: ["M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", "M15 3h6v6", "M10 14L21 3"],
  locate: ["M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  play: ["M6 4l14 8-14 8V4z"],
  pause: ["M7 4h3v16H7z", "M14 4h3v16h-3z"],
  accessibility: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5h.01", "M7.5 10.5l4.5 1 4.5-1", "M12 11.5v3", "M9.5 18l2.5-3.5 2.5 3.5"],
  volume: ["M11 5L6 9H2v6h4l5 4V5z", "M15.5 8.5a5 5 0 0 1 0 7", "M19 5a10 10 0 0 1 0 14"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      style={style}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Znak aplikacji: serce z błyskawicą (defibrylacja). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill={BRAND_COLORS.red}
        d={HEART_PATH}
      />
      <path fill={BRAND_COLORS.white} d={BOLT_PATH} />
    </svg>
  );
}
