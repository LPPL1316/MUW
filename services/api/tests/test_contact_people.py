"""The members found from the phone's contacts in a real PostgreSQL
(TASK-262 C, ADR-0226): a number saved by a member finds it, nobody's
number finds nobody, a block keeps two apart both ways, and the hashes
received are kept nowhere: not in the database, not in a log."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from psycopg import sql
from route_engine.network import FileSource

from shaperoute_api.access import LIMIT_VARIABLE
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.contact_people import (
    MAX_CALLS_PER_HOUR,
    MAX_HASHES,
    TOO_MANY_LOOKS,
    ContactPersonBody,
    ContactsPeopleRequestBody,
)
from shaperoute_api.db import Database
from shaperoute_api.request_log import RequestLog

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
# The two numbers of the example request (contacts-people-request.json).
ADA_PHONE = "+393331234567"
OTHER_PHONE = "+15551234567"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 9, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def request_log(tmp_path: Path) -> RequestLog:
    return RequestLog(tmp_path / "requests")


@pytest.fixture
def client(database: Database, request_log: RequestLog) -> TestClient:
    accounts = Accounts(database, now=WallClock(), hasher=FAST_HASHER)
    app = create_app(
        FileSource(Path("unused.graphml")), accounts=accounts, request_log=request_log
    )
    return TestClient(app)


def signed_up(client: TestClient, n: int, phone: str | None = None) -> dict[str, str]:
    """A new account, as the header its requests carry; with `phone`
    written as its owner typed it."""
    body = {
        **_load("sign-up-request.json"),
        "email": f"runner{n}@example.com",
        "username": f"runner_{n}",
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    headers = {"Authorization": f"Bearer {answer.json()['token']}"}
    if phone is not None:
        kept = client.put("/me/phone", json={"phone": phone}, headers=headers)
        assert kept.status_code == 200
    return headers


def public_id(client: TestClient, headers: dict[str, str]) -> str:
    answer = client.get("/me", headers=headers)
    assert answer.status_code == 200
    return str(answer.json()["public_id"])


def look(client: TestClient, headers: dict[str, str], *hashes: str) -> Any:
    return client.post(
        "/people/from-contacts", json={"hashes": list(hashes)}, headers=headers
    )


def names(answer: Any) -> list[str]:
    assert answer.status_code == 200, answer.text
    return [person["username"] for person in answer.json()["people"]]


# --- The contract, without a database ---


def test_the_examples_of_shared_types_are_the_contract() -> None:
    request = _load("contacts-people-request.json")
    ContactsPeopleRequestBody.model_validate(request)
    assert request["hashes"] == [sha(ADA_PHONE), sha(OTHER_PHONE)]
    for person in _load("contacts-people.json")["people"]:
        assert set(person) == set(ContactPersonBody.model_fields)
        ContactPersonBody.model_validate(person)


def test_only_hashes_are_taken() -> None:
    for wrong in (
        {"hashes": []},
        {"hashes": [ADA_PHONE]},
        {"hashes": [sha(ADA_PHONE).upper()]},
        {"hashes": [sha(ADA_PHONE)], "phones": [ADA_PHONE]},
        {"hashes": [sha(str(n)) for n in range(MAX_HASHES + 1)]},
    ):
        with pytest.raises(ValueError):
            ContactsPeopleRequestBody.model_validate(wrong)


# --- In the database ---


def test_a_number_saved_by_a_member_finds_it_however_it_was_written(
    client: TestClient,
) -> None:
    me = signed_up(client, 1)
    # Saved with spaces and "00": kept in E.164 (TASK-183).
    signed_up(client, 2, phone="0039 333 123 4567")
    signed_up(client, 3, phone="+1 555 123 4567")
    answer = look(client, me, sha(ADA_PHONE))
    assert names(answer) == ["runner_2"]
    (found,) = answer.json()["people"]
    assert set(found) == {"public_id", "username", "photo", "follow"}
    assert found["follow"] == "none"
    assert names(look(client, me, sha(ADA_PHONE), sha(OTHER_PHONE))) == [
        "runner_2",
        "runner_3",
    ]


def test_a_number_of_nobody_finds_nobody(client: TestClient) -> None:
    me = signed_up(client, 1)
    # A member without a number is never found.
    signed_up(client, 2)
    signed_up(client, 3, phone=ADA_PHONE)
    assert names(look(client, me, sha("+393339999999"))) == []
    # Only the hash of the E.164 form finds: the number as typed does not.
    assert names(look(client, me, sha("333 123 4567"))) == []


def test_the_one_who_asks_is_never_found(client: TestClient) -> None:
    me = signed_up(client, 1, phone=ADA_PHONE)
    assert names(look(client, me, sha(ADA_PHONE))) == []


def test_every_account_with_the_number_is_found(client: TestClient) -> None:
    me = signed_up(client, 1)
    signed_up(client, 2, phone=ADA_PHONE)
    signed_up(client, 3, phone=ADA_PHONE)
    assert names(look(client, me, sha(ADA_PHONE))) == ["runner_2", "runner_3"]


def test_where_the_one_who_asks_stands_comes_with_each(client: TestClient) -> None:
    me = signed_up(client, 1)
    ada = signed_up(client, 2, phone=ADA_PHONE)
    asked = client.post(f"/users/{public_id(client, ada)}/follow", headers=me)
    assert asked.status_code == 200
    (found,) = look(client, me, sha(ADA_PHONE)).json()["people"]
    assert found["follow"] == "requested"


def test_a_block_keeps_two_apart_in_both_directions(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, 1, phone=OTHER_PHONE)
    ada = signed_up(client, 2, phone=ADA_PHONE)
    bea = signed_up(client, 3, phone="+393330000003")
    bea_phone = sha("+393330000003")
    with database.connect() as conn:
        ids = {
            row["public_id"]: row["id"]
            for row in conn.execute("SELECT id, public_id FROM users").fetchall()
        }
        me_id = ids[UUID(public_id(client, me))]
        ada_id = ids[UUID(public_id(client, ada))]
        bea_id = ids[UUID(public_id(client, bea))]
        # I blocked Ada; Bea blocked me.
        conn.execute(
            "INSERT INTO blocks (blocker_id, blocked_id, created_at)"
            " VALUES (%s, %s, now()), (%s, %s, now())",
            (me_id, ada_id, bea_id, me_id),
        )
    assert names(look(client, me, sha(ADA_PHONE), bea_phone)) == []
    assert names(look(client, ada, sha(OTHER_PHONE))) == []
    assert names(look(client, bea, sha(OTHER_PHONE))) == []
    # Ada and Bea did not block each other.
    assert names(look(client, ada, bea_phone)) == ["runner_3"]


def test_the_hashes_are_kept_nowhere(
    client: TestClient,
    database: Database,
    request_log: RequestLog,
    caplog: pytest.LogCaptureFixture,
) -> None:
    me = signed_up(client, 1)
    signed_up(client, 2, phone=ADA_PHONE)
    nobody = sha("+393339999999")
    sent = [sha(ADA_PHONE), nobody]
    with caplog.at_level(logging.DEBUG):
        assert names(look(client, me, *sent)) == ["runner_2"]
        # A refused request does not say them back either.
        refused = look(client, me, nobody, "not-a-hash")
    assert refused.status_code == 422
    assert nobody not in refused.text

    # No row of any table holds them.
    with database.connect() as conn:
        tables = [
            row["table_name"]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.tables"
                " WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            ).fetchall()
        ]
        assert "users" in tables
        for table in tables:
            rows = conn.execute(
                sql.SQL("SELECT t::text AS row FROM {} t").format(sql.Identifier(table))
            ).fetchall()
            for row in rows:
                for hash_ in sent:
                    assert hash_ not in row["row"], table

    # No log line, of the API or of the request log.
    logged = "\n".join(record.getMessage() for record in caplog.records)
    for hash_ in sent:
        assert hash_ not in logged
    if request_log.path.exists():
        written = request_log.path.read_text(encoding="utf-8")
        for hash_ in sent:
            assert hash_ not in written


def test_looks_are_limited_per_account(
    database: Database, request_log: RequestLog, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Without the limit of every POST (access.py): only this one is counted.
    monkeypatch.setenv(LIMIT_VARIABLE, "0")
    accounts = Accounts(database, now=WallClock(), hasher=FAST_HASHER)
    client = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=accounts,
            request_log=request_log,
        )
    )
    me = signed_up(client, 1)
    other = signed_up(client, 2)
    for _ in range(MAX_CALLS_PER_HOUR):
        assert look(client, me, sha(ADA_PHONE)).status_code == 200
    refused = look(client, me, sha(ADA_PHONE))
    assert refused.status_code == 429
    assert refused.json()["error"]["message"] == TOO_MANY_LOOKS
    assert int(refused.headers["Retry-After"]) > 0
    # Another account has its own limit.
    assert look(client, other, sha(ADA_PHONE)).status_code == 200


def test_a_look_needs_an_account(client: TestClient) -> None:
    answer = client.post("/people/from-contacts", json={"hashes": [sha(ADA_PHONE)]})
    assert answer.status_code == 401
