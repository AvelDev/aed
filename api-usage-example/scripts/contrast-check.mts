// Pilnuje kontrastu par kolorów z tokenów (src/app/globals.css). Cel: WCAG 2.2 AAA (7:1) dla tekstu,
// 3:1 dla elementów interfejsu. Szkło matowe ma 92% bieli, więc najgorsze tło pod nim to biel zmieszana
// z czernią (kafelek mapy w najgorszym przypadku): 0,92·255 = 235.
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const tokens = new Map<string, string>();
for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens.set(m[1], m[2]);

const hex = (name: string) => {
  if (name.startsWith("#")) return name;
  const v = tokens.get(name);
  if (!v) throw new Error(`brak tokenu --${name}`);
  return v;
};
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const GLASS_WORST = "#ebebeb";
const TEXT = 7; // AAA
const UI = 3; // WCAG 1.4.11

const pairs: Array<[string, string, number, string]> = [
  ["ink", "paper", TEXT, "tekst główny"],
  ["ink-2", "paper", TEXT, "tekst pomocniczy"],
  ["ink-2", "paper-2", TEXT, "tekst pomocniczy na tle 2"],
  ["ink-2", "slate-tint", TEXT, "tekst pomocniczy na szarości"],
  ["ink", "slate-tint", TEXT, "aktywna zakładka"],
  ["ink", GLASS_WORST, TEXT, "tekst na szkle (najgorszy kafelek)"],
  ["ink-2", GLASS_WORST, TEXT, "tekst pomocniczy na szkle (najgorszy kafelek)"],
  ["blue", "paper", TEXT, "link"],
  ["blue", GLASS_WORST, TEXT, "link na szkle (atrybucja)"],
  ["#ffffff", "red", TEXT, "pasek 112"],
  ["#ffffff", "red-ink", TEXT, "pasek 112 po najechaniu"],
  ["#ffffff", "ink", TEXT, "przycisk główny"],
  ["green-ink", "green-tint", TEXT, "status: można podejść"],
  ["amber-ink", "amber-tint", TEXT, "status: niepewny, komunikaty"],
  ["red-ink", "red-tint", TEXT, "status: ograniczony"],
  ["red", "paper", TEXT, "numery kroków RKO"],
  ["line-strong", "paper", UI, "obramowanie pola tekstowego"],
  ["blue", "paper", UI, "pierścień fokusu"],
];

let failed = 0;
for (const [fg, bg, min, label] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "BŁĄD"} ${r.toFixed(2).padStart(5)}:1 (min ${min}) ${label}  [${fg} na ${bg}]`);
}
console.log(`kontrast: ${pairs.length} par, ${failed} poniżej progu.`);
process.exit(failed ? 1 : 0);
