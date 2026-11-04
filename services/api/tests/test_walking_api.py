"""A walk in the API (TASK-371 part A, ADR-0315): a `walking` request is
1-30 km and the engine draws it as a run, on the foot network and its zones
already in memory; its errors suggest a walk's distance; its GPX says
"walking"; a walk saved goes to Strava as a "Walk". The database takes it in
the three tables that check the activity.

No network: the planner is a stand-in that says which network it was given.
"""

from __future__ import annotations

import json
import shutil
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, get_args

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from route_engine.models import InvalidRequestError
from route_engine.network import BIKE_NETWORK_NAME, FOOT_NETWORK_NAME
from route_engine.optimizer import ShapeNotDrawableError
from route_engine.walking import (
    API_ACTIVITIES,
    API_DISTANCE_LIMITS_M,
    WALK_DISTANCE_M,
    drawn_as,
    engine_activity,
)
from test_cycling import RESULT, TOWN, Network, finished, loading, two_networks

from shaperoute_api.activities import RunActivity
from shaperoute_api.activity_graphs import ActivityGraphs, check_supported
from shaperoute_api.app import create_app
from shaperoute_api.db import Database, migrations
from shaperoute_api.errors import suggested_distance
from shaperoute_api.run_gpx import run_gpx, with_type
from shaperoute_api.schemas import RouteRequestBody
from shaperoute_api.strava import SPORT_TYPES
from shaperoute_api.stroke_matches import StrokeMatchRequestBody

REPO = Path(__file__).resolve().parents[3]
CONTRACT = REPO / "packages" / "shared-types" / "fixtures"
NS = {"g": "http://www.topografix.com/GPX/1/1"}
WHEN = datetime(2026, 11, 4, 9, 0, tzinfo=UTC)
WALK_HEART: dict[str, Any] = {
    "start": list(TOWN),
    "shape": "heart",
    "distance_m": 5_000,
    "activity": "walking",
}


# --- the contract ----------------------------------------------------------------


def test_walking_is_an_activity_of_the_api_with_its_distances() -> None:
    check_supported("walking")
    assert API_ACTIVITIES[-1] == "walking"
    assert WALK_DISTANCE_M == (1_000, 30_000)
    assert API_DISTANCE_LIMITS_M["walking"] == WALK_DISTANCE_M
    contract = json.loads((CONTRACT / "contract.json").read_text())
    assert contract["activities"] == list(API_ACTIVITIES)
    assert contract["distance_limits_m"]["walking"] == [1_000, 30_000]
    request = json.loads((CONTRACT / "route-request-walking.json").read_text())
    assert RouteRequestBody.model_validate(request).activity == "walking"


def test_a_walk_is_drawn_as_a_run_and_nothing_else_changes() -> None:
    assert engine_activity("walking", 5_000) == "running"
    assert drawn_as("walking") == "running"
    for other in ("running", "cycling", "paddling", "swimming"):
        assert engine_activity(other, 12_000) == other
        assert drawn_as(other) == other


@pytest.mark.parametrize("distance", [999, 30_001, 50_000])
def test_a_walk_is_one_km_to_thirty(distance: int) -> None:
    with pytest.raises(InvalidRequestError, match="1000 and 30000 metres for walking"):
        engine_activity("walking", distance)


# --- where it is drawn ------------------------------------------------------------


def test_a_walk_goes_on_the_foot_network_of_a_run() -> None:
    graphs, foot, bike = two_networks()
    seen: list[tuple[str, str]] = []
    client = TestClient(create_app(graphs, planner=loading(RESULT, seen)))
    response = client.post("/routes", json=WALK_HEART)
    assert response.status_code == 200, response.json()
    # The engine is asked for a run: the routes kept are the same.
    assert seen == [("running", FOOT_NETWORK_NAME)]
    assert foot.asked and bike.asked == []


def test_a_walk_job_is_drawn_as_a_run_too() -> None:
    graphs, _, _ = two_networks()
    seen: list[tuple[str, str]] = []
    with TestClient(create_app(graphs, planner=loading(RESULT, seen))) as client:
        job = client.post("/route-jobs", json=WALK_HEART).json()
        assert finished(client, job["job_id"])["status"] == "done"
    assert seen == [("running", FOOT_NETWORK_NAME)]


def test_the_graphs_of_a_walk_are_those_of_a_run() -> None:
    foot, bike = Network(FOOT_NETWORK_NAME), Network(BIKE_NETWORK_NAME)
    graphs = ActivityGraphs({"running": foot, "cycling": bike})
    assert graphs.for_activity("walking") is foot


@pytest.mark.parametrize("distance", [500, 31_000])
def test_a_walk_out_of_its_distances_is_refused(distance: int) -> None:
    graphs, _, _ = two_networks()
    client = TestClient(create_app(graphs, planner=loading(RESULT, [])))
    answer = client.post("/routes", json={**WALK_HEART, "distance_m": distance})
    assert answer.status_code == 422
    assert answer.json()["error"]["code"] == "invalid_request"
    assert "for walking" in answer.json()["error"]["message"]


@pytest.mark.parametrize(
    ("best_m", "suggested"), [(8_400.0, 8_000), (34_000.0, 30_000), (600.0, 1_000)]
)
def test_a_walk_that_misses_its_distance_suggests_a_walk(
    best_m: float, suggested: int
) -> None:
    assert suggested_distance(best_m, "walking") == suggested
    graphs, _, _ = two_networks()
    refused = ShapeNotDrawableError("cannot be drawn here", best_m)
    body = {**WALK_HEART, "distance_m": 20_000}
    with TestClient(create_app(graphs, planner=loading(refused, []))) as client:
        answer = client.post("/routes", json=body)
        assert answer.status_code == 422
        assert answer.json()["error"]["suggested_distance_m"] == suggested
        job = finished(client, client.post("/route-jobs", json=body).json()["job_id"])
        assert job["error"]["suggested_distance_m"] == suggested


def test_a_stroke_of_a_walk_is_matched_as_a_run() -> None:
    line = [[46.0122, 11.2986], [46.0130, 11.2990]]
    body = StrokeMatchRequestBody.model_validate({"line": line, "activity": "walking"})
    assert body.activity == "walking"
    with pytest.raises(ValidationError):
        StrokeMatchRequestBody.model_validate({"line": line, "activity": "skating"})


# --- the GPX and Strava -----------------------------------------------------------


def _types(document: str | bytes) -> list[str | None]:
    root = ET.fromstring(document)
    return [trk.findtext("g:type", namespaces=NS) for trk in root.findall("g:trk", NS)]


def test_the_gpx_of_a_walk_says_walking_after_the_name() -> None:
    graphs, _, _ = two_networks()
    client = TestClient(
        create_app(graphs, planner=loading(RESULT, []), now=lambda: WHEN)
    )
    result = client.post("/routes", json=WALK_HEART).json()
    gpx = client.post("/gpx", json={"request": WALK_HEART, "result": result})
    assert gpx.status_code == 200
    assert _types(gpx.content) == ["walking"]
    trk = ET.fromstring(gpx.content).find("g:trk", NS)
    assert trk is not None
    assert [child.tag.split("}")[1] for child in trk][:3] == ["name", "type", "trkseg"]
    assert len(ET.fromstring(gpx.content).findall(".//g:trkpt", NS)) == 3


def test_the_gpx_of_a_run_says_running() -> None:
    graphs, _, _ = two_networks()
    client = TestClient(
        create_app(graphs, planner=loading(RESULT, []), now=lambda: WHEN)
    )
    run = {**WALK_HEART, "activity": "running"}
    result = client.post("/routes", json=run).json()
    gpx = client.post("/gpx", json={"request": run, "result": result})
    assert _types(gpx.content) == ["running"]


def test_with_type_keeps_the_rest_of_the_document() -> None:
    plain = run_gpx([(46.0, 11.0, 0.0), (46.001, 11.0, 30.0)], [], WHEN, "Heart")
    typed = with_type(plain, "walking")
    assert _types(plain) == [None] and _types(typed) == ["walking"]
    assert typed.replace("    <type>walking</type>\n", "") == plain


def test_a_walk_saved_has_its_type_and_goes_to_strava_as_a_walk() -> None:
    gpx = run_gpx(
        [(46.0, 11.0, 0.0), (46.001, 11.0, 30.0)], [], WHEN, "Heart", "walking"
    )
    assert _types(gpx) == ["walking"]
    assert _types(run_gpx([(46.0, 11.0, 0.0)], [], WHEN)) == [None]
    assert SPORT_TYPES["walking"] == "Walk"
    assert set(SPORT_TYPES) == set(API_ACTIVITIES)
    assert set(get_args(RunActivity)) == set(API_ACTIVITIES)


# --- the migration ----------------------------------------------------------------


def test_the_migration_lets_the_three_tables_keep_a_walk(
    database_url: str, tmp_path: Path
) -> None:
    database = Database(database_url)
    walk = [path for path in migrations() if path.name == "0043_walking.sql"]
    assert len(walk) == 1
    for path in migrations():
        if path not in walk:
            shutil.copy(path, tmp_path / path.name)
    assert "0043_walking" not in database.migrate(tmp_path)
    shutil.copy(walk[0], tmp_path / walk[0].name)
    assert database.migrate(tmp_path) == ["0043_walking"]
    assert database.migrate(tmp_path) == []
    with database.connect() as conn:
        checks = conn.execute(
            "SELECT pg_get_constraintdef(oid) AS check FROM pg_constraint"
            " WHERE conname IN ('favorites_activity_check', 'runs_activity_check',"
            " 'group_runs_activity_check')"
        ).fetchall()
    assert len(checks) == 3
    assert all(
        "walking" in row["check"] and "swimming" in row["check"] for row in checks
    )
