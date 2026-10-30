"""Bike routes in the API (TASK-190 part B, ADR-0153): a cycling request is
drawn on the zones of the bike network, 10 to 30 km, and its errors suggest
a distance a bike may ask for; a running request is as before.

No network: the zones are a small town made here and given to OSMnx as
Overpass would answer, as in the engine's test_bike_network.py.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import osmnx._overpass as osmnx_overpass
import pytest
import route_engine.network as network
from fastapi.testclient import TestClient
from route_engine.geo import local_to_latlon
from route_engine.models import RouteResult
from route_engine.network import (
    BIKE_NETWORK_NAME,
    FOOT_NETWORK_NAME,
    BBox,
    FileSource,
    Graph,
    OsmnxSource,
    area_around,
    network_of,
)
from route_engine.optimizer import GraphLoader, Plan, ShapeNotDrawableError

from shaperoute_api import replay
from shaperoute_api.activity_graphs import (
    ZONES_IN_MEMORY,
    ActivityGraphs,
    check_supported,
    source_for,
)
from shaperoute_api.app import create_app
from shaperoute_api.errors import suggested_distance
from shaperoute_api.graphs import MAX_ZONES, ZoneGraphs
from shaperoute_api.images import AnyRequest, ImageRequest, image_job, outline_of

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"

TOWN = (46.0122, 11.2986)
SPACING_M = 300.0
LINES = 45  # streets each way: the town is 13.2 km wide, centred on TOWN
# Rows run west to east, columns south to north; their node ids.
ONE_WAY_ROWS = {row for row in range(LINES) if row % 4 == 1}
STEPS_COL, FOOT_COL, TRUNK_COL, CYCLE_COL = 21, 23, 25, 19
COLUMN_TAGS: dict[int, dict[str, str]] = {
    STEPS_COL: {"highway": "steps"},
    FOOT_COL: {"highway": "footway"},
    TRUNK_COL: {"highway": "trunk"},
    CYCLE_COL: {"highway": "path", "bicycle": "designated"},
}
SQUARE = [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0]]

BIKE_CIRCLE = {
    "start": list(TOWN),
    "shape": "circle",
    "distance_m": 10_000,
    "activity": "cycling",
}
RUN_HEART = {"start": list(TOWN), "shape": "heart", "distance_m": 5_000}
RESULT = RouteResult(
    points=[TOWN, (46.0130, 11.2990), TOWN],
    distance_m=10_100.0,
    similarity=0.9,
    shape="circle",
)


def _node(row: int, column: int) -> int:
    return 1 + row * LINES + column


def _point(row: int, column: int) -> tuple[float, float]:
    half = LINES // 2
    return local_to_latlon(TOWN, (column - half) * SPACING_M, (row - half) * SPACING_M)


def town_answer() -> dict[str, Any]:
    """What Overpass would answer for the town, whatever the filter."""
    elements: list[dict[str, Any]] = []
    for row in range(LINES):
        for column in range(LINES):
            lat, lon = _point(row, column)
            elements.append(
                {"type": "node", "id": _node(row, column), "lat": lat, "lon": lon}
            )
    for row in range(LINES):
        tags = {"highway": "residential", "name": f"Row {row}"}
        if row in ONE_WAY_ROWS:
            tags["oneway"] = "yes"
        nodes = [_node(row, column) for column in range(LINES)]
        elements.append(
            {"type": "way", "id": 100_000 + row, "nodes": nodes, "tags": tags}
        )
    for column in range(LINES):
        tags = COLUMN_TAGS.get(column, {"highway": "residential"})
        nodes = [_node(row, column) for row in range(LINES)]
        elements.append(
            {"type": "way", "id": 200_000 + column, "nodes": nodes, "tags": tags}
        )
    return {"version": 0.6, "elements": elements}


@contextmanager
def _anywhere(url: str) -> Iterator[None]:
    yield None


@pytest.fixture
def town(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A cache folder with the town's foot zone and bike zone, each made by
    the engine from the same answer; no download afterwards."""

    def download(polygon: Any, network_type: str, custom_filter: Any) -> Iterator[Any]:
        yield town_answer()

    def nowhere(*args: Any, **kwargs: Any) -> Iterator[Any]:
        raise AssertionError("no download once the zones are cached")

    monkeypatch.setattr(osmnx_overpass, "_download_overpass_network", download)
    monkeypatch.setattr(network, "reachable", _anywhere)
    monkeypatch.setattr(ox.settings, "cache_folder", ox.settings.cache_folder)
    cache = tmp_path / "cache"
    zone = area_around([TOWN], margin_m=6_500.0)
    for activity in ("running", "cycling"):
        OsmnxSource.for_activity(cache, activity).load(zone)
    monkeypatch.setattr(osmnx_overpass, "_download_overpass_network", nowhere)
    return cache


class Network:
    """A graph loader of one network that remembers the areas asked."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.asked: list[BBox] = []

    def load(self, bbox: BBox) -> Graph:
        self.asked.append(bbox)
        graph: Graph = nx.MultiDiGraph()
        if self.name != FOOT_NETWORK_NAME:
            graph.graph["network"] = self.name
        return graph


def two_networks() -> tuple[ActivityGraphs, Network, Network]:
    foot, bike = Network(FOOT_NETWORK_NAME), Network(BIKE_NETWORK_NAME)
    return ActivityGraphs({"running": foot, "cycling": bike}), foot, bike


def loading(outcome: RouteResult | Exception, seen: list[tuple[str, str]]):  # type: ignore[no-untyped-def]
    """A planner that loads the graph of the start, as the engine does,
    and says which network it got for which activity."""

    def planner(request: AnyRequest, source: GraphLoader) -> Plan:
        graph = source.load((46.0, 11.29, 46.02, 11.31))
        seen.append((request.activity, network_of(graph)))
        if isinstance(outcome, Exception):
            raise outcome
        return Plan(result=outcome, search=None)

    return planner


def finished(client: TestClient, job_id: str, seconds: float = 5.0) -> dict[str, Any]:
    deadline = time.monotonic() + seconds
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.02)


# --- the zones of each activity ---


def test_the_api_keeps_the_zones_of_each_network_apart(tmp_path: Path) -> None:
    graphs = ActivityGraphs.from_cache(tmp_path)
    foot, bike = graphs.for_activity("running"), graphs.for_activity("cycling")
    assert isinstance(foot, ZoneGraphs) and isinstance(bike, ZoneGraphs)
    box = (46.0, 11.0, 46.1, 11.1)
    # The foot files keep their names (ADR-0153); the bike ones are apart.
    assert foot._source.cache_path(box).name.startswith("foot_46.00000")  # type: ignore[attr-defined]
    assert bike._source.cache_path(box).name.startswith("bike_46.00000")  # type: ignore[attr-defined]
    assert foot._max_zones == MAX_ZONES == 2  # as before
    assert bike._max_zones == ZONES_IN_MEMORY["cycling"] == 1


def test_only_the_activities_of_the_contract_are_offered() -> None:
    check_supported("running")
    check_supported("cycling")
    check_supported("paddling")  # on the water (TASK-191, test_paddling.py)
    check_supported("swimming")  # on the water too (TASK-323)
    for other in ("hiking", "Cycling", ""):
        with pytest.raises(
            ValueError, match="choose one of: running, cycling, paddling, swimming"
        ):
            check_supported(other)
    graphs, foot, _ = two_networks()
    with pytest.raises(ValueError, match="unsupported activity 'hiking'"):
        graphs.for_activity("hiking")
    # One loader for everything, as the tests give: every route has it.
    assert source_for(foot, "cycling") is foot


@pytest.mark.parametrize("path", ["/routes", "/route-jobs"])
def test_a_cycling_request_is_drawn_on_the_bike_zones_a_run_on_foot(
    path: str,
) -> None:
    graphs, foot, bike = two_networks()
    seen: list[tuple[str, str]] = []
    with TestClient(create_app(graphs, planner=loading(RESULT, seen))) as client:
        for body in (BIKE_CIRCLE, RUN_HEART):
            response = client.post(path, json=body)
            assert response.status_code in (200, 202), response.json()
            if path == "/route-jobs":
                assert finished(client, response.json()["job_id"])["status"] == "done"
    assert seen == [("cycling", "bike"), ("running", "foot")]
    assert len(foot.asked) == len(bike.asked) == 1


def test_an_image_by_bike_is_drawn_on_the_bike_zones() -> None:
    graphs, _, _ = two_networks()
    seen: list[tuple[str, str]] = []
    image = {"start": list(TOWN), "outline": SQUARE, "distance_m": 12_000}
    with TestClient(create_app(graphs, planner=loading(RESULT, seen))) as client:
        for activity in ("cycling", "running"):
            body = {**image, "activity": activity}
            job = client.post("/image-route-jobs", json=body).json()
            assert finished(client, job["job_id"])["status"] == "done"
    assert seen == [("cycling", "bike"), ("running", "foot")]


def test_an_image_job_carries_its_activity_to_the_engine() -> None:
    request = ImageRequest(
        start=TOWN, outline=outline_of(SQUARE), distance_m=12_000, activity="cycling"
    )
    assert image_job(request).activity == "cycling"
    run = ImageRequest(start=TOWN, outline=outline_of(SQUARE), distance_m=12_000)
    assert image_job(run).activity == "running"


def test_the_directions_of_an_explore_route_stay_on_foot() -> None:
    graphs, foot, bike = two_networks()
    client = TestClient(create_app(graphs))
    points = [list(TOWN), [46.013, 11.299], list(TOWN)]
    # The graph here has no roads: only which one was asked matters.
    client.post("/route-directions", json={"points": points})
    assert len(foot.asked) == 1 and bike.asked == []


# --- the limits, and the errors ---


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/routes", {**BIKE_CIRCLE, "distance_m": 5_000}),
        ("/route-jobs", {**BIKE_CIRCLE, "distance_m": 31_000}),
        (
            "/image-route-jobs",
            {
                "start": list(TOWN),
                "outline": SQUARE,
                "distance_m": 9_000,
                "activity": "cycling",
            },
        ),
    ],
)
def test_a_bike_distance_outside_10_to_30_km_says_the_limits(
    path: str, body: dict[str, Any]
) -> None:
    graphs, foot, bike = two_networks()
    client = TestClient(create_app(graphs, planner=loading(RESULT, [])))
    response = client.post(path, json=body)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"] == (
        f"distance must be between 10000 and 30000 metres for cycling, "
        f"got {body['distance_m']}"
    )
    assert foot.asked == bike.asked == []


def test_a_run_keeps_its_limits_and_its_message() -> None:
    graphs, _, _ = two_networks()
    client = TestClient(create_app(graphs, planner=loading(RESULT, [])))
    for distance, accepted in ((5_000, True), (500, False), (51_000, False)):
        response = client.post("/routes", json={**RUN_HEART, "distance_m": distance})
        assert (response.status_code == 200) is accepted, response.json()
    message = client.post("/routes", json={**RUN_HEART, "distance_m": 500}).json()
    assert message["error"]["message"] == (
        "distance must be between 1000 and 50000 metres, got 500"
    )


@pytest.mark.parametrize("activity", ["hiking", "skating"])
def test_an_activity_the_contract_does_not_offer_is_an_invalid_request(
    activity: str,
) -> None:
    graphs, foot, bike = two_networks()
    client = TestClient(create_app(graphs, planner=loading(RESULT, [])))
    for path in ("/routes", "/route-jobs"):
        response = client.post(path, json={**BIKE_CIRCLE, "activity": activity})
        assert response.status_code == 422
        assert response.json()["error"]["message"] == (
            f"unsupported activity {activity!r}; "
            "choose one of: running, cycling, paddling, swimming"
        )
    assert foot.asked == bike.asked == []


@pytest.mark.parametrize(
    ("activity", "best_m", "suggested"),
    [
        ("cycling", 8_400.0, 10_000),
        ("cycling", 14_600.0, 15_000),
        ("cycling", 34_000.0, 30_000),
        ("running", 8_400.0, 8_000),
        ("running", 61_000.0, 50_000),
    ],
)
def test_a_shape_that_misses_the_distance_suggests_one_of_its_activity(
    activity: str, best_m: float, suggested: int
) -> None:
    assert suggested_distance(best_m, activity) == suggested
    graphs, _, _ = two_networks()
    refused = ShapeNotDrawableError("cannot be drawn here", best_m)
    body = {**BIKE_CIRCLE, "activity": activity, "distance_m": 20_000}
    with TestClient(create_app(graphs, planner=loading(refused, []))) as client:
        answer = client.post("/routes", json=body)
        assert answer.status_code == 422
        assert answer.json()["error"]["suggested_distance_m"] == suggested
        job = finished(client, client.post("/route-jobs", json=body).json()["job_id"])
        assert job["error"]["suggested_distance_m"] == suggested


def test_a_bike_route_is_never_drawn_on_the_foot_network() -> None:
    # An API given the foot graphs only: the engine refuses (ADR-0153).
    client = TestClient(
        create_app(FileSource(LEVICO_GRAPH)), raise_server_exceptions=False
    )
    body = {**BIKE_CIRCLE, "start": [46.0122, 11.2986], "distance_m": 10_000}
    response = client.post("/routes", json=body)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "engine_error"


def test_a_recorded_bike_request_is_redone_on_the_bike_zones() -> None:
    graphs, foot, bike = two_networks()
    seen: list[tuple[str, str]] = []
    entry = {"kind": "route", "request": BIKE_CIRCLE}
    assert replay.replay(entry, graphs, loading(RESULT, seen)) == RESULT
    assert seen == [("cycling", "bike")] and foot.asked == []


# --- end to end, on the town ---


def test_a_bike_route_on_the_town_rides_only_where_bikes_may(town: Path) -> None:
    graphs = ActivityGraphs.from_cache(town)
    with TestClient(create_app(graphs)) as client:
        job = client.post("/route-jobs", json=BIKE_CIRCLE).json()
        body = finished(client, job["job_id"], seconds=300.0)
    assert body["status"] == "done", body
    result = body["result"]
    points = [tuple(p) for p in result["points"]]
    assert points[0] == points[-1]
    assert 8_000 < result["distance_m"] < 12_000
    assert result["directions"]
    # Never along the steps or the trunk road: a stretch between two of
    # their nodes would be one.
    for column in (STEPS_COL, TRUNK_COL):
        on_it = {_point(row, column) for row in range(LINES)}
        for a, b in zip(points, points[1:], strict=False):
            assert not (_near(a, on_it) and _near(b, on_it) and a != b), column
    # Along the footway, or a one-way row westward, only with the bike on
    # foot (TASK-206, ADR-0167): then the warnings say how far.
    walked = False
    footway = {_point(row, FOOT_COL) for row in range(LINES)}
    for a, b in zip(points, points[1:], strict=False):
        walked |= _near(a, footway) and _near(b, footway) and a != b
    for row in ONE_WAY_ROWS:
        on_it = {_point(row, column): column for column in range(LINES)}
        for a, b in zip(points, points[1:], strict=False):
            if (ca := _column(a, on_it)) is not None and (
                cb := _column(b, on_it)
            ) is not None:
                walked |= cb < ca
    on_foot = [w for w in result["warnings"] if w.endswith("with the bike on foot")]
    assert on_foot or not walked
    zones = sorted(p.name.split("_")[0] for p in town.glob("*.graphml"))
    assert zones == ["bike", "foot"]  # read from the cache, nothing new


# Under a metre: the town's nodes are 300 m apart.
CLOSE = 5e-6


def _near(point: tuple[float, float], nodes: set[tuple[float, float]]) -> bool:
    return any(
        abs(point[0] - n[0]) < CLOSE and abs(point[1] - n[1]) < CLOSE for n in nodes
    )


def _column(
    point: tuple[float, float], nodes: dict[tuple[float, float], int]
) -> int | None:
    for node, column in nodes.items():
        if abs(point[0] - node[0]) < CLOSE and abs(point[1] - node[1]) < CLOSE:
            return column
    return None


def test_a_run_from_the_same_api_rides_the_foot_zone(
    town: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    graphs = ActivityGraphs.from_cache(town)
    seen: list[str] = []
    loaded = network.read_graph

    def read(path: Path) -> Graph:
        seen.append(path.name.split("_")[0])
        return loaded(path)

    for activity in ("running", "cycling"):
        zone = graphs.for_activity(activity)
        assert isinstance(zone, ZoneGraphs)
        zone._read = read  # type: ignore[assignment]
        zone.load(area_around([TOWN], margin_m=2_000.0))
    assert seen == ["foot", "bike"]
    assert (
        network_of(graphs.for_activity("cycling").load(area_around([TOWN], 1_000.0)))
        == "bike"
    )
