"""The challenges of the teams in a real PostgreSQL (TASK-296 part C,
ADR-0255, docs/GIOCO.md §6.2–§6.4): a shape cut into pieces for some days,
one challenge at a time per team; a member holds one piece, the runs that
count after the hold fill it and the metres left over move to the next free
piece; a fast piece is done by a best time; the last piece completes the
challenge and gives everyone who ran the team edition; past the deadline
and three hours the challenge is over; the members are told a day before;
what an account leaves behind when it goes."""

from __future__ import annotations

import threading
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_game_api import rows, run_body, save
from test_game_teams import joined, public_id, team_of
from test_push import FAST_HASHER, FakeExpo, push_on, put_token, signed_up

from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.game_challenges import (
    CHALLENGE_OVER,
    CHECK_EVERY_S,
    GRACE,
    HAS_CHALLENGE,
    HOLDING_ALREADY,
    NO_CHALLENGE,
    NO_PIECE,
    NO_SHAPE,
    NOT_YOUR_PIECE,
    PIECE_TAKEN,
    challenge_event,
)
from shaperoute_api.push import Pusher, PushEvent, data_of, text_of

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
ADA_PHONE = "ExponentPushToken[phone-of-ada]"
BOB_PHONE = "ExponentPushToken[phone-of-bob]"
DISTANCE_2_KM = {"kind": "distance", "total_m": 2_000}
FAST_KM = {"kind": "pace", "distance_m": 1_000, "pace_s": 300}


class Clock:
    """The API's clock, moved by hand."""

    def __init__(self) -> None:
        self.at = NOW

    def __call__(self) -> datetime:
        return self.at


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def client(database: Database, expo: FakeExpo, clock: Clock) -> TestClient:
    accounts = Accounts(database, now=clock, hasher=FAST_HASHER)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


def two(client: TestClient) -> tuple[Any, Any, Any]:
    """Ada's team with Bob in it, each with a phone and push on."""
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    put_token(client, ada, ADA_PHONE)
    put_token(client, bob, BOB_PHONE)
    push_on(client, ada)
    push_on(client, bob)
    team = team_of(client, ada)
    joined(client, bob, team["code"])
    return ada, bob, team


def challenge_of(
    client: TestClient,
    me: dict[str, str],
    team_id: str,
    pieces: int = 4,
    piece: dict[str, Any] = DISTANCE_2_KM,
    shape_id: str = "heart",
    **more: Any,
) -> Any:
    body = {"shape_id": shape_id, "pieces": pieces, "piece": piece, **more}
    answer = client.post(f"/game/teams/{team_id}/challenges", json=body, headers=me)
    assert answer.status_code == 201, answer.text
    return answer.json()


def hold(client: TestClient, me: dict[str, str], challenge_id: str, idx: int) -> Any:
    answer = client.post(
        f"/game/challenges/{challenge_id}/pieces/{idx}/hold", headers=me
    )
    assert answer.status_code == 200, answer.text
    return answer.json()


def read(client: TestClient, me: dict[str, str], challenge_id: str) -> Any:
    answer = client.get(f"/game/challenges/{challenge_id}", headers=me)
    assert answer.status_code == 200, answer.text
    return answer.json()


def ran(
    client: TestClient,
    me: dict[str, str],
    clock: Clock,
    metres: float,
    start: datetime,
    key: str,
    speed: float = 3.0,
    saved_at: datetime | None = None,
) -> None:
    """A run of `metres` at `speed` from `start`, saved when it is over, or
    at `saved_at`."""
    end = start + timedelta(seconds=metres / speed)
    clock.at = saved_at or end + timedelta(minutes=5)
    assert save(client, me, run_body([(metres, speed)], start=start), key) == 201


def pieces_of(challenge: Any) -> list[tuple[str | None, int, bool]]:
    """(holder, done_m, done) of each piece."""
    return [
        (
            None if p["holder"] is None else p["holder"]["username"],
            p["done_m"],
            p["done"],
        )
        for p in challenge["pieces"]
    ]


def gave(challenge: Any) -> list[tuple[str, int, int]]:
    return [(c["username"], c["idx"], c["metres"]) for c in challenge["contributions"]]


def told(expo: FakeExpo) -> list[tuple[str, dict[str, str]]]:
    return [(m["to"], m["data"]) for m in expo.sent]


AN_HOUR = timedelta(hours=1)


def test_a_challenge_cuts_the_shape_into_pieces_for_some_days(
    client: TestClient,
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    assert challenge["team_id"] == team["id"]
    assert challenge["shape_id"] == "heart"
    assert challenge["status"] == "active"
    assert challenge["starts_at"] == "2026-10-23T12:00:00Z"
    assert challenge["ends_at"] == "2026-10-30T12:00:00Z"
    assert challenge["completed_at"] is None
    assert challenge["seconds_left"] == 7 * 24 * 3600
    assert [p["idx"] for p in challenge["pieces"]] == [0, 1, 2, 3]
    assert pieces_of(challenge) == [(None, 0, False)] * 4
    goal = {"kind": "distance", "total_m": 2_000, "distance_m": None, "pace_s": None}
    assert all(p["goal"] == goal for p in challenge["pieces"])
    # The pieces of the outline join end to end and close the heart.
    outlines = [p["outline"] for p in challenge["pieces"]]
    assert all(len(o) >= 2 for o in outlines)
    assert all(a[-1] == b[0] for a, b in zip(outlines, outlines[1:], strict=False))
    assert outlines[-1][-1] == outlines[0][0]
    assert challenge["contributions"] == []
    # Bob reads it, by its id and in his teams; a stranger does not.
    assert read(client, bob, challenge["id"]) == challenge
    assert client.get("/game/teams", headers=bob).json()["teams"][0]["challenge"] == (
        challenge
    )
    carol = signed_up(client, "carol")
    answer = client.get(f"/game/challenges/{challenge['id']}", headers=carol)
    assert answer.status_code == 404
    assert answer.json()["error"]["message"] == NO_CHALLENGE


def test_a_challenge_shows_no_time_or_place_of_any_run(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"], days=3)
    hold(client, ada, challenge["id"], 0)
    ran(client, ada, clock, 1_000, NOW + AN_HOUR, "ada00001")
    challenge = read(client, bob, challenge["id"])
    assert set(challenge) == {
        "id",
        "team_id",
        "shape_id",
        "status",
        "starts_at",
        "ends_at",
        "completed_at",
        "seconds_left",
        "pieces",
        "contributions",
    }
    assert set(challenge["pieces"][0]) == {
        "idx",
        "goal",
        "holder",
        "done_m",
        "done",
        "outline",
    }
    assert set(challenge["pieces"][0]["holder"]) == {"public_id", "username"}
    assert set(challenge["contributions"][0]) == {
        "public_id",
        "username",
        "idx",
        "metres",
    }


def test_the_request_is_checked(client: TestClient) -> None:
    ada, bob, team = two(client)
    challenges = f"/game/teams/{team['id']}/challenges"
    bad = [
        {"shape_id": "heart", "pieces": 1, "piece": DISTANCE_2_KM},
        {"shape_id": "heart", "pieces": 13, "piece": DISTANCE_2_KM},
        {
            "shape_id": "heart",
            "pieces": 4,
            "piece": {"kind": "distance", "total_m": 500},
        },
        {
            "shape_id": "heart",
            "pieces": 4,
            "piece": {"kind": "distance", "total_m": 60_000},
        },
        {"shape_id": "heart", "pieces": 4, "piece": {"kind": "distance"}},
        {"shape_id": "heart", "pieces": 4, "piece": {**FAST_KM, "distance_m": 3_000}},
        {"shape_id": "heart", "pieces": 4, "piece": {**FAST_KM, "pace_s": 100}},
        {"shape_id": "heart", "pieces": 4, "piece": {**FAST_KM, "total_m": 2_000}},
        {"shape_id": "heart", "pieces": 4, "piece": DISTANCE_2_KM, "days": 0},
        {"shape_id": "heart", "pieces": 4, "piece": DISTANCE_2_KM, "days": 15},
        {"shape_id": "heart", "pieces": 4, "piece": DISTANCE_2_KM, "extra": 1},
    ]
    for body in bad:
        answer = client.post(challenges, json=body, headers=ada)
        assert answer.status_code == 422, (body, answer.text)
        assert answer.json()["error"]["code"] == "invalid_request"
    answer = client.post(
        challenges,
        json={"shape_id": "cat", "pieces": 4, "piece": DISTANCE_2_KM},
        headers=ada,
    )
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == NO_SHAPE
    # A stranger finds no team.
    carol = signed_up(client, "carol")
    body = {"shape_id": "heart", "pieces": 4, "piece": DISTANCE_2_KM}
    assert client.post(challenges, json=body, headers=carol).status_code == 404
    # One at a time per team: anyone of the team starts it.
    challenge_of(client, bob, team["id"])
    answer = client.post(challenges, json=body, headers=ada)
    assert answer.status_code == 409
    assert answer.json()["error"]["message"] == HAS_CHALLENGE


def test_a_run_after_the_hold_fills_the_piece_and_the_rest_moves_on(
    client: TestClient, clock: Clock, expo: FakeExpo
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    assert pieces_of(hold(client, ada, challenge["id"], 0))[0] == ("ada", 0, False)
    ran(client, ada, clock, 5_000, NOW + AN_HOUR, "ada00001")
    after = read(client, bob, challenge["id"])
    # Two pieces done, the third the runner's with what was left.
    assert pieces_of(after) == [
        ("ada", 2_000, True),
        ("ada", 2_000, True),
        ("ada", 1_000, False),
        (None, 0, False),
    ]
    assert gave(after) == [("ada", 0, 2_000), ("ada", 1, 2_000), ("ada", 2, 1_000)]
    assert after["status"] == "active"
    # What the run was worth, for the card after «Save».
    game = client.get("/game/runs/ada00001", headers=ada).json()
    assert game["counted"] and game["counted_m"] == 5_000
    assert game["pieces_done"] == [
        {
            "challenge_id": challenge["id"],
            "team_id": team["id"],
            "team_name": "Sunday runners",
            "shape_id": "heart",
            "idx": idx,
            "pieces": 4,
            "challenge_completed": False,
        }
        for idx in (0, 1)
    ]
    # Bob is told of each piece; Ada, who ran, is not. 5 km unlock the
    # triangle too: that push is Ada's.
    assert told(expo) == [
        (
            ADA_PHONE,
            {
                "kind": "shape_unlocked",
                "public_id": public_id(client, ada),
                "username": "ada",
            },
        ),
        (BOB_PHONE, {"kind": "piece_done", "challenge_id": challenge["id"]}),
        (BOB_PHONE, {"kind": "piece_done", "challenge_id": challenge["id"]}),
    ]
    # The next run goes on with the third piece.
    ran(client, ada, clock, 1_000, NOW + 3 * AN_HOUR, "ada00002")
    assert pieces_of(read(client, bob, challenge["id"]))[2] == ("ada", 2_000, True)


def test_a_run_outside_the_window_fills_nothing(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"], days=2)
    ends_at = NOW + timedelta(days=2)
    clock.at = NOW + AN_HOUR
    hold(client, ada, challenge["id"], 0)
    # Started before the hold.
    ran(client, ada, clock, 1_000, NOW + timedelta(minutes=30), "ada00001")
    # Started after the deadline.
    ran(client, ada, clock, 1_000, ends_at + timedelta(minutes=1), "ada00002")
    # Started before the deadline, saved more than three hours after it.
    ran(
        client,
        ada,
        clock,
        1_000,
        ends_at - timedelta(minutes=10),
        "ada00003",
        saved_at=ends_at + GRACE + timedelta(minutes=1),
    )
    assert pieces_of(read(client, bob, challenge["id"]))[0] == ("ada", 0, False)
    # Started before the deadline and saved within the three hours: counts.
    clock.at = NOW + 2 * AN_HOUR
    hold(client, bob, challenge["id"], 1)
    ran(
        client,
        bob,
        clock,
        1_000,
        ends_at - timedelta(minutes=10),
        "bob00001",
        saved_at=ends_at + GRACE - timedelta(minutes=1),
    )
    assert pieces_of(read(client, bob, challenge["id"]))[1] == ("bob", 1_000, False)


def test_a_piece_left_keeps_its_metres_for_the_next_holder(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    hold(client, ada, challenge["id"], 0)
    ran(client, ada, clock, 1_000, NOW + AN_HOUR, "ada00001")
    answer = client.delete(
        f"/game/challenges/{challenge['id']}/pieces/0/hold", headers=ada
    )
    assert answer.status_code == 200, answer.text
    assert pieces_of(answer.json())[0] == (None, 1_000, False)
    hold(client, bob, challenge["id"], 0)
    ran(client, bob, clock, 1_000, clock.at + AN_HOUR, "bob00001")
    after = read(client, ada, challenge["id"])
    assert pieces_of(after)[0] == ("bob", 2_000, True)
    assert gave(after) == [("ada", 0, 1_000), ("bob", 0, 1_000)]


def test_one_piece_in_progress_for_each_member(client: TestClient) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    pieces = f"/game/challenges/{challenge['id']}/pieces"
    hold(client, ada, challenge["id"], 0)
    refused = [
        (client.post(f"{pieces}/1/hold", headers=ada), HOLDING_ALREADY),
        (client.post(f"{pieces}/0/hold", headers=bob), PIECE_TAKEN),
        (client.delete(f"{pieces}/0/hold", headers=bob), NOT_YOUR_PIECE),
        (client.delete(f"{pieces}/1/hold", headers=ada), NOT_YOUR_PIECE),
    ]
    for answer, message in refused:
        assert answer.status_code == 409, answer.text
        assert answer.json()["error"]["message"] == message
    # Held again by the same member: nothing changes.
    assert pieces_of(hold(client, ada, challenge["id"], 0))[0] == ("ada", 0, False)
    answer = client.post(f"{pieces}/7/hold", headers=ada)
    assert answer.status_code == 404 and answer.json()["error"]["message"] == NO_PIECE
    assert client.post(f"{pieces}/12/hold", headers=ada).status_code == 422
    carol = signed_up(client, "carol")
    assert client.post(f"{pieces}/1/hold", headers=carol).status_code == 404


def test_a_fast_piece_is_done_by_a_best_time(client: TestClient, clock: Clock) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"], pieces=2, piece=FAST_KM)
    goal = {"kind": "pace", "total_m": None, "distance_m": 1_000, "pace_s": 300}
    assert challenge["pieces"][0]["goal"] == goal
    hold(client, ada, challenge["id"], 0)
    hold(client, bob, challenge["id"], 1)
    # Ada: 1.2 km at 3.6 m/s, 4:38 a kilometre. Bob: 5:33, not fast enough.
    ran(client, ada, clock, 1_200, NOW + AN_HOUR, "ada00001", speed=3.6)
    ran(client, bob, clock, 1_200, NOW + AN_HOUR, "bob00001", speed=3.0)
    after = read(client, ada, challenge["id"])
    assert pieces_of(after) == [("ada", 1_000, True), ("bob", 0, False)]
    assert gave(after) == [("ada", 0, 1_000)]
    assert client.get("/game/runs/bob00001", headers=bob).json()["pieces_done"] == []


def test_the_last_piece_completes_the_challenge_for_everyone_who_ran(
    client: TestClient, clock: Clock, database: Database, expo: FakeExpo
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(
        client, ada, team["id"], pieces=2, piece={"kind": "distance", "total_m": 1_000}
    )
    hold(client, ada, challenge["id"], 0)
    hold(client, bob, challenge["id"], 1)
    ran(client, ada, clock, 1_000, NOW + AN_HOUR, "ada00001")
    assert read(client, ada, challenge["id"])["status"] == "active"
    ran(client, bob, clock, 1_000, NOW + 2 * AN_HOUR, "bob00001")
    done = read(client, ada, challenge["id"])
    assert done["status"] == "completed"
    assert done["completed_at"] == clock.at.isoformat().replace("+00:00", "Z")
    assert pieces_of(done) == [("ada", 1_000, True), ("bob", 1_000, True)]
    game = client.get("/game/runs/bob00001", headers=bob).json()
    assert [(p["idx"], p["challenge_completed"]) for p in game["pieces_done"]] == [
        (1, True)
    ]
    # The team edition of the heart, for both, tied to the challenge.
    with database.connect() as conn:
        unlocks = conn.execute(
            "SELECT u.username, g.shape_id, g.run_id, g.challenge_id::text AS c"
            " FROM game_unlocks g JOIN users u ON u.id = g.user_id"
            " WHERE g.edition = 'team' ORDER BY u.username"
        ).fetchall()
    assert [tuple(row.values()) for row in unlocks] == [
        ("ada", "heart", None, challenge["id"]),
        ("bob", "heart", None, challenge["id"]),
    ]
    heart = {s["id"]: s for s in client.get("/game/me", headers=ada).json()["shapes"]}[
        "heart"
    ]
    assert heart["unlocked_at"] is None
    assert heart["team_unlocked_at"] == done["completed_at"]
    # Each piece told to the other; the shape done told to both.
    assert told(expo) == [
        (BOB_PHONE, {"kind": "piece_done", "challenge_id": challenge["id"]}),
        (ADA_PHONE, {"kind": "piece_done", "challenge_id": challenge["id"]}),
        (ADA_PHONE, {"kind": "challenge_done", "challenge_id": challenge["id"]}),
        (BOB_PHONE, {"kind": "challenge_done", "challenge_id": challenge["id"]}),
    ]
    # Another challenge may start now, and is the team's newest.
    again = challenge_of(client, bob, team["id"])
    assert (
        client.get("/game/teams", headers=ada).json()["teams"][0]["challenge"] == again
    )
    # The one before still reads, complete.
    assert read(client, ada, challenge["id"])["status"] == "completed"


def test_metres_left_with_no_free_piece_are_lost(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(
        client, ada, team["id"], pieces=2, piece={"kind": "distance", "total_m": 1_000}
    )
    hold(client, ada, challenge["id"], 0)
    hold(client, bob, challenge["id"], 1)
    ran(client, ada, clock, 5_000, NOW + AN_HOUR, "ada00001")
    after = read(client, ada, challenge["id"])
    assert pieces_of(after) == [("ada", 1_000, True), ("bob", 0, False)]
    assert gave(after) == [("ada", 0, 1_000)]


def test_a_member_of_two_teams_fills_a_piece_in_each(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    other = team_of(client, ada, "Other")
    first = challenge_of(client, ada, team["id"])
    second = challenge_of(client, ada, other["id"])
    hold(client, ada, first["id"], 0)
    hold(client, ada, second["id"], 3)
    ran(client, ada, clock, 1_000, NOW + AN_HOUR, "ada00001")
    assert pieces_of(read(client, ada, first["id"]))[0] == ("ada", 1_000, False)
    assert pieces_of(read(client, ada, second["id"]))[3] == ("ada", 1_000, False)


def test_past_the_deadline_the_challenge_is_over_and_another_starts(
    client: TestClient, clock: Clock
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"], days=1)
    clock.at = NOW + timedelta(days=1) + GRACE - timedelta(minutes=1)
    assert read(client, ada, challenge["id"])["status"] == "active"
    assert read(client, ada, challenge["id"])["seconds_left"] == 0
    answer = client.post(
        f"/game/teams/{team['id']}/challenges",
        json={"shape_id": "star", "pieces": 2, "piece": DISTANCE_2_KM},
        headers=ada,
    )
    assert answer.status_code == 409
    clock.at = NOW + timedelta(days=1) + GRACE
    assert read(client, ada, challenge["id"])["status"] == "expired"
    answer = client.post(
        f"/game/challenges/{challenge['id']}/pieces/0/hold", headers=ada
    )
    assert answer.status_code == 409
    assert answer.json()["error"]["message"] == CHALLENGE_OVER
    fresh = challenge_of(client, ada, team["id"], shape_id="star")
    assert fresh["status"] == "active"
    assert (
        client.get("/game/teams", headers=bob).json()["teams"][0]["challenge"] == fresh
    )


def test_a_day_before_the_deadline_the_members_are_told_once(
    client: TestClient, clock: Clock, expo: FakeExpo
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    game_clock = client.app.state.game_clock  # type: ignore[attr-defined]
    clock.at = NOW + timedelta(days=5, hours=23)
    assert game_clock.check() == []
    clock.at = NOW + timedelta(days=6, hours=1)
    assert [str(c) for c in game_clock.check()] == [challenge["id"]]
    assert told(expo) == [
        (ADA_PHONE, {"kind": "challenge_ending", "challenge_id": challenge["id"]}),
        (BOB_PHONE, {"kind": "challenge_ending", "challenge_id": challenge["id"]}),
    ]
    # Told once, whatever the next checks find.
    clock.at = NOW + timedelta(days=6, hours=20)
    assert game_clock.check() == []
    assert len(expo.sent) == 2
    # A challenge of one day is never told «1 day left»; a complete one
    # neither.
    carol = signed_up(client, "carol")
    alone = team_of(client, carol, "Alone")
    short = challenge_of(client, carol, alone["id"], days=1)
    clock.at += AN_HOUR
    assert game_clock.check() == []
    assert short["status"] == "active"


def test_the_clock_runs_while_the_app_does(client: TestClient) -> None:
    app = client.app
    game_clock = app.state.game_clock  # type: ignore[attr-defined]
    scheduled: list[tuple[float, Any]] = []
    cancelled: list[bool] = []

    class Handle:
        def cancel(self) -> None:
            cancelled.append(True)

    game_clock.later = lambda delay, task: scheduled.append((delay, task)) or Handle()
    # Without the lifespan (this test's client) nothing is scheduled.
    assert scheduled == []
    with TestClient(app):
        assert [delay for delay, _ in scheduled] == [CHECK_EVERY_S]
        scheduled[0][1]()
        # A tick checks and schedules the next.
        assert [delay for delay, _ in scheduled] == [CHECK_EVERY_S] * 2
    assert cancelled == [True]
    # Stopped: a late tick schedules nothing more.
    scheduled[1][1]()
    assert len(scheduled) == 2


def test_deleting_a_member_s_account_frees_its_piece_and_keeps_the_challenge(
    client: TestClient, clock: Clock, database: Database
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, bob, team["id"])
    hold(client, bob, challenge["id"], 1)
    ran(client, bob, clock, 1_000, NOW + AN_HOUR, "bob00001")
    assert client.delete("/me", headers=bob).status_code == 204
    after = read(client, ada, challenge["id"])
    # The piece is free with its metres, with no name on them.
    assert pieces_of(after)[1] == (None, 1_000, False)
    assert after["contributions"] == []
    assert rows(database, "game_contributions") == 0
    with database.connect() as conn:
        row = conn.execute("SELECT created_by FROM game_challenges").fetchone()
    assert row is not None and row["created_by"] is None
    # The owner's account gone too: the team and its challenge go with the
    # last member.
    assert client.delete("/me", headers=ada).status_code == 204
    for table in ("game_teams", "game_challenges", "game_pieces"):
        assert rows(database, table) == 0


def test_deleting_a_run_keeps_the_metres_it_gave(
    client: TestClient, clock: Clock, database: Database
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    hold(client, ada, challenge["id"], 0)
    ran(client, ada, clock, 1_000, NOW + AN_HOUR, "ada00001")
    assert client.delete("/me/activities/ada00001", headers=ada).status_code == 204
    after = read(client, bob, challenge["id"])
    assert pieces_of(after)[0] == ("ada", 1_000, False)
    assert gave(after) == [("ada", 0, 1_000)]
    with database.connect() as conn:
        row = conn.execute("SELECT run_id FROM game_contributions").fetchone()
    assert row is not None and row["run_id"] is None


def test_leaving_the_team_frees_the_piece(client: TestClient, clock: Clock) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    hold(client, bob, challenge["id"], 2)
    members = f"/game/teams/{team['id']}/members"
    assert (
        client.delete(f"{members}/{public_id(client, bob)}", headers=bob).status_code
        == 204
    )
    assert pieces_of(read(client, ada, challenge["id"]))[2] == (None, 0, False)
    # Back in, Bob's old hold is gone: a run of his fills nothing.
    joined(client, bob, team["code"])
    ran(client, bob, clock, 1_000, NOW + AN_HOUR, "bob00001")
    assert pieces_of(read(client, ada, challenge["id"]))[2] == (None, 0, False)


def test_the_challenges_want_a_session(client: TestClient) -> None:
    some = "0" * 8 + "-0000-4000-8000-" + "0" * 12
    assert client.get(f"/game/challenges/{some}").status_code == 401
    assert client.post(f"/game/challenges/{some}/pieces/0/hold").status_code == 401
    assert client.post(f"/game/teams/{some}/challenges", json={}).status_code == 401


def test_two_checks_at_once_tell_once(
    client: TestClient, clock: Clock, expo: FakeExpo
) -> None:
    ada, bob, team = two(client)
    challenge = challenge_of(client, ada, team["id"])
    clock.at = NOW + timedelta(days=6, hours=1)
    game_clock = client.app.state.game_clock  # type: ignore[attr-defined]
    barrier = threading.Barrier(2)
    results: list[list[Any]] = []

    def check() -> None:
        barrier.wait()
        results.append(game_clock.check())

    threads = [threading.Thread(target=check) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    # The database says who told: the row is marked by one of the two.
    assert sorted(results, key=len) == [[], [UUID(challenge["id"])]]
    assert sorted(m["to"] for m in expo.sent) == [ADA_PHONE, BOB_PHONE]


def test_the_clock_stops_before_the_database_closes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = client.app
    game_clock = app.state.game_clock  # type: ignore[attr-defined]
    events: list[str] = []
    release = threading.Event()
    real_now = game_clock.now

    def slow_now() -> datetime:
        events.append("check")
        release.wait(10)
        events.append("checked")
        return real_now()

    game_clock.now = slow_now
    monkeypatch.setattr(Database, "close", lambda self: events.append("closed"))
    scheduled: list[Any] = []
    game_clock.later = lambda delay, task: scheduled.append(task)
    with TestClient(app):
        tick = threading.Thread(target=scheduled[0])
        tick.start()
        while events != ["check"]:
            time.sleep(0.01)
        # The app shuts down while a check runs: the check ends first.
        threading.Timer(0.2, release.set).start()
    tick.join(10)
    assert events == ["check", "checked", "closed"]
    assert len(scheduled) == 1


def test_the_events_of_before_keep_their_data_and_texts() -> None:
    who = uuid4()
    follow = PushEvent("follow_request", 1, 2)
    assert data_of(follow, who, "ada") == {
        "kind": "follow_request",
        "public_id": str(who),
        "username": "ada",
    }
    assert text_of(follow, "ada", "it") == "ada ha chiesto di seguirti."
    unlocked = PushEvent("shape_unlocked", 1, 1, key="triangle")
    assert text_of(unlocked, "ada", None) == (
        "You unlocked a new shape! Find it in your collection, in Play."
    )
    # The challenges' events open the challenge, and name the shape in the
    # phone's language.
    challenge_id = uuid4()
    piece = challenge_event("piece_done", 1, 2, challenge_id, "heart", number=2)
    assert data_of(piece, who, "ada") == {
        "kind": "piece_done",
        "challenge_id": str(challenge_id),
    }
    assert text_of(piece, "ada", "it") == "Cuore: ada ha finito il pezzo 2."
    assert text_of(piece, "ada", None) == "Heart: ada finished piece 2."
    ending = challenge_event("challenge_ending", 2, 2, challenge_id, "star", number=3)
    assert text_of(ending, "bob", "de") == "Stern: noch 1 Tag. Fehlende Teile: 3."
    done = challenge_event("challenge_done", 1, 2, challenge_id, "star")
    assert text_of(done, "ada", "fr") == (
        "Étoile : la forme est complète ! Ton équipe l'a dessinée ensemble."
    )
