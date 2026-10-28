"""Group runs in a real PostgreSQL, with Expo faked (TASK-309, ADR-0269,
docs/EVENTI.md): the limits of the fields and of the time, the filter of
the texts, the ten upcoming, who sees and who goes across follows, blocks
and what was hidden, the Feed's row, «I'm going» and «Not going», the
reminder sent once, the pushes of a change and of a cancellation, none for
a new «I'm going», the account deleted. One test for each rule of
EVENTI.md §3–§9."""

from __future__ import annotations

import json
import re
import shutil
import threading
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_push import FAST_HASHER, FakeExpo, push_on, put_token

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database, migrations
from shaperoute_api.expo_push import Expo
from shaperoute_api.group_runs import (
    CANCELLED,
    CHECK_EVERY_S,
    DESCRIPTION_WRONG,
    MAX_UPCOMING,
    NO_GROUP_RUN,
    NOTE_WRONG,
    ORGANISER_GOES,
    OVER,
    STARTED,
    TITLE_WRONG,
    TOO_MANY,
    WHEN_WRONG,
    GroupRunChangeBody,
    GroupRunClock,
    GroupRunDetailBody,
    GroupRunRequestBody,
    GroupRunsBody,
    ProfileGroupRunsBody,
)
from shaperoute_api.moderation import NOT_YOURSELF_REPORT
from shaperoute_api.notice_email import EMAIL_KINDS
from shaperoute_api.push import OWN_KINDS, TEXTS, Pusher, PushEvent, data_of, text_of

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
INDEX_TS = REPO / "packages" / "shared-types" / "src" / "index.ts"
# The migration of the group runs, whatever its number when merged.
(GROUP_RUNS,) = [p for p in migrations() if p.name.endswith("_group_runs.sql")]

NOW = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
MINUTE = timedelta(minutes=1)
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)
# Milan, about 180 km from the Trento of the example route.
MILAN = (45.4642, 9.19)
TRENTO = (46.067, 11.1215)
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """The API's clock, moved by hand."""

    def __init__(self) -> None:
        self.t = NOW

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
def expo() -> FakeExpo:
    return FakeExpo()


def sending(database: Database, expo: FakeExpo) -> Pusher:
    """Sends at once, in the test's thread."""
    return Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )


@pytest.fixture
def pusher(database: Database, expo: FakeExpo) -> Pusher:
    return sending(database, expo)


@pytest.fixture
def client(database: Database, pusher: Pusher, wall: WallClock) -> TestClient:
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=accounts,
        run_places=PlaceNames(None),
    )
    app.state.pusher = pusher
    return TestClient(app)


def clock_of(client: TestClient) -> GroupRunClock:
    clock: GroupRunClock = client.app.state.group_run_clock  # type: ignore[attr-defined]
    return clock


def signed_up(client: TestClient, name: str, push: bool = False) -> Headers:
    """A new account; with `push`, with push on and a phone of its own."""
    body = {
        **_load("sign-up-request.json"),
        "email": f"{name}@example.com",
        "username": name,
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201, answer.text
    headers = {"Authorization": f"Bearer {answer.json()['token']}"}
    if push:
        push_on(client, headers)
        assert put_token(client, headers, phone(name)).status_code == 204
    return headers


def phone(name: str) -> str:
    return f"ExponentPushToken[phone-of-{name}]"


def public_id(client: TestClient, headers: Headers) -> str:
    answer = client.get("/me", headers=headers)
    assert answer.status_code == 200, answer.text
    return str(answer.json()["public_id"])


def follows(client: TestClient, follower: Headers, followed: Headers) -> None:
    """`follower` asks, `followed` accepts."""
    asked = client.post(
        f"/users/{public_id(client, followed)}/follow", headers=follower
    )
    assert asked.status_code == 200, asked.text
    accepted = client.post(
        f"/me/follow-requests/{public_id(client, follower)}/accept", headers=followed
    )
    assert accepted.status_code == 204, accepted.text


def block(client: TestClient, who: Headers, whom: Headers) -> None:
    answer = client.put(f"/users/{public_id(client, whom)}/block", headers=who)
    assert answer.status_code == 204, answer.text


def points_at(lat: float, lon: float) -> list[list[float]]:
    """The example's star, moved to start at (lat, lon)."""
    points = _load("group-run-request.json")["points"]
    first_lat, first_lon = points[0]
    return [[lat + p[0] - first_lat, lon + p[1] - first_lon] for p in points]


def asked(starts_in: timedelta = DAY, **changes: Any) -> dict[str, Any]:
    """The example request, starting `starts_in` after NOW-on-the-wall (the
    test moves it with `at`)."""
    at = changes.pop("at", NOW)
    return {
        **_load("group-run-request.json"),
        "starts_at": (at + starts_in).isoformat(),
        **changes,
    }


def create(client: TestClient, headers: Headers, **changes: Any) -> Any:
    return client.post("/group-runs", json=asked(**changes), headers=headers)


def made(client: TestClient, headers: Headers, **changes: Any) -> dict[str, Any]:
    answer = create(client, headers, **changes)
    assert answer.status_code == 201, answer.text
    return dict(answer.json())


def error(answer: Any, status: int, code: str = "invalid_request") -> str:
    assert answer.status_code == status, answer.text
    detail = answer.json()["error"]
    assert detail["code"] == code
    return str(detail["message"])


def go(client: TestClient, headers: Headers, group_run_id: str) -> Any:
    return client.put(f"/group-runs/{group_run_id}/going", headers=headers)


def not_go(client: TestClient, headers: Headers, group_run_id: str) -> Any:
    return client.delete(f"/group-runs/{group_run_id}/going", headers=headers)


def going(client: TestClient, headers: Headers, group_run_id: str) -> Any:
    answer = go(client, headers, group_run_id)
    assert answer.status_code == 204, answer.text


def detail(client: TestClient, headers: Headers, group_run_id: str) -> Any:
    answer = client.get(f"/group-runs/{group_run_id}", headers=headers)
    assert answer.status_code == 200, answer.text
    return answer.json()


def names(people: list[dict[str, Any]]) -> list[str]:
    return [person["username"] for person in people]


def feed_row(
    client: TestClient, headers: Headers, point: tuple[float, float] | None = None
) -> list[str]:
    query = "" if point is None else f"?lat={point[0]}&lon={point[1]}"
    answer = client.get(f"/group-runs{query}", headers=headers)
    assert answer.status_code == 200, answer.text
    return [one["title"] for one in answer.json()["group_runs"]]


def change(
    client: TestClient, headers: Headers, group_run_id: str, **changes: Any
) -> Any:
    body = {**_load("group-run-change.json"), **changes}
    return client.put(f"/group-runs/{group_run_id}", json=body, headers=headers)


def pushes(expo: FakeExpo) -> list[tuple[str, str, dict[str, str]]]:
    """Every message sent: to, text, data."""
    return [(m["to"], m["body"], m["data"]) for m in expo.sent]


def rows(database: Database, query: str, *values: Any) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return [dict(row) for row in conn.execute(query, values).fetchall()]


# --- The contract ---


def test_the_examples_are_the_bodies() -> None:
    GroupRunRequestBody.model_validate(_load("group-run-request.json"))
    GroupRunChangeBody.model_validate(_load("group-run-change.json"))
    whole = _load("group-run.json")
    assert set(whole) == set(GroupRunDetailBody.model_fields)
    GroupRunDetailBody.model_validate(whole)
    GroupRunsBody.model_validate(_load("group-runs.json"))
    ProfileGroupRunsBody.model_validate(_load("group-runs-of-profile.json"))


def test_the_app_knows_the_same_limits() -> None:
    """packages/shared-types holds the limits the API checks."""
    source = INDEX_TS.read_text(encoding="utf-8")
    for name, value in (
        ("GROUP_RUN_TITLE_MAX", 60),
        ("GROUP_RUN_MEETING_NOTE_MAX", 80),
        ("GROUP_RUN_DESCRIPTION_MAX", 500),
        ("GROUP_RUN_EARLIEST_MINUTES", 30),
        ("GROUP_RUN_LATEST_DAYS", 60),
        ("GROUP_RUN_OVER_AFTER_HOURS", 3),
        ("GROUP_RUNS_UPCOMING_MAX", MAX_UPCOMING),
    ):
        match = re.search(rf"export const {name} = (\d+);", source)
        assert match is not None, name
        assert int(match.group(1)) == value, name


def test_the_pushes_say_the_title_and_open_the_group_run() -> None:
    group_run_id = uuid4()
    for kind in ("group_run_soon", "group_run_changed", "group_run_cancelled"):
        assert set(TEXTS[kind]) == {"en", "de", "it", "es", "fr"}
        event = PushEvent(
            kind, 1, 2, text="Star at the MUSE", group_run_id=group_run_id
        )
        for language in TEXTS[kind]:
            assert "Star at the MUSE" in text_of(event, "ada", language)
        assert data_of(event, uuid4(), "ada") == {
            "kind": kind,
            "group_run_id": str(group_run_id),
        }
        # Never in the daily email: it would come after the start.
        assert kind not in EMAIL_KINDS
    soon = PushEvent("group_run_soon", 1, 1, text="Star", group_run_id=group_run_id)
    assert text_of(soon, "ada", "en") == "Star starts soon: see you at the start!"
    assert "group_run_soon" in OWN_KINDS
    assert "group_run_changed" not in OWN_KINDS
    assert "group_run_cancelled" not in OWN_KINDS
    for language in TEXTS["group_run_changed"]:
        changed = PushEvent(
            "group_run_changed", 1, 2, text="Star", group_run_id=group_run_id
        )
        assert "ada" in text_of(changed, "ada", language)
    examples = _load("group-run-push-data.json")
    assert [one["kind"] for one in examples] == [
        "group_run_soon",
        "group_run_changed",
        "group_run_cancelled",
    ]


def test_the_endpoints_want_a_session(client: TestClient) -> None:
    some = str(uuid4())
    for method, path in (
        ("POST", "/group-runs"),
        ("GET", "/group-runs"),
        ("GET", f"/group-runs/{some}"),
        ("PUT", f"/group-runs/{some}"),
        ("DELETE", f"/group-runs/{some}"),
        ("PUT", f"/group-runs/{some}/going"),
        ("DELETE", f"/group-runs/{some}/going"),
        ("GET", f"/group-runs/{some}/going"),
        ("GET", f"/users/{some}/group-runs"),
    ):
        answer = client.request(method, path, json={})
        assert answer.status_code == 401, (method, path)


def test_without_a_database_they_answer_503() -> None:
    app = create_app(FileSource(Path("unused.graphml")), run_places=PlaceNames(None))
    answer = TestClient(app).get(
        "/group-runs", headers={"Authorization": "Bearer whatever"}
    )
    assert error(answer, 503, "accounts_unavailable")


# --- The migration ---


def test_the_new_check_keeps_every_kind_and_the_reports_already_there(
    database_url: str, tmp_path: Path
) -> None:
    """The migration runs on a table of reports with rows of each kind of
    before, keeps them, and takes a group run's report (TASK-309)."""
    before = [p for p in migrations() if p.name < GROUP_RUNS.name]
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database = Database(database_url)
    database.migrate(tmp_path)
    with database.connect() as conn:
        user = conn.execute(
            "INSERT INTO users (email, username, password_hash, confirmed_16_at,"
            " created_at) VALUES ('a@example.com', 'ada', 'x', now(), now())"
            " RETURNING id"
        ).fetchone()
        assert user is not None
        for kind in ("drawing", "comment", "user"):
            conn.execute(
                "INSERT INTO reports (reporter_id, kind, target_id, reason,"
                " created_at) VALUES (%s, %s, %s, 'spam', now())",
                (user["id"], kind, uuid4()),
            )
    assert GROUP_RUNS.stem in database.migrate()
    kept = rows(database, "SELECT kind FROM reports ORDER BY kind")
    assert [row["kind"] for row in kept] == ["comment", "drawing", "user"]
    with database.connect() as conn:
        conn.execute(
            "INSERT INTO reports (reporter_id, kind, target_id, reason, created_at)"
            " VALUES (%s, 'group_run', %s, 'spam', now())",
            (user["id"], uuid4()),
        )
    with pytest.raises(Exception, match="reports_kind_check"):
        with database.connect() as conn:
            conn.execute(
                "INSERT INTO reports (reporter_id, kind, target_id, reason,"
                " created_at) VALUES (%s, 'something', %s, 'spam', now())",
                (user["id"], uuid4()),
            )


# --- The fields (EVENTI.md §3) ---


def test_a_group_run_is_created_with_the_route_and_the_organiser_going(
    client: TestClient, database: Database
) -> None:
    ada = signed_up(client, "ada")
    run = made(client, ada)
    assert run["title"] == "Star at the MUSE"
    assert run["meeting_note"] == "MUSE entrance"
    assert run["description"].endswith("\nWe wait for everyone at the end.")
    assert run["status"] == "upcoming"
    assert run["start"] == list(TRENTO)
    assert run["points"] == _load("group-run-request.json")["points"]
    assert datetime.fromisoformat(run["starts_at"]) == NOW + DAY
    assert names(run["people"]) == ["ada"] and run["going"] == 1
    assert run["organiser"]["username"] == "ada" and run["i_am_going"] is True
    # The organiser has no row of its own among who goes.
    assert rows(database, "SELECT * FROM group_run_going") == []


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("title", "", TITLE_WRONG),
        ("title", "   ", TITLE_WRONG),
        ("title", "x" * 61, TITLE_WRONG),
        ("title", "Star\nat dawn", TITLE_WRONG),
        ("meeting_note", "x" * 81, NOTE_WRONG),
        ("meeting_note", "MUSE\nentrance", NOTE_WRONG),
        ("description", "x" * 501, DESCRIPTION_WRONG),
        ("description", "Tab\tinside", DESCRIPTION_WRONG),
    ],
)
def test_the_limits_of_the_fields(
    client: TestClient, field: str, value: str, message: str
) -> None:
    ada = signed_up(client, "ada")
    assert error(create(client, ada, **{field: value}), 422) == message


def test_the_texts_at_their_limits_are_kept_without_spaces(client: TestClient) -> None:
    ada = signed_up(client, "ada")
    run = made(
        client,
        ada,
        title=" " + "t" * 60 + " ",
        meeting_note="n" * 80,
        description="d" * 499 + "\n",
    )
    assert run["title"] == "t" * 60
    assert run["meeting_note"] == "n" * 80
    assert run["description"] == "d" * 499
    bare = made(client, ada, meeting_note=None, description="  ")
    assert bare["meeting_note"] is None and bare["description"] is None


def test_the_time_is_from_30_minutes_to_60_days(client: TestClient) -> None:
    ada = signed_up(client, "ada")
    for starts_in in (30 * MINUTE - timedelta(seconds=1), 60 * DAY + MINUTE, -HOUR):
        assert error(create(client, ada, starts_in=starts_in), 422) == WHEN_WRONG
    made(client, ada, starts_in=30 * MINUTE)
    made(client, ada, starts_in=60 * DAY)
    # A time without its offset says nothing: refused.
    naive = asked()
    naive["starts_at"] = "2026-11-07T09:00:00"
    assert client.post("/group-runs", json=naive, headers=ada).status_code == 422
    # Who sees it is one of two; «Only me» is not one.
    assert create(client, ada, visibility="only_me").status_code == 422


@pytest.mark.parametrize("field", ["title", "meeting_note", "description"])
def test_the_texts_pass_the_filter_of_the_comments(
    client: TestClient, database: Database, field: str
) -> None:
    ada = signed_up(client, "ada")
    answer = create(client, ada, **{field: "che merda"})
    error(answer, 422, "comment_rejected")
    assert answer.json()["error"]["reason"] == "negative"
    assert rows(database, "SELECT * FROM group_runs") == []


def test_ten_upcoming_at_most(client: TestClient, wall: WallClock) -> None:
    ada = signed_up(client, "ada")
    runs = [made(client, ada, starts_in=DAY + n * HOUR) for n in range(MAX_UPCOMING)]
    assert error(create(client, ada), 422) == TOO_MANY
    # One cancelled frees a place.
    assert client.delete(f"/group-runs/{runs[0]['id']}", headers=ada).status_code == 204
    made(client, ada, starts_in=2 * DAY)
    assert error(create(client, ada), 422) == TOO_MANY
    # One over frees another: the first left started 25 hours from NOW.
    wall.t = NOW + DAY + HOUR + timedelta(hours=3)
    made(client, ada, at=wall.t)
    # Another member has its own ten.
    made(client, signed_up(client, "bob"), at=wall.t)


# --- Who sees it (EVENTI.md §4) ---


def test_for_the_followers_only_with_the_request_accepted(client: TestClient) -> None:
    ada, bob, cleo = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    run = made(client, ada, visibility="followers")
    path = f"/group-runs/{run['id']}"
    assert error(client.get(path, headers=bob), 404, "http_error") == NO_GROUP_RUN
    assert go(client, bob, run["id"]).status_code == 404
    # A request not accepted yet is not a follow.
    asked_only = client.post(f"/users/{public_id(client, ada)}/follow", headers=bob)
    assert asked_only.json() == {"follow": "requested"}
    assert client.get(path, headers=bob).status_code == 404
    assert feed_row(client, bob) == []
    follows(client, cleo, ada)
    assert detail(client, cleo, run["id"])["visibility"] == "followers"
    assert feed_row(client, cleo) == ["Star at the MUSE"]
    going(client, cleo, run["id"])
    # The organiser sees its own always.
    assert detail(client, ada, run["id"])["going"] == 2


def test_a_block_either_way_hides_it_and_takes_out_who_goes(
    client: TestClient, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob, cleo, dan = (
        signed_up(client, n, push=True) for n in ("ada", "bob", "cleo", "dan")
    )
    run = made(client, ada, starts_in=2 * HOUR)
    for who in (bob, cleo, dan):
        wall.t += MINUTE
        going(client, who, run["id"])
    assert names(detail(client, dan, run["id"])["people"]) == [
        "ada",
        "bob",
        "cleo",
        "dan",
    ]
    # The organiser blocks bob; cleo blocks the organiser.
    block(client, ada, bob)
    block(client, cleo, ada)
    for apart in (bob, cleo):
        path = f"/group-runs/{run['id']}"
        assert client.get(path, headers=apart).status_code == 404
        assert go(client, apart, run["id"]).status_code == 404
        assert not_go(client, apart, run["id"]).status_code == 404
        assert client.get(f"{path}/going", headers=apart).status_code == 404
        assert feed_row(client, apart) == []
        profile = client.get(
            f"/users/{public_id(client, ada)}/group-runs", headers=apart
        )
        assert profile.status_code == 404
    # Neither goes nor is counted, for anyone.
    for who in (ada, dan):
        seen = detail(client, who, run["id"])
        assert names(seen["people"]) == ["ada", "dan"]
        assert seen["going"] == 2
    # Nor is told: the reminder goes to the organiser and dan only.
    wall.t = NOW + HOUR + MINUTE
    assert clock_of(client).check() == [UUID(run["id"])]
    assert sorted(to for to, _, _ in pushes(expo)) == [phone("ada"), phone("dan")]


def test_a_block_between_two_who_go_hides_one_from_the_other(
    client: TestClient, wall: WallClock
) -> None:
    ada, bob, cleo = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    run = made(client, ada)
    for who in (bob, cleo):
        wall.t += MINUTE
        going(client, who, run["id"])
    block(client, cleo, bob)
    assert names(detail(client, cleo, run["id"])["people"]) == ["ada", "cleo"]
    assert names(detail(client, bob, run["id"])["people"]) == ["ada", "bob"]
    assert names(detail(client, ada, run["id"])["people"]) == ["ada", "bob", "cleo"]
    page = client.get(f"/group-runs/{run['id']}/going", headers=cleo).json()
    assert page["total"] == 2


def test_hidden_from_a_report_only_the_organiser_sees_it(
    client: TestClient, database: Database, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada, starts_in=2 * HOUR)
    going(client, bob, run["id"])
    with database.connect() as conn:
        conn.execute("UPDATE group_runs SET hidden_at = %s", (NOW,))
    assert client.get(f"/group-runs/{run['id']}", headers=bob).status_code == 404
    assert feed_row(client, bob) == []
    profile = client.get(f"/users/{public_id(client, ada)}/group-runs", headers=bob)
    assert profile.json() == {"upcoming": [], "past": []}
    assert detail(client, ada, run["id"])["title"] == "Star at the MUSE"
    assert feed_row(client, ada) == ["Star at the MUSE"]
    # Who went no longer counts, and is not reminded.
    assert detail(client, ada, run["id"])["going"] == 1
    wall.t = NOW + HOUR + MINUTE
    clock_of(client).check()
    assert [to for to, _, _ in pushes(expo)] == [phone("ada")]


def test_a_hidden_member_s_group_runs_are_gone(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    run = made(client, ada)
    other = made(client, bob, title="Bob's heart")
    going(client, ada, other["id"])
    with database.connect() as conn:
        conn.execute("UPDATE users SET hidden_at = %s WHERE username = 'ada'", (NOW,))
    assert client.get(f"/group-runs/{run['id']}", headers=bob).status_code == 404
    assert names(detail(client, bob, other["id"])["people"]) == ["bob"]
    # The hidden member sees as before.
    assert names(detail(client, ada, other["id"])["people"]) == ["bob", "ada"]


# --- The Feed's row (EVENTI.md §5) ---


def test_the_feed_s_row(client: TestClient, wall: WallClock) -> None:
    me, friend, near, far, gone = (
        signed_up(client, n) for n in ("myself", "friend", "near", "far", "gone")
    )
    follows(client, me, friend)
    milan = points_at(*MILAN)
    made(client, me, title="Mine far", starts_in=5 * HOUR, points=milan)
    made(client, friend, title="Friend far", starts_in=4 * HOUR, points=milan)
    twins = [made(client, near, title=t, starts_in=3 * HOUR) for t in ("Near", "Too")]
    made(client, far, title="Far", starts_in=2 * HOUR, points=milan)
    mine = made(client, far, title="Far, I go", starts_in=6 * HOUR, points=milan)
    going(client, me, mine["id"])
    cancelled = made(client, near, title="Cancelled", starts_in=HOUR)
    gone_now = client.delete(f"/group-runs/{cancelled['id']}", headers=near)
    assert gone_now.status_code == 204
    made(client, gone, title="Over", starts_in=30 * MINUTE)
    wall.t = NOW + 30 * MINUTE + timedelta(hours=3)
    # By the start, then the id: the two at the same time in id order.
    same_time = [one["title"] for one in sorted(twins, key=lambda one: one["id"])]
    # Own, followed and gone to anywhere; the others' within 50 km.
    assert feed_row(client, me, TRENTO) == [
        *same_time,
        "Friend far",
        "Mine far",
        "Far, I go",
    ]
    # Without the phone's place, all of them.
    assert feed_row(client, me) == [
        "Far",
        *same_time,
        "Friend far",
        "Mine far",
        "Far, I go",
    ]
    # Who neither follows nor goes sees what is near the phone.
    assert feed_row(client, gone, MILAN) == [
        "Far",
        "Friend far",
        "Mine far",
        "Far, I go",
    ]
    assert feed_row(client, gone, TRENTO) == same_time
    # Half a point is refused, as by the Feed.
    assert client.get("/group-runs?lat=46", headers=me).status_code == 422


def test_the_row_holds_twenty_at_most(client: TestClient) -> None:
    organisers = [signed_up(client, f"runner{n}") for n in range(3)]
    for n in range(22):
        made(client, organisers[n % 3], title=f"Run {n:02}", starts_in=DAY + n * MINUTE)
    reader = signed_up(client, "reader")
    assert feed_row(client, reader) == [f"Run {n:02}" for n in range(20)]


# --- Who goes (EVENTI.md §6) ---


def test_going_twice_is_going_once_and_nobody_is_told(
    client: TestClient, database: Database, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada)
    going(client, bob, run["id"])
    going(client, bob, run["id"])
    seen = detail(client, bob, run["id"])
    assert seen["going"] == 2 and seen["i_am_going"] is True
    assert len(rows(database, "SELECT * FROM group_run_going")) == 1
    # No push to the organiser for someone going (EVENTI.md §6.4).
    assert pushes(expo) == []
    assert not_go(client, bob, run["id"]).status_code == 204
    assert not_go(client, bob, run["id"]).status_code == 204
    seen = detail(client, bob, run["id"])
    assert seen["going"] == 1 and seen["i_am_going"] is False
    assert pushes(expo) == []


def test_the_organiser_comes_first_and_always_goes(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    run = made(client, ada)
    going(client, bob, run["id"])
    assert names(detail(client, bob, run["id"])["people"]) == ["ada", "bob"]
    assert detail(client, bob, run["id"])["organiser"]["username"] == "ada"
    # Its «I'm going» changes nothing; its «Not going» is refused.
    going(client, ada, run["id"])
    assert len(rows(database, "SELECT * FROM group_run_going")) == 1
    assert error(not_go(client, ada, run["id"]), 422) == ORGANISER_GOES


def test_who_goes_comes_in_pages(client: TestClient, wall: WallClock) -> None:
    ada = signed_up(client, "ada")
    run = made(client, ada)
    others = []
    for n in range(21):
        wall.t = NOW + n * MINUTE
        others.append(f"r{n:02}")
        going(client, signed_up(client, others[-1]), run["id"])
    seen = detail(client, ada, run["id"])
    assert seen["going"] == 22
    assert names(seen["faces"]) == ["ada", "r00", "r01"]
    assert names(seen["people"]) == ["ada", *others[:19]]
    assert seen["next"] is not None
    rest = client.get(
        f"/group-runs/{run['id']}/going?cursor={seen['next']}", headers=ada
    ).json()
    assert names(rest["people"]) == others[19:]
    assert rest["next"] is None and rest["total"] == 22
    first = client.get(f"/group-runs/{run['id']}/going?limit=2", headers=ada).json()
    assert names(first["people"]) == ["ada", "r00"]
    assert (
        client.get(
            f"/group-runs/{run['id']}/going?cursor=nope", headers=ada
        ).status_code
        == 422
    )


def test_once_over_or_cancelled_no_more_answers(
    client: TestClient, wall: WallClock
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    run = made(client, ada, starts_in=HOUR)
    other = made(client, ada, title="Other", starts_in=2 * DAY)
    # Started: still open to «I'm going», closed to changes.
    wall.t = NOW + HOUR
    assert detail(client, bob, run["id"])["status"] == "started"
    going(client, bob, run["id"])
    assert error(change(client, ada, run["id"]), 422) == STARTED
    assert error(client.delete(f"/group-runs/{run['id']}", headers=ada), 422) == STARTED
    # Three hours after the start: over.
    wall.t = NOW + HOUR + timedelta(hours=3)
    assert detail(client, bob, run["id"])["status"] == "over"
    assert error(go(client, bob, run["id"]), 422) == OVER
    assert error(not_go(client, bob, run["id"]), 422) == OVER
    assert feed_row(client, bob) == ["Other"]
    # Cancelled.
    assert client.delete(f"/group-runs/{other['id']}", headers=ada).status_code == 204
    assert detail(client, bob, other["id"])["status"] == "cancelled"
    assert error(go(client, bob, other["id"]), 422) == CANCELLED
    assert error(not_go(client, bob, other["id"]), 422) == CANCELLED
    assert error(change(client, ada, other["id"]), 422) == CANCELLED


def test_the_profile_s_group_runs(client: TestClient, wall: WallClock) -> None:
    ada, bob, cleo = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    made(client, ada, title="Soon", starts_in=HOUR)
    made(client, ada, title="Later", starts_in=2 * DAY)
    made(client, ada, title="Friends only", starts_in=DAY, visibility="followers")
    cancelled = made(client, ada, title="Cancelled", starts_in=DAY)
    client.delete(f"/group-runs/{cancelled['id']}", headers=ada)
    wall.t = NOW + timedelta(hours=4, minutes=1)
    path = f"/users/{public_id(client, ada)}/group-runs"
    seen = client.get(path, headers=bob).json()
    assert [one["title"] for one in seen["upcoming"]] == ["Later"]
    assert [one["title"] for one in seen["past"]] == ["Soon"]
    own = client.get(path, headers=ada).json()
    assert [one["title"] for one in own["upcoming"]] == ["Friends only", "Later"]
    assert client.get(f"/users/{uuid4()}/group-runs", headers=cleo).status_code == 404


# --- Changing, cancelling (EVENTI.md §7) and the reminder (§8) ---


def test_only_the_organiser_changes_or_cancels(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    run = made(client, ada)
    assert error(change(client, bob, run["id"]), 404, "http_error") == NO_GROUP_RUN
    deleted = client.delete(f"/group-runs/{run['id']}", headers=bob)
    assert error(deleted, 404, "http_error") == NO_GROUP_RUN
    assert client.get(f"/group-runs/{uuid4()}", headers=bob).status_code == 404


def test_a_change_of_time_or_place_tells_who_goes_and_reminds_again(
    client: TestClient, database: Database, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada, starts_in=50 * MINUTE)
    going(client, bob, run["id"])
    clock = clock_of(client)
    assert clock.check() == [UUID(run["id"])]
    soon = "Star at the MUSE starts soon: see you at the start!"
    assert sorted(pushes(expo)) == [
        (phone("ada"), soon, {"kind": "group_run_soon", "group_run_id": run["id"]}),
        (phone("bob"), soon, {"kind": "group_run_soon", "group_run_id": run["id"]}),
    ]
    # Twice: once.
    assert clock.check() == []
    assert len(pushes(expo)) == 2
    # A new title only: nobody is told, the reminder stays sent.
    wall.t = NOW + MINUTE
    later = (NOW + 50 * MINUTE).isoformat()
    answer = change(
        client,
        ada,
        run["id"],
        title="New title",
        starts_at=later,
        meeting_note="MUSE entrance",
        description=_load("group-run-request.json")["description"],
    )
    assert answer.status_code == 200, answer.text
    assert answer.json()["title"] == "New title"
    assert len(pushes(expo)) == 2
    assert clock.check() == []
    # A new time: who goes is told, not the organiser, and the reminder is
    # sent again when the new time comes near.
    wall.t = NOW + 2 * MINUTE
    moved = (NOW + 3 * HOUR).isoformat()
    answer = change(client, ada, run["id"], starts_at=moved)
    assert answer.status_code == 200, answer.text
    assert answer.json()["meeting_note"] == "MUSE entrance, by the bikes"
    assert pushes(expo)[2:] == [
        (
            phone("bob"),
            "ada changed the time or place of Star at the MUSE.",
            {"kind": "group_run_changed", "group_run_id": run["id"]},
        )
    ]
    assert clock.check() == []
    wall.t = NOW + 2 * HOUR + MINUTE
    assert clock.check() == [UUID(run["id"])]
    assert sorted(to for to, _, _ in pushes(expo)[3:]) == [phone("ada"), phone("bob")]
    # A new time is checked as at the creation.
    too_soon = (wall.t + 10 * MINUTE).isoformat()
    assert error(change(client, ada, run["id"], starts_at=too_soon), 422) == WHEN_WRONG


def test_the_place_alone_tells_who_goes_too(
    client: TestClient, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada)
    going(client, bob, run["id"])
    same_time = (NOW + DAY).isoformat()
    answer = change(client, ada, run["id"], starts_at=same_time)
    assert answer.status_code == 200, answer.text
    assert [to for to, _, _ in pushes(expo)] == [phone("bob")]
    # Changing the texts once more, with the same place, tells nobody.
    wall.t = NOW + MINUTE
    answer = change(client, ada, run["id"], starts_at=same_time, description=None)
    assert answer.status_code == 200 and answer.json()["description"] is None
    assert len(pushes(expo)) == 1


def test_a_group_run_created_within_the_hour_is_reminded_at_the_first_check(
    client: TestClient, wall: WallClock, expo: FakeExpo
) -> None:
    ada = signed_up(client, "ada", push=True)
    early = made(client, ada, starts_in=40 * MINUTE)
    made(client, ada, title="Tomorrow")
    assert clock_of(client).check() == [UUID(early["id"])]
    # Started: never reminded after the start.
    wall.t = NOW + 41 * MINUTE
    late = made(client, ada, title="Late", starts_in=30 * MINUTE, at=wall.t)
    wall.t += 31 * MINUTE
    assert detail(client, ada, late["id"])["status"] == "started"
    assert clock_of(client).check() == []
    assert len(pushes(expo)) == 1


def test_the_reminder_respects_the_push_switch(
    client: TestClient, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada, starts_in=50 * MINUTE)
    going(client, bob, run["id"])
    push_on(client, bob, on=False)
    assert clock_of(client).check() == [UUID(run["id"])]
    assert [to for to, _, _ in pushes(expo)] == [phone("ada")]


def test_two_checks_at_once_remind_once(
    client: TestClient, database: Database, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada, starts_in=50 * MINUTE)
    going(client, bob, run["id"])
    # Two processes: two clocks, each with its own pusher and its memory.
    clocks = [
        clock_of(client),
        GroupRunClock(database, wall, lambda: sending(database, expo)),
    ]
    barrier = threading.Barrier(2)
    results: list[list[UUID]] = []

    def check(clock: GroupRunClock) -> None:
        barrier.wait()
        results.append(clock.check())

    threads = [threading.Thread(target=check, args=(c,)) for c in clocks]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results, key=len) == [[], [UUID(run["id"])]]
    assert sorted(to for to, _, _ in pushes(expo)) == [phone("ada"), phone("bob")]


def test_the_clock_runs_while_the_app_does(client: TestClient) -> None:
    clock = clock_of(client)
    scheduled: list[tuple[float, Any]] = []
    cancelled: list[bool] = []

    class Handle:
        def cancel(self) -> None:
            cancelled.append(True)

    clock.later = lambda delay, task: scheduled.append((delay, task)) or Handle()
    assert scheduled == []
    with TestClient(client.app):
        assert [delay for delay, _ in scheduled] == [CHECK_EVERY_S]
        scheduled[0][1]()
        assert [delay for delay, _ in scheduled] == [CHECK_EVERY_S] * 2
    assert cancelled == [True]
    scheduled[1][1]()
    assert len(scheduled) == 2


def test_the_clock_stops_before_the_database_closes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = clock_of(client)
    events: list[str] = []
    release = threading.Event()
    real_now = clock.now

    def slow_now() -> datetime:
        events.append("check")
        release.wait(10)
        events.append("checked")
        return real_now()

    clock.now = slow_now
    monkeypatch.setattr(Database, "close", lambda self: events.append("closed"))
    scheduled: list[Any] = []
    clock.later = lambda delay, task: scheduled.append(task)
    with TestClient(client.app):
        tick = threading.Thread(target=scheduled[0])
        tick.start()
        while events != ["check"]:
            time.sleep(0.01)
        threading.Timer(0.2, release.set).start()
    tick.join(10)
    assert events == ["check", "checked", "closed"]
    assert len(scheduled) == 1


def test_a_cancel_tells_who_goes_once(client: TestClient, expo: FakeExpo) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    run = made(client, ada)
    going(client, bob, run["id"])
    assert client.delete(f"/group-runs/{run['id']}", headers=ada).status_code == 204
    assert pushes(expo) == [
        (
            phone("bob"),
            "ada cancelled Star at the MUSE.",
            {"kind": "group_run_cancelled", "group_run_id": run["id"]},
        )
    ]
    # Cancelled again: done already, nobody told again.
    assert client.delete(f"/group-runs/{run['id']}", headers=ada).status_code == 204
    assert len(pushes(expo)) == 1
    # Opened from the push, it says so; it is out of the row and the profile.
    assert detail(client, bob, run["id"])["status"] == "cancelled"
    assert feed_row(client, bob) == []
    profile = client.get(f"/users/{public_id(client, ada)}/group-runs", headers=bob)
    assert profile.json() == {"upcoming": [], "past": []}
    assert clock_of(client).check() == []


def test_deleting_the_account_takes_its_rows_and_tells_who_went(
    client: TestClient, database: Database, wall: WallClock, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada", push=True), signed_up(client, "bob", push=True)
    upcoming = made(client, ada, title="Upcoming", starts_in=DAY)
    started = made(client, ada, title="Started", starts_in=30 * MINUTE)
    bobs = made(client, bob, title="Bob's")
    for run in (upcoming, started):
        going(client, bob, run["id"])
    going(client, ada, bobs["id"])
    wall.t = NOW + 31 * MINUTE
    assert client.delete("/me", headers=ada).status_code == 204
    # Only the one not started yet is told, as a cancellation.
    assert pushes(expo) == [
        (
            phone("bob"),
            "ada cancelled Upcoming.",
            {"kind": "group_run_cancelled", "group_run_id": upcoming["id"]},
        )
    ]
    assert [row["title"] for row in rows(database, "SELECT title FROM group_runs")] == [
        "Bob's"
    ]
    assert rows(database, "SELECT * FROM group_run_going") == []
    assert detail(client, bob, bobs["id"])["going"] == 1


# --- Reporting (EVENTI.md §9) ---


def test_a_group_run_is_reported_as_a_post(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    run = made(client, ada)
    body = {"kind": "group_run", "id": run["id"], "reason": "spam"}
    assert client.post("/reports", json=body, headers=bob).status_code == 204
    kept = rows(database, "SELECT kind, target_id FROM reports")
    assert kept == [{"kind": "group_run", "target_id": UUID(run["id"])}]
    own = client.post("/reports", json=body, headers=ada)
    assert error(own, 422) == NOT_YOURSELF_REPORT
    nothing = {**body, "id": str(uuid4())}
    assert client.post("/reports", json=nothing, headers=bob).status_code == 404
