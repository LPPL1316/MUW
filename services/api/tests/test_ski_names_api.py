"""The lifts and pistes of a day of skiing on its post (TASK-375 part D2,
ADR-0319): found once when the day is saved (migration 0048), and given by
GET /drawings/{id}/ski-names to whoever can see the post, if the app reads
skiing (X-MuW-Reads, TASK-387).

The day is the 5.1 km north of the bests' tests (test_personal_bests.py),
a fix every 100 m: its first kilometre up a made-up chairlift, the next
two down a made-up piste.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_personal_bests import (
    DEGREE_M,
    FAST_HASHER,
    FIXTURES,
    KEYS,
    START,
    WallClock,
    database,  # noqa: F401  (the fixture of the bests' tests)
    five_k,
    published,
    saved,
    signed_up,
)

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.ski_extract import SkiLine, write_tiles
from shaperoute_api.ski_names_api import SkiNamesBody, install_ski_names

SKIING = {"X-MuW-Reads": "skiing"}


def _north(metres: float) -> tuple[float, float]:
    return START[0] + metres / DEGREE_M, START[1]


CHAIR = SkiLine(1, "lift", "chair_lift", "Seggiovia Test", (_north(0), _north(1000)))
NAMELESS = SkiLine(2, "lift", "drag_lift", None, (_north(3000), _north(3500)))
PISTE = SkiLine(3, "piste", "intermediate", "Pista Test", (_north(1000), _north(3000)))


def _app(database: Database, ski_dir: Path | None) -> TestClient:  # noqa: F811
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=WallClock(), hasher=FAST_HASHER),
        run_places=PlaceNames(None),
    )
    if ski_dir is not None:
        install_ski_names(app, ski_dir)
    return TestClient(app)


@pytest.fixture
def ski_dir(tmp_path: Path) -> Path:
    write_tiles([CHAIR, NAMELESS, PISTE], tmp_path)
    return tmp_path


@pytest.fixture
def client(database: Database, ski_dir: Path) -> TestClient:  # noqa: F811
    return _app(database, ski_dir)


def _kept(database: Database) -> dict[str, Any]:  # noqa: F811
    with database.connect() as conn:
        rows = conn.execute("SELECT activity, ski_names FROM runs").fetchall()
    return {row["activity"]: row["ski_names"] for row in rows}


def _names(client: TestClient, headers: dict[str, str], drawing: str) -> Any:
    return client.get(f"/drawings/{drawing}/ski-names", headers=headers)


THE_DAY = {
    "lifts": [{"name": "Seggiovia Test", "type": "chair_lift", "times": 1}],
    "pistes": [{"name": "Pista Test", "type": "intermediate", "times": 1}],
}


def test_a_day_of_skiing_keeps_its_names(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    saved(client, me, KEYS[1], five_k(30, day=1))
    kept = _kept(database)
    # The drag lift has no name: left out, as the user chose.
    assert kept["skiing"] == THE_DAY
    # Any other sport is not looked at.
    assert kept["running"] is None


def test_the_post_gives_the_names_to_an_app_that_reads_skiing(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me, other = signed_up(client, 1), signed_up(client, 2)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    drawing = published(client, me, KEYS[0], "everyone")
    for viewer in (me, other):
        answer = _names(client, {**viewer, **SKIING}, drawing)
        assert answer.status_code == 200, answer.text
        assert answer.json() == THE_DAY


def test_an_app_that_does_not_read_skiing_finds_nothing(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    drawing = published(client, me, KEYS[0], "everyone")
    # Without X-MuW-Reads, as the post itself: not there.
    assert _names(client, me, drawing).status_code == 404
    assert client.get(f"/drawings/{drawing}", headers=me).status_code == 404
    assert _names(client, {**me, **SKIING}, drawing).status_code == 200


def test_who_cannot_see_the_post_finds_nothing(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me, other = signed_up(client, 1), signed_up(client, 2)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    drawing = published(client, me, KEYS[0], "only_me")
    assert _names(client, {**me, **SKIING}, drawing).status_code == 200
    assert _names(client, {**other, **SKIING}, drawing).status_code == 404
    assert _names(client, SKIING, drawing).status_code == 401


def test_an_unknown_drawing_finds_nothing(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    headers = {**me, **SKIING}
    assert _names(client, headers, "not-an-id").status_code == 404
    unknown = "00000000-0000-4000-8000-000000000000"
    assert _names(client, headers, unknown).status_code == 404


def test_a_run_has_no_names(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30))
    drawing = published(client, me, KEYS[0], "everyone")
    answer = _names(client, me, drawing)
    assert answer.status_code == 200
    assert answer.json() == {"lifts": [], "pistes": []}


def test_without_the_ski_tiles_a_day_is_saved_without_names(
    database: Database,  # noqa: F811
) -> None:
    client = _app(database, None)
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    assert _kept(database)["skiing"] is None


def test_a_day_far_from_any_ski_area_has_empty_lists(
    database: Database, tmp_path: Path  # noqa: F811
) -> None:
    client = _app(database, tmp_path / "no-tiles")
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    drawing = published(client, me, KEYS[0], "everyone")
    assert _kept(database)["skiing"] == {"lifts": [], "pistes": []}
    assert _names(client, {**me, **SKIING}, drawing).json() == {
        "lifts": [],
        "pistes": [],
    }


def test_the_names_are_kept_once(
    client: TestClient, database: Database, ski_dir: Path  # noqa: F811
) -> None:
    me = signed_up(client, 1)
    saved(client, me, KEYS[0], five_k(30, activity="skiing"))
    # New tiles do not change a day already saved, nor does sending it again.
    write_tiles([SkiLine(1, "lift", "chair_lift", "Renamed", CHAIR.points)], ski_dir)
    again = client.put(
        f"/me/activities/{KEYS[0]}", json=five_k(30, activity="skiing"), headers=me
    )
    assert again.status_code == 200
    assert _kept(database)["skiing"] == THE_DAY


def test_the_example_is_the_body() -> None:
    example = json.loads((FIXTURES / "ski-names.json").read_text(encoding="utf-8"))
    assert set(example) == set(SkiNamesBody.model_fields)
    SkiNamesBody.model_validate(example)
