# Misja AED – Dane na ratunek

Zgłoszenie na zadanie konkursowe Ministerstwa Cyfryzacji (HackNation 2026): ogólnopolski wykaz defibrylatorów AED, łączony automatycznie ze zbiorów AED opublikowanych w portalu dane.gov.pl i udostępniany przez API portalu.

| Folder | Co to jest |
|---|---|
| [`dane-gov-pl-mirror/`](dane-gov-pl-mirror/) | Kopia portalu dane.gov.pl (backend Django `mcod` + frontend Angular) z dodanym łączeniem zbiorów AED w jeden wykaz zbiorczy |
| [`api-usage-example/`](api-usage-example/) | Przykładowa aplikacja (Next.js, PWA), która korzysta wyłącznie z API wykazu zbiorczego: najbliższy AED, mapa, eksport CSV/GeoJSON |

```
zbiory AED w portalu          dane-gov-pl-mirror                               api-usage-example
(Krosno, Przemyśl,    ──►  import_aed ──► build_aed_dataset --publish  ──►  GET /1.4/resources/<id>/data
 Marki, Warszawa…)          zbiór „Defibrylatory AED w Polsce – zbiór łączony”     (aplikacja na :3000)
                            zasób „Defibrylatory AED – wykaz zbiorczy” (API :8001, portal :4200)
```

Jak działa łączenie (kolumny, flaga `contains_aed_data`, tabele jak w wykazie DGA): [`dane-gov-pl-mirror/AED_WYKAZ.md`](dane-gov-pl-mirror/AED_WYKAZ.md).

## Wymagania

- Python 3.8, PostgreSQL, Redis i Elasticsearch 6.8 (albo Docker, patrz niżej)
- Node.js 22.18 lub nowszy (frontend portalu i aplikacja przykładowa)
- dostęp do internetu przy imporcie (`import_aed` pobiera zbiory z api.dane.gov.pl i z API m.st. Warszawy)

## 1. Portal z danymi AED (`dane-gov-pl-mirror`)

Wszystkie komendy `python manage.py …` uruchamiaj w `dane-gov-pl-mirror/backend_latest` w środowisku z zależnościami z `Pipfile`.

### 1.1. Konfiguracja

```bash
cd dane-gov-pl-mirror/backend_latest
cp env.sample .env
cp mcod/settings/local.py.sample mcod/settings/local.py
```

W `.env` ustaw adresy lokalne (pozostałe wartości z `env.sample` mogą zostać):

```ini
BASE_URL=http://localhost:4200
FRONTEND_BASE_URL=http://localhost:4200
API_URL=http://localhost:8001
API_URL_INTERNAL=http://localhost:8001
ADMIN_URL=http://localhost:8000
```

Bez RabbitMQ i workera Celery dopisz na końcu `mcod/settings/local.py`:

```python
CELERY_TASK_ALWAYS_EAGER = True  # zadania Celery wykonywane od razu, bez kolejki
```

Token API m.st. Warszawy (`WARSAW_API_TOKEN`) jest już w `env.sample`. Bez niego import pominie Warszawę, czyli ok. 90% punktów.

### 1.2. Baza, indeksy i dane AED (jednorazowo)

```bash
python manage.py init_mcod_db                 # migracje (w tym 0076: flaga contains_aed_data) i dane podstawowe
python manage.py search_index --rebuild -f    # indeksy Elasticsearch
python manage.py import_aed                   # zbiory AED z dane.gov.pl i API Warszawy (usuwa dane demonstracyjne)
python manage.py build_aed_dataset --publish --owner-pk <id instytucji>
```

`--owner-pk` to instytucja, do której należy zbiór łączony. Może to być dowolna z zaimportowanych instytucji: ich lista jest pod `http://localhost:8001/1.4/institutions` (gdy API już działa) albo w panelu administracyjnym. Zamiast parametru można ustawić `AED_DATASET_OWNER_ORGANIZATION_PK` w `.env`.

Komenda wypisuje połączone zbiory, liczbę rekordów i numer opublikowanego zasobu. Ten numer to `AED_RESOURCE_ID` dla aplikacji przykładowej. W produkcji zbiór odświeża zadanie Celery `create_aed_dataset_task` codziennie o 4:00.

### 1.3. API i frontend portalu

API (port 8001):

```bash
# Linux / macOS
COMPONENT=api FALCON_LIMITER_ENABLED=no gunicorn mcod.api:app -b 0.0.0.0:8001
# Windows (gunicorn nie działa): pip install waitress
#   $env:COMPONENT="api"; $env:FALCON_LIMITER_ENABLED="no"; python -m waitress --listen=0.0.0.0:8001 mcod.api:app
```

Frontend portalu (port 4200), w drugim terminalu:

```bash
cd dane-gov-pl-mirror/frontend_latest
npm install
npx ng serve --configuration local --proxy-config proxy.aedlocal.conf.json --port 4200
```

Ważne: użyj `--proxy-config proxy.aedlocal.conf.json`. Sam `npm run start:local` kieruje zapytania do `api.mcod.local`, który bez nginx z Dockera nie istnieje, więc strona ładuje się bez danych.

### 1.4. Sprawdzenie

- Portal: http://localhost:4200. Wyszukaj „defibrylator” (najpierw wejdź na stronę główną) albo otwórz zbiór „Defibrylatory AED w Polsce – zbiór łączony”. Pierwsze wejście na stronę trwa dłużej, bo Angular kompiluje ją na żądanie.
- API zbioru: `http://localhost:8001/1.4/datasets?q=defibrylator`
- API wykazu: `http://localhost:8001/1.4/resources/<id zasobu>/data?per_page=100`. Zwraca 19 kolumn wykazu, maksymalnie 100 wierszy na stronę.

### Wariant z Dockerem

Pełne środowisko upstreamu (nginx, `*.mcod.local`, Celery, CMS) opisuje [`dane-gov-pl-mirror/backend_latest/README.md`](dane-gov-pl-mirror/backend_latest/README.md). Komendy z kroku 1.2 uruchamia się wtedy przez `docker compose -f docker-compose.local.yml run mcod-local-run python manage.py …`.

## 2. Aplikacja przykładowa (`api-usage-example`)

Wymaga działającego API z kroku 1.

```bash
cd api-usage-example
npm install
cp .env.example .env.local      # gotowe dla lokalnego portalu: API :8001, portal :4200
npm run dev                     # http://localhost:3000
```

Jeśli zasób wykazu ma inny numer niż w `.env.example` (`AED_RESOURCE_ID=24`), wpisz numer z kroku 1.2 do `.env.local`. Połączenie sprawdzisz pod `http://localhost:3000/api/health`: odpowiedź zawiera liczbę punktów i adres źródła.

Szczegóły (mapowanie kolumn, trasy API, testy): [`api-usage-example/README.md`](api-usage-example/README.md).

## Wykorzystanie AI

Kod i dokumentacja powstały ze wsparciem asystenta AI (Claude). Decyzje projektowe podlegały przeglądowi zespołu.
