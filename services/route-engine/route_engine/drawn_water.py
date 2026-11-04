"""A drawing paddled on the water (TASK-369 part B, ADR-0313).

On the water a canoe draws a shape of the catalogue (paddling.py, ADR-0161).
«Edit the drawing» makes a drawing of any route, an emoji's too, and on the
water it is paddled as a shape is: `water_fit.plan_on_water` places its
outline where it fits in the band of water.py near the start and joins it to
a start on the shore, and `validation.check_on_water` checks the route. It
is not left exactly where it was drawn: no route on the water is anchored.

The outline is the API's ImageRequest's (shapes.outline.Outline), its
details run there and back as on the roads; with the pen up a drawing in
pieces is paddled piece by piece (`RouteResult.walks`), as paddling.py does
a shape in pieces.

No route kept is ever a drawing (route_store._path), so this file is left
out of the engine's fingerprint (route_store.DRAWN_WATER_ONLY): changing it
keeps the routes kept, and paddling.py, water_fit.py and models.py stay as
they are.
"""

from __future__ import annotations

from route_engine.geo import LatLon
from route_engine.models import RouteResult
from route_engine.paddling import WATER_SHAPE_POINTS, WaterPlan, _cut, _length
from route_engine.shapes.outline import Outline
from route_engine.validation import check_on_water
from route_engine.water import XY, WaterSource
from route_engine.water_fit import measure, plan_on_water

# What a drawing is called in names and messages, as the API's IMAGE_NAME.
DRAWING_NAME = "image"


def drawn_lines(outline: Outline, pen_up: bool) -> tuple[list[XY], list[list[XY]]]:
    """The closed line paddled for `outline`, and with the pen up the pieces
    paddled after it, in its frame (as paddling.water_shape and
    water_pieces do for a shape)."""
    if not pen_up or not outline.in_pieces:
        return list(outline(WATER_SHAPE_POINTS)), []
    lines = outline.pen_up_lines()
    step = sum(_length(line) for line in lines) / WATER_SHAPE_POINTS
    cut = [_cut(line, step) for line in lines]
    return cut[0], cut[1:]


def plan_drawn_water(
    outline: Outline,
    distance_m: float,
    start: LatLon,
    source: WaterSource,
    *,
    pen_up: bool = False,
) -> WaterPlan:
    """The route of a drawing paddled on the water `source` gives: closed,
    from a start on the shore, checked. The similarity is the drawing's with
    itself, 1, as a shape's on the water; the result names no shape.

    NoWaterError and WaterFitError (both ShapeNotDrawableError) when there
    is no water near the start or the drawing does not fit on it."""
    shape, pieces = drawn_lines(outline, pen_up)
    route, area = plan_on_water(
        shape,
        distance_m,
        start,
        source,
        name=DRAWING_NAME,
        pieces=pieces,
    )
    check_on_water(measure(route.points, area), distance_m)
    result = RouteResult(
        points=route.points,
        distance_m=route.distance_m,
        similarity=1.0,
        shape=None,
        walks=list(route.walks),
        centre=route.centre,
        # Within ±45°, counterclockwise, as a shape's on the water.
        rotation_deg=route.rotation_deg + 0.0,
    )
    return WaterPlan(result, route, area)
