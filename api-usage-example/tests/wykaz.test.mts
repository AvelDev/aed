import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/lib/aed-data.ts";
import { fullAddress, parseDostep, rowsFromPage, wykazLicense, wykazToAed, type ApiDataPage } from "../src/lib/wykaz.ts";

// Fragment prawdziwej odpowiedzi GET /1.4/resources/<id>/data (wykaz zbiorczy dane-gov-pl-mirror), skrócony.
const page: ApiDataPage = {
  meta: {
    count: 2,
    headers_map: {
      col1: "id", col5: "dysponent", col6: "licencja", col8: "nazwa", col9: "adres", col10: "miejscowosc",
      col11: "opis", col12: "godziny", col13: "dostep", col14: "kontakt", col16: "szerokosc", col17: "dlugosc",
      col99: "nieznana_kolumna",
    },
  },
  data: [
    {
      attributes: {
        col1: { val: "4:622" }, col5: { val: "Urząd m.st. Warszawy" }, col6: { val: "CC BY 4.0" },
        col8: { val: "Urząd Dzielnicy Mokotów m.st. Warszawy" }, col9: { val: "Rakowiecka 25/27" },
        col10: { val: "Warszawa" }, col11: { val: "Przy wejściu na półpiętrze." },
        col12: { val: "Poniedziałek: godz. 8:00-18:00; Wtorek-Piątek: godz. 8:00-16:00" },
        col13: { val: "Ograniczona; Publiczny" }, col14: { val: null },
        col16: { val: 52.2086170695684 }, col17: { val: 21.0148748892902 }, col99: { val: "x" },
      },
    },
    {
      attributes: {
        col1: { val: "3:1" }, col5: { val: "Urząd Miasta Marki" }, col6: { val: "CC BY 4.0" },
        col8: { val: "Urząd Miasta Marki" }, col9: { val: "Al.. Piłsudskiego 95, 05-270 Marki" },
        col10: { val: null }, col11: { val: null }, col12: { val: null }, col13: { val: "Tak; Prywatny" },
        col16: { val: "52.326697" }, col17: { val: "21.107557" },
      },
    },
  ],
};

test("strona API: kolumny po nazwach z headers_map, nieznane pominięte", () => {
  const rows = rowsFromPage(page);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "4:622");
  assert.equal(rows[0].dostep, "Ograniczona; Publiczny");
  assert.equal("nieznana_kolumna" in rows[0], false);
  assert.deepEqual(rowsFromPage({}), []);
});

test("dostęp: rodzaj miejsca i dostęp całodobowy", () => {
  assert.deepEqual(parseDostep("Tak; Publiczny"), { access: "yes", allDay: true });
  assert.deepEqual(parseDostep("Nie; Publiczny"), { access: "yes", allDay: false });
  assert.deepEqual(parseDostep("Ograniczona; Prywatny"), { access: "customers", allDay: false });
  assert.deepEqual(parseDostep("Nie (dostęp: pon. - piątek 8:00 - 16:00); Publiczny"), { access: "yes", allDay: false });
  assert.deepEqual(parseDostep(null), { access: "unknown", allDay: false });
});

test("adres: miejscowość dopisana tylko wtedy, gdy jej brakuje", () => {
  assert.equal(fullAddress({ adres: "Rakowiecka 25/27", miejscowosc: "Warszawa" }), "Rakowiecka 25/27, Warszawa");
  assert.equal(fullAddress({ adres: "Al. Piłsudskiego 95, 05-270 Marki", miejscowosc: "Marki" }), "Al. Piłsudskiego 95, 05-270 Marki");
  assert.equal(fullAddress({ adres: null, miejscowosc: "Krosno" }), "Krosno");
});

test("rekord wykazu na rekord aplikacji", () => {
  const [waw, marki] = rowsFromPage(page).map(wykazToAed);
  assert.ok(waw && marki);
  assert.equal(waw.id, "4:622");
  assert.equal(waw.access, "yes");
  assert.equal(waw.hours, "Poniedziałek: godz. 8:00-18:00; Wtorek-Piątek: godz. 8:00-16:00");
  assert.equal(waw.location, "Urząd Dzielnicy Mokotów m.st. Warszawy · Rakowiecka 25/27, Warszawa — Przy wejściu na półpiętrze.");
  assert.equal(waw.operator, "Urząd m.st. Warszawy");
  // „Tak” bez godzin = całodobowo; współrzędne jako tekst też są przyjmowane.
  assert.equal(marki.hours, "24/7");
  assert.equal(marki.lat, 52.326697);
  assert.equal(classify(marki, new Date("2026-01-12T09:00:00Z")).availability, "customers");
});

test("punkt bez współrzędnych lub poza obszarem danych nie trafia do aplikacji", () => {
  assert.equal(wykazToAed({ id: "1:1", szerokosc: null, dlugosc: 21 }), null);
  assert.equal(wykazToAed({ id: "1:2", szerokosc: 48.85, dlugosc: 2.35 }), null); // Paryż
  assert.equal(wykazToAed({ id: "", szerokosc: 52, dlugosc: 21 }), null);
});

test("licencja wykazu: wspólna wartość albo lista różnych", () => {
  assert.equal(wykazLicense([{ licencja: "CC BY 4.0" }, { licencja: "CC BY 4.0" }]), "CC BY 4.0");
  assert.equal(wykazLicense([{ licencja: "CC0 1.0" }, { licencja: "CC BY 4.0" }, { licencja: null }]), "CC BY 4.0, CC0 1.0");
});
