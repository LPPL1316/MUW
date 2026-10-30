"""Drawings in a real PostgreSQL (TASK-117, TASK-208): a saved run titled
and published by its owner, seen by the other members without its first and
last 200 m, by its followers only or by nobody else when its owner says so;
its score the one the API counted; its description, activity and tags; gone
with its run. The bodies are the examples of packages/shared-types/fixtures."""

from __future__ import annotations

import json
import math
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.geo import (
    haversine_m,
    latlon_to_local,
    local_to_latlon,
    path_length_m,
)
from route_engine.network import FileSource

from shaperoute_api.accounts import AccountError, Accounts, token_hash
from shaperoute_api.activities import (
    UNKNOWN_ACTIVITY,
    ActivityRequestBody,
    PlaceNames,
)
from shaperoute_api.app import create_app
from shaperoute_api.db import Database, migrations
from shaperoute_api.drawings import (
    CUT_M,
    DESCRIPTION_NOT_TEXT,
    DESCRIPTION_TOO_LONG,
    MAX_DESCRIPTION_LENGTH,
    MAX_TAGS,
    MAX_TITLE_LENGTH,
    NO_DRAWING,
    NO_PROFILE,
    NO_VISIBILITY,
    TAG_TWICE,
    TAG_UNKNOWN,
    TAG_YOURSELF,
    TITLE_NOT_TEXT,
    TITLE_TOO_LONG,
    TOO_SHORT,
    VISIBILITY_TWICE,
    DrawingBody,
    DrawingDetailBody,
    DrawingRequestBody,
    DrawingsBody,
    MyDrawingBody,
    checked_description,
    checked_title,
    cut_track,
)
from shaperoute_api.profiles import PublicProfileBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
KEY = "7c2e91a4b05d3f68"
OTHER_KEY = "e5d0a83f19c7b246"
# The migrations of the drawings and of their details, whatever their
# numbers when merged.
(DRAWINGS_MIGRATION,) = [p for p in migrations() if p.name.endswith("_drawings.sql")]
(DETAILS_MIGRATION,) = [
    p for p in migrations() if p.name.endswith("_drawing_details.sql")
]
OTHER_EMAIL = "other@example.com"
DAY_MS = 86_400_000
# Seven digits of a degree are about a centimetre; the preview keeps five.
NEAR_M = 0.01
# What TASK-208 added to the bodies.
NEW_FIELDS = {"visibility", "description", "activity", "tags", "photos"}
# And the run's turn, TASK-232 part C: the same older fixtures.
NEW_FIELDS |= {"rotation_deg"}
# Where the run comes from (TASK-312 part A): every fixture written before
# is of a run of the app; the examples of a run from a file are
# *-imported.json (test_imported_runs.py).
SOURCE = {"source"}
NEW_FIELDS |= SOURCE
THIRD_EMAIL = "third@example.com"


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 21, 40, tzinfo=UTC)

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


def api(database: Database, wall: WallClock) -> TestClient:
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            run_places=PlaceNames(None),
        )
    )


@pytest.fixture
def client(database: Database, wall: WallClock) -> TestClient:
    return api(database, wall)


def signed_up(client: TestClient, **changes: Any) -> dict[str, str]:
    """A new account, as the header its requests carry."""
    body = {**_load("sign-up-request.json"), **changes}
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def other(client: TestClient) -> dict[str, str]:
    return signed_up(client, email=OTHER_EMAIL, username="other_runner")


def public_id(client: TestClient, headers: dict[str, str]) -> str:
    return str(client.get("/me", headers=headers).json()["public_id"])


def run(days_later: int = 0, **changes: Any) -> dict[str, Any]:
    """The example run of My activities: a square of about 4 km in Trento,
    moved `days_later` days on the clock."""
    body = _load("activity-request.json")
    shift = days_later * DAY_MS
    for fix in body["track"]:
        fix["time_ms"] += shift
    for pause in body["pauses"]:
        pause["from_ms"] += shift
        pause["to_ms"] += shift
    return {**body, **changes}


def saved(
    client: TestClient, headers: dict[str, str], key: str = KEY, **changes: Any
) -> dict[str, Any]:
    answer = client.put(f"/me/activities/{key}", json=run(**changes), headers=headers)
    assert answer.status_code == 201
    return dict(answer.json())


def published(
    client: TestClient,
    headers: dict[str, str],
    key: str = KEY,
    title: str | None = "Sunday star",
    public: bool = True,
) -> dict[str, Any]:
    answer = client.put(
        f"/me/activities/{key}/drawing",
        json={"title": title, "public": public},
        headers=headers,
    )
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def drawn(
    client: TestClient,
    headers: dict[str, str],
    key: str = KEY,
    status: int = 200,
    **fields: Any,
) -> dict[str, Any]:
    """The drawing as the app of TASK-208 sends it: `visibility`, and
    whatever else is given."""
    body = {"title": "Sunday star", "visibility": "everyone", **fields}
    answer = client.put(f"/me/activities/{key}/drawing", json=body, headers=headers)
    assert answer.status_code == status, answer.text
    return dict(answer.json())


def third(client: TestClient) -> dict[str, str]:
    return signed_up(client, email=THIRD_EMAIL, username="third_runner")


def follows(
    client: TestClient,
    follower: dict[str, str],
    followed: dict[str, str],
    accepted: bool = True,
) -> None:
    """`follower` asks to follow `followed`, which accepts unless told not
    to (TASK-211)."""
    wanted = public_id(client, followed)
    asked = client.post(f"/users/{wanted}/follow", headers=follower)
    assert asked.status_code == 200, asked.text
    if accepted:
        who = public_id(client, follower)
        answer = client.post(f"/me/follow-requests/{who}/accept", headers=followed)
        assert answer.status_code == 204, answer.text


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


def message(answer: Any) -> str:
    return str(answer.json()["error"]["message"])


def along_m(line: list[tuple[float, float]], point: tuple[float, float]) -> float:
    """How far along `line` the place nearest to `point` is, in metres, on
    the plane around each segment's start."""
    best, best_along, walked = float("inf"), 0.0, 0.0
    for a, b in zip(line, line[1:], strict=False):
        x_m, y_m = latlon_to_local(a, b)
        px_m, py_m = latlon_to_local(a, point)
        span = x_m * x_m + y_m * y_m
        ahead = 0.0 if span == 0 else (px_m * x_m + py_m * y_m) / span
        share = max(0.0, min(1.0, ahead))
        gap = math.hypot(px_m - share * x_m, py_m - share * y_m)
        if gap < best:
            best, best_along = gap, walked + share * math.sqrt(span)
        walked += math.sqrt(span)
    return best_along


# --- The cut, without a database ---


def straight(length_m: float, step_m: float = 50.0) -> list[tuple[float, float]]:
    """A line north from Trento, a point every `step_m`."""
    origin = (46.0671, 11.1214)
    n = round(length_m / step_m)
    return [local_to_latlon(origin, 0.0, i * step_m) for i in range(n + 1)]


def test_the_cut_leaves_out_200_m_at_either_end() -> None:
    line = straight(1_000)
    cut = cut_track(line)
    assert path_length_m(cut) == pytest.approx(1_000 - 2 * CUT_M, abs=NEAR_M)
    assert haversine_m(line[0], cut[0]) == pytest.approx(CUT_M, abs=NEAR_M)
    assert haversine_m(line[-1], cut[-1]) == pytest.approx(CUT_M, abs=NEAR_M)
    for point in cut:
        assert haversine_m(line[0], point) >= CUT_M - NEAR_M
        assert haversine_m(line[-1], point) >= CUT_M - NEAR_M


def test_a_cut_on_a_vertex_does_not_repeat_it() -> None:
    line = straight(1_000, step_m=100)
    cut = cut_track(line)
    assert len(cut) == len(line) - 4
    assert all(a != b for a, b in zip(cut, cut[1:], strict=False))


def test_a_cut_inside_one_long_step() -> None:
    line = [(46.0671, 11.1214), local_to_latlon((46.0671, 11.1214), 0.0, 1_000.0)]
    cut = cut_track(line)
    assert len(cut) == 2
    assert path_length_m(cut) == pytest.approx(600, abs=NEAR_M)


@pytest.mark.parametrize("length_m", [0, 150, 399, 400])
def test_nothing_is_left_of_a_short_track(length_m: float) -> None:
    line = straight(length_m, step_m=max(1.0, length_m / 7)) if length_m else []
    assert cut_track(line) == []


def test_the_title_rule() -> None:
    assert checked_title(None) is None
    assert checked_title("   ") is None
    assert checked_title("  Sunday star ") == "Sunday star"
    assert checked_title("é" * MAX_TITLE_LENGTH) == "é" * MAX_TITLE_LENGTH
    with pytest.raises(AccountError) as too_long:
        checked_title("a" * (MAX_TITLE_LENGTH + 1))
    assert too_long.value.message == TITLE_TOO_LONG
    with pytest.raises(AccountError) as two_lines:
        checked_title("Sunday\nstar")
    assert two_lines.value.message == TITLE_NOT_TEXT


# --- The contract ---


def test_the_examples_are_the_bodies() -> None:
    request = _load("drawing-request-details.json")
    # Who can see it is said once: `public` is an older app's.
    assert set(request) == set(DrawingRequestBody.model_fields) - {"public"}
    DrawingRequestBody.model_validate(request)
    mine = _load("my-drawing-details.json")
    assert set(mine) == set(MyDrawingBody.model_fields) - SOURCE
    MyDrawingBody.model_validate(mine)
    page = _load("drawings-details.json")
    assert set(page) == set(DrawingsBody.model_fields)
    DrawingsBody.model_validate(page)
    one = _load("drawing-details.json")
    assert set(one) == set(DrawingDetailBody.model_fields) - SOURCE
    seen = DrawingDetailBody.model_validate(one)
    # The list item is the detail without author, public and track, with a
    # preview instead.
    assert set(page["drawings"][0]) == (
        set(one) - {"author", "public", "track"} | {"track_preview"}
    )
    assert str(seen.author.public_id) == _load("public-profile.json")["public_id"]
    # The member tagged is one the search finds.
    tagged = _load("people.json")["people"][1]
    assert seen.tags[0].model_dump(mode="json") == {
        "public_id": tagged["public_id"],
        "username": tagged["username"],
    }
    assert request["tags"] == [tagged["public_id"]]
    assert mine["tags"] == one["tags"] and mine["photos"] == one["photos"]
    ActivityRequestBody.model_validate(_load("activity-request-cycling.json"))


def test_the_examples_before_task_208_are_still_bodies() -> None:
    """What an app before TASK-208 sends, and the fields an API before it
    answered: the app of TASK-117 keeps working."""
    request = _load("drawing-request.json")
    assert set(request) == {"title", "public"}
    DrawingRequestBody.model_validate(request)
    for name, model in (
        ("my-drawing.json", MyDrawingBody),
        ("drawing.json", DrawingDetailBody),
    ):
        assert set(_load(name)) == set(model.model_fields) - NEW_FIELDS, name
    (item,) = _load("drawings.json")["drawings"]
    assert set(item) == set(DrawingBody.model_fields) - NEW_FIELDS


# --- In the database ---


def test_a_run_is_private_until_published(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    answer = client.get(f"/me/activities/{KEY}/drawing", headers=me)
    assert answer.status_code == 200
    assert answer.json() == {
        "key": KEY,
        "id": None,
        "title": None,
        "public": False,
        "published_at": None,
        "visibility": "only_me",
        "description": None,
        "activity": "running",
        "source": "muw",
        "tags": [],
        "photos": [],
    }
    assert client.get("/me/drawings", headers=me).json() == {"drawings": []}
    mine = public_id(client, me)
    assert client.get(f"/users/{mine}", headers=me).json()["drawings"] == 0
    listed = client.get(f"/users/{mine}/drawings", headers=me).json()
    assert listed == {"drawings": [], "next": None, "total": 0}


def test_published_the_others_see_it_cut(client: TestClient, wall: WallClock) -> None:
    me = signed_up(client)
    saved(client, me)
    kept = published(client, me, title="  Sunday star ")
    assert kept["key"] == KEY
    assert kept["title"] == "Sunday star"
    assert kept["public"] is True
    assert kept["published_at"] == "2026-10-02T21:40:00Z"
    drawing_id = kept["id"]
    UUID(drawing_id)

    whole = client.get(f"/me/activities/{KEY}", headers=me).json()["track"]
    them = other(client)
    seen = client.get(f"/drawings/{drawing_id}", headers=them)
    assert seen.status_code == 200
    body = seen.json()
    assert body["author"] == {
        "public_id": public_id(client, me),
        "username": _load("sign-up-request.json")["username"],
    }
    assert body["public"] is True
    assert body["title"] == "Sunday star"
    for hidden in ("points", "route_preview", "pauses", "walks", "key", "similarity"):
        assert hidden not in body
    track = [tuple(p) for p in body["track"]]
    line = [tuple(p) for p in whole]
    # The run is a loop: it ends where it began, at the door.
    total = path_length_m(line)
    assert path_length_m(track) == pytest.approx(total - 2 * CUT_M, abs=1)
    for point in track:
        assert along_m(line, point) >= CUT_M - 1
        assert along_m(line, point) <= total - CUT_M + 1
        assert haversine_m(line[0], point) >= CUT_M - 1
        assert haversine_m(line[-1], point) >= CUT_M - 1
    # The owner keeps the run whole in My activities.
    assert line[0] == pytest.approx(tuple(run()["track"][0]["point"]))


def test_the_profile_lists_and_counts_the_public_ones(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    saved(client, me, key=OTHER_KEY, days_later=1)
    published(client, me)
    mine = public_id(client, me)
    them = other(client)
    assert client.get(f"/users/{mine}", headers=them).json()["drawings"] == 1
    page = client.get(f"/users/{mine}/drawings", headers=them).json()
    assert page["total"] == 1
    assert page["next"] is None
    (item,) = page["drawings"]
    assert item["title"] == "Sunday star"
    assert item["shape"] == "star"
    assert item["place"] is None
    assert len(item["track_preview"]) >= 2
    first = tuple(run()["track"][0]["point"])
    for point in item["track_preview"]:
        assert haversine_m(first, tuple(point)) >= CUT_M - 1
    # The other run is private: not listed, not counted.
    PublicProfileBody.model_validate(client.get(f"/users/{mine}", headers=me).json())


def test_the_score_is_the_one_the_api_counted(client: TestClient) -> None:
    me = signed_up(client)
    # The app cannot send a score with the run, nor with the drawing.
    refused = client.put(
        f"/me/activities/{KEY}", json={**run(), "score": 100}, headers=me
    )
    assert refused.status_code == 422
    activity = saved(client, me)
    refused = client.put(
        f"/me/activities/{KEY}/drawing",
        json={"title": None, "public": True, "score": 100},
        headers=me,
    )
    assert refused.status_code == 422
    drawing_id = published(client, me)["id"]
    seen = client.get(f"/drawings/{drawing_id}", headers=other(client)).json()
    assert seen["score"] == activity["score"]
    assert seen["fidelity"] == activity["fidelity"]
    assert seen["distance_m"] == activity["distance_m"]
    assert seen["duration_s"] == activity["duration_s"]


def test_a_private_drawing_is_not_found_by_anyone_else(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    drawing_id = published(client, me, title="Mine only", public=False)["id"]
    assert drawing_id is not None
    them = other(client)
    hidden = client.get(f"/drawings/{drawing_id}", headers=them)
    unknown = client.get(f"/drawings/{uuid4()}", headers=them)
    not_an_id = client.get("/drawings/42", headers=them)
    for answer in (hidden, unknown, not_an_id):
        assert answer.status_code == 404
        assert message(answer) == NO_DRAWING
    assert hidden.json() == unknown.json()
    # Its owner sees it, cut as the others would.
    own = client.get(f"/drawings/{drawing_id}", headers=me)
    assert own.status_code == 200
    assert own.json()["public"] is False
    mine = public_id(client, me)
    assert client.get(f"/users/{mine}/drawings", headers=them).json()["total"] == 0


def test_unpublished_it_disappears_and_comes_back(
    client: TestClient, wall: WallClock
) -> None:
    me = signed_up(client)
    saved(client, me)
    first = published(client, me)
    wall.t += timedelta(hours=1)
    # A new title on a public drawing does not publish it again.
    renamed = published(client, me, title="Star of Sunday")
    assert renamed["published_at"] == first["published_at"]
    assert renamed["id"] == first["id"]
    hidden = published(client, me, public=False)
    assert hidden["published_at"] is None
    them = other(client)
    assert client.get(f"/drawings/{first['id']}", headers=them).status_code == 404
    wall.t += timedelta(hours=1)
    again = published(client, me)
    assert again["id"] == first["id"]
    assert again["published_at"] == "2026-10-02T23:40:00Z"
    assert client.get(f"/drawings/{first['id']}", headers=them).status_code == 200


def test_a_deleted_run_leaves_no_drawing(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    drawing_id = published(client, me)["id"]
    mine = public_id(client, me)
    them = other(client)
    assert client.delete(f"/me/activities/{KEY}", headers=me).status_code == 204
    for headers in (me, them):
        answer = client.get(f"/drawings/{drawing_id}", headers=headers)
        assert answer.status_code == 404
        assert client.get(f"/users/{mine}/drawings", headers=headers).json() == {
            "drawings": [],
            "next": None,
            "total": 0,
        }
        assert client.get(f"/users/{mine}", headers=headers).json()["drawings"] == 0
    assert client.get("/me/drawings", headers=me).json() == {"drawings": []}
    answer = client.get(f"/me/activities/{KEY}/drawing", headers=me)
    assert answer.status_code == 404


def test_a_deleted_account_leaves_no_drawing(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client)
    saved(client, me)
    published(client, me)
    assert client.delete("/me", headers=me).status_code == 204
    with database.connect() as conn:
        left = conn.execute("SELECT count(*) AS n FROM drawings").fetchone()
    assert left is not None and left["n"] == 0


def test_only_the_owner_changes_its_drawing(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    them = other(client)
    for answer in (
        client.get(f"/me/activities/{KEY}/drawing", headers=them),
        client.put(
            f"/me/activities/{KEY}/drawing",
            json={"title": "Taken", "public": True},
            headers=them,
        ),
        client.get(f"/me/activities/{OTHER_KEY}/drawing", headers=me),
    ):
        assert answer.status_code == 404
        assert message(answer) == UNKNOWN_ACTIVITY
    assert client.get(f"/me/activities/{KEY}/drawing", headers=me).json()["id"] is None


def test_a_title_refused_changes_nothing(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    published(client, me)
    for title, why in (
        ("a" * (MAX_TITLE_LENGTH + 1), TITLE_TOO_LONG),
        ("Sunday\tstar", TITLE_NOT_TEXT),
    ):
        answer = client.put(
            f"/me/activities/{KEY}/drawing",
            json={"title": title, "public": False},
            headers=me,
        )
        assert answer.status_code == 422
        assert code(answer) == "invalid_request"
        assert message(answer) == why
    kept = client.get(f"/me/activities/{KEY}/drawing", headers=me).json()
    assert kept["title"] == "Sunday star"
    assert kept["public"] is True
    missing = client.put(f"/me/activities/{KEY}/drawing", json={}, headers=me)
    assert missing.status_code == 422


def test_a_run_too_short_is_not_published(client: TestClient) -> None:
    me = signed_up(client)
    body = run()
    # Two fixes 300 m apart: nothing is left once 200 m go from either end.
    body["track"] = [
        {"point": [46.0671, 11.1214], "time_ms": 1790000000000, "accuracy_m": 5.0},
        {"point": [46.0698, 11.1214], "time_ms": 1790000120000, "accuracy_m": 5.0},
    ]
    body.update(points=None, similarity=None, pauses=[])
    assert client.put(f"/me/activities/{KEY}", json=body, headers=me).status_code == 201
    answer = client.put(
        f"/me/activities/{KEY}/drawing",
        json={"title": "Short", "public": True},
        headers=me,
    )
    assert answer.status_code == 422
    assert message(answer) == TOO_SHORT
    # Titled and private it is kept, with nothing for the others.
    kept = published(client, me, title="Short", public=False)
    seen = client.get(f"/drawings/{kept['id']}", headers=me).json()
    assert seen["track"] == []


def test_the_profile_pages(client: TestClient) -> None:
    me = signed_up(client)
    keys = [f"{n:016x}" for n in range(0xA0, 0xA3)]
    for days, key in enumerate(keys):
        saved(client, me, key=key, days_later=days)
        published(client, me, key=key, title=f"Run {days}")
    mine = public_id(client, me)
    them = other(client)
    first = client.get(f"/users/{mine}/drawings?limit=2", headers=them).json()
    assert [d["title"] for d in first["drawings"]] == ["Run 2", "Run 1"]
    assert first["total"] == 3
    assert first["next"] is not None
    second = client.get(
        f"/users/{mine}/drawings?limit=2&cursor={first['next']}", headers=them
    ).json()
    assert [d["title"] for d in second["drawings"]] == ["Run 0"]
    assert second["next"] is None
    mine_all = client.get("/me/drawings", headers=me).json()["drawings"]
    assert [d["key"] for d in mine_all] == keys[::-1]
    for bad in ("limit=0", "limit=51", "cursor=12-34", f"cursor=1-{uuid4()}"):
        answer = client.get(f"/users/{mine}/drawings?{bad}", headers=them)
        assert answer.status_code == 422


def test_an_unknown_profile_has_no_drawings(client: TestClient) -> None:
    me = signed_up(client)
    for wanted in (str(uuid4()), "42", "Ada_runs"):
        answer = client.get(f"/users/{wanted}/drawings", headers=me)
        assert answer.status_code == 404
        assert message(answer) == NO_PROFILE


def test_every_drawing_needs_a_token(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    drawing_id = published(client, me)["id"]
    mine = public_id(client, me)
    for method, path, body in (
        ("GET", "/me/drawings", None),
        ("GET", f"/me/activities/{KEY}/drawing", None),
        ("PUT", f"/me/activities/{KEY}/drawing", {"title": None, "public": False}),
        ("GET", f"/users/{mine}/drawings", None),
        ("GET", f"/drawings/{drawing_id}", None),
    ):
        answer = client.request(method, path, json=body)
        assert answer.status_code == 401, path
        assert code(answer) == "not_signed_in"


def test_without_a_database_the_drawings_are_unavailable() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    answer = client.get("/me/drawings", headers={"Authorization": "Bearer x"})
    assert answer.status_code == 503
    assert code(answer) == "accounts_unavailable"


def migrated_before(database: Database, migration: Path, tmp_path: Path) -> None:
    """The database as it was before `migration` entered main: the
    migrations before it, not those after it, which may need its tables
    (the comments do, TASK-120)."""
    for path in migrations():
        if path.name < migration.name:
            shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)


def old_account(database: Database, wall: WallClock) -> dict[str, str]:
    """The example account and a phone's session, kept as the API of
    TASK-114 kept them: the code of today reads columns a database before
    them does not have (the phone number, TASK-183). The header that phone
    sends."""
    body = _load("sign-up-request.json")
    token = "token-of-before"
    with database.connect() as conn:
        conn.execute(
            "WITH made AS (INSERT INTO users"
            " (email, password_hash, username, confirmed_16_at, created_at)"
            " VALUES (%s, %s, %s, %s, %s) RETURNING id)"
            " INSERT INTO sessions (token_hash, user_id, created_at, last_used_at)"
            " SELECT %s, id, %s, %s FROM made",
            (
                body["email"],
                FAST_HASHER.hash(body["password"]),
                body["username"],
                wall.t,
                wall.t,
                token_hash(token),
                wall.t,
                wall.t,
            ),
        )
    return {"Authorization": f"Bearer {token}"}


def old_run(database: Database, key: str = KEY) -> int:
    """The example run, kept as the API of TASK-172 kept it: the code of
    today writes columns a database before them does not have."""
    fixes = run()["track"]
    first_ms = fixes[0]["time_ms"]
    points = [
        f"{lon!r} {lat!r} {(fix['time_ms'] - first_ms) / 1000!r}"
        for fix in fixes
        for lat, lon in [fix["point"]]
    ]
    track = "LINESTRING M (" + ",".join(points) + ")"
    with database.connect() as conn:
        row = conn.execute(
            "INSERT INTO runs (user_id, key, track, started_at, distance_m,"
            " duration_s, created_at) SELECT id, %s, ST_GeomFromText(%s, 4326),"
            " %s, 4004, 1140, %s FROM users LIMIT 1 RETURNING id",
            (
                key,
                track,
                datetime(1970, 1, 1, tzinfo=UTC) + timedelta(milliseconds=first_ms),
                datetime(2026, 10, 2, tzinfo=UTC),
            ),
        ).fetchone()
    assert row is not None
    return int(row["id"])


def test_a_run_saved_before_the_drawings_can_be_published(
    database_url: str, wall: WallClock, tmp_path: Path
) -> None:
    database = Database(database_url)
    migrated_before(database, DRAWINGS_MIGRATION, tmp_path)
    me = old_account(database, wall)
    old_run(database)
    database.migrate()
    client = api(database, wall)
    assert client.get(f"/me/activities/{KEY}", headers=me).status_code == 200
    drawing_id = published(client, me)["id"]
    seen = client.get(f"/drawings/{drawing_id}", headers=other(client))
    assert seen.status_code == 200


def test_the_others_see_how_far_the_drawing_is_turned(client: TestClient) -> None:
    """TASK-232 part C: a run along a route whose shape the engine turned
    is seen turned the same way, in the profile's list and whole, so the
    drawing reads upright; a run north up, or saved before, says nothing."""
    me = signed_up(client)
    saved(client, me, rotation_deg=-30)
    drawing_id = published(client, me)["id"]
    saved(client, me, key=OTHER_KEY, days_later=1)
    upright_id = published(client, me, key=OTHER_KEY)["id"]
    them = other(client)
    seen = client.get(f"/drawings/{drawing_id}", headers=them).json()
    assert seen["rotation_deg"] == -30
    assert (
        client.get(f"/drawings/{upright_id}", headers=them).json()["rotation_deg"]
        is None
    )
    mine = public_id(client, me)
    listed = client.get(f"/users/{mine}/drawings", headers=them).json()["drawings"]
    assert [(d["id"], d["rotation_deg"]) for d in listed] == [
        (upright_id, None),
        (drawing_id, -30),
    ]
    # What the owner chose says nothing of it: the turn is the run's.
    assert (
        "rotation_deg"
        not in client.get("/me/drawings", headers=me).json()["drawings"][0]
    )


def test_a_run_without_a_route_is_published_without_a_score(
    client: TestClient,
) -> None:
    me = signed_up(client)
    # The user's choice (TASK-117): a run without a route is a drawing too,
    # freehand, and the others see it without a score.
    assert saved(client, me, points=None, similarity=None, shape=None)["score"] is None
    drawing_id = published(client, me, title="Freehand")["id"]
    seen = client.get(f"/drawings/{drawing_id}", headers=other(client)).json()
    assert seen["score"] is None
    assert seen["fidelity"] is None
    assert seen["shape"] is None
    assert len(seen["track"]) >= 2


# --- Who can see it (TASK-208) ---


def test_followers_see_it_once_their_request_is_accepted(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    kept = drawn(client, me, visibility="followers")
    assert kept["visibility"] == "followers"
    assert kept["public"] is False
    assert kept["published_at"] == "2026-10-02T21:40:00Z"
    mine = public_id(client, me)
    asking, stranger = other(client), third(client)
    # Asked and not accepted yet: no more than a stranger.
    follows(client, asking, me, accepted=False)
    unknown = client.get(f"/drawings/{uuid4()}", headers=stranger)
    for headers in (asking, stranger):
        hidden = client.get(f"/drawings/{kept['id']}", headers=headers)
        assert hidden.status_code == 404
        assert hidden.json() == unknown.json()
        page = client.get(f"/users/{mine}/drawings", headers=headers).json()
        assert page == {"drawings": [], "next": None, "total": 0}
        assert client.get(f"/users/{mine}", headers=headers).json()["drawings"] == 0
    accepted = client.post(
        f"/me/follow-requests/{public_id(client, asking)}/accept", headers=me
    )
    assert accepted.status_code == 204
    seen = client.get(f"/drawings/{kept['id']}", headers=asking)
    assert seen.status_code == 200
    assert seen.json()["visibility"] == "followers"
    assert seen.json()["public"] is False
    page = client.get(f"/users/{mine}/drawings", headers=asking).json()
    assert [d["id"] for d in page["drawings"]] == [kept["id"]]
    assert page["total"] == 1
    assert client.get(f"/users/{mine}", headers=asking).json()["drawings"] == 1
    # The stranger still sees nothing, and the owner its own.
    assert client.get(f"/drawings/{kept['id']}", headers=stranger).status_code == 404
    assert client.get(f"/users/{mine}/drawings", headers=me).json()["total"] == 1
    assert client.get(f"/users/{mine}", headers=me).json()["drawings"] == 1
    # No longer following, no longer seeing.
    stopped = client.delete(f"/users/{mine}/follow", headers=asking)
    assert stopped.status_code == 204
    assert client.get(f"/drawings/{kept['id']}", headers=asking).status_code == 404


def test_only_me_is_not_found_by_anyone_else(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    follower = other(client)
    follows(client, follower, me)
    kept = drawn(client, me, visibility="only_me")
    assert kept["public"] is False
    assert kept["published_at"] is None
    unknown = client.get(f"/drawings/{uuid4()}", headers=follower)
    for headers in (follower, third(client)):
        hidden = client.get(f"/drawings/{kept['id']}", headers=headers)
        assert hidden.status_code == 404
        assert hidden.json() == unknown.json()
    own = client.get(f"/drawings/{kept['id']}", headers=me)
    assert own.status_code == 200
    assert own.json()["visibility"] == "only_me"
    # Not on the profile, not even to its owner (ADR-0159, point 8).
    mine = public_id(client, me)
    for headers in (me, follower):
        assert client.get(f"/users/{mine}/drawings", headers=headers).json() == {
            "drawings": [],
            "next": None,
            "total": 0,
        }


def test_the_profile_counts_what_the_viewer_may_see(client: TestClient) -> None:
    me = signed_up(client)
    keys = [f"{n:016x}" for n in range(0xB0, 0xB3)]
    for days, (key, visibility) in enumerate(
        zip(keys, ("everyone", "followers", "only_me"), strict=True)
    ):
        saved(client, me, key=key, days_later=days)
        drawn(client, me, key=key, visibility=visibility, title=visibility)
    follower, stranger = other(client), third(client)
    follows(client, follower, me)
    mine = public_id(client, me)
    for headers, titles in (
        (stranger, ["everyone"]),
        (follower, ["followers", "everyone"]),
        (me, ["followers", "everyone"]),
    ):
        page = client.get(f"/users/{mine}/drawings", headers=headers).json()
        assert [d["title"] for d in page["drawings"]] == titles
        assert page["total"] == len(titles)
        profile = client.get(f"/users/{mine}", headers=headers).json()
        assert profile["drawings"] == len(titles)
    # A page at a time, the same for a follower.
    first = client.get(f"/users/{mine}/drawings?limit=1", headers=follower).json()
    assert [d["title"] for d in first["drawings"]] == ["followers"]
    second = client.get(
        f"/users/{mine}/drawings?limit=1&cursor={first['next']}", headers=follower
    ).json()
    assert [d["title"] for d in second["drawings"]] == ["everyone"]
    assert second["next"] is None


def test_who_can_see_it_is_said_once(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    path = f"/me/activities/{KEY}/drawing"
    for body, why in (
        ({"title": "Both", "visibility": "everyone", "public": True}, VISIBILITY_TWICE),
        ({"title": "Neither"}, NO_VISIBILITY),
    ):
        answer = client.put(path, json=body, headers=me)
        assert answer.status_code == 422
        assert code(answer) == "invalid_request"
        assert message(answer) == why
    answer = client.put(path, json={"visibility": "friends"}, headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    # An app before TASK-208 says it with `public`.
    assert published(client, me, public=True)["visibility"] == "everyone"
    assert published(client, me, public=False)["visibility"] == "only_me"


def test_who_among_the_others_sees_it_does_not_publish_it_again(
    client: TestClient, wall: WallClock
) -> None:
    me = signed_up(client)
    saved(client, me)
    first = drawn(client, me, visibility="everyone")
    wall.t += timedelta(hours=1)
    assert drawn(client, me, visibility="followers")["published_at"] == (
        first["published_at"]
    )
    assert drawn(client, me, visibility="only_me")["published_at"] is None
    wall.t += timedelta(hours=1)
    again = drawn(client, me, visibility="followers")
    assert again["published_at"] == "2026-10-02T23:40:00Z"
    assert again["id"] == first["id"]


# --- What a drawing says (TASK-208) ---


def test_the_description_rule() -> None:
    assert checked_description(None) is None
    assert checked_description(" \n ") is None
    assert checked_description("  Heavy legs.\r\nRound heart. \r") == (
        "Heavy legs.\nRound heart."
    )
    full = "é" * MAX_DESCRIPTION_LENGTH
    assert checked_description(full) == full
    with pytest.raises(AccountError) as too_long:
        checked_description(full + "é")
    assert too_long.value.message == DESCRIPTION_TOO_LONG
    with pytest.raises(AccountError) as tab:
        checked_description("Heavy\tlegs")
    assert tab.value.message == DESCRIPTION_NOT_TEXT


def test_the_description(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    kept = drawn(client, me, description="  Heavy legs.\r\nRound heart all the same. ")
    assert kept["description"] == "Heavy legs.\nRound heart all the same."
    seen = client.get(f"/drawings/{kept['id']}", headers=other(client)).json()
    assert seen["description"] == kept["description"]
    page = client.get(f"/users/{public_id(client, me)}/drawings", headers=me).json()
    assert page["drawings"][0]["description"] == kept["description"]
    # An app before TASK-208 sends no description: it stays.
    assert published(client, me, title="Renamed")["description"] == (
        kept["description"]
    )
    # Not filtered for negative words: the owner's own account of its own
    # run (the user's choice, ADR-0170).
    sad = "Pessima corsa, gambe distrutte. Worst run ever."
    assert drawn(client, me, description=sad)["description"] == sad
    for description, why in (
        ("a" * (MAX_DESCRIPTION_LENGTH + 1), DESCRIPTION_TOO_LONG),
        ("Heavy\tlegs", DESCRIPTION_NOT_TEXT),
    ):
        answer = client.put(
            f"/me/activities/{KEY}/drawing",
            json={"visibility": "everyone", "description": description},
            headers=me,
        )
        assert answer.status_code == 422
        assert message(answer) == why
    assert client.get(f"/me/activities/{KEY}/drawing", headers=me).json()[
        "description"
    ] == (sad)
    assert drawn(client, me, description="")["description"] is None
    drawn(client, me, description=sad)
    assert drawn(client, me, description=None)["description"] is None


def test_the_activity(client: TestClient) -> None:
    me = signed_up(client)
    body = _load("activity-request-cycling.json")
    assert client.put(f"/me/activities/{KEY}", json=body, headers=me).status_code == 201
    # The run says what it was before it has a drawing.
    mine = client.get(f"/me/activities/{KEY}/drawing", headers=me).json()
    assert mine["activity"] == "cycling"
    assert mine["id"] is None
    kept = drawn(client, me, activity="paddling")
    assert kept["activity"] == "paddling"
    seen = client.get(f"/drawings/{kept['id']}", headers=other(client)).json()
    assert seen["activity"] == "paddling"
    # Missing, as from an app before TASK-208: as it was.
    assert published(client, me)["activity"] == "paddling"
    answer = client.put(
        f"/me/activities/{KEY}/drawing",
        json={"visibility": "everyone", "activity": "hiking"},
        headers=me,
    )
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    refused = client.put(
        f"/me/activities/{OTHER_KEY}",
        json={**run(), "activity": "hiking"},
        headers=me,
    )
    assert refused.status_code == 422


def test_the_people_tagged(client: TestClient, database: Database) -> None:
    me = signed_up(client)
    saved(client, me)
    ada, bea = other(client), third(client)
    ada_id, bea_id = public_id(client, ada), public_id(client, bea)
    kept = drawn(client, me, tags=[bea_id, ada_id])
    assert kept["tags"] == [
        {"public_id": bea_id, "username": "third_runner"},
        {"public_id": ada_id, "username": "other_runner"},
    ]
    seen = client.get(f"/drawings/{kept['id']}", headers=ada).json()
    assert seen["tags"] == kept["tags"]
    assert "email" not in json.dumps(seen)
    # Missing, as from an app before TASK-208: as they were.
    assert published(client, me)["tags"] == kept["tags"]
    assert drawn(client, me, tags=[])["tags"] == []
    drawn(client, me, tags=[ada_id, bea_id])
    for tags, why in (
        ([str(uuid4())], TAG_UNKNOWN),
        ([public_id(client, me)], TAG_YOURSELF),
        ([ada_id, ada_id], TAG_TWICE),
    ):
        answer = client.put(
            f"/me/activities/{KEY}/drawing",
            json={"visibility": "everyone", "tags": tags},
            headers=me,
        )
        assert answer.status_code == 422
        assert code(answer) == "invalid_request"
        assert message(answer) == why
    for tags in ([str(uuid4()) for _ in range(MAX_TAGS + 1)], ["Ada_runs"]):
        answer = client.put(
            f"/me/activities/{KEY}/drawing",
            json={"visibility": "everyone", "tags": tags},
            headers=me,
        )
        assert answer.status_code == 422
        assert code(answer) == "invalid_request"
    mine = client.get(f"/me/activities/{KEY}/drawing", headers=me).json()
    assert [tag["public_id"] for tag in mine["tags"]] == [ada_id, bea_id]
    # A member who deletes its account leaves the drawing.
    assert client.delete("/me", headers=ada).status_code == 204
    seen = client.get(f"/drawings/{kept['id']}", headers=bea).json()
    assert [tag["public_id"] for tag in seen["tags"]] == [bea_id]
    with database.connect() as conn:
        left = conn.execute("SELECT count(*) AS n FROM drawing_tags").fetchone()
    assert left is not None and left["n"] == 1


def test_ten_people_are_tagged_at_most(client: TestClient) -> None:
    me = signed_up(client)
    saved(client, me)
    members = [
        public_id(
            client, signed_up(client, email=f"m{n}@example.com", username=f"member{n}")
        )
        for n in range(MAX_TAGS)
    ]
    assert len(drawn(client, me, tags=members)["tags"]) == MAX_TAGS


def test_a_deleted_run_leaves_no_tag(client: TestClient, database: Database) -> None:
    me = signed_up(client)
    saved(client, me)
    drawn(client, me, tags=[public_id(client, other(client))])
    assert client.delete(f"/me/activities/{KEY}", headers=me).status_code == 204
    with database.connect() as conn:
        left = conn.execute("SELECT count(*) AS n FROM drawing_tags").fetchone()
    assert left is not None and left["n"] == 0


def test_the_migration_keeps_who_saw_each_drawing(
    database_url: str, wall: WallClock, tmp_path: Path
) -> None:
    database = Database(database_url)
    migrated_before(database, DETAILS_MIGRATION, tmp_path)
    me = old_account(database, wall)
    cut = cut_track([tuple(fix["point"]) for fix in run()["track"]])
    line = "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in cut) + ")"
    published_at = datetime(2026, 10, 2, 21, 40, tzinfo=UTC)
    with database.connect() as conn:
        for key, public in ((KEY, True), (OTHER_KEY, False)):
            conn.execute(
                "INSERT INTO drawings (run_id, title, public, track, published_at,"
                " updated_at) VALUES (%s, %s, %s, ST_GeomFromText(%s, 4326), %s, %s)",
                (
                    old_run(database, key),
                    key,
                    public,
                    line,
                    published_at if public else None,
                    published_at,
                ),
            )
    database.migrate()
    client = api(database, wall)
    mine = {
        d["key"]: d for d in client.get("/me/drawings", headers=me).json()["drawings"]
    }
    assert mine[KEY]["visibility"] == "everyone"
    assert mine[KEY]["public"] is True
    assert mine[KEY]["published_at"] == "2026-10-02T21:40:00Z"
    assert mine[OTHER_KEY]["visibility"] == "only_me"
    assert mine[OTHER_KEY]["public"] is False
    assert mine[OTHER_KEY]["published_at"] is None
    for drawing in mine.values():
        # Every run before TASK-208 was on foot.
        assert drawing["activity"] == "running"
        assert drawing["description"] is None
        assert drawing["tags"] == [] and drawing["photos"] == []
    them = other(client)
    assert client.get(f"/drawings/{mine[KEY]['id']}", headers=them).status_code == 200
    hidden = client.get(f"/drawings/{mine[OTHER_KEY]['id']}", headers=them)
    assert hidden.status_code == 404
    # The column kept for the SQL written before says the same.
    with database.connect() as conn:
        rows = conn.execute("SELECT title, public FROM drawings").fetchall()
    assert {row["title"]: row["public"] for row in rows} == {
        KEY: True,
        OTHER_KEY: False,
    }


def test_the_comments_follow_who_can_see_the_drawing(client: TestClient) -> None:
    """The follow-up of TASK-120 (comments.py): a follower reads and writes
    under a drawing for the followers, as it sees the drawing."""
    me = signed_up(client)
    saved(client, me)
    follower, stranger = other(client), third(client)
    follows(client, follower, me)
    drawing_id = drawn(client, me, visibility="followers")["id"]
    path = f"/drawings/{drawing_id}/comments"
    written = client.post(path, json=_load("comment-request.json"), headers=me)
    assert written.status_code == 201, written.text
    comment_id = written.json()["id"]
    page = client.get(path, headers=follower)
    assert page.status_code == 200
    assert [c["id"] for c in page.json()["comments"]] == [comment_id]
    assert client.post(
        path, json={"text": "Lovely."}, headers=follower
    ).status_code == (201)
    # Seen, not its own: refused; unseen: not there at all.
    assert client.delete(f"/comments/{comment_id}", headers=follower).status_code == (
        403
    )
    for answer in (
        client.get(path, headers=stranger),
        client.post(path, json={"text": "Lovely."}, headers=stranger),
        client.delete(f"/comments/{comment_id}", headers=stranger),
    ):
        assert answer.status_code == 404
    # Only its owner's again: the follower no longer reads them.
    drawn(client, me, visibility="only_me")
    assert client.get(path, headers=follower).status_code == 404
    assert client.get(path, headers=me).status_code == 200
