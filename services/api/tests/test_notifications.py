"""The two notification switches of an account in a real PostgreSQL
(TASK-185, ADR-0206): off until their owner turns them on, changed one at a
time, told to their owner only, and the accounts made before still working.
Nothing is sent: the switches are only kept."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.accounts import (
    USER_COLUMNS,
    Accounts,
    NotificationsBody,
    UserBody,
    token_hash,
)
from shaperoute_api.app import create_app
from shaperoute_api.db import MIGRATIONS_DIR, Database, migrations
from shaperoute_api.notifications import NotificationsRequestBody

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
# The migration of the switches, whatever its number when merged.
(NOTIFICATIONS,) = [
    path for path in migrations() if path.name.endswith("_notifications.sql")
]
EMAIL = "runner@example.com"
OTHER_EMAIL = "other@example.com"
PASSWORD = "correct horse battery"
# Both off; «Email when I'm away» is on until turned off (TASK-284).
OFF = {"email": False, "push": False, "away": True}


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)

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
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    return TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))


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


def me(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    answer = client.get("/me", headers=headers)
    assert answer.status_code == 200
    return dict(answer.json())


def switches(client: TestClient, headers: dict[str, str]) -> dict[str, bool]:
    return dict(me(client, headers)["notifications"])


def put(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.put("/me/notifications", json=body, headers=headers)


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


# --- The contract, without a database ---


def test_the_examples_of_shared_types_are_the_contract() -> None:
    request = _load("notifications-request.json")
    assert set(request) <= set(NotificationsRequestBody.model_fields)
    body = NotificationsRequestBody.model_validate(request)
    # Only what changes is sent: the example turns one switch on.
    assert (body.email, body.push) == (None, True)
    user = _load("session.json")["user"]
    assert set(user) == set(UserBody.model_fields)
    assert set(user["notifications"]) == set(NotificationsBody.model_fields)
    # The example account never touched its switches.
    assert user["notifications"] == OFF
    UserBody.model_validate(user)


def test_a_row_of_the_database_reads_as_the_object_of_the_contract() -> None:
    columns = [name.strip() for name in USER_COLUMNS.split(",")]
    assert columns[-3:] == ["notify_email", "notify_push", "notify_away"]
    row = {
        **_load("session.json")["user"],
        "notify_email": True,
        "notify_push": False,
        "notify_away": False,
    }
    del row["notifications"]
    assert set(row) == set(columns)
    user = UserBody.model_validate(row)
    assert user.notifications == NotificationsBody(email=True, push=False, away=False)
    assert "notify_email" not in user.model_dump()


def test_the_migration_comes_after_the_phone_number() -> None:
    names = [path.name for path in migrations()]
    assert names.index(NOTIFICATIONS.name) > names.index("0016_contact.sql")


# --- Who may ask ---


def test_the_switches_need_an_account(client: TestClient) -> None:
    body = _load("notifications-request.json")
    answer = client.put("/me/notifications", json=body)
    assert (answer.status_code, code(answer)) == (401, "not_signed_in")
    wrong = {"Authorization": "Bearer not-a-token"}
    answer = client.put("/me/notifications", json=body, headers=wrong)
    assert (answer.status_code, code(answer)) == (401, "not_signed_in")


def test_without_a_database_they_are_unavailable() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    headers = {"Authorization": "Bearer any"}
    answer = put(client, headers, _load("notifications-request.json"))
    assert (answer.status_code, code(answer)) == (503, "accounts_unavailable")


# --- PUT /me/notifications ---


def test_a_new_account_has_both_switches_off(client: TestClient) -> None:
    answer = client.post("/accounts", json=_load("sign-up-request.json"))
    assert answer.status_code == 201
    # Told at once, by signing up, signing in and GET /me alike.
    assert answer.json()["user"]["notifications"] == OFF
    headers = {"Authorization": f"Bearer {answer.json()['token']}"}
    assert switches(client, headers) == OFF
    again = client.post("/session", json={"email": EMAIL, "password": PASSWORD})
    assert again.json()["user"]["notifications"] == OFF


def test_each_switch_turns_on_and_off_on_its_own(client: TestClient) -> None:
    headers = signed_up(client)
    answer = put(client, headers, _load("notifications-request.json"))
    assert answer.status_code == 200
    # The answer is the account as it is now, as GET /me gives it.
    assert answer.json() == me(client, headers)
    assert answer.json()["notifications"] == {
        "email": False,
        "push": True,
        "away": True,
    }
    # The other one: what was not sent stays as it is.
    answer = put(client, headers, {"email": True})
    assert answer.json()["notifications"] == {"email": True, "push": True, "away": True}
    answer = put(client, headers, {"push": False})
    assert answer.json()["notifications"] == {
        "email": True,
        "push": False,
        "away": True,
    }
    answer = put(client, headers, {"email": False})
    assert answer.json()["notifications"] == OFF
    assert switches(client, headers) == OFF


def test_both_switches_change_in_one_request(client: TestClient) -> None:
    headers = signed_up(client)
    answer = put(client, headers, {"email": True, "push": True})
    assert answer.status_code == 200
    assert switches(client, headers) == {"email": True, "push": True, "away": True}
    # The same again is no change, and no mistake.
    assert (
        put(client, headers, {"email": True, "push": True, "away": True}).status_code
        == 200
    )
    answer = put(client, headers, {"email": False, "push": True})
    assert answer.json()["notifications"] == {
        "email": False,
        "push": True,
        "away": True,
    }


def test_nothing_sent_changes_nothing_and_answers_the_account(
    client: TestClient,
) -> None:
    headers = signed_up(client)
    put(client, headers, {"email": True})
    before = me(client, headers)
    answer = put(client, headers, {})
    assert answer.status_code == 200
    assert answer.json() == before
    # A switch sent as null is a switch not sent.
    answer = put(client, headers, {"email": None, "push": True})
    assert answer.status_code == 200
    assert answer.json()["notifications"] == {"email": True, "push": True, "away": True}


@pytest.mark.parametrize(
    "body",
    [
        {"email": "true"},
        {"email": "yes"},
        {"push": 1},
        {"push": 0},
        {"email": [True]},
        {"push": {"on": True}},
        {"email": True, "sms": True},
        {"notifications": {"email": True}},
        {"push": True, "role": "admin"},
    ],
)
def test_a_request_out_of_the_contract_is_refused(
    client: TestClient, body: dict[str, Any]
) -> None:
    headers = signed_up(client)
    answer = put(client, headers, body)
    assert (answer.status_code, code(answer)) == (422, "invalid_request")
    assert switches(client, headers) == OFF


def test_the_switches_of_one_account_are_not_those_of_another(
    client: TestClient,
) -> None:
    mine, theirs = signed_up(client), other(client)
    put(client, mine, {"email": True, "push": True})
    assert switches(client, mine) == {"email": True, "push": True, "away": True}
    assert switches(client, theirs) == OFF


def test_the_other_changes_of_the_account_keep_the_switches(
    client: TestClient,
) -> None:
    # PATCH /me, PUT /me/phone and PUT /me/email read the same columns.
    headers = signed_up(client)
    put(client, headers, {"push": True})
    on = {"email": False, "push": True, "away": True}
    edited = client.patch("/me", json={"bio": "Runs hearts."}, headers=headers)
    assert edited.status_code == 200
    assert edited.json()["notifications"] == on
    phoned = client.put(
        "/me/phone", json=_load("change-phone-request.json"), headers=headers
    )
    assert phoned.status_code == 200
    assert phoned.json()["notifications"] == on
    moved = client.put(
        "/me/email", json=_load("change-email-request.json"), headers=headers
    )
    assert moved.status_code == 200
    assert moved.json()["notifications"] == on


def test_the_others_never_see_the_switches(client: TestClient) -> None:
    mine, theirs = signed_up(client), other(client)
    for headers in (mine, theirs):
        put(client, headers, {"email": True, "push": True})
    my_id = me(client, mine)["public_id"]
    their_id = me(client, theirs)["public_id"]
    # They ask to follow, and are let in: every list has one of the two.
    assert client.post(f"/users/{my_id}/follow", headers=theirs).status_code == 200
    asked = client.get("/me/follow-requests", headers=mine)
    accepted = client.post(f"/me/follow-requests/{their_id}/accept", headers=mine)
    assert accepted.status_code == 204
    seen = [
        client.get(f"/users/{my_id}", headers=theirs),
        client.get("/users", params={"q": "Runner"}, headers=theirs),
        asked,
        client.get("/me/followers", headers=mine),
        client.get("/me/following", headers=theirs),
    ]
    for answer in seen:
        assert answer.status_code == 200
        assert "runner" in answer.text.lower()
        assert "notif" not in answer.text
        assert "push" not in answer.text


def test_the_switches_go_with_the_account(
    client: TestClient, database: Database
) -> None:
    headers = signed_up(client)
    put(client, headers, {"email": True, "push": True})
    assert client.delete("/me", headers=headers).status_code == 204
    with database.connect() as conn:
        left = conn.execute("SELECT count(*) AS n FROM users").fetchone()
    assert left is not None and left["n"] == 0
    # The same email signs up again, with both switches off.
    assert switches(client, signed_up(client)) == OFF


# --- The accounts made before the switches ---


def test_accounts_made_before_the_switches_have_both_off(
    database_url: str, tmp_path: Path, wall: WallClock
) -> None:
    database = Database(database_url)
    before = [path for path in migrations() if path.name < NOTIFICATIONS.name]
    assert "0016_contact.sql" in [path.name for path in before]
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    # As the API of before wrote it: an account and a phone's session.
    token = "token-of-before"
    with database.connect() as conn:
        conn.execute(
            "WITH made AS (INSERT INTO users"
            " (email, password_hash, username, confirmed_16_at, created_at)"
            " VALUES (%s, %s, %s, %s, %s) RETURNING id)"
            " INSERT INTO sessions (token_hash, user_id, created_at, last_used_at)"
            " SELECT %s, id, %s, %s FROM made",
            (
                EMAIL,
                FAST_HASHER.hash(PASSWORD),
                "Runner_42",
                wall.t,
                wall.t,
                token_hash(token),
                wall.t,
                wall.t,
            ),
        )
        columns = {
            row["column_name"]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns"
                " WHERE table_name = 'users'"
            )
        }
    assert "notify_email" not in columns and "notify_push" not in columns
    headers = {"Authorization": f"Bearer {token}"}

    # The API of TASK-185 starts: the switches' migration, and nothing else.
    assert database.migrate(MIGRATIONS_DIR) == [
        path.stem for path in migrations() if path.name >= NOTIFICATIONS.name
    ]
    new = api(database, wall)
    # The session of before still opens, with both switches off: nobody is
    # signed up to anything by the migration (but the email to who is away,
    # TASK-284: the user's choice). Then they turn on as any.
    assert switches(new, headers) == OFF
    answer = put(new, headers, {"email": True})
    assert answer.status_code == 200
    assert switches(new, headers) == {"email": True, "push": False, "away": True}
