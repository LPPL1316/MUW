"""A drawing paddled on the water (TASK-369 part B, ADR-0313): placed where
it fits near the start, joined to the shore, checked as a shape on the water
is; its details run there and back; the result names no shape.

On the hand-built fixtures of make_water_fixtures.py, as test_paddling.py.
No network: the water is read from the fixture files.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from types import ModuleType

import pytest

from route_engine.drawn_water import drawn_lines, plan_drawn_water
from route_engine.geo import local_to_latlon
from route_engine.paddling import WATER_SHAPE_POINTS
from route_engine.shapes.outline import Outline, parse_outline
from route_engine.validation import check_on_water
from route_engine.water import FileWaterSource, WaterFitError
from route_engine.water_fit import measure

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

# A loop of 24 corners, as «Edit the drawing» sends the track of a run.
LOOP = [
    (
        0.9 * math.cos(2 * math.pi * i / 24),
        0.6 * math.sin(2 * math.pi * i / 24),
    )
    for i in range(24)
]
# A line drawn on it, from the loop to its middle.
STROKE = [(0.9, 0.0), (0.4, 0.0), (0.0, 0.0)]


def _outline(
    strokes: list[list[tuple[float, float]]] | None = None,
    pieces: list[list[tuple[float, float]]] | None = None,
) -> Outline:
    data: dict[str, object] = {
        "name": "image",
        "source": "a drawing of a test",
        "license": "as the test",
        "points": [[x, y] for x, y in [*LOOP, LOOP[0]]],
    }
    if strokes:
        data["strokes"] = [[[x, y] for x, y in s] for s in strokes]
    if pieces:
        data["pieces"] = [[[x, y] for x, y in p] for p in pieces]
    return parse_outline(data, allow_crossings=True)


# A small square apart from the loop, as an eye drawn on its own.
EYE = [(-0.2, 0.1), (0.0, 0.1), (0.0, 0.3), (-0.2, 0.3), (-0.2, 0.1)]


def test_a_drawing_is_paddled_where_it_fits_from_a_shore_start() -> None:
    plan = plan_drawn_water(_outline(), 2000, COAST_START, FileWaterSource(COAST))
    result = plan.result
    assert result.shape is None and result.word is None
    assert result.similarity == 1.0
    assert result.points == plan.route.points
    assert result.points[0] == result.points[-1] == plan.route.shore_start
    assert result.distance_m == plan.route.distance_m
    assert result.walks == []
    check_on_water(measure(result.points, plan.area), 2000)
    # The same drawing, the same route.
    again = plan_drawn_water(_outline(), 2000, COAST_START, FileWaterSource(COAST))
    assert again.result == result


def test_a_drawing_on_a_lake_passes_the_checks_of_the_water() -> None:
    plan = plan_drawn_water(_outline(), 3000, LAKE_START, FileWaterSource(LAKE))
    check_on_water(measure(plan.result.points, plan.area), 3000)


def test_its_details_are_paddled_with_it_there_and_back() -> None:
    plain, _ = drawn_lines(_outline(), pen_up=False)
    detailed, pieces = drawn_lines(_outline([STROKE]), pen_up=False)
    assert pieces == []
    for line in (plain, detailed):
        assert WATER_SHAPE_POINTS <= len(line) <= WATER_SHAPE_POINTS + 1
    # The middle of the loop is on the line paddled only with the detail.
    assert min(math.dist(p, (0.0, 0.0)) for p in detailed) < 0.05
    assert min(math.dist(p, (0.0, 0.0)) for p in plain) > 0.5
    plan = plan_drawn_water(
        _outline([STROKE]), 2000, COAST_START, FileWaterSource(COAST)
    )
    check_on_water(measure(plan.result.points, plan.area), 2000)


def test_with_the_pen_up_a_drawing_in_pieces_is_paddled_piece_by_piece() -> None:
    outline = _outline(pieces=[EYE])
    assert outline.in_pieces
    line, pieces = drawn_lines(outline, pen_up=True)
    assert line[0] == line[-1]
    assert len(pieces) == len(outline.pen_up_lines()) - 1 == 1
    # With the pen down, one line; a drawing in one piece, as with it down.
    assert drawn_lines(outline, pen_up=False)[1] == []
    assert drawn_lines(_outline(), pen_up=True) == drawn_lines(_outline(), False)


def test_a_drawing_that_does_not_fit_is_an_error_not_a_route() -> None:
    with pytest.raises(WaterFitError):
        plan_drawn_water(_outline(), 5000, COAST_START, FileWaterSource(COAST))
