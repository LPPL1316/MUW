"""A drawing left where it was drawn (TASK-347 part A, ADR-0300) through
the API: the fields `placement` and `fit` on the requests, the engine's
AnchoredRouteRequest and ImageRequest behind them, the planner without a
search, the `placed_outline` on the bodies in both placements, and what the
stores never keep. On the Levico fixture, no network."""

from __future__ import annotations

import json
import time
from dataclasses import fields, replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.anchored import ANCHORED_ON_LAND_ONLY, FIT_WITH_ANCHORED_ONLY
from route_engine.geo import haversine_m
from route_engine.models import InvalidRequestError, RouteRequest, RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan, plan_shape
from route_engine.shapes import get_shape
from route_engine.water import FileWaterSource

from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app, to_request
from shaperoute_api.images import (
    AnchoredRouteRequest,
    AnyRequest,
    ImageRequest,
    placed_outline_of,
    placed_outlines,
    placement_of,
    plan_anchored,
    plan_request,
    route_request_of,
)
from shaperoute_api.route_archive import _kept
from shaperoute_api.route_store import RouteStore
from shaperoute_api.schemas import (
    ImageRouteRequestBody,
    RouteRequestBody,
    RouteResultBody,
)

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"
WATER_FIXTURE = REPO / "services/route-engine/tests/fixtures/water_coast.json"
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
LEVICO = [46.0122, 11.2986]
CIRCLE = {"start": LEVICO, "shape": "circle", "distance_m": 1500, "activity": "running"}
TRIANGLE = [[-1.0, -0.8], [1.0, -0.8], [0.0, 0.9], [-1.0, -0.8]]
IMAGE = {
    "start": LEVICO,
    "outline": TRIANGLE,
    "distance_m": 1500,
    "activity": "running",
}


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_the_body_becomes_the_engines_request_or_an_anchored_one() -> None:
    free = to_request(RouteRequestBody(**CIRCLE))
    assert type(free) is RouteRequest and placement_of(free) == "free"
    anchored = to_request(RouteRequestBody(**CIRCLE, placement="anchored", fit=0.4))
    assert isinstance(anchored, AnchoredRouteRequest)
    assert isinstance(anchored, RouteRequest)  # a RouteRequest everywhere else
    assert anchored.fit == 0.4 and placement_of(anchored) == "anchored"
    assert anchored.name == "circle" and anchored.distance_m == 1500
    # The phone's own to_request gives the same (on_phone.to_request).
    assert route_request_of(
        RouteRequestBody(**CIRCLE, placement="anchored")
    ) == replace(anchored, fit=None)
    image = to_request(ImageRouteRequestBody(**IMAGE, placement="anchored", fit=0.3))
    assert isinstance(image, ImageRequest)
    assert image.placement == "anchored" and image.fit == 0.3
    assert placement_of(to_request(ImageRouteRequestBody(**IMAGE))) == "free"


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"fit": 0.5}, FIT_WITH_ANCHORED_ONLY),
        ({"placement": "glued"}, "unknown placement"),
        ({"placement": "anchored", "fit": 7}, "fit must be between 0 and 1"),
        ({"placement": "anchored", "activity": "paddling"}, ANCHORED_ON_LAND_ONLY),
    ],
)
def test_a_placement_out_of_the_rules_is_refused(
    changes: dict[str, Any], message: str
) -> None:
    body = {**CIRCLE, "distance_m": 2000, **changes}
    with pytest.raises(InvalidRequestError, match=message):
        to_request(RouteRequestBody(**body))
    # An image is refused on the water before its placement is looked at.
    on_image = "not an image" if changes.get("activity") == "paddling" else message
    with pytest.raises(InvalidRequestError, match=on_image):
        to_request(ImageRouteRequestBody(**{**IMAGE, "distance_m": 2000, **changes}))
    # Over the wire: 422 invalid_request, the message of the engine.
    graphs = ActivityGraphs({}, water=FileWaterSource(WATER_FIXTURE))
    client = TestClient(create_app(graphs))
    answer = client.post("/routes", json=body)
    assert answer.status_code == 422, answer.text
    assert answer.json()["error"]["code"] == "invalid_request"
    assert message.split("'")[0] in answer.json()["error"]["message"]


def test_an_anchored_route_on_the_levico_graph_says_where_it_was_placed() -> None:
    # The only real runs of the engine here: one tracing each, no search.
    client = TestClient(create_app(FileSource(LEVICO_GRAPH)))
    answer = client.post(
        "/routes", json={**CIRCLE, "placement": "anchored", "fit": 0.5}
    )
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert set(body) == {f.name for f in fields(RouteResult)} | {"placed_outline"}
    assert body["shape"] == "circle" and body["rotation_deg"] == 0.0
    assert body["alternatives"] == []  # no nearby starts: where it was drawn
    assert body["better_distance_m"] is None
    (line,) = body["placed_outline"]
    assert line[0] == line[-1]  # the circle, closed
    assert haversine_m(tuple(line[0]), tuple(LEVICO)) < 1e-6  # its first point
    assert len(line) == 65
    # The drawing is 1.5 km; the roads make what they make, and say so when
    # off by more than 10%.
    off = [w for w in body["warnings"] if "not rescaled" in w]
    assert len(off) == (1 if abs(body["distance_m"] - 1500) > 150 else 0)


def test_an_anchored_image_is_traced_where_it_was_drawn() -> None:
    client = TestClient(create_app(FileSource(LEVICO_GRAPH)))
    answer = client.post("/image-route-jobs", json={**IMAGE, "placement": "anchored"})
    assert answer.status_code == 202, answer.text
    job_id = answer.json()["job_id"]
    deadline = time.monotonic() + 30
    while True:
        job = client.get(f"/route-jobs/{job_id}").json()
        if job["status"] in ("done", "failed") or time.monotonic() > deadline:
            break
        time.sleep(0.05)
    assert job["status"] == "done", job
    result = job["result"]
    assert result["shape"] is None and result["word"] is None
    (line,) = result["placed_outline"]
    assert len(line) == 65 and line[0] == line[-1]
    assert haversine_m(tuple(line[0]), tuple(LEVICO)) < 1e-6
    # Directions come from the route's own nodes, with no search (TASK-347).
    assert result["directions"] and result["directions"][0]["turn"] == "depart"


def test_a_free_route_says_where_the_search_put_the_shape() -> None:
    # A planner with a real search on the fixture: the placed outline is the
    # shape where the search left it, for the route and each alternative.
    source = FileSource(LEVICO_GRAPH)
    request = RouteRequest(start=tuple(LEVICO), shape="circle", distance_m=1500)
    plan = plan_shape(get_shape("circle")(64), "circle", request.start, 1500, source)
    assert plan.search is not None
    (line,) = placed_outline_of(plan, request)
    assert line == list(plan.search.best.shape)
    other = replace(plan, alternatives=[plan])
    assert placed_outlines(other, request) == [[line], [line]]
    # Without a search and without an anchored plan (a fake planner, the
    # archive): nothing is known of the placement.
    bare = Plan(result=plan.result, search=None)
    assert placed_outline_of(bare, request) == []


def test_the_body_of_a_route_carries_the_placed_outline_of_its_plan() -> None:
    asked: list[AnyRequest] = []
    result = RouteResult(
        points=[(46.0, 11.0), (46.001, 11.0), (46.0, 11.0)],
        distance_m=1500.0,
        similarity=0.9,
        shape="circle",
    )

    def planner(request: AnyRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=result, search=None)

    client = TestClient(create_app(FileSource(LEVICO_GRAPH), planner=planner))
    body = client.post("/routes", json={**CIRCLE, "placement": "anchored"}).json()
    assert isinstance(asked[0], AnchoredRouteRequest)
    assert body["placed_outline"] == []  # a plan that says nothing of it
    RouteResultBody.model_validate(body)


def test_the_anchored_planner_traces_once_and_names_as_the_free_one() -> None:
    source = FileSource(LEVICO_GRAPH)
    shape = plan_anchored(
        AnchoredRouteRequest(start=tuple(LEVICO), shape="circle", distance_m=1500),
        source,
    )
    assert shape.search is None and shape.result.shape == "circle"
    assert shape.nodes and shape.placed
    word = plan_request(
        AnchoredRouteRequest(
            start=tuple(LEVICO), word="IL", distance_m=6000, fit=0.5, pen_up=True
        ),
        source,
    )
    assert word.result.shape is None and word.result.word == "IL"
    assert len(word.result.walks) == 1
    request = AnchoredRouteRequest(
        start=tuple(LEVICO), word="IL", distance_m=6000, fit=0.5, pen_up=True
    )
    lines = placed_outline_of(word, request)
    assert len(lines) == 2  # one line per letter


def test_an_anchored_drawing_is_never_kept_by_the_stores(tmp_path: Path) -> None:
    request = AnchoredRouteRequest(start=tuple(LEVICO), shape="circle", distance_m=1500)
    free = RouteRequest(start=tuple(LEVICO), shape="circle", distance_m=1500)
    store = RouteStore(tmp_path)
    store.learn([tuple(LEVICO)])
    result = RouteResult(
        points=[(46.0, 11.0), (46.001, 11.0), (46.0, 11.0)],
        distance_m=1500.0,
        similarity=0.9,
        shape="circle",
    )
    assert store.put(free, result)
    assert store.get(free) is not None
    assert not store.put(request, result)
    assert store.get(request) is None  # nor answered with the free one's
    assert _kept(free) and not _kept(request)


def test_the_shared_fixtures_are_valid_bodies() -> None:
    request = _load("route-request-anchored.json")
    body = RouteRequestBody.model_validate(request)
    assert body.placement == "anchored" and body.fit == 0.5
    assert isinstance(to_request(body), AnchoredRouteRequest)
    image = _load("image-route-request-anchored.json")
    assert ImageRouteRequestBody.model_validate(image).placement == "anchored"
    result = _load("route-result-anchored.json")
    assert set(result) == set(RouteResultBody.model_fields)
    assert RouteResultBody.model_validate(result).placed_outline
