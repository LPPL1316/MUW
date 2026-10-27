"""POST /kept-routes: the routes already kept, and nothing drawn (TASK-316,
ADR-0276). The bodies are packages/shared-types/fixtures/kept-routes*.json,
read by the shared types' test too."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from route_engine.models import RouteRequest
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan

from shaperoute_api.app import create_app
from shaperoute_api.kept_routes import (
    MAX_REQUESTS,
    KeptRoutesBody,
    install_kept_routes,
)
from shaperoute_api.route_store import RouteStore, result_from
from shaperoute_api.schemas import RouteRequestBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text())


class Planner:
    """The engine: never asked here."""

    def __init__(self) -> None:
        self.asked: list[RouteRequest] = []

    def __call__(self, request: RouteRequest, source: GraphLoader) -> Plan:
        self.asked.append(request)
        raise AssertionError("POST /kept-routes must never draw")


def client(store: RouteStore | None, planner: Planner) -> TestClient:
    app = create_app(
        FileSource(Path("not-there.graphml")), planner=planner, route_store=store
    )
    install_kept_routes(app, store)
    return TestClient(app)


def kept_store(tmp_path: Path) -> RouteStore:
    """The store with the first request of the fixture kept: its centre is
    a city's, and its route is route-result.json."""
    store = RouteStore(tmp_path / "routes", engine="engine-a")
    body = RouteRequestBody.model_validate(
        fixture("kept-routes-request.json")["requests"][0]
    )
    request = RouteRequest(
        start=body.start,
        shape=body.shape,
        distance_m=body.distance_m,
        activity=body.activity,
    )
    store.learn([request.start])
    assert store.put(request, result_from(fixture("route-result.json")))
    return store


def test_the_kept_route_comes_back_and_the_others_are_null(tmp_path: Path) -> None:
    planner = Planner()
    api = client(kept_store(tmp_path), planner)
    answer = api.post("/kept-routes", json=fixture("kept-routes-request.json"))
    assert answer.status_code == 200
    # As the fixture the app's side reads: the heart kept, the word not.
    expected = KeptRoutesBody.model_validate(fixture("kept-routes.json"))
    assert answer.json() == expected.model_dump(mode="json")
    assert planner.asked == []


def test_nothing_is_drawn_nor_a_job_started(tmp_path: Path) -> None:
    planner = Planner()
    api = client(RouteStore(tmp_path / "routes", engine="engine-a"), planner)
    answer = api.post("/kept-routes", json=fixture("kept-routes-request.json"))
    assert answer.json() == {"routes": [None, None]}
    assert planner.asked == []
    # Nothing written either: what is not kept stays so.
    assert list(tmp_path.rglob("*.json")) == []


def test_without_a_store_every_answer_is_null() -> None:
    api = client(None, Planner())
    answer = api.post("/kept-routes", json=fixture("kept-routes-request.json"))
    assert answer.json() == {"routes": [None, None]}


def test_more_requests_than_a_city_has_are_refused(tmp_path: Path) -> None:
    one = fixture("kept-routes-request.json")["requests"][0]
    api = client(RouteStore(tmp_path / "routes", engine="engine-a"), Planner())
    assert api.post("/kept-routes", json={"requests": []}).status_code == 422
    many = {"requests": [one] * (MAX_REQUESTS + 1)}
    assert api.post("/kept-routes", json=many).status_code == 422
    city = {"requests": fixture("city-examples.json")["requests"]}
    assert api.post("/kept-routes", json=city).status_code == 200


def test_an_image_is_refused(tmp_path: Path) -> None:
    image = fixture("image-route-request.json")
    api = client(RouteStore(tmp_path / "routes", engine="engine-a"), Planner())
    assert api.post("/kept-routes", json={"requests": [image]}).status_code == 422


def test_a_request_the_engine_refuses_is_a_422_as_from_route_jobs(
    tmp_path: Path,
) -> None:
    bad = {**fixture("route-request.json"), "shape": None, "word": None}
    api = client(RouteStore(tmp_path / "routes", engine="engine-a"), Planner())
    answer = api.post("/kept-routes", json={"requests": [bad]})
    assert answer.status_code == 422
    assert answer.json()["error"]["code"] == "invalid_request"
