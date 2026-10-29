"""Runs added from another app's file (TASK-312 part A, ADR-0272,
docs/IMPORTAZIONI.md): saved with the file's times, once; worth nothing to
the shape game, its teams' challenges and the contest; never sent to
Strava; and every answer says where the run comes from. The database is a
real PostgreSQL; the bodies are the examples of
packages/shared-types/fixtures, the `*-imported.json` ones."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from route_engine.network import FileSource
from test_contests import DURING, ENDS, STARTS
from test_game_api import SIX_KM, run_body, save
from test_game_backfill import forget_the_game
from test_game_challenges import challenge_of, hold, pieces_of, read, two
from test_push import FAST_HASHER, FakeExpo, signed_up
from test_strava import (
    CLIENT_ID,
    CLIENT_SECRET,
    DOMAIN,
    TRENTO,
    FakeStrava,
    WallClock,
    connected,
)

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import (
    ActivitiesBody,
    ActivityBody,
    ActivityDetailBody,
    ActivityRequestBody,
    PlaceNames,
)
from shaperoute_api.app import create_app
from shaperoute_api.contests import Contests
from shaperoute_api.db import Database, migrations
from shaperoute_api.drawings import DrawingDetailBody, MyDrawingBody
from shaperoute_api.expo_push import Expo
from shaperoute_api.feed import FeedBody, FeedPostBody
from shaperoute_api.game_backfill import backfill
from shaperoute_api.push import Pusher
from shaperoute_api.strava import IMPORTED
from shaperoute_api.strava_client import Strava

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
KEY = "f1a2b3c4d5e6f708"
MUW_KEY = "0a1b2c3d4e5f6071"
# The examples written before TASK-312: an older API's answers and an older
# app's requests, kept as they were.
BEFORE = [
    "activity-request.json",
    "activities.json",
    "activity.json",
    "my-drawing-details.json",
    "drawing-details.json",
    "drawings-details.json",
    "feed.json",
]
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def wall() -> WallClock:
    """The API's clock, in the first contest."""
    clock = WallClock()
    clock.t = DURING
    return clock


@pytest.fixture
def fake(wall: WallClock) -> FakeStrava:
    return FakeStrava(wall)


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def client(
    database: Database, wall: WallClock, fake: FakeStrava, expo: FakeExpo
) -> TestClient:
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
        run_places=PlaceNames("test-key", fetch=lambda _: {"results": [TRENTO]}),
        strava=Strava(
            CLIENT_ID, CLIENT_SECRET, DOMAIN, send=fake, wait=fake.sleeps.append
        ),
    )
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


def imported(**changes: Any) -> dict[str, Any]:
    """The example file run: a loop in Trento, a year before the clock."""
    return {**_load("activity-request-imported.json"), **changes}


def recorded_free(**changes: Any) -> dict[str, Any]:
    """The example run of the app, without its route."""
    run = _load("activity-request.json")
    return {**run, "points": None, "similarity": None, "shape": None, **changes}


def saved(client: TestClient, me: Headers, body: dict[str, Any], key: str) -> Any:
    answer = client.put(f"/me/activities/{key}", json=body, headers=me)
    assert answer.status_code == 201, answer.text
    return answer.json()


def published(client: TestClient, me: Headers, key: str, title: str) -> str:
    """The run's drawing, for everyone now: its id."""
    answer = client.put(
        f"/me/activities/{key}/drawing",
        json={"title": title, "visibility": "everyone"},
        headers=me,
    )
    assert answer.status_code == 200, answer.text
    return str(answer.json()["id"])


def sources(database: Database) -> dict[str, str]:
    with database.connect() as conn:
        return {
            row["key"]: row["source"]
            for row in conn.execute("SELECT key, source FROM runs").fetchall()
        }


def game_tables(database: Database) -> dict[str, int]:
    """How many rows each table of the game has."""
    with database.connect() as conn:
        names = [
            row["table_name"]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.tables"
                " WHERE table_schema = current_schema()"
                " AND table_name LIKE 'game\\_%' ORDER BY table_name"
            ).fetchall()
        ]
        counts = {}
        for name in names:
            row = conn.execute(f"SELECT count(*) AS n FROM {name}").fetchone()
            assert row is not None
            counts[name] = int(row["n"])
    return counts


def as_example(answer: dict[str, Any], example: dict[str, Any]) -> dict[str, Any]:
    """A drawing answered, with the ids made at random taken from the
    example."""
    same = {**answer, "id": example["id"]}
    if "author" in answer:
        same["author"] = {
            **answer["author"],
            "public_id": example["author"]["public_id"],
        }
    return same


# --- The contract, without a database ---


def test_the_migration_is_there() -> None:
    assert "0034_run_source.sql" in [path.name for path in migrations()]


def test_the_examples_are_the_bodies() -> None:
    request = _load("activity-request-imported.json")
    # A file has no route: its request is that of a free run, with `source`.
    assert set(request) == (
        set(ActivityRequestBody.model_fields) - {"walks", "rotation_deg"}
    )
    assert ActivityRequestBody.model_validate(request).source == "file"
    listed = _load("activities-imported.json")
    assert set(listed["activities"][0]) == set(ActivityBody.model_fields)
    assert ActivitiesBody.model_validate(listed).activities[0].source == "file"
    whole = _load("activity-imported.json")
    assert set(whole) == set(ActivityDetailBody.model_fields)
    assert ActivityDetailBody.model_validate(whole).source == "file"
    mine = _load("my-drawing-imported.json")
    assert set(mine) == set(MyDrawingBody.model_fields)
    assert MyDrawingBody.model_validate(mine).source == "file"
    one = _load("drawing-details-imported.json")
    assert set(one) == set(DrawingDetailBody.model_fields)
    assert DrawingDetailBody.model_validate(one).source == "file"
    page = _load("feed-imported.json")
    assert set(page["posts"][0]) == set(FeedPostBody.model_fields)
    assert FeedBody.model_validate(page).posts[0].source == "file"
    # The same run in each.
    assert mine["id"] == one["id"] == page["posts"][0]["id"]
    assert (
        one["started_at"]
        == whole["started_at"]
        == listed["activities"][0]["started_at"]
    )


def test_the_examples_of_before_say_nothing_of_it() -> None:
    for name in BEFORE:
        assert '"source"' not in (FIXTURES / name).read_text(encoding="utf-8"), name
    # An older app's request and an older API's answer: runs of the app.
    older = ActivityRequestBody.model_validate(_load("activity-request.json"))
    assert older.source == "muw"
    listed, _ = ActivitiesBody.model_validate(_load("activities.json")).activities
    assert listed.source == "muw"


def test_a_run_of_another_app_has_no_route_of_muw() -> None:
    route = _load("activity-request.json")
    body = imported(points=route["points"], similarity=route["similarity"])
    with pytest.raises(ValidationError, match="followed no route of MuW"):
        ActivityRequestBody.model_validate(body)
    with pytest.raises(ValidationError):
        ActivityRequestBody.model_validate(imported(source="strava"))


# --- Saved ---


def test_a_file_run_is_saved_with_the_times_of_the_file(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    answer = client.put(f"/me/activities/{KEY}", json=imported(), headers=me)
    assert answer.status_code == 201
    listed = _load("activities-imported.json")
    assert answer.json() == listed["activities"][0]
    # A year before the clock: the file's first point, not the day it came.
    assert answer.json()["started_at"] == "2025-10-26T07:30:00Z"
    # The four minutes of the hole are an auto pause: their time does not
    # count, their metres do.
    assert answer.json()["duration_s"] == 780 - 240
    assert client.get("/me/activities", headers=me).json() == listed
    whole = client.get(f"/me/activities/{KEY}", headers=me)
    assert whole.json() == _load("activity-imported.json")
    assert sources(database) == {KEY: "file"}


def test_a_run_of_an_older_app_is_of_muw(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    run = _load("activity-request.json")
    assert "source" not in run
    assert saved(client, me, run, MUW_KEY)["source"] == "muw"
    assert client.get(f"/me/activities/{MUW_KEY}", headers=me).json()["source"] == (
        "muw"
    )
    assert sources(database) == {MUW_KEY: "muw"}


def test_only_the_first_put_says_where_a_run_comes_from(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    first = saved(client, me, imported(), KEY)
    again = client.put(f"/me/activities/{KEY}", json=imported(source="muw"), headers=me)
    assert again.status_code == 200 and again.json() == first
    saved(client, me, recorded_free(), MUW_KEY)
    later = client.put(
        f"/me/activities/{MUW_KEY}", json=recorded_free(source="file"), headers=me
    )
    assert later.status_code == 200 and later.json()["source"] == "muw"
    assert sources(database) == {KEY: "file", MUW_KEY: "muw"}


def test_a_file_run_with_a_route_is_refused(client: TestClient) -> None:
    me = signed_up(client, "ada")
    route = _load("activity-request.json")
    answer = client.put(
        f"/me/activities/{KEY}",
        json=imported(points=route["points"], similarity=route["similarity"]),
        headers=me,
    )
    assert answer.status_code == 422
    assert answer.json()["error"]["code"] == "invalid_request"
    assert client.get("/me/activities", headers=me).json()["total"] == 0


# --- Worth nothing to the game and the contest ---


def test_the_game_does_not_count_a_file_run(
    client: TestClient, database: Database, wall: WallClock, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    before = game_tables(database)
    # Six kilometres this morning: recorded by the app, they would count and
    # unlock shapes.
    run = run_body(SIX_KM, start=wall.t - timedelta(hours=3))
    assert save(client, me, {**run, "source": "file"}, KEY) == 201
    assert game_tables(database) == before
    assert client.get(f"/game/runs/{KEY}", headers=me).status_code == 404
    game = client.get("/game/me", headers=me).json()
    assert game["counted_m"] == 0
    assert all(shape["unlocked_at"] is None for shape in game["shapes"])
    # The same kilometres recorded by the app, later the same morning, count:
    # the file run is not one of the same time.
    run = run_body(SIX_KM, start=wall.t - timedelta(hours=1))
    assert save(client, me, run, MUW_KEY) == 201
    counted = client.get(f"/game/runs/{MUW_KEY}", headers=me).json()
    assert counted["counted"] and counted["counted_m"] == 6_000


def test_the_backfill_leaves_file_runs_out(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    me = signed_up(client, "ada")
    saved(client, me, imported(), KEY)
    run = run_body(SIX_KM, start=wall.t - timedelta(hours=1))
    assert save(client, me, run, MUW_KEY) == 201
    forget_the_game(database)
    done = backfill(database)
    assert (done.accounts, done.runs) == (1, 1)
    with database.connect() as conn:
        kept = conn.execute(
            "SELECT r.key FROM game_runs g JOIN runs r ON r.id = g.run_id"
        ).fetchall()
    assert [row["key"] for row in kept] == [MUW_KEY]
    # A file run has no game: it is not one the backfill has still to do.
    assert backfill(database).accounts == 0


def test_a_file_run_fills_no_piece_of_a_challenge(
    client: TestClient, wall: WallClock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    hold(client, ada, challenge["id"], 0)
    # Run after the hold, with a watch: inside the challenge's days.
    start = wall.t + timedelta(hours=1)
    run = {**run_body([(5_000.0, 3.0)], start=start), "source": "file"}
    wall.t = start + timedelta(hours=1)
    assert save(client, ada, run, KEY) == 201
    after = read(client, bob, challenge["id"])
    assert pieces_of(after)[0] == ("ada", 0, False)
    assert after["contributions"] == []


def test_the_contest_leaves_file_runs_out(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    Contests(database, wall).open(STARTS, ENDS)
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    saved(client, ada, imported(), KEY)
    from_a_file = published(client, ada, KEY, "From my watch")
    saved(client, ada, _load("activity-request.json"), MUW_KEY)
    wall.t += timedelta(minutes=1)
    of_muw = published(client, ada, MUW_KEY, "Sunday star")
    # The file run has the reactions: it would lead.
    for kind in ("fire", "super_like"):
        body: dict[str, Any] = {"kind": kind}
        if kind == "super_like":
            body["comment"] = "What a loop!"
        answer = client.put(f"/drawings/{from_a_file}/reaction", json=body, headers=bob)
        assert answer.status_code == 200, answer.text
    contest = client.get("/contests/current", headers=bob).json()
    assert [entry["drawing"]["id"] for entry in contest["top"]] == [of_muw]
    assert [entry["reactions"] for entry in contest["top"]] == [0]


# --- Never sent to Strava ---


def test_send_to_strava_refuses_a_file_run(
    client: TestClient, fake: FakeStrava
) -> None:
    me = signed_up(client, "ada")
    saved(client, me, imported(), KEY)
    # Not connected: the run is refused before the token is asked for.
    answer = client.post(f"/me/activities/{KEY}/strava", headers=me)
    assert answer.status_code == 409
    assert answer.json()["error"] == {
        "code": "imported_run",
        "message": IMPORTED,
        "suggested_distance_m": None,
        "reason": None,
    }
    connected(client, fake, me)
    answer = client.post(
        f"/me/activities/{KEY}/strava", json={"name": "Morning run"}, headers=me
    )
    assert answer.status_code == 409
    assert answer.json()["error"]["code"] == "imported_run"
    assert fake.uploads == {}
    after = client.get(f"/me/activities/{KEY}/strava", headers=me)
    assert after.json() == {"status": "not_sent", "url": None}


# --- The answers say it ---


def test_every_answer_says_the_run_came_from_a_file(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    saved(client, ada, imported(), KEY)
    drawing_id = published(client, ada, KEY, "From my watch")
    # The owner's drawing, one and in the list.
    mine = client.get(f"/me/activities/{KEY}/drawing", headers=ada).json()
    assert as_example(mine, _load("my-drawing-imported.json")) == _load(
        "my-drawing-imported.json"
    )
    listed = client.get("/me/drawings", headers=ada).json()["drawings"]
    assert [(d["id"], d["source"]) for d in listed] == [(drawing_id, "file")]
    # The others': the drawing whole, the profile's grid, the feed.
    one = client.get(f"/drawings/{drawing_id}", headers=bob).json()
    example = _load("drawing-details-imported.json")
    assert as_example(one, example) == example
    ada_id = client.get("/me", headers=ada).json()["public_id"]
    grid = client.get(f"/users/{ada_id}/drawings", headers=bob).json()["drawings"]
    assert [(d["id"], d["source"]) for d in grid] == [(drawing_id, "file")]
    feed = client.get("/feed", headers=bob).json()
    example = _load("feed-imported.json")
    assert {
        **feed,
        "posts": [as_example(post, example["posts"][0]) for post in feed["posts"]],
    } == example


def test_a_run_of_muw_says_so_everywhere(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    saved(client, ada, _load("activity-request.json"), MUW_KEY)
    drawing_id = published(client, ada, MUW_KEY, "Sunday star")
    answers = [
        client.get("/me/activities", headers=ada).json()["activities"][0],
        client.get(f"/me/activities/{MUW_KEY}", headers=ada).json(),
        client.get(f"/me/activities/{MUW_KEY}/drawing", headers=ada).json(),
        client.get(f"/drawings/{drawing_id}", headers=bob).json(),
        client.get("/feed", headers=bob).json()["posts"][0],
    ]
    assert [answer["source"] for answer in answers] == ["muw"] * len(answers)
