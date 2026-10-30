"""Favorites in a real PostgreSQL (TASK-171, ADR-0139): keep a route, list,
open and remove it; each account sees only its own; the bodies are the
examples of packages/shared-types/fixtures. A word with the pen up keeps its
walks (TASK-199); a route keeps the activity it was drawn for, and those
kept before are runs (TASK-200); a bike route keeps where it is walked with
the bike on foot (TASK-206); a route whose shape the engine turned keeps the
turn, and those kept before are north up (TASK-232 part C)."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import psycopg
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.models import SUPPORTED_ACTIVITIES
from route_engine.network import FileSource

from shaperoute_api import favorites as favorites_module
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.db import MIGRATIONS_DIR, Database, migrations
from shaperoute_api.favorites import (
    MAX_POINTS,
    FavoriteBody,
    FavoriteDetailBody,
    FavoriteRequestBody,
    FavoritesBody,
)
from shaperoute_api.recommended import PREVIEW_POINTS

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
KEY = "3f9a1c0e7b2d4a65"
OTHER_KEY = "a41b77c2d09e5f13"
BIKE_KEY = "b7d2e94a0c3f6158"
# The migrations of a favorite's activity: the column (TASK-200), and the
# check widened for paddling (TASK-191) and for swimming (TASK-323).
ACTIVITY_MIGRATIONS = (
    "_favorite_activity.sql",
    "_favorite_paddling.sql",
    "_swimming.sql",
)
# Added by TASK-206 part B: the fixtures written before are what an older
# app sends and an older API answers.
ON_FOOT = {"on_foot"}
ON_FOOT_KEY = "e5a90c3b1d7f2468"
# Added by TASK-232 part C, the same way.
TURN = {"rotation_deg"}
TURNED_KEY = "c4e1f7a2b9d05836"


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 8, 30, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def client(database: Database, wall: WallClock) -> TestClient:
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    return TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))


def signed_up(client: TestClient, **changes: Any) -> dict[str, str]:
    """A new account, as the header its requests carry."""
    body = {**_load("sign-up-request.json"), **changes}
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def other(client: TestClient) -> dict[str, str]:
    return signed_up(client, email="other@example.com", username="other_runner")


def request(**changes: Any) -> dict[str, Any]:
    return {**_load("favorite-request.json"), **changes}


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


# --- The contract, without a database ---


def test_the_fixtures_are_the_contract() -> None:
    # Written before TASK-199: the request of an older app, the answer of an
    # older API, without the walks and the activity.
    body = _load("favorite-request.json")
    assert (
        set(body)
        == set(FavoriteRequestBody.model_fields)
        - {
            "walks",
            "activity",
        }
        - ON_FOOT
        - TURN
    )
    FavoriteRequestBody.model_validate(body)
    listed = _load("favorites.json")
    assert set(listed["favorites"][0]) == (
        set(FavoriteBody.model_fields) - {"activity"} - TURN
    )
    whole = _load("favorite.json")
    assert (
        set(whole)
        == set(FavoriteDetailBody.model_fields)
        - {
            "walks",
            "activity",
        }
        - ON_FOOT
        - TURN
    )
    # A word with the pen up (TASK-199), still without the activity: a run.
    walked = _load("favorite-request-walks.json")
    assert set(walked) == (
        set(FavoriteRequestBody.model_fields) - {"activity"} - ON_FOOT - TURN
    )
    FavoriteRequestBody.model_validate(walked)
    whole_walked = _load("favorite-walks.json")
    assert set(whole_walked) == (
        set(FavoriteDetailBody.model_fields) - {"activity"} - ON_FOOT - TURN
    )
    # A bike route (TASK-200): a shape, so no walks in the request.
    cycling = _load("favorite-request-cycling.json")
    assert set(cycling) == (
        set(FavoriteRequestBody.model_fields) - {"walks"} - ON_FOOT - TURN
    )
    assert FavoriteRequestBody.model_validate(cycling).activity == "cycling"
    listed_now = _load("favorites-cycling.json")
    for favorite in listed_now["favorites"]:
        assert set(favorite) == set(FavoriteBody.model_fields) - TURN
    FavoritesBody.model_validate(listed_now)
    whole_cycling = _load("favorite-cycling.json")
    assert set(whole_cycling) == set(FavoriteDetailBody.model_fields) - ON_FOOT - TURN
    # A route whose shape is turned (TASK-232 part C): the request of before
    # with its turn, a run; and the favorite whole with every field.
    turned = _load("favorite-request-turned.json")
    assert set(turned) == (
        set(FavoriteRequestBody.model_fields) - {"walks", "activity"} - ON_FOOT
    )
    assert {**turned, "rotation_deg": None} == {**body, "rotation_deg": None}
    assert FavoriteRequestBody.model_validate(turned).rotation_deg == -30
    whole_turned = _load("favorite-turned.json")
    assert set(whole_turned) == set(FavoriteDetailBody.model_fields)
    assert FavoriteDetailBody.model_validate(whole_turned).rotation_deg == -30
    # A bike route walked in part (TASK-206): every field.
    on_foot = _load("favorite-request-on-foot.json")
    assert set(on_foot) == set(FavoriteRequestBody.model_fields) - {"walks"} - TURN
    assert FavoriteRequestBody.model_validate(on_foot).on_foot == [(2, 3)]
    whole_on_foot = _load("favorite-on-foot.json")
    assert set(whole_on_foot) == set(FavoriteDetailBody.model_fields) - TURN
    FavoriteDetailBody.model_validate(whole_on_foot)


def test_the_migration_comes_after_the_accounts() -> None:
    names = [path.name for path in migrations()]
    assert names.index("0002_favorites.sql") > names.index("0001_users_sessions.sql")


def test_the_activity_comes_after_the_walks() -> None:
    names = [path.name for path in migrations()]
    activity = next(
        i for i, name in enumerate(names) if name.endswith("_favorite_activity.sql")
    )
    walks = next(
        i for i, name in enumerate(names) if name.endswith("_pen_up_walks.sql")
    )
    # After the walks, not necessarily the last: TASK-117's drawings follow.
    assert activity > walks > names.index("0002_favorites.sql")


# --- Keeping, listing, opening, removing ---


def test_a_route_kept_is_listed_as_the_example(client: TestClient) -> None:
    me = signed_up(client)
    kept = client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    assert kept.status_code == 201
    # The example of before TASK-200: a run; north up (TASK-232).
    expected = {
        **_load("favorites.json")["favorites"][0],
        "activity": "running",
        "rotation_deg": None,
    }
    assert kept.json() == expected
    listed = client.get("/me/favorites", headers=me)
    assert listed.status_code == 200
    assert listed.json() == {"favorites": [expected]}


def test_a_favorite_opens_whole_as_the_example(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    whole = client.get(f"/me/favorites/{KEY}", headers=me)
    assert whole.status_code == 200
    # The example of before TASK-199, and no walks; a run; north up.
    assert whole.json() == {
        **_load("favorite.json"),
        "walks": [],
        "activity": "running",
        "on_foot": [],
        "rotation_deg": None,
    }


def test_a_turned_route_is_kept_with_its_turn(client: TestClient) -> None:
    """TASK-232 part C: the app sends how far the engine turned the shape,
    and reads it back in the list and on the favorite whole, to draw the
    card and turn the map."""
    me = signed_up(client)
    turned = _load("favorite-request-turned.json")
    kept = client.put(f"/me/favorites/{KEY}", json=turned, headers=me)
    assert kept.status_code == 201
    assert kept.json()["rotation_deg"] == -30
    listed = client.get("/me/favorites", headers=me).json()["favorites"]
    assert [favorite["rotation_deg"] for favorite in listed] == [-30]
    whole = client.get(f"/me/favorites/{KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json() == _load("favorite-turned.json")
    # Half degrees come back as sent (the water tries every 5°).
    client.put(
        f"/me/favorites/{TURNED_KEY}",
        json={**turned, "rotation_deg": 22.5, "points": turned["points"][::-1]},
        headers=me,
    )
    assert (
        client.get(f"/me/favorites/{TURNED_KEY}", headers=me).json()["rotation_deg"]
        == 22.5
    )
    # Beyond half a turn, or not a number: refused.
    for turn in (181, -180.5, "thirty", [30]):
        answer = client.put(
            f"/me/favorites/{OTHER_KEY}",
            json={**turned, "rotation_deg": turn},
            headers=me,
        )
        assert answer.status_code == 422, turn


def test_the_line_comes_back_digit_for_digit(client: TestClient) -> None:
    me = signed_up(client)
    points = [[46.06712345678, 11.12198765432], [46.070000001, 11.1230000009]]
    client.put(f"/me/favorites/{KEY}", json=request(points=points), headers=me)
    assert client.get(f"/me/favorites/{KEY}", headers=me).json()["points"] == points


def test_keeping_twice_keeps_once(client: TestClient, wall: WallClock) -> None:
    me = signed_up(client)
    first = client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    wall.t += timedelta(hours=1)
    again = client.put(
        f"/me/favorites/{KEY}", json=request(city="rovereto"), headers=me
    )
    assert again.status_code == 200
    # As it was kept the first time: neither the city nor the date moves.
    assert again.json() == first.json()
    assert len(client.get("/me/favorites", headers=me).json()["favorites"]) == 1


def test_the_newest_comes_first(client: TestClient, wall: WallClock) -> None:
    me = signed_up(client)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    wall.t += timedelta(minutes=5)
    word = request(city="", shape=None, word="CIAO", style="block")
    client.put(f"/me/favorites/{OTHER_KEY}", json=word, headers=me)
    listed = client.get("/me/favorites", headers=me).json()["favorites"]
    assert [favorite["id"] for favorite in listed] == [OTHER_KEY, KEY]
    assert listed[0]["word"] == "CIAO"
    assert listed[0]["style"] == "block"


def test_a_long_line_is_listed_light_and_opened_whole(client: TestClient) -> None:
    me = signed_up(client)
    points = [[46.0 + i * 1e-5, 11.0 + i * 1e-5] for i in range(1000)]
    kept = client.put(f"/me/favorites/{KEY}", json=request(points=points), headers=me)
    preview = kept.json()["preview"]
    assert len(preview) == PREVIEW_POINTS
    assert preview[0] == kept.json()["start"] == [46.0, 11.0]
    assert preview[-1] == [round(46.0 + 999e-5, 5), round(11.0 + 999e-5, 5)]
    whole = client.get(f"/me/favorites/{KEY}", headers=me).json()
    assert len(whole["points"]) == 1000


def test_removing_is_done_once_or_twice(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    assert client.delete(f"/me/favorites/{KEY}", headers=me).status_code == 204
    assert client.get("/me/favorites", headers=me).json() == {"favorites": []}
    assert client.delete(f"/me/favorites/{KEY}", headers=me).status_code == 204
    gone = client.get(f"/me/favorites/{KEY}", headers=me)
    assert gone.status_code == 404
    assert code(gone) == "http_error"


# --- A word with the pen up (TASK-199) ---


def walked(**changes: Any) -> dict[str, Any]:
    return {**_load("favorite-request-walks.json"), **changes}


def test_a_favorite_keeps_its_walks(client: TestClient) -> None:
    me = signed_up(client)
    kept = client.put(f"/me/favorites/{KEY}", json=walked(), headers=me)
    assert kept.status_code == 201
    # The list is as before: no walks in it.
    assert "walks" not in kept.json()
    listed = client.get("/me/favorites", headers=me).json()["favorites"]
    assert "walks" not in listed[0]
    whole = client.get(f"/me/favorites/{KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json() == {
        **_load("favorite-walks.json"),
        "activity": "running",
        "on_foot": [],
        "rotation_deg": None,
    }


@pytest.mark.parametrize(
    "walks",
    [
        [[2, 8]],
        [[5, 2]],
        [[-1, 2]],
        [[2, 5], [3, 6]],
        [[2, 5, 7]],
        [[2, 5]] * 40,
        "[2, 5]",
    ],
)
def test_walks_that_are_not_of_the_route_are_refused(
    client: TestClient, walks: Any
) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/favorites/{KEY}", json=walked(walks=walks), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/favorites", headers=me).json() == {"favorites": []}


# --- The activity it was drawn for (TASK-200) ---


def cycling(**changes: Any) -> dict[str, Any]:
    return {**_load("favorite-request-cycling.json"), **changes}


def test_a_bike_route_comes_back_a_bike_route(
    client: TestClient, wall: WallClock
) -> None:
    me = signed_up(client)
    # A run, as an app before TASK-200 keeps it: without the activity.
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    wall.t += timedelta(minutes=5)
    kept = client.put(f"/me/favorites/{BIKE_KEY}", json=cycling(), headers=me)
    assert kept.status_code == 201
    expected = _load("favorites-cycling.json")
    expected["favorites"] = [
        {**favorite, "rotation_deg": None} for favorite in expected["favorites"]
    ]
    assert kept.json() == expected["favorites"][0]
    listed = client.get("/me/favorites", headers=me)
    assert listed.json() == expected
    whole = client.get(f"/me/favorites/{BIKE_KEY}", headers=me)
    assert whole.json() == {
        **_load("favorite-cycling.json"),
        "on_foot": [],
        "rotation_deg": None,
    }
    assert client.get(f"/me/favorites/{KEY}", headers=me).json()["activity"] == (
        "running"
    )


@pytest.mark.parametrize("activity", SUPPORTED_ACTIVITIES)
def test_every_activity_offered_is_kept(client: TestClient, activity: str) -> None:
    # The database's check lists them too: an activity added to the API
    # without a migration that widens it fails here.
    me = signed_up(client)
    kept = client.put(
        f"/me/favorites/{BIKE_KEY}", json=cycling(activity=activity), headers=me
    )
    assert kept.status_code == 201
    assert kept.json()["activity"] == activity
    whole = client.get(f"/me/favorites/{BIKE_KEY}", headers=me).json()
    assert whole["activity"] == activity


@pytest.mark.parametrize("activity", ["hiking", "Cycling", "", None, 1])
def test_an_activity_the_api_does_not_offer_is_refused(
    client: TestClient, activity: Any
) -> None:
    me = signed_up(client)
    answer = client.put(
        f"/me/favorites/{BIKE_KEY}", json=cycling(activity=activity), headers=me
    )
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    if isinstance(activity, str):
        # The words of POST /routes.
        assert (
            f"unsupported activity {activity!r}; "
            "choose one of: running, cycling, paddling, swimming"
            in answer.json()["error"]["message"]
        )
    assert client.get("/me/favorites", headers=me).json() == {"favorites": []}


def test_the_database_keeps_only_the_activities_offered(
    client: TestClient, database: Database
) -> None:
    signed_up(client)
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
    with pytest.raises(psycopg.errors.CheckViolation):
        with database.connect() as conn:
            conn.execute(
                "INSERT INTO favorites (user_id, key, city, distance_m, route_m,"
                " similarity, line, created_at, activity) VALUES (%s, %s, '',"
                " 5000, 5120, 0.9, ST_GeomFromText("
                "'LINESTRING(11.1215 46.067,11.123 46.07)', 4326), now(),"
                " 'hiking')",
                (user["id"], KEY),
            )


def test_favorites_kept_before_are_runs(
    database_url: str, tmp_path: Path, wall: WallClock
) -> None:
    database = Database(database_url)
    # The schema of before TASK-200, 0001 to 0007, with two favorites in it:
    # without the activity, nor the migration that widens its check
    # (TASK-191), which needs the column.
    before = [
        path for path in migrations() if not path.name.endswith(ACTIVITY_MIGRATIONS)
    ]
    assert len(before) == len(migrations()) - len(ACTIVITY_MIGRATIONS)
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    old = TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))
    me = signed_up(old)
    walked_key = "c0ffee00d15ea5e1"
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
        # As the API of TASK-199 wrote them: a star, and a word with its walks.
        for key, body in ((KEY, request()), (walked_key, walked())):
            line = ",".join(f"{lon!r} {lat!r}" for lat, lon in body["points"])
            conn.execute(
                "INSERT INTO favorites (user_id, key, city, shape, word, style,"
                " title, distance_m, route_m, similarity, line, created_at, walks)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
                " ST_GeomFromText(%s, 4326), %s, %s)",
                (
                    user["id"],
                    key,
                    body["city"],
                    body["shape"],
                    body["word"],
                    body["style"],
                    body["title"],
                    body["distance_m"],
                    body["route_m"],
                    body["similarity"],
                    f"LINESTRING({line})",
                    wall.t,
                    json.dumps(body.get("walks", [])),
                ),
            )
    # The API of TASK-200 starts: the activity's migrations, nothing else.
    assert database.migrate(MIGRATIONS_DIR) == [
        path.stem for path in migrations() if path.name.endswith(ACTIVITY_MIGRATIONS)
    ]
    new = TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))
    listed = new.get("/me/favorites", headers=me).json()["favorites"]
    assert [favorite["activity"] for favorite in listed] == ["running", "running"]
    assert new.get(f"/me/favorites/{KEY}", headers=me).json() == {
        **_load("favorite.json"),
        "walks": [],
        "activity": "running",
        "on_foot": [],
        "rotation_deg": None,
    }
    whole_walked = new.get(f"/me/favorites/{walked_key}", headers=me).json()
    assert whole_walked == {
        **_load("favorite-walks.json"),
        "id": walked_key,
        "activity": "running",
        "on_foot": [],
        "rotation_deg": None,
    }


# --- Where a bike route is walked with the bike on foot (TASK-206) ---


def on_foot(**changes: Any) -> dict[str, Any]:
    return {**_load("favorite-request-on-foot.json"), **changes}


def test_a_bike_route_keeps_where_it_is_walked(
    client: TestClient, wall: WallClock
) -> None:
    me = signed_up(client)
    wall.t += timedelta(minutes=5)
    kept = client.put(f"/me/favorites/{ON_FOOT_KEY}", json=on_foot(), headers=me)
    assert kept.status_code == 201
    # The list is as before: no stretches in it.
    assert "on_foot" not in kept.json()
    listed = client.get("/me/favorites", headers=me).json()["favorites"]
    assert "on_foot" not in listed[0]
    whole = client.get(f"/me/favorites/{ON_FOOT_KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json() == {**_load("favorite-on-foot.json"), "rotation_deg": None}


@pytest.mark.parametrize(
    "stretches",
    [
        [[2, 9]],
        [[3, 2]],
        [[-1, 2]],
        [[2, 5], [3, 6]],
        [[2, 3, 4]],
        [[2, 3]] * 1001,
        "[2, 3]",
    ],
)
def test_stretches_on_foot_that_are_not_of_the_route_are_refused(
    client: TestClient, stretches: Any
) -> None:
    me = signed_up(client)
    answer = client.put(
        f"/me/favorites/{ON_FOOT_KEY}", json=on_foot(on_foot=stretches), headers=me
    )
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/favorites", headers=me).json() == {"favorites": []}


def test_favorites_kept_before_walk_nowhere(
    database_url: str, tmp_path: Path, wall: WallClock
) -> None:
    database = Database(database_url)
    # The schema of before TASK-206 part B, with a bike favorite in it.
    before = [p for p in migrations() if not p.name.endswith("_favorite_on_foot.sql")]
    assert len(before) == len(migrations()) - 1
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    me = signed_up(TestClient(app))
    body = _load("favorite-request-cycling.json")
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
        line = ",".join(f"{lon!r} {lat!r}" for lat, lon in body["points"])
        conn.execute(
            "INSERT INTO favorites (user_id, key, city, shape, word, style,"
            " title, distance_m, route_m, similarity, line, created_at, activity)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
            " ST_GeomFromText(%s, 4326), %s, %s)",
            (
                user["id"],
                BIKE_KEY,
                body["city"],
                body["shape"],
                body["word"],
                body["style"],
                body["title"],
                body["distance_m"],
                body["route_m"],
                body["similarity"],
                f"LINESTRING({line})",
                wall.t + timedelta(minutes=5),
                body["activity"],
            ),
        )
    # The API of TASK-206 part B starts: its migration, nothing else.
    assert database.migrate(MIGRATIONS_DIR) == [
        p.stem for p in migrations() if p.name.endswith("_favorite_on_foot.sql")
    ]
    new = TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))
    assert new.get(f"/me/favorites/{BIKE_KEY}", headers=me).json() == {
        **_load("favorite-cycling.json"),
        "on_foot": [],
        "rotation_deg": None,
    }


# --- Whose they are ---


def test_favorites_need_an_account(client: TestClient) -> None:
    for answer in (
        client.get("/me/favorites"),
        client.get(f"/me/favorites/{KEY}"),
        client.put(f"/me/favorites/{KEY}", json=request()),
        client.delete(f"/me/favorites/{KEY}"),
    ):
        assert answer.status_code == 401
        assert code(answer) == "not_signed_in"


def test_an_account_sees_only_its_own(client: TestClient) -> None:
    me = signed_up(client)
    them = other(client)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    assert client.get("/me/favorites", headers=them).json() == {"favorites": []}
    assert client.get(f"/me/favorites/{KEY}", headers=them).status_code == 404
    # The same route kept by two accounts is two favorites, and removing
    # one's leaves the other's.
    assert (
        client.put(f"/me/favorites/{KEY}", json=request(), headers=them).status_code
        == 201
    )
    client.delete(f"/me/favorites/{KEY}", headers=them)
    assert len(client.get("/me/favorites", headers=me).json()["favorites"]) == 1


def test_deleting_the_account_deletes_its_favorites(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client)
    them = other(client)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=me)
    client.put(f"/me/favorites/{KEY}", json=request(), headers=them)
    assert client.delete("/me", headers=me).status_code == 204
    with database.connect() as conn:
        left = conn.execute("SELECT count(*) AS n FROM favorites").fetchone()
    assert left is not None and left["n"] == 1
    assert len(client.get("/me/favorites", headers=them).json()["favorites"]) == 1


# --- What is refused ---


@pytest.mark.parametrize(
    "changes",
    [
        {"points": [[46.067, 11.1215]]},
        {"points": [[96.0, 11.0], [46.0, 11.0]]},
        {"points": [[46.0, 191.0], [46.0, 11.0]]},
        {"points": [[46.0, 11.0]] * (MAX_POINTS + 1)},
        {"distance_m": 0},
        {"route_m": 100_001},
        {"similarity": 1.2},
        {"style": "italic"},
        {"title": "x" * 61},
        {"city": "x" * 81},
        {"user_id": 1},
    ],
)
def test_a_route_that_is_not_one_is_refused(
    client: TestClient, changes: dict[str, Any]
) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/favorites/{KEY}", json=request(**changes), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/favorites", headers=me).json() == {"favorites": []}


@pytest.mark.parametrize("key", ["short", "UPPERCASE1234", "with-dash-1234", "x" * 41])
def test_a_key_that_is_not_one_is_refused(client: TestClient, key: str) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/favorites/{key}", json=request(), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"


def test_the_list_has_an_end(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(favorites_module, "MAX_FAVORITES", 2)
    me = signed_up(client)
    for key in ("favorite1", "favorite2"):
        assert (
            client.put(f"/me/favorites/{key}", json=request(), headers=me).status_code
            == 201
        )
    full = client.put("/me/favorites/favorite3", json=request(), headers=me)
    assert full.status_code == 422
    assert code(full) == "invalid_request"
    assert "remove one" in full.json()["error"]["message"]
    # One already kept is still answered, and room is made by removing.
    assert (
        client.put("/me/favorites/favorite1", json=request(), headers=me).status_code
        == 200
    )
    client.delete("/me/favorites/favorite1", headers=me)
    assert (
        client.put("/me/favorites/favorite3", json=request(), headers=me).status_code
        == 201
    )


def test_without_a_database_favorites_are_off() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    answer = client.get("/me/favorites", headers={"Authorization": "Bearer x"})
    assert answer.status_code == 503
    assert code(answer) == "accounts_unavailable"
