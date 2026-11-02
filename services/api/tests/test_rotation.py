"""How far the shape is turned, over HTTP (TASK-232, ADR-0195): the
engine's `rotation_deg` reaches the app as it is, each alternative its own,
0 for a shape that turns freely; the field is new and optional, so an older
app that ignores it, or sends back a result without it, works as before,
and the GPX does not change."""

from __future__ import annotations

import json
import re
import time
from collections.abc import Iterator
from dataclasses import asdict, replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan

from shaperoute_api.app import create_app
from shaperoute_api.images import AnyRequest
from shaperoute_api.route_store import result_from
from shaperoute_api.schemas import RouteResultBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
HEART = {"start": [46.0671, 11.1214], "shape": "heart", "distance_m": 15000}
START = (46.0671, 11.1214)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def result(rotation_deg: float, east: float = 0.001) -> RouteResult:
    points = [START, (46.0680, 11.1214 + east), START]
    return RouteResult(points, 15_000.0, 0.93, "heart", rotation_deg=rotation_deg)


def client_for(chosen: RouteResult, others: list[RouteResult]) -> TestClient:
    def planner(request: AnyRequest, source: GraphLoader) -> Plan:
        return Plan(chosen, None, alternatives=[Plan(r, None) for r in others])

    return TestClient(create_app(FileSource(Path("unused.graphml")), planner=planner))


@pytest.fixture
def tilted() -> Iterator[TestClient]:
    with client_for(result(30.0), [result(-15.0, 0.002), result(0.0, 0.003)]) as http:
        yield http


def done(client: TestClient) -> dict[str, Any]:
    job_id = client.post("/route-jobs", json=HEART).json()["job_id"]
    deadline = time.monotonic() + 5
    while (body := client.get(f"/route-jobs/{job_id}").json())["status"] != "done":
        assert time.monotonic() < deadline, body
        time.sleep(0.01)
    answer: dict[str, Any] = body["result"]
    return answer


def test_a_job_answers_the_rotation_each_alternative_its_own(
    tilted: TestClient,
) -> None:
    body = done(tilted)
    assert body["rotation_deg"] == 30.0
    assert [other["rotation_deg"] for other in body["alternatives"]] == [-15.0, 0.0]


def test_the_one_go_route_answers_it_too(tilted: TestClient) -> None:
    body = tilted.post("/routes", json=HEART).json()
    assert body["rotation_deg"] == 30.0


def test_an_upright_route_answers_0() -> None:
    upright = RouteResult([START, (46.068, 11.1224), START], 15_000.0, 0.9, "heart")
    with client_for(upright, []) as http:
        assert done(http)["rotation_deg"] == 0.0
        assert http.post("/routes", json=HEART).json()["rotation_deg"] == 0.0


def test_the_fixture_of_the_contract_is_a_valid_body() -> None:
    data = _load("route-result-tilted.json")
    assert set(data) == set(RouteResultBody.model_fields) - {
        "placed_outline"
    }  # TASK-347
    body = RouteResultBody.model_validate(data)
    assert body.rotation_deg == 30.0
    assert [other.rotation_deg for other in body.alternatives] == [0.0]


def test_an_older_app_reads_the_answer_as_before(tilted: TestClient) -> None:
    """Today's app reads the fields it knows and ignores the rest: all of
    them are still there, as they were."""
    body = done(tilted)
    older = _load("route-result-better-distance.json")
    assert set(older) <= set(body)
    assert set(body) - set(older) == {"rotation_deg", "placed_outline"}


def _track(gpx: str) -> str:
    """The GPX without the time it was written."""
    return re.sub(r"<time>[^<]*</time>", "", gpx)


def test_the_gpx_does_not_change_with_the_rotation(tilted: TestClient) -> None:
    answer = done(tilted)
    turned = tilted.post("/gpx", json={"request": HEART, "result": answer})
    assert turned.status_code == 200
    upright = tilted.post(
        "/gpx", json={"request": HEART, "result": {**answer, "rotation_deg": 0.0}}
    )
    older = {k: v for k, v in answer.items() if k != "rotation_deg"}
    without = tilted.post("/gpx", json={"request": HEART, "result": older})
    assert without.status_code == 200
    assert _track(turned.text) == _track(upright.text) == _track(without.text)
    assert turned.text.count("<trkpt") == len(answer["points"])


def test_a_rotation_beyond_half_a_turn_is_refused(tilted: TestClient) -> None:
    answer = done(tilted)
    for wrong in (180.5, -181.0):
        response = tilted.post(
            "/gpx", json={"request": HEART, "result": {**answer, "rotation_deg": wrong}}
        )
        assert response.status_code == 422


def test_a_kept_route_keeps_its_rotation() -> None:
    # The routes kept on the server, like the examples of «Explore», are
    # read back from JSON (route_store.py): a tilted one stays tilted.
    chosen = replace(result(30.0), alternatives=[result(-15.0, 0.002)])
    kept = json.loads(json.dumps(asdict(chosen)))
    again = result_from(kept)
    assert again.rotation_deg == 30.0
    assert [other.rotation_deg for other in again.alternatives] == [-15.0]
    # Kept before TASK-232: upright.
    del kept["rotation_deg"]
    assert result_from(kept).rotation_deg == 0.0


def test_a_kept_route_keeps_its_better_distance() -> None:
    # Before TASK-232 the kept routes lost it: a repeated request came back
    # without «Try N km» (TASK-234, ADR-0197).
    chosen = replace(result(0.0), better_distance_m=12_000)
    chosen = replace(chosen, alternatives=[result(0.0, 0.002)])
    kept = json.loads(json.dumps(asdict(chosen)))
    again = result_from(kept)
    assert again.better_distance_m == 12_000
    assert [other.better_distance_m for other in again.alternatives] == [None]
    del kept["better_distance_m"]  # kept before TASK-234
    assert result_from(kept).better_distance_m is None
