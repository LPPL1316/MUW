"""RouteArchive (TASK-297 part A, ADR-0256): every route kept in a real
PostgreSQL without who asked it, answered again from the same start at
once and from within 100 m along the roads, the most run and kept first;
the files behind it; nothing of an image; the cap. The roads are the
engine's Levico fixture, where a 1 km heart is traced once."""

from __future__ import annotations

import time
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.geo import local_to_latlon
from route_engine.models import RouteRequest, RouteResult
from route_engine.nearby_starts import Nearby, nearby_starts
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan, plan_route
from route_engine.shapes.outline import parse_outline
from test_favorites import FAST_HASHER, _load, signed_up

from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.best_routes import line_key
from shaperoute_api.db import Database
from shaperoute_api.images import ImageRequest
from shaperoute_api.route_archive import (
    RouteArchive,
    count_favorite,
    count_run,
)
from shaperoute_api.route_store import RouteStore

# As the favorites' and the runs' tests name them: 8-40 letters and digits.
FAVORITE_KEY = "3f9a1c0e7b2d4a65"
RUN_KEY = "7c2e91a4b05d3f68"

FIXTURE = (
    Path(__file__).resolve().parent.parent.parent
    / "route-engine"
    / "tests"
    / "fixtures"
    / "levico_walk_1km.graphml"
)
ANYWHERE = (46.0, 11.2, 46.1, 11.4)
LEVICO = (46.0122, 11.2986)
NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)
HEART = RouteRequest(start=LEVICO, shape="heart", distance_m=1000)
HEART_BODY = {"start": list(LEVICO), "shape": "heart", "distance_m": 1000}
SQUARE = parse_outline(
    {
        "name": "square",
        "source": "a test",
        "license": "none",
        "points": [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]],
    }
)


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture(scope="module")
def drawn() -> RouteResult:
    """A 1 km heart from LEVICO on the fixture's roads, traced once: the
    route the engine would keep."""
    return plan_route(HEART, FileSource(FIXTURE), optimize=False).result


@pytest.fixture(scope="module")
def near() -> Nearby:
    """A road node 25-100 m from LEVICO, reachable along the roads."""
    found = nearby_starts(FileSource(FIXTURE).load(ANYWHERE), LEVICO, count=1)
    assert found, "the fixture has no road node near Levico"
    return found[0]


def archive(database: Database, **options: Any) -> RouteArchive:
    options.setdefault("engine", "engine-a")
    return RouteArchive(database, **options)


def rows(database: Database) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return conn.execute(
            "SELECT line_key, runs, favorites FROM drawn_routes ORDER BY id"
        ).fetchall()


def reversed_line(result: RouteResult, similarity: float) -> RouteResult:
    """Another route: the same ring the other way round."""
    return replace(result, points=list(reversed(result.points)), similarity=similarity)


def test_the_same_start_answers_at_once_with_the_alternatives(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    other = reversed_line(drawn, drawn.similarity - 0.1)
    kept = archive(database, clock=clock)
    assert kept.get(HEART) is None
    assert kept.put(HEART, replace(drawn, alternatives=[other])) is True
    assert len(rows(database)) == 2
    # The route and its alternative, read whole, the most similar first.
    assert kept.get(HEART) == replace(drawn, alternatives=[other])
    # Also by an API started later, and from a few metres away.
    moved = replace(HEART, start=local_to_latlon(LEVICO, 5.0, 0.0))
    assert archive(database, clock=clock).get(moved) == replace(
        drawn, alternatives=[other]
    )
    # The same line twice is one row.
    assert kept.put(HEART, drawn) is True
    assert len(rows(database)) == 2


def test_within_a_hundred_metres_the_route_is_reached_along_the_roads(
    database: Database, clock: Clock, drawn: RouteResult, near: Nearby
) -> None:
    kept = archive(database, clock=clock)
    kept.put(HEART, drawn)
    asked = replace(HEART, start=near.point)
    # Not the same start: the roads are needed, so not in the POST.
    assert kept.get(asked) is None
    reached = kept.nearby(asked, FileSource(FIXTURE))
    assert reached is not None
    # Run from the new start to where the route begins, and back the same
    # way: the route closes where it started.
    assert reached.points[0] == near.point and reached.points[-1] == near.point
    assert reached.distance_m == pytest.approx(
        drawn.distance_m + 2 * near.length_m, abs=5.0
    )
    assert len(reached.points) > len(drawn.points)
    assert reached.similarity == drawn.similarity and reached.shape == "heart"
    # The directions are those of the whole line, the start first.
    assert reached.directions and reached.directions[0].turn == "depart"
    assert reached.alternatives == []


def test_beyond_a_hundred_metres_the_engine_draws(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    kept = archive(database, clock=clock)
    kept.put(HEART, drawn)
    far = replace(HEART, start=local_to_latlon(LEVICO, 0.0, 300.0))
    assert kept.get(far) is None
    assert kept.nearby(far, FileSource(FIXTURE)) is None


def test_another_request_engine_or_an_old_route_is_drawn_again(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    kept = archive(database, clock=clock)
    kept.put(HEART, drawn)
    assert kept.get(replace(HEART, distance_m=2000)) is None
    assert kept.get(replace(HEART, shape="circle")) is None
    assert archive(database, engine="engine-b", clock=clock).get(HEART) is None
    clock.now = NOW + timedelta(days=29)
    assert kept.get(HEART) is not None
    clock.now = NOW + timedelta(days=31)
    assert kept.get(HEART) is None


def test_the_most_run_and_kept_goes_first(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    other = reversed_line(drawn, drawn.similarity - 0.1)
    kept = archive(database, clock=clock)
    kept.put(HEART, replace(drawn, alternatives=[other]))
    # A run saved along the less similar line: it goes first, the other
    # becomes the alternative.
    with database.connect() as conn:
        count_run(conn, line_key(other.points))
    answer = kept.get(HEART)
    assert answer is not None
    assert answer.points == other.points
    assert [a.points for a in answer.alternatives] == [drawn.points]
    # A favorite of the other line evens them: the most similar first again.
    with database.connect() as conn:
        count_favorite(conn, line_key(drawn.points), 1)
    answer = kept.get(HEART)
    assert answer is not None and answer.points == drawn.points
    # The favorite removed, and never below zero.
    with database.connect() as conn:
        count_favorite(conn, line_key(drawn.points), -1)
        count_favorite(conn, line_key(drawn.points), -1)
    assert {r["line_key"]: (r["runs"], r["favorites"]) for r in rows(database)} == {
        line_key(drawn.points): (0, 0),
        line_key(other.points): (1, 0),
    }


def test_an_image_and_a_shape_moved_by_hand_are_not_kept(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    kept = archive(database, clock=clock)
    image = ImageRequest(start=LEVICO, outline=SQUARE, distance_m=1000)
    assert kept.put(image, drawn) is False
    moved = RouteRequest(
        start=LEVICO, shape="circle", distance_m=2000, activity="paddling", near=LEVICO
    )
    assert kept.put(moved, drawn) is False
    assert rows(database) == []
    assert kept.get(image) is None and kept.get(moved) is None


def test_a_row_names_no_one(database: Database, clock: Clock) -> None:
    with database.connect() as conn:
        columns = {
            row["column_name"]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns"
                " WHERE table_name = 'drawn_routes'"
            ).fetchall()
        }
    assert "user_id" not in columns
    assert {"start", "route", "result", "line_key", "runs", "favorites"} <= columns


def test_over_the_cap_the_oldest_never_run_go_first(
    database: Database, clock: Clock, drawn: RouteResult
) -> None:
    kept = archive(database, clock=clock, max_routes=2)
    first = drawn
    second = reversed_line(drawn, 0.8)
    third = replace(drawn, points=[*drawn.points[1:], drawn.points[1]], similarity=0.7)
    kept.put(HEART, first)
    clock.now += timedelta(hours=1)
    kept.put(HEART, second)
    clock.now += timedelta(hours=1)
    kept.put(HEART, third)
    assert [r["line_key"] for r in rows(database)] == [
        line_key(second.points),
        line_key(third.points),
    ]
    # A route someone ran stays: the next oldest goes instead.
    with database.connect() as conn:
        count_run(conn, line_key(second.points))
    clock.now += timedelta(hours=1)
    kept.put(HEART, first)
    assert [r["line_key"] for r in rows(database)] == [
        line_key(second.points),
        line_key(first.points),
    ]


def test_the_files_behind_keep_what_they_keep(
    database: Database, clock: Clock, drawn: RouteResult, tmp_path: Path
) -> None:
    files = RouteStore(tmp_path, engine="engine-a")
    kept = archive(database, behind=files, clock=clock)
    kept.learn([LEVICO])  # a city's centre: the files keep routes from it
    assert kept.put(HEART, drawn) is True
    assert len(files) == 1 and len(rows(database)) == 1
    with database.connect() as conn:
        conn.execute("DELETE FROM drawn_routes")
    # No row: the files answer.
    assert kept.get(HEART) == drawn


def finished(client: TestClient, job_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 20
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.02)


def wait_until(check: Any, timeout: float = 5.0) -> None:
    """A job is `done` before its route is kept (jobs.RouteJobs._run): the
    row comes a moment later."""
    deadline = time.monotonic() + timeout
    while not check():
        assert time.monotonic() < deadline, "the archive did not get there in time"
        time.sleep(0.02)


def test_a_second_phone_nearby_gets_the_route_through_the_api(
    database: Database, clock: Clock, near: Nearby
) -> None:
    """The whole way: the first job is drawn and kept; the same request
    from a road node nearby is done from the archive, reached along the
    roads, without the engine; from the same start it is done in the
    POST."""
    planned: list[RouteRequest] = []

    def planner(request: Any, source: GraphLoader) -> Plan:
        planned.append(request)
        return plan_route(request, source, optimize=False)

    kept = archive(database, clock=clock)
    app = create_app(FileSource(FIXTURE), planner=planner, route_store=kept)  # type: ignore[arg-type]
    with TestClient(app) as client:
        first = client.post("/route-jobs", json=HEART_BODY).json()
        drawn = finished(client, first["job_id"])
        assert drawn["status"] == "done", drawn
        wait_until(lambda: len(rows(database)) == 1)
        assert len(planned) == 1

        nearby = {**HEART_BODY, "start": list(near.point)}
        second = client.post("/route-jobs", json=nearby).json()
        reached = finished(client, second["job_id"])
        assert reached["status"] == "done", reached
        assert reached["result"]["points"][0] == list(near.point)
        assert reached["result"]["distance_m"] > drawn["result"]["distance_m"]
        assert reached["result"]["directions"]
        assert len(planned) == 1  # the engine did not run

        again = client.post("/route-jobs", json=HEART_BODY).json()
        assert again["status"] == "done" and again["result"] == drawn["result"]
        assert len(planned) == 1
        assert len(rows(database)) == 1  # the reached route is not kept again


def test_a_favorite_and_a_run_saved_count_on_the_archived_line(
    database: Database, clock: Clock
) -> None:
    """The counters come from the app's own requests: a favorite kept and
    removed, a run saved along a route, each by the line's name."""
    favorite = _load("favorite-request.json")
    run = _load("activity-request.json")
    assert favorite["points"] and run["points"]
    kept = archive(database, clock=clock)
    for body in (favorite, run):
        points = [(float(lat), float(lon)) for lat, lon in body["points"]]
        drawn = RouteResult(
            points=points, distance_m=5000.0, similarity=0.9, shape="heart"
        )
        kept.put(RouteRequest(start=points[0], shape="heart", distance_m=5000), drawn)
    kept_lines = {line_key(body["points"]) for body in (favorite, run)}
    assert {r["line_key"] for r in rows(database)} == kept_lines

    def counted() -> dict[str, tuple[int, int]]:
        return {r["line_key"]: (r["runs"], r["favorites"]) for r in rows(database)}

    accounts = Accounts(database, now=clock, hasher=FAST_HASHER)
    client = TestClient(create_app(FileSource(FIXTURE), accounts=accounts))
    me = signed_up(client)
    kept_favorite = client.put(
        f"/me/favorites/{FAVORITE_KEY}", json=favorite, headers=me
    )
    assert kept_favorite.status_code == 201, kept_favorite.text
    assert counted()[line_key(favorite["points"])] == (0, 1)
    assert client.delete(f"/me/favorites/{FAVORITE_KEY}", headers=me).status_code == 204
    assert counted()[line_key(favorite["points"])] == (0, 0)
    saved = client.put(f"/me/activities/{RUN_KEY}", json=run, headers=me)
    assert saved.status_code == 201, saved.text
    assert counted()[line_key(run["points"])] == (1, 0)
