"""The sports of the API (TASK-376, ADR-0320) give the tables the API wrote
by hand before them, value for value and in the same order: moving them
changed nothing a request, a run or Strava sees."""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import get_args

from route_engine.models import SUPPORTED_ACTIVITIES, WATER_ACTIVITIES
from route_engine.walking import API_ACTIVITIES

from shaperoute_api import prefetch_zones, sports
from shaperoute_api.activities import RECORD_ACTIVITIES, RunActivity
from shaperoute_api.personal_bests import SPORTS, Sport
from shaperoute_api.run_gpx import GPX_TYPES
from shaperoute_api.sports import API_SPORTS, SPORTS_BY_ACTIVITY
from shaperoute_api.sports.cycling import BY_BIKE
from shaperoute_api.sports.running import ON_FOOT
from shaperoute_api.strava import SPORT_TYPES

SPORTS_FOLDER = Path(sports.__file__).parent
RUN_ACTIVITIES_JSON = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared-types"
    / "fixtures"
    / "run-activities.json"
)

# The tables as they were written before the registry.
BEFORE_SPORT_TYPES = {
    "running": "Run",
    "cycling": "Ride",
    "paddling": "StandUpPaddling",
    "swimming": "Swim",
    "walking": "Walk",
    "skiing": "AlpineSki",
    "xc_skiing": "NordicSki",
}
BEFORE_RECORD_ACTIVITIES = ("skiing", "xc_skiing")
BEFORE_GPX_TYPES = {"walking": "walking"}
BEFORE_STREET_NAMES = {"running": True, "cycling": False}


def test_the_sports_are_those_of_the_contract_in_its_order() -> None:
    names = [sport.activity for sport in API_SPORTS]
    contract = json.loads(RUN_ACTIVITIES_JSON.read_text("utf-8"))
    assert names == contract["run_activities"]
    assert list(SPORTS_BY_ACTIVITY) == names
    planned = [s.activity for s in API_SPORTS if not s.record_only]
    assert tuple(planned) == API_ACTIVITIES
    assert list(get_args(RunActivity)) == names


def test_the_tables_are_those_of_before_in_their_order() -> None:
    assert list(SPORT_TYPES.items()) == list(BEFORE_SPORT_TYPES.items())
    assert RECORD_ACTIVITIES == BEFORE_RECORD_ACTIVITIES
    assert GPX_TYPES == BEFORE_GPX_TYPES
    assert list(SPORTS.items()) == [("running", ON_FOOT), ("cycling", BY_BIKE)]
    assert list(SPORTS) == list(get_args(Sport))
    assert prefetch_zones.STREET_NAMES == BEFORE_STREET_NAMES


def test_the_bests_of_before_are_read_where_they_were() -> None:
    from shaperoute_api import personal_bests

    assert personal_bests.ON_FOOT is ON_FOOT
    assert personal_bests.BY_BIKE is BY_BIKE
    assert personal_bests.BY_BIKE_KMH == 90
    assert [d.name for d in ON_FOOT.distances] == [
        "5k",
        "10k",
        "15k",
        "half",
        "30k",
        "marathon",
        "60k",
    ]
    assert [(d.name, d.record_s) for d in BY_BIKE.distances] == [
        ("10k", 400),
        ("20k", 800),
        ("40k", 1_600),
        ("50k", 2_000),
        ("100k", 4_000),
        ("160k", 6_400),
    ]


def test_the_zone_boxes_are_those_of_before() -> None:
    boxes = prefetch_zones.ZONE_BOXES
    assert list(boxes) == ["running", "cycling"]
    assert boxes["running"] is prefetch_zones.zone_box
    assert boxes["cycling"] is prefetch_zones.bike_zone_box


def test_every_sport_on_roads_has_zones_and_no_other() -> None:
    roads = {a for a in SUPPORTED_ACTIVITIES if a not in WATER_ACTIVITIES}
    with_zones = {s.activity for s in API_SPORTS if s.zones is not None}
    assert with_zones == roads


def test_a_sport_recorded_without_a_shape_has_no_bests_nor_zones() -> None:
    for sport in API_SPORTS:
        if sport.record_only:
            assert sport.bests is None and sport.zones is None, sport.activity
            assert sport.description is None, sport.activity


def _imports(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text("utf-8"))):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def test_the_sports_import_nothing_but_the_sports() -> None:
    # Data and its own rules: what reads a sport imports it, never the other
    # way round, and the phone's engine takes it without a database.
    for path in sorted(SPORTS_FOLDER.glob("*.py")):
        ours = _imports(path) - {"__future__", "dataclasses", "typing"}
        assert all(m.startswith("shaperoute_api.sports") for m in ours), (
            path.name,
            ours,
        )
