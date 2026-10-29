"""The badges of a profile (TASK-341, ADR-0294): the first drawing, ten
drawings and a drawing of 30 km or more, decided by the server on the
drawings who asks sees, of runs recorded by the app, never hidden by the
moderation. One rule a test."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.badges import LONG_DRAWING_M, TEN_DRAWINGS
from shaperoute_api.db import Database

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
DAY_MS = 86_400_000

Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 29, 9, 0, tzinfo=UTC)

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


def key(n: int) -> str:
    """The key of the n-th run: 16 hex digits, as the app makes them."""
    return f"{n:016x}"


def drawn(
    client: TestClient, headers: Headers, n: int, visibility: str = "everyone"
) -> str:
    """The example run saved as the n-th, a day apart, and published."""
    body = _load("activity-request.json")
    for fix in body["track"]:
        fix["time_ms"] += n * DAY_MS
    for pause in body["pauses"]:
        pause["from_ms"] += n * DAY_MS
        pause["to_ms"] += n * DAY_MS
    answer = client.put(f"/me/activities/{key(n)}", json=body, headers=headers)
    assert answer.status_code == 201, answer.text
    answer = client.put(
        f"/me/activities/{key(n)}/drawing",
        json={"title": "Sunday star", "visibility": visibility},
        headers=headers,
    )
    assert answer.status_code == 200, answer.text
    return str(answer.json()["id"])


def changed(database: Database, n: int, assignment: str) -> None:
    """The n-th run changed in the database, where the API keeps it."""
    with database.connect() as conn:
        conn.execute(f"UPDATE runs SET {assignment} WHERE key = %s", (key(n),))


def badges(client: TestClient, viewer: Headers, owner: Headers) -> list[str]:
    answer = client.get(f"/users/{public_id(client, owner)}", headers=viewer)
    assert answer.status_code == 200, answer.text
    return list(answer.json()["badges"])


def test_no_drawing_no_badge(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    assert badges(client, viewer, owner) == []


def test_the_first_drawing(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    drawn(client, owner, 1)
    assert badges(client, viewer, owner) == ["first_drawing"]


def test_ten_drawings(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    for n in range(1, TEN_DRAWINGS):
        drawn(client, owner, n)
    assert badges(client, viewer, owner) == ["first_drawing"]
    drawn(client, owner, TEN_DRAWINGS)
    assert badges(client, viewer, owner) == ["first_drawing", "ten_drawings"]


def test_a_drawing_of_30_km(client: TestClient, database: Database) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    drawn(client, owner, 1)
    changed(database, 1, f"distance_m = {LONG_DRAWING_M - 1}")
    assert badges(client, viewer, owner) == ["first_drawing"]
    changed(database, 1, f"distance_m = {LONG_DRAWING_M}")
    assert badges(client, viewer, owner) == ["first_drawing", "long_drawing"]


def test_a_private_run_makes_no_badge(client: TestClient) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    drawn(client, owner, 1, "only_me")
    assert badges(client, viewer, owner) == []
    assert badges(client, owner, owner) == []


def test_an_imported_run_makes_no_badge(client: TestClient, database: Database) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    drawn(client, owner, 1)
    changed(database, 1, "source = 'file', distance_m = 40000")
    assert badges(client, viewer, owner) == []


def test_a_drawing_hidden_by_the_moderation_counts_for_nobody(
    client: TestClient, database: Database
) -> None:
    owner, viewer = signed_up(client, 1), signed_up(client, 2)
    drawing = drawn(client, owner, 1)
    with database.connect() as conn:
        conn.execute("UPDATE drawings SET hidden_at = now() WHERE id = %s", (drawing,))
    assert badges(client, viewer, owner) == []
    assert badges(client, owner, owner) == []


def test_the_badges_follow_what_who_asks_sees(client: TestClient) -> None:
    owner, follower, stranger = (signed_up(client, n) for n in (1, 2, 3))
    asked = client.post(f"/users/{public_id(client, owner)}/follow", headers=follower)
    assert asked.status_code == 200, asked.text
    accepted = client.post(
        f"/me/follow-requests/{public_id(client, follower)}/accept", headers=owner
    )
    assert accepted.status_code == 204, accepted.text
    drawn(client, owner, 1, "followers")
    assert badges(client, follower, owner) == ["first_drawing"]
    assert badges(client, owner, owner) == ["first_drawing"]
    assert badges(client, stranger, owner) == []
