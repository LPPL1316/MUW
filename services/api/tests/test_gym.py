"""A workout at the gym (TASK-385, ADR-0327), in a real PostgreSQL: saved
without a track with its sets, published without a line, and seen only by
an app whose X-MuW-Reads says both `gym` and `trackless` (ADR-0328)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    KEY,
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    drawn,
    follows,
    other,
    run,
    saved,
    signed_up,
    wall,  # noqa: F401
)

from shaperoute_api.activities import ActivityRequestBody
from shaperoute_api.db import Database
from shaperoute_api.gym_sessions import GymSessionRequestBody
from shaperoute_api.reads import READS_HEADER
from shaperoute_api.strava import SPORT_TYPES

FIXTURES = (
    Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "fixtures"
)
GYM_KEY = "9a8b7c6d5e4f3021"
# The app of before TASK-385 B0, which says no workout at the gym, and the
# app of today, which reads it.
BEFORE_B0 = "swimming,walking,skiing,xc_skiing"
GYM_APP = json.loads((FIXTURES / "reads.json").read_text(encoding="utf-8"))["this_app"]
Headers = dict[str, str]


def workout(**changes: Any) -> dict[str, Any]:
    body = json.loads((FIXTURES / "gym-session.json").read_text(encoding="utf-8"))
    return {**body, **changes}


def reading(headers: Headers, kinds: str = GYM_APP) -> Headers:
    return {**headers, READS_HEADER: kinds}


@pytest.fixture(autouse=True)
def after_the_workout(wall: WallClock) -> None:  # noqa: F811
    # The example workout is of the evening of 2026-11-05.
    wall.t = datetime(2026, 11, 5, 18, 10, tzinfo=UTC)


def kept(app: TestClient, headers: Headers, key: str = GYM_KEY, **changes: Any) -> Any:
    answer = app.put(
        f"/me/gym-sessions/{key}", json=workout(**changes), headers=headers
    )
    assert answer.status_code == 201, answer.text
    return answer.json()


def gym_post(app: TestClient, headers: Headers) -> str:
    """The example workout published for everyone, its drawing's id."""
    kept(app, headers)
    return str(drawn(app, headers, GYM_KEY, title="Push day")["id"])


# --- The contract, without a database ---


def test_the_example_is_a_request() -> None:
    body = GymSessionRequestBody.model_validate(workout())
    # 65 minutes, a pause of 5: the rests stay in.
    assert body.duration_s() == 3_600
    assert len(body.sets) == 10


@pytest.mark.parametrize(
    "item",
    [
        # Not in the catalog.
        {"exercise": "moon_press", "kind": "load", "reps": 1, "load_kg": 1},
        # Of another kind than the catalog's.
        {"exercise": "plank", "kind": "load", "reps": 1, "load_kg": 1},
        # A load without its kg.
        {"exercise": "bench_press", "kind": "load", "reps": 5},
        # A field of another kind.
        {"exercise": "plank", "kind": "timed", "duration_s": 60, "reps": 3},
        # A field its machine does not show.
        {"exercise": "stepper", "kind": "cardio", "duration_s": 60, "distance_m": 9},
        # Both a key and a name, or neither.
        {"exercise": "plank", "name": "Plank", "kind": "timed", "duration_s": 60},
        {"kind": "timed", "duration_s": 60},
    ],
)
def test_a_set_has_the_fields_of_its_kind_only(item: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        GymSessionRequestBody.model_validate(
            workout(sets=[{**item, "at_s": 10, "live": True}])
        )


def test_a_set_and_a_pause_are_inside_the_workout() -> None:
    late = {"exercise": "plank", "kind": "timed", "duration_s": 60}
    with pytest.raises(ValueError):
        GymSessionRequestBody.model_validate(
            workout(sets=[{**late, "at_s": 4_000, "live": False}])
        )
    with pytest.raises(ValueError):
        GymSessionRequestBody.model_validate(
            workout(pauses=[{"from_s": 3_800, "to_s": 4_000}])
        )
    with pytest.raises(ValueError):
        GymSessionRequestBody.model_validate(workout(ended_at=workout()["started_at"]))


def test_overlapping_pauses_count_once() -> None:
    body = GymSessionRequestBody.model_validate(
        workout(pauses=[{"from_s": 100, "to_s": 400}, {"from_s": 300, "to_s": 500}])
    )
    assert body.duration_s() == 3_900 - 400


def test_a_run_with_a_track_is_no_workout_at_the_gym() -> None:
    with pytest.raises(ValueError):
        ActivityRequestBody.model_validate(run(activity="gym"))
    assert "gym" not in SPORT_TYPES


# --- The database ---


def test_only_a_workout_at_the_gym_goes_without_a_track(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    kept(client, me)
    with database.connect() as conn:
        user_id = conn.execute("SELECT user_id FROM runs").fetchone()["user_id"]
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                "INSERT INTO runs (user_id, key, track, started_at, distance_m,"
                " duration_s, created_at, activity) VALUES"
                " (%s, 'abcdefgh12345678', NULL, now(), 0, 60, now(), 'running')",
                (user_id,),
            )


def test_a_workout_is_saved_once_with_its_sets(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    first = kept(client, me)
    assert first["id"] == GYM_KEY
    assert first["duration_s"] == 3_600
    assert (first["rests"], first["rest_s"]) == (6, 540)
    assert first["sets"] == workout()["sets"]
    again = client.put(f"/me/gym-sessions/{GYM_KEY}", json=workout(sets=[]), headers=me)
    assert again.status_code == 200
    assert again.json() == first
    assert client.get(f"/me/gym-sessions/{GYM_KEY}", headers=me).json() == first
    # Another account has none of it.
    stranger = other(client)
    assert (
        client.get(f"/me/gym-sessions/{GYM_KEY}", headers=stranger).status_code == 404
    )


def test_the_key_of_a_run_is_not_a_workout(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    saved(client, me)
    answer = client.put(f"/me/gym-sessions/{KEY}", json=workout(), headers=me)
    assert answer.status_code == 409
    assert client.get(f"/me/gym-sessions/{KEY}", headers=me).status_code == 404


def test_a_clock_that_is_no_clock_is_refused(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    answer = client.put(
        f"/me/gym-sessions/{GYM_KEY}",
        json=workout(
            started_at="2019-01-01T10:00:00Z", ended_at="2019-01-01T11:00:00Z"
        ),
        headers=me,
    )
    assert answer.status_code == 422


def test_my_activities_hold_it_for_an_app_that_reads_it(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    saved(client, me)
    kept(client, me)

    def listed(headers: Headers) -> list[tuple[str, list[Any]]]:
        answer = client.get("/me/activities", headers=headers)
        assert answer.status_code == 200, answer.text
        return [
            (a["activity"], a["track_preview"]) for a in answer.json()["activities"]
        ]

    assert [a for a, _ in listed(me)] == ["running"]
    assert [a for a, _ in listed(reading(me, BEFORE_B0))] == ["running"]
    # `gym` alone is not enough: it has no track.
    assert [a for a, _ in listed(reading(me, "gym"))] == ["running"]
    assert listed(reading(me))[0] == ("gym", [])


def test_deleting_the_run_deletes_its_sets(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    kept(client, me)
    assert client.delete(f"/me/activities/{GYM_KEY}", headers=me).status_code == 204
    with database.connect() as conn:
        for table in ("gym_sets", "gym_sessions"):
            count = conn.execute(f"SELECT count(*) AS n FROM {table}").fetchone()
            assert count["n"] == 0, table
    assert client.get(f"/me/gym-sessions/{GYM_KEY}", headers=me).status_code == 404


# --- Published without a line ---


def test_it_is_published_without_a_line(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    drawing_id = gym_post(client, me)
    with database.connect() as conn:
        row = conn.execute(
            "SELECT track IS NULL AS lineless, trackless, preview IS NULL AS bare"
            " FROM drawings"
        ).fetchone()
    assert (row["lineless"], row["trackless"], row["bare"]) == (True, True, True)
    seen = client.get(f"/drawings/{drawing_id}", headers=reading(me))
    assert seen.status_code == 200, seen.text
    assert seen.json()["activity"] == "gym"
    assert seen.json()["track"] == []


def test_a_drawing_cannot_turn_a_run_into_a_workout_or_back(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    saved(client, me)
    drawn(client, me, KEY, status=422, activity="gym")
    kept(client, me)
    drawn(client, me, GYM_KEY, status=422, activity="running")
    drawn(client, me, GYM_KEY, activity="gym")


def test_an_app_of_before_never_receives_it(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    follows(client, reader, me)
    saved(client, me)
    drawn(client, me, KEY)
    drawing_id = gym_post(client, me)

    def feed(headers: Headers) -> list[tuple[str, list[Any]]]:
        answer = client.get("/feed", headers=headers)
        assert answer.status_code == 200, answer.text
        return [(p["activity"], p["track_preview"]) for p in answer.json()["posts"]]

    # No header, the app of today, `gym` without `trackless`: a run only,
    # and the gym's drawing is not there.
    for kinds in (None, BEFORE_B0, f"{BEFORE_B0},gym", f"{BEFORE_B0},trackless"):
        headers = reader if kinds is None else reading(reader, kinds)
        assert [a for a, _ in feed(headers)] == ["running"], kinds
        assert client.get(f"/drawings/{drawing_id}", headers=headers).status_code == 404
        exercises = client.get(f"/drawings/{drawing_id}/exercises", headers=headers)
        assert exercises.status_code == 404
    # An app that reads both: the workout first, without a line.
    assert sorted(feed(reading(reader))) == sorted([("gym", []), *feed(reader)])
    assert (
        client.get(f"/drawings/{drawing_id}", headers=reading(reader)).status_code
        == 200
    )


def test_the_search_and_the_profile_follow_the_header(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    gym_post(client, me)
    mine = client.get("/me/drawings", headers=me)
    assert mine.status_code == 200
    assert mine.json()["drawings"] == []
    mine = client.get("/me/drawings", headers=reading(me))
    assert [d["activity"] for d in mine.json()["drawings"]] == ["gym"]
    public_id = client.get("/me", headers=me).json()["public_id"]
    for headers, expected in ((reader, []), (reading(reader), ["gym"])):
        answer = client.get(f"/users/{public_id}/drawings", headers=headers)
        assert answer.status_code == 200, answer.text
        assert [d["activity"] for d in answer.json()["drawings"]] == expected


# --- The exercises of the post ---


def test_the_post_shows_its_exercises_until_its_owner_hides_them(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    drawing_id = gym_post(client, me)
    path = f"/drawings/{drawing_id}/exercises"
    shown = client.get(path, headers=reading(reader))
    assert shown.status_code == 200, shown.text
    assert shown.json() == {"rests": 6, "rest_s": 540, "sets": workout()["sets"]}
    hide = client.put(
        f"/me/gym-sessions/{GYM_KEY}/show-exercises", json={"show": False}, headers=me
    )
    assert hide.status_code == 204
    assert client.get(path, headers=reading(reader)).status_code == 404
    # Its owner still sees them.
    assert client.get(path, headers=reading(me)).status_code == 200
    assert (
        client.get(f"/me/gym-sessions/{GYM_KEY}", headers=me).json()["show_exercises"]
        is False
    )
    missing = client.put(
        "/me/gym-sessions/0000000000000000/show-exercises",
        json={"show": True},
        headers=me,
    )
    assert missing.status_code == 404


def test_a_private_workout_shows_nothing_to_the_others(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    kept(client, me)
    drawing = drawn(client, me, GYM_KEY, visibility="only_me")
    path = f"/drawings/{drawing['id']}/exercises"
    assert client.get(path, headers=reading(reader)).status_code == 404
    assert client.get(path, headers=reading(me)).status_code == 200
    assert (
        client.get("/drawings/not-an-id/exercises", headers=reading(me)).status_code
        == 404
    )
