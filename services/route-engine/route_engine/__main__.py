"""Command-line entry point: python -m route_engine --shape ... --distance ...

`--outline FILE` takes the shape from a JSON outline instead (TASK-032),
`--word TEXT` writes a word one letter at a time (TASK-050), and
`--image FILE` takes the outline of the subject of a PNG or JPEG image
(TASK-072); `--save-outline FILE` writes that outline as JSON to look at.
`--nearby N` also plans from N road nodes near the start and keeps the best
(TASK-076). `--activity cycling` draws a bike route, 10-30 km, on the bike
network (TASK-190). `--pen-up` with `--word` draws each letter on its own and
walks from one to the next (TASK-197); with a shape or an outline that has
pieces, the outline and then each piece on its own (TASK-223); with an
image, its other subjects and its holes are those pieces (TASK-297).
`--activity paddling` draws a shape of the catalogue, 1-5 km, on the water
of a lake or the sea, from a start on the shore; the water is cached in
`<cache-dir>/water/` (TASK-191). With `--pen-up` a shape in pieces is drawn
piece by piece there too, the pen up between them (TASK-226). `--near
LAT,LON` asks for the shape on the water near that point, where its centre
is wanted (TASK-238).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from route_engine.export_gpx import route_name, to_gpx
from route_engine.geo import haversine_m, path_length_m
from route_engine.image_outline import InvalidImageError, outline_data
from route_engine.models import (
    ACTIVITIES,
    DISTANCE_LIMITS_M,
    NEAR_ON_WATER_ONLY,
    PEN_UP_WITHOUT_WORD,
    WATER_ACTIVITIES,
    InvalidRequestError,
    RouteRequest,
    check_activity,
    check_distance,
    check_drawn_on_land,
    check_start,
)
from route_engine.nearby_starts import (
    NEARBY_COUNT,
    NearbyPlan,
    ShapeJob,
    plan_nearby,
)
from route_engine.network import (
    BIKE_FILTER,
    BIKE_NETWORK_NAME,
    EDGE_REUSE_PENALTY,
    NETWORKS,
    OsmnxSource,
)
from route_engine.optimizer import (
    SHAPE_POINTS,
    SIMILARITY,
    ShapeNotDrawableError,
    first_scale,
    plan_shape,
    planned_distance,
    required_area,
    tilt_limit,
)
from route_engine.paddling import plan_paddling, water_area
from route_engine.pen_up import Walk, drawn_m
from route_engine.pieces import compose as compose_pieces
from route_engine.shapes import get_shape
from route_engine.shapes.outline import (
    InvalidOutlineError,
    Outline,
    parse_outline,
    read_outline,
)
from route_engine.track_score import (
    TrackNotScorableError,
    TrackPoint,
    read_gpx_track,
    score_track,
)
from route_engine.water import OverpassWaterSource
from route_engine.words import LETTERS, InvalidWordError, Word, compose


@dataclass(frozen=True)
class OutlineRequest:
    """A RouteRequest whose shape is an outline read from a file (TASK-032).

    Not part of the contract: outline shapes are tried from the CLI only,
    until the shape catalogue (TASK-033).
    """

    start: tuple[float, float]
    outline: Outline
    distance_m: int
    activity: str = "running"

    def __post_init__(self) -> None:
        check_start(self.start)
        check_distance(self.distance_m, self.activity)
        check_activity(self.activity)

    @property
    def shape(self) -> str:
        return self.outline.name


@dataclass(frozen=True)
class WordRequest:
    """A RouteRequest whose shape is a word, written with the letters of
    letters.json (TASK-050). From the CLI only, like outlines."""

    start: tuple[float, float]
    word: Word
    distance_m: int
    activity: str = "running"

    def __post_init__(self) -> None:
        check_start(self.start)
        check_distance(self.distance_m, self.activity)
        check_activity(self.activity)

    @property
    def shape(self) -> str:
        return self.word.text


def _km(limits: tuple[int, int]) -> str:
    low, high = limits
    return f"{low / 1000:g}-{high / 1000:g}"


def _source(cache_dir: Path, activity: str) -> OsmnxSource:
    """The graphs of the network `activity` is drawn on (network.NETWORKS):
    the foot network as before TASK-190, the bike network in its own files."""
    if NETWORKS[activity] == BIKE_NETWORK_NAME:
        return OsmnxSource(cache_dir, BIKE_NETWORK_NAME, BIKE_FILTER)
    return OsmnxSource(cache_dir)


def _parse_start(value: str) -> tuple[float, float]:
    parts = value.split(",")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(
            f"expected LAT,LON (e.g. 46.0122,11.2986), got {value!r}"
        )
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"LAT and LON must be numbers, got {value!r}"
        ) from None


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m route_engine",
        description="Generate a real route that draws a shape on the map.",
    )
    what = parser.add_mutually_exclusive_group(required=True)
    what.add_argument("--shape", help="shape name, e.g. circle")
    what.add_argument(
        "--outline",
        type=Path,
        metavar="FILE",
        help="a shape read from a JSON outline, e.g. "
        "route_engine/shapes/outlines/house.json",
    )
    what.add_argument(
        "--image",
        type=Path,
        metavar="FILE",
        help="a shape traced from the subject of a PNG or JPEG image, "
        "one subject on a plain background",
    )
    what.add_argument(
        "--word",
        metavar="TEXT",
        help="a word written one letter at a time, e.g. CIAO",
    )
    parser.add_argument(
        "--pen-up",
        action="store_true",
        help="with --word: draw each letter on its own and walk, without "
        "drawing, from one to the next; the distance is the letters'. With a "
        "--shape or an --outline that has pieces: the outline, then each "
        "piece on its own, walking between them; with an --image, its other "
        "subjects and its holes are the pieces",
    )
    parser.add_argument(
        "--distance", required=True, type=int, help="target distance in metres"
    )
    parser.add_argument(
        "--start",
        required=True,
        type=_parse_start,
        metavar="LAT,LON",
        help="start point in WGS84, e.g. 46.0122,11.2986; "
        "write --start=-33.9,18.4 when LAT is negative",
    )
    parser.add_argument(
        "--near",
        type=_parse_start,
        metavar="LAT,LON",
        help="with --activity paddling: where the centre of the shape is "
        "wanted, e.g. the centre printed for a route before, moved; the shape "
        "is placed at the nearest place to it where it fits",
    )
    parser.add_argument(
        "--out", type=Path, help="write the route to this GPX file (never overwritten)"
    )
    parser.add_argument(
        "--save-outline",
        type=Path,
        metavar="FILE",
        help="with --image: write the traced outline to this JSON file "
        "(never overwritten); read it back with --outline",
    )
    parser.add_argument(
        "--score-track",
        type=Path,
        metavar="FILE",
        help="score from 0 to 100 the run recorded in this GPX file against "
        "the route planned for the request (with or without --out)",
    )
    parser.add_argument(
        "--activity",
        default="running",
        help=f"one of: {', '.join(ACTIVITIES)}; cycling routes are "
        f"{_km(DISTANCE_LIMITS_M['cycling'])} km, on the bike network; "
        f"paddling routes {_km(DISTANCE_LIMITS_M['paddling'])} km, a shape on "
        "the water within 1 km of the shore (default: running)",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("data/cache"),
        help="where road graphs, and the water in water/, are cached "
        "(default: data/cache)",
    )
    parser.add_argument(
        "--no-optimize",
        action="store_true",
        help="trace the shape once at its initial placement (as in TASK-017)",
    )
    parser.add_argument(
        "--reuse-penalty",
        type=float,
        default=EDGE_REUSE_PENALTY,
        help=f"weight multiplier on already used roads (default: {EDGE_REUSE_PENALTY})",
    )
    parser.add_argument(
        "--nearby",
        type=int,
        default=0,
        metavar="N",
        help="also plan from N road nodes 25-100 m from the start, in parallel, "
        "and keep the best route, reached from the start "
        f"(the API's choice is {NEARBY_COUNT}; default: 0, the start only)",
    )
    return parser


Request = RouteRequest | OutlineRequest | WordRequest


def parse_args(
    argv: Sequence[str] | None = None,
) -> tuple[Request, argparse.Namespace]:
    """Parse CLI arguments into a validated request and the output path.

    Invalid input exits with status 2 and a one-line message, never a traceback.
    """
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.out is not None and args.out.exists():
        parser.error(f"{args.out} already exists; samples are never overwritten")
    if args.nearby < 0:
        parser.error("--nearby must be 0 or more")
    if args.nearby and args.no_optimize:
        parser.error("--nearby needs the search: drop --no-optimize")
    if args.activity in WATER_ACTIVITIES:
        if args.nearby:
            parser.error(
                "--nearby is for roads: on the water the start is looked for "
                "along the shore"
            )
        if args.no_optimize:
            parser.error(
                "--no-optimize is for roads: on the water the shape is placed "
                "where it fits"
            )
    elif args.near is not None:
        parser.error(f"--near: {NEAR_ON_WATER_ONLY}")
    if args.save_outline is not None:
        if args.image is None:
            parser.error("--save-outline needs --image")
        if args.save_outline.exists():
            parser.error(f"{args.save_outline} already exists; never overwritten")
    args.track = None
    if args.score_track is not None:
        try:
            args.track = read_gpx_track(args.score_track.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, TrackNotScorableError) as exc:
            parser.error(f"{args.score_track}: {exc}")
    # The outline traced from --image, as its JSON file holds it.
    args.traced = None
    # A shape with pieces drawn with the pen up, as the word of its lines.
    args.pieces = None
    request: Request
    try:
        # Refused on the water before an image is traced (ADR-0161).
        if args.word is not None:
            check_drawn_on_land(args.activity, "a word")
        elif args.image is not None:
            check_drawn_on_land(args.activity, "an image")
        elif args.outline is not None:
            check_drawn_on_land(args.activity, "an outline")
        if args.word is not None:
            request = WordRequest(
                start=args.start,
                word=compose(args.word, pen_up=args.pen_up),
                distance_m=args.distance,
                activity=args.activity,
            )
        elif args.image is not None:
            args.traced = outline_data(
                args.image,
                name=args.image.stem,
                source=args.image.name,
                pen_up=args.pen_up,
            )
            request = OutlineRequest(
                start=args.start,
                outline=parse_outline(args.traced),
                distance_m=args.distance,
                activity=args.activity,
            )
        elif args.outline is None:
            request = RouteRequest(
                start=args.start,
                shape=args.shape,
                distance_m=args.distance,
                activity=args.activity,
                # On the water the request says it (TASK-226); on roads the
                # pieces are composed below, as a word's letters.
                pen_up=args.pen_up and args.activity in WATER_ACTIVITIES,
                near=args.near,
            )
        else:
            request = OutlineRequest(
                start=args.start,
                outline=read_outline(args.outline),
                distance_m=args.distance,
                activity=args.activity,
            )
    except InvalidImageError as exc:
        parser.error(f"{args.image}: {exc}")
    except InvalidOutlineError as exc:
        parser.error(f"{args.outline}: {exc}")
    except InvalidWordError as exc:
        parser.error(f"--word {args.word}: {exc}")
    except InvalidRequestError as exc:
        parser.error(str(exc))
    if args.pen_up and not isinstance(request, WordRequest):
        outline = (
            request.outline
            if isinstance(request, OutlineRequest)
            else get_shape(request.shape)
        )
        if isinstance(outline, Outline) and outline.in_pieces:
            args.pieces = compose_pieces(outline, request.shape)
        elif args.image is None:
            parser.error(
                f"--pen-up: {PEN_UP_WITHOUT_WORD}, or the pieces of a shape; "
                f"{request.shape} has none"
            )
        # An image with nothing apart is drawn as one line (ADR-0258).
    return request, args


def parse_request(argv: Sequence[str] | None = None) -> Request:
    return parse_args(argv)[0]


def main(argv: Sequence[str] | None = None) -> int:
    request, args = parse_args(argv)
    lat, lon = request.start
    print("Route request:")
    if isinstance(request, OutlineRequest) and args.traced is not None:
        corners = len(args.traced["points"]) - 1
        print(f"  shape:    {request.shape} (traced from {args.image})")
        print(f"            {corners} corners; {request.outline.license}")
        if args.pen_up and args.pieces is None:
            print("            pen up: nothing apart in the image, drawn as one line")
        shape = request.outline(SHAPE_POINTS)
    elif isinstance(request, OutlineRequest):
        print(f"  shape:    {request.shape} (outline from {args.outline})")
        print(f"            {request.outline.source}; {request.outline.license}")
        shape = request.outline(SHAPE_POINTS)
    elif isinstance(request, WordRequest):
        print(f"  shape:    {request.shape} (word, letters from {LETTERS.name})")
        if request.word.pen_up:
            print("            pen up: each letter on its own, walking between")
        shape = list(request.word.points)
    else:
        print(f"  shape:    {request.shape}")
        shape = get_shape(request.shape)(SHAPE_POINTS)
    if args.pieces is not None:
        print(
            f"            pen up: the outline, then {len(args.pieces.letters) - 1} "
            "pieces each on its own, walking between"
        )
        shape = list(args.pieces.points)
    print(f"  distance: {request.distance_m} m")
    print(f"  start:    {lat}, {lon}")
    print(f"  activity: {request.activity}")
    if args.save_outline is not None:
        text = json.dumps(args.traced, indent=1)
        args.save_outline.write_text(text + "\n", encoding="utf-8")
        print(f"Wrote {args.save_outline}: the traced outline")
    if args.out is None and args.track is None:
        return 0
    if request.activity in WATER_ACTIVITIES:
        assert isinstance(request, RouteRequest)  # words, outlines refused
        return _main_on_water(request, args)

    optimize = not args.no_optimize
    source = _source(args.cache_dir, request.activity)
    one_way = isinstance(request, OutlineRequest) and request.outline.one_way
    word = request.word if isinstance(request, WordRequest) else args.pieces
    planned_m = planned_distance(request.distance_m, one_way)
    bbox = required_area(shape, request.start, planned_m, optimize, word)
    if source.is_cached(bbox):
        print("Road graph: from the cache")
    else:
        print("Road graph: downloading from OpenStreetMap...")
    nearby: NearbyPlan | None = None
    try:
        if args.nearby:
            job = ShapeJob(
                tuple(shape),
                request.shape,
                request.distance_m,
                reuse_penalty=args.reuse_penalty,
                max_tilt_deg=tilt_limit(request.shape),
                one_way=one_way,
                word=word,
                activity=request.activity,
            )
            nearby = plan_nearby(job, request.start, source, count=args.nearby)
            plan = nearby.plan
        else:
            plan = plan_shape(
                shape,
                request.shape,
                request.start,
                request.distance_m,
                source,
                optimize=optimize,
                reuse_penalty=args.reuse_penalty,
                max_tilt_deg=tilt_limit(request.shape),
                one_way=one_way,
                word=word,
                activity=request.activity,
            )
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    route = plan.result

    when = datetime.now(UTC)
    name = route_name(request.shape, request.distance_m, when)
    if args.out is not None:
        document = to_gpx(route.points, name, when, route.walks)
        args.out.write_text(document, encoding="utf-8")
        print(f"Wrote {args.out}: {len(route.points)} points")
    if plan.search is not None:
        best = plan.search.best
        base = first_scale(shape, planned_m, word)
        print(
            f"  placement:  rotation {best.rotation_deg:.0f} deg, "
            f"phase {best.phase:.2f}, "
            f"scale {best.scale_m / base:.0%} of the initial one"
        )
        if route.rotation_deg:  # TASK-232: the app turns the map back
            print(
                f"  tilted:     {route.rotation_deg:+.0f} deg; the map shows it "
                f"upright with a bearing of {-route.rotation_deg:+.0f} deg"
            )
        if best.offset_m > 0:
            start_lat, start_lon = best.placement.start
            print(
                f"  start:      {start_lat:.5f}, {start_lon:.5f}"
                f" ({best.offset_m:.0f} m away)"
            )
        if word is not None and best.shifts and word.kind == "piece":
            height_m = best.scale_m * word.height
            moves = ", ".join(
                f"{k + 1} {dx * height_m:+.0f}/{dy * height_m:+.0f}"
                for k, (dx, dy) in enumerate(best.shifts[1:], start=1)
            )
            print(f"  pieces:     moved (m, right/up) {moves}")
        elif word is not None and best.shifts:
            height_m = best.scale_m * word.height
            moves = ", ".join(
                f"{letter.char} {dx * height_m:+.0f}/{dy * height_m:+.0f}"
                for letter, (dx, dy) in zip(word.letters, best.shifts, strict=True)
            )
            print(f"  letters:    {height_m:.0f} m high; moved (m, along/up) {moves}")
        print(f"  attempts:   {len(plan.search.attempts)} routes traced")
    if nearby is not None:
        _print_nearby(nearby)
    measure_name = SIMILARITY if word is None else f"{word.kind}s"
    print(f"  similarity: {route.similarity:.2f} ({measure_name})")
    if route.walks:
        _print_walks(
            route.points,
            route.distance_m,
            route.walks,
            request.distance_m,
            measure_name,
        )
    else:
        print(f"  on roads:   {route.distance_m:.0f} m (target {request.distance_m} m)")
    checks = plan.checks
    print(
        f"  checks:     {checks['reuse']:.0%} on roads already travelled, "
        f"{checks['retrace']:.0%} running beside itself; "
        f"{checks['steps']:.0f} m on steps, {checks['busy']:.0f} m on main roads, "
        f"{checks['tunnel']:.0f} m in tunnels"
        + (f", {checks['unpaved']:.0f} m unpaved" if "unpaved" in checks else "")
        + (
            f", {checks['on_foot']:.0f} m with the bike on foot"
            if "on_foot" in checks
            else ""
        )
    )
    for warning in route.warnings:
        print(f"  warning: {warning}")
    if args.track is not None:
        return _print_track_score(
            args.track, route.points, route.similarity, route.walks
        )
    return 0


def _main_on_water(request: RouteRequest, args: argparse.Namespace) -> int:
    """A route on the water (TASK-191): the shape where it fits, from a
    start on the shore, as `python -m route_engine.water` prints it."""
    source = OverpassWaterSource(args.cache_dir)
    if source.is_cached(water_area(request)):
        print("Water: from the cache")
    else:
        print("Water: downloading from OpenStreetMap...")
    try:
        plan = plan_paddling(request, source)
    except ShapeNotDrawableError as exc:
        print(f"No route: {exc}", file=sys.stderr)
        return 1
    route, on_water = plan.result, plan.route
    when = datetime.now(UTC)
    if args.out is not None:
        name = route_name(request.name, request.distance_m, when)
        document = to_gpx(route.points, name, when, route.walks)
        args.out.write_text(document, encoding="utf-8")
        print(f"Wrote {args.out}: {len(route.points)} points")
    shore_lat, shore_lon = on_water.shore_start
    print(
        f"  placement:  rotation {on_water.rotation_deg:.0f} deg, "
        f"scale {on_water.scale:.0%} of full size"
    )
    print(
        f"  shore:      {shore_lat:.5f}, {shore_lon:.5f} "
        f"({on_water.shore_access}), {on_water.move_m:.0f} m from the start"
    )
    print(f"  leg:        {on_water.approach_m:.0f} m each way, shore to shape")
    centre_lat, centre_lon = on_water.centre
    asked = ""
    if request.near is not None:
        off = haversine_m(on_water.centre, request.near)
        asked = f", {off:.0f} m from where it was asked"
    print(f"  centre:     {centre_lat:.5f}, {centre_lon:.5f}{asked}")
    print(f"  similarity: {route.similarity:.2f} (the shape itself)")
    print(f"  on water:   {route.distance_m:.0f} m (target {request.distance_m} m)")
    if route.walks:
        pen_up = ", ".join(
            f"{path_length_m(route.points[a : b + 1]):.0f} m" for a, b in route.walks
        )
        print(f"  pen up:     {len(route.walks)} stretches, not drawn: {pen_up}")
    print(
        f"  checks:     the shape {on_water.nearest_land_m:.0f} m from land "
        f"at the nearest, the route {on_water.farthest_shore_m:.0f} m from "
        "the shore at the farthest"
    )
    for warning in route.warnings:
        print(f"  warning: {warning}")
    if args.track is not None:
        return _print_track_score(
            args.track, route.points, route.similarity, route.walks
        )
    return 0


def _print_walks(
    points: Sequence[tuple[float, float]],
    distance_m: float,
    walks: Sequence[Walk],
    target_m: int,
    what: str = "letters",
) -> None:
    """The metres of the letters, or of the pieces (TASK-223), against the
    target, and each walk between them (TASK-197)."""
    drawn = drawn_m(points, distance_m, walks)
    print(f"  {what + ':':<11} {drawn:.0f} m drawn (target {target_m} m)")
    lengths = ", ".join(f"{path_length_m(points[a : b + 1]):.0f} m" for a, b in walks)
    print(f"  walks:      {len(walks)}, not drawn: {lengths}")
    print(f"  on roads:   {distance_m:.0f} m in all, walks included")


def _print_track_score(
    track: Sequence[TrackPoint],
    points: Sequence[tuple[float, float]],
    similarity: float,
    walks: Sequence[Walk] = (),
) -> int:
    try:
        scored = score_track(track, points, similarity, walks)
    except TrackNotScorableError as exc:
        print(f"No score: {exc}", file=sys.stderr)
        return 1
    print(f"Track score: {scored.score} out of 100")
    print(
        f"  fidelity:   {scored.fidelity:.2f} "
        f"({scored.covered:.0%} of the route run, "
        f"{scored.on_route:.0%} of the run on the route)"
    )
    print(f"  run:        {scored.distance_m:.0f} m")
    return 0


def _print_nearby(nearby: NearbyPlan) -> None:
    """Every start tried, and which one the route comes from."""
    print(f"  nearby:     {len(nearby.tried)} starts planned")
    if nearby.skipped:
        print(f"            ({nearby.skipped})")
    for i, tried in enumerate(nearby.tried):
        mark = "*" if i == nearby.chosen else " "
        where = "the start" if i == 0 else f"{tried.approach_m:.0f} m along the roads"
        if tried.plan is None or tried.score is None:
            what = tried.note
        else:
            what = (
                f"similarity {tried.plan.result.similarity:.2f}, "
                f"{tried.plan.result.distance_m:.0f} m, score {tried.score:.3f}"
            )
        print(f"            {mark} {where}: {what}")


if __name__ == "__main__":
    sys.exit(main())
