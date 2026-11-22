# Wykaz defibrylatorów AED w portalu dane.gov.pl: jak działa łączenie

Zbiór „Defibrylatory AED w Polsce – zbiór łączony” powstaje automatycznie ze wszystkich zbiorów o AED opublikowanych w portalu.
Rozwiązanie odtwarza logikę wykazu DGA (`mcod/resources/dga_utils.py`): jeden zbiór, a w środku kilka tabel.

## Co powstaje

W zbiorze są zasoby:

1. **Wykaz zbiorczy (CSV)**: pełny rekord, także oryginalne dane źródłowe (`dane_zrodlowe`) i korekty.
2. **Wykaz zbiorczy (XLSX)**: układ jak zbiorczy wykaz DGA: arkusz „Arkusz 1”, kolumny `Lp.`, `Nazwa dysponenta zasobu`, …, `Warunki ponownego wykorzystywania`.
3. **Po jednej tabeli XLSX na dysponenta** („Wykaz defibrylatorów AED <instytucja>”), jak tabele jednostek w zbiorze 3930 (Opole).

Wykaz przebudowuje zadanie Celery `create_aed_dataset_task` (codziennie o 4:00) albo ręcznie:

    python manage.py build_aed_dataset --publish --owner-pk <instytucja>
    python manage.py build_aed_dataset --template --out <folder>     # szablon dla dostawców (CSV i XLSX)

## Które zbiory trafiają do wykazu

Kolejność źródeł: najpierw zasoby oznaczone flagą, potem wykryte po tytule, w obu grupach starszy zbiór przed nowszym.

1. **Zasoby oznaczone flagą `contains_aed_data`** (jak flaga `contains_protected_data` w DGA): opublikowane, z poprawną walidacją portalu,
   w sztywnym szablonie AED (`AED_TEMPLATE_FIELDS`, wymagane `szerokosc` i `dlugosc`). Zasób niezgodny z szablonem jest pomijany z powodem.
   *To jest nasza propozycja: na dane.gov.pl takiej flagi dla AED nie ma, wymaga zmiany modelu zasobu (migracja `0076`).*
2. **Tryb przejściowy** (`AED_LEGACY_TEXT_DISCOVERY`, domyślnie włączony): zbiory bez flagi są wykrywane po tytule zbioru lub tytule jego zasobu.
   W skanie całego portalu (29 655 zbiorów, 2026-11-22) sygnatura „defibrylator / defibryzator / defibrillator / samodzielne AED” w tytule zbioru lub zasobu
   występuje dokładnie w pięciu zbiorach, wszystkich o AED. Samo „AED” wymaga dodatkowo kontekstu ratowniczego (np. „ratownictwo”, „pierwsza pomoc”),
   bo bywa skrótem czegoś innego.

Zbiór jest pomijany (z powodem w `pominiete.json`), gdy: licencja nie jest CC0 ani CC BY, nie ma odczytywalnego zasobu (GeoJSON, JSON, CSV, XLSX),
żaden rekord nie ma poprawnych współrzędnych w Polsce albo wszystkie rekordy są duplikatami wcześniejszych zbiorów.

## Czego to nie rozwiązuje

- Zbiór z „defibrylator” w tytule i współrzędnymi w Polsce, który nie jest wykazem lokalizacji, wejdzie do wykazu w trybie przejściowym. Pewny jest tylko tryb ze flagą
  (`AED_LEGACY_TEXT_DISCOVERY=False`).
- Samo „AED” bez kontekstu ratowniczego w tytule i opisie jest pomijane (taki dostawca musi oznaczyć zasób flagą).
- Rekordy bez współrzędnych są odrzucane pojedynczo (w DGA pomijany jest cały zasób), bo lepiej pokazać część punktów niż żadnego.
- Walidacja szablonu następuje przy tworzeniu wykazu, a nie przy wgrywaniu zasobu (w DGA: `validate_dga_file_columns`).
- Kolumny wynikowe wykazu pokrywają część pól szablonu. Pozostałe (`kod_teryt`, `stan`, `waznosc_elektrod`, …) zostają w `dane_zrodlowe`.

## Testy

Skrypty w `stack/testy-wykaz/` (uruchamiane przez `stack/manage.ps1 shell`, patrz README w tym folderze): 46 sprawdzeń
(szablon i walidacja, tryb przejściowy, tabele w układzie DGA, XLSX, warianty pisowni).

## Użycie AI

Kod i dokumentacja powstały z pomocą asystenta AI (Claude). Zespół weryfikował wyniki na danych z portalu i testach. *(Do uzupełnienia przez zespół zgodnie z regulaminem §2.8.)*
