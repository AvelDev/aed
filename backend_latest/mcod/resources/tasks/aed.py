import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from django.conf import settings

from mcod.core.tasks import extended_shared_task
from mcod.resources.aed_aggregation import build_aed_rows, write_aed_outputs
from mcod.resources.aed_publication import AEDPublicationNotConfigured, publish_aed_resource

logger = logging.getLogger("mcod")


@extended_shared_task(
    atomic=False,
    name="mcod.resources.tasks.create_aed_dataset_task",
)
def create_aed_dataset_task(organization_pk: Optional[int] = None) -> Dict[str, Any]:
    """
    Łączy dane o defibrylatorach AED ze wszystkich zbiorów portalu i publikuje
    wynik (CSV) jako zasób w zbiorze instytucji AED_DATASET_OWNER_ORGANIZATION_PK.

    1. Połączenie danych (build_aed_rows).
    2. Zapis plików wynikowych do AED_DATASET_CREATION_ROOT/<data>.
    3. Publikacja zasobu i usunięcie poprzedniej wersji (jeśli skonfigurowano instytucję).
    """
    logger.info("Step 1/3: Building AED rows.")
    result = build_aed_rows()

    logger.info("Step 2/3: Writing AED output files.")
    out_dir = Path(settings.AED_DATASET_CREATION_ROOT) / datetime.now().strftime("%Y%m%d")
    paths = write_aed_outputs(result, out_dir)

    summary: Dict[str, Any] = {
        "sources": len(result.sources),
        "skipped": len(result.skipped),
        "rows": len(result.rows),
        "rejected": len(result.rejected),
        "duplicates": len(result.duplicates),
        "license": result.license,
        "resource_pk": None,
    }
    if not result.rows:
        logger.warning("AED: brak rekordów - pomijam publikację.")
        return summary

    logger.info("Step 3/3: Publishing AED resource.")
    try:
        summary["resource_pk"] = publish_aed_resource(result, paths["csv"], organization_pk)
    except AEDPublicationNotConfigured as exc:
        logger.warning("AED: publikacja pominięta - %s", exc)
    return summary
