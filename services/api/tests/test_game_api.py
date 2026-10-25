"""The shape game in a real PostgreSQL (TASK-296 part A, ADR-0255,
docs/GIOCO.md): each run saved gets its game in the same transaction, the
shapes reached are unlocked once and told with a push, a run sharing time
with another or by bike does not count, the day has its cap, a deleted run
takes its metres but not its shapes, and a deleted account takes all."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.geo import haversine_m
from route_engine.network import FileSource
from test_push import FAST_HASHER, FakeExpo, push_on, put_token, signed_up

from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.game import record
from shaperoute_api.game_rules import RunGame
from shaperoute_api.push import Pusher

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
MORNING = datetime(2026, 10, 22, 7, 0, tzinfo=UTC)
KEY = "a1b2c3d4e5f60718"
OTHER_KEY = "0f1e2d3c4b5a6978"
PHONE = "ExponentPushToken[phone-of-ada]"
UNLOCKED_TEXT = "You unlocked a new shape! Find it in your collection, in Play."
START = (46.0, 11.0)
M_PER_DEG = haversine_m((0.0, 0.0), (1.0, 0.0))


def run_body(
    legs: list[tuple[float, float]],
    start: datetime = MORNING,
    activity: str = "running",
    every_s: float = 2.0,
) -> dict[str, Any]:
    """A run north from START, leg by leg as (metres, m/s), a fix every
    `every_s` seconds."""
    metres, seconds = 0.0, 0.0
    fixes = [(metres, seconds)]
    for length, speed in legs:
        steps = round(length / (speed * every_s))
        for k in range(1, steps + 1):
            fixes.append(
                (metres + length * k / steps, seconds + length / speed * k / steps)
            )
        metres, seconds = fixes[-1]
    base_ms = start.timestamp() * 1000
    return {
        "track": [
            {
                "point": [START[0] + m / M_PER_DEG, START[1]],
                "time_ms": base_ms + s * 1000,
                "accuracy_m": 5.0,
            }
            for m, s in fixes
        ],
        "pauses": [],
        "activity": activity,
    }


SIX_KM = [(6_000.0, 3.0)]


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def client(database: Database, expo: FakeExpo) -> TestClient:
    accounts = Accounts(database, now=lambda: NOW, hasher=FAST_HASHER)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


def save(
    client: TestClient, me: dict[str, str], body: dict[str, Any], key: str = KEY
) -> int:
    answer = client.put(f"/me/activities/{key}", json=body, headers=me)
    assert answer.is_success, answer.text
    return answer.status_code


def game_of(client: TestClient, me: dict[str, str], key: str = KEY) -> Any:
    answer = client.get(f"/game/runs/{key}", headers=me)
    assert answer.status_code == 200, answer.text
    return answer.json()


def shapes_of(client: TestClient, me: dict[str, str]) -> dict[str, Any]:
    answer = client.get("/game/me", headers=me)
    assert answer.status_code == 200, answer.text
    return {shape["id"]: shape for shape in answer.json()["shapes"]}


def rows(database: Database, table: str) -> int:
    with database.connect() as conn:
        row = conn.execute(f"SELECT count(*) AS n FROM {table}").fetchone()
    assert row is not None
    return int(row["n"])


def test_the_catalog_needs_no_account(client: TestClient) -> None:
    answer = client.get("/game/catalog")
    assert answer.status_code == 200
    body = answer.json()
    assert body["rules_version"] == 1
    shapes = {shape["id"]: shape for shape in body["shapes"]}
    assert len(shapes) == 12
    assert shapes["triangle"]["goal"] == {
        "kind": "distance",
        "total_m": 5_000,
        "distance_m": None,
        "pace_s": None,
    }
    assert shapes["lightning"]["goal"]["pace_s"] == 300
    assert shapes["heart"]["names"]["it"] == "Cuore"
    outline = shapes["star"]["outline"]
    assert outline[0] == outline[-1]


def test_the_rest_of_the_game_needs_an_account(client: TestClient) -> None:
    assert client.get("/game/me").status_code == 401
    assert client.get(f"/game/runs/{KEY}").status_code == 401


def test_six_km_unlock_the_triangle(client: TestClient) -> None:
    me = signed_up(client, "ada")
    assert save(client, me, run_body(SIX_KM)) == 201
    assert game_of(client, me) == {
        "counted": True,
        "reason": None,
        "counted_m": 6_000,
        "best_s": {"1000": 333.3, "5000": 1666.7},
        "unlocked": ["triangle"],
        "pieces_done": [],
    }
    answer = client.get("/game/me", headers=me).json()
    assert answer["counted_m"] == 6_000 and answer["longest_m"] == 6_000
    assert answer["best_s"] == {"1000": 333.3, "5000": 1666.7}
    shapes = {shape["id"]: shape for shape in answer["shapes"]}
    assert shapes["triangle"] == {
        "id": "triangle",
        "unlocked_at": "2026-10-23T12:00:00Z",
        "progress": 1.0,
        "team_unlocked_at": None,
    }
    assert shapes["square"]["unlocked_at"] is None
    assert shapes["square"]["progress"] == 0.6
    # 5:00 against a best kilometre of 5:33.3.
    assert shapes["lightning"]["progress"] == pytest.approx(0.9001, abs=1e-4)
    # Never 21.1 km in one run: the longest against it.
    assert shapes["crown"]["progress"] == pytest.approx(6_000 / 21_097, abs=1e-4)


def test_a_fast_kilometre_unlocks_the_lightning(client: TestClient) -> None:
    me = signed_up(client, "ada")
    # 1.2 km at 3.6 m/s: 4:38 a kilometre.
    save(client, me, run_body([(1_200.0, 3.6)]))
    game = game_of(client, me)
    assert game["unlocked"] == ["lightning"]
    assert game["best_s"] == {"1000": pytest.approx(277.8, abs=0.1)}


def test_a_shape_is_unlocked_once(client: TestClient) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    later = run_body(SIX_KM, start=MORNING + timedelta(hours=3))
    save(client, me, later, OTHER_KEY)
    # 12 km: the square now, the triangle already.
    assert game_of(client, me, OTHER_KEY)["unlocked"] == ["square"]
    assert shapes_of(client, me)["triangle"]["unlocked_at"] is not None


def test_a_run_sharing_time_with_one_saved_before_does_not_count(
    client: TestClient,
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    # The same run from another phone, a minute later, under another name.
    again = run_body(SIX_KM, start=MORNING + timedelta(minutes=1))
    save(client, me, again, OTHER_KEY)
    assert game_of(client, me, OTHER_KEY) == {
        "counted": False,
        "reason": "overlap",
        "counted_m": 0,
        "best_s": {},
        "unlocked": [],
        "pieces_done": [],
    }
    assert client.get("/game/me", headers=me).json()["counted_m"] == 6_000


def test_a_bike_ride_counts_nothing(client: TestClient) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body([(6_000.0, 5.0)], activity="cycling"))
    game = game_of(client, me)
    assert not game["counted"] and game["reason"] == "not_running"
    assert game["unlocked"] == []


def test_a_run_at_a_vehicle_speed_is_kept_but_does_not_count(
    client: TestClient,
) -> None:
    me = signed_up(client, "ada")
    body = run_body([(2_500.0, 3.0), (1_000.0, 9.0), (2_500.0, 3.0)])
    assert save(client, me, body) == 201
    # Still in «My activities».
    assert client.get(f"/me/activities/{KEY}", headers=me).status_code == 200
    game = game_of(client, me)
    assert game["counted"] is False and game["reason"] == "vehicle"
    assert game["counted_m"] == 0


def test_saving_twice_counts_once_and_tells_once(
    client: TestClient, database: Database, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    put_token(client, me, PHONE)
    push_on(client, me)
    assert save(client, me, run_body(SIX_KM)) == 201
    assert save(client, me, run_body(SIX_KM)) == 200
    assert rows(database, "game_runs") == 1
    # The app asking again still reads what the run unlocked.
    assert game_of(client, me)["unlocked"] == ["triangle"]
    assert [(m["to"], m["body"]) for m in expo.sent] == [(PHONE, UNLOCKED_TEXT)]


def test_a_run_that_unlocks_nothing_tells_nothing(
    client: TestClient, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    put_token(client, me, PHONE)
    push_on(client, me)
    save(client, me, run_body([(2_000.0, 3.0)]))
    assert expo.sent == []


def test_no_push_with_push_notifications_off(
    client: TestClient, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    put_token(client, me, PHONE)
    save(client, me, run_body(SIX_KM))
    assert game_of(client, me)["unlocked"] == ["triangle"]
    assert expo.sent == []


def test_the_push_speaks_the_language_of_the_phone(
    client: TestClient, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    put_token(client, me, PHONE, language="it")
    push_on(client, me)
    save(client, me, run_body(SIX_KM))
    assert [m["body"] for m in expo.sent] == [
        "Hai sbloccato una nuova forma! La trovi nella tua collezione, in Play."
    ]


def test_deleting_a_run_takes_its_metres_but_not_its_shapes(
    client: TestClient,
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    assert client.delete(f"/me/activities/{KEY}", headers=me).status_code == 204
    assert client.get(f"/game/runs/{KEY}", headers=me).status_code == 404
    answer = client.get("/game/me", headers=me).json()
    assert answer["counted_m"] == 0 and answer["best_s"] == {}
    shapes = {shape["id"]: shape for shape in answer["shapes"]}
    assert shapes["triangle"]["unlocked_at"] == "2026-10-23T12:00:00Z"
    assert shapes["triangle"]["progress"] == 1.0


def test_an_account_reads_only_its_own_runs(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    save(client, ada, run_body(SIX_KM))
    assert client.get(f"/game/runs/{KEY}", headers=bob).status_code == 404
    assert client.get("/game/me", headers=bob).json()["counted_m"] == 0


def test_deleting_the_account_deletes_its_game(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    assert rows(database, "game_runs") == rows(database, "game_unlocks") == 1
    assert client.delete("/me", headers=me).status_code == 204
    assert rows(database, "game_runs") == rows(database, "game_unlocks") == 0


def test_a_day_counts_up_to_its_cap(client: TestClient, database: Database) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body([(1_000.0, 3.0)]))
    save(
        client, me, run_body([(1_000.0, 3.0)], MORNING + timedelta(hours=2)), OTHER_KEY
    )
    with database.connect() as conn:
        found = conn.execute(
            "SELECT id, user_id, key, started_at FROM runs ORDER BY id"
        ).fetchall()
        first, second = found
        # As if the first had counted 100 km: the second, the same day,
        # counts only what is left of the 120.
        record(
            conn,
            first["user_id"],
            first["id"],
            first["started_at"],
            RunGame(True, None, 100_000, {}, 3_600),
            NOW,
        )
        record(
            conn,
            second["user_id"],
            second["id"],
            second["started_at"],
            RunGame(True, None, 30_000, {}, 3_600),
            NOW,
        )
    game = game_of(client, me, OTHER_KEY)
    assert game["counted"] and game["reason"] == "daily_cap"
    assert game["counted_m"] == 20_000
    assert client.get("/game/me", headers=me).json()["counted_m"] == 120_000


def test_the_next_day_counts_again(client: TestClient, database: Database) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body([(1_000.0, 3.0)]))
    save(client, me, run_body([(1_000.0, 3.0)], MORNING + timedelta(days=1)), OTHER_KEY)
    with database.connect() as conn:
        first, second = conn.execute(
            "SELECT id, user_id, started_at FROM runs ORDER BY id"
        ).fetchall()
        record(
            conn,
            first["user_id"],
            first["id"],
            first["started_at"],
            RunGame(True, None, 120_000, {}, 3_600),
            NOW,
        )
        record(
            conn,
            second["user_id"],
            second["id"],
            second["started_at"],
            RunGame(True, None, 30_000, {}, 3_600),
            NOW,
        )
    game = game_of(client, me, OTHER_KEY)
    assert game["reason"] is None and game["counted_m"] == 30_000
