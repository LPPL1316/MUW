"""POST, GET and DELETE /route-jobs over HTTP (docs/API.md, ADR-0032)."""

from __future__ import annotations

import time
from collections.abc import Iterator
from dataclasses import fields
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteRequest, RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan, ShapeNotDrawableError

from shaperoute_api.app import create_app

HEART = {"start": [46.0671, 11.1214], "shape": "heart", "distance_m": 5000}
RESULT = RouteResult(
    points=[(46.0671, 11.1214), (46.0680, 11.1220), (46.0671, 11.1214)],
    distance_m=5100.0,
    similarity=0.9,
    shape="heart",
    warnings=["120 m of the route on steps"],
)


def answering(outcome: RouteResult | Exception):  # type: ignore[no-untyped-def]
    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        if isinstance(outcome, Exception):
            raise outcome
        return Plan(result=outcome, search=None)

    return planner


@pytest.fixture
def client_for() -> Iterator[Any]:
    clients: list[TestClient] = []

    def make(outcome: RouteResult | Exception) -> TestClient:
        app = create_app(FileSource(Path("unused.graphml")), planner=answering(outcome))
        client = TestClient(app)
        client.__enter__()  # runs the lifespan, which stops the workers after
        clients.append(client)
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)


def finished(client: TestClient, job_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.01)


def test_a_job_is_accepted_at_once_and_ends_with_the_route(client_for: Any) -> None:
    client = client_for(RESULT)
    response = client.post("/route-jobs", json=HEART)
    assert response.status_code == 202
    job = response.json()
    assert set(job) == {"job_id", "status", "result", "error"}
    assert job["status"] in ("queued", "computing", "done")

    body = finished(client, job["job_id"])
    assert body["status"] == "done"
    assert body["error"] is None
    # The API adds where the drawing was placed (TASK-347): the engine has not.
    assert set(body["result"]) == {f.name for f in fields(RouteResult)} | {
        "placed_outline"
    }
    assert body["result"]["warnings"] == ["120 m of the route on steps"]


def test_a_failed_job_carries_the_error(client_for: Any) -> None:
    client = client_for(ShapeNotDrawableError("a 5 km heart cannot be drawn here"))
    job = client.post("/route-jobs", json=HEART).json()
    body = finished(client, job["job_id"])
    assert body == {
        "job_id": job["job_id"],
        "status": "failed",
        "result": None,
        "error": {
            "code": "shape_not_drawable",
            "message": "a 5 km heart cannot be drawn here",
            "suggested_distance_m": None,
            "reason": None,
        },
    }


def test_an_invalid_request_is_refused_before_it_becomes_a_job(
    client_for: Any,
) -> None:
    client = client_for(RESULT)
    response = client.post("/route-jobs", json={**HEART, "distance_m": 100})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_an_unknown_job_is_a_404(client_for: Any) -> None:
    client = client_for(RESULT)
    for response in (
        client.get("/route-jobs/nothing"),
        client.delete("/route-jobs/nothing"),
    ):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "http_error"


def test_delete_forgets_the_job(client_for: Any) -> None:
    client = client_for(RESULT)
    job = client.post("/route-jobs", json=HEART).json()
    assert client.delete(f"/route-jobs/{job['job_id']}").status_code == 204
    assert client.get(f"/route-jobs/{job['job_id']}").status_code == 404


def test_post_routes_still_answers_in_one_go(client_for: Any) -> None:
    client = client_for(RESULT)
    response = client.post("/routes", json=HEART)
    assert response.status_code == 200
    assert response.json()["distance_m"] == 5100.0


def test_a_word_becomes_a_job_whose_result_names_the_word() -> None:
    # The engine gets the word, and the result says it is one (TASK-056).
    asked: list[RouteRequest] = []
    word = RouteResult(
        points=RESULT.points,
        distance_m=15100.0,
        similarity=0.97,
        shape=None,
        word="CIAO",
    )

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=word, search=None)

    app = create_app(FileSource(Path("unused.graphml")), planner=planner)
    ciao = {"start": [46.0671, 11.1214], "word": "ciao", "distance_m": 15000}
    with TestClient(app) as client:
        job = client.post("/route-jobs", json=ciao)
        assert job.status_code == 202
        done = finished(client, job.json()["job_id"])
    assert done["status"] == "done"
    assert done["result"]["shape"] is None
    assert done["result"]["word"] == "CIAO"
    assert asked[0].word == "ciao"
    assert asked[0].shape is None
