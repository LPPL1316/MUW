"""An open-water swim, planned in the bathers' band and checked (TASK-323 A1,
ADR-0283).

As the canoe (paddling.py), with no road network: the shape of the catalogue
is placed with `water_fit.fit_shape` where it fits, and the placed shape is
the route, from a beach and back to it. The band is a swimmer's
(swim_water.py): between 20 and 150 m from the shore, off harbours, marinas
and river mouths by 200 m, in from a beach or a path. The engine decides
where and how large; the AI only reads the request.

A swim is not yet an activity of `models.RouteRequest` (ADR-0283): adding it
there changes the fingerprint of the routes kept and of the app's paddling
examples, and part B, which brings swimming to the API's contract, changes
it anyway. Until then a `SwimRequest` asks for a swim, with the fields of a
RouteRequest a swim reads. Nothing else in the engine imports this module
(`route_store.SWIM_ONLY`).

    python -m route_engine.swimming --shape circle --distance 500 \\
        --start 44.0007195,12.6512502 \\
        --water-file tests/fixtures/water_coast.json --out circle_coast.gpx

The water is that of `<cache-dir>/water/`, the canoe's (one request to
Overpass on a miss), or of a file with `--water-file`.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from shapely.geometry import LineString

from route_engine.errors import ShapeNotDrawableError
from route_engine.export_gpx import route_name, to_gpx
from route_engine.geo import LatLon, latlon_to_local_array
from route_engine.models import (
    PEN_UP_WITHOUT_PIECES,
    InvalidRequestError,
    RouteResult,
    check_start,
)
from route_engine.paddling import WATER_SHAPE_POINTS, _pen_up_lines
from route_engine.shapes import FREE_ROTATION, SUPPORTED_SHAPES, get_shape, in_pieces
from route_engine.swim_water import SWIM_BAND, SwimBand, SwimWater, build_swim_area
from route_engine.validation import InvalidRouteError, check_on_water
from route_engine.water import (
    XY,
    BBox,
    FileWaterSource,
    NoWaterError,
    OverpassWaterSource,
    WaterFitError,
    WaterSource,
    to_geojson,
)
from route_engine.water_fit import (
    MIN_SCALE,
    MOVE_MAX_M,
    WaterRoute,
    fit_shape,
    measure,
    water_bbox,
)

# What part B adds to the contract's activities (models.SUPPORTED_ACTIVITIES).
ACTIVITY = "swimming"
# The target distances of a swim, in metres: the proposal of ADR-0283, the
# user's to confirm after the samples.
SWIM_DISTANCE_M = (500, 3_000)
# The band's buffers are polygons, 16 segments a quarter (shapely): 200 m
# drawn so are up to 1 m short of a circle. Validation forgives this much.
SWIM_TOLERANCE_M = 2.0


@dataclass(frozen=True, kw_only=True)
class SwimRequest:
    """A swim: a shape of the catalogue, its distance, the start. As a
    RouteRequest on the water: with the pen up a shape in pieces is drawn
    piece by piece (TASK-226), and `near` is where its centre is wanted
    (TASK-238). Never a word nor an image: on the water only a shape of the
    catalogue is drawn (models.ON_WATER_SHAPES_ONLY)."""

    start: tuple[float, float]
    distance_m: int
    shape: str
    pen_up: bool = False
    near: tuple[float, float] | None = None

    def __post_init__(self) -> None:
        check_start(self.start)
        low, high = SWIM_DISTANCE_M
        if not low <= self.distance_m <= high:
            raise InvalidRequestError(
                f"distance must be between {low} and {high} metres for "
                f"{ACTIVITY}, got {self.distance_m}"
            )
        if self.shape not in SUPPORTED_SHAPES:
            raise InvalidRequestError(
                f"unknown shape {self.shape!r}; "
                f"choose one of: {', '.join(SUPPORTED_SHAPES)}"
            )
        if self.pen_up and not in_pieces(self.shape):
            raise InvalidRequestError(f"{PEN_UP_WITHOUT_PIECES}; {self.shape} has none")
        if self.near is not None:
            check_start(self.near)


@dataclass(frozen=True)
class SwimPlan:
    """The route of a swim, how it lies on the water, and the water."""

    result: RouteResult
    route: WaterRoute
    water: SwimWater


def swim_lines(request: SwimRequest) -> tuple[list[XY], list[list[XY]]]:
    """The closed outline swum for `request`, and with the pen up the pieces
    swum after it, in its frame (as paddling.water_shape and water_pieces)."""
    if request.pen_up:
        lines = _pen_up_lines(request.shape)
        return lines[0], lines[1:]
    return list(get_shape(request.shape)(WATER_SHAPE_POINTS)), []


def swim_bbox(request: SwimRequest) -> BBox:
    """The area whose water `request` needs: the canoe's for the same shape
    and distance (water_fit.water_bbox), so the same cached file serves."""
    shape, pieces = swim_lines(request)
    return water_bbox(request.start, shape, request.distance_m, pieces)


def plan_swimming(
    request: SwimRequest,
    source: WaterSource,
    band: SwimBand = SWIM_BAND,
) -> SwimPlan:
    """The route of a swim on the water `source` gives: closed, from a beach
    or a path and back, in the swimmers' band of `band`, checked
    (`check_in_band`). The similarity is the shape's with itself, 1.

    NoWaterError when there is no band near the start, WaterFitError when
    the shape does not fit in it (both ShapeNotDrawableError), in a
    swimmer's words."""
    shape, pieces = swim_lines(request)
    bbox = water_bbox(request.start, shape, request.distance_m, pieces)
    water = build_swim_area(source.elements(bbox), request.start, bbox, band)
    try:
        route = fit_shape(
            shape,
            request.distance_m,
            water.area,
            name=request.shape,
            free_rotation=request.shape in FREE_ROTATION,
            pieces=pieces,
            near=request.near,
        )
    except NoWaterError:
        raise NoWaterError(
            f"there is no lake or sea to swim in, {_band(band)} from the shore, "
            f"within {MOVE_MAX_M / 1000:g} km of here"
        ) from None
    except WaterFitError as exc:
        raise WaterFitError(
            _not_fitting(request, band, exc.best_distance_m),
            best_distance_m=exc.best_distance_m,
        ) from None
    check_in_band(route, water, request.distance_m)
    result = RouteResult(
        points=route.points,
        distance_m=route.distance_m,
        similarity=1.0,
        shape=request.shape,
        walks=list(route.walks),
        centre=route.centre,
        # Within ±45°, counterclockwise; 0 for the circle (TASK-232).
        rotation_deg=route.rotation_deg + 0.0,
    )
    return SwimPlan(result, route, water)


def _band(band: SwimBand) -> str:
    return f"{band.min_shore_m:.0f}-{band.max_shore_m:.0f} m"


def _not_fitting(
    request: SwimRequest, band: SwimBand, best_distance_m: float | None
) -> str:
    asked = f"the {request.shape} does not fit at {request.distance_m / 1000:g} km"
    where = f"in the water {_band(band)} from the shore here"
    if best_distance_m is not None:
        return f"{asked} {where}: it fits at {best_distance_m / 1000:.1f} km"
    smallest = MIN_SCALE * request.distance_m / 1000
    return (
        f"{asked} {where}, nor smaller down to {smallest:.1f} km, "
        "with a beach or a path to go in from"
    )


@dataclass(frozen=True)
class SwimMeasures:
    """What validation looks at for a swim, besides water_fit.measure."""

    # The closest the shape comes to land, without the legs from the shore.
    nearest_land_m: float
    # The closest the route comes to a harbour, a marina or a river mouth.
    nearest_danger_m: float


def measure_swim(points: Sequence[LatLon], water: SwimWater) -> SwimMeasures:
    """The measures of a swim on `water`. The route is shore, leg, shape,
    leg, shore (water_fit._route_points): the shape is all but its ends."""
    xy = latlon_to_local_array(water.area.origin, np.asarray(points, dtype=float))
    drawn = LineString(xy[1:-1])
    danger = water.danger
    return SwimMeasures(
        nearest_land_m=float(water.area.dry.distance(drawn)),
        nearest_danger_m=(
            float("inf") if danger.is_empty else float(danger.distance(LineString(xy)))
        ),
    )


def check_in_band(route: WaterRoute, water: SwimWater, distance_m: float) -> None:
    """Raise unless a swim passes the checks of any route on the water
    (validation.check_on_water) and keeps to its band: no point farther
    than `max_shore_m` from the shore, the shape no closer than
    `min_shore_m` to land, the whole route `danger_margin_m` off harbours,
    marinas and river mouths, within SWIM_TOLERANCE_M. As on the water, a
    swim that does not is an error of the engine (InvalidRouteError)."""
    band = water.band
    measures = measure(route.points, water.area)
    check_on_water(measures, distance_m)
    if measures.farthest_shore_m > band.max_shore_m + SWIM_TOLERANCE_M:
        raise InvalidRouteError(
            f"the swim goes {measures.farthest_shore_m:.0f} m from the shore "
            f"(at most {band.max_shore_m:.0f} m)"
        )
    swim = measure_swim(route.points, water)
    if swim.nearest_land_m < band.min_shore_m - SWIM_TOLERANCE_M:
        raise InvalidRouteError(
            f"the swim's shape comes {swim.nearest_land_m:.0f} m from land "
            f"(at least {band.min_shore_m:.0f} m)"
        )
    if swim.nearest_danger_m < band.danger_margin_m - SWIM_TOLERANCE_M:
        raise InvalidRouteError(
            f"the swim comes {swim.nearest_danger_m:.0f} m from a harbour, a "
            f"marina or a river mouth (at least {band.danger_margin_m:.0f} m)"
        )


# --- Command line -----------------------------------------------------------


def _latlon(text: str) -> LatLon:
    lat, lon = (float(part) for part in text.split(","))
    return lat, lon


def main(argv: Sequence[str] | None = None) -> int:
    """`python -m route_engine.swimming`: a swim drawn as a request is, on
    the cached water or a water file, without keys."""
    parser = argparse.ArgumentParser(
        prog="python -m route_engine.swimming",
        description=(
            "Draw an open-water swim: a shape of the catalogue in the water "
            f"{_band(SWIM_BAND)} from the shore (TASK-323)."
        ),
    )
    parser.add_argument("--shape", required=True)
    low, high = SWIM_DISTANCE_M
    parser.add_argument(
        "--distance", type=int, required=True, help=f"metres, {low}-{high}"
    )
    parser.add_argument("--start", type=_latlon, required=True, help="LAT,LON")
    parser.add_argument("--pen-up", action="store_true", help="a shape in pieces")
    parser.add_argument("--near", type=_latlon, help="LAT,LON: the shape near here")
    parser.add_argument("--water-file", type=Path, help="a water file (fixtures)")
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    parser.add_argument("--out", type=Path, help="GPX to write")
    parser.add_argument("--geojson", type=Path, help="band and route to look at")
    args = parser.parse_args(argv)

    try:
        request = SwimRequest(
            start=args.start,
            distance_m=args.distance,
            shape=args.shape,
            pen_up=args.pen_up,
            near=args.near,
        )
    except InvalidRequestError as exc:
        parser.error(str(exc))
    source: WaterSource
    if args.water_file is not None:
        source = FileWaterSource(args.water_file)
    else:
        cache = OverpassWaterSource(args.cache_dir)
        cached = cache.is_cached(swim_bbox(request))
        print("Water: from the cache" if cached else "Water: downloading...")
        source = cache

    lat, lon = request.start
    print(f"Swim: {request.shape}, {request.distance_m} m, from {lat}, {lon}")
    began = time.perf_counter()
    try:
        plan = plan_swimming(request, source)
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    seconds = time.perf_counter() - began
    route, result = plan.route, plan.result
    swim = measure_swim(route.points, plan.water)
    s_lat, s_lon = route.shore_start
    print(f"  distance:      {route.distance_m:.0f} m (asked {request.distance_m})")
    print(f"  scale:         {route.scale:.2f} of full size")
    print(f"  rotation:      {route.rotation_deg:+.0f}°")
    print(
        f"  shore start:   {s_lat:.6f}, {s_lon:.6f} ({route.shore_access}), "
        f"{route.move_m:.0f} m from the start"
    )
    print(f"  leg:           {route.approach_m:.0f} m each way")
    c_lat, c_lon = route.centre
    print(f"  centre:        {c_lat:.6f}, {c_lon:.6f}")
    print(
        f"  band:          the shape {swim.nearest_land_m:.0f} m from land at the "
        f"nearest, the swim {route.farthest_shore_m:.0f} m from the shore at "
        "the farthest"
    )
    if swim.nearest_danger_m != float("inf"):
        print(f"  boats:         {swim.nearest_danger_m:.0f} m from a harbour")
    print(f"  time:          {seconds:.1f} s")
    if args.out is not None:
        when = datetime.now(UTC)
        name = route_name(request.shape, request.distance_m, when)
        document = to_gpx(result.points, name, when, result.walks)
        args.out.write_text(document, encoding="utf-8")
        print(f"Wrote {args.out}")
    if args.geojson is not None:
        text = json.dumps(to_geojson(plan.water.area, route.points))
        args.geojson.write_text(text, encoding="utf-8")
        print(f"Wrote {args.geojson}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
