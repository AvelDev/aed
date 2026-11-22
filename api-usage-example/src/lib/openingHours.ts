// Mały parser najczęstszych zapisów opening_hours z OpenStreetMap.
// Obsługuje: 24/7, dni i zakresy dni (Mo-Fr, Sa,Su), przedziały godzin (też po północy),
// "off"/"closed", reguły PH (święta państwowe w Polsce). Wszystko inne to wynik "unknown",
// nigdy zgadywanie: dla ratowania życia lepiej powiedzieć "nie wiem" niż "otwarte".

import { TIME_ZONE } from "./region.ts";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const; // 0 = poniedziałek
type Interval = [number, number]; // minuty od północy, koniec do 1440 (lub więcej przy przejściu przez północ)

export type Schedule =
  | { kind: "24/7" }
  | { kind: "weekly"; days: Interval[][]; holiday: Interval[] | null };

export type OpenState = "open" | "closed" | "unknown";

const DAY_RE = "(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?";
const SELECTOR_RE = new RegExp(`^((?:${DAY_RE})(?:\\s*,\\s*${DAY_RE})*)\\s*(.*)$`);
const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

export function parseOpeningHours(raw: string): Schedule | null {
  const text = raw.trim();
  if (!text) return null;
  if (text === "24/7") return { kind: "24/7" };

  const days: Interval[][] = Array.from({ length: 7 }, () => []);
  let holiday: Interval[] | null = null;
  let sawRule = false;

  for (const ruleRaw of text.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;

    let selector = "";
    let rest = rule;
    const m = SELECTOR_RE.exec(rule);
    if (m) {
      selector = m[1];
      rest = m[2].trim();
    }

    let intervals: Interval[];
    if (/^(off|closed)$/i.test(rest)) {
      intervals = [];
    } else if (rest === "24/7" || rest === "00:00-24:00") {
      intervals = [[0, 1440]];
    } else {
      intervals = [];
      for (const part of rest.split(",")) {
        const t = TIME_RANGE_RE.exec(part.trim());
        if (!t) return null; // nieobsługiwana składnia
        const from = Number(t[1]) * 60 + Number(t[2]);
        let to = Number(t[3]) * 60 + Number(t[4]);
        if (Number(t[1]) > 24 || Number(t[3]) > 24 || Number(t[2]) > 59 || Number(t[4]) > 59) return null;
        if (to <= from) to += 1440; // przejście przez północ
        intervals.push([from, to]);
      }
      if (!intervals.length) return null;
    }

    const targets = new Set<number>();
    let ph = false;
    if (!selector) {
      for (let i = 0; i < 7; i++) targets.add(i);
    } else {
      for (const token of selector.split(",").map((s) => s.trim())) {
        if (token === "PH") { ph = true; continue; }
        const [a, b] = token.split("-");
        const i = DAYS.indexOf(a as (typeof DAYS)[number]);
        const j = b ? DAYS.indexOf(b as (typeof DAYS)[number]) : i;
        for (let k = i; ; k = (k + 1) % 7) {
          targets.add(k);
          if (k === j) break;
        }
      }
    }
    for (const d of targets) days[d] = intervals;
    if (ph) holiday = intervals;
    sawRule = true;
  }
  return sawRule ? { kind: "weekly", days, holiday } : null;
}

/** Niedziela wielkanocna (algorytm Gaussa/Meeusa). */
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Święta ustawowo wolne od pracy w Polsce (Wigilia od 2025 r.). */
export function isPolishPublicHoliday(year: number, month: number, day: number): boolean {
  const fixed = [[1, 1], [1, 6], [5, 1], [5, 3], [8, 15], [11, 1], [11, 11], [12, 25], [12, 26]];
  if (fixed.some(([m, d]) => m === month && d === day)) return true;
  if (year >= 2025 && month === 12 && day === 24) return true;
  const easter = easterSunday(year);
  for (const offset of [0, 1, 49, 60]) {
    const x = new Date(easter.getTime() + offset * 86400000);
    if (x.getUTCMonth() + 1 === month && x.getUTCDate() === day) return true;
  }
  return false;
}

type Parts = { year: number; month: number; day: number; weekday: number; minutes: number };

function warsawParts(now: Date): Parts {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    weekday, minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export function openStateAt(schedule: Schedule | null, now: Date): OpenState {
  if (!schedule) return "unknown";
  if (schedule.kind === "24/7") return "open";

  const t = warsawParts(now);
  const covers = (iv: Interval[], at: number) => iv.some(([a, b]) => at >= a && at < b);

  const todayIsHoliday = isPolishPublicHoliday(t.year, t.month, t.day);
  const todayIv = todayIsHoliday && schedule.holiday ? schedule.holiday : schedule.days[t.weekday];
  if (covers(todayIv, t.minutes)) return "open";

  // Przedział z wczoraj, który przechodzi przez północ.
  const yesterday = new Date(now.getTime() - 86400000);
  const y = warsawParts(yesterday);
  const yHoliday = isPolishPublicHoliday(y.year, y.month, y.day);
  const yIv = yHoliday && schedule.holiday ? schedule.holiday : schedule.days[y.weekday];
  if (covers(yIv, t.minutes + 1440)) return "open";

  return "closed";
}

export type HoursLabels = { off: string; publicHolidays: string };

/** Czytelny zapis tygodnia w danym języku, np. "pon.–pt. 07:30–15:30; sob., niedz. nieczynne". */
export function formatSchedule(schedule: Schedule, locale: string, labels: HoursLabels): string {
  if (schedule.kind === "24/7") return "24/7";
  const dayName = (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
  const fmt = (m: number) => {
    const mm = m % 1440 === 0 && m > 0 ? 1440 : m % 1440;
    return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
  };
  const key = (iv: Interval[]) => (iv.length ? iv.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(", ") : labels.off);

  const groups: Array<{ from: number; to: number; text: string }> = [];
  for (let i = 0; i < 7; i++) {
    const text = key(schedule.days[i]);
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.to === i - 1) last.to = i;
    else groups.push({ from: i, to: i, text });
  }
  const parts = groups.map((g) =>
    `${g.from === g.to ? dayName(g.from) : `${dayName(g.from)}–${dayName(g.to)}`} ${g.text}`);
  if (schedule.holiday) parts.push(`${labels.publicHolidays} ${key(schedule.holiday)}`);
  return parts.join("; ");
}
