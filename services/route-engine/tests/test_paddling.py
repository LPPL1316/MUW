"""Paddling as a request (TASK-191 A2, ADR-0161): `paddling` among the
engine's activities, 1-5 km; the command line `--activity paddling` on the
water; the checks of a route on the water; 200 m off the shore at sea, 50 m
on a lake.

On the hand-built fixtures of make_water_fixtures.py, written in a cache
folder as a download would leave them. No network and no keys: a download
is refused unless a test answers it. The checks of the routes read the land
from the fixtures' own definitions, as test_water.py does.
"""

from __future__ import annotations

import importlib.util
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType
from typing import Any

import numpy as np
import pytest
import shapely
from shapely.geometry import LineString, Point

import route_engine.__main__ as cli
from route_engine import water
from route_engine.geo import LatLon, latlon_to_local_array, local_to_latlon
from route_engine.models import (
    ACTIVITIES,
    DISTANCE_LIMITS_M,
    ON_WATER_SHAPES_ONLY,
    SUPPORTED_ACTIVITIES,
    WATER_ACTIVITIES,
    InvalidRequestError,
    RouteRequest,
)
from route_engine.network import NETWORKS
from route_engine.paddling import (
    WATER_SHAPE_POINTS,
    plan_paddling,
    water_area,
    water_shape,
)
from route_engine.shapes import OUTLINES
from route_engine.validation import InvalidRouteError, check_on_water
from route_engine.water import FileWaterSource, OverpassWaterSource, WaterFitError
from route_engine.water_fit import WaterMeasures, measure

FIXTURES = Path(__file__).parent / "fixtures"
COAST = FIXTURES / "water_coast.json"
LAKE = FIXTURES / "water_lake.json"


def _builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "make_water_fixtures", FIXTURES / "make_water_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = _builder()
# On the beach, 80 m inland; on the lakeside road's side of the lake.
COAST_START = local_to_latlon(BUILD.COAST_ORIGIN, 100.0, 80.0)
LAKE_START = local_to_latlon(BUILD.LAKE_ORIGIN, -700.0, 0.0)
INLAND = local_to_latlon(BUILD.COAST_ORIGIN, 0.0, 3500.0)


def _request(
    start: LatLon, distance_m: int = 2000, shape: str = "heart"
) -> RouteRequest:
    return RouteRequest(
        start=start, shape=shape, distance_m=distance_m, activity="paddling"
    )


def _cache(folder: Path, fixture: Path, request: RouteRequest) -> Path:
    """The fixture's water in `folder`/water/, under the name of the area
    `request` needs, as a download would leave it."""
    source = FileWaterSource(fixture)
    assert source.bbox is not None
    bbox = water_area(request)
    water.write_water(
        OverpassWaterSource(folder).path(bbox), bbox, source.elements(bbox)
    )
    return folder


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


def _argv(start: LatLon, cache: Path, *more: str, distance: int = 2000) -> list[str]:
    lat, lon = start
    return [
        "--shape",
        "heart",
        "--distance",
        str(distance),
        f"--start={lat},{lon}",
        "--activity",
        "paddling",
        "--cache-dir",
        str(cache),
        *more,
    ]


def _gpx_points(path: Path) -> list[LatLon]:
    ns = {"g": "http://www.topografix.com/GPX/1/1"}
    return [
        (float(p.attrib["lat"]), float(p.attrib["lon"]))
        for p in ET.parse(path).getroot().findall(".//g:trkpt", ns)
    ]


def _dense(xy: np.ndarray, step: float = 5.0) -> np.ndarray:
    line = LineString(xy)
    steps = np.append(np.arange(0.0, line.length, step), line.length)
    return shapely.get_coordinates(shapely.line_interpolate_point(line, steps))


def _in_sea(x: float, y: float) -> bool:
    return bool(y < BUILD.coastline_y(x))


def _in_lake(x: float, y: float) -> bool:
    cx, cy = BUILD.LAKE_CENTRE
    rx, ry = BUILD.LAKE_AXES
    ix, iy, ir = BUILD.ISLAND
    inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.0
    return inside and math.hypot(x - ix, y - iy) > ir


def _lake_shore() -> shapely.Geometry:
    cx, cy = BUILD.LAKE_CENTRE
    rx, ry = BUILD.LAKE_AXES
    ix, iy, ir = BUILD.ISLAND
    t = np.linspace(0, 2 * np.pi, 2000)
    outer = LineString(np.column_stack([cx + rx * np.cos(t), cy + ry * np.sin(t)]))
    island = Point(ix, iy).buffer(ir, quad_segs=64).exterior
    return shapely.union(outer, island)


# --- An activity of the engine, not yet of the contract ----------------------


def test_paddling_is_an_engine_activity_on_the_water() -> None:
    assert DISTANCE_LIMITS_M["paddling"] == (1_000, 5_000)  # the user's choice
    assert "paddling" in ACTIVITIES
    # With the swims of TASK-323 part B, the other activity on the water.
    assert WATER_ACTIVITIES == {"paddling", "swimming"}
    # No road network: the water is its own source (water.py).
    assert not WATER_ACTIVITIES & set(NETWORKS)
    # The API offers it since TASK-191 part B, with shared-types.
    assert "paddling" in SUPPORTED_ACTIVITIES
    request = _request(COAST_START)
    assert request.activity == "paddling" and request.shape == "heart"


@pytest.mark.parametrize("distance", [999, 5_001])
def test_paddling_distances_are_1_to_5_km(distance: int) -> None:
    with pytest.raises(InvalidRequestError, match="between 1000 and 5000 metres"):
        _request(COAST_START, distance)


def test_a_word_on_the_water_is_refused() -> None:
    with pytest.raises(InvalidRequestError, match=ON_WATER_SHAPES_ONLY):
        RouteRequest(
            start=COAST_START, word="SUP", distance_m=3000, activity="paddling"
        )
    # On land a word is as before.
    RouteRequest(start=COAST_START, word="SUP", distance_m=9000)


def test_the_outline_on_the_water_has_twice_the_points_of_one_on_roads() -> None:
    shape = water_shape(_request(COAST_START))
    assert len(shape) == WATER_SHAPE_POINTS + 1  # closed
    assert shape[0] == shape[-1]
    with pytest.raises(ValueError, match="not drawn on the water"):
        water_shape(RouteRequest(start=COAST_START, shape="heart", distance_m=2000))


# --- The command line on the water --------------------------------------------


def test_the_command_line_draws_a_closed_route_on_the_sea(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = _cache(tmp_path, COAST, _request(COAST_START))
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(COAST_START, cache, "--out", str(out))) == 0
    printed = capsys.readouterr().out
    assert "activity: paddling" in printed
    assert "Water: from the cache" in printed
    assert "Road graph" not in printed
    assert "shore:" in printed and "on water:" in printed

    points = _gpx_points(out)
    assert len(points) > WATER_SHAPE_POINTS
    assert points[0] == points[-1]
    xy = latlon_to_local_array(BUILD.COAST_ORIGIN, np.asarray(points))
    coastline = LineString(BUILD.COAST_KNOTS)
    assert coastline.distance(Point(xy[0])) < 0.5  # from the shore
    dense = _dense(xy)
    off_start = np.hypot(*(dense - xy[0]).T) > 1.0
    assert all(_in_sea(x, y) for x, y in dense[off_start])  # never on land
    assert shapely.distance(shapely.points(dense), coastline).max() <= 1000.0
    # The shape keeps 200 m off the shore at sea; only the legs cross it.
    ring = LineString(xy[1:-1])
    assert coastline.distance(ring) >= water.SEA_SHORE_MARGIN_M - 0.5
    total = LineString(xy).length
    assert abs(total - 2000) <= 0.10 * 2000


def test_the_command_line_draws_on_a_lake_50_m_off_its_shore(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = _cache(tmp_path, LAKE, _request(LAKE_START, 3000))
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(LAKE_START, cache, "--out", str(out), distance=3000)) == 0
    points = _gpx_points(out)
    assert points[0] == points[-1]
    xy = latlon_to_local_array(BUILD.LAKE_ORIGIN, np.asarray(points))
    shore = _lake_shore()
    assert shore.distance(Point(xy[0])) < 1.0
    dense = _dense(xy)
    off_start = np.hypot(*(dense - xy[0]).T) > 1.0
    assert all(_in_lake(x, y) for x, y in dense[off_start])
    assert shapely.distance(shapely.points(dense), shore).max() <= 1000.0
    # On a lake the margin stays 50 m: the sea's 200 m is not applied.
    nearest = shore.distance(LineString(xy[1:-1]))
    assert water.SHORE_MARGIN_M - 0.5 <= nearest < water.SEA_SHORE_MARGIN_M
    assert "Water: from the cache" in capsys.readouterr().out


def test_far_from_the_water_the_command_line_says_so(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = _cache(tmp_path, COAST, _request(INLAND))
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(INLAND, cache, "--out", str(out))) == 1
    assert "No route: there is no lake or sea to paddle on" in capsys.readouterr().err
    assert not out.exists()


def test_a_shape_too_large_for_the_sea_says_what_fits(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = _cache(tmp_path, COAST, _request(COAST_START, 5000))
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(COAST_START, cache, "--out", str(out), distance=5000)) == 1
    err = capsys.readouterr().err
    assert "No route: the heart does not fit at 5 km" in err
    assert "it fits at" in err
    assert not out.exists()


def test_a_miss_downloads_the_water_once_into_its_own_folder(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    asked: list[str] = []
    elements = FileWaterSource(COAST).elements(water_area(_request(COAST_START)))

    def answer(query: str) -> dict[str, Any]:
        asked.append(query)
        return {"elements": elements}

    monkeypatch.setattr(water, "overpass", answer)
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(COAST_START, tmp_path, "--out", str(out))) == 0
    assert "Water: downloading from OpenStreetMap" in capsys.readouterr().out
    assert len(asked) == 1
    assert OverpassWaterSource(tmp_path).is_cached(water_area(_request(COAST_START)))
    assert not list(tmp_path.glob("*.graphml"))  # no road graph


def test_a_run_along_the_route_is_scored(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    cache = _cache(tmp_path, COAST, _request(COAST_START))
    out = tmp_path / "heart.gpx"
    assert cli.main(_argv(COAST_START, cache, "--out", str(out))) == 0
    capsys.readouterr()
    assert cli.main(_argv(COAST_START, cache, "--score-track", str(out))) == 0
    printed = capsys.readouterr().out
    assert "Track score: 100 out of 100" in printed


@pytest.mark.parametrize(
    "what, more",
    [
        ("a word", ["--word", "SUP"]),
        ("an outline", ["--outline", str(OUTLINES / "house.json")]),
        ("an image", ["--image", "subject.png"]),
    ],
)
def test_words_outlines_and_images_are_refused_on_the_water(
    what: str, more: list[str], capsys: pytest.CaptureFixture[str]
) -> None:
    lat, lon = COAST_START
    argv = [*more, "--distance=3000", f"--start={lat},{lon}", "--activity=paddling"]
    with pytest.raises(SystemExit) as caught:
        cli.parse_request(argv)
    assert caught.value.code == 2
    err = capsys.readouterr().err
    assert f"{ON_WATER_SHAPES_ONLY}, not {what}" in err
    assert "Traceback" not in err


@pytest.mark.parametrize(
    "more, message",
    [
        (["--nearby", "3"], "--nearby is for roads"),
        (["--no-optimize"], "--no-optimize is for roads"),
        (["--distance=6000"], "between 1000 and 5000 metres for paddling"),
    ],
)
def test_road_options_and_long_distances_are_refused_on_the_water(
    tmp_path: Path,
    more: list[str],
    message: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as caught:
        cli.parse_request(_argv(COAST_START, tmp_path, *more))
    assert caught.value.code == 2
    assert message in capsys.readouterr().err


# --- The plan and its checks --------------------------------------------------


def test_the_plan_is_the_shape_itself_from_a_shore_start() -> None:
    request = _request(COAST_START)
    plan = plan_paddling(request, FileWaterSource(COAST))
    result = plan.result
    assert result.shape == "heart" and result.word is None
    assert result.similarity == 1.0
    assert result.points == plan.route.points
    assert result.points[0] == result.points[-1] == plan.route.shore_start
    assert result.distance_m == plan.route.distance_m
    assert result.warnings == [] and result.walks == []
    assert plan.route.nearest_land_m >= water.SEA_SHORE_MARGIN_M - 0.5
    again = plan_paddling(request, FileWaterSource(COAST))
    assert again.result == result


def test_a_route_on_the_water_passes_its_checks() -> None:
    plan = plan_paddling(_request(LAKE_START, 3000), FileWaterSource(LAKE))
    check_on_water(measure(plan.result.points, plan.area), 3000)


def test_a_route_across_land_fails_its_checks() -> None:
    plan = plan_paddling(_request(COAST_START), FileWaterSource(COAST))
    points = plan.result.points
    inland = [local_to_latlon(BUILD.COAST_ORIGIN, x, 200.0) for x in (0.0, 300.0)]
    across = [*points[:-1], *inland, points[-1]]
    with pytest.raises(InvalidRouteError, match="on land"):
        check_on_water(measure(across, plan.area), 2000)


@pytest.mark.parametrize(
    "measures, message",
    [
        (WaterMeasures(2000.0, 0.0, 600.0, closed=False), "does not end where"),
        (WaterMeasures(2000.0, 3.0, 600.0, closed=True), "3.0 m of the route"),
        (WaterMeasures(2000.0, 0.0, 1001.0, closed=True), "1001 m from the shore"),
        (WaterMeasures(2300.0, 0.0, 600.0, closed=True), "2300 m long"),
        (WaterMeasures(1700.0, 0.0, 600.0, closed=True), "within 10% of 2000 m"),
    ],
)
def test_the_checks_on_the_water_are_errors_not_warnings(
    measures: WaterMeasures, message: str
) -> None:
    with pytest.raises(InvalidRouteError, match=message):
        check_on_water(measures, 2000)


def test_a_shape_that_does_not_fit_is_an_error_not_a_route() -> None:
    with pytest.raises(WaterFitError, match="does not fit at 5 km"):
        plan_paddling(_request(COAST_START, 5000), FileWaterSource(COAST))
