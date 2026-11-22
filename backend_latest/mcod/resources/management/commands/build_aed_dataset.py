from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from mcod.resources.aed_aggregation import build_aed_rows, write_aed_outputs, write_aed_tables, write_aed_template


class Command(BaseCommand):
    help = "Łączy dane o defibrylatorach AED ze wszystkich zbiorów portalu w jedną bazę."

    def add_arguments(self, parser):
        parser.add_argument("--out", default=None, help="Folder wynikowy (domyślnie AED_DATASET_CREATION_ROOT)")
        parser.add_argument(
            "--template",
            action="store_true",
            help="Zapisz tylko szablon AED dla dostawców (CSV i XLSX) i zakończ",
        )
        parser.add_argument("--publish", action="store_true", help="Opublikuj wynik jako zasób w portalu")
        parser.add_argument(
            "--owner-pk",
            type=int,
            default=None,
            help="Instytucja-właściciel zbioru łączonego (nadpisuje AED_DATASET_OWNER_ORGANIZATION_PK)",
        )

    def handle(self, *args, **options):
        out_dir = Path(options["out"] or settings.AED_DATASET_CREATION_ROOT)
        if options["template"]:
            for path in write_aed_template(out_dir).values():
                self.stdout.write(f"Szablon: {path}")
            return
        result = build_aed_rows()
        paths = write_aed_outputs(result, out_dir)
        tables = write_aed_tables(result, out_dir) if result.rows else []

        w = self.stdout.write
        w(f"Połączone zbiory: {len(result.sources)}")
        for s in result.sources:
            w(
                f"  [{s['zbior_id']}] {s['zbior_tytul']} ({s['dysponent']}, {s['licencja']}, {s['format']}, tryb: {s['tryb']}): "
                f"odczytane {s['odczytane']}, włączone {s['wlaczone']}, odrzucone {s['odrzucone']}, "
                f"duplikaty {s['duplikaty']}"
            )
        w(f"Pominięte zbiory: {len(result.skipped)}")
        for s in result.skipped:
            w(f"  [{s['zbior_id']}] {s['zbior_tytul']}: {s['powod']}")
        w(f"Rekordy we wspólnej bazie: {len(result.rows)}")
        reasons = Counter(r["powod"] for r in result.rejected)
        w(f"Odrzucone rekordy: {len(result.rejected)} {dict(reasons) if reasons else ''}")
        corrections = Counter(c for r in result.rows for c in r["korekty"])
        w(f"Korekty: {dict(corrections) if corrections else 'brak'}")
        w(f"Duplikaty między zbiorami: {len(result.duplicates)}")
        w(f"Licencja bazy: {result.license or 'brak (żadne źródło nie zostało włączone)'}")
        w(f"Pliki: {out_dir}")
        for p in paths.values():
            w(f"  {p.name}")
        w(f"Tabele wykazu (XLSX): {len(tables)}")
        for t in tables:
            w(f"  [{t['kind']}] {t['title']}: {t['rows']} wierszy -> {t['path'].name}")

        if options["publish"]:
            from mcod.resources.aed_publication import publish_aed_resource

            if not result.rows:
                self.stderr.write("Brak rekordów - publikacja pominięta.")
                return
            resource_pk = publish_aed_resource(result, paths["csv"], options["owner_pk"], tables)
            w(self.style.SUCCESS(f"Opublikowano zasób {resource_pk}."))
