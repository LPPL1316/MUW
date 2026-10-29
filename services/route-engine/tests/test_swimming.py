"""Open-water swims (TASK-323 A1, ADR-0283): the canoe's water with the band
turned inside out, between 20 and 150 m from the shore, 200 m off harbours,
marinas and river mouths, in from a beach or a path; a SwimRequest of
0.5-3 km; the checks of a swim; `python -m route_engine.swimming`.

On the hand-built fixtures of make_water_fixtures.py, as test_paddling.py.
No network and no keys: a download is refused.
"""

from __future__ import annotations

import importlib.util
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType
from typing import Any

import numpy as np
import pytest
import shapely
from shapely.geometry import Point

from route_engine import water
from route_engine.geo import LatLon, latlon_to_local_array, local_to_latlon
from route_engine.models import InvalidRequestError, RouteRequest
from route_engine.paddling import plan_paddling
from route_engine.swim_water import (
    SWIM_ACCESS,
    SWIM_BAND,
    SwimBand,
    build_swim_area,
)
from route_engine.swimming import (
    SwimRequest,
    check_in_band,
    main,
    measure_swim,
    plan_swimming,
    swim_bbox,
)
from route_engine.validation import InvalidRouteError
from route_engine.water import FileWaterSource, NoWaterError, WaterFitError, build_area

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


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


def _swim(
    start: LatLon = COAST_START, distance_m: int = 500, shape: str = "star"
) -> SwimRequest:
    return SwimRequest(start=start, distance_m=distance_m, shape=shape)


def _coast_water(band: SwimBand = SWIM_BAND) -> Any:
    request = _swim()
    bbox = swim_bbox(request)
    elements = FileWaterSource(COAST).elements(bbox)
    return build_swim_area(elements, request.start, bbox, band)


def _xy(water_area: Any, points: list[LatLon]) -> np.ndarray:
    return latlon_to_local_array(water_area.origin, np.asarray(points, dtype=float))


# --- The request -------------------------------------------------------------


def test_a_swim_is_half_a_km_to_three() -> None:
    assert _swim(distance_m=500).distance_m == 500
    assert _swim(distance_m=3000).distance_m == 3000
    for wrong in (499, 3001):
        with pytest.raises(InvalidRequestError, match="for swimming"):
            _swim(distance_m=wrong)


def test_a_swim_is_a_shape_of_the_catalogue() -> None:
    with pytest.raises(InvalidRequestError, match="unknown shape"):
        _swim(shape="hello")
    with pytest.raises(InvalidRequestError, match="circle has none"):
        SwimRequest(start=COAST_START, distance_m=500, shape="circle", pen_up=True)
    assert SwimRequest(start=COAST_START, distance_m=500, shape="cat", pen_up=True)
    with pytest.raises(InvalidRequestError, match="latitude"):
        SwimRequest(start=COAST_START, distance_m=500, shape="star", near=(95.0, 0.0))


def test_a_swim_is_not_yet_an_activity_of_the_contract() -> None:
    # Part B brings it there (ADR-0283): until then the routes kept and the
    # app's paddling examples are drawn by the same engine as before.
    with pytest.raises(InvalidRequestError, match="unsupported activity"):
        RouteRequest(
            start=COAST_START, shape="star", distance_m=1000, activity="swimming"
        )


# --- The band ----------------------------------------------------------------


def test_the_band_is_between_20_and_150_m_from_the_shore() -> None:
    swim = _coast_water()
    area = swim.area
    assert not area.band.is_empty
    assert area.dry.distance(area.band) >= SWIM_BAND.min_shore_m - 0.5
    beyond = area.band.difference(area.shore.buffer(SWIM_BAND.max_shore_m + 0.5))
    assert beyond.area == pytest.approx(0.0, abs=1.0)
    # The canoe's band of the same water is past 200 m off the shore.
    canoe = build_area(
        FileWaterSource(COAST).elements(area.bbox), area.origin, area.bbox
    )
    assert canoe.band.intersection(area.band).area == pytest.approx(0.0, abs=1.0)


def test_harbours_marinas_and_river_mouths_are_kept_200_m_off() -> None:
    swim = _coast_water()
    origin = BUILD.COAST_ORIGIN

    def at(x: float, y: float) -> Point:
        return Point(
            *latlon_to_local_array(
                swim.area.origin, np.array([local_to_latlon(origin, x, y)])
            )[0]
        )

    # The marina, and the river where it meets the sea.
    assert swim.danger.contains(at(2350.0, -100.0))
    assert swim.danger.contains(at(-280.0, -20.0))
    # Up the river, behind the beach, it keeps no one out of the water.
    assert not swim.danger.contains(at(-280.0, 300.0))
    assert swim.danger.distance(swim.area.band) >= SWIM_BAND.danger_margin_m - 1.0
    assert not swim.area.band.contains(at(-280.0, -80.0))
    assert swim.area.band.contains(at(100.0, -80.0))


def test_a_swimmer_goes_in_from_a_beach_or_a_path() -> None:
    swim = _coast_water()
    canoe = build_area(
        FileWaterSource(COAST).elements(swim.area.bbox),
        swim.area.origin,
        swim.area.bbox,
    )
    # The canoe goes in by the slipway at x = -2500 too; the pier at
    # x = 500 is on the beach, and reached from it.
    assert "slipway" in canoe.access_kind
    assert set(swim.area.access_kind) <= SWIM_ACCESS
    assert "beach" in swim.area.access_kind
    assert len(swim.area.access) == len(swim.area.access_kind)
    away = shapely.distance(shapely.points(swim.area.access), swim.danger)
    assert away.min() >= SWIM_BAND.danger_margin_m


def test_the_canoe_s_water_does_not_change() -> None:
    request = RouteRequest(
        start=COAST_START, shape="heart", distance_m=2000, activity="paddling"
    )
    source = FileWaterSource(COAST)
    before = plan_paddling(request, source).result
    plan_swimming(_swim(), source)
    after = plan_paddling(request, source).result
    assert after == before


# --- A swim -------------------------------------------------------------------


def test_a_star_of_half_a_km_on_the_coast() -> None:
    plan = plan_swimming(_swim(), FileWaterSource(COAST))
    result, route = plan.result, plan.route
    assert result.points[0] == result.points[-1] == route.shore_start
    assert route.shore_access in SWIM_ACCESS
    assert result.similarity == 1.0 and result.shape == "star"
    assert abs(result.distance_m - 500) <= 50
    assert route.farthest_shore_m <= SWIM_BAND.max_shore_m + 2.0
    swim = measure_swim(result.points, plan.water)
    assert swim.nearest_land_m >= SWIM_BAND.min_shore_m - 2.0
    assert swim.nearest_danger_m >= SWIM_BAND.danger_margin_m - 2.0
    xy = _xy(plan.water.area, result.points)
    assert all(BUILD.coastline_y(x) > y - 0.5 for x, y in xy)


def test_a_star_of_half_a_km_on_the_lake_from_the_road() -> None:
    plan = plan_swimming(_swim(LAKE_START), FileWaterSource(LAKE))
    assert plan.route.shore_access == "path"
    assert abs(plan.result.distance_m - 500) <= 50
    assert plan.route.farthest_shore_m <= SWIM_BAND.max_shore_m + 2.0


def test_asked_where_it_is_it_stays() -> None:
    source = FileWaterSource(COAST)
    first = plan_swimming(_swim(), source).result
    assert first.centre is not None
    again = SwimRequest(
        start=COAST_START, distance_m=500, shape="star", near=first.centre
    )
    assert plan_swimming(again, source).result.points == first.points


def test_a_circle_of_half_a_km_is_too_wide_for_the_band() -> None:
    # The risk of ADR-0283: 130 m of band hold a circle of about 0.4 km.
    with pytest.raises(WaterFitError, match="20-150 m from the shore") as caught:
        plan_swimming(_swim(shape="circle"), FileWaterSource(COAST))
    assert caught.value.best_distance_m is not None
    assert caught.value.best_distance_m < 450


def test_a_shape_that_fits_nowhere_says_so_in_a_swimmer_s_words() -> None:
    with pytest.raises(WaterFitError, match="nor smaller down to 0.4 km"):
        plan_swimming(_swim(distance_m=1000, shape="circle"), FileWaterSource(COAST))


def test_away_from_the_water_there_is_nowhere_to_swim() -> None:
    with pytest.raises(NoWaterError, match="no lake or sea to swim in"):
        plan_swimming(_swim(INLAND), FileWaterSource(COAST))


def test_a_swim_out_of_its_band_is_an_error_of_the_engine() -> None:
    plan = plan_swimming(_swim(), FileWaterSource(COAST))
    check_in_band(plan.route, plan.water, 500)
    narrower = (
        SwimBand(max_shore_m=plan.route.farthest_shore_m - 10.0),
        SwimBand(
            min_shore_m=measure_swim(plan.result.points, plan.water).nearest_land_m
            + 10.0
        ),
        SwimBand(danger_margin_m=1000.0),
    )
    for band in narrower:
        with pytest.raises(InvalidRouteError, match="the swim"):
            check_in_band(plan.route, _coast_water(band), 500)


# --- The command line ----------------------------------------------------------


def test_the_command_line_draws_a_swim(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    lat, lon = COAST_START
    out = tmp_path / "star.gpx"
    code = main(
        [
            "--shape",
            "star",
            "--distance",
            "500",
            f"--start={lat},{lon}",
            "--water-file",
            str(COAST),
            "--out",
            str(out),
        ]
    )
    assert code == 0
    printed = capsys.readouterr().out
    assert "from land at the nearest" in printed
    ns = {"g": "http://www.topografix.com/GPX/1/1"}
    points = ET.parse(out).getroot().findall(".//g:trkpt", ns)
    assert len(points) > 100
    assert points[0].attrib == points[-1].attrib


def test_the_command_line_refuses_a_swim_too_short(
    capsys: pytest.CaptureFixture[str],
) -> None:
    lat, lon = COAST_START
    with pytest.raises(SystemExit):
        main(["--shape", "star", "--distance", "400", f"--start={lat},{lon}"])
    assert "between 500 and 3000" in capsys.readouterr().err


def test_from_the_cached_water_without_the_network(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # The fixture's water in the cache folder, under the name of the area
    # the swim needs, as a download would leave it: the canoe's area.
    request = _swim()
    bbox = swim_bbox(request)
    elements = FileWaterSource(COAST).elements(bbox)
    water.write_water(water.OverpassWaterSource(tmp_path).path(bbox), bbox, elements)
    lat, lon = COAST_START
    argv = ["--shape", "star", "--distance", "500", f"--start={lat},{lon}"]
    assert main([*argv, "--cache-dir", str(tmp_path)]) == 0
    assert "Water: from the cache" in capsys.readouterr().out
