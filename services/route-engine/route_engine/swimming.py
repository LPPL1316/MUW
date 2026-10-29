"""An open-water swim, planned in the bathers' band and checked (TASK-323 A1,
ADR-0283).

As the canoe (paddling.py), with no road network: the shape is placed with
`water_fit.fit_shape` where it fits, and the placed shape is the route, from
a beach and back to it. The band is a swimmer's (swim_water.py): between 20
and 150 m from the shore, off harbours, marinas and river mouths by 200 m,
in from a beach or a path. The engine decides where and how large; the AI
only reads the request.

130 m of band hold a shape of about half a kilometre: a longer swim goes
round it again, lap after lap (the user's choice of 2026-10-29). The swim
is the leg out, the shape `laps` times, the leg back, as long as the distance
asked; the fewer the laps, the larger the shape. Asked with a number of laps
the shape is as large as that many laps make it, which is how the drawing
is made larger or smaller without changing the distance (the user's ask of
the same day). The shape is one of the catalogue or a drawing of the user's,
an outline as «Freehand» sends it (TASK-320).

A swim is not yet an activity of `models.RouteRequest` (ADR-0283): adding it
there changes the fingerprint of the routes kept and of the app's paddling
examples, and part B, which brings swimming to the API's contract, changes
it anyway. Until then a `SwimRequest` asks for a swim. Nothing else in the
engine imports this module (`route_store.SWIM_ONLY`).

    python -m route_engine.swimming --shape star --distance 1000 \\
        --start 44.0007195,12.6512502 \\
        --water-file tests/fixtures/water_coast.json --out star_coast.gpx

The water is that of `<cache-dir>/water/`, the canoe's (one request to
Overpass on a miss), or of a file with `--water-file`. The turns of the swim
(swim_turns.py) are named after the places on the shore of
`<cache-dir>/shore_names/` (shore_names.py), or of `--names-file`; without
them they have no name. The GPX has a waypoint for each turn.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections.abc import Sequence
from dataclasses import dataclass, replace
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
from route_engine.paddling import WATER_SHAPE_POINTS, _cut, _length
from route_engine.shapes import FREE_ROTATION, SUPPORTED_SHAPES, get_shape, in_pieces
from route_engine.shapes.outline import InvalidOutlineError, Outline, read_outline
from route_engine.shore_names import (
    FileShoreNames,
    FolderShoreNames,
    ShoreNameSource,
    landmarks,
)
from route_engine.swim_turns import SwimTurn, named, swim_turns, turn_label, with_turns
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
    DISTANCE_TOLERANCE,
    MOVE_MAX_M,
    WaterRoute,
    fit_shape,
    measure,
    water_bbox,
)

# What part B adds to the contract's activities (models.SUPPORTED_ACTIVITIES).
ACTIVITY = "swimming"
# The target distances of a swim, in metres, every lap and both legs: the
# user's choice, with the laps (ADR-0283).
SWIM_DISTANCE_M = (500, 3_000)
# A swim goes round its shape this many times at most (the user's choice of
# 2026-10-29): with half a kilometre of shape, about 2.5 km.
MAX_LAPS = 5
# The band's buffers are polygons, 16 segments a quarter (shapely): 200 m
# drawn so are up to 1 m short of a circle. Validation forgives this much.
SWIM_TOLERANCE_M = 2.0


@dataclass(frozen=True, kw_only=True)
class SwimRequest:
    """A swim: a shape of the catalogue or a drawn outline (one of the
    two), the distance of the whole swim, the start. With `laps` the shape
    is swum that many times, as large as they make it; without, the engine
    takes the fewest laps it fits in. As a RouteRequest on the water: with
    the pen up a shape in pieces is drawn piece by piece (TASK-226), and
    `near` is where its centre is wanted (TASK-238). Never a word nor an
    image's picture: the outline is what the app traced or drew."""

    start: tuple[float, float]
    distance_m: int
    shape: str | None = None
    outline: Outline | None = None
    laps: int | None = None
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
        if (self.shape is None) == (self.outline is None):
            raise InvalidRequestError(
                "give either a shape or a drawn outline, one of the two"
            )
        if self.shape is not None and self.shape not in SUPPORTED_SHAPES:
            raise InvalidRequestError(
                f"unknown shape {self.shape!r}; "
                f"choose one of: {', '.join(SUPPORTED_SHAPES)}"
            )
        if self.laps is not None and not 1 <= self.laps <= MAX_LAPS:
            raise InvalidRequestError(
                f"a swim goes round its shape 1 to {MAX_LAPS} times, "
                f"got {self.laps}"
            )
        if self.pen_up and not self.in_pieces:
            raise InvalidRequestError(f"{PEN_UP_WITHOUT_PIECES}; {self.name} has none")
        if self.near is not None:
            check_start(self.near)

    @property
    def in_pieces(self) -> bool:
        """Whether there are pieces to swim with the pen up (TASK-223)."""
        if self.outline is not None:
            return self.outline.in_pieces
        return in_pieces(str(self.shape))

    @property
    def name(self) -> str:
        """For messages and the GPX: the shape, or the outline's name."""
        if self.outline is not None:
            return self.outline.name
        return str(self.shape)


@dataclass(frozen=True)
class SwimPlan:
    """The route of a swim, how it lies on the water, and the water: the
    shape `laps` times, each lap `lap_m` long (the shape, without the legs),
    and its turns in order, every lap's (TASK-323 A2). Part B moves the
    turns into RouteResult, with the contract."""

    result: RouteResult
    route: WaterRoute
    water: SwimWater
    laps: int
    lap_m: float
    turns: tuple[SwimTurn, ...] = ()


def swim_lines(request: SwimRequest) -> tuple[list[XY], list[list[XY]]]:
    """The closed outline swum for `request`, and with the pen up the pieces
    swum after it, in its frame (as paddling.water_shape and water_pieces)."""
    drawn = request.outline or get_shape(str(request.shape))
    if not request.pen_up:
        return list(drawn(WATER_SHAPE_POINTS)), []
    assert isinstance(drawn, Outline)  # SwimRequest: pen up, so in pieces
    lines = drawn.pen_up_lines()
    step = sum(_length(line) for line in lines) / WATER_SHAPE_POINTS
    cut = [_cut(line, step) for line in lines]
    return cut[0], cut[1:]


def swim_bbox(request: SwimRequest) -> BBox:
    """The area whose water `request` needs: the canoe's for the same shape
    and distance (water_fit.water_bbox), so the same cached file serves. One
    lap is never longer than the swim."""
    shape, pieces = swim_lines(request)
    return water_bbox(request.start, shape, request.distance_m, pieces)


def plan_swimming(
    request: SwimRequest,
    source: WaterSource,
    band: SwimBand = SWIM_BAND,
    names: ShoreNameSource | None = None,
) -> SwimPlan:
    """The route of a swim on the water `source` gives: closed, from a beach
    or a path and back, the shape lap after lap in the swimmers' band of
    `band`, checked (`check_in_band`), with its turns, each named after the
    place of `names` on the shore nearest it (shore_names.landmarks). The
    similarity is the shape's with itself, 1.

    NoWaterError when there is no band near the start, WaterFitError when
    the shape does not fit in it in as many laps as asked, or MAX_LAPS
    (both ShapeNotDrawableError), in a swimmer's words."""
    bbox = swim_bbox(request)
    water = build_swim_area(source.elements(bbox), request.start, bbox, band)
    plan = swim_on(water, request)
    if names is None or not plan.turns:
        return plan
    found = landmarks(plan.turns, names.places(bbox))
    return replace(plan, turns=tuple(named(plan.turns, found)))


def swim_on(water: SwimWater, request: SwimRequest) -> SwimPlan:
    """`plan_swimming` on water already built: the laps asked, or the
    fewest from 1 to MAX_LAPS the shape fits in."""
    tried: list[int] = [request.laps] if request.laps else list(range(1, MAX_LAPS + 1))
    one_lap: float | None = None  # the longest lap a WaterFitError said fits
    for laps in tried:
        if one_lap is not None and request.distance_m / laps > one_lap * (
            1 + DISTANCE_TOLERANCE
        ):
            continue  # a lap this long does not fit: the error before said so
        try:
            route = _lapped(water, request, laps)
        except WaterFitError as exc:
            if exc.best_distance_m is not None:
                one_lap = max(one_lap or 0.0, exc.best_distance_m)
            continue
        check_in_band(route, water, request.distance_m)
        return _plan(request, route, water, laps)
    if request.laps is not None:
        # Asked larger than it fits, or smaller: in how many laps it does.
        fits = swim_on(water, replace(request, laps=None))
        raise WaterFitError(
            f"the {request.name} of {request.distance_m / 1000:g} km does not "
            f"fit in {_laps(request.laps)} in the water {_band(water.band)} "
            f"from the shore here: it fits in {_laps(fits.laps)}"
        )
    raise _not_fitting(water, request, one_lap)


def _fit(water: SwimWater, request: SwimRequest, lap_m: float) -> WaterRoute:
    """One lap: the shape placed so that it and both legs are `lap_m` long,
    as a route on the canoe's water is."""
    shape, pieces = swim_lines(request)
    try:
        return fit_shape(
            shape,
            lap_m,
            water.area,
            name=request.name,
            free_rotation=request.shape in FREE_ROTATION,
            pieces=pieces,
            near=request.near,
        )
    except NoWaterError:
        raise NoWaterError(
            f"there is no lake or sea to swim in, {_band(water.band)} from the "
            f"shore, within {MOVE_MAX_M / 1000:g} km of here"
        ) from None


def _lapped(water: SwimWater, request: SwimRequest, laps: int) -> WaterRoute:
    """The swim in `laps` laps, within DISTANCE_TOLERANCE of the distance.

    A lap is placed as a route of its own, legs included, so with more laps
    than one the legs are counted once a lap: a second placement asks for
    the lap that, with the legs of the first, makes the distance, and the
    closer of the two is kept."""
    distance = request.distance_m
    routes = [_repeat(_fit(water, request, distance / laps), laps, water)]
    if laps > 1:
        legs = 2 * routes[0].approach_m
        try:
            again = _fit(water, request, (distance - legs) / laps + legs)
        except WaterFitError:
            pass
        else:
            routes.append(_repeat(again, laps, water))
    route = min(routes, key=lambda r: abs(r.distance_m - distance))
    if abs(route.distance_m - distance) > DISTANCE_TOLERANCE * distance:
        raise WaterFitError(
            f"{laps} laps of the {request.name} are {route.distance_m:.0f} m here"
        )
    return route


def lapped(
    points: Sequence[LatLon], walks: Sequence[tuple[int, int]], laps: int
) -> tuple[list[LatLon], list[tuple[int, int]]]:
    """A route on the water, shore, leg, shape, leg, shore, with the shape
    swum `laps` times: each lap from where the leg reaches it round to the
    same point, then the next. The pen-up stretches (`walks`, indices into
    `points`) are those of each lap, moved along."""
    lap = list(points[1:-1])
    per_lap = len(lap) - 1
    out = [points[0], *lap]
    for _ in range(laps - 1):
        out.extend(lap[1:])
    out.append(points[-1])
    moved = [(a + k * per_lap, b + k * per_lap) for k in range(laps) for a, b in walks]
    return out, moved


def _repeat(route: WaterRoute, laps: int, water: SwimWater) -> WaterRoute:
    if laps == 1:
        return route
    points, walks = lapped(route.points, route.walks, laps)
    return replace(
        route,
        points=points,
        distance_m=_length_m(points, water),
        walks=tuple(walks),
    )


def _length_m(points: Sequence[LatLon], water: SwimWater) -> float:
    xy = latlon_to_local_array(water.area.origin, np.asarray(points, dtype=float))
    return float(LineString(xy).length)


def _plan(
    request: SwimRequest, route: WaterRoute, water: SwimWater, laps: int
) -> SwimPlan:
    result = RouteResult(
        points=route.points,
        distance_m=route.distance_m,
        similarity=1.0,
        # A drawing is not a shape of the catalogue, as an image's outline.
        shape=request.shape,
        walks=list(route.walks),
        centre=route.centre,
        # Within ±45°, counterclockwise; 0 for the circle (TASK-232).
        rotation_deg=route.rotation_deg + 0.0,
    )
    lap_m = (route.distance_m - 2 * route.approach_m) / laps
    turns = swim_turns(route.points, laps=laps, leg_m=route.approach_m, lap_m=lap_m)
    return SwimPlan(result, route, water, laps, lap_m, tuple(turns))


def _band(band: SwimBand) -> str:
    return f"{band.min_shore_m:.0f}-{band.max_shore_m:.0f} m"


def _laps(laps: int) -> str:
    return "1 lap" if laps == 1 else f"{laps} laps"


def _not_fitting(
    water: SwimWater, request: SwimRequest, one_lap: float | None
) -> WaterFitError:
    """Why a swim does not fit in 1 to MAX_LAPS laps, and what does: the
    swim of MAX_LAPS laps of the longest lap that fits, its distance as
    best_distance_m; none when no lap fits at all."""
    asked = f"the {request.name} does not fit at {request.distance_m / 1000:g} km"
    where = f"in the water {_band(water.band)} from the shore here"
    nowhere = WaterFitError(
        f"{asked} {where}, in 1 to {MAX_LAPS} laps, with a beach or a path "
        "to go in from"
    )
    if one_lap is None:
        return nowhere
    try:
        longest = _repeat(_fit(water, request, one_lap), MAX_LAPS, water)
    except WaterFitError:
        return nowhere
    return WaterFitError(
        f"{asked} {where}, even in {MAX_LAPS} laps: it fits at "
        f"{longest.distance_m / 1000:.1f} km",
        best_distance_m=longest.distance_m,
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
            "Draw an open-water swim: a shape lap after lap in the water "
            f"{_band(SWIM_BAND)} from the shore (TASK-323)."
        ),
    )
    what = parser.add_mutually_exclusive_group(required=True)
    what.add_argument("--shape", help="a shape of the catalogue")
    what.add_argument("--outline", type=Path, help="a drawn outline, as JSON")
    low, high = SWIM_DISTANCE_M
    parser.add_argument(
        "--distance", type=int, required=True, help=f"metres, {low}-{high}"
    )
    parser.add_argument("--start", type=_latlon, required=True, help="LAT,LON")
    parser.add_argument("--laps", type=int, help=f"1-{MAX_LAPS}: fewer, a larger shape")
    parser.add_argument("--pen-up", action="store_true", help="a shape in pieces")
    parser.add_argument("--near", type=_latlon, help="LAT,LON: the shape near here")
    parser.add_argument("--water-file", type=Path, help="a water file (fixtures)")
    parser.add_argument(
        "--names-file", type=Path, help="places on the shore, a file (fixtures)"
    )
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    parser.add_argument("--out", type=Path, help="GPX to write")
    parser.add_argument("--geojson", type=Path, help="band and route to look at")
    args = parser.parse_args(argv)

    try:
        outline = None if args.outline is None else read_outline(args.outline)
        request = SwimRequest(
            start=args.start,
            distance_m=args.distance,
            shape=args.shape,
            outline=outline,
            laps=args.laps,
            pen_up=args.pen_up,
            near=args.near,
        )
    except (InvalidRequestError, InvalidOutlineError) as exc:
        parser.error(str(exc))
    source: WaterSource
    if args.water_file is not None:
        source = FileWaterSource(args.water_file)
    else:
        cache = OverpassWaterSource(args.cache_dir)
        cached = cache.is_cached(swim_bbox(request))
        print("Water: from the cache" if cached else "Water: downloading...")
        source = cache

    names: ShoreNameSource = (
        FolderShoreNames(args.cache_dir)
        if args.names_file is None
        else FileShoreNames(args.names_file)
    )

    lat, lon = request.start
    print(f"Swim: {request.name}, {request.distance_m} m, from {lat}, {lon}")
    began = time.perf_counter()
    try:
        plan = plan_swimming(request, source, names=names)
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    seconds = time.perf_counter() - began
    route, result = plan.route, plan.result
    swim = measure_swim(route.points, plan.water)
    s_lat, s_lon = route.shore_start
    print(f"  distance:      {route.distance_m:.0f} m (asked {request.distance_m})")
    print(f"  laps:          {_laps(plan.laps)} of {plan.lap_m:.0f} m")
    print(f"  scale:         {route.scale:.2f} of a lap's full size")
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
    first = [turn for turn in plan.turns if turn.lap == 1]
    print(f"  turns:         {len(first)} in the first lap, {len(plan.turns)} in all")
    for turn in first:
        mark = turn.landmark
        where = (
            ""
            if mark is None
            else f" ({mark.distance_m:.0f} m at {mark.bearing_deg:.0f}°)"
        )
        print(
            f"    {turn.at_m:5.0f} m  {turn_label(turn)}, {turn.angle_deg:.0f}°{where}"
        )
    if args.out is not None:
        when = datetime.now(UTC)
        name = route_name(request.name, request.distance_m, when)
        document = with_turns(
            to_gpx(result.points, name, when, result.walks), plan.turns
        )
        args.out.write_text(document, encoding="utf-8")
        print(f"Wrote {args.out}")
    if args.geojson is not None:
        text = json.dumps(to_geojson(plan.water.area, route.points))
        args.geojson.write_text(text, encoding="utf-8")
        print(f"Wrote {args.geojson}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
