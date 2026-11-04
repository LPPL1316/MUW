"""A drawing left where it was drawn, traced once (TASK-347 part A,
ADR-0300; docs/ROUTE_ENGINE.md §4, «Il disegno ancorato e i tratti»).

`plan_anchored` is `optimizer.plan_shape` without the search: the shape's
first point on the start, upright, at the scale of the distance asked, the
roads following it as closely as the magnet `fit` says (stroke_match), and
nothing moved, turned or rescaled afterwards. The distance is checked, not
corrected: off by more than DISTANCE_TOLERANCE, a warning says so and the
route is still given. What «Draw route» asks for a drawing made on the map.

The result says where the drawing was placed (`AnchoredPlan.placed`,
`placed_lines`), so the app can keep it under the route as a ghost; the
API gives the same for a searched route from `plan.search.best.shape`.

Like stroke_match.py this is a new module beside the engine's own, which
it does not change: both are left out of the API's fingerprint of the
engine (route_store.ANCHORED_ONLY), so the routes the server keeps stay
valid. Anchored routes are never kept there.

From the command line (§7), offline with the graphs in the cache:

    python -m route_engine.anchored --shape heart --distance 5000 \\
        --start 46.0671,11.1214 --fit 0.5 --out heart_anchored.gpx
    python -m route_engine.anchored --outline drawing.json --distance 5000 \\
        --start 46.0671,11.1214 --json
    python -m route_engine.anchored --stroke stroke.json --from 46.07,11.126
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from route_engine import pen_up
from route_engine.errors import ShapeNotDrawableError
from route_engine.export_gpx import route_name, to_gpx
from route_engine.geo import LatLon, latlon_to_local_array
from route_engine.metrics import SIMILARITIES
from route_engine.models import (
    ACTIVITIES,
    WATER_ACTIVITIES,
    InvalidRequestError,
    RouteResult,
    check_activity,
    check_distance,
    check_drawn_on_land,
    check_start,
)
from route_engine.network import (
    AREA_MARGIN_M,
    BIKE_FILTER,
    BIKE_NETWORK_NAME,
    EDGE_REUSE_PENALTY,
    NETWORKS,
    OsmnxSource,
    area_around,
    check_network,
    corner_indices,
    first_leg,
    nearest_nodes,
    on_foot_stretches,
    snap_to_network,
    twice_drawn,
)
from route_engine.optimizer import (
    CORNER_SPARE,
    DISTANCE_TOLERANCE,
    SHAPE_POINTS,
    SIMILARITY,
    START_OFFSET_M,
    STROKE_SPARE,
    WORD_RETRACE,
    WORD_TOLERANCE,
    GraphLoader,
    Plan,
    drawn_distance,
    planned_distance,
    required_area,
    word_similarity,
)
from route_engine.projection import (
    Point,
    initial_scale,
    perimeter,
    project_shape,
    start_at_phase,
)
from route_engine.shapes import get_shape
from route_engine.shapes.outline import InvalidOutlineError, read_outline
from route_engine.stroke_match import (
    DEFAULT_FIT,
    anchored_share,
    check_fit,
    snap_stroke,
)
from route_engine.validation import check_closed, measure, validate
from route_engine.words import Word

# What a request with the pen up asks that an anchored drawing has not: the
# pieces are traced with their own zones (pen_up.trace), the magnet aside.
PLACEMENTS: tuple[str, ...] = ("free", "anchored")
# The magnet is for an anchored drawing only: the search has its own zones
# and band (ADR-0039).
FIT_WITH_ANCHORED_ONLY = "fit is the magnet of an anchored placement"
# On the water there are no roads to anchor to: the shape is placed where
# it fits (ADR-0154).
ANCHORED_ON_LAND_ONLY = "a shape is anchored to the roads only, not on the water"


@dataclass
class AnchoredPlan(Plan):
    """`optimizer.Plan` of a drawing traced once where it was drawn: no
    search, so the route's nodes and the placed drawing are here."""

    # The drawing as placed, in WGS84: one closed line, a word's open one.
    placed: list[LatLon] = field(default_factory=list)
    # The graph nodes of the route, for the directions (jobs.with_directions).
    nodes: list[Any] = field(default_factory=list)
    # The magnet used.
    fit: float = DEFAULT_FIT


def check_placement(placement: str, fit: float | None, activity: str) -> None:
    """One of PLACEMENTS; `fit` only with "anchored", and anchored only on
    the roads (TASK-347, ADR-0300): InvalidRequestError otherwise."""
    if placement not in PLACEMENTS:
        raise InvalidRequestError(
            f"unknown placement {placement!r}; choose one of: {', '.join(PLACEMENTS)}"
        )
    if placement == "anchored" and activity in WATER_ACTIVITIES:
        raise InvalidRequestError(ANCHORED_ON_LAND_ONLY)
    if fit is not None:
        if placement != "anchored":
            raise InvalidRequestError(FIT_WITH_ANCHORED_ONLY)
        check_fit(fit)


def placed_lines(word: Word | None, placed: Sequence[LatLon]) -> list[list[LatLon]]:
    """The drawing as placed, as the lines of RouteResult.placed_outline in
    the contract (TASK-347): one closed line, or one per letter or piece
    drawn with the pen up, which the route walks between."""
    if word is not None and word.pen_up:
        return pen_up.letter_lines(word, placed)
    return [list(placed)]


def distance_warning(drawn_m: float, distance_m: float) -> str | None:
    """What the result says when the roads make the drawing more than
    DISTANCE_TOLERANCE longer or shorter than asked: anchored, it is not
    rescaled. None within the tolerance."""
    gap = drawn_m - distance_m
    if abs(gap) <= DISTANCE_TOLERANCE * distance_m:
        return None
    longer = "longer" if gap > 0 else "shorter"
    return (
        f"on the roads the drawing is {drawn_m / 1000:.1f} km, "
        f"{abs(gap) / distance_m:.0%} {longer} than the {distance_m / 1000:g} km "
        "drawn; anchored, it is not rescaled"
    )


def plan_anchored(
    shape: Sequence[Point],
    name: str,
    start: LatLon,
    distance_m: int,
    source: GraphLoader,
    *,
    fit: float | None = None,
    activity: str = "running",
    one_way: bool = False,
    word: Word | None = None,
    reuse_penalty: float = EDGE_REUSE_PENALTY,
) -> AnchoredPlan:
    """The route of `shape` left where it is: `optimizer.plan_shape` with
    `optimize` False, the magnet `fit` (stroke_match.anchored_share: the
    zones and the corridor band as a share of the drawing's length; the
    engine's default when None) and the distance checked, never corrected.

    The shape is projected as `project_shape` does with no search: its
    first point on `start`, upright, scaled so that its perimeter is the
    distance asked (planned twice for a `one_way` line drawn out and back,
    whose way out is kept, TASK-041). A `word` is traced as a closed line
    with WORD_RETRACE, judged letter by letter; with the pen up, letter by
    letter with pen_up.trace and its own zones. The steps after the tracing
    repeat `plan_shape`'s (ShapeJob.here does the same, ADR-0071): optimizer
    stays as it is, so the engine's fingerprint does. `name` labels the
    result; start and distance are the caller's to check. The graphs
    `source` gives must be of the network of `activity`.
    """
    check_placement("anchored", fit, activity)
    magnet = DEFAULT_FIT if fit is None else fit
    similarity = SIMILARITIES[SIMILARITY]
    planned_m = planned_distance(distance_m, one_way)
    kept = 0.5 if one_way else 1.0
    graph = source.load(required_area(shape, start, planned_m, False, word))
    check_network(graph, activity)
    if word is not None and word.pen_up:
        projected = pen_up.place_line(shape, start, initial_scale(shape, planned_m))
        route = pen_up.trace(graph, word, projected, reuse_penalty, WORD_RETRACE)
        height_m = initial_scale(shape, planned_m) * word.height
        sim = pen_up.similarity(
            word, route.points, route.walks, projected, WORD_TOLERANCE * height_m
        )
    else:
        projected = project_shape(shape, start, initial_scale(shape, planned_m))
        share = anchored_share(magnet, planned_m)
        route = snap_to_network(
            graph,
            projected,
            reuse_penalty,
            retrace=1.0 if word is None else WORD_RETRACE,
            zone_radius=share,
            band=share,
        )
        sim = similarity(route.points, projected)
        if word is not None:
            height_m = initial_scale(shape, planned_m) * word.height
            sim = word_similarity(word, 0, route.points, projected, height_m)
    warnings = list(route.warnings)
    [first], _ = nearest_nodes(graph, [start])
    begins = (graph.nodes[first]["y"], graph.nodes[first]["x"])
    check = pen_up.check_begins if word is not None and word.pen_up else check_closed
    check(route.points, begins, start, start, START_OFFSET_M)
    if one_way:  # the far end is half-way along the shape
        route = first_leg(graph, route, start_at_phase(projected, 0.5)[0])
    off = distance_warning(drawn_distance(route) * kept, distance_m)
    if off is not None:
        warnings.append(off)
    outline = latlon_to_local_array(projected[0], np.array(projected))
    corners = [projected[i] for i in corner_indices(outline[:-1])]
    strokes = [
        (projected[i], projected[i + 1]) for i in np.flatnonzero(twice_drawn(outline))
    ]
    size = perimeter(shape) * _scale_of(projected, shape)
    measures = measure(
        graph,
        route.points,
        route.nodes,
        corners,
        CORNER_SPARE * size,
        strokes,
        STROKE_SPARE * size,
    )
    warnings.extend(issue.message for issue in validate(measures))
    result = RouteResult(
        points=route.points,
        distance_m=route.distance_m,
        similarity=sim,
        shape=name,
        warnings=warnings,
        walks=list(route.walks),
        on_foot=on_foot_stretches(graph, route.nodes),
        better_distance_m=None,
        rotation_deg=0.0,
    )
    return AnchoredPlan(
        result,
        None,
        measures,
        placed=list(projected),
        nodes=list(route.nodes),
        fit=magnet,
    )


def _scale_of(placed: Sequence[LatLon], shape: Sequence[Point]) -> float:
    """Metres per normalized unit of a placed shape (optimizer._scale_of)."""
    xy = latlon_to_local_array(placed[0], np.array(placed))
    return float(np.hypot(*np.diff(xy, axis=0).T).sum()) / perimeter(shape)


# --- command line -----------------------------------------------------------


def _parse_point(value: str) -> LatLon:
    parts = value.split(",")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(f"expected LAT,LON, got {value!r}")
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"LAT and LON must be numbers, got {value!r}"
        ) from None


def read_stroke(path: Path) -> list[LatLon]:
    """The points of a stroke from a JSON file: a list of [lat, lon] pairs,
    or an object with them in "line", as a StrokeMatchRequest."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as exc:
        raise InvalidRequestError(f"cannot read the stroke: {exc}") from None
    if isinstance(data, dict):
        data = data.get("line")
    if not isinstance(data, list):
        raise InvalidRequestError("a stroke is a JSON list of [lat, lon] points")
    points: list[LatLon] = []
    for raw in data:
        if not (
            isinstance(raw, list)
            and len(raw) == 2
            and all(isinstance(v, int | float) for v in raw)
        ):
            raise InvalidRequestError(f"not a [lat, lon] point: {raw!r}")
        check_start((float(raw[0]), float(raw[1])))
        points.append((float(raw[0]), float(raw[1])))
    if len(points) < 2:
        raise InvalidRequestError("a stroke has at least 2 points")
    return points


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m route_engine.anchored",
        description=(
            "Trace a drawing where it was drawn, with no search (TASK-347), "
            "or anchor one stroke drawn on the map to the roads."
        ),
    )
    what = parser.add_mutually_exclusive_group(required=True)
    what.add_argument("--shape", help="shape name, e.g. heart")
    what.add_argument(
        "--outline",
        type=Path,
        metavar="FILE",
        help="a shape read from a JSON outline (route_engine/shapes/outlines)",
    )
    what.add_argument(
        "--stroke",
        type=Path,
        metavar="FILE",
        help="one stroke drawn on the map, a JSON list of [lat, lon] points, "
        "anchored to the roads and printed as JSON; with --from, --fit, "
        "--activity and --cache-dir only",
    )
    parser.add_argument(
        "--distance", type=int, help="with a shape: the distance drawn, in metres"
    )
    parser.add_argument(
        "--start",
        type=_parse_point,
        metavar="LAT,LON",
        help="with a shape: where its first point is, e.g. 46.0671,11.1214",
    )
    parser.add_argument(
        "--from",
        dest="from_",
        type=_parse_point,
        metavar="LAT,LON",
        help="with --stroke: where the stroke before ended; the route starts "
        "at the road node nearest to it",
    )
    parser.add_argument(
        "--fit",
        type=float,
        metavar="F",
        help="the magnet, from 0 (faithful to the drawing: tight zones and "
        f"band) to 1 (today's values, wide); default {DEFAULT_FIT:g}",
    )
    parser.add_argument(
        "--activity",
        default="running",
        help=f"one of: {', '.join(a for a in ACTIVITIES if a not in WATER_ACTIVITIES)}"
        " (default: running); nothing is anchored on the water",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("data/cache"),
        help="where road graphs are cached (default: data/cache)",
    )
    parser.add_argument(
        "--out", type=Path, help="with a shape: write the route to this GPX file"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="with a shape: print the result as JSON, placed_outline included",
    )
    return parser


def _source(cache_dir: Path, activity: str) -> OsmnxSource:
    if NETWORKS[activity] == BIKE_NETWORK_NAME:
        return OsmnxSource(cache_dir, BIKE_NETWORK_NAME, BIKE_FILTER)
    return OsmnxSource(cache_dir)


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        check_drawn_on_land(args.activity, "an anchored drawing")
        check_activity(args.activity)
        if args.fit is not None:
            check_fit(args.fit)
    except InvalidRequestError as exc:
        parser.error(str(exc))
    if args.stroke is not None:
        for flag, value in (
            ("--distance", args.distance),
            ("--start", args.start),
            ("--out", args.out),
        ):
            if value is not None:
                parser.error(f"{flag} is not for --stroke, which prints the match")
        try:
            line = read_stroke(args.stroke)
        except InvalidRequestError as exc:
            parser.error(f"--stroke {args.stroke}: {exc}")
        return _main_stroke(line, args)
    if args.from_ is not None:
        parser.error("--from is for --stroke")
    if args.distance is None or args.start is None:
        parser.error("the following arguments are required: --distance, --start")
    if args.out is not None and args.out.exists():
        parser.error(f"{args.out} already exists; samples are never overwritten")
    try:
        check_start(args.start)
        check_distance(args.distance, args.activity)
        if args.shape is not None:
            shape, name, one_way = (
                get_shape(args.shape)(SHAPE_POINTS),
                args.shape,
                False,
            )
        else:
            outline = read_outline(args.outline)
            shape, name, one_way = outline(SHAPE_POINTS), outline.name, outline.one_way
    except (InvalidRequestError, ValueError, InvalidOutlineError) as exc:
        parser.error(str(exc))
    return _main_shape(shape, name, one_way, args)


def _main_stroke(line: list[LatLon], args: argparse.Namespace) -> int:
    """One stroke anchored to the roads: the match printed as JSON on
    stdout, as POST /stroke-matches answers it; the rest on stderr. A
    stroke the roads cannot draw (every point on one road node) is 1."""
    source = _source(args.cache_dir, args.activity)
    around = [*line, *([args.from_] if args.from_ is not None else [])]
    bbox = area_around(around, AREA_MARGIN_M)
    where = "from the cache" if source.is_cached(bbox) else "downloading..."
    print(f"Road graph: {where}", file=sys.stderr)
    graph = source.load(bbox)
    start_node = None
    if args.from_ is not None:
        [start_node], _ = nearest_nodes(graph, [args.from_])
    try:
        match = snap_stroke(line, graph, args.activity, args.fit, start_node)
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "points": [[round(lat, 6), round(lon, 6)] for lat, lon in match.points],
                "away_m": [round(d, 1) for d in match.away_m],
                "off_roads": match.off_roads,
            }
        )
    )
    return 0


def _main_shape(
    shape: list[Point], name: str, one_way: bool, args: argparse.Namespace
) -> int:
    """A shape or an outline traced where it is: a short report, the GPX
    with --out, the result as JSON with --json."""
    report = sys.stderr if args.json else sys.stdout
    source = _source(args.cache_dir, args.activity)
    planned_m = planned_distance(args.distance, one_way)
    where = (
        "from the cache"
        if source.is_cached(required_area(shape, args.start, planned_m, False))
        else "downloading..."
    )
    print(f"Road graph: {where}", file=report)
    try:
        plan = plan_anchored(
            shape,
            name,
            args.start,
            args.distance,
            source,
            fit=args.fit,
            activity=args.activity,
            one_way=one_way,
        )
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    route = plan.result
    when = datetime.now(UTC)
    if args.out is not None:
        document = to_gpx(route.points, route_name(name, args.distance, when), when)
        args.out.write_text(document, encoding="utf-8")
        print(f"Wrote {args.out}: {len(route.points)} points", file=report)
    print(
        f"  placement:  anchored, magnet {plan.fit:g}: {name} where it is, "
        "traced once, never rescaled",
        file=report,
    )
    print(f"  similarity: {route.similarity:.2f} ({SIMILARITY})", file=report)
    print(
        f"  on roads:   {route.distance_m:.0f} m (drawn {args.distance} m)", file=report
    )
    print(
        f"  placed:     {len(plan.placed)} points of the drawing as placed", file=report
    )
    for warning in route.warnings:
        print(f"  warning: {warning}", file=report)
    if args.json:
        print(
            json.dumps(
                {
                    "points": [[lat, lon] for lat, lon in route.points],
                    "distance_m": route.distance_m,
                    "similarity": route.similarity,
                    "shape": name,
                    "warnings": route.warnings,
                    "walks": route.walks,
                    "on_foot": route.on_foot,
                    "placed_outline": [
                        [[lat, lon] for lat, lon in line]
                        for line in placed_lines(None, plan.placed)
                    ],
                }
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
