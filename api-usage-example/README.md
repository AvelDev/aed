# Misja AED – przykładowa aplikacja na API wykazu zbiorczego

Aplikacja PWA (telefony) pokazująca najbliższy dostępny defibrylator AED w Polsce.
Prototyp na konkurs „Misja AED – Dane na ratunek” (Ministerstwo Cyfryzacji), przeniesiony z [AvelDev/misja-aed](https://github.com/AvelDev/misja-aed).

Jedynym źródłem danych o AED jest **API portalu z [`../dane-gov-pl-mirror`](../dane-gov-pl-mirror)** (kopia dane.gov.pl z tego repozytorium): zasób „Defibrylatory AED – wykaz zbiorczy” w zbiorze „Defibrylatory AED w Polsce – zbiór łączony”. Aplikacja nie ma własnej bazy ani importu danych; pokazuje to, co portal połączył i ujednolicił z wielu zbiorów AED.

Next.js 16 (App Router) · next-intl (PL, EN, UK) · MapLibre · własny system wizualny (szkło matowe), bez bibliotek komponentów.

## Uruchomienie

Najpierw musi działać API dane-gov-pl-mirror z opublikowanym zbiorem łączonym (patrz [../README.md](../README.md)). Domyślne adresy lokalne: API `http://localhost:8001`, frontend portalu `http://localhost:4200`.

```bash
npm install
cp .env.example .env.local        # gotowe ustawienia dla lokalnego dane-gov-pl-mirror
npm run dev                       # http://localhost:3000
```

Sprawdzenie połączenia z API: `http://localhost:3000/api/health` zwraca liczbę punktów i adres źródła.

Zmienne w `.env.local`:

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `AED_API_URL` | `http://localhost:8001/1.4` | API portalu |
| `AED_RESOURCE_ID` | `24` | zasób „wykaz zbiorczy”; po zbudowaniu zbioru od zera sprawdź numer: `GET /1.4/datasets/<id>/resources` |
| `AED_PORTAL_URL` | `http://localhost:4200` | frontend portalu, do linku do zbioru w eksporcie i metadanych |
| `AED_CACHE_SECONDS` | `300` | jak długo serwer trzyma pobrany wykaz w pamięci |

Wersja produkcyjna (potrzebna do testu PWA i offline): `npm run build && npm start`.

## Skąd są dane

```
dane-gov-pl-mirror                 ta aplikacja
GET /1.4/resources/<id>/data  ──►  src/server/aed-source.ts  ──►  /data/aed.json        (telefon)
  wykaz zbiorczy, 19 kolumn,        stronicowanie po 100,          /api/aed/nearest
  757 rekordów (stan lokalny)       pamięć podręczna,              /api/export/*  /api/health
                                    src/lib/wykaz.ts (mapowanie)
```

Mapowanie kolumn wykazu (`src/lib/wykaz.ts`):

- `szerokosc`, `dlugosc` to położenie. Rekord bez współrzędnych albo poza Polską nie trafia na mapę (licznik `skipped` w `/api/health`).
- `dostep` ma postać „<całodobowo>; <rodzaj>”: „Publiczny” daje dostęp publiczny, „Prywatny” daje dostęp ograniczony, a „Tak” bez podanych godzin oznacza dostępność całodobową (24/7).
- `godziny` są zapisem źródła (wolny tekst). Aplikacja pokazuje go dosłownie („Zapis w danych: …”), bo nie zgaduje godzin.
- `nazwa`, `adres`, `miejscowosc` i `opis` składają się na opis miejsca.
- `dysponent` to instytucja udostępniająca dane.
- `licencja` to licencja zbioru źródłowego; licencja pliku danych to lista licencji źródeł.
- `kontakt` i `dane_zrodlowe` nie są używane ani eksportowane.

## Kontrole jakości

```bash
npm run check    # tłumaczenia, kontrast, typy, lint, testy jednostkowe
```

- `i18n:check` sprawdza, czy każdy klucz istnieje w PL/EN/UK, czy zgadzają się argumenty ICU i formy liczby mnogiej, czy ukraiński ma cyrylicę, oraz czy kod nie używa nieistniejących kluczy. Uruchamia się też przed każdym `build`.
- `contrast:check` pilnuje kontrastu par kolorów z tokenów (cel AAA 7:1).
- Klucze tłumaczeń są typowane według `messages/pl.json`.
- Testy (`tests/`) obejmują reguły domeny (godziny, dostępność, wybór AED), mapowanie wykazu zbiorczego na prawdziwych przykładach z API, kontrakt pliku `/data/aed.json` (kodowanie i dekodowanie), kontrakty tras API, eksport CSV/GeoJSON oraz zgodność wartości, które muszą być zapisane dwa razy (próg układu i kolory w CSS, języki i trasy w `public/sw.js`).

## Architektura

```
src/lib/        czysta logika, bez Reacta i sieci (testowana w Node)
  region.ts          strefa czasu i granice obszaru danych
  geo.ts             odległość, azymut, prostokąt prefiltra
  openingHours.ts    parser godzin w składni opening_hours, święta w Polsce
  wykaz.ts           odczyt odpowiedzi API wykazu i mapowanie na rekordy aplikacji
  dataset-format.ts  kontrakt /data/aed.json (koder i dekoder, wersja)
  aed-data.ts        dostępność AED i wybór głównego wyniku
  api-contracts.ts   walidacja wejścia tras API, typ Place
  open-data.ts       kolumny, serializacja eksportu i metadane
  brand.ts           kolory i znak dla ikon PWA i mapy
src/server/     tylko serwer ("server-only")
  aed-source.ts      jedyne miejsce, które łączy się z API dane-gov-pl-mirror
  geocoder.ts        interfejs Geocoder + Nominatim
src/hooks/      hooki przeglądarki (geolokalizacja, sieć, media query)
src/components/ widok
src/app/        trasy Next.js; /data/aed.json i trasy API tylko łączą źródło, kontrakt i odpowiedź
scripts/        kontrole tłumaczeń i kontrastu
```

Zmiana źródła danych dotyczy tylko `src/server/aed-source.ts` i `src/lib/wykaz.ts`; zmiana usługi wyszukiwania adresów to nowa implementacja `Geocoder`.

Zmiana formatu `aed.json` wymaga podbicia `DATASET_VERSION` (obecnie 2: identyfikatory z wykazu, np. `4:622`). Stary plik w pamięci telefonu zostanie wtedy odrzucony z czytelnym błędem, a service worker pobierze nowy.

## Jak to działa

- **Lokalizacja zostaje na telefonie.** Aplikacja pobiera raz zwarty plik `/data/aed.json` (budowany z API przy żądaniu) i liczy odległości lokalnie. Do serwera nie trafiają współrzędne użytkownika. Wyszukiwanie adresu wysyła tylko wpisany tekst (`/api/geocode`).
- **Offline.** `public/sw.js` zapisuje strony, dane i odwiedzone kafelki mapy. Bez sieci działają lista AED, instrukcja RKO i strona „O aplikacji”.
- **Dostępność.** Status dostępności AED ma ikonę i tekst (kolor tylko wspiera). Szkło zamienia się w lity kolor przy `prefers-reduced-transparency` i `prefers-contrast`.
- **Otwarte dane.** `/api/export/aed.csv` i `/api/export/aed.geojson` zawierają kolumny wykazu bez danych kontaktowych. `/api/export/metadata.json` zawiera opis kolumn, licencję i link do zbioru w portalu.

## Do uzupełnienia przed publikacją (decyzje poza kodem)

Szacunki pracy i kolejność: [docs/ROADMAP.md](docs/ROADMAP.md) (dokument sprzed przejścia na API dane-gov-pl-mirror).

- **Treść medyczna RKO** jest wersją roboczą opartą na materiale ZPE i wymaga weryfikacji medycznej. Tłumaczenia EN/UK również.
- **Godziny dostępności** w wykazie są wolnym tekstem, więc aplikacja nie liczy „otwarte teraz” dla większości punktów. Ujednolicenie godzin (np. do składni opening_hours) to zadanie dla wykazu zbiorczego, nie dla aplikacji.
- **Kafelki mapy i wyszukiwanie adresów** pochodzą z serwerów OpenStreetMap (widzą adres IP urządzenia, a polityka OSM ogranicza użycie produkcyjne). To nie są dane o AED, ale na produkcję potrzebny jest własny lub komercyjny dostawca zgodny z RODO.
- **Tożsamość wizualna.** Zastosowano zasady ogólne (biel, czerwień). Nie ma godła RP ani oficjalnego systemu gov.pl; do podmiany po dostarczeniu oficjalnych zasad.
- **Deklaracja dostępności** zostanie opublikowana po audycie zewnętrznym.
