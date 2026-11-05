"""What an app can show (TASK-387, ADR-0328): the header X-MuW-Reads read,
and the SQL it becomes, without a database."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, get_args

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from shaperoute_api.activities import RunActivity
from shaperoute_api.reads import (
    EVERYTHING,
    KINDS,
    NEWER_ACTIVITIES,
    OLD_APP,
    OLD_APP_ACTIVITIES,
    READS_HEADER,
    Reads,
    Shown,
    reads_from,
)

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared-types"
    / "fixtures"
    / "reads.json"
)
TRACKED = "r.track IS NOT NULL"


def _fixture() -> dict[str, Any]:
    return dict(json.loads(FIXTURE.read_text(encoding="utf-8")))


def test_the_header_and_its_values_are_those_of_shared_types() -> None:
    # The same JSON is read by the app's src/api/reads.test.ts.
    fixture = _fixture()
    assert fixture["header"] == READS_HEADER
    assert list(OLD_APP_ACTIVITIES) == fixture["old_app_activities"]
    assert list(KINDS) == fixture["kinds"]


def test_every_activity_a_run_says_is_read_by_someone() -> None:
    # A new activity of the API without its value here would reach no app.
    assert list(get_args(RunActivity)) == [*OLD_APP_ACTIVITIES, *NEWER_ACTIVITIES]


@pytest.mark.parametrize("lines", [[], [""], [" "], [","], ["climbing, surfing"]])
def test_no_value_known_is_an_app_of_before(lines: list[str]) -> None:
    assert reads_from(lines) == OLD_APP
    assert OLD_APP == Reads(("running", "cycling", "paddling"), trackless=False)


def test_case_and_spaces_do_not_count() -> None:
    assert reads_from([" Walking ,SKIING,  xc_Skiing "]) == Reads(
        ("running", "cycling", "paddling", "walking", "skiing", "xc_skiing")
    )


def test_an_unknown_value_is_left_out_and_the_known_ones_kept() -> None:
    assert reads_from(["climbing,walking,surfing"]) == Reads(
        ("running", "cycling", "paddling", "walking")
    )


def test_several_lines_of_the_header_add_up() -> None:
    assert reads_from(["walking", "swimming,trackless"]) == Reads(
        ("running", "cycling", "paddling", "swimming", "walking"), trackless=True
    )


def test_the_app_of_today_reads_every_activity_but_no_trackless_post() -> None:
    reads = reads_from([_fixture()["this_app"]])
    # But a workout at the gym, which comes with the screens of TASK-385 B0.
    assert reads.activities == tuple(a for a in EVERYTHING.activities if a != "gym")
    assert not reads.trackless


def test_shows_asks_the_activity_and_the_track() -> None:
    walks = reads_from(["walking"])
    assert walks.shows("walking")
    assert walks.shows("running")
    assert not walks.shows("skiing")
    assert not walks.shows("walking", tracked=False)
    assert not walks.shows(None)
    assert reads_from(["walking,trackless"]).shows("walking", tracked=False)
    assert not OLD_APP.shows("swimming")


def test_the_sql_of_an_app_of_before() -> None:
    assert OLD_APP.sql("r.activity", TRACKED) == (
        "(r.activity IN ('running', 'cycling', 'paddling') AND r.track IS NOT NULL)"
    )
    assert OLD_APP.sql("g.activity") == (
        "(g.activity IN ('running', 'cycling', 'paddling'))"
    )


def test_the_sql_of_an_app_that_reads_what_has_no_track() -> None:
    assert reads_from(["swimming,trackless"]).sql("r.activity", TRACKED) == (
        "(r.activity IN ('running', 'cycling', 'paddling', 'swimming'))"
    )


def test_the_sql_holds_only_the_fixed_names() -> None:
    reads = reads_from(["walking'); DROP TABLE users; --", "skiing"])
    assert reads == Reads(("running", "cycling", "paddling", "skiing"))
    listed = re.fullmatch(r"\(r\.activity IN \((.*)\)\)", reads.sql("r.activity"))
    assert listed is not None
    assert [name.strip("'") for name in listed.group(1).split(", ")] == list(
        reads.activities
    )
    for name in (*OLD_APP_ACTIVITIES, *KINDS):
        assert re.fullmatch(r"[a-z_]+", name)


def _echo() -> TestClient:
    app = FastAPI()

    @app.get("/reads")
    def reads(shown: Shown) -> dict[str, Any]:
        return {"activities": list(shown.activities), "trackless": shown.trackless}

    return TestClient(app)


def test_the_header_s_name_is_read_without_case() -> None:
    echo = _echo()
    assert echo.get("/reads").json() == {
        "activities": ["running", "cycling", "paddling"],
        "trackless": False,
    }
    for name in (READS_HEADER, "x-muw-reads", "X-MUW-READS"):
        answer = echo.get("/reads", headers={name: "Swimming, trackless"})
        assert answer.json() == {
            "activities": ["running", "cycling", "paddling", "swimming"],
            "trackless": True,
        }
