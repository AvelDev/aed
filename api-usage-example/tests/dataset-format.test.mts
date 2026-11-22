import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_CODES, DATASET_VERSION, decodeDataset, encodeDataset, toAccessCode, type Aed, type DatasetColumns,
} from "../src/lib/dataset-format.ts";
import { boundingBox, distanceMeters } from "../src/lib/geo.ts";
import { isInPoland } from "../src/lib/region.ts";

const sample: Aed = {
  id: "4:622", lat: 52.1234567, lon: 21.7654321, access: "yes", indoor: false, hours: "24/7",
  level: "0", location: "Hol", locationPl: "", locationEn: "Lobby", operator: "Urząd", checked: "2026-01-01",
};

test("kodowanie i dekodowanie: identyczny zbiór, identyfikatory tekstowe, licencja ze źródła", () => {
  const items = [sample, { ...sample, id: "1:3", indoor: null, access: "unknown" as const }];
  const c = encodeDataset(items, "2026-11-22", "CC BY 4.0");
  const ds = decodeDataset(JSON.parse(JSON.stringify(c)) as DatasetColumns);
  assert.equal(ds.license, "CC BY 4.0");
  assert.deepEqual(ds.items.map((a) => a.id), ["4:622", "1:3"]);
  assert.equal(JSON.stringify(encodeDataset(ds.items, ds.generatedAt, ds.license)), JSON.stringify(c));
});

test("kodowanie: współrzędne do 6 miejsc, access i indoor jako kody", () => {
  const c = encodeDataset([sample, { ...sample, id: "4:623", indoor: null, access: "unknown" }], "2026-11-21", "CC BY 4.0");
  assert.equal(c.v, DATASET_VERSION);
  assert.deepEqual(c.lat, [52.123457, 52.123457]);
  assert.deepEqual(c.acc, [ACCESS_CODES.indexOf("yes"), 0]);
  assert.deepEqual(c.ind, [0, -1]);
  assert.deepEqual(decodeDataset(c).items[1].indoor, null);
});

test("dekodowanie odrzuca obcą wersję (np. stary plik z pamięci telefonu) i kolumny różnej długości", () => {
  const c = encodeDataset([sample], "2026-11-21", "CC BY 4.0");
  assert.throws(() => decodeDataset({ ...c, v: 1 } as unknown as DatasetColumns), /wersja/);
  assert.throws(() => decodeDataset({ ...c, lat: [] }), /lat/);
  assert.throws(() => decodeDataset({ ...c, id: [] }), /id/);
});

test("access: znane wartości bez zmian, reszta to unknown", () => {
  assert.equal(toAccessCode("customers"), "customers");
  assert.equal(toAccessCode("designated"), "unknown");
  assert.equal(toAccessCode(null), "unknown");
});

test("obszar danych odrzuca NaN i resztę świata", () => {
  assert.ok(isInPoland(52.23, 21.01));
  assert.ok(!isInPoland(Number.NaN, 21));
  assert.ok(!isInPoland(48.8566, 2.3522)); // Paryż
});

// Punkt odległy o `m` metrów w kierunku `bearing` (wzór na punkt docelowy na kuli).
function destination(lat: number, lon: number, bearing: number, m: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = m / 6371000, b = r(bearing), p1 = r(lat);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(a) + Math.cos(p1) * Math.sin(a) * Math.cos(b));
  const l2 = r(lon) + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p1), Math.cos(a) - Math.sin(p1) * Math.sin(p2));
  return { lat: (p2 * 180) / Math.PI, lon: (l2 * 180) / Math.PI };
}

test("prostokąt prefiltra obejmuje cały okrąg", () => {
  for (const lat of [49.2, 52, 54.8]) {
    const { dLat, dLon } = boundingBox(lat, 10);
    for (let bearing = 0; bearing < 360; bearing += 5) {
      const p = destination(lat, 19, bearing, 10000);
      assert.ok(Math.abs(p.lat - lat) <= dLat + 1e-9 && Math.abs(p.lon - 19) <= dLon + 1e-9, `${lat} ${bearing}`);
      assert.ok(Math.abs(distanceMeters(lat, 19, p.lat, p.lon) - 10000) < 1);
    }
  }
});
