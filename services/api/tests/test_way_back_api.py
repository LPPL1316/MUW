"""POST /way-back and its twin on the phone, on_phone.way_back_json
(TASK-314, ADR-0274), in a made-up town: streets every 100 m, "Row j"
running east, "Column i" running north, the route along Row 0 going east,
a railway between Row 0 and Row 1 crossed only by Columns 5 and 6."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import networkx as nx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from route_engine.geo import local_to_latlon
from route_engine.network import BBox, Graph

from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.on_phone import way_back_json
from shaperoute_api.phone_zone_cap import PHONE_HEADER
from shaperoute_api.way_back import (
    MARGIN_M,
    WayBackBody,
    WayBackRequestBody,
    find_way_back,
)
from shaperoute_api.way_back_api import (
    PER_ADDRESS_A_MINUTE,
    PER_PHONE_A_MINUTE,
    way_back_routes,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
TRENTO = (46.0671, 11.1214)
STREET_M = 100.0
CROSSINGS = (5, 6)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text("utf-8"))


def node_id(i: int, j: int) -> int:
    return (i + 100) * 1000 + (j + 100)


def at(x_m: float, y_m: float) -> list[float]:
    lat, lon = local_to_latlon(TRENTO, x_m, y_m)
    return [round(lat, 7), round(lon, 7)]


def town() -> Graph:
    graph = nx.MultiDiGraph()
    span = range(-2, 12)
    for i in span:
        for j in span:
            lat, lon = local_to_latlon(TRENTO, i * STREET_M, j * STREET_M)
            graph.add_node(node_id(i, j), y=lat, x=lon)
    for i in span:
        for j in span:
            if i + 1 in span:
                row = {"length": STREET_M, "name": f"Row {j}", "highway": "residential"}
                graph.add_edge(node_id(i, j), node_id(i + 1, j), **row)
                graph.add_edge(node_id(i + 1, j), node_id(i, j), **row)
            if j + 1 in span and (j != 0 or i in CROSSINGS):
                up = {
                    "length": STREET_M,
                    "name": f"Column {i}",
                    "highway": "residential",
                }
                graph.add_edge(node_id(i, j), node_id(i, j + 1), **up)
                graph.add_edge(node_id(i, j + 1), node_id(i, j), **up)
    return graph


def request_body() -> dict[str, Any]:
    """10 m off Row 2, 40 m past Column 4; the route from Column 0 to 10."""
    return {
        "activity": "running",
        "here": at(440.0, 210.0),
        "ahead": [at(i * STREET_M, 0.0) for i in range(11)],
    }


class _Town:
    """The town, whatever the area; the areas asked are kept."""

    def __init__(self, kept: bool = True) -> None:
        self.asked: list[BBox] = []
        self.kept = kept

    def load(self, bbox: BBox) -> Graph:
        self.asked.append(bbox)
        return town()

    def needs_download(self, bbox: BBox) -> bool:
        return not self.kept


def _post(source: Any, body: Any, **headers: str) -> Any:
    return TestClient(create_app(source)).post("/way-back", json=body, headers=headers)


def test_the_answer_is_the_contract_fixture() -> None:
    assert request_body() == _load("way-back-request.json")
    response = _post(_Town(), _load("way-back-request.json"))
    assert response.status_code == 200
    assert response.json() == _load("way-back.json")
    WayBackBody.model_validate(response.json())


def test_the_way_goes_on_to_the_crossing_and_says_the_turns() -> None:
    body = _post(_Town(), request_body()).json()
    said = [
        (d["turn"], d["street"], round(d["distance_m"])) for d in body["directions"]
    ]
    assert said == [
        ("depart", "Row 2", 0),
        ("right", "Column 5", 70),
        ("left", "Row 0", 270),
    ]
    assert round(body["distance_m"]) == 270
    assert round(body["rejoin_m"]) == 500
    assert body["rejoin"] == body["points"][-1]


def test_the_graph_is_asked_around_the_runner_and_the_stretch() -> None:
    source = _Town()
    body = request_body()
    _post(source, body)
    [(south, west, north, east)] = source.asked
    for lat, lon in [body["here"], *body["ahead"]]:
        assert south < lat < north and west < lon < east
    assert north - body["here"][0] > 0.004  # MARGIN_M is about 0.0045° north
    assert MARGIN_M == 500.0


def test_a_zone_not_kept_is_never_downloaded() -> None:
    source = _Town(kept=False)
    response = _post(source, request_body())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "map_data_unavailable"
    assert source.asked == []


def test_no_way_back_is_an_invalid_request() -> None:
    body = {**request_body(), "here": at(440.0, 50_000.0)}
    response = _post(_Town(), body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_a_stretch_off_the_map_is_an_invalid_request() -> None:
    body = {**request_body(), "ahead": [at(90_000.0, 0.0), at(90_100.0, 0.0)]}
    response = _post(_Town(), body)
    assert response.status_code == 422
    assert "roads of this map" in response.json()["error"]["message"]


def test_on_the_water_there_is_no_way_back() -> None:
    response = _post(_Town(), {**request_body(), "activity": "paddling"})
    assert response.status_code == 422
    assert "water" in response.json()["error"]["message"]


def test_a_body_that_is_not_a_way_back_is_invalid() -> None:
    for body in (
        {**request_body(), "ahead": [at(0.0, 0.0)]},
        {**request_body(), "here": [91.0, 11.0]},
        {**request_body(), "shape": "heart"},
        {**request_body(), "activity": "flying"},
    ):
        response = _post(_Town(), body)
        assert response.status_code == 422, body
        assert response.json()["error"]["code"] == "invalid_request"


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _limited(clock: _Clock) -> TestClient:
    app = FastAPI()
    app.include_router(way_back_routes(_Town(), clock=clock))
    return TestClient(app)


def test_each_phone_asks_a_few_times_a_minute() -> None:
    clock = _Clock()
    client = _limited(clock)
    phone = {PHONE_HEADER: "a" * 32}

    answers = [
        client.post("/way-back", json=request_body(), headers=phone).status_code
        for _ in range(PER_PHONE_A_MINUTE + 1)
    ]

    assert answers == [200] * PER_PHONE_A_MINUTE + [429]
    refused = client.post("/way-back", json=request_body(), headers=phone)
    assert refused.json()["error"]["code"] == "too_many_requests"
    assert int(refused.headers["Retry-After"]) >= 1
    other = client.post(
        "/way-back", json=request_body(), headers={PHONE_HEADER: "b" * 32}
    )
    assert other.status_code == 200
    clock.now = 61.0
    assert (
        client.post("/way-back", json=request_body(), headers=phone).status_code == 200
    )


def test_one_address_has_a_wider_limit_for_all_its_phones() -> None:
    client = _limited(_Clock())

    answers = [
        client.post(
            "/way-back", json=request_body(), headers={PHONE_HEADER: f"{n:032x}"}
        ).status_code
        for n in range(PER_ADDRESS_A_MINUTE + 1)
    ]

    assert answers == [200] * PER_ADDRESS_A_MINUTE + [429]


def test_without_a_phone_id_the_address_is_the_phone() -> None:
    client = _limited(_Clock())

    answers = [
        client.post("/way-back", json=request_body()).status_code
        for _ in range(PER_PHONE_A_MINUTE + 1)
    ]

    assert answers[-1] == 429


def _phone_graphs(source: Any) -> ActivityGraphs:
    return ActivityGraphs({"running": source, "cycling": source})


def test_the_phone_answers_as_the_api() -> None:
    body = json.dumps(_load("way-back-request.json"))

    answer = json.loads(way_back_json(body, _phone_graphs(_Town())))

    assert answer == _load("way-back.json")


def test_the_phone_without_the_zone_says_so_and_the_app_asks_the_server() -> None:
    class _Nothing:
        def load(self, bbox: BBox) -> Graph:
            raise MapDataUnavailableError("no zone on the phone holds the area")

    answer = json.loads(
        way_back_json(json.dumps(request_body()), _phone_graphs(_Nothing()))
    )

    assert answer["error"]["code"] == "map_data_unavailable"


def test_the_phone_with_no_way_back_says_so_as_the_api() -> None:
    body = {**request_body(), "here": at(440.0, 50_000.0)}

    answer = json.loads(way_back_json(json.dumps(body), _phone_graphs(_Town())))

    assert answer["error"]["code"] == "invalid_request"


def test_the_way_back_is_the_same_with_the_activity_graphs() -> None:
    request = WayBackRequestBody.model_validate(request_body())
    one = find_way_back(_Town(), request)
    both = find_way_back(_phone_graphs(_Town()), request)
    assert one == both
