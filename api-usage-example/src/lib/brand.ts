// Znak i kolory marki dla miejsc, które nie mogą czytać tokenów CSS (ikony PWA, warstwy MapLibre, SVG).
// Wartości są też tokenami --red i --ink w globals.css; tests/layout.test.mts pilnuje zgodności.

export const BRAND_COLORS = { red: "#b00d26", ink: "#0f1d33", white: "#ffffff" } as const;

/** Serce (24×24). */
export const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/** Błyskawica wpisana w serce: razem znak aplikacji (defibrylacja). */
export const BOLT_PATH = "M13.2 5.8L7.6 13h3.6l-.9 5.2 5.9-7.6h-3.7z";
