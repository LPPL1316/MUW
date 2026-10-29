"""The totals and the photos of a profile (TASK-324, ADR-0284): the climb
of a run counted by the API from the heights of its fixes, the metres and
the climb of every run on the profile, private ones too (the user's
choice), the reactions received as who asks counts them, and the photos of
the drawings who asks sees, a page at a time."""

from __future__ import annotations

import base64
import io
import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from PIL import Image
from route_engine.network import FileSource

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import ActivityRequestBody, PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.profiles import PublicProfileBody
from shaperoute_api.run_climb import CLIMB_STEP_M, climb_m
from shaperoute_api.user_photos import UserPhotosBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
KEY = "7c2e91a4b05d3f68"
OTHER_KEY = "e5d0a83f19c7b246"
DAY_MS = 86_400_000
# The heights of the five fixes of the example run: up 30, down 5, up 35,
# down 20.
HEIGHTS = [200.0, 230.0, 225.0, 260.0, 240.0]
CLIMB = 65


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 26, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


def test_the_climb_migration_accepts_a_database_that_has_the_column_already(
    database_url: str, tmp_path: Path
) -> None:
    """The same column reached the two repositories under other names while
    they were divergent (0034_run_climb in MUW, 0035_run_climb in
    shaperoute): a database that applied one of them has the column and not
    the version 0037_run_climb. The migration passes, and is recorded."""
    import shutil

    import psycopg

    from shaperoute_api.db import MIGRATIONS_DIR, migrations

    before = tmp_path / "before"
    before.mkdir()
    for path in migrations(MIGRATIONS_DIR):
        if path.stem < "0037":
            shutil.copy(path, before / path.name)
    database = Database(database_url)
    database.migrate(before)
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute("ALTER TABLE runs ADD COLUMN climb_m integer CHECK (climb_m >= 0)")
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES ('0035_run_climb')"
        )

    # The climb migration first, then any that came after it (0038, TASK-333).
    assert database.migrate()[0] == "0037_run_climb"

    with psycopg.connect(database_url) as conn:
        columns = conn.execute(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_name = 'runs' AND column_name = 'climb_m'"
        ).fetchall()
        assert columns == [("climb_m",)]
        versions = conn.execute(
            "SELECT version FROM schema_migrations WHERE version LIKE '%run_climb'"
            " ORDER BY version"
        ).fetchall()
        assert versions == [("0035_run_climb",), ("0037_run_climb",)]
    # A second run has nothing left to do.
    assert database.migrate() == []


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def client(database: Database) -> TestClient:
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=WallClock(), hasher=FAST_HASHER),
            run_places=PlaceNames(None),
        )
    )


Headers = dict[str, str]


def signed_up(client: TestClient, n: int) -> Headers:
    body = {
        **_load("sign-up-request.json"),
        "email": f"runner{n}@example.com",
        "username": f"runner_{n}",
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def public_id(client: TestClient, headers: Headers) -> str:
    return str(client.get("/me", headers=headers).json()["public_id"])


def run(
    days_later: int = 0, heights: list[float | None] | None = None
) -> dict[str, Any]:
    """The example run of My activities, moved `days_later` days, with the
    heights of its fixes when given."""
    body = _load("activity-request.json")
    shift = days_later * DAY_MS
    for i, fix in enumerate(body["track"]):
        fix["time_ms"] += shift
        if heights is not None:
            fix["altitude_m"] = heights[i]
    for pause in body["pauses"]:
        pause["from_ms"] += shift
        pause["to_ms"] += shift
    return dict(body)


def saved(
    client: TestClient, headers: Headers, key: str, body: dict[str, Any]
) -> dict[str, Any]:
    answer = client.put(f"/me/activities/{key}", json=body, headers=headers)
    assert answer.status_code == 201, answer.text
    return dict(answer.json())


def kept_climb(database: Database, key: str) -> int | None:
    with database.connect() as conn:
        row = conn.execute("SELECT climb_m FROM runs WHERE key = %s", (key,)).fetchone()
    assert row is not None
    return row["climb_m"]


def published(
    client: TestClient, headers: Headers, key: str, visibility: str = "everyone"
) -> str:
    answer = client.put(
        f"/me/activities/{key}/drawing",
        json={"title": "Sunday star", "visibility": visibility},
        headers=headers,
    )
    assert answer.status_code == 200, answer.text
    return str(answer.json()["id"])


def follows(client: TestClient, follower: Headers, followed: Headers) -> None:
    asked = client.post(
        f"/users/{public_id(client, followed)}/follow", headers=follower
    )
    assert asked.status_code == 200, asked.text
    who = public_id(client, follower)
    accepted = client.post(f"/me/follow-requests/{who}/accept", headers=followed)
    assert accepted.status_code == 204, accepted.text


def reacts(client: TestClient, headers: Headers, drawing_id: str, kind: str) -> None:
    answer = client.put(
        f"/drawings/{drawing_id}/reaction", json={"kind": kind}, headers=headers
    )
    assert answer.status_code == 200, answer.text


def blocks(client: TestClient, who: Headers, whom: Headers) -> None:
    answer = client.put(f"/users/{public_id(client, whom)}/block", headers=who)
    assert answer.status_code == 204, answer.text


def profile(client: TestClient, viewer: Headers, owner: Headers) -> dict[str, Any]:
    answer = client.get(f"/users/{public_id(client, owner)}", headers=viewer)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def jpeg() -> str:
    out = io.BytesIO()
    Image.new("RGB", (400, 300), (30, 160, 60)).save(out, "JPEG")
    return base64.b64encode(out.getvalue()).decode("ascii")


def with_photo(client: TestClient, headers: Headers, key: str, n: int) -> None:
    answer = client.put(
        f"/me/activities/{key}/drawing/photos/{n}",
        json={"image": jpeg()},
        headers=headers,
    )
    assert answer.status_code == 200, answer.text


def photos(
    client: TestClient, viewer: Headers, owner: Headers, query: str = ""
) -> dict[str, Any]:
    answer = client.get(
        f"/users/{public_id(client, owner)}/photos{query}", headers=viewer
    )
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


# --- The climb, without a database ---


def test_the_climb_is_the_sum_of_the_rises() -> None:
    assert climb_m(HEIGHTS, [False] * len(HEIGHTS)) == CLIMB


def test_the_gps_wandering_less_than_a_step_climbs_nothing() -> None:
    small = CLIMB_STEP_M - 0.5
    wandering = [100.0, 100.0 + small, 100.0, 100.0 + small, 100.0]
    assert climb_m(wandering, [False] * 5) == 0


def test_a_slow_rise_counts_once_it_is_a_step() -> None:
    # Two metres at a time, up to 118: counted at 104, 108, 112 and 116,
    # each from the last height counted; the last 2 m are not a step.
    rising = [100.0 + 2 * i for i in range(10)]
    assert climb_m(rising, [False] * 10) == 16


def test_without_heights_there_is_no_climb() -> None:
    assert climb_m([None, None], [False, False]) is None
    assert climb_m([], []) is None
    assert climb_m([None, math.nan, 120.0], [False] * 3) == 0


def test_nothing_is_climbed_across_a_pause() -> None:
    # Up 30, then a pause before the fix of 260: that rise is not climbed.
    stops = [False, False, False, True, False]
    assert climb_m(HEIGHTS, stops) == 30
    # A pause before a fix without a height begins anew at the next one.
    assert climb_m([200.0, None, 260.0], [False, True, False]) == 0


# --- The climb of a run saved ---


def test_a_run_with_heights_keeps_its_climb(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, 1)
    body = run(heights=HEIGHTS)
    ActivityRequestBody.model_validate(body)
    saved(client, me, KEY, body)
    assert kept_climb(database, KEY) == CLIMB


def test_a_run_from_an_older_app_has_no_climb(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEY, run())
    assert kept_climb(database, KEY) is None


def test_a_rise_across_a_pause_asked_for_is_not_climbed(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, 1)
    body = run(heights=HEIGHTS)
    before = body["track"][3]["time_ms"]
    body["pauses"].append({"from_ms": before - 1000, "to_ms": before - 500})
    saved(client, me, KEY, body)
    assert kept_climb(database, KEY) == 30


@pytest.mark.parametrize("height", ["high", 1e9, -2_000.0])
def test_a_height_of_no_place_is_refused(client: TestClient, height: Any) -> None:
    me = signed_up(client, 1)
    body = run(heights=HEIGHTS)
    body["track"][1]["altitude_m"] = height
    answer = client.put(f"/me/activities/{KEY}", json=body, headers=me)
    assert answer.status_code == 422


def test_the_track_scores_take_no_height(client: TestClient) -> None:
    body = _load("track-score-request.json")
    body["track"][0]["altitude_m"] = 200.0
    assert client.post("/track-scores", json=body).status_code == 422


# --- The totals of a profile ---


def test_the_example_is_the_body() -> None:
    seen = _load("public-profile.json")
    assert set(seen) == set(PublicProfileBody.model_fields)
    PublicProfileBody.model_validate(seen)


def test_metres_and_climb_count_every_run_private_too(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    first = saved(client, owner, KEY, run(heights=HEIGHTS))
    # Private, from an app before TASK-324: metres, and no climb.
    second = saved(client, owner, OTHER_KEY, run(days_later=1))
    seen = profile(client, viewer, owner)
    assert seen["drawings"] == 0
    assert seen["distance_m"] == first["distance_m"] + second["distance_m"]
    assert seen["climb_m"] == CLIMB
    # The owner sees the same totals on its own profile.
    assert profile(client, owner, owner)["distance_m"] == seen["distance_m"]


def test_a_profile_without_runs_has_nothing(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    seen = profile(client, viewer, owner)
    assert (seen["distance_m"], seen["climb_m"], seen["reactions"]) == (0, 0, 0)


def test_the_reactions_received_are_those_of_the_others(client: TestClient) -> None:
    owner, second, third = (signed_up(client, n) for n in (1, 2, 3))
    saved(client, owner, KEY, run())
    drawing = published(client, owner, KEY)
    reacts(client, second, drawing, "fire")
    reacts(client, third, drawing, "clap")
    # The owner's own reaction is not one received.
    reacts(client, owner, drawing, "strong")
    assert profile(client, second, owner)["reactions"] == 2
    assert profile(client, owner, owner)["reactions"] == 2
    # Changing a reaction to another kind is still one.
    reacts(client, second, drawing, "wow")
    assert profile(client, third, owner)["reactions"] == 2


def test_the_reactions_follow_what_who_asks_sees(client: TestClient) -> None:
    owner, follower, stranger = (signed_up(client, n) for n in (1, 2, 3))
    follows(client, follower, owner)
    saved(client, owner, KEY, run())
    for_followers = published(client, owner, KEY, "followers")
    reacts(client, follower, for_followers, "fire")
    # The follower counts it; who cannot see the drawing does not.
    assert profile(client, follower, owner)["reactions"] == 1
    assert profile(client, stranger, owner)["reactions"] == 0


def test_no_reaction_of_a_member_a_block_keeps_apart(client: TestClient) -> None:
    owner, viewer, blocked = (signed_up(client, n) for n in (1, 2, 3))
    saved(client, owner, KEY, run())
    drawing = published(client, owner, KEY)
    reacts(client, viewer, drawing, "fire")
    reacts(client, blocked, drawing, "clap")
    blocks(client, viewer, blocked)
    assert profile(client, viewer, owner)["reactions"] == 1
    # The owner, with no block, still counts both.
    assert profile(client, owner, owner)["reactions"] == 2


# --- The photos of a profile ---


def test_the_photos_example_is_the_body() -> None:
    page = _load("user-photos.json")
    assert set(page) == set(UserPhotosBody.model_fields)
    UserPhotosBody.model_validate(page)


def test_the_photos_come_the_latest_run_first(client: TestClient) -> None:
    owner, follower, stranger = (signed_up(client, n) for n in (1, 2, 3))
    follows(client, follower, owner)
    saved(client, owner, KEY, run())
    older = published(client, owner, KEY)
    with_photo(client, owner, KEY, 3)
    with_photo(client, owner, KEY, 1)
    saved(client, owner, OTHER_KEY, run(days_later=1))
    newer = published(client, owner, OTHER_KEY, "followers")
    with_photo(client, owner, OTHER_KEY, 2)

    seen = photos(client, follower, owner)
    assert [(p["drawing_id"], p["n"]) for p in seen["photos"]] == [
        (newer, 2),
        (older, 1),
        (older, 3),
    ]
    assert seen["next"] is None
    first = seen["photos"][1]
    assert first["title"] == "Sunday star"
    assert first["url"].startswith(f"/drawings/{older}/photos/1?v=")
    assert client.get(first["url"], headers=follower).status_code == 200
    # Who does not follow sees only the drawing for everyone.
    assert [p["drawing_id"] for p in photos(client, stranger, owner)["photos"]] == [
        older,
        older,
    ]


def test_the_photos_a_page_at_a_time(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEY, run())
    published(client, owner, KEY)
    for n in (1, 2, 3):
        with_photo(client, owner, KEY, n)
    first = photos(client, viewer, owner, "?limit=2")
    assert [p["n"] for p in first["photos"]] == [1, 2]
    assert first["next"] is not None
    rest = photos(client, viewer, owner, f"?limit=2&cursor={first['next']}")
    assert [p["n"] for p in rest["photos"]] == [3]
    assert rest["next"] is None


def test_a_private_drawing_shows_no_photos(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEY, run())
    published(client, owner, KEY)
    with_photo(client, owner, KEY, 1)
    published(client, owner, KEY, "only_me")
    assert photos(client, viewer, owner)["photos"] == []


def test_no_photos_of_a_profile_not_there(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    unknown = "00000000-0000-4000-8000-000000000000"
    assert client.get(f"/users/{unknown}/photos", headers=viewer).status_code == 404
    assert client.get("/users/not-an-id/photos", headers=viewer).status_code == 404
    blocks(client, owner, viewer)
    answer = client.get(f"/users/{public_id(client, owner)}/photos", headers=viewer)
    assert answer.status_code == 404
    answer = client.get(f"/users/{public_id(client, viewer)}/photos")
    assert answer.status_code == 401
    bad = client.get(
        f"/users/{public_id(client, owner)}/photos?cursor=x", headers=owner
    )
    assert bad.status_code == 422
