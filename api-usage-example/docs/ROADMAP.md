# Plan dalszych prac

Szacunki w dniach roboczych jednej osoby, metodą PERT: (O + 4·M + P) / 6, gdzie O to wariant optymistyczny,
M najbardziej prawdopodobny, P pesymistyczny. Zakres P–O pokazuje niepewność; pozycje zależne od decyzji
urzędu mają szeroki zakres, bo czas oczekiwania na decyzję nie zależy od zespołu.

| Pozycja | O | M | P | PERT | Pewność | Od czego zależy |
|---|---|---|---|---|---|---|
| Własny lub komercyjny dostawca kafelków mapy (RODO) | 1 | 2 | 5 | 2,3 | średnia | wybór dostawcy; zmiana dotyczy tylko stylu w `AedMap.tsx` i reguły w `sw.js` |
| Własna instancja geokodera (np. Nominatim/Photon) | 1 | 3 | 8 | 3,5 | niska | infrastruktura; w kodzie nowa implementacja `Geocoder` |
| Weryfikacja medyczna treści RKO i poprawki tłumaczeń | 2 | 4 | 10 | 4,7 | niska | dostępność konsultanta medycznego i tłumaczy |
| Produkcyjna baza PostgreSQL i automatyczne odświeżanie danych OSM | 2 | 3 | 6 | 3,3 | średnia | usługa zarządzana; skrypty `db:import` i `data:build` już istnieją |
| Testy end-to-end (Playwright) dla ekranu głównego i offline | 1 | 2 | 4 | 2,2 | wysoka | brak zależności zewnętrznych |
| Audyt dostępności zewnętrzny i deklaracja dostępności | 3 | 5 | 15 | 6,3 | niska | termin audytora |
| Licencja eksportu i publikacja w dane.gov.pl | 1 | 3 | 20 | 6,2 | niska | decyzja urzędu (ODbL a wymagania portalu) |

Razem (suma PERT): ok. 28 dni; realistyczny zakres 11–68 dni, rozpiętość wynika głównie z decyzji poza zespołem.

Po zakończeniu pozycji dopisz rzeczywisty czas obok szacunku. Porównanie szacunków z wynikami to jedyny
sposób, żeby kolejne szacunki były trafniejsze.
