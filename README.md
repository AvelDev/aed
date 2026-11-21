# Misja AED – Dane na ratunek

Zgłoszenie na zadanie konkursowe Ministerstwa Cyfryzacji (HackNation 2026). Ogólnopolski zbiór defibrylatorów AED łączony automatycznie i publikowany na portalu dane.gov.pl.

## Zawartość

| Folder | Opis |
|---|---|
| `backend_latest/` | Backend portalu dane.gov.pl (Django, `mcod`) z dodaną agregacją i publikacją zbioru AED |
| `frontend_latest/` | Frontend portalu dane.gov.pl (Angular) |
| `wyniki/` | Przykładowy wynik agregacji z 21.11.2026 |

## Zmiany AED w backendzie

- `mcod/resources/aed_aggregation.py`: pobranie zasobów AED, normalizacja, walidacja i deduplikacja
- `mcod/resources/aed_publication.py`: publikacja zbioru łączonego jako dataset na portalu
- `mcod/resources/tasks/aed.py`: zadanie Celery `create_aed_dataset_task` (harmonogram w `mcod/celeryapp.py`)
- `mcod/resources/management/commands/build_aed_dataset.py`: ręczne zbudowanie zbioru
- `mcod/core/management/commands/import_aed.py`: import źródeł AED (m.in. API m.st. Warszawy)
- `mcod/settings/base.py`: ustawienia `AED_DATASET_*`
- `mcod/resources/tests/test_aed_aggregation.py`: testy

## Uruchomienie (backend)

```bash
cd backend_latest
cp env.sample .env              # uzupełnij m.in. WARSAW_API_TOKEN, AED_DATASET_OWNER_ORGANIZATION_PK
docker compose up -d
python manage.py import_aed
python manage.py build_aed_dataset
pytest mcod/resources/tests/test_aed_aggregation.py
```

## Wyniki (`wyniki/`)

- `aed_polska.csv` / `aed_polska.json`: zbiór łączony
- `duplikaty.json`: wykryte duplikaty
- `odrzucone.json`: rekordy odrzucone przez walidację
- `pominiete.json`: rekordy pominięte

## Wykorzystanie AI

Kod i dokumentacja powstały ze wsparciem asystenta AI (Claude). Decyzje projektowe podlegały przeglądowi zespołu.
