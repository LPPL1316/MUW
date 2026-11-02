"""The distance where the shape comes out better, over HTTP (TASK-234,
ADR-0197): the engine's `better_distance_m` reaches the app as it is, null
without one; the field is new and optional, so an older app that ignores
it, or sends back a result without it, works as before."""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan

from shaperoute_api.app import create_app
from shaperoute_api.images import AnyRequest
from shaperoute_api.schemas import RouteResultBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
HEART = {"start": [46.0671, 11.1214], "shape": "heart", "distance_m": 15000}
START = (46.0671, 11.1214)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def result(better_m: int | None, east: float = 0.001) -> RouteResult:
    points = [START, (46.0680, 11.1214 + east), START]
    return RouteResult(points, 15_000.0, 0.84, "heart", better_distance_m=better_m)


def client_for(chosen: RouteResult, others: list[RouteResult]) -> TestClient:
    def planner(request: AnyRequest, source: GraphLoader) -> Plan:
        return Plan(chosen, None, alternatives=[Plan(r, None) for r in others])

    return TestClient(create_app(FileSource(Path("unused.graphml")), planner=planner))


@pytest.fixture
def advised() -> Iterator[TestClient]:
    with client_for(result(12_000), [result(None, 0.002)]) as http:
        yield http


def done(client: TestClient) -> dict[str, Any]:
    job_id = client.post("/route-jobs", json=HEART).json()["job_id"]
    deadline = time.monotonic() + 5
    while (body := client.get(f"/route-jobs/{job_id}").json())["status"] != "done":
        assert time.monotonic() < deadline, body
        time.sleep(0.01)
    answer: dict[str, Any] = body["result"]
    return answer


def test_a_job_answers_the_better_distance(advised: TestClient) -> None:
    body = done(advised)
    assert body["better_distance_m"] == 12_000
    assert [other["better_distance_m"] for other in body["alternatives"]] == [None]


def test_the_one_go_route_answers_it_too(advised: TestClient) -> None:
    body = advised.post("/routes", json=HEART).json()
    assert body["better_distance_m"] == 12_000


def test_without_advice_the_field_is_null() -> None:
    with client_for(result(None), []) as http:
        body = done(http)
        assert "better_distance_m" in body
        assert body["better_distance_m"] is None
        assert http.post("/routes", json=HEART).json()["better_distance_m"] is None


def test_the_fixture_of_the_contract_is_a_valid_body() -> None:
    data = _load("route-result-better-distance.json")
    # Every field of its day: the rotation came after (TASK-232).
    # Without the fields of TASK-232 and TASK-347, which came after.
    assert set(data) == set(RouteResultBody.model_fields) - {
        "rotation_deg",
        "placed_outline",
    }
    body = RouteResultBody.model_validate(data)
    assert body.better_distance_m == 12_000
    assert [other.better_distance_m for other in body.alternatives] == [None]


def test_an_older_app_reads_the_answer_as_before(advised: TestClient) -> None:
    """Today's app reads the fields it knows and ignores the rest: all of
    them are still there, as they were."""
    body = done(advised)
    older = _load("route-result.json")
    assert set(older) <= set(body)
    # `centre` since TASK-238: null on the roads; `rotation_deg` since
    # TASK-232.
    assert set(body) - set(older) == {
        "walks",
        "on_foot",
        "better_distance_m",
        "centre",
        "rotation_deg",
        "placed_outline",  # TASK-347
    }


def test_the_gpx_takes_the_result_back_with_or_without_the_field(
    advised: TestClient,
) -> None:
    answer = done(advised)
    with_field = advised.post("/gpx", json={"request": HEART, "result": answer})
    assert with_field.status_code == 200
    older = {k: v for k, v in answer.items() if k != "better_distance_m"}
    without = advised.post("/gpx", json={"request": HEART, "result": older})
    assert without.status_code == 200
    assert without.text.count("<trkpt") == with_field.text.count("<trkpt")
