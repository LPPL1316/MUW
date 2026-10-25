"""The pool of database connections (TASK-288 B, ADR-0249): a few open
connections for many requests, each given back as a new session, after an
error too; every one busy is a 503, not a wait without end; none left open
when the API stops. A real PostgreSQL (conftest.py)."""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg.pq import TransactionStatus
from psycopg_pool import ConnectionPool
from route_engine.network import FileSource
from test_accounts import FAST_HASHER, PASSWORD, bearer, sign_up

from shaperoute_api import __main__ as entry
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import DATABASE_BUSY, DATABASE_BUSY_RETRY_S, create_app
from shaperoute_api.db import (
    DATABASE_VARIABLE,
    POOL_MAX_SIZE,
    POOL_MIN_SIZE,
    POOL_WAIT_S,
    Database,
)

# What a connection keeps of its request, read in one query: a new session
# has none of it.
LEFT_BEHIND = (
    "SELECT pg_backend_pid() AS pid,"
    " current_setting('statement_timeout') AS statement_timeout,"
    " to_regclass('pg_temp.leftover') AS temporary_table,"
    " (SELECT count(*) FROM pg_prepared_statements) AS prepared,"
    " (SELECT count(*) FROM pg_cursors) AS cursors,"
    " (SELECT count(*) FROM pg_listening_channels()) AS listening,"
    " (SELECT count(*) FROM pg_locks"
    "  WHERE locktype = 'advisory' AND pid = pg_backend_pid()) AS locks"
)
NOTHING_LEFT = {
    "statement_timeout": "0",
    "temporary_table": None,
    "prepared": 0,
    "cursors": 0,
    "listening": 0,
    "locks": 0,
}
# Closing a connection ends its PostgreSQL process a moment later.
GONE_WITHIN_S = 10.0


def others(url: str) -> int:
    """The connections to this database, besides the one that counts."""
    with psycopg.connect(url) as conn:
        row = conn.execute(
            "SELECT count(*) FROM pg_stat_activity"
            " WHERE datname = current_database() AND pid <> pg_backend_pid()"
        ).fetchone()
    assert row is not None
    return int(row[0])


def wait_for_others(url: str, count: int) -> int:
    deadline = time.monotonic() + GONE_WITHIN_S
    while (seen := others(url)) != count and time.monotonic() < deadline:
        time.sleep(0.05)
    return seen


def the_pool(database: Database) -> ConnectionPool[Any]:
    assert database.pool is not None
    return database.pool


@pytest.fixture
def migrated(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def one(migrated: Database) -> Iterator[Database]:
    """A pool of one connection: the next block gets the same one back."""
    database = migrated.pooled(min_size=1, max_size=1, wait_s=0.5)
    yield database
    database.close()


def app_on(database: Database) -> FastAPI:
    accounts = Accounts(database, hasher=FAST_HASHER)
    return create_app(FileSource(Path("unused.graphml")), accounts=accounts)


def test_requests_take_turns_on_a_few_connections(migrated: Database) -> None:
    database = migrated.pooled(min_size=1, max_size=2)
    with TestClient(app_on(database)) as client:
        token = sign_up(client).json()["token"]
        for _ in range(20):
            assert client.get("/me", headers=bearer(token)).status_code == 200
        stats = the_pool(database).get_stats()
    # Without the pool: one connection to sign up, two for each /me.
    assert stats["requests_num"] >= 21
    assert stats["connections_num"] <= 2
    assert wait_for_others(database.url, 0) == 0


def test_a_connection_comes_back_as_a_new_session(one: Database) -> None:
    with one.connect() as conn:
        pid = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
        conn.execute("SET statement_timeout = '1234ms'")
        conn.execute("CREATE TEMPORARY TABLE leftover (n int)")
        conn.execute("SELECT pg_advisory_lock(288)")
        conn.execute("PREPARE leftover_plan AS SELECT 1")
        conn.execute("LISTEN leftover")
        conn.execute("DECLARE leftover_cursor CURSOR WITH HOLD FOR SELECT 1")
        assert conn.execute(LEFT_BEHIND).fetchone() != {**pid, **NOTHING_LEFT}
    with one.connect() as conn:
        assert conn.info.transaction_status == TransactionStatus.IDLE
        assert not conn.autocommit
        # The same PostgreSQL process: given back, not a new connection.
        assert conn.execute(LEFT_BEHIND).fetchone() == {**pid, **NOTHING_LEFT}


def test_a_transaction_left_open_is_rolled_back(one: Database) -> None:
    with one.connect() as conn:
        conn.execute("CREATE TABLE notes (n int)")
    pool = the_pool(one)
    conn = pool.getconn()
    conn.execute("INSERT INTO notes VALUES (1)")
    assert conn.info.transaction_status == TransactionStatus.INTRANS
    pool.putconn(conn)
    with one.connect() as conn:
        assert conn.info.transaction_status == TransactionStatus.IDLE
        assert conn.execute("SELECT count(*) AS n FROM notes").fetchone() == {"n": 0}


def test_a_failed_block_gives_its_connection_back(one: Database) -> None:
    with one.connect() as conn:
        conn.execute("CREATE TABLE notes (n int)")
        pid = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
    with pytest.raises(RuntimeError, match="the request failed"):
        with one.connect() as conn:
            conn.execute("SET statement_timeout = '1234ms'")
            conn.execute("INSERT INTO notes VALUES (1)")
            raise RuntimeError("the request failed")
    with pytest.raises(psycopg.errors.DivisionByZero):
        with one.connect() as conn:
            conn.execute("INSERT INTO notes VALUES (2)")
            conn.execute("SELECT 1 / 0")
    # With the only connection kept, this would wait half a second and fail.
    with one.connect() as conn:
        assert conn.execute(LEFT_BEHIND).fetchone() == {**pid, **NOTHING_LEFT}
        assert conn.execute("SELECT count(*) AS n FROM notes").fetchone() == {"n": 0}


def test_a_failed_request_gives_its_connection_back(
    one: Database, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = TestClient(app_on(one), raise_server_exceptions=False)
    token = sign_up(client).json()["token"]
    # A known error raised inside the block: 409.
    again = sign_up(client, username="Another_1")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "email_taken"
    assert client.get("/me", headers=bearer(token)).status_code == 200

    # An unexpected one, after a SET: 500.
    def broken(self: Accounts, conn: Any, user_id: int, now: Any) -> str:
        conn.execute("SET statement_timeout = '1234ms'")
        raise RuntimeError("a bug")

    monkeypatch.setattr(Accounts, "_open_session", broken)
    signed_in = client.post(
        "/session", json={"email": "runner@example.com", "password": PASSWORD}
    )
    assert signed_in.status_code == 500
    assert client.get("/me", headers=bearer(token)).status_code == 200
    with one.connect() as conn:
        left = conn.execute(LEFT_BEHIND).fetchone()
        assert left is not None
        assert {k: v for k, v in left.items() if k != "pid"} == NOTHING_LEFT
    assert the_pool(one).get_stats()["connections_num"] == 1


def test_every_connection_busy_for_10_s_is_a_503_not_a_hang(
    migrated: Database, caplog: pytest.LogCaptureFixture
) -> None:
    # The server's wait, POOL_WAIT_S: this test takes those ten seconds.
    database = migrated.pooled(min_size=1, max_size=1)
    client = TestClient(app_on(database))
    try:
        token = sign_up(client).json()["token"]
        with database.connect():
            started = time.monotonic()
            with caplog.at_level(logging.WARNING, logger="shaperoute_api.app"):
                busy = client.get("/me", headers=bearer(token))
            waited = time.monotonic() - started
        assert busy.status_code == 503
        error = busy.json()["error"]
        assert (error["code"], error["message"]) == (
            "accounts_unavailable",
            DATABASE_BUSY,
        )
        assert busy.headers["Retry-After"] == str(DATABASE_BUSY_RETRY_S)
        assert DATABASE_BUSY_RETRY_S == round(POOL_WAIT_S)
        # Then the answer: not the API's 500, not a request that never ends.
        assert POOL_WAIT_S <= waited < POOL_WAIT_S + 5
        assert "couldn't get a connection after 10.00 sec" in caplog.text
        assert client.get("/me", headers=bearer(token)).status_code == 200
    finally:
        database.close()


def test_a_block_inside_another_has_a_connection_of_its_own(
    one: Database,
) -> None:
    # As sending a run to Strava: the run locked, then the token read.
    started = time.monotonic()
    with one.connect() as outer:
        with one.connect() as inner:
            pids = [
                conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
                for conn in (outer, inner)
            ]
    # Not half a second of waiting for the one connection, then an error.
    assert time.monotonic() - started < 0.5
    assert pids[0] != pids[1]
    with one.connect() as conn:
        again = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
    assert again == pids[0]
    assert the_pool(one).get_stats()["connections_num"] == 1
    assert wait_for_others(one.url, 1) == 1


def test_a_connection_postgresql_closed_is_replaced(migrated: Database) -> None:
    database = migrated.pooled(min_size=1, max_size=1, wait_s=5)
    try:
        with database.connect() as conn:
            before = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
        assert before is not None
        with psycopg.connect(database.url, autocommit=True) as admin:
            admin.execute("SELECT pg_terminate_backend(%s)", (before["pid"],))
        assert wait_for_others(database.url, 0) == 0
        with database.connect() as conn:
            after = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
        assert after is not None
        assert after["pid"] != before["pid"]
    finally:
        database.close()


def test_the_same_query_many_times_is_never_prepared(one: Database) -> None:
    # psycopg prepares a query run five times; DISCARD ALL would then drop
    # the statement under its feet. Off: every request works as before.
    for _ in range(3):
        with one.connect() as conn:
            for n in range(8):
                row = conn.execute("SELECT %s::int AS n", (n,)).fetchone()
                assert row == {"n": n}
            prepared = conn.execute(
                "SELECT count(*) AS n FROM pg_prepared_statements"
            ).fetchone()
            assert prepared == {"n": 0}


def test_without_a_pool_each_block_has_its_own_connection(
    migrated: Database,
) -> None:
    assert migrated.pool is None
    pids = set()
    for _ in range(2):
        with migrated.connect() as conn:
            row = conn.execute("SELECT pg_backend_pid() AS pid").fetchone()
            assert row is not None
            pids.add(row["pid"])
    assert len(pids) == 2
    migrated.close()
    assert wait_for_others(migrated.url, 0) == 0


@pytest.fixture
def started(
    migrated: Database, monkeypatch: pytest.MonkeyPatch
) -> Iterator[dict[str, Any]]:
    seen: dict[str, Any] = {}
    monkeypatch.setenv(DATABASE_VARIABLE, migrated.url)
    monkeypatch.setattr(entry, "lan_address", lambda: "192.168.1.23")
    yield seen


def test_the_api_closes_its_pool_when_it_stops(
    started: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    def run(app: FastAPI, host: str, port: int) -> None:
        database: Database = app.state.accounts.database
        pool = the_pool(database)
        with TestClient(app) as client:
            assert sign_up(client).status_code == 201
            started["open"] = others(database.url)
        # The app's end, before uvicorn hands back.
        started["closed_by_the_app"] = pool.closed
        started["pool"] = pool
        started["url"] = database.url

    monkeypatch.setattr(entry.uvicorn, "run", run)
    entry.main(["--no-insights"])
    pool = started["pool"]
    assert (pool.min_size, pool.max_size, pool.timeout) == (
        POOL_MIN_SIZE,
        POOL_MAX_SIZE,
        POOL_WAIT_S,
    )
    assert POOL_MIN_SIZE <= started["open"] <= POOL_MAX_SIZE
    assert started["closed_by_the_app"]
    assert wait_for_others(started["url"], 0) == 0


def test_the_pool_closes_when_the_app_never_started(
    started: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    def run(app: FastAPI, host: str, port: int) -> None:
        database: Database = app.state.accounts.database
        started["pool"] = the_pool(database)
        started["url"] = database.url
        started["open"] = others(database.url)
        raise SystemExit("address already in use")

    monkeypatch.setattr(entry.uvicorn, "run", run)
    with pytest.raises(SystemExit, match="address already in use"):
        entry.main(["--no-insights"])
    assert started["open"] == POOL_MIN_SIZE
    assert started["pool"].closed
    assert wait_for_others(started["url"], 0) == 0
