"""The turns of a swim and the places on the shore to turn opposite
(TASK-323 A2, ADR-0283): where the direction changes by more than 45°, its
side, angle, distance and lap; the nearest place with a name within 300 m,
from files of the cache; the turns as waypoints of the GPX.

On the hand-built fixtures of make_water_fixtures.py and
fixtures/shore_names_coast.json (three places on its beach). No network.
"""

from __future__ import annotations

import importlib.util
import json
import math
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

from route_engine import water
from route_engine.export_gpx import GPX_NAMESPACE, to_gpx
from route_engine.geo import LatLon, latlon_to_local, local_to_latlon
from route_engine.shore_names import (
    LANDMARK_REACH_M,
    FileShoreNames,
    FolderShoreNames,
    ShorePlace,
    landmarks,
    read_shore_names,
)
from route_engine.swim_turns import (
    TURN_MIN_DEG,
    SwimTurn,
    swim_turns,
    turn_label,
    with_turns,
)
from route_engine.swimming import SwimRequest, main, plan_swimming
from route_engine.water import FileWaterSource

FIXTURES = Path(__file__).parent / "fixtures"
COAST = FIXTURES / "water_coast.json"
NAMES = FIXTURES / "shore_names_coast.json"
NS = {"g": GPX_NAMESPACE}


def _builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "make_water_fixtures", FIXTURES / "make_water_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = _builder()
COAST_START = local_to_latlon(BUILD.COAST_ORIGIN, 100.0, 80.0)
ORIGIN = (45.0, 10.0)


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


def _route(xy: list[tuple[float, float]]) -> list[LatLon]:
    return [local_to_latlon(ORIGIN, x, y) for x, y in xy]


def _star(**more: Any) -> Any:
    request = SwimRequest(start=COAST_START, distance_m=500, shape="star")
    return plan_swimming(request, FileWaterSource(COAST), **more)


# --- The turns ---------------------------------------------------------------


def test_a_square_turns_at_its_corners() -> None:
    square = _route([(0, 0), (100, 0), (100, 100), (0, 100), (0, 0)])
    turns = swim_turns(square)
    assert [t.side for t in turns] == ["left", "left", "left"]
    assert [round(t.angle_deg) for t in turns] == [90, 90, 90]
    assert [round(t.at_m) for t in turns] == [100, 200, 300]
    corners = [latlon_to_local(ORIGIN, t.point) for t in turns]
    assert [tuple(round(v) for v in c) for c in corners] == [
        (100, 0),
        (100, 100),
        (0, 100),
    ]


def test_clockwise_turns_right() -> None:
    square = _route([(0, 0), (0, 100), (100, 100), (100, 0), (0, 0)])
    assert {t.side for t in swim_turns(square)} == {"right"}


def test_a_circle_has_no_turns_and_a_gentle_bend_neither() -> None:
    circle = _route(
        [
            (60 * math.cos(2 * math.pi * k / 128), 60 * math.sin(2 * math.pi * k / 128))
            for k in range(129)
        ]
    )
    assert swim_turns(circle) == []
    bend = _route([(0, 0), (100, 0), (200, 0.0 + 100 * math.tan(math.radians(40)))])
    assert swim_turns(bend) == []
    assert TURN_MIN_DEG == 45.0


def test_the_tips_and_the_notches_of_a_star_are_turns() -> None:
    plan = _star()
    turns = plan.turns
    # The leg reaches the star at a tip and goes on along its side: the
    # swimmer turns at the four other tips and at the five notches.
    assert len(turns) == 9
    assert sum(t.side == "right" for t in turns) == 4
    assert all(t.angle_deg > 130 for t in turns if t.side == "right")
    assert all(45 < t.angle_deg < 90 for t in turns if t.side == "left")
    assert [t.at_m for t in turns] == sorted(t.at_m for t in turns)
    assert all(t.lap == 1 and t.landmark is None for t in turns)


def test_each_lap_turns_at_the_same_places() -> None:
    request = SwimRequest(start=COAST_START, distance_m=1000, shape="heart")
    plan = plan_swimming(request, FileWaterSource(COAST))
    assert plan.laps == 3
    by_lap = [[t for t in plan.turns if t.lap == lap] for lap in (1, 2, 3)]
    assert all(by_lap)
    inner = [t for t in plan.turns if 1 < t.lap < 3]
    first = [t for t in by_lap[0] if t.at_m > plan.route.approach_m + 1]
    for a, b in zip(first, inner, strict=False):
        assert latlon_to_local(a.point, b.point) == pytest.approx((0, 0), abs=0.5)
        assert b.at_m - a.at_m == pytest.approx(plan.lap_m, abs=1.0)


# --- The places on the shore -------------------------------------------------


def _local(point: LatLon) -> tuple[float, float]:
    return latlon_to_local(BUILD.COAST_ORIGIN, point)


def test_each_turn_has_the_nearest_place_on_the_shore() -> None:
    plan = _star(names=FileShoreNames(NAMES))
    places = read_shore_names(NAMES)[1]
    assert len(places) == 3
    for turn in plan.turns:
        x, y = _local(turn.point)
        near = sorted(
            (math.dist((x, y), _local(p.point)), p.name)
            for p in places
            if math.dist((x, y), _local(p.point)) <= LANDMARK_REACH_M
        )
        assert turn.landmark is not None
        assert turn.landmark.name == near[0][1]
        assert turn.landmark.distance_m == pytest.approx(near[0][0], abs=1.0)
    names = {t.landmark.name for t in plan.turns if t.landmark}
    assert names == {"Bagno 54", "Hotel Miramare"}


def test_the_direction_to_look_is_towards_the_place() -> None:
    plan = _star(names=FileShoreNames(NAMES))
    for turn in plan.turns:
        assert turn.landmark is not None
        east, north = latlon_to_local(turn.point, turn.landmark.point)
        expected = math.degrees(math.atan2(east, north)) % 360
        assert turn.landmark.bearing_deg == pytest.approx(expected, abs=0.2)
        # The beach is north of the sea.
        assert turn.landmark.bearing_deg < 45 or turn.landmark.bearing_deg > 315


def test_farther_than_300_m_a_place_names_no_turn() -> None:
    turn = SwimTurn(point=COAST_START, at_m=0.0, side="left", angle_deg=90.0)
    far = ShorePlace("Faro", "lighthouse", local_to_latlon(COAST_START, 0, 301))
    near = ShorePlace("Bar", "bar", local_to_latlon(COAST_START, 0, 299))
    assert landmarks([turn], [far]) == [None]
    found = landmarks([turn], [far, near])[0]
    assert found is not None and found.name == "Bar" and found.kind == "bar"


def test_without_a_file_the_turns_have_no_name(tmp_path: Path) -> None:
    plan = _star(names=FolderShoreNames(tmp_path))
    assert plan.turns and all(t.landmark is None for t in plan.turns)


def test_a_file_that_cannot_be_read_names_nothing_and_fails_nothing(
    tmp_path: Path,
) -> None:
    folder = tmp_path / "shore_names"
    folder.mkdir()
    (folder / "broken.json").write_text("{not json", encoding="utf-8")
    plan = _star(names=FolderShoreNames(tmp_path))
    assert all(t.landmark is None for t in plan.turns)


def test_the_cache_folder_serves_the_files_of_the_area(tmp_path: Path) -> None:
    folder = tmp_path / "shore_names"
    folder.mkdir()
    (folder / "coast.json").write_text(NAMES.read_text("utf-8"), encoding="utf-8")
    elsewhere = {
        "bbox": [40.0, 8.0, 40.1, 8.1],
        "places": [
            {"name": "Lido lontano", "kind": "beach_resort", "lat": 40.05, "lon": 8.05}
        ],
    }
    (folder / "elsewhere.json").write_text(json.dumps(elsewhere), encoding="utf-8")
    bbox = (43.99, 12.64, 44.01, 12.66)
    names = {p.name for p in FolderShoreNames(tmp_path).places(bbox)}
    assert names == {"Bagno 54", "Hotel Miramare"}
    plan = _star(names=FolderShoreNames(tmp_path))
    assert all(t.landmark is not None for t in plan.turns)


def test_places_without_a_name_or_a_position_are_left_out(tmp_path: Path) -> None:
    path = tmp_path / "places.json"
    rows = [
        {"name": "", "kind": "bar", "lat": 44.0, "lon": 12.6},
        {"name": "Molo", "kind": "pier", "lat": "x", "lon": 12.6},
        {"name": "Chiesa", "lat": 44.0, "lon": 12.6},
    ]
    path.write_text(json.dumps({"places": rows}), encoding="utf-8")
    bbox, places = read_shore_names(path)
    assert bbox is None
    assert places == [ShorePlace("Chiesa", "place", (44.0, 12.6))]


# --- The GPX ------------------------------------------------------------------


def test_the_turns_of_the_first_lap_are_waypoints_before_the_track() -> None:
    request = SwimRequest(start=COAST_START, distance_m=1000, shape="heart")
    plan = plan_swimming(request, FileWaterSource(COAST), names=FileShoreNames(NAMES))
    when = datetime(2026, 10, 29, tzinfo=UTC)
    gpx = with_turns(to_gpx(plan.result.points, "heart", when), plan.turns)
    root = ET.fromstring(gpx)
    tags = [child.tag.split("}")[1] for child in root]
    assert tags.index("trk") > max(i for i, tag in enumerate(tags) if tag == "wpt")
    wpts = root.findall("g:wpt", NS)
    first = [t for t in plan.turns if t.lap == 1]
    assert len(wpts) == len(first) < len(plan.turns)
    assert [w.findtext("g:name", namespaces=NS) for w in wpts] == [
        turn_label(t) for t in first
    ]
    assert {w.findtext("g:type", namespaces=NS) for w in wpts} == {"turn"}
    assert gpx.startswith('<?xml version="1.0" encoding="UTF-8"?>')


def test_a_turn_is_named_after_its_side_and_its_place() -> None:
    plan = _star(names=FileShoreNames(NAMES))
    assert turn_label(plan.turns[0]) == "Turn left · Hotel Miramare"
    bare = SwimTurn(point=COAST_START, at_m=0.0, side="right", angle_deg=90.0)
    assert turn_label(bare) == "Turn right"


def test_the_command_line_prints_and_writes_the_turns(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    lat, lon = COAST_START
    out = tmp_path / "star.gpx"
    argv = ["--shape", "star", "--distance", "500", f"--start={lat},{lon}"]
    more = ["--water-file", str(COAST), "--names-file", str(NAMES), "--out", str(out)]
    assert main([*argv, *more]) == 0
    printed = capsys.readouterr().out
    assert "9 in the first lap" in printed
    assert "Turn right · Bagno 54" in printed
    names = [
        w.findtext("g:name", namespaces=NS)
        for w in ET.parse(out).getroot().findall("g:wpt", NS)
    ]
    assert len(names) == 9 and "Turn left · Hotel Miramare" in names
