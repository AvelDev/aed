import json
from pathlib import Path

import pytest

from mcod.datasets.factories import DatasetFactory
from mcod.resources.aed_aggregation import (
    CORRECTION_DUPLICATED_ID,
    CORRECTION_SWAPPED,
    REJECT_DISTANT,
    REJECT_NO_COORDINATES,
    REJECT_OUTSIDE_POLAND,
    AEDAggregationResult,
    AEDSourceMeta,
    build_aed_rows,
    classify_license,
    combined_license,
    deduplicate_rows,
    detect_coordinate_columns_by_values,
    find_aed_datasets,
    map_columns,
    match_column_role,
    matches_aed_text,
    normalize_column_name,
    normalize_coordinates,
    parse_content,
    parse_coordinate,
    parse_csv,
    records_to_rows,
    split_distant_points,
    write_aed_outputs,
)
from mcod.resources.factories import ResourceFactory
from mcod.tags.factories import TagFactory


def _meta(dataset_id=1, title="Zbiór", license_="CC0 1.0"):
    return AEDSourceMeta(dataset_id=dataset_id, dataset_title=title, url="https://x/1", publisher="Urząd", license=license_)


# --------------------------------------------------------------------------- #
# Tekst i nazwy kolumn                                                        #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Długość geograficzna", "dlugosc_geograficzna"),
        (" Szerokość  Geograficzna ", "szerokosc_geograficzna"),
        ("Miejscowość/Miasto", "miejscowosc_miasto"),
        ("ŁÓDŹ-Nr.domu", "lodz_nr_domu"),
        ("Numer Id", "numer_id"),
    ],
)
def test_normalize_column_name(name, expected):
    assert normalize_column_name(name) == expected


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Defibrylatory w mieście", True),
        ("Lokalizacja defibrylatorów (AED)", True),
        ("aed-y w gminie", True),
        ("AED", True),
        ("Ceny dewelopera AEDach", False),
        ("ZAED", False),
        ("AEDą", False),
        ("Rachunki ekonomiczne", False),
    ],
)
def test_matches_aed_text(text, expected):
    assert matches_aed_text(text) is expected


@pytest.mark.parametrize(
    "column, role",
    [
        ("Szerokość geograficzna", "szerokosc"),
        ("Długość geograficzna", "dlugosc"),
        ("lat", "szerokosc"),
        ("lng", "dlugosc"),
        ("nazwa_ulicy", "adres"),
        ("Nazwa obiektu", "nazwa"),
        ("location_object_name", "nazwa"),
        ("location_street", "adres"),
        ("location_building", "numer_domu"),
        ("home_number", "numer_domu"),
        ("location_city", "miejscowosc"),
        ("device_access_description", "godziny"),
        ("location_description", "opis"),
        ("device_public_access", "dostep"),
        ("device_manufacturer", "producent"),
        ("phone", "kontakt"),
        ("Numer Id", "id_zrodlowe"),
        ("defibrillator_id", "id_zrodlowe"),
        ("x", None),
        ("Y", None),
        ("gallery", None),
    ],
)
def test_match_column_role(column, role):
    assert match_column_role(column) == role


def test_constant_column_not_used_as_name():
    records = parse_csv("Nazwa,Lokalizacja,lat,lon\nDefibrylator,Szkoła 1,50.1,20.1\nDefibrylator,Urząd,50.2,20.2\n")
    roles = map_columns(records)
    assert roles["nazwa"] == ["Lokalizacja"]


def test_xy_detected_by_values_not_by_name():
    records = parse_csv("x;y;opis\n21,01;52,23;a\n21,02;52,24;b\n20,99;52,20;c\n")
    roles = map_columns(records)
    assert roles["szerokosc"] == ["y"]
    assert roles["dlugosc"] == ["x"]


def test_detect_coordinate_columns_ignores_out_of_range():
    records = parse_csv("a,b,c\n100,52.1,21.0\n200,52.2,21.1\n")
    assert detect_coordinate_columns_by_values(records, ["a", "b", "c"]) == ("b", "c")


# --------------------------------------------------------------------------- #
# Parsowanie                                                                  #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("delimiter", [";", ",", "\t"])
def test_parse_csv_delimiters(delimiter):
    text = delimiter.join(["id", "nazwa", "lat"]) + "\n" + delimiter.join(["1", "Szkoła", "50.1"]) + "\n"
    records = parse_csv(text)
    assert records == [({"id": "1", "nazwa": "Szkoła", "lat": "50.1"}, None)]


def test_parse_content_cp1250():
    raw = "nazwa;miejscowość\nUrząd;Łódź\n".encode("cp1250")
    records = parse_content(raw, "csv")
    assert records[0][0] == {"nazwa": "Urząd", "miejscowość": "Łódź"}


def test_parse_csv_fully_quoted_lines():
    text = (
        '"Długość geograficzna,Szerokość geograficzna, Nazwa, Adres"\n'
        '"52.326697, 21.107557,""Defibrylator"",""Al. Piłsudskiego 95, 05-270 Marki"""\n'
    )
    props, _ = parse_csv(text)[0]
    assert props["Długość geograficzna"] == "52.326697"
    assert props["Szerokość geograficzna"] == "21.107557"
    assert props["Adres"] == "Al. Piłsudskiego 95, 05-270 Marki"


def test_parse_json_list_under_custom_key():
    raw = json.dumps({"meta": {"n": 1}, "dane": {"defibrylatory": [{"nazwa": "A", "lat": 50.1, "lon": 20.1}]}}).encode()
    records = parse_content(raw, "json")
    assert records == [({"nazwa": "A", "lat": 50.1, "lon": 20.1}, None)]


def test_parse_geojson_lon_lat_null_geometry_and_altitude():
    raw = json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [21.0, 52.2, 110.0]}, "properties": {"n": 1}},
                {"type": "Feature", "geometry": None, "properties": {"n": 2}},
            ],
        }
    ).encode()
    records = parse_content(raw, "geojson")
    assert records[0] == ({"n": 1}, (21.0, 52.2))
    assert records[1] == ({"n": 2}, None)
    rows, rejected = records_to_rows(records, _meta())
    assert (rows[0]["szerokosc"], rows[0]["dlugosc"]) == (52.2, 21.0)
    assert rejected[0]["powod"] == REJECT_NO_COORDINATES


def test_parse_feature_list_with_nested_point():
    raw = json.dumps([{"geometry": {"coordinates": [[21.01, 52.21]], "type": "Point"}, "properties": {"id": "7"}}]).encode()
    assert parse_content(raw, None) == [({"id": "7"}, (21.01, 52.21))]


# --------------------------------------------------------------------------- #
# Współrzędne                                                                 #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "value, expected",
    [("52,2297", 52.2297), (" 21.0122 ", 21.0122), (50, 50.0), ("50.4O64", None), ("n/a", None), ("abc", None), ("", None)],
)
def test_parse_coordinate(value, expected):
    assert parse_coordinate(value) == expected


@pytest.mark.parametrize(
    "lat, lon, expected",
    [
        ("52,23", "21,01", (52.23, 21.01, [], None)),
        ("21.01", "52.23", (52.23, 21.01, [CORRECTION_SWAPPED], None)),
        ("0", "0", (None, None, [], REJECT_NO_COORDINATES)),
        ("brak", "21.0", (None, None, [], REJECT_NO_COORDINATES)),
        ("50.4O64", "20.1", (None, None, [], REJECT_NO_COORDINATES)),
        ("48.1", "16.3", (None, None, [], REJECT_OUTSIDE_POLAND)),
    ],
)
def test_normalize_coordinates(lat, lon, expected):
    assert normalize_coordinates(lat, lon) == expected


def test_split_distant_points():
    rows = [{"szerokosc": 52.32 + i * 0.001, "dlugosc": 21.10} for i in range(6)]
    rows.append({"szerokosc": 49.7188, "dlugosc": 21.7203})  # skopiowane z innego miasta
    kept, distant = split_distant_points(rows)
    assert len(kept) == 6
    assert distant == [rows[-1]]


def test_records_to_rows_rejects_distant_point_and_marks_duplicated_id():
    lines = ["id;lat;lon;nazwa"] + [f"1;52.3{i};21.1{i};Szkoła {i}" for i in range(6)] + ["9;49.71;21.72;Daleko"]
    rows, rejected = records_to_rows(parse_csv("\n".join(lines)), _meta())
    assert [r["powod"] for r in rejected] == [REJECT_DISTANT]
    assert all(CORRECTION_DUPLICATED_ID in r["korekty"] for r in rows)
    assert len({r["id"] for r in rows}) == len(rows)


def test_records_to_rows_keeps_rows_with_missing_other_fields():
    rows, rejected = records_to_rows(parse_csv("lat,lon\n50.1,20.1\n"), _meta())
    assert not rejected
    assert rows[0]["nazwa"] == "" and rows[0]["adres"] == ""
    assert json.loads(rows[0]["dane_zrodlowe"]) == {"lat": "50.1", "lon": "20.1"}


# --------------------------------------------------------------------------- #
# Licencje                                                                    #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "name, kind",
    [
        ("CC0 1.0", "cc0"),
        ("CC BY 4.0", "cc-by"),
        ("CC BY 3.0", "cc-by"),
        ("CC BY-SA 4.0", None),
        ("CC BY-NC 4.0", None),
        ("CC BY-ND 4.0", None),
        ("CC BY-NC-SA 4.0", None),
        ("", None),
        (None, None),
        ("Licencja własna", None),
    ],
)
def test_classify_license(name, kind):
    result_kind, reason = classify_license(name)
    assert result_kind == kind
    assert (reason is None) is (kind is not None)


def test_combined_license():
    assert combined_license(["cc0", "cc-by"]) == "CC BY 4.0"
    assert combined_license(["cc0", "cc0"]) == "CC0 1.0"
    assert combined_license([]) is None


# --------------------------------------------------------------------------- #
# Duplikaty                                                                   #
# --------------------------------------------------------------------------- #


def _row(ds, rid, lat, lon, nazwa="", adres=""):
    return {
        "id": f"{ds}:{rid}",
        "zrodlo_zbior_id": ds,
        "zrodlo_zbior_tytul": str(ds),
        "nazwa": nazwa,
        "adres": adres,
        "szerokosc": lat,
        "dlugosc": lon,
    }


def test_deduplicate_between_datasets_only():
    rows = [
        _row(1, "a", 52.123451, 21.000001, nazwa="Urząd Gminy"),
        _row(1, "b", 52.123451, 21.000001, nazwa="Urząd gminy"),  # ten sam zbiór - zostaje
        _row(2, "c", 52.1234512, 21.0000013, nazwa="URZAD GMINY"),  # inny zbiór - duplikat
        _row(2, "d", 52.123451, 21.000001, nazwa="Szkoła", adres="ul. Inna 1"),  # inna nazwa i adres
    ]
    kept, duplicates = deduplicate_rows(rows)
    assert [r["id"] for r in kept] == ["1:a", "1:b", "2:d"]
    assert duplicates[0]["id"] == "2:c"
    assert duplicates[0]["duplikat_rekordu"] == "1:a"


def test_write_aed_outputs(tmp_path: Path):
    rows, _ = records_to_rows(parse_csv("id,lat,lon\n1,21.01,52.23\n"), _meta())
    result = AEDAggregationResult(rows=rows, license="CC0 1.0")
    paths = write_aed_outputs(result, tmp_path)
    assert {p.name for p in paths.values()} == {
        "aed_polska.csv",
        "aed_polska.json",
        "odrzucone.json",
        "pominiete.json",
        "duplikaty.json",
    }
    csv_text = paths["csv"].read_text(encoding="utf-8")
    assert "52.23" in csv_text and CORRECTION_SWAPPED in csv_text
    assert json.loads(paths["json"].read_text(encoding="utf-8"))["licencja"] == "CC0 1.0"


# --------------------------------------------------------------------------- #
# Z bazą                                                                      #
# --------------------------------------------------------------------------- #

AED_CSV = b"id;lat;lon;nazwa\n1;52.23;21.01;Urz\xc4\x85d\n2;52.24;21.02;Szko\xc5\x82a\n"


@pytest.mark.django_db
def test_find_aed_datasets_selects_matching_and_tagged():
    by_title = DatasetFactory.create(title="Defibrylatory w gminie", status="published")
    unrelated = DatasetFactory.create(title="Ceny ofertowe dewelopera AEDach", notes="Mieszkania", status="published")
    tagged = DatasetFactory.create(title="Urządzenia ratunkowe", notes="Wykaz urządzeń", status="published")
    TagFactory.create(name="AED", datasets=(tagged,))

    found = find_aed_datasets()
    assert by_title in found
    assert tagged in found
    assert unrelated not in found


@pytest.mark.django_db
def test_html_link_resource_is_skipped(requests_mock):
    dataset = DatasetFactory.create(title="Defibrylatory AED – katalog", status="published")
    ResourceFactory.create(
        dataset=dataset,
        title="Defibrylatory - link",
        format=None,
        main_file=None,
        link="https://katalog.example.com/aed",
        status="published",
    )
    requests_mock.get("https://katalog.example.com/aed", text="<!DOCTYPE html><html></html>", headers={"Content-Type": "text/html"})

    result = build_aed_rows()
    skipped = [s for s in result.skipped if s["zbior_id"] == dataset.pk]
    assert len(skipped) == 1
    assert "HTML" in skipped[0]["powod"]


@pytest.mark.django_db
def test_read_error_of_one_dataset_does_not_stop_others(mocker):
    broken = DatasetFactory.create(title="Defibrylatory A", status="published")
    good = DatasetFactory.create(title="Defibrylatory B", status="published")
    for dataset in (broken, good):
        ResourceFactory.create(dataset=dataset, title=f"AED {dataset.pk}", format="csv", status="published")

    def fake_read(resource):
        if resource.dataset_id == broken.pk:
            raise RuntimeError("uszkodzony plik")
        return AED_CSV, "csv"

    mocker.patch("mcod.resources.aed_aggregation.read_resource_content", side_effect=fake_read)
    result = build_aed_rows()

    assert [s["zbior_id"] for s in result.sources] == [good.pk]
    assert any(s["zbior_id"] == broken.pk for s in result.skipped)
    assert len(result.rows) == 2
    assert result.license == "CC0 1.0"
