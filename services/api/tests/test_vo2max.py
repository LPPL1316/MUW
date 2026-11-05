"""The VO₂ max on the profile in a real PostgreSQL (TASK-397, ADR-0332):
nothing without its owner's yes, the value of Health first, else the
estimate from the running bests, and the value gone when the yes ends."""

from __future__ import annotations

import json
import math
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database, migrations
from shaperoute_api.personal_bests import EARTH_RADIUS_M
from shaperoute_api.profiles import PublicProfileBody
from shaperoute_api.vo2max import (
    IN_THE_FUTURE,
    TURNED_OFF,
    Vo2MaxReadingRequestBody,
    Vo2MaxSettingsBody,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
DEGREE_M = EARTH_RADIUS_M * math.pi / 180
START = (46.0671, 11.1214)
KEYS = ["a1b2c3d4e5f60718", "b2c3d4e5f6071829"]
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# --- The contract, without a database ---


def test_the_examples_of_shared_types_are_the_contract() -> None:
    settings = _load("vo2max-settings.json")
    assert set(settings) == set(Vo2MaxSettingsBody.model_fields)
    shown = Vo2MaxSettingsBody.model_validate(settings)
    assert shown.vo2max is not None
    assert set(settings["vo2max"]) == set(type(shown.vo2max).model_fields)
    reading = _load("vo2max-reading-request.json")
    assert set(reading) == set(Vo2MaxReadingRequestBody.model_fields)
    Vo2MaxReadingRequestBody.model_validate(reading)
    assert _load("public-profile.json")["vo2max"] is None


def test_the_migration_comes_after_the_bests() -> None:
    names = [path.name for path in migrations()]
    assert names.index("0049_vo2max.sql") > names.index("0042_run_bests.sql")


# --- With a database ---


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 11, 3, 9, 0, tzinfo=UTC)

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
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            run_places=PlaceNames(None),
        )
    )


def signed_up(client: TestClient, n: int) -> Headers:
    body = {
        **_load("sign-up-request.json"),
        "email": f"runner{n}@example.com",
        "username": f"runner_{n}",
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def five_k(step_s: float, activity: str = "running") -> dict[str, Any]:
    """A run of 5.1 km north on the first of November, 51 steps of 100 m
    in `step_s` seconds: its 5K takes 50 steps."""
    start_ms = 1_793_491_200_000
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
        "source": "muw",
    }


def saved(client: TestClient, headers: Headers, key: str, body: dict[str, Any]) -> None:
    answer = client.put(f"/me/activities/{key}", json=body, headers=headers)
    assert answer.status_code == 201, answer.text


def seen_by(client: TestClient, viewer: Headers, owner: Headers) -> Any:
    who = client.get("/me", headers=owner).json()["public_id"]
    answer = client.get(f"/users/{who}", headers=viewer)
    assert answer.status_code == 200, answer.text
    return PublicProfileBody.model_validate(answer.json()).model_dump(mode="json")[
        "vo2max"
    ]


def show(client: TestClient, headers: Headers, on: bool) -> dict[str, Any]:
    answer = client.put("/me/vo2max", json={"show": on}, headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def read(client: TestClient, headers: Headers, value: float, measured_on: str) -> Any:
    return client.put(
        "/me/vo2max/reading",
        json={"value": value, "measured_on": measured_on, "source": "apple_health"},
        headers=headers,
    )


ESTIMATE = {
    "value": 50,
    "source": "estimate",
    "measured_on": "2026-11-01",
    "from_distance": "5k",
}


def test_every_endpoint_needs_an_account(client: TestClient) -> None:
    assert client.get("/me/vo2max").status_code == 401
    assert client.put("/me/vo2max", json={"show": True}).status_code == 401
    assert client.delete("/me/vo2max/reading").status_code == 401


def test_without_the_yes_nobody_sees_it_and_the_owner_sees_what_would_show(
    client: TestClient,
) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    assert client.get("/me/vo2max", headers=owner).json() == {
        "show": False,
        "vo2max": None,
    }
    saved(client, owner, KEYS[0], five_k(24))  # a 5K in 20:00
    assert seen_by(client, viewer, owner) is None
    assert seen_by(client, owner, owner) is None
    assert client.get("/me/vo2max", headers=owner).json() == {
        "show": False,
        "vo2max": ESTIMATE,
    }


def test_with_the_yes_everyone_sees_the_estimate_of_the_fastest_best(
    client: TestClient,
) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(27))
    saved(client, owner, KEYS[1], five_k(24))
    assert show(client, owner, True) == {"show": True, "vo2max": ESTIMATE}
    assert seen_by(client, viewer, owner) == ESTIMATE


def test_a_ride_is_no_running_best(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(12, activity="cycling"))
    show(client, owner, True)
    assert seen_by(client, viewer, owner) is None


def test_a_run_older_than_a_year_no_longer_counts(
    client: TestClient, wall: WallClock
) -> None:
    owner = signed_up(client, 1)
    public_id = client.get("/me", headers=owner).json()["public_id"]
    saved(client, owner, KEYS[0], five_k(24))
    show(client, owner, True)
    wall.t = datetime(2027, 11, 2, 9, 0, tzinfo=UTC)
    # Sessions of a year ago have run out: a new member looks.
    viewer = signed_up(client, 2)
    answer = client.get(f"/users/{public_id}", headers=viewer)
    assert answer.status_code == 200, answer.text
    assert answer.json()["vo2max"] is None


def test_the_value_of_health_comes_before_the_estimate(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(24))
    show(client, owner, True)
    answer = read(client, owner, 47.6, "2026-11-02")
    assert answer.status_code == 200, answer.text
    health = {
        "value": 48,
        "source": "apple_health",
        "measured_on": "2026-11-02",
        "from_distance": None,
    }
    assert answer.json() == {"show": True, "vo2max": health}
    assert seen_by(client, viewer, owner) == health
    # A newer one takes its place.
    read(client, owner, 51.2, "2026-11-03")
    assert seen_by(client, viewer, owner)["value"] == 51


def test_a_value_of_health_older_than_a_year_gives_way_to_the_estimate(
    client: TestClient,
) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(24))
    show(client, owner, True)
    assert read(client, owner, 55, "2025-11-01").status_code == 200
    assert seen_by(client, viewer, owner) == ESTIMATE


def test_no_value_of_health_without_the_yes(
    client: TestClient, database: Database
) -> None:
    owner = signed_up(client, 1)
    refused = read(client, owner, 47.6, "2026-11-02")
    assert refused.status_code == 409
    assert refused.json()["error"]["message"] == TURNED_OFF
    show(client, owner, False)
    assert read(client, owner, 47.6, "2026-11-02").status_code == 409
    with database.connect() as conn:
        rows = conn.execute("SELECT value FROM vo2max").fetchall()
    assert [row["value"] for row in rows] == [None]


@pytest.mark.parametrize(
    ("value", "measured_on"),
    [(9.9, "2026-11-02"), (90.1, "2026-11-02"), (50, "2026-11-05"), (50, "yesterday")],
)
def test_a_value_out_of_range_or_after_today_is_refused(
    client: TestClient, value: float, measured_on: str
) -> None:
    owner = signed_up(client, 1)
    show(client, owner, True)
    answer = read(client, owner, value, measured_on)
    assert answer.status_code == 422
    if measured_on == "2026-11-05":
        assert answer.json()["error"]["message"] == IN_THE_FUTURE


def test_a_day_of_margin_for_the_time_zones(client: TestClient) -> None:
    owner = signed_up(client, 1)
    show(client, owner, True)
    assert read(client, owner, 50, "2026-11-04").status_code == 200


def test_turning_it_off_hides_it_and_takes_the_value_away(
    client: TestClient, database: Database
) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(24))
    show(client, owner, True)
    read(client, owner, 47.6, "2026-11-02")
    assert show(client, owner, False) == {"show": False, "vo2max": ESTIMATE}
    assert seen_by(client, viewer, owner) is None
    with database.connect() as conn:
        row = conn.execute("SELECT value, source, measured_on FROM vo2max").fetchone()
    assert row == {"value": None, "source": None, "measured_on": None}
    # On again, the estimate until the phone sends a value again.
    show(client, owner, True)
    assert seen_by(client, viewer, owner) == ESTIMATE


def test_forgetting_the_value_leaves_the_estimate(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    saved(client, owner, KEYS[0], five_k(24))
    show(client, owner, True)
    read(client, owner, 47.6, "2026-11-02")
    assert client.delete("/me/vo2max/reading", headers=owner).status_code == 204
    assert seen_by(client, viewer, owner) == ESTIMATE
    assert client.get("/me/vo2max", headers=owner).json()["show"] is True


def test_deleting_the_account_deletes_its_row(
    client: TestClient, database: Database
) -> None:
    owner = signed_up(client, 1)
    show(client, owner, True)
    read(client, owner, 47.6, "2026-11-02")
    with database.connect() as conn:
        conn.execute("DELETE FROM users")
        assert conn.execute("SELECT count(*) AS n FROM vo2max").fetchone() == {"n": 0}


def test_the_measured_day_is_a_date() -> None:
    body = Vo2MaxReadingRequestBody(
        value=47.6, measured_on=date(2026, 11, 2), source="health_connect"
    )
    assert body.measured_on.isoformat() == "2026-11-02"
