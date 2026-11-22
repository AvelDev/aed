# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Wskazany przez użytkownika: Next.js (App Router), PostgreSQL, next-intl. Cel: PWA instalowane na telefonach (mobile-first). Zmiana decyzji: wygląd ma być w stylu Liquid Glass, zamiast shadcn/ui. Użytkownik chce gotowej biblioteki ze stylem Liquid Glass (wspomniała o Expo). Expo to React Native, więc nie nadaje się do PWA w Next.js. Decyzja (ocena czterech bibliotek webowych: aura-glass, liquid-glass-react, @liquidglass/react, Glass UI): żadna nie ma udokumentowanej zgodności z WCAG ani pełnej obsługi prefers-reduced-transparency, prefers-contrast i prefers-reduced-motion, a trzy z czterech nie mają kompletu komponentów lub są nieaktualne od połowy 2025 r. Zgodnie z wcześniejszą zasadą użytkowniczki („jeśli żadna nie jest dobra, to opcja 1”) wybrano własne szkło matowe w CSS (backdrop-filter, bez załamywania światła) na bezgłowych prymitywach Radix lub React Aria. shadcn/ui nie jest używany.

## Users

Główny użytkownik: świadek zdarzenia, czyli osoba w sytuacji nagłego zatrzymania krążenia, zwykle w stresie, z telefonem w ręku, która potrzebuje najbliższego AED w kilka sekund. Role zgłaszającego, moderatora i opiekuna urządzenia nie wchodzą do pierwszej wersji (potwierdzono tylko świadka).

## Product Purpose

Aplikacja łączy rozproszone informacje o defibrylatorach AED w jeden ogólnopolski zbiór i pokazuje je świadkowi zdarzenia tam, gdzie liczy się każda sekunda. Powstaje jako zgłoszenie do konkursu „Misja AED – Dane na ratunek" (inicjator: Departament Zarządzania Danymi, Ministerstwo Cyfryzacji), którego celem jest otwarty zbiór danych na dane.gov.pl. Sukces: osoba w nagłej sytuacji znajduje AED i instrukcję RKO szybciej, niż zdążyłaby szukać gdziekolwiek indziej.

## Positioning

Ogólnopolski, państwowy, otwarty zbiór AED w jednym miejscu, działający bez kont i bez śledzenia, także offline, z instrukcją RKO opartą na oficjalnych państwowych materiałach.

## Operating Context

Użycie w sytuacji kryzysowej, na telefonie, często w ruchu, na zewnątrz, przy słabym zasięgu i silnym stresie. Aplikacja jest państwowa, więc obowiązuje ją ustawa o dostępności cyfrowej, RODO i oczekiwanie zaufania do źródła.

## Capabilities and Constraints

W zakresie pierwszej wersji (potwierdzone):
- najbliższy AED na podstawie GPS wraz z trasą;
- wyszukiwanie po adresie i mapa;
- instrukcja RKO krok po kroku;
- działanie offline (PWA);
- brak kont i brak śledzenia, lokalizacja przetwarzana na urządzeniu;
- eksport otwartego zbioru (CSV/JSON) zgodny z wymaganiami dane.gov.pl;
- języki: PL, EN, UK.

Dane: źródłem jest wyłącznie import z istniejących źródeł (bez publicznego formularza zgłoszeń w wersji 1). Użytkowniczka dostarczyła prawdziwy zbiór: `C:\Users\japko\Downloads\PL.geojson` (7,1 MB, 18 287 punktów `emergency=defibrillator`, eksport z OpenStreetMap, współrzędne obejmują całą Polskę). Zastępuje on dane mockowe. Dane mają trafić do aplikacji przez warstwę importu oddzieloną od interfejsu.

Co wiadomo o danych (z analizy pliku, nie z założeń):
- Dostęp (`access`): yes 7 799, customers 4 683, private 3 045, permit 1 197, permissive 132, no 47, brak 1 378. Około połowy urządzeń nie jest swobodnie dostępna, więc stan „kto i kiedy może go użyć” jest sednem ekranu, nie dodatkiem.
- Godziny (`opening_hours`): brak w 11 509 z 18 287 (63%); 24/7 w 4 133.
- Opis miejsca: `defibrillator:location` w 12 312 punktach (pl w 5 167, en w 2 407); `description` w 599.
- Piętro (`level`) w 3 701, wnętrze (`indoor`) w 15 959, zdjęcie (`image`) w 2 167, data sprawdzenia (`check_date`) w 5 976, telefon w 4 480.
- Dane zawierają adresy e-mail i telefony operatorów. Mogą być danymi osobowymi: do publicznego eksportu na dane.gov.pl trafiają dopiero po decyzji prawnej i anonimizacji.
- Licencja: OpenStreetMap udostępnia dane na ODbL (wymaga atrybucji i udostępniania pochodnych na tej samej licencji). Zgodność ODbL z wymaganiami dane.gov.pl i wybór licencji eksportu to decyzja otwarta, do potwierdzenia przez urząd.

- ~~stały pasek 112~~ zmiana decyzji użytkowniczki: pasek usunięty (odstrasza), numer 112 jest w instrukcji RKO jako pierwsza karta;
- internacjonalizacja przez next-intl (wskazane przez użytkownika). Reguła procesu: przy każdej zmianie sprawdzać, czy wszystkie klucze mają poprawne tłumaczenia w PL, EN i UK.

Decyzje otwarte: konkretne źródła importu, hosting, dostawca kafelków mapy i geokodera (zgodność z RODO), licencja i metadane zbioru, polski język migowy dla instrukcji RKO.

## Brand Commitments

Wygląd (potwierdzony przez użytkownika): język wizualny Liquid Glass, wyłącznie szkło matowe (bez załamywania światła), ten sam wygląd na iOS i Androidzie z płynnym uproszczeniem. Układ ekranu startowego: standard kategorii, czyli mapa z arkuszem na dole i dolną nawigacją (bez stałego paska 112). Poprzeczka jakości wykonania: mObywatel. Propozycja do potwierdzenia (nie wybrana wprost): odległość, nazwa AED i przycisk 112 leżą na tle litym, a szkło dotyczy nawigacji, arkuszy i warstw drugiego planu; przy prefers-reduced-transparency i prefers-contrast szkło zamienia się w lity kolor.

Aplikacja jest państwowa i ma nosić państwową tożsamość, zgodnie z duchem System Projektowy gov.pl. Oficjalnych zasad tego systemu nie udało się znaleźć, więc przyjęto zasady ogólne bez kopiowania gotowych komponentów: cechy rozpoznawalne dla państwa (biel i czerwień, godło RP w nagłówku, wysoki kontrast, czytelne fonty bezszeryfowe). Jest to założenie do weryfikacji przez Departament Zarządzania Danymi. Użytkownik może podać oficjalne zasady, które wtedy mają pierwszeństwo.

Użytkownik chce użyć profesjonalnych grafik i poradnika RKO z oficjalnych materiałów państwowych: gov.pl / Ministerstwo Zdrowia / Rządowe Centrum Bezpieczeństwa. Dokładny adres strony i licencja nie zostały jeszcze potwierdzone.

## Evidence on Hand

Brak prawdziwych danych AED. Nie wolno zmyślać lokalizacji AED, statystyk skuteczności ani treści medycznych.

Źródło RKO wskazane przez użytkownika: https://zpe.gov.pl/a/resuscytacja-krazeniowo-oddechowa/D1H3G81jq (Zintegrowana Platforma Edukacyjna, „Świat pod lupą", materiał szkolny z edukacji dla bezpieczeństwa). Odczyt strony wykazał:
- Strona nie podaje autora tekstu, daty ani ogólnej licencji tekstu. Licencja tekstu jest nieznana.
- Na CC BY 3.0 (z podaniem autora) wyraźnie opublikowano tylko: dwie animacje (Tomorrow sp. z o.o.), grę edukacyjną RKO (Tomorrow sp. z o.o.) i grafikę „Ogólnopolskie numery alarmowe" (Dariusz Adryan).
- Pozostałe grafiki (diagram algorytmu BLS, ilustracja użycia AED, symbol AED, zdjęcia) nie mają informacji o licencji. Nie wolno ich wbudowywać bez potwierdzenia praw.
- Strona odwołuje się do wytycznych ERC z 2015 r. Treść medyczna musi być sprawdzona pod kątem aktualności przed publikacją.
- Wniosek: aplikacja nie kopiuje tekstu ani grafik ze strony. Kroki RKO piszemy własnymi słowami na podstawie tego źródła, z atrybucją, a grafiki własne lub z potwierdzoną licencją. Każda treść medyczna jest oznaczona jako robocza do czasu weryfikacji przez osobę kompetentną.

## Product Principles

1. Pierwsza sekunda należy do ratowania życia: główna akcja ekranu startowego to znalezienie AED, nic jej nie przesłania.
2. Zaufanie do źródła: treści medyczne pochodzą z oficjalnych materiałów, nie z własnych sformułowań.
3. Bez kont, bez śledzenia: prywatność lokalizacji jest warunkiem, nie opcją.
4. Działa tam, gdzie zasięgu nie ma: offline jest funkcją podstawową.
5. Otwarte dane są produktem: ten sam zbiór zasila aplikację i dane.gov.pl.

## Accessibility & Inclusion

WCAG 2.2 AA jako twarde minimum, AAA tam, gdzie to możliwe (zwłaszcza kontrast i rozmiar celów dotykowych na ekranach ratunkowych). Pełna obsługa czytników ekranu, sterowania głosem i klawiatury, szanowanie ustawień systemowych (ruch, kontrast, rozmiar tekstu). Użytkownik pod stresem i osoby z niepełnosprawnościami są równorzędnymi projektowymi przypadkami.
