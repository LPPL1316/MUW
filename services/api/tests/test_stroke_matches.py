"""POST /stroke-matches and its probe (stroke_matches.py, TASK-347 part A,
ADR-0300): a stroke drawn on the map, anchored to the roads of the Levico
fixture; every refusal; the key as for every route."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import pytest
from fastapi.testclient import TestClient
from route_engine.geo import LatLon, haversine_m, local_to_latlon
from route_engine.network import FileSource

from shaperoute_api.access import Access, protect
from shaperoute_api.app import create_app
from shaperoute_api.stroke_matches import (
    MAX_STROKE_M,
    MAX_STROKE_POINTS,
    StrokeMatchBody,
    StrokeMatchRequestBody,
)

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
GRAPH = ox.load_graphml(LEVICO_GRAPH)


def _along_a_road(offset_m: float = 15.0) -> list[list[float]]:
    """Points along a road of the fixture, `offset_m` east of it, as the
    finger would draw it."""
    first = next(iter(GRAPH.nodes))
    lengths = nx.single_source_dijkstra_path_length(GRAPH, first, cutoff=500.0)
    far = max(lengths, key=lengths.get)
    return [
        list(local_to_latlon((GRAPH.nodes[n]["y"], GRAPH.nodes[n]["x"]), offset_m, 0.0))
        for n in nx.shortest_path(GRAPH, first, far, weight="length")
    ]


LINE = _along_a_road()


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(FileSource(LEVICO_GRAPH)))


def test_the_probe_says_this_server_matches_strokes(client: TestClient) -> None:
    answer = client.get("/stroke-matches")
    assert answer.status_code == 204
    assert answer.content == b""


def test_a_stroke_is_anchored_to_the_roads(client: TestClient) -> None:
    answer = client.post("/stroke-matches", json={"activity": "running", "line": LINE})
    assert answer.status_code == 200, answer.text
    match = answer.json()
    assert set(match) == {"points", "away_m", "off_roads"}
    assert len(match["away_m"]) == len(LINE)
    assert max(match["away_m"]) <= 15.0 + 0.1
    assert match["off_roads"] is False
    assert len(match["points"]) >= 2
    # Every point is on a node or an edge of the graph: rounded to 6 digits.
    for lat, lon in match["points"]:
        assert round(lat, 6) == lat and round(lon, 6) == lon


def test_the_next_stroke_starts_where_the_one_before_ended(
    client: TestClient,
) -> None:
    first = client.post("/stroke-matches", json={"line": LINE[:4]}).json()
    end = first["points"][-1]
    second = client.post("/stroke-matches", json={"line": LINE[4:], "from": end})
    assert second.status_code == 200, second.text
    match = second.json()
    assert match["points"][0] == end
    assert len(match["away_m"]) == len(LINE) - 4


def test_the_magnet_is_taken_and_the_tighter_one_stays_nearer(
    client: TestClient,
) -> None:
    line = _along_a_road(40.0)
    loose = client.post("/stroke-matches", json={"line": line, "fit": 1.0}).json()
    tight = client.post("/stroke-matches", json={"line": line, "fit": 0.0}).json()
    assert len(loose["away_m"]) == len(tight["away_m"]) == len(line)
    assert sum(tight["away_m"]) <= sum(loose["away_m"]) + 1e-6


@pytest.mark.parametrize(
    ("body", "fragment"),
    [
        ({}, "line"),
        ({"line": [LINE[0]]}, "at least 2"),
        ({"line": LINE, "fit": 1.5}, "fit must be between 0 and 1"),
        ({"line": LINE, "fit": "tight"}, "fit"),
        ({"line": LINE, "activity": "paddling"}, "not a stroke"),
        ({"line": LINE, "activity": "flying"}, "activity"),
        ({"line": LINE, "from": [46.0]}, "from"),
        ({"line": LINE, "start": LINE[0]}, "start"),
        ({"line": [[91.0, 11.0], LINE[1]]}, "latitude"),
        ({"line": [LINE[0]] * (MAX_STROKE_POINTS + 1)}, "line"),
    ],
)
def test_a_body_out_of_the_contract_is_refused(
    client: TestClient, body: dict[str, Any], fragment: str
) -> None:
    answer = client.post("/stroke-matches", json=body)
    assert answer.status_code == 422, answer.text
    error = answer.json()["error"]
    assert error["code"] == "invalid_request"
    assert fragment in error["message"]


def test_a_stroke_too_long_is_refused(client: TestClient) -> None:
    lat, lon = LINE[0]
    far = local_to_latlon((lat, lon), MAX_STROKE_M + 500.0, 0.0)
    answer = client.post("/stroke-matches", json={"line": [[lat, lon], list(far)]})
    assert answer.status_code == 422
    assert "longer than 10 km" in answer.json()["error"]["message"]


def test_a_stroke_on_a_single_road_node_is_not_drawable(client: TestClient) -> None:
    # Far from every road of the fixture: one nearest node for every point.
    lat, lon = LINE[0]
    away = [list(local_to_latlon((lat, lon), 3000.0 + x, 3000.0)) for x in (0, 20, 40)]
    answer = client.post("/stroke-matches", json={"line": away})
    assert answer.status_code == 422, answer.text
    assert answer.json()["error"]["code"] == "shape_not_drawable"
    assert "single road node" in answer.json()["error"]["message"]


def test_a_stroke_in_the_fields_is_matched_and_said_off_the_roads(
    client: TestClient,
) -> None:
    # Points some 400 m from the roads, spread so that their nearest nodes
    # differ: the route runs along the nearest roads, and off_roads is true.
    lat, lon = LINE[0]
    off = [list(local_to_latlon((lat, lon), x, -400.0)) for x in (0, 200, 400, 600)]
    answer = client.post("/stroke-matches", json={"line": off})
    if answer.status_code == 422:  # the fixture may give one node here too
        assert answer.json()["error"]["code"] == "shape_not_drawable"
        return
    match = answer.json()
    assert match["off_roads"] is True
    assert max(match["away_m"]) > 150.0


def test_the_key_is_asked_as_for_every_route() -> None:
    app = create_app(FileSource(LEVICO_GRAPH))
    protect(app, Access(key="a" * 32))
    client = TestClient(app)
    assert client.get("/stroke-matches").status_code == 401
    assert client.post("/stroke-matches", json={"line": LINE}).status_code == 401
    headers = {"X-API-Key": "a" * 32}
    assert client.get("/stroke-matches", headers=headers).status_code == 204
    assert (
        client.post("/stroke-matches", json={"line": LINE}, headers=headers).status_code
        == 200
    )


def test_the_shared_fixtures_are_a_request_and_an_answer() -> None:
    request = json.loads((FIXTURES / "stroke-match-request.json").read_text())
    body = StrokeMatchRequestBody.model_validate(request)
    assert body.from_ == tuple(request["from"])
    assert body.model_dump(by_alias=True).keys() == request.keys()
    answer = json.loads((FIXTURES / "stroke-match.json").read_text())
    match = StrokeMatchBody.model_validate(answer)
    assert len(match.away_m) == len(request["line"])
    assert match.model_dump().keys() == answer.keys()


def test_the_field_from_is_a_keyword_in_python_and_from_on_the_wire() -> None:
    body = StrokeMatchRequestBody(
        line=[(46.0, 11.0), (46.001, 11.0)], **{"from": (46.0, 11.0)}
    )
    assert body.from_ == (46.0, 11.0)
    assert "from" in body.model_dump(by_alias=True)
    assert "from_" not in body.model_dump(by_alias=True)
    with pytest.raises(ValueError):  # a misspelt field, as everywhere
        StrokeMatchRequestBody.model_validate(
            {"line": [[46.0, 11.0], [46.001, 11.0]], "form": [46.0, 11.0]}
        )


def test_a_match_rounds_its_numbers() -> None:
    from route_engine.stroke_match import StrokeMatch

    body = StrokeMatchBody.of(
        StrokeMatch(
            points=[(46.01234567, 11.98765432)], away_m=[12.3456], off_roads=False
        )
    )
    assert body.points == [(46.012346, 11.987654)]
    assert body.away_m == [12.3]
    assert haversine_m(body.points[0], (46.01234567, 11.98765432)) < 0.1


def _unused(point: LatLon) -> LatLon:
    return point
