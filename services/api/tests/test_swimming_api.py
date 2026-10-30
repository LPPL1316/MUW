"""Open-water swims in the API (TASK-323 part B, ADR-0283): a `swimming`
request is drawn by the engine on the water of the API's cache, 0.5 to 3 km,
lap after lap, a shape of the catalogue or a drawing; its turns are named
after the places of `<cache>/shore_names/`; the result says its laps and
turns, and its GPX has them as waypoints. Paddling is as before.

No network: the water is the engine's hand-built fixtures, written in a
cache folder as a download would leave them; a download is refused.
"""

from __future__ import annotations

import json
import shutil
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine import water
from route_engine.models import RouteRequest
from route_engine.water import FileWaterSource, OverpassWaterSource
from test_paddling import COAST, COAST_START, CONTRACT, SQUARE, WATER_FIXTURES, finished

from shaperoute_api.activity_graphs import ActivityGraphs, check_supported
from shaperoute_api.app import create_app
from shaperoute_api.errors import suggested_distance
from shaperoute_api.schemas import RouteRequestBody, RouteResultBody

NAMES = WATER_FIXTURES / "shore_names_coast.json"
WHEN = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
NS = {"g": "http://www.topografix.com/GPX/1/1"}


def body(distance_m: int = 1000, shape: str = "heart", **more: Any) -> dict[str, Any]:
    return {
        "start": list(COAST_START),
        "shape": shape,
        "distance_m": distance_m,
        "activity": "swimming",
        **more,
    }


def cached(cache: Path, names: bool = True) -> Path:
    """The coast's water in `cache`/water/, one area wide enough for every
    swim from COAST_START (up to 3 km, about 4.5 km each way: a file whose
    area contains the one asked serves it), and its places with a name in
    `cache`/shore_names/ unless `names` is false."""
    lat, lon = COAST_START
    bbox = (lat - 0.08, lon - 0.08, lat + 0.08, lon + 0.08)
    elements = FileWaterSource(COAST).elements(bbox)
    water.write_water(OverpassWaterSource(cache).path(bbox), bbox, elements)
    if names:
        (cache / "shore_names").mkdir(parents=True, exist_ok=True)
        shutil.copy(NAMES, cache / "shore_names" / "coast.json")
    return cache


def api(cache: Path) -> TestClient:
    return TestClient(create_app(ActivityGraphs.from_cache(cache), now=lambda: WHEN))


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


# --- the contract --------------------------------------------------------------


def test_swimming_is_offered_with_its_laps() -> None:
    check_supported("swimming")
    request = json.loads((CONTRACT / "route-request-swimming.json").read_text())
    asked = RouteRequestBody.model_validate(request)
    assert asked.activity == "swimming" and asked.laps == 3
    result = json.loads((CONTRACT / "route-result-swimming.json").read_text())
    answered = RouteResultBody.model_validate(result)
    assert answered.laps == 3 and answered.turns
    assert answered.turns[0].landmark is not None


# --- a swim, from the shapes and from a drawing ----------------------------------


def test_a_swim_is_drawn_lap_after_lap_with_its_named_turns(tmp_path: Path) -> None:
    client = api(cached(tmp_path))
    answer = client.post("/routes", json=body())
    assert answer.status_code == 200, answer.json()
    result = answer.json()
    assert result["laps"] == 3
    assert abs(result["distance_m"] - 1000) <= 100
    assert result["directions"] == [] and result["alternatives"] == []
    assert result["points"][0] == result["points"][-1]
    turns = result["turns"]
    assert [t["lap"] for t in turns] == sorted(t["lap"] for t in turns)
    assert {t["landmark"]["name"] for t in turns} <= {"Bagno 54", "Hotel Miramare"}


def test_a_swim_job_answers_the_same(tmp_path: Path) -> None:
    client = api(cached(tmp_path))
    started = client.post("/route-jobs", json=body(laps=4))
    assert started.status_code == 202, started.json()
    done = finished(client, started.json()["job_id"])
    assert done["status"] == "done", done
    assert done["result"]["laps"] == 4


def test_fewer_laps_a_larger_shape_too_few_say_how_many_fit(tmp_path: Path) -> None:
    client = api(cached(tmp_path))
    answer = client.post("/routes", json=body(laps=2))
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "shape_not_drawable"
    assert error["message"].endswith("it fits in 3 laps")


def test_without_the_places_the_turns_have_no_name(tmp_path: Path) -> None:
    client = api(cached(tmp_path, names=False))
    result = client.post("/routes", json=body()).json()
    assert result["turns"] and all(t["landmark"] is None for t in result["turns"])


def test_a_drawing_is_swum(tmp_path: Path) -> None:
    client = api(cached(tmp_path))
    image = {
        "start": list(COAST_START),
        "outline": SQUARE,
        "distance_m": 1000,
        "activity": "swimming",
    }
    started = client.post("/image-route-jobs", json=image)
    assert started.status_code == 202, started.json()
    done = finished(client, started.json()["job_id"])
    assert done["status"] == "done", done
    result = done["result"]
    assert result["shape"] is None and result["laps"] >= 1
    assert abs(result["distance_m"] - 1000) <= 100


@pytest.mark.parametrize("distance", [499, 3001])
def test_a_swim_is_half_a_km_to_three(tmp_path: Path, distance: int) -> None:
    answer = api(tmp_path).post("/routes", json=body(distance))
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == (
        f"distance must be between 500 and 3000 metres for swimming, got {distance}"
    )
    assert not (tmp_path / "water").exists()


def test_laps_are_for_a_swim_only(tmp_path: Path) -> None:
    paddle = {**body(2000), "activity": "paddling", "laps": 2}
    answer = api(tmp_path).post("/routes", json=paddle)
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == "laps are for a swim"
    with pytest.raises(ValueError, match="1 to 5 times"):
        RouteRequest(
            start=COAST_START,
            shape="heart",
            distance_m=1000,
            activity="swimming",
            laps=9,
        )


def test_too_long_even_in_five_laps_suggests_what_fits() -> None:
    assert suggested_distance(1700.0, "swimming") == 1500
    assert suggested_distance(450.0, "swimming") is None


# --- the GPX --------------------------------------------------------------------


def test_the_gpx_of_a_swim_has_its_turns(tmp_path: Path) -> None:
    client = api(cached(tmp_path))
    result = client.post("/routes", json=body()).json()
    gpx = client.post("/gpx", json={"request": body(), "result": result})
    assert gpx.status_code == 200
    root = ET.fromstring(gpx.content)
    names = [w.findtext("g:name", namespaces=NS) for w in root.findall("g:wpt", NS)]
    first = [t for t in result["turns"] if t["lap"] == 1]
    assert len(names) == len(first) and all(n.startswith("Turn ") for n in names)
    assert len(root.findall(".//g:trkpt", NS)) == len(result["points"])
