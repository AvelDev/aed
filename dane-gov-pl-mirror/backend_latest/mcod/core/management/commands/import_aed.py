"""
Import rzeczywistych zbiorów danych o defibrylatorach AED z dane.gov.pl
oraz usunięcie danych demonstracyjnych załadowanych przez init_mcod_db.

Użycie:
    python manage.py import_aed                 # usuwa dane demo + importuje AED
    python manage.py import_aed --keep-demo     # tylko import
    python manage.py import_aed --no-eager      # zadania celery do kolejki (wymaga workera)

Zbiór m.st. Warszawy na dane.gov.pl zawiera tylko link do katalogu
dane.um.warszawa.pl. Jeżeli ustawiona jest zmienna WARSAW_API_TOKEN, dane są
pobierane z API Warszawy i zapisywane jako pliki GeoJSON i CSV.
"""

import csv
import io
import json
import os
from datetime import date

import requests
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import QuerySet
from django.utils.text import slugify

API = "https://api.dane.gov.pl/1.4"
MEDIA_BASE = "https://api.dane.gov.pl"
SEARCH_QUERIES = ("defibrylator", "defibrylatory", "AED")
WARSAW_API_URL = "https://dane.um.warszawa.pl/api/action/get_scb_lokalizacja_defibrylatorow"
WARSAW_CATALOGUE_HOST = "dane.um.warszawa.pl"

FREQ_MAP = {
    "Codziennie": "daily",
    "Raz w tygodniu": "weekly",
    "Raz w miesiącu": "monthly",
    "Raz na kwartał": "quarterly",
    "Raz na pół roku": "everyHalfYear",
    "Raz w roku": "yearly",
    "Nieregularnie": "irregular",
    "Brak planowanych aktualizacji": "notPlanned",
    "Jednorazowe udostępnienie": "notPlanned",
    "Nie dotyczy": "notApplicable",
}
EXT_TO_MIME = {
    "csv": "text/csv",
    "json": "application/json",
    "geojson": "application/geo+json",
    "gml": "application/gml+xml",
    "xml": "application/xml",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _get(url, **params):
    r = requests.get(url, params=params, timeout=60, headers={"Accept": "application/json"})
    r.raise_for_status()
    return r.json()


def _clean(text):
    return (text or "").replace("<mark>", "").replace("</mark>", "").strip()


class Command(BaseCommand):
    help = "Usuwa dane demonstracyjne i importuje zbiory o defibrylatorach AED z dane.gov.pl"

    def add_arguments(self, parser):
        parser.add_argument("--keep-demo", action="store_true", help="Nie usuwaj danych demonstracyjnych")
        parser.add_argument("--no-eager", action="store_true", help="Nie wykonuj zadań celery synchronicznie")
        parser.add_argument(
            "--fix-schemas",
            action="store_true",
            help="Tylko: popraw błędnie wykryte typy kolumn w zasobach AED z błędem indeksowania i zleć ponowne indeksowanie",
        )

    def handle(self, *args, **options):
        if options["fix_schemas"]:
            return self.fix_schemas()

        if not options["no_eager"]:
            # brak workera celery w środowisku lokalnym -> wykonuj zadania od razu
            from mcod.celeryapp import app

            app.conf.task_always_eager = True
            app.conf.task_eager_propagates = False

        from mcod.users.models import User

        self.admin = User.objects.filter(is_superuser=True).order_by("id").first()

        if not options["keep_demo"]:
            self.remove_demo_data()

        datasets = self.find_aed_datasets()
        self.stdout.write(f"Znaleziono {len(datasets)} zbiorów AED na dane.gov.pl: {', '.join(datasets)}")
        for ds_id in datasets:
            try:
                self.import_dataset(ds_id)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"[{ds_id}] błąd importu: {exc}"))
        self.stdout.write(self.style.SUCCESS("Import zakończony."))

    # --------------------------------------------------------------- schema
    def fix_schemas(self):
        """
        Automatyczne wnioskowanie typów potrafi uznać np. numer budynku ('25/27')
        za integer, a kolumnę z JSON-em za 'object' (nieobsługiwany w indeksie).
        Zamieniamy takie kolumny na string (poza id i współrzędnymi).
        """
        from mcod.resources.models import Resource
        from mcod.resources.tasks.process_resource_file_data import process_resource_file_data_task

        keep_numeric = {"id", "defibrillator_id", "latitude", "longitude"}
        bad_types = {"integer", "number", "boolean", "date", "datetime", "time", "year", "object", "array", "any"}
        qs = Resource.raw.filter(data_tasks_last_status="FAILURE", dataset__title__icontains="defibryl")
        for res in qs:
            tds = res.tabular_data_schema or res.data.get_schema(revalidate=True)
            for f in tds.get("fields", []):
                if f["name"] not in keep_numeric and f.get("type") in bad_types:
                    f["type"], f["format"] = "string", "default"
            Resource.raw.filter(pk=res.pk).update(tabular_data_schema=tds)
            process_resource_file_data_task.apply_async(args=(res.pk,))
            self.stdout.write(f"Poprawiono schemat i zlecono indeksowanie zasobu {res.pk}")

    # ------------------------------------------------------------------ demo
    def remove_demo_data(self):
        from mcod.academy.models import Course
        from mcod.datasets.models import Dataset
        from mcod.harvester.models import DataSource
        from mcod.laboratory.models import LabEvent
        from mcod.organizations.models import Organization
        from mcod.resources.models import Resource
        from mcod.showcases.models import Showcase
        from mcod.tags.models import Tag

        demo_orgs = Organization.raw.filter(slug="pierwsza-instytucja")
        demo_ds = Dataset.raw.filter(organization__in=demo_orgs)
        steps = [
            ("zasoby", Resource.raw.filter(dataset__in=demo_ds)),
            ("zbiory", demo_ds),
            ("źródła harvestera", DataSource.raw.all()),
            ("instytucje", demo_orgs),
            ("wydarzenia laboratorium", LabEvent.raw.all()),
            ("kursy akademii", Course.raw.all()),
            ("innowacje (showcases)", Showcase.raw.all()),
            ("tagi", Tag.objects.filter(name__in=["Liczba ludności", "PoCoToTag"])),
        ]
        for label, qs in steps:
            pks = list(qs.values_list("pk", flat=True))
            if not pks:
                continue
            model = qs.model
            # 1) zwykłe usunięcie -> sygnały zdejmują dokumenty z Elasticsearch / RDF
            for obj in model._base_manager.filter(pk__in=pks):
                try:
                    with transaction.atomic():
                        obj.delete()
                except Exception as exc:
                    self.stderr.write(f"  ! {label} {obj.pk}: {exc}")
            # 2) twarde usunięcie wiersza z bazy (omija soft-delete)
            try:
                QuerySet(model=model).filter(pk__in=pks).delete()
            except Exception as exc:
                self.stderr.write(f"  ! twarde usunięcie {label}: {exc}")
            self.stdout.write(f"Usunięto demo: {label} ({len(pks)})")

    # --------------------------------------------------------------- search
    def find_aed_datasets(self):
        found = set()
        for q in SEARCH_QUERIES:
            for item in _get(f"{API}/datasets", q=q, per_page=100).get("data", []):
                attrs = item["attributes"]
                text = (_clean(attrs.get("title")) + " " + _clean(attrs.get("notes"))).lower()
                if "defibryl" in text:
                    found.add(item["id"])
        return sorted(found, key=int)

    # ---------------------------------------------------------- organization
    def get_or_create_org(self, inst_id):
        from mcod.organizations.models import Organization

        a = _get(f"{API}/institutions/{inst_id}")["data"]["attributes"]
        org = Organization.raw.filter(slug=a["slug"]).first() or Organization(slug=a["slug"])
        org.title = a["title"]
        org.description = a.get("description") or ""
        org.institution_type = a.get("institution_type") or "local"
        for f in (
            "regon",
            "email",
            "website",
            "epuap",
            "tel",
            "fax",
            "city",
            "postal_code",
            "street",
            "street_type",
            "street_number",
            "flat_number",
            "abbreviation",
        ):
            if hasattr(org, f):
                setattr(org, f, a.get(f) or "")
        org.status = "published"
        org.is_removed = False
        org.created_by = org.created_by or self.admin
        org.modified_by = self.admin
        if a.get("image_url") and not org.image:
            try:
                img = requests.get(MEDIA_BASE + a["image_url"], timeout=60)
                img.raise_for_status()
                org.image.save(os.path.basename(a["image_url"]), _cf(img.content), save=False)
            except Exception as exc:  # logo nie jest krytyczne
                self.stderr.write(f"  ! logo {a['title']}: {exc}")
        org.save()
        return org

    # -------------------------------------------------------------- dataset
    def import_dataset(self, ds_id):
        from mcod.categories.models import Category
        from mcod.datasets.models import Dataset

        d = _get(f"{API}/datasets/{ds_id}", include="institution")
        a = d["data"]["attributes"]
        inst_id = d["data"]["relationships"]["institution"]["data"]["id"]
        org = self.get_or_create_org(inst_id)

        slug = a.get("slug") or slugify(a["title"])
        ds = Dataset.raw.filter(slug=slug, organization=org).first() or Dataset(slug=slug, organization=org)
        ds.title = _clean(a["title"])
        ds.notes = a.get("notes") or ds.title
        ds.update_frequency = FREQ_MAP.get(a.get("update_frequency"), "notPlanned")
        ds.has_dynamic_data = bool(a.get("has_dynamic_data"))
        ds.has_high_value_data = bool(a.get("has_high_value_data"))
        ds.has_research_data = bool(a.get("has_research_data"))
        ds.license_condition_default_cc40 = True if (a.get("license_name") or "").startswith("CC BY") else None
        ds.status = "published"
        ds.is_removed = False
        ds.created_by = ds.created_by or self.admin
        ds.modified_by = self.admin
        ds.save()

        codes = [c.get("code") for c in a.get("categories", []) if c.get("code")]
        cats = Category.objects.filter(code__in=codes)
        if cats.exists():
            ds.categories.set(cats)
            if hasattr(ds, "category_id") and not ds.category_id:
                ds.category = cats.first()
                ds.save()

        self.stdout.write(f"[{ds_id}] {ds.title} — {org.title}")
        resources = _get(f"{API}/datasets/{ds_id}/resources", per_page=100).get("data", [])
        for pos, r in enumerate(resources, start=1):
            ra = r["attributes"]
            if WARSAW_CATALOGUE_HOST in (ra.get("link") or ""):
                self.import_warsaw(ds, r, pos)
            else:
                self.import_file_resource(ds, r, pos)

    # ------------------------------------------------------------- resource
    def _upsert_resource(self, ds, ext_ident, title, description, position, **extra):
        from mcod.resources.models import Resource

        res = Resource.raw.filter(dataset=ds, ext_ident=ext_ident).first()
        if res:
            # ponowny import: usuń stary zasób i utwórz od nowa ze świeżym plikiem
            QuerySet(model=Resource).filter(pk=res.pk).delete()
        res = Resource(dataset=ds, ext_ident=ext_ident)
        res.title = title
        res.description = description or title
        res.position = position
        res.language = "pl"
        res.status = "published"
        res.created_by = self.admin
        res.modified_by = self.admin
        for k, v in extra.items():
            setattr(res, k, v)
        res.save()
        return res

    def _attach_file(self, res, name, content):
        from mcod.resources.models import ResourceFile

        ext = name.rsplit(".", 1)[-1].lower()
        upload = SimpleUploadedFile(name=name, content=content, content_type=EXT_TO_MIME.get(ext, "application/octet-stream"))
        # post_save ResourceFile uruchamia walidację, wykrycie formatu i indeksowanie danych
        ResourceFile.objects.create(resource=res, is_main=True, file=upload)
        res.refresh_from_db()
        self.stdout.write(
            f"    + zasób {res.id}: {res.title[:60]} [{res.format or '?'}] "
            f"file={res.file_tasks_last_status or '-'} data={res.data_tasks_last_status or '-'}"
        )

    def import_file_resource(self, ds, r, position):
        a = r["attributes"]
        url = a.get("file_url") or a.get("link")
        try:
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
        except Exception as exc:
            self.stderr.write(f"    ! pobranie {url}: {exc}")
            return
        res = self._upsert_resource(
            ds,
            str(r["id"]),
            a["title"],
            a.get("description"),
            position,
            has_dynamic_data=bool(a.get("has_dynamic_data")),
            has_high_value_data=bool(a.get("has_high_value_data")),
            has_research_data=bool(a.get("has_research_data")),
            contains_protected_data=bool(a.get("contains_protected_data")),
            data_date=a.get("data_date") or date.today(),
        )
        self._attach_file(res, os.path.basename(url.split("?")[0]), resp.content)

    # -------------------------------------------------------------- Warsaw
    def import_warsaw(self, ds, r, position):
        token = os.environ.get("WARSAW_API_TOKEN")
        if not token:
            self.stderr.write("    ! brak WARSAW_API_TOKEN — pomijam zasób Warszawy")
            return
        resp = requests.post(WARSAW_API_URL, headers={"Authorization": token}, timeout=120)
        resp.raise_for_status()
        items = json.loads(resp.content.decode("utf-8-sig"))

        features, rows = [], []
        for it in items:
            props = it.get("properties", {})
            coords = (it.get("geometry") or {}).get("coordinates") or []
            # API zwraca [[lon, lat]] — normalizujemy do punktu GeoJSON [lon, lat]
            if coords and isinstance(coords[0], list):
                coords = coords[0]
            lon, lat = (coords + [None, None])[:2]
            features.append(
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}
            )
            rows.append({**props, "longitude": lon, "latitude": lat})

        geojson = json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False).encode("utf-8")
        fields = sorted({k for row in rows for k in row if k not in ("longitude", "latitude")}) + ["latitude", "longitude"]
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fields, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
        csv_bytes = buf.getvalue().encode("utf-8")

        a = r["attributes"]
        desc = (
            f"<p>{len(items)} aktywnych urządzeń AED na terenie Warszawy. Dane pobrane z API "
            f"Stołecznego Centrum Bezpieczeństwa (dane.um.warszawa.pl) {date.today():%Y-%m-%d}.</p>"
        )
        today = date.today()
        res = self._upsert_resource(
            ds, f"{r['id']}-geojson", "Lokalizacja defibrylatorów (AED) w Warszawie — GeoJSON", desc, position,
            data_date=today, has_dynamic_data=True,
        )
        self._attach_file(res, "lokalizacja_defibrylatorow_warszawa.geojson", geojson)
        res = self._upsert_resource(
            ds, f"{r['id']}-csv", "Lokalizacja defibrylatorów (AED) w Warszawie — CSV", desc, position + 1,
            data_date=today, has_dynamic_data=True,
        )
        self._attach_file(res, "lokalizacja_defibrylatorow_warszawa.csv", csv_bytes)
        # dodatkowo link do oryginalnego katalogu / API
        self._upsert_resource(
            ds, str(r["id"]), a["title"], a.get("description") or "Źródło danych: katalog dane.um.warszawa.pl",
            position + 2, link=a.get("link"), data_date=today,
        )


def _cf(content):
    from django.core.files.base import ContentFile

    return ContentFile(content)
