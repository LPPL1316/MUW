"""Accounts in a real PostgreSQL (TASK-114, ADR-0115): sign up, sign in, /me,
sign out, delete; the migrations; the errors the app tells apart; nothing
secret in the database, the answers or the log."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import psycopg
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api import __main__ as entry
from shaperoute_api.accounts import (
    FAILED_WINDOW_S,
    MAX_FAILED_SIGN_INS,
    SESSION_DAYS,
    Accounts,
    FailedSignIns,
    SessionBody,
    SignUpRequestBody,
    UserBody,
)
from shaperoute_api.app import create_app
from shaperoute_api.db import (
    DATABASE_VARIABLE,
    MIGRATIONS_DIR,
    Database,
    MigrationError,
    migrations,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
PASSWORD = "correct horse battery"
# Cheap parameters: the tests sign up dozens of times.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class Clock:
    """A clock the test moves by hand."""

    def __init__(self, start: float = 0.0) -> None:
        self.t = start

    def __call__(self) -> float:
        return self.t


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 8, 30, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def ticks() -> Clock:
    return Clock()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def accounts(database: Database, wall: WallClock, ticks: Clock) -> Accounts:
    return Accounts(
        database, now=wall, hasher=FAST_HASHER, failed=FailedSignIns(clock=ticks)
    )


@pytest.fixture
def client(accounts: Accounts) -> TestClient:
    return TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))


def sign_up(client: TestClient, **changes: Any) -> Any:
    body = {**_load("sign-up-request.json"), **changes}
    return client.post("/accounts", json=body)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


def rows(database: Database, table: str) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return list(conn.execute(f"SELECT * FROM {table}").fetchall())


# --- The contract and the migrations, without a database where possible ---


def test_the_fixtures_are_the_contract() -> None:
    request = _load("sign-up-request.json")
    # The box «Don't send me these emails» and the language (TASK-284) may
    # be left out, as the app of before does.
    optional = {"away_email", "language"}
    assert set(request) == set(SignUpRequestBody.model_fields) - optional
    SignUpRequestBody.model_validate(request)
    session = _load("session.json")
    assert set(session) == set(SessionBody.model_fields)
    assert set(session["user"]) == set(UserBody.model_fields)
    SessionBody.model_validate(session)


def test_migrations_are_numbered_once(tmp_path: Path) -> None:
    assert [p.name for p in migrations()][0] == "0001_users_sessions.sql"
    (tmp_path / "0001_a.sql").write_text("SELECT 1;")
    (tmp_path / "0001_b.sql").write_text("SELECT 1;")
    with pytest.raises(MigrationError, match="same number"):
        migrations(tmp_path)
    (tmp_path / "0001_b.sql").unlink()
    (tmp_path / "2_Bad.sql").write_text("SELECT 1;")
    with pytest.raises(MigrationError, match="NNNN_what.sql"):
        migrations(tmp_path)


def test_the_address_comes_from_the_environment() -> None:
    assert Database.from_env({}) is None
    assert Database.from_env({DATABASE_VARIABLE: "  "}) is None
    url = "postgresql://api@db/shaperoute"
    assert Database.from_env({DATABASE_VARIABLE: url}) == Database(url)


def test_migrations_apply_once_each(database_url: str) -> None:
    database = Database(database_url)
    # Every file of the folder, in order: a new migration needs no change here.
    names = [p.stem for p in migrations(MIGRATIONS_DIR)]
    assert names[0] == "0001_users_sessions"
    assert database.migrate() == names
    assert database.migrate() == []
    versions = [r["version"] for r in rows(database, "schema_migrations")]
    assert versions == names


def test_a_failing_migration_leaves_nothing_behind(
    database_url: str, tmp_path: Path
) -> None:
    (tmp_path / "0001_ok.sql").write_text("CREATE TABLE ok (id int);")
    (tmp_path / "0002_broken.sql").write_text(
        "CREATE TABLE half (id int); SELECT no_such_function();"
    )
    database = Database(database_url)
    with pytest.raises(psycopg.Error):
        database.migrate(tmp_path)
    with database.connect() as conn:
        tables = {
            r["tablename"]
            for r in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
        }
    assert tables == {"schema_migrations", "ok"}
    assert [r["version"] for r in rows(database, "schema_migrations")] == ["0001_ok"]


# --- Sign up, sign in, /me ---


def test_signing_up_signs_in(client: TestClient, database: Database) -> None:
    answer = sign_up(client, email="  Runner@Example.COM ")
    assert answer.status_code == 201
    session = SessionBody.model_validate(answer.json())
    assert session.user.email == "runner@example.com"
    assert session.user.username == "Runner_42"
    assert session.user.role == "user"
    assert session.user.created_at == datetime(2026, 10, 2, 8, 30, tzinfo=UTC)
    me = client.get("/me", headers=bearer(session.token))
    assert me.status_code == 200
    assert me.json() == answer.json()["user"]
    (user,) = rows(database, "users")
    assert user["confirmed_16_at"] == user["created_at"]


def test_an_email_or_a_username_already_used(client: TestClient) -> None:
    assert sign_up(client).status_code == 201
    again = sign_up(client, email="RUNNER@example.com", username="Other")
    assert (again.status_code, code(again)) == (409, "email_taken")
    same_name = sign_up(client, email="two@example.com", username="runner_42")
    assert (same_name.status_code, code(same_name)) == (409, "username_taken")


@pytest.mark.parametrize(
    "changes",
    [
        {"at_least_16": False},
        {"email": "not an email"},
        {"password": "short"},
        {"password": "x" * 129},
        {"username": "ab"},
        {"username": "has space"},
        {"role": "admin"},
    ],
)
def test_a_sign_up_that_is_refused(client: TestClient, changes: Any) -> None:
    answer = sign_up(client, **changes)
    assert (answer.status_code, code(answer)) == (422, "invalid_request")
    assert "password" not in changes or changes["password"] not in answer.text


def test_signing_in_from_a_second_phone(client: TestClient) -> None:
    first = sign_up(client).json()["token"]
    answer = client.post(
        "/session", json={"email": "RUNNER@example.com", "password": PASSWORD}
    )
    assert answer.status_code == 200
    second = answer.json()["token"]
    assert second != first
    for token in (first, second):
        assert client.get("/me", headers=bearer(token)).status_code == 200


def test_a_wrong_password_and_an_unknown_email_look_the_same(
    client: TestClient,
) -> None:
    sign_up(client)
    wrong = client.post(
        "/session", json={"email": "runner@example.com", "password": "wrong one"}
    )
    unknown = client.post(
        "/session", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert code(wrong) == "wrong_credentials"


def test_too_many_wrong_passwords_wait(client: TestClient, ticks: Clock) -> None:
    sign_up(client)
    right = {"email": "runner@example.com", "password": PASSWORD}
    wrong = {**right, "password": "wrong one"}
    for _ in range(MAX_FAILED_SIGN_INS):
        assert code(client.post("/session", json=wrong)) == "wrong_credentials"
    ticks.t += 60
    blocked = client.post("/session", json=right)
    assert (blocked.status_code, code(blocked)) == (429, "too_many_requests")
    assert blocked.headers["Retry-After"] == str(FAILED_WINDOW_S - 60)
    # Another address is not held up by this one.
    assert code(client.post("/session", json={**wrong, "email": "b@c.de"})) == (
        "wrong_credentials"
    )
    ticks.t += FAILED_WINDOW_S
    assert client.post("/session", json=right).status_code == 200


def test_a_stronger_hash_on_the_next_sign_in(
    database: Database, client: TestClient, wall: WallClock
) -> None:
    sign_up(client)
    (before,) = rows(database, "users")
    stronger = Accounts(database, now=wall)
    app = create_app(FileSource(Path("unused.graphml")), accounts=stronger)
    answer = TestClient(app).post(
        "/session", json={"email": "runner@example.com", "password": PASSWORD}
    )
    assert answer.status_code == 200
    (after,) = rows(database, "users")
    assert after["password_hash"] != before["password_hash"]
    assert not PasswordHasher().check_needs_rehash(after["password_hash"])


# --- Tokens and sessions ---


@pytest.mark.parametrize(
    "headers",
    [{}, bearer("not-a-token"), {"Authorization": "Basic cnVubmVyOnB3"}],
)
def test_no_token_or_a_wrong_one(client: TestClient, headers: Any) -> None:
    answer = client.get("/me", headers=headers)
    assert (answer.status_code, code(answer)) == (401, "not_signed_in")


def test_signing_out_ends_only_this_phone(client: TestClient) -> None:
    first = sign_up(client).json()["token"]
    second = client.post(
        "/session", json={"email": "runner@example.com", "password": PASSWORD}
    ).json()["token"]
    assert client.delete("/session", headers=bearer(first)).status_code == 204
    gone = client.get("/me", headers=bearer(first))
    assert (gone.status_code, code(gone)) == (401, "not_signed_in")
    assert client.get("/me", headers=bearer(second)).status_code == 200


def test_a_session_ends_90_days_after_its_last_use(
    client: TestClient, wall: WallClock
) -> None:
    token = sign_up(client).json()["token"]
    wall.t += timedelta(days=SESSION_DAYS - 1)
    assert client.get("/me", headers=bearer(token)).status_code == 200
    # Used yesterday: another 89 days are fine.
    wall.t += timedelta(days=SESSION_DAYS - 1)
    assert client.get("/me", headers=bearer(token)).status_code == 200
    wall.t += timedelta(days=SESSION_DAYS, seconds=1)
    expired = client.get("/me", headers=bearer(token))
    assert (expired.status_code, code(expired)) == (401, "session_expired")
    # Said once: the session is gone.
    assert code(client.get("/me", headers=bearer(token))) == "not_signed_in"


def test_deleting_the_account_deletes_everything(
    client: TestClient, database: Database
) -> None:
    token = sign_up(client).json()["token"]
    client.post("/session", json={"email": "runner@example.com", "password": PASSWORD})
    assert len(rows(database, "sessions")) == 2
    assert client.delete("/me", headers=bearer(token)).status_code == 204
    assert rows(database, "users") == []
    assert rows(database, "sessions") == []
    assert code(client.get("/me", headers=bearer(token))) == "not_signed_in"
    again = client.post(
        "/session", json={"email": "runner@example.com", "password": PASSWORD}
    )
    assert code(again) == "wrong_credentials"
    # The address is free again.
    assert sign_up(client).status_code == 201


def test_nothing_secret_is_kept_answered_or_logged(
    client: TestClient, database: Database, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    token = sign_up(client).json()["token"]
    me = client.get("/me", headers=bearer(token))
    (user,) = rows(database, "users")
    (session,) = rows(database, "sessions")
    assert user["password_hash"].startswith("$argon2id$")
    assert PASSWORD not in user["password_hash"]
    assert bytes(session["token_hash"]) == hashlib.sha256(token.encode()).digest()
    assert token not in me.text and "password" not in me.text
    assert PASSWORD not in caplog.text and token not in caplog.text


# --- The rest of the API ---


def test_drawing_needs_no_account(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
    # Refused for its body, not for a missing token.
    answer = client.post("/route-jobs", json={})
    assert (answer.status_code, code(answer)) == (422, "invalid_request")


def test_without_a_database_accounts_answer_503() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    for answer in (
        sign_up(client),
        client.post("/session", json={"email": "a@b.cd", "password": PASSWORD}),
        client.get("/me", headers=bearer("x")),
        client.delete("/me"),
    ):
        assert (answer.status_code, code(answer)) == (503, "accounts_unavailable")
    assert client.get("/health").status_code == 200


def test_the_api_migrates_when_it_starts(
    database_url: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(entry.uvicorn, "run", lambda app, host, port: None)
    monkeypatch.setenv(DATABASE_VARIABLE, database_url)
    entry.main(["--no-insights"])
    assert "migrations: 0001_users_sessions" in capsys.readouterr().out
    entry.main(["--no-insights"])
    assert "schema up to date" in capsys.readouterr().out


def test_a_database_out_of_reach_stops_the_api(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(entry.uvicorn, "run", lambda app, host, port: None)
    monkeypatch.setenv(DATABASE_VARIABLE, "postgresql://nobody:secret@127.0.0.1:1/x")
    with pytest.raises(SystemExit, match=DATABASE_VARIABLE) as stop:
        entry.main(["--no-insights"])
    assert "secret" not in str(stop.value)
