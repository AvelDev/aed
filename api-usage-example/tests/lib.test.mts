import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, bearingDegrees, compassKey, walkMinutes } from "../src/lib/geo.ts";
import { parseOpeningHours, openStateAt, isPolishPublicHoliday, formatSchedule } from "../src/lib/openingHours.ts";
import { classify, pickPrimary, localizedLocation, type Aed, type Found } from "../src/lib/aed-data.ts";

// Czas lokalny Europy/Warszawy (zima = UTC+1), 2026-01-12 to poniedziałek.
const at = (iso: string) => new Date(iso);

test("odległość Warszawa–Kraków ≈ 252 km", () => {
  const d = distanceMeters(52.2297, 21.0122, 50.0647, 19.945);
  assert.ok(d > 250000 && d < 255000, String(d));
});

test("azymut i kompas", () => {
  assert.equal(compassKey(bearingDegrees(52, 21, 53, 21)), "n");
  assert.equal(compassKey(bearingDegrees(52, 21, 52, 22)), "e");
  assert.equal(compassKey(bearingDegrees(52, 21, 51, 21)), "s");
  assert.equal(compassKey(359), "n");
});

test("czas marszu: min. 1 minuta, 400 m ≈ 6 min", () => {
  assert.equal(walkMinutes(5), 1);
  assert.equal(walkMinutes(400), 6);
});

test("24/7 jest zawsze otwarte", () => {
  const s = parseOpeningHours("24/7");
  assert.equal(openStateAt(s, at("2026-01-12T03:00:00Z")), "open");
});

test("Mo-Fr 07:30-15:30 w poniedziałek rano i w sobotę", () => {
  const s = parseOpeningHours("Mo-Fr 07:30-15:30");
  assert.equal(openStateAt(s, at("2026-01-12T09:00:00Z")), "open"); // 10:00 w Warszawie
  assert.equal(openStateAt(s, at("2026-01-12T16:00:00Z")), "closed"); // 17:00
  assert.equal(openStateAt(s, at("2026-01-17T09:00:00Z")), "closed"); // sobota
});

test("reguła PH off wyłącza święto (1 stycznia 2026, czwartek)", () => {
  const s = parseOpeningHours("Mo-Fr 08:00-16:00; PH off");
  assert.equal(openStateAt(s, at("2026-01-01T10:00:00Z")), "closed");
  assert.equal(openStateAt(s, at("2026-01-02T10:00:00Z")), "open");
});

test("święta ruchome: Wielkanoc 2026 to 5 kwietnia, poniedziałek 6 kwietnia", () => {
  assert.ok(isPolishPublicHoliday(2026, 4, 5));
  assert.ok(isPolishPublicHoliday(2026, 4, 6));
  assert.ok(isPolishPublicHoliday(2026, 6, 4)); // Boże Ciało 2026
  assert.ok(!isPolishPublicHoliday(2026, 4, 7));
  assert.ok(isPolishPublicHoliday(2025, 12, 24));
  assert.ok(!isPolishPublicHoliday(2024, 12, 24));
});

test("przejście przez północ: Mo-Su 20:00-02:00", () => {
  const s = parseOpeningHours("Mo-Su 20:00-02:00");
  assert.equal(openStateAt(s, at("2026-01-12T00:30:00Z")), "open"); // 01:30
  assert.equal(openStateAt(s, at("2026-01-12T12:00:00Z")), "closed");
});

test("nieobsługiwana składnia daje unknown, nie zgadywanie", () => {
  assert.equal(parseOpeningHours("sunrise-sunset"), null);
  assert.equal(parseOpeningHours("Mo-Fr 08:00-16:00 open \"po umówieniu\""), null);
  assert.equal(openStateAt(null, new Date()), "unknown");
});

test("złożony zapis z danych", () => {
  const s = parseOpeningHours("Mo 08:00-17:00; Tu-Fr 08:00-15:00; Sa-Su, PH off");
  assert.ok(s && s.kind === "weekly");
  assert.equal(openStateAt(s, at("2026-01-13T09:00:00Z")), "open");
  assert.equal(openStateAt(s, at("2026-01-13T15:30:00Z")), "closed");
});

test("formatowanie tygodnia w językach", () => {
  const s = parseOpeningHours("Mo-Fr 07:30-15:30; Sa-Su off")!;
  const pl = formatSchedule(s, "pl", { off: "nieczynne", publicHolidays: "święta" });
  assert.match(pl, /07:30–15:30/);
  assert.match(pl, /nieczynne/);
  const uk = formatSchedule(s, "uk", { off: "зачинено", publicHolidays: "святкові дні" });
  assert.match(uk, /зачинено/);
});

const base: Aed = {
  id: "1:1", lat: 52, lon: 21, access: "yes", indoor: true, hours: "", level: "",
  location: "", locationPl: "", locationEn: "", operator: "", checked: "",
};
const now = at("2026-01-12T09:00:00Z");

test("klasyfikacja dostępności", () => {
  assert.equal(classify({ ...base, hours: "24/7" }, now).availability, "open247");
  assert.equal(classify(base, now).availability, "publicHoursUnknown");
  assert.equal(classify({ ...base, hours: "Mo-Fr 07:30-15:30" }, now).availability, "openNow");
  assert.equal(classify({ ...base, hours: "Mo-Fr 07:30-08:30" }, now).availability, "closedNow");
  assert.equal(classify({ ...base, access: "customers" }, now).availability, "customers");
  assert.equal(classify({ ...base, access: "private" }, now).tier, 2);
  assert.equal(classify({ ...base, access: "unknown" }, now).tier, 1);
});

const found = (id: string, distance: number, access: Aed["access"]): Found => ({
  ...base, id, access, distance, bearing: 0, ...classify({ ...base, access }, now),
});

test("główny AED: najbliższy dostępny, a nie najbliższy w ogóle", () => {
  const list = [found("1:1", 80, "private"), found("1:2", 150, "customers"), found("1:3", 400, "yes")];
  const p = pickPrimary(list);
  assert.equal(p.primary?.id, "1:3");
  assert.equal(p.restricted, false);
  assert.deepEqual(p.others.map((o) => o.id), ["1:1", "1:2"]);
});

test("gdy nic dostępnego w 10 km: najbliższy w ogóle, oznaczony jako ograniczony", () => {
  const list = [found("1:1", 80, "private"), found("1:2", 12000, "yes")];
  const p = pickPrimary(list);
  assert.equal(p.primary?.id, "1:1");
  assert.equal(p.restricted, true);
});

test("opisy miejsc: język i oznaczenie oryginału", () => {
  const a = { ...base, location: "Na ścianie", locationEn: "On the wall" };
  assert.deepEqual(localizedLocation(a, "en"), { text: "On the wall", original: false });
  assert.deepEqual(localizedLocation(a, "pl"), { text: "Na ścianie", original: false });
  assert.deepEqual(localizedLocation(a, "uk"), { text: "Na ścianie", original: true });
  assert.deepEqual(localizedLocation(base, "uk"), { text: "", original: false });
});
