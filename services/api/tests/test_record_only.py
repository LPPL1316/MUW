"""The activities recorded without a shape (TASK-375, ADR-0319): a day of
alpine skiing (`skiing`) or of cross-country skiing (`xc_skiing`) is saved,
listed and opened as any run, and goes to Strava as its own sport; it gives
no personal best, and no route request may ask one: the engine plans none.
The migration widens the check of runs it finds, so an activity another
migration added before it (0043 walking, TASK-371) stays.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any, get_args

import pytest
import route_engine
from fastapi.testclient import TestClient
from route_engine.models import InvalidRequestError
from route_engine.walking import API_ACTIVITIES
from test_personal_bests import (
    KEYS,
    client,  # noqa: F401  (the fixtures of the bests' tests)
    database,  # noqa: F401
    five_k,
    saved,
    signed_up,
)

from shaperoute_api.activities import RECORD_ACTIVITIES, RunActivity
from shaperoute_api.activity_graphs import check_supported
from shaperoute_api.db import Database, migrations
from shaperoute_api.strava import SPORT_TYPES

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / "packages" / "shared-types" / "fixtures" / "run-activities.json"
MIGRATION = "0044_record_only.sql"


def _fixture() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


# --- the contract, without a database --------------------------------------------


def test_the_activities_of_a_run_are_those_of_shared_types() -> None:
    fixture = _fixture()
    assert list(RECORD_ACTIVITIES) == fixture["record_activities"]
    assert list(get_args(RunActivity)) == fixture["run_activities"]
    assert list(get_args(RunActivity)) == [*API_ACTIVITIES, *RECORD_ACTIVITIES]


@pytest.mark.parametrize("activity", RECORD_ACTIVITIES)
def test_no_route_is_planned_for_a_day_on_the_snow(activity: str) -> None:
    assert activity not in API_ACTIVITIES
    with pytest.raises(InvalidRequestError):
        check_supported(activity)


def test_the_engine_and_its_fingerprint_know_nothing_of_the_snow() -> None:
    # The engine's fingerprint (route_store.engine_fingerprint) is its files:
    # none names these activities, so a day on the snow leaves every route
    # kept as it is (ADR-0319).
    engine = Path(route_engine.__file__).parent
    for path in engine.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert not any(f'"{a}"' in text for a in RECORD_ACTIVITIES), path.name


def test_every_activity_of_a_run_has_its_sport_on_strava() -> None:
    assert set(SPORT_TYPES) == set(get_args(RunActivity))
    assert SPORT_TYPES["skiing"] == "AlpineSki"
    assert SPORT_TYPES["xc_skiing"] == "NordicSki"


# --- saved ------------------------------------------------------------------------


@pytest.mark.parametrize("activity", RECORD_ACTIVITIES)
def test_a_day_on_the_snow_is_saved_and_opened_with_its_activity(
    client: TestClient, database: Database, activity: str  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity=activity))
    (listed,) = client.get(
        "/me/activities", headers={**me, "X-MuW-Reads": activity}
    ).json()["activities"]
    assert listed["activity"] == activity
    whole = client.get(f"/me/activities/{KEYS[0]}", headers=me).json()
    assert whole["activity"] == activity


def test_a_day_on_the_snow_gives_no_personal_best(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    # The same 5 km at 12 km/h: a run's best, none for a day of skiing.
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30))
    saved(client, me, KEYS[1], five_k(30, day=1, activity="skiing"))
    saved(client, me, KEYS[2], five_k(30, day=2, activity="xc_skiing"))
    with database.connect() as conn:
        rows = conn.execute(
            "SELECT a.activity, count(b.run_id) AS bests FROM runs a"
            " LEFT JOIN run_bests b ON b.run_id = a.id GROUP BY a.activity"
        ).fetchall()
    bests = {row["activity"]: row["bests"] for row in rows}
    assert bests["running"] > 0
    assert bests["skiing"] == 0 and bests["xc_skiing"] == 0


def test_an_activity_nobody_knows_is_still_refused(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    answer = client.put(
        f"/me/activities/{KEYS[0]}", json=five_k(30, activity="sledging"), headers=me
    )
    assert answer.status_code == 422


# --- the migration ----------------------------------------------------------------


def _runs_check(db: Database) -> str:
    with db.connect() as conn:
        row = conn.execute(
            "SELECT pg_get_constraintdef(oid) AS check FROM pg_constraint"
            " WHERE conname = 'runs_activity_check'"
        ).fetchone()
    assert row is not None
    return str(row["check"])


def _other_checks(db: Database) -> list[str]:
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT pg_get_constraintdef(oid) AS check FROM pg_constraint"
            " WHERE conname IN ('favorites_activity_check',"
            " 'group_runs_activity_check')"
        ).fetchall()
    return [str(row["check"]) for row in rows]


def test_the_migration_lets_every_activity_of_a_run_in(database_url: str) -> None:
    migrated = Database(database_url)
    migrated.migrate()
    check = _runs_check(migrated)
    assert all(f"'{activity}'" in check for activity in get_args(RunActivity))
    # Favorites and group runs keep a route to do again: no day on the snow.
    others = _other_checks(migrated)
    assert len(others) == 2
    assert not any("skiing" in other for other in others)


def test_the_migration_keeps_the_walk_of_0043(
    database_url: str, tmp_path: Path
) -> None:
    # The real migrations before this one, 0043 walking of TASK-371 among
    # them, then this one alone: it keeps the walk 0043 wrote by hand.
    record = [path for path in migrations() if path.name == MIGRATION]
    assert len(record) == 1
    earlier = [path for path in migrations() if path.name < MIGRATION]
    assert "0043_walking.sql" in [path.name for path in earlier]
    for path in earlier:
        shutil.copy(path, tmp_path / path.name)
    migrated = Database(database_url)
    migrated.migrate(tmp_path)
    before = re.findall(r"'([a-z_]+)'", _runs_check(migrated))
    assert before == list(API_ACTIVITIES)
    shutil.copy(record[0], tmp_path / MIGRATION)
    assert migrated.migrate(tmp_path) == [MIGRATION.removesuffix(".sql")]
    after = re.findall(r"'([a-z_]+)'", _runs_check(migrated))
    # Each name once, in the order of RunActivity: the walk kept, then the snow.
    assert after == list(get_args(RunActivity))
