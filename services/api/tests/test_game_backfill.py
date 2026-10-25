"""The game of the runs saved before it (TASK-296 part A, ADR-0255,
docs/GIOCO.md §7): the backfill gives the rows a run gets when saved, in the
order the runs were saved, unlocks at the end of the run that reached the
shape, tells nobody, and run again changes nothing; a newer version of the
rules computes every run again."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_game_api import (
    KEY,
    MORNING,
    NOW,
    OTHER_KEY,
    PHONE,
    SIX_KM,
    game_of,
    run_body,
    save,
)
from test_push import FAST_HASHER, FakeExpo, push_on, put_token, signed_up

from shaperoute_api import game as game_module
from shaperoute_api import game_backfill
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.db import DATABASE_VARIABLE, Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.game_backfill import Backfilled, backfill, main
from shaperoute_api.push import Pusher


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def client(database: Database, expo: FakeExpo) -> TestClient:
    accounts = Accounts(database, now=lambda: NOW, hasher=FAST_HASHER)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


GAME_COLUMNS = (
    "run_id, user_id, rules_version, counted, reason, counted_m, best_s,"
    " started_at, ended_at"
)


def game_rows(database: Database) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return [
            dict(row)
            for row in conn.execute(
                f"SELECT {GAME_COLUMNS} FROM game_runs ORDER BY run_id"
            ).fetchall()
        ]


def unlocks(database: Database) -> list[tuple[str, Any]]:
    with database.connect() as conn:
        return [
            (row["shape_id"], row["unlocked_at"])
            for row in conn.execute(
                "SELECT shape_id, unlocked_at FROM game_unlocks ORDER BY shape_id"
            ).fetchall()
        ]


def forget_the_game(database: Database) -> None:
    """The runs as they were before the game."""
    with database.connect() as conn:
        conn.execute("DELETE FROM game_runs")
        conn.execute("DELETE FROM game_unlocks")


def test_the_backfill_gives_the_rows_of_a_save(
    client: TestClient, database: Database, expo: FakeExpo
) -> None:
    me = signed_up(client, "ada")
    put_token(client, me, PHONE)
    push_on(client, me)
    paused = run_body(SIX_KM)
    # A minute standing still, auto-paused, after the first fix.
    first_ms = paused["track"][0]["time_ms"]
    paused["pauses"] = [
        {"from_ms": first_ms + 600_000, "to_ms": first_ms + 660_000, "auto": True}
    ]
    save(client, me, paused)
    save(client, me, run_body(SIX_KM, MORNING + timedelta(hours=3)), OTHER_KEY)
    saved = game_rows(database)
    told = len(expo.sent)
    forget_the_game(database)

    assert backfill(database) == Backfilled(accounts=1, runs=2, unlocked=2)
    assert game_rows(database) == saved
    # At the end of the run that reached each: 6 km, then 12.
    end_of_first = saved[0]["ended_at"]
    end_of_second = saved[1]["ended_at"]
    assert unlocks(database) == [("square", end_of_second), ("triangle", end_of_first)]
    # Nobody is told.
    assert len(expo.sent) == told


def test_run_again_the_backfill_changes_nothing(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    forget_the_game(database)
    backfill(database)
    rows, shapes = game_rows(database), unlocks(database)
    assert backfill(database) == Backfilled(accounts=0, runs=0, unlocked=0)
    assert game_rows(database) == rows and unlocks(database) == shapes


def test_the_backfill_keeps_the_run_saved_first(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    save(client, me, run_body(SIX_KM, MORNING + timedelta(minutes=1)), OTHER_KEY)
    forget_the_game(database)
    backfill(database)
    assert game_of(client, me)["counted"] is True
    assert game_of(client, me, OTHER_KEY)["reason"] == "overlap"


def test_newer_rules_compute_every_run_again(
    client: TestClient, database: Database, monkeypatch: pytest.MonkeyPatch
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM))
    monkeypatch.setattr(game_module, "RULES_VERSION", 2)
    monkeypatch.setattr(game_backfill, "RULES_VERSION", 2)
    assert backfill(database) == Backfilled(accounts=1, runs=1, unlocked=0)
    assert [row["rules_version"] for row in game_rows(database)] == [2]
    # The shape stays, once.
    assert [shape for shape, _ in unlocks(database)] == ["triangle"]


def test_the_command_needs_the_database(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv(DATABASE_VARIABLE, raising=False)
    assert main([]) == 2
    assert "SHAPEROUTE_DATABASE_URL" in capsys.readouterr().err


def test_the_command_says_what_it_did(
    client: TestClient,
    database: Database,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    me = signed_up(client, "ada")
    save(client, me, run_body(SIX_KM), KEY)
    forget_the_game(database)
    monkeypatch.setenv(DATABASE_VARIABLE, database.url)
    assert main([]) == 0
    assert capsys.readouterr().out.strip() == (
        "game_backfill: rules 1, 1 account(s), 1 run(s), 1 shape(s) unlocked"
    )
