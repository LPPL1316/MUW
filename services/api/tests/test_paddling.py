"""Paddling routes in the API (TASK-191 part B, ADR-0161, ADR-0164): a
`paddling` request is drawn by the engine on the water of the API's cache,
1 to 5 km, a shape of the catalogue only; away from the water, or too big
for it, it is shape_not_drawable with a distance that fits; no directions,
no alternatives. Running and cycling are as before.

No network: the water is the engine's hand-built fixtures
(make_water_fixtures.py), written in a cache folder as a download would
leave them; a download is refused unless a test answers it.
"""

from __future__ import annotations

import importlib.util
import json
import threading
import time
import urllib.error
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
from typing import Any

import networkx as nx
import pytest
from fastapi.testclient import TestClient
from route_engine import water, water_fit
from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import InvalidRequestError, RouteRequest, RouteResult
from route_engine.network import BBox, Graph
from route_engine.optimizer import Plan
from route_engine.paddling import water_area
from route_engine.water import Element, FileWaterSource, OverpassWaterSource

from shaperoute_api import prefetch_zones, replay
from shaperoute_api.activity_graphs import (
    ROAD_ACTIVITIES,
    ActivityGraphs,
    Ground,
    check_supported,
    ground_for,
    water_for,
)
from shaperoute_api.app import create_app
from shaperoute_api.errors import suggested_distance
from shaperoute_api.graphs import ZoneGraphs
from shaperoute_api.images import AnyRequest
from shaperoute_api.paddling import ServerWater

REPO = Path(__file__).resolve().parents[3]
WATER_FIXTURES = REPO / "services/route-engine/tests/fixtures"
COAST = WATER_FIXTURES / "water_coast.json"
LAKE = WATER_FIXTURES / "water_lake.json"
CONTRACT = REPO / "packages/shared-types/fixtures"


def _builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "make_water_fixtures", WATER_FIXTURES / "make_water_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = _builder()
# On the beach, 80 m inland; on the lakeside road's side of the lake; 3.5 km
# inland, as the engine's test_paddling.py.
COAST_START = local_to_latlon(BUILD.COAST_ORIGIN, 100.0, 80.0)
LAKE_START = local_to_latlon(BUILD.LAKE_ORIGIN, -700.0, 0.0)
INLAND = local_to_latlon(BUILD.COAST_ORIGIN, 0.0, 3500.0)
SQUARE = [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0]]
WHEN = datetime(2026, 10, 3, 9, 0, tzinfo=UTC)


def body(start: LatLon, distance_m: int = 2000, shape: str = "heart") -> dict[str, Any]:
    return {
        "start": list(start),
        "shape": shape,
        "distance_m": distance_m,
        "activity": "paddling",
    }


def _request(
    start: LatLon, distance_m: int = 2000, shape: str = "heart"
) -> RouteRequest:
    return RouteRequest(
        start=start, shape=shape, distance_m=distance_m, activity="paddling"
    )


def cached(cache: Path, fixture: Path, request: RouteRequest) -> Path:
    """The fixture's water in `cache`/water/, under the name of the area
    `request` needs, as a download would leave it."""
    bbox = water_area(request)
    elements = FileWaterSource(fixture).elements(bbox)
    water.write_water(OverpassWaterSource(cache).path(bbox), bbox, elements)
    return cache


def api(cache: Path) -> TestClient:
    return TestClient(create_app(ActivityGraphs.from_cache(cache), now=lambda: WHEN))


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


def finished(client: TestClient, job_id: str, seconds: float = 60.0) -> dict[str, Any]:
    deadline = time.monotonic() + seconds
    while True:
        answer: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if answer["status"] in ("done", "failed"):
            return answer
        assert time.monotonic() < deadline, answer
        time.sleep(0.02)


def points_of(result: dict[str, Any]) -> list[LatLon]:
    return [(lat, lon) for lat, lon in result["points"]]


# --- the contract, and where each activity is drawn ---


def test_paddling_is_offered_and_has_water_not_zones(tmp_path: Path) -> None:
    check_supported("paddling")
    assert ROAD_ACTIVITIES == ("running", "cycling")
    graphs = ActivityGraphs.from_cache(tmp_path)
    assert isinstance(graphs.water, ServerWater)
    assert graphs.water.folder == tmp_path / "water"  # beside the zones
    assert isinstance(ground_for(graphs, "running"), ZoneGraphs)
    assert ground_for(graphs, "paddling") is graphs.water
    # No zones for it, and an API with one graph loader has no water.
    with pytest.raises(InvalidRequestError, match="no paddling routes on this API"):
        graphs.for_activity("paddling")
    with pytest.raises(InvalidRequestError, match="no paddling routes on this API"):
        water_for(Roads(), "paddling")


class Roads:
    """A graph loader that remembers the areas asked."""

    def __init__(self) -> None:
        self.asked: list[BBox] = []

    def load(self, bbox: BBox) -> Graph:
        self.asked.append(bbox)
        return nx.MultiDiGraph()


class Water:
    """A water source that remembers the areas asked."""

    def __init__(self) -> None:
        self.asked: list[BBox] = []

    def elements(self, bbox: BBox) -> list[Element]:
        self.asked.append(bbox)
        return []


RESULT = RouteResult(
    points=[COAST_START, (44.002, 12.652), COAST_START],
    distance_m=2010.0,
    similarity=1.0,
    shape="heart",
)


@pytest.mark.parametrize("path", ["/routes", "/route-jobs"])
def test_paddling_is_planned_on_the_water_a_run_on_the_roads(path: str) -> None:
    foot, bike, lake = Roads(), Roads(), Water()
    graphs = ActivityGraphs({"running": foot, "cycling": bike}, water=lake)
    seen: list[str] = []
    box = (44.0, 12.6, 44.1, 12.7)

    def planner(request: AnyRequest, ground: Ground) -> Plan:
        # As the engine does: the water, or the graph of the start.
        if request.activity == "paddling":
            ground.elements(box)  # type: ignore[union-attr]
        else:
            ground.load(box)  # type: ignore[union-attr]
        seen.append(request.activity)
        return Plan(result=RESULT, search=None)

    run = {"start": list(COAST_START), "shape": "heart", "distance_m": 5000}
    with TestClient(create_app(graphs, planner=planner)) as client:
        for request in (body(COAST_START), run):
            answer = client.post(path, json=request)
            assert answer.status_code in (200, 202), answer.json()
            if path == "/route-jobs":
                assert finished(client, answer.json()["job_id"])["status"] == "done"
    assert seen == ["paddling", "running"]
    assert len(lake.asked) == len(foot.asked) == 1 and bike.asked == []


# --- on the water of the fixtures ---


def test_a_paddling_job_draws_the_shape_on_the_water(tmp_path: Path) -> None:
    client = api(cached(tmp_path, COAST, _request(COAST_START)))
    job = client.post("/route-jobs", json=body(COAST_START))
    assert job.status_code == 202
    answer = finished(client, job.json()["job_id"])
    assert answer["status"] == "done", answer
    result = answer["result"]
    points = points_of(result)
    assert points[0] == points[-1]  # closed, from the shore and back
    assert points[0] != COAST_START  # the shore start, not the beach's inside
    assert abs(result["distance_m"] - 2000) <= 200
    assert result["similarity"] == 1.0  # the shape is the route
    assert result["shape"] == "heart" and result["word"] is None
    # No graph on the water: no directions; one placement: no alternatives.
    assert result["directions"] == [] and result["alternatives"] == []
    assert result["warnings"] == [] and result["walks"] == []
    # The engine's own measures, on the same water: never on land, and
    # within 1 km of the shore.
    bbox = water_area(_request(COAST_START))
    area = water.build_area(FileWaterSource(COAST).elements(bbox), COAST_START, bbox)
    measures = water_fit.measure(points, area)
    assert measures.on_land_m == 0.0
    assert measures.farthest_shore_m <= water.SHORE_BAND_M


def test_the_contract_fixture_is_drawn_by_post_routes(tmp_path: Path) -> None:
    request = json.loads((CONTRACT / "route-request-paddling.json").read_text())
    start = (request["start"][0], request["start"][1])
    client = api(cached(tmp_path, COAST, _request(start, request["distance_m"])))
    answer = client.post("/routes", json=request)
    assert answer.status_code == 200, answer.json()
    result = answer.json()
    assert result["shape"] == "heart" and result["directions"] == []
    assert abs(result["distance_m"] - request["distance_m"]) <= 200


def test_a_lake_takes_the_longest_paddling_route(tmp_path: Path) -> None:
    client = api(cached(tmp_path, LAKE, _request(LAKE_START, 5000)))
    answer = client.post("/routes", json=body(LAKE_START, 5000))
    assert answer.status_code == 200, answer.json()
    assert abs(answer.json()["distance_m"] - 5000) <= 500


def test_away_from_the_water_is_shape_not_drawable(tmp_path: Path) -> None:
    client = api(cached(tmp_path, COAST, _request(INLAND)))
    answer = client.post("/routes", json=body(INLAND))
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "shape_not_drawable"
    assert "no lake or sea to paddle on within 2 km" in error["message"]
    assert error["suggested_distance_m"] is None
    job = finished(
        client, client.post("/route-jobs", json=body(INLAND)).json()["job_id"]
    )
    assert job["status"] == "failed" and job["error"] == error


@pytest.mark.parametrize(
    ("shape", "asked", "fits"), [("heart", 5000, 3000), ("circle", 4000, 2500)]
)
def test_a_shape_too_big_for_the_water_suggests_a_distance_that_fits(
    tmp_path: Path, shape: str, asked: int, fits: int
) -> None:
    # At sea the band is 800 m wide (ADR-0161): a heart fits up to about
    # 3 km, a circle up to about 2.8. The suggestion is asked for, and drawn.
    client = api(cached(tmp_path, COAST, _request(COAST_START, asked, shape)))
    answer = client.post("/routes", json=body(COAST_START, asked, shape))
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "shape_not_drawable"
    assert f"does not fit at {asked / 1000:g} km on the water" in error["message"]
    assert error["suggested_distance_m"] == fits
    again = client.post("/routes", json=body(COAST_START, fits, shape))
    assert again.status_code == 200, again.json()
    assert abs(again.json()["distance_m"] - fits) <= 0.1 * fits


@pytest.mark.parametrize(
    ("best_m", "suggested"),
    [
        (3008.3, 3000),
        (2764.1, 2500),  # down, not to the nearest: 3 km might not fit
        (2550.0, 2500),
        (1499.9, 1000),
        (999.0, None),  # nothing that fits can be asked
        (6200.0, 5000),
        (None, None),
    ],
)
def test_on_the_water_the_distance_suggested_is_the_half_km_it_fits_at(
    best_m: float | None, suggested: int | None
) -> None:
    assert suggested_distance(best_m, "paddling") == suggested


def test_a_run_and_a_ride_suggest_as_before() -> None:
    assert suggested_distance(2764.1, "running") == 3000
    assert suggested_distance(999.0, "running") == 1000
    assert suggested_distance(8400.0, "cycling") == 10_000


@pytest.mark.parametrize("distance", [999, 5001])
def test_paddling_is_1_to_5_km(tmp_path: Path, distance: int) -> None:
    client = api(tmp_path)
    for path in ("/routes", "/route-jobs"):
        answer = client.post(path, json=body(COAST_START, distance))
        assert answer.status_code == 422
        assert answer.json()["error"] == {
            "code": "invalid_request",
            "message": (
                f"distance must be between 1000 and 5000 metres for paddling, "
                f"got {distance}"
            ),
            "suggested_distance_m": None,
            "reason": None,
        }
    assert not (tmp_path / "water").exists()  # nothing read nor downloaded


def test_a_word_on_the_water_is_refused(tmp_path: Path) -> None:
    client = api(tmp_path)
    word = {**body(COAST_START, 3000), "shape": None, "word": "o"}
    for path in ("/routes", "/route-jobs"):
        answer = client.post(path, json=word)
        assert answer.status_code == 422
        error = answer.json()["error"]
        assert error["code"] == "invalid_request"
        assert error["message"] == (
            "on the water only a shape of the catalogue is drawn, not a word"
        )


def test_an_image_on_the_water_is_paddled_where_it_fits(tmp_path: Path) -> None:
    # Since TASK-369 (ADR-0313) a canoe paddles a drawing as it does a
    # shape: «Edit the drawing» makes one of every route. The water of the
    # largest heart covers the square's.
    client = api(cached(tmp_path, COAST, _request(COAST_START, 5000)))
    image = {
        "start": list(COAST_START),
        "outline": SQUARE,
        "distance_m": 2000,
        "activity": "paddling",
    }
    answer = client.post("/image-route-jobs", json=image)
    assert answer.status_code == 202, answer.text
    job = finished(client, answer.json()["job_id"])
    assert job["status"] == "done", job
    result = job["result"]
    assert result["shape"] is None
    points = points_of(result)
    assert points[0] == points[-1]
    assert abs(result["distance_m"] - 2000) <= 200
    # No search on the water: no alternatives.
    assert not result.get("alternatives")
    gpx = client.post("/gpx", json={"request": image, "result": result})
    assert gpx.status_code == 200, gpx.text


def test_an_image_on_the_water_keeps_the_limits_of_the_canoe(tmp_path: Path) -> None:
    client = api(tmp_path)
    image = {
        "start": list(COAST_START),
        "outline": SQUARE,
        "distance_m": 12_000,
        "activity": "paddling",
    }
    answer = client.post("/image-route-jobs", json=image)
    assert answer.status_code == 422
    assert answer.json()["error"]["code"] == "invalid_request"
    assert "not an image" not in answer.json()["error"]["message"]
    # Left where it was drawn it is refused: no route on the water is.
    anchored = {**image, "distance_m": 2000, "placement": "anchored"}
    refused = client.post("/image-route-jobs", json=anchored)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "invalid_request"


# --- the water of the cache: read, downloaded, refused ---


def test_the_water_is_downloaded_once_and_the_job_says_so(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    elements = FileWaterSource(COAST).elements(water_area(_request(COAST_START)))
    asked: list[str] = []
    release = threading.Event()

    def answer(query: str) -> dict[str, Any]:
        asked.append(query)
        assert release.wait(30)
        return {"elements": elements}

    monkeypatch.setattr(water, "overpass", answer)
    client = api(tmp_path)
    job_id = client.post("/route-jobs", json=body(COAST_START)).json()["job_id"]
    deadline = time.monotonic() + 30
    while client.get(f"/route-jobs/{job_id}").json()["status"] != "downloading_map":
        assert time.monotonic() < deadline
        time.sleep(0.02)
    release.set()
    assert finished(client, job_id)["status"] == "done"
    # Kept in the cache's water folder: the same start reads it again.
    assert list((tmp_path / "water").glob("water_*.json"))
    again = client.post("/routes", json=body(COAST_START))
    assert again.status_code == 200
    assert len(asked) == 1


def test_water_that_cannot_be_downloaded_is_map_data_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unreachable(query: str) -> dict[str, Any]:
        raise urllib.error.URLError("No route to host")

    monkeypatch.setattr(water, "overpass", unreachable)
    client = api(tmp_path)
    answer = client.post("/routes", json=body(COAST_START))
    assert answer.status_code == 503
    error = answer.json()["error"]
    assert error["code"] == "map_data_unavailable"
    assert error["message"].startswith(
        "OpenStreetMap water for this area could not be downloaded"
    )
    job = finished(
        client, client.post("/route-jobs", json=body(COAST_START)).json()["job_id"]
    )
    assert job["status"] == "failed" and job["error"]["code"] == "map_data_unavailable"
    assert not list(tmp_path.glob("water/*.json"))


def test_a_job_cancelled_while_the_water_downloads_places_no_shape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    elements = FileWaterSource(COAST).elements(water_area(_request(COAST_START)))
    downloading, release = threading.Event(), threading.Event()
    placed: list[str] = []

    def answer(query: str) -> dict[str, Any]:
        downloading.set()
        assert release.wait(30)
        return {"elements": elements}

    def fit_shape(*args: Any, **kwargs: Any) -> Any:
        placed.append(kwargs["name"])
        raise AssertionError("placed")

    monkeypatch.setattr(water, "overpass", answer)
    monkeypatch.setattr(water_fit, "fit_shape", fit_shape)
    client = api(tmp_path)
    job_id = client.post("/route-jobs", json=body(COAST_START)).json()["job_id"]
    assert downloading.wait(30)
    assert client.delete(f"/route-jobs/{job_id}").status_code == 204
    release.set()
    deadline = time.monotonic() + 5
    while not list(tmp_path.glob("water/*.json")):
        assert time.monotonic() < deadline
        time.sleep(0.02)
    time.sleep(0.2)
    assert placed == []  # dropped before the engine places the shape
    assert client.get(f"/route-jobs/{job_id}").status_code == 404


# --- the rest of the API with a route on the water ---


def test_a_route_on_the_water_has_no_directions_from_route_directions(
    tmp_path: Path,
) -> None:
    # Asked with its points only, the route is not on the roads of the
    # foot map: 422 invalid_request, and the water is not read.
    client = api(cached(tmp_path, COAST, _request(COAST_START)))
    points = client.post("/routes", json=body(COAST_START)).json()["points"]
    foot, lake = Roads(), Water()
    graphs = ActivityGraphs({"running": foot, "cycling": Roads()}, water=lake)
    answer = TestClient(create_app(graphs)).post(
        "/route-directions", json={"points": points}
    )
    assert answer.status_code == 422
    assert answer.json()["error"] == {
        "code": "invalid_request",
        "message": "The route does not follow the roads of this map.",
        "suggested_distance_m": None,
        "reason": None,
    }
    assert len(foot.asked) == 1 and lake.asked == []


def test_a_route_on_the_water_exports_to_gpx(tmp_path: Path) -> None:
    client = api(cached(tmp_path, COAST, _request(COAST_START)))
    result = client.post("/routes", json=body(COAST_START)).json()
    gpx = client.post("/gpx", json={"request": body(COAST_START), "result": result})
    assert gpx.status_code == 200
    assert gpx.headers["content-disposition"] == (
        'attachment; filename="sgrava-heart-2km-2026-10-03.gpx"'
    )
    ns = {"g": "http://www.topografix.com/GPX/1/1"}
    track = ET.fromstring(gpx.content).findall(".//g:trkpt", ns)
    assert len(track) == len(result["points"])


def test_a_recorded_paddling_request_is_redone_on_the_water(tmp_path: Path) -> None:
    cache = cached(tmp_path, COAST, _request(COAST_START))
    drawn = api(cache).post("/routes", json=body(COAST_START)).json()
    entry = {"kind": "route", "request": body(COAST_START)}
    again = replay.replay(entry, ActivityGraphs.from_cache(cache))
    assert [list(p) for p in again.points] == drawn["points"]
    assert again.directions == [] and again.alternatives == []


def test_paddling_has_no_zones_to_download_ahead() -> None:
    with pytest.raises(SystemExit) as refused:
        prefetch_zones.main(["--activity", "paddling", "Riccione"])
    assert refused.value.code == 2
