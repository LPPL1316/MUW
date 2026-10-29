"""Open-water swims (TASK-323 A1, ADR-0283): the canoe's water with the band
turned inside out, between 20 and 150 m from the shore, 200 m off harbours,
marinas and river mouths, in from a beach or a path; a SwimRequest of
0.5-3 km, of a shape or a drawing, swum lap after lap; the checks of a swim;
`python -m route_engine.swimming`.

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
from route_engine.shapes.outline import parse_outline
from route_engine.swim_water import (
    SWIM_ACCESS,
    SWIM_BAND,
    SwimBand,
    build_swim_area,
)
from route_engine.swimming import (
    MAX_LAPS,
    SwimRequest,
    check_in_band,
    lapped,
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


# A drawing as «Freehand» sends it (TASK-320): a closed line in [-1, 1].
DRAWING = parse_outline(
    {
        "name": "drawing",
        "source": "drawn by hand in the test",
        "license": "CC0",
        "points": [
            [-1.0, -0.4],
            [-0.3, -0.5],
            [0.2, -0.9],
            [0.9, -0.3],
            [0.6, 0.5],
            [0.0, 0.9],
            [-0.7, 0.6],
            [-1.0, -0.4],
        ],
    },
    allow_crossings=True,
)


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


def test_a_swim_is_a_shape_or_a_drawing_one_of_the_two() -> None:
    drawn = SwimRequest(start=COAST_START, distance_m=500, outline=DRAWING)
    assert drawn.name == "drawing"
    for wrong in ({}, {"shape": "star", "outline": DRAWING}):
        with pytest.raises(InvalidRequestError, match="one of the two"):
            SwimRequest(start=COAST_START, distance_m=500, **wrong)


def test_a_swim_goes_round_its_shape_one_to_five_times() -> None:
    assert MAX_LAPS == 5
    assert SwimRequest(start=COAST_START, distance_m=500, shape="star", laps=5)
    for wrong in (0, 6):
        with pytest.raises(InvalidRequestError, match="1 to 5 times"):
            SwimRequest(start=COAST_START, distance_m=500, shape="star", laps=wrong)


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


def test_a_circle_of_half_a_km_is_swum_in_two_laps() -> None:
    # The risk of ADR-0283: 130 m of band hold a circle of about 0.4 km, so
    # half a kilometre is the circle twice (the user's choice).
    plan = plan_swimming(_swim(shape="circle"), FileWaterSource(COAST))
    assert plan.laps == 2
    assert abs(plan.result.distance_m - 500) <= 50
    points = plan.result.points
    per_lap = (len(points) - 2 - 1) // 2
    first, second = points[1 : 2 + per_lap], points[1 + per_lap : 2 + 2 * per_lap]
    assert first == second
    assert first[0] == first[-1]
    check_in_band(plan.route, plan.water, 500)


def test_the_fewer_the_laps_the_larger_the_shape() -> None:
    source = FileWaterSource(COAST)
    fewest = plan_swimming(_swim(distance_m=1000, shape="heart"), source)
    assert fewest.laps == 3
    smaller = SwimRequest(start=COAST_START, distance_m=1000, shape="heart", laps=4)
    more = plan_swimming(smaller, source)
    assert more.laps == 4
    assert more.lap_m < fewest.lap_m
    assert abs(more.result.distance_m - 1000) <= 100


def test_too_few_laps_say_how_many_fit() -> None:
    larger = SwimRequest(start=COAST_START, distance_m=1000, shape="heart", laps=2)
    with pytest.raises(WaterFitError, match="fit in 2 laps.*it fits in 3 laps"):
        plan_swimming(larger, FileWaterSource(COAST))


def test_too_long_even_in_five_laps_says_what_fits() -> None:
    with pytest.raises(WaterFitError, match="even in 5 laps") as caught:
        plan_swimming(_swim(distance_m=3000, shape="circle"), FileWaterSource(COAST))
    fits = caught.value.best_distance_m
    assert fits is not None and 1200 < fits < 2500


def test_a_drawing_is_swum_as_a_shape() -> None:
    request = SwimRequest(start=COAST_START, distance_m=1000, outline=DRAWING)
    plan = plan_swimming(request, FileWaterSource(COAST))
    assert plan.result.shape is None
    assert abs(plan.result.distance_m - 1000) <= 100
    check_in_band(plan.route, plan.water, 1000)


def test_each_lap_has_its_pen_up_stretches() -> None:
    points = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (1.0, 0.0), (0.0, 0.0)]
    out, walks = lapped(points, [(2, 3)], 3)
    lap = points[1:-1]
    assert out == [points[0], *lap, *lap[1:], *lap[1:], points[-1]]
    assert walks == [(2, 3), (5, 6), (8, 9)]
    assert all(out[a] == points[2] and out[b] == points[3] for a, b in walks)


def test_a_cat_with_the_pen_up_lifts_it_every_lap() -> None:
    request = SwimRequest(start=COAST_START, distance_m=1500, shape="cat", pen_up=True)
    plan = plan_swimming(request, FileWaterSource(COAST))
    assert plan.laps > 1
    assert len(plan.result.walks) % plan.laps == 0
    assert len(plan.result.walks) >= plan.laps


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


def test_the_command_line_draws_a_drawing_in_laps(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    lat, lon = COAST_START
    drawing = tmp_path / "drawing.json"
    drawing.write_text(
        '{"name": "drawing", "source": "test", "license": "CC0", "points": '
        "[[-1, -0.4], [-0.3, -0.5], [0.2, -0.9], [0.9, -0.3], [0.6, 0.5], "
        "[0, 0.9], [-0.7, 0.6], [-1, -0.4]]}",
        encoding="utf-8",
    )
    argv = ["--outline", str(drawing), "--distance", "1000", f"--start={lat},{lon}"]
    assert main([*argv, "--laps", "4", "--water-file", str(COAST)]) == 0
    assert "4 laps of" in capsys.readouterr().out


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
