"""The personal bests (TASK-368, ADR-0312): the fastest stretch of each
distance inside a run, and the best of them on the profile, for everyone
with the time and the day, the run only for who may see it.

A run of a group run (TASK-309) is saved as any other: the group run is the
day and the route, never a link to the runs, so it needs no test of its own.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from route_engine.track_score import TrackPoint

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.personal_bests import (
    BY_BIKE,
    BY_BIKE_KMH,
    EARTH_RADIUS_M,
    ON_FOOT,
    SPORTS,
    bests,
    run_bests,
)
from shaperoute_api.personal_bests_backfill import backfill
from shaperoute_api.profile_bests import PersonalBestBody
from shaperoute_api.profiles import PublicProfileBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
# Metres of one degree of latitude, on the sphere haversine_m counts on.
DEGREE_M = EARTH_RADIUS_M * math.pi / 180
START = (46.0671, 11.1214)


@dataclass(frozen=True)
class Pause:
    from_s: float
    to_s: float
    auto: bool = False


def line(*legs: tuple[float, float, int]) -> list[TrackPoint]:
    """A track north from START: for each leg, `n` steps of `metres` in
    `seconds` each."""
    points = [TrackPoint(START[0], START[1], 0.0)]
    metres = seconds = 0.0
    for step_m, step_s, n in legs:
        for _ in range(n):
            metres += step_m
            seconds += step_s
            points.append(TrackPoint(START[0] + metres / DEGREE_M, START[1], seconds))
    return points


# --- The stretches, without a database ---


def test_a_run_of_exactly_10_km_is_its_own_10k_and_has_a_5k() -> None:
    # 100 steps of 100 m in 30 s: 10 km in 50 minutes.
    found = bests(line((100, 30, 100)), [], "running")
    assert found == {"5k": 1_500, "10k": 3_000}


def test_the_10k_is_the_fastest_stretch_inside_a_longer_run() -> None:
    # 25 km: 7.5 km slow, 10 km fast in the middle, 7.5 km slow.
    track = line((100, 36, 75), (100, 27, 100), (100, 36, 75))
    found = bests(track, [], "running")
    assert found["10k"] == 2_700
    assert found["5k"] == 1_350
    assert found["15k"] == 2_700 + 50 * 36
    assert found["half"] < 25_000 * 0.36
    assert "30k" not in found


def test_the_distance_ends_between_two_points() -> None:
    # Steps of 300 m in 90 s: 5 km is 16 steps and two thirds of one.
    found = bests(line((300, 90, 20)), [], "running")
    assert found["5k"] == 1_500


def test_a_pause_inside_the_stretch_is_left_out() -> None:
    track = line((100, 30, 100))
    # Ten minutes stopped at 4 km, the clock running: not of the run.
    stopped = line((100, 30, 40), (0.0, 600, 1), (100, 30, 60))
    found = bests(stopped, [Pause(1_200, 1_800)], "running")
    assert found == bests(track, [], "running")


def test_a_step_across_a_pause_the_runner_made_is_not_run() -> None:
    # 5 km, a pause in which the phone moved 2 km, 5 km more.
    track = line((100, 30, 50), (2_000, 300, 1), (100, 30, 50))
    found = bests(track, [Pause(1_500, 1_800)], "running")
    assert found["10k"] == 3_000


def test_a_jump_of_the_gps_keeps_out_only_the_stretches_with_it() -> None:
    # 6 km, a jump of 1 km in 10 s, 6 km more, slower.
    track = line((100, 30, 60), (1_000, 10, 1), (100, 33, 60))
    found = bests(track, [], "running")
    assert found["5k"] == 1_500
    assert "10k" not in found
    # By bike 1 km in 10 s is still too fast: 360 km/h.
    assert "10k" not in bests(track, [], "cycling")


def test_a_time_faster_than_the_world_record_is_not_believed() -> None:
    record = {d.name: d.record_s for d in ON_FOOT.distances}["5k"]
    # 5 km in a car at 24 km/h a step: no step a jump, faster than anyone.
    found = bests(line((100, 1, 50)), [], "running")
    assert "5k" not in found
    assert record > 50
    # By bike the floor is a jump's speed throughout: 10 km at 88 km/h is
    # believed.
    assert bests(line((1_000, 41, 10)), [], "cycling") == {"10k": 410}
    assert {d.record_s for d in BY_BIKE.distances if d.name == "10k"} == {
        round(10_000 / (BY_BIKE_KMH / 3.6))
    }


def test_a_run_shorter_than_a_distance_has_no_best_of_it() -> None:
    assert bests(line((100, 30, 49)), [], "running") == {}
    assert bests([TrackPoint(*START, 0.0)], [], "running") == {}


def test_a_run_has_its_bests_of_both_sports() -> None:
    # 20 km at 30 km/h: on foot faster than the jump of a step, by bike not.
    found = run_bests(line((250, 30, 80)), [])
    assert {(b.sport, b.distance) for b in found} == {
        ("cycling", "10k"),
        ("cycling", "20k"),
    }


def test_the_example_of_shared_types_is_the_contract() -> None:
    examples = _load("personal-bests.json")
    for example in examples:
        assert set(example) == set(PersonalBestBody.model_fields)
        best = PersonalBestBody.model_validate(example)
        names = [d.name for d in SPORTS[best.sport].distances]
        metres = [d.metres for d in SPORTS[best.sport].distances]
        assert best.distance_m == metres[names.index(best.distance)]


# --- The profile, with a database ---

KEYS = ["a1b2c3d4e5f60718", "b2c3d4e5f6071829", "c3d4e5f60718293a"]


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 3, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


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


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


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


def five_k(
    step_s: float, day: int = 0, source: str = "muw", activity: str = "running"
) -> dict[str, Any]:
    """A run of 5.1 km north, 51 steps of 100 m in `step_s` seconds, on
    the first of November plus `day`."""
    start_ms = 1_793_491_200_000 + day * 86_400_000
    return {
        "track": [
            {
                "point": [START[0] + i * 100 / DEGREE_M, START[1]],
                "time_ms": start_ms + round(i * step_s * 1000),
                "accuracy_m": 5.0,
            }
            for i in range(52)
        ],
        "pauses": [],
        "points": None,
        "similarity": None,
        "activity": activity,
        "source": source,
    }


def saved(client: TestClient, headers: Headers, key: str, body: dict[str, Any]) -> None:
    answer = client.put(f"/me/activities/{key}", json=body, headers=headers)
    assert answer.status_code == 201, answer.text


def published(client: TestClient, headers: Headers, key: str, visibility: str) -> str:
    answer = client.put(
        f"/me/activities/{key}/drawing",
        json={"title": "Morning", "visibility": visibility},
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


def bests_seen(client: TestClient, viewer: Headers, owner: Headers) -> list[Any]:
    answer = client.get(f"/users/{public_id(client, owner)}", headers=viewer)
    assert answer.status_code == 200, answer.text
    body = PublicProfileBody.model_validate(answer.json())
    return [b.model_dump(mode="json") for b in body.personal_bests]


def test_a_profile_without_runs_has_no_bests(client: TestClient) -> None:
    owner = signed_up(client, 1)
    assert bests_seen(client, owner, owner) == []


def test_everyone_sees_the_best_with_its_day_and_only_the_owner_its_key(
    client: TestClient,
) -> None:
    owner, other = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(30))
    mine = bests_seen(client, owner, owner)
    assert mine == [
        {
            "sport": "running",
            "distance": "5k",
            "distance_m": 5000.0,
            "seconds": 1_500,
            "started_at": "2026-11-01T00:00:00Z",
            "drawing": None,
            "key": KEYS[0],
        }
    ]
    # Never published, so private: the time and the day, never the run.
    seen = bests_seen(client, other, owner)
    assert seen == [{**mine[0], "key": None}]


def test_the_drawing_opens_only_for_who_may_see_it(client: TestClient) -> None:
    owner, follower, other = (signed_up(client, n) for n in (1, 2, 3))
    follows(client, follower, owner)
    saved(client, owner, KEYS[0], five_k(30))
    drawing = published(client, owner, KEYS[0], "followers")
    assert bests_seen(client, follower, owner)[0]["drawing"] == drawing
    assert bests_seen(client, other, owner)[0]["drawing"] is None
    assert bests_seen(client, owner, owner)[0]["drawing"] == drawing
    # Only me: closed to the others, the time still theirs to see.
    published(client, owner, KEYS[0], "only_me")
    assert bests_seen(client, follower, owner)[0]["drawing"] is None
    assert bests_seen(client, follower, owner)[0]["seconds"] == 1_500


def test_the_best_is_the_fastest_run_and_a_deleted_one_passes_it_on(
    client: TestClient,
) -> None:
    owner = signed_up(client, 1)
    saved(client, owner, KEYS[0], five_k(30, day=0))
    # Imported from another app: it counts as well.
    saved(client, owner, KEYS[1], five_k(27, day=1, source="file"))
    saved(client, owner, KEYS[2], five_k(33, day=2))
    best = bests_seen(client, owner, owner)[0]
    assert (best["seconds"], best["key"]) == (1_350, KEYS[1])
    gone = client.delete(f"/me/activities/{KEYS[1]}", headers=owner)
    assert gone.status_code == 204
    best = bests_seen(client, owner, owner)[0]
    assert (best["seconds"], best["key"]) == (1_500, KEYS[0])


def test_a_run_counts_for_the_sport_it_is_now_and_paddling_never(
    client: TestClient,
) -> None:
    owner = signed_up(client, 1)
    saved(client, owner, KEYS[0], five_k(30, activity="paddling"))
    assert bests_seen(client, owner, owner) == []
    # Published as a run: its bests on foot are there, counted at the save.
    answer = client.put(
        f"/me/activities/{KEYS[0]}/drawing",
        json={"title": "Morning", "visibility": "everyone", "activity": "running"},
        headers=owner,
    )
    assert answer.status_code == 200, answer.text
    assert [b["distance"] for b in bests_seen(client, owner, owner)] == ["5k"]


def test_across_a_block_there_is_no_profile_and_so_no_bests(
    client: TestClient,
) -> None:
    owner, other = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(30))
    blocked = client.put(f"/users/{public_id(client, other)}/block", headers=owner)
    assert blocked.status_code == 204
    answer = client.get(f"/users/{public_id(client, owner)}", headers=other)
    assert answer.status_code == 404


def _kept(database: Database) -> list[tuple[int, str, str, int]]:
    with database.connect() as conn:
        rows = conn.execute(
            "SELECT run_id, sport, distance, seconds FROM run_bests"
            " ORDER BY run_id, sport, distance"
        ).fetchall()
    return [(r["run_id"], r["sport"], r["distance"], r["seconds"]) for r in rows]


def test_the_backfill_counts_the_runs_saved_before_as_the_save_does(
    client: TestClient, database: Database
) -> None:
    owner = signed_up(client, 1)
    saved(client, owner, KEYS[0], five_k(30))
    saved(client, owner, KEYS[1], five_k(27, day=1, source="file"))
    counted = _kept(database)
    assert len(counted) == 2
    # The runs as they were before part A: no bests kept.
    with database.connect() as conn:
        conn.execute("DELETE FROM run_bests")
    assert bests_seen(client, owner, owner) == []

    done = backfill(database)
    assert (done.runs, done.bests) == (2, 2)
    assert _kept(database) == counted
    assert [b["seconds"] for b in bests_seen(client, owner, owner)] == [1_350]
    # Twice, the same.
    backfill(database)
    assert _kept(database) == counted
