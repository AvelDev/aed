"""
Publikacja łączonej bazy AED jako zasobu w portalu.

Funkcje tworzenia zbioru/zasobu z kodu DGA (dga_utils) są związane z ustawieniami
MAIN_DGA_* i tabelą AggregatedDGAInfo, więc nie da się ich użyć bez modyfikacji.
Ten moduł robi to samo w analogiczny sposób dla AED, w oparciu o ustawienia AED_*.
"""

import datetime
import logging
import os
from pathlib import Path
from typing import List, Optional

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.utils.html import escape

from mcod.resources.aed_aggregation import AED_LICENSE_CC_BY, AED_OUTPUT_COLUMNS, AEDAggregationResult

logger = logging.getLogger("mcod")


class AEDPublicationNotConfigured(Exception):
    """Brak instytucji-właściciela zbioru łączonego (AED_DATASET_OWNER_ORGANIZATION_PK)."""


def get_aed_owner_organization(organization_pk: Optional[int] = None):
    Organization = apps.get_model("organizations", "Organization")
    organization_pk = organization_pk or settings.AED_DATASET_OWNER_ORGANIZATION_PK
    if not organization_pk:
        raise AEDPublicationNotConfigured("AED_DATASET_OWNER_ORGANIZATION_PK nie jest ustawione.")
    try:
        return Organization.objects.get(pk=organization_pk)
    except Organization.DoesNotExist:
        raise ObjectDoesNotExist(f"Instytucja {organization_pk} (właściciel zbioru AED) nie istnieje.")


def _apply_license(dataset, license_name: Optional[str]) -> None:
    Dataset = apps.get_model("datasets", "Dataset")
    if license_name == AED_LICENSE_CC_BY:
        dataset.license_condition_default_cc40 = True
        dataset.license_chosen = Dataset.LICENSE_CC_BY
    else:
        dataset.license_condition_default_cc40 = None
        dataset.license_chosen = Dataset.LICENSE_CC0


def get_or_create_aed_dataset(license_name: Optional[str], organization_pk: Optional[int] = None):
    Dataset = apps.get_model("datasets", "Dataset")
    Category = apps.get_model("categories", "Category")
    Tag = apps.get_model("tags", "Tag")

    organization = get_aed_owner_organization(organization_pk)
    dataset = Dataset.objects.filter(organization=organization, title=settings.AED_DATASET_TITLE).first()
    created = dataset is None
    if created:
        dataset = Dataset(
            title=settings.AED_DATASET_TITLE,
            notes=settings.AED_DATASET_DESC,
            organization=organization,
            update_frequency=settings.AED_DATASET_UPDATE_FREQUENCY,
            has_dynamic_data=False,
            has_high_value_data=False,
            has_high_value_data_from_ec_list=False,
            has_research_data=False,
            status="published",
        )
    _apply_license(dataset, license_name)
    with transaction.atomic():
        dataset.save()
        if created:
            categories = list(Category.objects.filter(title__in=settings.AED_DATASET_CATEGORIES_TITLES))
            pl_lang = settings.LANGUAGES[0][0]
            tags: List = [Tag.objects.get_or_create(name=name, language=pl_lang)[0] for name in settings.AED_DATASET_TAGS_NAMES]
            dataset.categories.set(categories)
            dataset.tags.set(tags)
            if categories and not dataset.category_id:
                dataset.category = categories[0]
                dataset.save()
    logger.info("AED: %s zbiór łączony %s.", "utworzono" if created else "użyto", dataset.pk)
    return dataset


def build_aed_resource_description(result: AEDAggregationResult) -> str:
    """Opis z listą źródeł - CC BY wymaga wskazania autorów i wprowadzonych zmian."""
    items = "".join(
        f'<li>{escape(s["dysponent"])}: <a href="{escape(s["zrodlo_url"])}">{escape(s["zbior_tytul"])}</a> '
        f'({escape(s["licencja"])}, rekordów: {s["wlaczone"]})</li>'
        for s in result.sources
    )
    return (
        f"<p>{escape(settings.AED_RESOURCE_DEFAULT_DESC)}</p>"
        f"<p>Licencja zbioru łączonego: {escape(result.license or '')}. Źródła:</p><ul>{items}</ul>"
        "<p>Zmiany wprowadzone przy łączeniu są opisane w kolumnie <code>korekty</code> "
        "(np. zamiana kolejności współrzędnych), a oryginalny rekord w kolumnie <code>dane_zrodlowe</code>.</p>"
    )


AED_NUMBER_COLUMNS = ("szerokosc", "dlugosc")
AED_INTEGER_COLUMNS = ("zrodlo_zbior_id",)


def build_aed_table_schema() -> dict:
    """
    Jawny schemat tabeli zasobu AED. Bez niego automatyczne wnioskowanie typów
    uznaje kolumnę `dane_zrodlowe` (JSON w komórce) za typ `object`, którego
    indeksowanie danych tabelarycznych nie obsługuje.
    `missingValues` musi być równe liście znaków specjalnych zasobu (tu pustej),
    inaczej zadanie indeksowania wygeneruje schemat od nowa.
    """
    fields = []
    for column in AED_OUTPUT_COLUMNS:
        if column in AED_NUMBER_COLUMNS:
            type_ = "number"
        elif column in AED_INTEGER_COLUMNS:
            type_ = "integer"
        else:
            type_ = "string"
        fields.append({"name": column, "type": type_, "format": "default"})
    return {"fields": fields, "missingValues": []}


XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
AED_TABLE_EXT_IDENT_MAIN = "aed-aggregate-wykaz"  # ext_ident ma najwyżej 36 znaków
AED_TABLE_EXT_IDENT_UNIT = "aed-aggregate-tabela-%d"


def build_aed_table_description(result: AEDAggregationResult, table: dict) -> str:
    """Opis tabeli wykazu: zbiorczej (wszystkie źródła) albo jednego dysponenta."""
    if table["kind"] == "main":
        return build_aed_resource_description(result)
    sources = [s for s in result.sources if s["dysponent"] == table["dysponent"]]
    items = "".join(
        f'<li><a href="{escape(s["zrodlo_url"])}">{escape(s["zbior_tytul"])}</a> '
        f'({escape(s["licencja"])}, rekordów: {s["wlaczone"]})</li>'
        for s in sources
    )
    return (
        f"<p>Defibrylatory AED udostępnione w portalu dane.gov.pl przez: {escape(table['dysponent'])}. "
        f"To jedna z tabel wykazu „{escape(settings.AED_DATASET_TITLE)}”.</p><ul>{items}</ul>"
        "<p>Zmiany wprowadzone przy łączeniu są opisane w kolumnie „Zmiany wprowadzone przy łączeniu”.</p>"
    )


def _create_aed_resource(dataset, *, title, description, ext_ident, path, content_type, schema=None):
    Resource = apps.get_model("resources", "Resource")
    ResourceFile = apps.get_model("resources", "ResourceFile")
    params = {}
    if schema is not None:
        params["tabular_data_schema"] = schema
    resource = Resource.objects.create(
        title=title,
        description=description,
        dataset=dataset,
        ext_ident=ext_ident,
        has_dynamic_data=False,
        has_high_value_data=False,
        has_high_value_data_from_ec_list=False,
        has_research_data=False,
        contains_protected_data=False,
        status="published",
        data_date=datetime.date.today(),
        **params,
    )
    with open(path, "rb") as f:
        upload = SimpleUploadedFile(name=os.path.basename(path), content=f.read(), content_type=content_type)
    # post_save ResourceFile uruchamia standardową walidację i indeksowanie
    ResourceFile.objects.create(resource=resource, is_main=True, file=upload)
    return resource


def publish_aed_resource(
    result: AEDAggregationResult,
    csv_path: Path,
    organization_pk: Optional[int] = None,
    tables: Optional[List[dict]] = None,
) -> int:
    """
    Tworzy w zbiorze łączonym tabele wykazu i usuwa poprzednie wersje (jak wykaz DGA: jeden zbiór, w środku kilka tabel).
    - zasób CSV z pełnym rekordem (w tym dane_zrodlowe) - zwracany pk,
    - tabele XLSX w układzie wykazu DGA: zbiorcza i po jednej dla każdego dysponenta (parametr tables).
    """
    Resource = apps.get_model("resources", "Resource")

    dataset = get_or_create_aed_dataset(result.license, organization_pk)
    previous = list(
        Resource.objects.filter(dataset=dataset, ext_ident__startswith=settings.AED_RESOURCE_EXT_IDENT).values_list("pk", flat=True)
    )
    with transaction.atomic():
        resource = _create_aed_resource(
            dataset,
            title=settings.AED_RESOURCE_DEFAULT_TITLE,
            description=build_aed_resource_description(result),
            ext_ident=settings.AED_RESOURCE_EXT_IDENT,
            path=csv_path,
            content_type="text/csv",
            schema=build_aed_table_schema(),
        )
        unit_number = 0
        for table in tables or []:
            if table["kind"] == "main":
                ext_ident = AED_TABLE_EXT_IDENT_MAIN
            else:
                unit_number += 1
                ext_ident = AED_TABLE_EXT_IDENT_UNIT % unit_number
            _create_aed_resource(
                dataset,
                title=table["title"],
                description=build_aed_table_description(result, table),
                ext_ident=ext_ident,
                path=table["path"],
                content_type=XLSX_CONTENT_TYPE,
            )

    for pk in previous:
        old = Resource.objects.filter(pk=pk).first()
        if old:
            old.delete()
            logger.info("AED: usunięto poprzednią wersję zasobu %s.", pk)
    logger.info("AED: opublikowano zasób %s i tabel: %d w zbiorze %s.", resource.pk, len(tables or []), dataset.pk)
    return resource.pk
