"""
Łączenie danych o defibrylatorach AED opublikowanych w portalu w jedną bazę.

Moduł TYLKO łączy i porządkuje dane ze zbiorów dostępnych w portalu
(bez map, wizualizacji i raportów jakości).

Struktura:
- stałe konfiguracyjne (terminy wyszukiwania, regex, synonimy kolumn, progi),
- czyste funkcje (bez ORM) - parsowanie, mapowanie kolumn, współrzędne,
  licencje, duplikaty, zapis plików; testowalne bez bazy,
- funkcje dotykające bazy - wykrywanie zbiorów, wybór i odczyt zasobu,
  ``build_aed_rows``.
"""

import csv
import io
import json
import logging
import math
import os
import re
import statistics
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests
from django.apps import apps
from django.conf import settings
from django.db.models import Q, QuerySet
from django.utils.html import strip_tags

if TYPE_CHECKING:
    from mcod.datasets.models import Dataset
    from mcod.resources.models import Resource

logger = logging.getLogger("mcod")

# --------------------------------------------------------------------------- #
# Konfiguracja                                                                #
# --------------------------------------------------------------------------- #

# Prefiltr w bazie (icontains) - szeroki, dokładne dopasowanie robi regex.
AED_DB_PREFILTER_TERMS: Tuple[str, ...] = ("defibryl", "aed")

# `defibryl` w dowolnym miejscu albo samodzielne słowo `AED`.
# `\w` w Pythonie 3 jest unicodowe, więc granice słów działają z polskimi literami
# (np. "AEDą" albo "ZAEDx" nie pasują, "AED-y" i "(AED)" pasują).
AED_TEXT_PATTERN = re.compile(r"defibryl|(?<!\w)aed(?!\w)", re.IGNORECASE)

# Kolejność preferowanych formatów zasobu.
AED_RESOURCE_FORMAT_PRIORITY: Tuple[str, ...] = ("geojson", "json", "csv")

AED_REQUEST_TIMEOUT = 60  # sekundy

AED_TEXT_ENCODINGS: Tuple[str, ...] = ("utf-8-sig", "cp1250")
AED_CSV_DELIMITERS: Tuple[str, ...] = (";", ",", "\t")
AED_JSON_MAX_DEPTH = 4

# Granice Polski.
AED_LAT_RANGE: Tuple[float, float] = (49.0, 55.0)
AED_LON_RANGE: Tuple[float, float] = (14.0, 24.2)

# Wykrywanie kolumn współrzędnych po wartościach.
AED_COORD_MIN_NUMERIC_SHARE = 0.5
AED_COORD_MIN_IN_RANGE_SHARE = 0.9

# Punkty odległe od mediany zbioru (typowo: współrzędne skopiowane z innego miasta).
AED_OUTLIER_CHECK_ENABLED = True
AED_OUTLIER_DISTANCE_KM = 25.0
AED_OUTLIER_MIN_POINTS = 5
# Sprawdzanie wykonujemy tylko dla zbiorów "lokalnych": jeśli mniej niż tyle
# punktów leży w promieniu progu od mediany, zbiór obejmuje większy obszar
# (np. województwo) i nie oznaczamy niczego jako odległego.
AED_OUTLIER_MIN_LOCAL_SHARE = 0.8

AED_DUPLICATE_COORD_PRECISION = 5
EARTH_RADIUS_KM = 6371.0088

# Role kolumn i synonimy (po normalizacji nazw). Kolejność ról ma znaczenie:
# w obrębie jednego przebiegu dopasowania wygrywa pierwsza pasująca rola.
AED_COLUMN_ROLES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("szerokosc", ("szerokosc", "szer", "lat", "latitude", "geo_lat")),
    ("dlugosc", ("dlugosc", "dl", "lon", "lng", "long", "longitude", "geo_lon")),
    (
        "nazwa",
        (
            "nazwa_obiektu",
            "obiekt",
            "miejsce_instalacji",
            "miejsce_lokalizacji",
            "nazwa_lokalizacji",
            "lokalizacja",
            "nazwa",
            "name",
            "title",
            "tytul",
            "nazwa_miejsca",
            "miejsce",
        ),
    ),
    ("adres", ("adres", "address", "ulica", "street", "nazwa_ulicy")),
    (
        "numer_domu",
        ("numer_domu", "nr_domu", "numer_budynku", "nr_budynku", "house_number", "home_number", "building"),
    ),
    ("miejscowosc", ("miejscowosc", "miasto", "city", "town")),
    ("opis", ("opis_miejsca", "opis_lokalizacji", "opis", "description", "uwagi")),
    (
        "godziny",
        (
            "godziny_dostepnosci",
            "godziny_dostepu",
            "godziny_otwarcia",
            "godziny",
            "opening_hours",
            "hours",
            "access_description",
        ),
    ),
    ("dostep", ("dostep", "dostepnosc", "access", "availability")),
    ("kontakt", ("telefon", "tel", "email", "e_mail", "mail", "kontakt", "contact", "phone")),
    ("producent", ("producent", "manufacturer", "marka", "brand")),
    ("id_zrodlowe", ("id", "lp", "numer_id", "objectid", "fid")),
)
# Nazwy, których nigdy nie przypisujemy po nazwie (nie wiadomo, która to szerokość).
AED_COLUMNS_NEVER_MAPPED_BY_NAME: Tuple[str, ...] = ("x", "y")
# Role, dla których kolumny o stałej wartości w całym pliku są pomijane.
AED_ROLES_SKIP_CONSTANT: Tuple[str, ...] = ("nazwa", "opis")
# Role, dla których wartości z wielu kolumn łączymy (pozostałe: pierwsza kolumna).
AED_ROLES_JOIN_MULTIPLE: Tuple[str, ...] = ("opis", "godziny", "dostep", "kontakt")
AED_JOIN_SEPARATOR = "; "

# Licencje.
AED_LICENSE_CC0 = "CC0 1.0"
AED_LICENSE_CC_BY = "CC BY 4.0"

# Kody powodów i korekt.
REJECT_NO_COORDINATES = "brak_wspolrzednych"
REJECT_OUTSIDE_POLAND = "wspolrzedne_poza_polska"
REJECT_DISTANT = "wspolrzedne_odlegle"
CORRECTION_SWAPPED = "wspolrzedne_zamienione"
CORRECTION_DUPLICATED_ID = "id_zduplikowany"

AED_OUTPUT_COLUMNS: Tuple[str, ...] = (
    "id",
    "zrodlo_zbior_id",
    "zrodlo_zbior_tytul",
    "zrodlo_url",
    "dysponent",
    "licencja",
    "id_zrodlowe",
    "nazwa",
    "adres",
    "miejscowosc",
    "opis",
    "godziny",
    "dostep",
    "kontakt",
    "producent",
    "szerokosc",
    "dlugosc",
    "korekty",
    "dane_zrodlowe",
)

AED_OUTPUT_FILES = {
    "csv": "aed_polska.csv",
    "json": "aed_polska.json",
    "rejected": "odrzucone.json",
    "skipped": "pominiete.json",
    "duplicates": "duplikaty.json",
}

# Rekord po parsowaniu: (właściwości, punkt z geometrii jako (lon, lat) albo None).
ParsedRecord = Tuple[Dict[str, Any], Optional[Tuple[Any, Any]]]


class AEDSourceReadError(Exception):
    """Zasobu nie da się odczytać lub sparsować - zbiór trafia do pominiętych."""


@dataclass
class AEDSourceMeta:
    dataset_id: int
    dataset_title: str
    url: str
    publisher: str
    license: str


@dataclass
class AEDAggregationResult:
    rows: List[Dict[str, Any]] = field(default_factory=list)
    rejected: List[Dict[str, Any]] = field(default_factory=list)
    duplicates: List[Dict[str, Any]] = field(default_factory=list)
    sources: List[Dict[str, Any]] = field(default_factory=list)
    skipped: List[Dict[str, Any]] = field(default_factory=list)
    license: Optional[str] = None


# --------------------------------------------------------------------------- #
# Czyste funkcje: tekst                                                       #
# --------------------------------------------------------------------------- #


def strip_diacritics(value: str) -> str:
    value = value.replace("ł", "l").replace("Ł", "L")
    return "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))


def normalize_column_name(name: Any) -> str:
    """Małe litery, bez ogonków (także ł), znaki niealfanumeryczne -> `_`."""
    value = strip_diacritics(str(name or "")).lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def normalize_text_for_comparison(value: Any) -> str:
    value = strip_diacritics(str(value or "")).lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value).split())


def matches_aed_text(*texts: Optional[str]) -> bool:
    return any(AED_TEXT_PATTERN.search(t) for t in texts if t)


def clean_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return " ".join(str(value).split())


# --------------------------------------------------------------------------- #
# Czyste funkcje: parsowanie                                                  #
# --------------------------------------------------------------------------- #


def decode_bytes(raw: bytes) -> str:
    for encoding in AED_TEXT_ENCODINGS[:-1]:
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode(AED_TEXT_ENCODINGS[-1], errors="replace")


def looks_like_html(raw: bytes, content_type: str = "") -> bool:
    if "html" in (content_type or "").lower():
        return True
    head = raw[:512].lstrip().lower()
    return head.startswith(b"<!doctype html") or head.startswith(b"<html")


def detect_delimiter(line: str) -> str:
    counts = {d: line.count(d) for d in AED_CSV_DELIMITERS}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def _unwrap_fully_quoted_lines(lines: List[str], delimiter: str) -> List[str]:
    """Eksport z arkusza: cała linia opakowana w "..." (z podwojonymi cudzysłowami wewnątrz)."""
    fixed = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('"') and stripped.endswith('"'):
            fields = next(csv.reader([stripped], delimiter=delimiter))
            if len(fields) == 1 and delimiter in fields[0]:
                line = fields[0]
        fixed.append(line)
    return fixed


def _unique_headers(headers: Sequence[str]) -> List[str]:
    seen: Counter = Counter()
    result = []
    for i, h in enumerate(headers):
        h = (h or "").strip() or f"kolumna_{i + 1}"
        seen[h] += 1
        result.append(h if seen[h] == 1 else f"{h}_{seen[h]}")
    return result


def parse_csv(text: str) -> List[ParsedRecord]:
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    delimiter = detect_delimiter(lines[0])
    header_fields = next(csv.reader([lines[0].strip()], delimiter=delimiter))
    if len(header_fields) == 1 and lines[0].strip().startswith('"'):
        # Cały nagłówek w cudzysłowie -> plik z liniami opakowanymi w całości.
        unwrapped_header = header_fields[0]
        delimiter = detect_delimiter(unwrapped_header)
        lines = _unwrap_fully_quoted_lines(lines, delimiter)
        source = io.StringIO("\n".join(lines))
    else:
        source = io.StringIO(text.lstrip("﻿"))
    rows = list(csv.reader(source, delimiter=delimiter))
    rows = [r for r in rows if any(cell.strip() for cell in r)]
    if not rows:
        return []
    headers = _unique_headers(rows[0])
    records: List[ParsedRecord] = []
    for row in rows[1:]:
        row = list(row) + [""] * (len(headers) - len(row))
        records.append(({h: v.strip() for h, v in zip(headers, row)}, None))
    return records


def find_first_object_list(obj: Any, depth: int = 0) -> Optional[List[Dict[str, Any]]]:
    """Pierwsza tablica obiektów (do głębokości AED_JSON_MAX_DEPTH)."""
    if depth > AED_JSON_MAX_DEPTH:
        return None
    if isinstance(obj, list):
        if obj and all(isinstance(i, dict) for i in obj):
            return obj
        for item in obj:
            found = find_first_object_list(item, depth + 1)
            if found is not None:
                return found
    elif isinstance(obj, dict):
        for value in obj.values():
            found = find_first_object_list(value, depth + 1)
            if found is not None:
                return found
    return None


def extract_point(geometry: Any) -> Optional[Tuple[Any, Any]]:
    """
    Zwraca punkt (lon, lat) z geometrii GeoJSON (kolejność [lon, lat], trzeci
    element ignorowany, zagnieżdżenie typu [[lon, lat]] spłaszczane) albo
    z obiektu {"lat": .., "long"/"lon"/"lng": ..}. None, gdy brak geometrii.
    """
    if geometry is None:
        return None
    if isinstance(geometry, str):
        text = geometry.strip()
        if not text.startswith(("{", "[")):
            return None
        try:
            return extract_point(json.loads(text))
        except ValueError:
            return None
    if isinstance(geometry, dict):
        coords = geometry.get("coordinates", geometry if "lat" in geometry else None)
        if isinstance(coords, dict):
            lat = coords.get("lat", coords.get("latitude"))
            lon = next((coords[k] for k in ("lon", "long", "lng", "longitude") if k in coords), None)
            return (lon, lat) if lat is not None or lon is not None else None
        return extract_point(coords) if isinstance(coords, list) else None
    if isinstance(geometry, list):
        coords = geometry
        while coords and isinstance(coords[0], list):
            coords = coords[0]
        if len(coords) >= 2:
            return coords[0], coords[1]
    return None


def _flatten(props: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    flat: Dict[str, Any] = {}
    for key, value in props.items():
        name = f"{prefix}_{key}" if prefix else str(key)
        if isinstance(value, dict):
            flat.update(_flatten(value, name))
        else:
            flat[name] = value
    return flat


def _objects_to_records(items: Iterable[Dict[str, Any]]) -> List[ParsedRecord]:
    records: List[ParsedRecord] = []
    for item in items:
        if isinstance(item.get("properties"), dict):
            props = item["properties"]
        else:
            props = {k: v for k, v in item.items() if k not in ("geometry", "type")}
        geom = extract_point(item.get("geometry")) if "geometry" in item else None
        records.append((_flatten(props), geom))
    return records


def parse_json_data(data: Any) -> List[ParsedRecord]:
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        return _objects_to_records(f for f in data.get("features") or [] if isinstance(f, dict))
    if isinstance(data, dict) and data.get("type") == "Feature":
        return _objects_to_records([data])
    items = find_first_object_list(data)
    return _objects_to_records(items) if items else []


def parse_content(raw: bytes, fmt: Optional[str] = None) -> List[ParsedRecord]:
    text = decode_bytes(raw).lstrip("﻿")
    fmt = (fmt or "").lower()
    stripped = text.lstrip()
    if fmt in ("geojson", "json") or (fmt not in ("csv",) and stripped.startswith(("{", "["))):
        try:
            return parse_json_data(json.loads(stripped))
        except ValueError as exc:
            raise AEDSourceReadError(f"niepoprawny JSON: {exc}") from exc
    return parse_csv(text)


# --------------------------------------------------------------------------- #
# Czyste funkcje: mapowanie kolumn                                            #
# --------------------------------------------------------------------------- #


def _contains_sequence(tokens: List[str], seq: List[str]) -> bool:
    n = len(seq)
    return any(tokens[i : i + n] == seq for i in range(len(tokens) - n + 1))


def match_column_role(column: str) -> Optional[str]:
    """
    Rola kolumny po nazwie. Trzy przebiegi (od najbardziej szczegółowego):
    dokładna nazwa, wielowyrazowy synonim jako ciąg tokenów, pojedynczy token.
    W każdym przebiegu wygrywa pierwsza pasująca rola.
    """
    norm = normalize_column_name(column)
    if not norm or norm in AED_COLUMNS_NEVER_MAPPED_BY_NAME:
        return None
    tokens = norm.split("_")
    for role, synonyms in AED_COLUMN_ROLES:
        if norm in synonyms:
            return role
    for role, synonyms in AED_COLUMN_ROLES:
        if any("_" in s and _contains_sequence(tokens, s.split("_")) for s in synonyms):
            return role
    for role, synonyms in AED_COLUMN_ROLES:
        if any("_" not in s and s in tokens for s in synonyms):
            return role
    return None


def _ordered_columns(records: Sequence[ParsedRecord]) -> List[str]:
    columns: Dict[str, None] = {}
    for props, _ in records:
        for key in props:
            columns.setdefault(key, None)
    return list(columns)


def _is_constant_column(records: Sequence[ParsedRecord], column: str) -> bool:
    values = {clean_value(p.get(column)) for p, _ in records} - {""}
    return len(records) > 1 and len(values) <= 1


def parse_coordinate(value: Any) -> Optional[float]:
    """Ścisłe parsowanie (przecinek -> kropka, bez spacji). `50.4O64`, `n/a`, tekst -> None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip().replace(" ", "").replace(" ", "").replace(",", ".")
        if not re.fullmatch(r"[+-]?(\d+(\.\d*)?|\.\d+)", text):
            return None
        number = float(text)
    return number if math.isfinite(number) else None


def _in_range(value: Optional[float], bounds: Tuple[float, float]) -> bool:
    return value is not None and bounds[0] <= value <= bounds[1]


def detect_coordinate_columns_by_values(
    records: Sequence[ParsedRecord], columns: Sequence[str]
) -> Tuple[Optional[str], Optional[str]]:
    """Wybiera (kolumna_szerokosci, kolumna_dlugosci) na podstawie wartości."""
    lat_candidates, lon_candidates = [], []
    for column in columns:
        raw = [p.get(column) for p, _ in records if clean_value(p.get(column))]
        if not raw:
            continue
        numbers = [n for n in (parse_coordinate(v) for v in raw) if n is not None]
        if len(numbers) / len(raw) < AED_COORD_MIN_NUMERIC_SHARE or not numbers:
            continue
        lat_share = sum(_in_range(n, AED_LAT_RANGE) for n in numbers) / len(numbers)
        lon_share = sum(_in_range(n, AED_LON_RANGE) for n in numbers) / len(numbers)
        if lat_share >= AED_COORD_MIN_IN_RANGE_SHARE:
            lat_candidates.append((lat_share, column))
        if lon_share >= AED_COORD_MIN_IN_RANGE_SHARE:
            lon_candidates.append((lon_share, column))
    lat_candidates.sort(key=lambda c: -c[0])
    lon_candidates.sort(key=lambda c: -c[0])
    for _, lat_col in lat_candidates:
        for _, lon_col in lon_candidates:
            if lat_col != lon_col:
                return lat_col, lon_col
    return None, None


def map_columns(records: Sequence[ParsedRecord]) -> Dict[str, List[str]]:
    """Mapa rola -> lista kolumn (w kolejności występowania w pliku)."""
    columns = _ordered_columns(records)
    roles: Dict[str, List[str]] = {}
    for column in columns:
        role = match_column_role(column)
        if role is None:
            continue
        if role in AED_ROLES_SKIP_CONSTANT and _is_constant_column(records, column):
            continue
        roles.setdefault(role, []).append(column)
    if not roles.get("szerokosc") or not roles.get("dlugosc"):
        has_geometry = any(geom is not None for _, geom in records)
        if not has_geometry:
            mapped = {c for cols in roles.values() for c in cols}
            candidates = [c for c in columns if c not in mapped or c in roles.get("szerokosc", []) + roles.get("dlugosc", [])]
            lat_col, lon_col = detect_coordinate_columns_by_values(records, candidates)
            if lat_col and lon_col:
                roles["szerokosc"], roles["dlugosc"] = [lat_col], [lon_col]
    return roles


def detect_geometry_column(records: Sequence[ParsedRecord], columns: Sequence[str]) -> Optional[str]:
    """Kolumna z geometrią zapisaną jako JSON w komórce (np. eksport CSV z CMS)."""
    for column in columns:
        sample = [p.get(column) for p, _ in records[:20] if clean_value(p.get(column))]
        if sample and all(extract_point(v) is not None for v in sample):
            return column
    return None


# --------------------------------------------------------------------------- #
# Czyste funkcje: współrzędne                                                 #
# --------------------------------------------------------------------------- #


def normalize_coordinates(lat_raw: Any, lon_raw: Any) -> Tuple[Optional[float], Optional[float], List[str], Optional[str]]:
    """Zwraca (lat, lon, korekty, kod_odrzucenia)."""
    lat, lon = parse_coordinate(lat_raw), parse_coordinate(lon_raw)
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return None, None, [], REJECT_NO_COORDINATES
    if _in_range(lat, AED_LAT_RANGE) and _in_range(lon, AED_LON_RANGE):
        return lat, lon, [], None
    if _in_range(lon, AED_LAT_RANGE) and _in_range(lat, AED_LON_RANGE):
        return lon, lat, [CORRECTION_SWAPPED], None
    return None, None, [], REJECT_OUTSIDE_POLAND


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def split_distant_points(
    rows: List[Dict[str, Any]],
    threshold_km: float = AED_OUTLIER_DISTANCE_KM,
    min_points: int = AED_OUTLIER_MIN_POINTS,
    min_local_share: float = AED_OUTLIER_MIN_LOCAL_SHARE,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Dzieli wiersze jednego zbioru na (zachowane, odległe od mediany)."""
    if not AED_OUTLIER_CHECK_ENABLED or len(rows) < min_points:
        return rows, []
    med_lat = statistics.median(r["szerokosc"] for r in rows)
    med_lon = statistics.median(r["dlugosc"] for r in rows)
    distances = [haversine_km(r["szerokosc"], r["dlugosc"], med_lat, med_lon) for r in rows]
    if sum(d <= threshold_km for d in distances) / len(rows) < min_local_share:
        return rows, []
    kept = [r for r, d in zip(rows, distances) if d <= threshold_km]
    distant = [r for r, d in zip(rows, distances) if d > threshold_km]
    return kept, distant


# --------------------------------------------------------------------------- #
# Czyste funkcje: licencje                                                    #
# --------------------------------------------------------------------------- #


def classify_license(license_name: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Zwraca (rodzaj, powód_wykluczenia). Rodzaj: "cc0", "cc-by" albo None.
    Dopuszczamy CC0 i CC BY w dowolnej wersji; SA, NC, ND i nieznane wykluczamy.
    """
    name = (license_name or "").strip().upper()
    if not name:
        return None, "nieznana licencja zbioru wyklucza użycie w zbiorze łączonym"
    if re.match(r"^CC0(\s|$)", name):
        return "cc0", None
    match = re.match(r"^CC[\s-]?BY((?:-(?:SA|NC|ND))*)(\s|$)", name)
    if match:
        if not match.group(1):
            return "cc-by", None
        return None, f"licencja CC BY{match.group(1)} wyklucza użycie w zbiorze łączonym"
    return None, f"licencja {license_name} wyklucza użycie w zbiorze łączonym"


def combined_license(kinds: Iterable[str]) -> Optional[str]:
    kinds = list(kinds)
    if not kinds:
        return None
    return AED_LICENSE_CC_BY if "cc-by" in kinds else AED_LICENSE_CC0


# --------------------------------------------------------------------------- #
# Czyste funkcje: rekordy, scalanie                                           #
# --------------------------------------------------------------------------- #


def _role_value(props: Dict[str, Any], roles: Dict[str, List[str]], role: str) -> str:
    columns = roles.get(role) or []
    values = [clean_value(props.get(c)) for c in columns]
    values = [v for v in values if v]
    if not values:
        return ""
    if role in AED_ROLES_JOIN_MULTIPLE:
        return AED_JOIN_SEPARATOR.join(dict.fromkeys(values))
    return values[0]


def _address(props: Dict[str, Any], roles: Dict[str, List[str]]) -> str:
    street = _role_value(props, roles, "adres")
    number = _role_value(props, roles, "numer_domu")
    if number and number not in street:
        return f"{street} {number}".strip()
    return street


def records_to_rows(
    records: Sequence[ParsedRecord], source: AEDSourceMeta
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Mapuje rekordy jednego źródła na wspólny schemat. Zwraca (wiersze, odrzucone)."""
    roles = map_columns(records)
    geometry_column = None
    if not roles.get("szerokosc") and not any(geom for _, geom in records):
        geometry_column = detect_geometry_column(records, _ordered_columns(records))

    id_counts = Counter(_role_value(p, roles, "id_zrodlowe") for p, _ in records)
    rows, rejected = [], []
    for row_number, (props, geom) in enumerate(records, start=1):
        source_id = _role_value(props, roles, "id_zrodlowe")
        original = dict(props)
        if geom is not None:
            original["_geometria"] = list(geom)
            lon_raw, lat_raw = geom
        elif geometry_column:
            point = extract_point(props.get(geometry_column)) or (None, None)
            lon_raw, lat_raw = point
        else:
            lat_raw = props.get((roles.get("szerokosc") or [None])[0])
            lon_raw = props.get((roles.get("dlugosc") or [None])[0])

        lat, lon, corrections, reason = normalize_coordinates(lat_raw, lon_raw)
        source_data = json.dumps(original, ensure_ascii=False, default=str)
        if reason:
            rejected.append(_rejected_entry(source, row_number, source_id, reason, source_data))
            continue

        stable_id = f"{source.dataset_id}:{source_id or row_number}"
        if source_id and id_counts[source_id] > 1:
            corrections.append(CORRECTION_DUPLICATED_ID)
            stable_id = f"{stable_id}#{row_number}"

        rows.append(
            {
                "id": stable_id,
                "zrodlo_zbior_id": source.dataset_id,
                "zrodlo_zbior_tytul": source.dataset_title,
                "zrodlo_url": source.url,
                "dysponent": source.publisher,
                "licencja": source.license,
                "id_zrodlowe": source_id,
                "nazwa": _role_value(props, roles, "nazwa"),
                "adres": _address(props, roles),
                "miejscowosc": _role_value(props, roles, "miejscowosc"),
                "opis": _role_value(props, roles, "opis"),
                "godziny": _role_value(props, roles, "godziny"),
                "dostep": _role_value(props, roles, "dostep"),
                "kontakt": _role_value(props, roles, "kontakt"),
                "producent": _role_value(props, roles, "producent"),
                "szerokosc": lat,
                "dlugosc": lon,
                "korekty": corrections,
                "dane_zrodlowe": source_data,
                "_wiersz": row_number,
            }
        )

    kept, distant = split_distant_points(rows)
    for row in distant:
        rejected.append(
            _rejected_entry(source, row["_wiersz"], row["id_zrodlowe"], REJECT_DISTANT, row["dane_zrodlowe"])
        )
    return kept, rejected


def _rejected_entry(source: AEDSourceMeta, row_number: int, source_id: str, reason: str, source_data: str) -> Dict[str, Any]:
    return {
        "zrodlo_zbior_id": source.dataset_id,
        "zrodlo_zbior_tytul": source.dataset_title,
        "wiersz": row_number,
        "id_zrodlowe": source_id,
        "powod": reason,
        "dane_zrodlowe": source_data,
    }


def deduplicate_rows(rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Usuwa ten sam punkt występujący w RÓŻNYCH zbiorach: współrzędne zaokrąglone
    do AED_DUPLICATE_COORD_PRECISION miejsc identyczne ORAZ równa znormalizowana
    nazwa lub adres. Zostaje wpis z pierwszego zbioru (kolejność wierszy).
    Duplikaty w obrębie jednego zbioru są zachowywane.
    """
    kept: List[Dict[str, Any]] = []
    duplicates: List[Dict[str, Any]] = []
    index: Dict[Tuple[float, float], List[Dict[str, Any]]] = {}
    for row in rows:
        key = (round(row["szerokosc"], AED_DUPLICATE_COORD_PRECISION), round(row["dlugosc"], AED_DUPLICATE_COORD_PRECISION))
        name = normalize_text_for_comparison(row.get("nazwa"))
        address = normalize_text_for_comparison(row.get("adres"))
        original = None
        for candidate in index.get(key, []):
            if candidate["zrodlo_zbior_id"] == row["zrodlo_zbior_id"]:
                continue
            same_name = name and name == normalize_text_for_comparison(candidate.get("nazwa"))
            same_address = address and address == normalize_text_for_comparison(candidate.get("adres"))
            if same_name or same_address:
                original = candidate
                break
        if original:
            duplicates.append(
                {
                    "id": row["id"],
                    "zrodlo_zbior_id": row["zrodlo_zbior_id"],
                    "zrodlo_zbior_tytul": row["zrodlo_zbior_tytul"],
                    "duplikat_rekordu": original["id"],
                    "nazwa": row.get("nazwa"),
                    "adres": row.get("adres"),
                    "szerokosc": row["szerokosc"],
                    "dlugosc": row["dlugosc"],
                }
            )
            continue
        index.setdefault(key, []).append(row)
        kept.append(row)
    return kept, duplicates


# --------------------------------------------------------------------------- #
# Czyste funkcje: zapis                                                       #
# --------------------------------------------------------------------------- #


def _public_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: row.get(k) for k in AED_OUTPUT_COLUMNS}


def write_aed_outputs(result: AEDAggregationResult, out_dir: Path) -> Dict[str, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {key: out_dir / name for key, name in AED_OUTPUT_FILES.items()}

    with open(paths["csv"], "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(AED_OUTPUT_COLUMNS))
        writer.writeheader()
        for row in result.rows:
            out = _public_row(row)
            out["szerokosc"] = repr(float(row["szerokosc"]))
            out["dlugosc"] = repr(float(row["dlugosc"]))
            out["korekty"] = ";".join(row.get("korekty") or [])
            writer.writerow(out)

    json_rows = []
    for row in result.rows:
        out = _public_row(row)
        out["dane_zrodlowe"] = json.loads(row["dane_zrodlowe"])
        json_rows.append(out)
    _dump_json(
        paths["json"],
        {
            "licencja": result.license,
            "wygenerowano": datetime.now().isoformat(timespec="seconds"),
            "liczba_rekordow": len(result.rows),
            "zrodla": result.sources,
            "rekordy": json_rows,
        },
    )
    _dump_json(paths["rejected"], result.rejected)
    _dump_json(paths["skipped"], result.skipped)
    _dump_json(paths["duplicates"], result.duplicates)
    return paths


def _dump_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


# --------------------------------------------------------------------------- #
# Funkcje dotykające bazy                                                     #
# --------------------------------------------------------------------------- #


def dataset_matches_aed(dataset: "Dataset") -> bool:
    tags = " ".join(dataset.tags.values_list("name", flat=True))
    return matches_aed_text(dataset.title, strip_tags(dataset.notes or ""), tags)


def find_aed_datasets() -> List["Dataset"]:
    """Opublikowane, nieusunięte zbiory pasujące do wzorca AED (posortowane po tytule)."""
    Dataset = apps.get_model("datasets", "Dataset")
    prefilter = Q()
    for term in AED_DB_PREFILTER_TERMS:
        prefilter |= Q(title__icontains=term) | Q(notes__icontains=term) | Q(tags__name__icontains=term)
    qs: QuerySet = (
        Dataset.objects.filter(status="published", is_removed=False)
        .filter(prefilter)
        .distinct()
        .select_related("organization")
        .order_by("title", "pk")
    )
    own_pks = get_aed_output_dataset_pks()
    if own_pks:
        qs = qs.exclude(pk__in=own_pks)
    return [d for d in qs if dataset_matches_aed(d)]


def get_aed_output_dataset_pks() -> List[int]:
    """
    Zbiory z opublikowanym wynikiem łączenia - nie mogą być własnym źródłem.
    Rozpoznawane po znaczniku zasobu (ext_ident), niezależnie od tego, jak
    wskazano instytucję-właściciela (settings albo parametr).
    """
    marker = getattr(settings, "AED_RESOURCE_EXT_IDENT", None)
    if not marker:
        return []
    Resource = apps.get_model("resources", "Resource")
    return list(Resource.raw.filter(ext_ident=marker).values_list("dataset_id", flat=True).distinct())


def _resource_format(resource: "Resource") -> str:
    return (resource.format or "").lower()


def _has_main_file(resource: "Resource") -> bool:
    try:
        return bool(resource.main_file)
    except Exception:
        return False


def select_aed_resource(dataset: "Dataset") -> Optional["Resource"]:
    """Najpierw zasób, którego tytuł pasuje do wzorca, potem format geojson > json > csv."""
    Resource = apps.get_model("resources", "Resource")
    candidates = [
        r
        for r in Resource.objects.filter(dataset=dataset, status="published", is_removed=False).order_by("position", "pk")
        if _resource_format(r) in AED_RESOURCE_FORMAT_PRIORITY or (r.link and not _has_main_file(r))
    ]
    if not candidates:
        return None

    def sort_key(resource):
        fmt = _resource_format(resource)
        fmt_rank = AED_RESOURCE_FORMAT_PRIORITY.index(fmt) if fmt in AED_RESOURCE_FORMAT_PRIORITY else len(AED_RESOURCE_FORMAT_PRIORITY)
        return (0 if matches_aed_text(resource.title) else 1, fmt_rank)

    return sorted(candidates, key=sort_key)[0]


def fetch_authenticated_source(resource: "Resource") -> Optional[bytes]:
    """
    HAK dla zbiorów dostępnych wyłącznie przez API z kluczem (np. link do strony
    katalogu zamiast pliku). Domyślnie zwraca None -> zbiór jest pomijany.

    Konfiguracja w settings.AED_AUTHENTICATED_SOURCES (lista słowników, z env):
        [{"link_prefix": "https://...", "api_url": "https://...", "method": "POST",
          "auth_header": "Authorization", "token_env": "NAZWA_ZMIENNEJ_Z_KLUCZEM"}]
    Klucz czytany jest wyłącznie ze zmiennej środowiskowej i nigdy nie jest logowany.
    """
    link = resource.link or ""
    for source in getattr(settings, "AED_AUTHENTICATED_SOURCES", None) or []:
        prefix = source.get("link_prefix")
        if not prefix or not link.startswith(prefix):
            continue
        token_env = source.get("token_env") or ""
        token = os.environ.get(token_env)
        if not token:
            logger.info("AED: zasób %s wymaga klucza API (zmienna %s nie jest ustawiona).", resource.pk, token_env)
            return None
        response = requests.request(
            source.get("method", "GET"),
            source["api_url"],
            headers={source.get("auth_header", "Authorization"): token},
            timeout=AED_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.content
    return None


def read_resource_content(resource: "Resource") -> Tuple[bytes, Optional[str]]:
    """Zwraca (bajty, format). Plik z dysku portalu, w razie braku - pobranie spod linku."""
    path = None
    try:
        if resource.main_file:
            path = resource.file_data_path
    except Exception:  # brak pliku / błąd archiwum
        path = None
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            return f.read(), _resource_format(resource)

    if not resource.link:
        raise AEDSourceReadError("zasób nie ma pliku ani linku")

    authenticated = fetch_authenticated_source(resource)
    if authenticated is not None:
        return authenticated, None

    try:
        response = requests.get(resource.link, timeout=AED_REQUEST_TIMEOUT)
    except requests.RequestException as exc:
        raise AEDSourceReadError(f"nie można pobrać danych spod linku: {exc.__class__.__name__}") from exc
    if response.status_code in (401, 403):
        raise AEDSourceReadError("wymaga klucza API (brak dostępu do danych spod linku)")
    if response.status_code != 200:
        raise AEDSourceReadError(f"link zwrócił status HTTP {response.status_code}")
    if looks_like_html(response.content, response.headers.get("Content-Type", "")):
        raise AEDSourceReadError("wymaga klucza API lub ręcznego pobrania: link prowadzi do strony HTML, a nie do danych")
    return response.content, _resource_format(resource)


def _source_meta(dataset: "Dataset") -> AEDSourceMeta:
    return AEDSourceMeta(
        dataset_id=dataset.pk,
        dataset_title=dataset.title,
        url=dataset.frontend_absolute_url,
        publisher=dataset.organization.title if dataset.organization_id else "",
        license=dataset.license_name or "",
    )


def build_aed_rows() -> AEDAggregationResult:
    """
    Łączy wszystkie zbiory AED w jedną bazę.
    Błąd jednego zbioru nie przerywa przetwarzania pozostałych.
    """
    result = AEDAggregationResult()
    all_rows: List[Dict[str, Any]] = []
    included_license_kinds: List[str] = []

    for dataset in find_aed_datasets():
        base = {"zbior_id": dataset.pk, "zbior_tytul": dataset.title}
        try:
            meta = _source_meta(dataset)
            kind, reason = classify_license(meta.license)
            if kind is None:
                result.skipped.append({**base, "licencja": meta.license, "powod": reason})
                continue

            resource = select_aed_resource(dataset)
            if resource is None:
                result.skipped.append({**base, "powod": "brak odczytywalnego zasobu (geojson, json, csv)"})
                continue

            raw, fmt = read_resource_content(resource)
            records = parse_content(raw, fmt)
            if not records:
                raise AEDSourceReadError("zasób nie zawiera rekordów")
            rows, rejected = records_to_rows(records, meta)
        except AEDSourceReadError as exc:
            result.skipped.append({**base, "powod": str(exc)})
            continue
        except Exception as exc:  # nie przerywamy całości z powodu jednego zbioru
            logger.exception("AED: błąd przetwarzania zbioru %s", dataset.pk)
            result.skipped.append({**base, "powod": f"nieoczekiwany błąd: {exc.__class__.__name__}: {exc}"})
            continue

        included_license_kinds.append(kind)
        all_rows.extend(rows)
        result.rejected.extend(rejected)
        result.sources.append(
            {
                **base,
                "dysponent": meta.publisher,
                "licencja": meta.license,
                "zrodlo_url": meta.url,
                "zasob_id": resource.pk,
                "zasob_tytul": resource.title,
                "format": fmt or _resource_format(resource),
                "odczytane": len(records),
                "wlaczone": len(rows),
                "odrzucone": len(rejected),
            }
        )

    result.rows, result.duplicates = deduplicate_rows(all_rows)
    duplicates_per_dataset = Counter(d["zrodlo_zbior_id"] for d in result.duplicates)
    for source in result.sources:
        source["duplikaty"] = duplicates_per_dataset.get(source["zbior_id"], 0)
        source["wlaczone"] -= source["duplikaty"]
    result.license = combined_license(included_license_kinds)
    return result
