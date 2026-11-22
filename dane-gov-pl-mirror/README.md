# dane-gov-pl-mirror

Kopia kodu portalu dane.gov.pl (`backend_latest`: Django `mcod`, `frontend_latest`: Angular) z dodanym łączeniem zbiorów AED w jeden wykaz zbiorczy. Pierwszy commit repozytorium to niezmieniony kod portalu, więc `git diff` względem niego pokazuje dokładnie nasze zmiany.

Uruchomienie: [README w katalogu głównym](../README.md). Działanie wykazu: [AED_WYKAZ.md](AED_WYKAZ.md).

## Zmiany AED w backendzie (`backend_latest/mcod`)

| Plik | Co robi |
|---|---|
| `resources/aed_aggregation.py` | wybór zasobów AED (flaga `contains_aed_data`, przejściowo rozpoznanie po tytule), odczyt CSV/XLSX/JSON/GeoJSON, normalizacja, walidacja, deduplikacja, tabele XLSX jak w wykazie DGA |
| `resources/aed_publication.py` | publikacja zbioru „Defibrylatory AED w Polsce – zbiór łączony” i jego zasobów |
| `resources/tasks/aed.py` | zadanie Celery `create_aed_dataset_task` (harmonogram w `celeryapp.py`, codziennie 4:00) |
| `resources/management/commands/build_aed_dataset.py` | ręczne zbudowanie wykazu: `--publish`, `--owner-pk`, `--template` (szablon dla dostawców) |
| `core/management/commands/import_aed.py` | import prawdziwych zbiorów AED z dane.gov.pl i API m.st. Warszawy do lokalnej kopii |
| `resources/models.py`, `resources/admin.py`, `resources/migrations/0076_resource_contains_aed_data.py` | flaga zasobu `contains_aed_data` |
| `settings/base.py` | ustawienia `AED_*` |
| `resources/tests/test_aed_aggregation.py` | testy |

Poza tym `env.sample` (token API Warszawy), `docker-compose*.yml` oraz `frontend_latest/proxy.aedlocal.conf.json` (proxy frontendu na lokalne API :8001).

## Wyniki (`wyniki/`)

Przykładowy wynik łączenia z 21.11.2026:

- `aed_polska.csv` i `aed_polska.json`: wykaz zbiorczy
- `duplikaty.json`: wykryte duplikaty
- `odrzucone.json`: rekordy odrzucone przez walidację
- `pominiete.json`: pominięte zbiory
