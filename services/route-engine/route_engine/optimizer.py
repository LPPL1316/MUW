"""Search for the route that best matches shape and target distance.

docs/ROUTE_ENGINE.md §5: rotate the shape around the start, move the start
along the shape and rescale it until the roads follow the outline and the
distance on roads is close to the target.

1. For every rotation and phase, count how much of the outline has a road
   nearby (`RoadMask`): no routing, so trying 96 placements is cheap.
2. Trace the best few with `snap_to_network`.
3. Rescale by target / real distance and trace again.
4. Refine the rotation around the best placement.
5. Stop when distance and similarity are good enough, or when the budget of
   traces runs out, and return the best route found.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field, replace
from typing import Any, Protocol

import numpy as np

from route_engine import pen_up, pieces
from route_engine.errors import (
    CollapsedShapeError,
    NoRoadsError,
    ShapeNotDrawableError,
)
from route_engine.geo import LatLon, latlon_to_local_array, local_to_latlon
from route_engine.metrics import (
    CORNER_PENALTY,
    COVER_TOLERANCE,
    SIMILARITIES,
    Similarity,
    coverage,
    precision,
)
from route_engine.models import DISTANCE_LIMITS_M, RouteRequest, RouteResult
from route_engine.network import (
    AREA_MARGIN_M,
    CORRIDOR_BAND,
    EDGE_REUSE_PENALTY,
    BBox,
    Graph,
    NetworkRoute,
    area_around,
    check_network,
    corner_indices,
    detail_scale,
    first_leg,
    nearest_nodes,
    on_foot_stretches,
    snap_to_network,
    twice_drawn,
)
from route_engine.projection import (
    Point,
    initial_scale,
    perimeter,
    project_shape,
    start_at_phase,
)
from route_engine.retracing import extra_doubled_share
from route_engine.shapes import FREE_ROTATION, get_shape
from route_engine.street_grid import StreetDirections
from route_engine.validation import check_closed, measure, validate
from route_engine.words import (
    LETTER_DISTANCE_M,
    MAX_SHIFT,
    SHIFT_STEP,
    Style,
    Word,
    compose,
)

# Where the start enters the shape, as arc-length fractions (TASK-015).
PHASES = (0.0, 0.25, 0.5, 0.75)
ROTATION_STEP_DEG = 15.0
# A shape with a top and a bottom tilts at most this much, and the app turns
# the map so it reads upright (ADR-0195): on a north-up map tilted shapes
# were judged unrecognizable, and the limit was 15° (TASK-035, ADR-0038).
# 180 lets it turn freely.
MAX_TILT_DEG = 45.0
FREE_TILT_DEG = 180.0
# The search tries a shape first as it did before TASK-232, within
# UPRIGHT_TILT_DEG (a word in block letters along the streets within
# UPRIGHT_GRID_TILT_DEG); only when that gives no good route does it try
# the tilts beyond, up to MAX_TILT_DEG, with TILTED_TRACES traces more. A
# route good upright stays the same, and its time too; tilting everything
# at once lost good routes to placements whose roads only looked better
# (TASK-232, docs/MAPS.md «Forme inclinate»).
UPRIGHT_TILT_DEG = 15.0
UPRIGHT_GRID_TILT_DEG = 30.0
TILTED_TRACES = 10
# Scale bounds, as multiples of the initial scale.
SCALE_RANGE = (0.4, 1.1)
# The shape may start this far from the requested point, on rings of these
# radii in as many directions, when that lets it close on the roads
# (TASK-015, ADR-0025).
START_OFFSET_M = 500.0
START_RINGS_M = (250.0, 500.0)
START_BEARINGS = 8
# When the shape cannot be drawn there at all, a second search looks for a
# place up to FAR_OFFSET_M away, on these rings, with its own budget of
# traces (TASK-038, ADR-0040). It used to start whenever no route there was
# good: half the time of a long request, for a better route in a case out
# of six, so a drawable route near the start now keeps it out (TASK-203 B,
# ADR-0230).
FAR_OFFSET_M = 2000.0
FAR_RINGS_M = (1000.0, 1500.0, 2000.0)
FAR_BEARINGS = 12
FAR_TRACES = 20
# Placements traced after the road count (while the budget lasts), and
# rescales for each of them. Tracing more placements once each, instead,
# scored a bit worse on the 14 drawable cases (TASK-016, docs/MAPS.md).
TOP_PLACEMENTS = 6
MAX_RESCALES = 4
# Rotation refinement around the best placement.
REFINE_SPAN_DEG = 15.0
REFINE_STEP_DEG = 5.0
MAX_TRACES = 20
# Stopping sooner where the shape does not fit was measured trace by trace
# on 252 requests in seven cities (TASK-298, ADR-0259): a good route can
# come from any placement, the sixth tilted one too, and as late as the
# 30th trace, so no placement is skipped and no cap is lower; the road
# count is 1.0 at the top almost everywhere and tells nothing; skipping the
# tilted stage after a poor upright one, or the rotation refinement of a
# poor stage, keeps the good routes but makes poor results worse. What
# stays: a scale already traced for a placement, which the secant asks for
# again at a bound of SCALE_RANGE, is not traced twice (rescale).
# Stop when both hold (ROUTE_ENGINE.md §5). Metric and threshold come from
# the eye judgement of the first results (TASK-015, docs/MAPS.md): the
# routes judged good covered 90% of the outline or more, the others less.
DISTANCE_TOLERANCE = 0.10
# When no placement gets both right, the route may miss the target distance
# by up to this much to keep the shape; beyond it, no route (ADR-0025).
DISTANCE_FALLBACK_M = 2000.0
SIMILARITY_THRESHOLD = 0.90
SIMILARITY = "shape"
# cost = W_SHAPE · (1 − similarity) + W_DISTANCE · |real − target| / target;
# the shape matters most.
W_SHAPE = 3.0
W_DISTANCE = 1.0
# The route run twice over the same street beyond what the shape draws
# twice on purpose, as a share of its length (retracing.py): a whisker the
# similarity does not see. Only for the shapes whose eye judgement asked
# for it (TASK-131, TASK-139, TASK-140); cat, fish, dog and rabbit heads
# keep their routes as before, as the user preferred.
W_DOUBLED: dict[str, float] = {
    name: 1.5
    for name in ("heart", "circle", "star", "horse", "moon", "butterfly", "snail")
}
# Moving the start by START_OFFSET_M costs as much as 5% of coverage, both
# when ranking placements by roads and when choosing among traced routes.
OFFSET_FIT_PENALTY = 0.05
W_OFFSET = W_SHAPE * OFFSET_FIT_PENALTY
# Tilting a shape by MAX_TILT_DEG costs as much, in both places too, in
# proportion to the angle beyond UPRIGHT_TILT_DEG, which costs nothing as
# before: on a tie the straighter shape wins, and it tilts only where the
# roads follow it clearly better (TASK-232, ADR-0195). Not for a shape that
# turns freely, like the circle.
TILT_FIT_PENALTY = 0.05
W_TILT = W_SHAPE * TILT_FIT_PENALTY
# The letters of a word each move up to words.MAX_SHIFT, on a grid of
# words.SHIFT_STEP, to where their own strokes have most roads within
# LETTER_BAND letter heights (TASK-050, fit_letters). Moving a letter that
# far costs this share of its road count: a letter stays where it is unless
# the roads are clearly better elsewhere.
SHIFT_PENALTY = 0.05
LETTER_BAND = 1 / 16
# A word is judged letter by letter (word_similarity), within this many
# letter heights. The shape similarity looks at the whole line, gaps
# included, within 1% of its length (ADR-0039): some 150 m for letters 700 m
# high at 15 km, and it passed words whose letters the roads did not draw.
# Tracing zones and corridor this narrow were tried too, and dropped: at
# Trento the route lost the O (TASK-050).
WORD_TOLERANCE = 1 / 8
# Where a word goes back along itself (the I, the C, the gaps), the roads it
# has just used cost this much: it comes back on the same road, as the user
# asked for the I, instead of on a parallel one (TASK-050).
WORD_RETRACE = 0.5
# A word in block letters is turned the way the streets run around each
# start (street_grid), not kept upright: it tries each grid direction at
# most GRID_MAX_TILT_DEG off level, upright when there is none, and the
# refinement turns it at most GRID_TILT_DEG off one. At 43° at Levico the
# word ran across a north-up map like a diagonal, and did not read
# (TASK-077); with the map turned it reads level (TASK-232, ADR-0195), and
# the directions beyond UPRIGHT_GRID_TILT_DEG are tried as tilts.
GRID_MAX_TILT_DEG = MAX_TILT_DEG
GRID_TILT_DEG = 5.0
# A route the search traced at another distance is advised (better_distance,
# TASK-234, ADR-0197) when its cost without the distance part is lower than
# the chosen route's by at least this much, five points of similarity, and
# its similarity is at least SIMILARITY_THRESHOLD.
BETTER_MARGIN = W_SHAPE * 0.05


def reach(shape: Sequence[Point], phases: Sequence[float] = PHASES) -> float:
    """Farthest a normalized shape gets from its start, over `phases`."""
    farthest = 0.0
    for phase in phases:
        points = start_at_phase(shape, phase)
        farthest = max(farthest, max(math.dist(p, points[0]) for p in points))
    return farthest


def first_scale(
    shape: Sequence[Point], distance_m: float, word: Word | None = None
) -> float:
    """`initial_scale`; for a word with the pen up, that of its letters
    alone, which the distance asked for applies to (TASK-197)."""
    if word is not None and word.pen_up:
        return distance_m / word.drawn_length
    return initial_scale(shape, distance_m)


def _word_reach(shape: Sequence[Point], word: Word) -> float:
    """`reach` of a word from its own phases; from the first point of the
    open line of a word with the pen up."""
    if word.pen_up:
        return pen_up.reach(shape)
    return reach(shape, word.phases)


def drawn_distance(route: NetworkRoute) -> float:
    """The length of `route` the distance asked for applies to: all of it,
    but the walks between the letters of a word with the pen up (TASK-197);
    the detours of a piece walked instead of drawn still count (TASK-242,
    `pen_up.sized_m`)."""
    return pen_up.sized_m(route)


def zone_area(
    shape: Sequence[Point],
    start: LatLon,
    distance_m: float,
    offset_m: float = START_OFFSET_M,
    word: Word | None = None,
) -> BBox:
    """Square around `start` holding the shape at any rotation, phase and
    scale, from any start up to `offset_m` away; for a `word`, at its own
    phases and with its letters moved as far as they may.

    One graph of this area serves every attempt of the search (ADR-0023).
    """
    largest_scale = first_scale(shape, distance_m, word) * SCALE_RANGE[1]
    far = reach(shape)
    if word is not None:
        far = _word_reach(shape, word) + MAX_SHIFT * word.height
    return area_around(
        [start],
        margin_m=far * largest_scale + offset_m + AREA_MARGIN_M,
    )


def _perimeter_m(xy: np.ndarray) -> float:
    return float(np.hypot(*np.diff(xy, axis=0).T).sum())


class RoadMask:
    """Which places lie within a band of some road, on a grid around `origin`.

    The roads are sampled once; each band width gets its own grid of cells
    half a band wide, marked when a road sample falls within the band.
    """

    def __init__(self, graph: Graph, origin: LatLon, step_m: float = 10.0) -> None:
        self.origin = origin
        coords: list[tuple[float, float]] = []
        segments: list[tuple[int, int]] = []
        seen: set[frozenset[Any]] = set()
        for u, v, data in graph.edges(data=True):
            if frozenset((u, v)) in seen:
                continue
            seen.add(frozenset((u, v)))
            geometry = data.get("geometry")
            if geometry is None:
                line = [
                    (graph.nodes[u]["y"], graph.nodes[u]["x"]),
                    (graph.nodes[v]["y"], graph.nodes[v]["x"]),
                ]
            else:
                line = [(lat, lon) for lon, lat in geometry.coords]
            segments.extend(
                (len(coords) + i, len(coords) + i + 1) for i in range(len(line) - 1)
            )
            coords.extend(line)
        if not segments:
            # A graph without a road, like the one node left of a crop: said
            # as it is, not an index into no samples (TASK-180).
            raise NoRoadsError()
        xy = latlon_to_local_array(origin, np.array(coords))
        idx = np.array(segments)
        a, b = xy[idx[:, 0]], xy[idx[:, 1]]
        counts = np.maximum(1, np.ceil(np.hypot(*(b - a).T) / step_m).astype(int))
        seg = np.repeat(np.arange(len(a)), counts)
        t = (
            np.arange(counts.sum()) - np.repeat(np.cumsum(counts) - counts, counts)
        ) / np.repeat(counts, counts)
        self.samples = np.vstack([a[seg] + (b - a)[seg] * t[:, None], b])
        self._grids: dict[float, tuple[np.ndarray, int, int]] = {}

    def _grid(self, band_m: float) -> tuple[np.ndarray, int, int]:
        """Boolean grid of cells within a band of a road, and its first cell."""
        if band_m not in self._grids:
            cell = band_m / 2
            r = 2  # a band is two cells
            idx = np.floor(self.samples / cell).astype(int)
            x0, y0 = idx.min(axis=0)
            occupied = np.zeros(tuple(idx.max(axis=0) - (x0, y0) + 1), bool)
            occupied[idx[:, 0] - x0, idx[:, 1] - y0] = True
            w, h = occupied.shape
            near = np.zeros((w + 2 * r, h + 2 * r), bool)
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx * dx + dy * dy <= r * r:
                        near[r + dx : r + dx + w, r + dy : r + dy + h] |= occupied
            self._grids[band_m] = (near, int(x0) - r, int(y0) - r)
        return self._grids[band_m]

    def fit_xy(self, outline_xy: np.ndarray, band_m: float) -> float:
        """Share of a closed outline, in metres around `origin`, that has a
        road within about `band_m`."""
        n = max(8, math.ceil(_perimeter_m(outline_xy) / (band_m / 2)))
        steps = np.hypot(*np.diff(outline_xy, axis=0).T)
        cumulative = np.concatenate([[0.0], np.cumsum(steps)])
        s = np.linspace(0.0, cumulative[-1], n, endpoint=False)
        pts = np.column_stack(
            [
                np.interp(s, cumulative, outline_xy[:, 0]),
                np.interp(s, cumulative, outline_xy[:, 1]),
            ]
        )
        near, x0, y0 = self._grid(band_m)
        cells = np.floor(pts / (band_m / 2)).astype(int) - (x0, y0)
        inside = (
            (cells >= 0).all(axis=1)
            & (cells[:, 0] < near.shape[0])
            & (cells[:, 1] < near.shape[1])
        )
        return float(near[cells[inside, 0], cells[inside, 1]].sum()) / n

    def near_xy(self, points_xy: np.ndarray, band_m: float) -> np.ndarray:
        """Whether each point, in metres around `origin`, has a road within
        about `band_m`."""
        near, x0, y0 = self._grid(band_m)
        cells = np.floor(points_xy / (band_m / 2)).astype(int) - (x0, y0)
        inside = (
            (cells >= 0).all(axis=1)
            & (cells[:, 0] < near.shape[0])
            & (cells[:, 1] < near.shape[1])
        )
        result = np.zeros(len(points_xy), bool)
        result[inside] = near[cells[inside, 0], cells[inside, 1]]
        return result

    def fits_xy(
        self, line_xy: np.ndarray, moves: np.ndarray, band_m: float
    ) -> np.ndarray:
        """`fit_xy` of a line moved by each of `moves`, all in metres, at
        once: the line is sampled a single time (TASK-050)."""
        n = max(8, math.ceil(_perimeter_m(line_xy) / (band_m / 2)))
        steps = np.hypot(*np.diff(line_xy, axis=0).T)
        cumulative = np.concatenate([[0.0], np.cumsum(steps)])
        s = np.linspace(0.0, cumulative[-1], n, endpoint=False)
        pts = np.column_stack(
            [
                np.interp(s, cumulative, line_xy[:, 0]),
                np.interp(s, cumulative, line_xy[:, 1]),
            ]
        )
        moved = (pts[None] + moves[:, None]).reshape(-1, 2)
        return self.near_xy(moved, band_m).reshape(len(moves), n).mean(axis=1)

    def fit(self, outline: Sequence[LatLon], band_m: float) -> float:
        """`fit_xy` for an outline in WGS84."""
        return self.fit_xy(
            latlon_to_local_array(self.origin, np.array(outline)), band_m
        )


@dataclass(frozen=True)
class Placement:
    """Where the shape goes: its start (maybe moved), rotation and phase."""

    start: LatLon
    offset_m: float  # how far `start` is from the requested one
    rotation_deg: float
    phase: float


@dataclass
class Attempt:
    placement: Placement
    scale_m: float
    shape: list[LatLon]
    route: NetworkRoute
    similarity: float
    ratio: float  # distance on roads / target
    cost: float
    # How far each letter of a word moved (fit_letters), in letter heights:
    # along the base line, then up.
    shifts: tuple[tuple[float, float], ...] = ()

    @property
    def rotation_deg(self) -> float:
        return self.placement.rotation_deg

    @property
    def phase(self) -> float:
        return self.placement.phase

    @property
    def offset_m(self) -> float:
        return self.placement.offset_m


@dataclass
class Search:
    best: Attempt
    attempts: list[Attempt]
    converged: bool
    warnings: list[str] = field(default_factory=list)
    # When the tilted stage ran too (TASK-232), the best of the upright one:
    # what the search gave before tilts beyond UPRIGHT_TILT_DEG.
    upright: Attempt | None = None
    # The traces of a placement tried first that gave no good route (`first`,
    # TASK-297 A2), set aside: the search is the one without it, and these
    # are what it cost more.
    set_aside: list[Attempt] = field(default_factory=list)

    @property
    def upright_best(self) -> Attempt:
        """The best attempt of the upright stage of the search; the best of
        all when that stage traced nothing, every outline on a single road
        node (TASK-277)."""
        return self.upright or self.best


Tracer = Callable[[list[LatLon]], NetworkRoute]


def _tracer(graph: Graph, reuse_penalty: float, retrace: float = 1.0) -> Tracer:
    """Trace on the whole zone graph: the corridor already makes the roads
    far from the candidate too dear to use, so cropping first gains nothing."""

    def trace(projected: list[LatLon]) -> NetworkRoute:
        return snap_to_network(graph, projected, reuse_penalty, retrace=retrace)

    return trace


def candidate_starts(start: LatLon) -> list[tuple[LatLon, float]]:
    """The requested start, then points on rings around it, with their offset."""
    return [(start, 0.0), *_rings(start, START_RINGS_M, START_BEARINGS)]


def far_starts(start: LatLon) -> list[tuple[LatLon, float]]:
    """Where the second search starts the shape: farther rings (ADR-0040)."""
    return _rings(start, FAR_RINGS_M, FAR_BEARINGS)


def _rings(
    start: LatLon, radii: Sequence[float], bearings: int
) -> list[tuple[LatLon, float]]:
    starts = []
    for radius in radii:
        for k in range(bearings):
            bearing = 2 * math.pi * k / bearings
            x, y = radius * math.sin(bearing), radius * math.cos(bearing)
            starts.append((local_to_latlon(start, x, y), radius))
    return starts


def shift_grid() -> np.ndarray:
    """The moves a letter may try, in letter heights: every point of a grid
    of SHIFT_STEP within MAX_SHIFT, shortest first, staying put first."""
    k = round(MAX_SHIFT / SHIFT_STEP)
    moves = [
        (i * SHIFT_STEP, j * SHIFT_STEP)
        for i in range(-k, k + 1)
        for j in range(-k, k + 1)
        if i * i + j * j <= k * k
    ]
    return np.array(sorted(moves, key=lambda m: (math.hypot(*m), m)))


def letter_moves(
    word: Word,
    start: int,
    rotation_deg: float,
    scale: float,
    origin_xy: np.ndarray,
    mask: RoadMask,
    band_m: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Where each letter of `word` has most roads (TASK-050): the move of
    `shift_grid` each letter keeps, in letter heights, and its score.

    The word is drawn from gap `start` (Word.line), turned by
    `rotation_deg` and scaled by `scale` like a placement, with its first
    point at `origin_xy`, in metres around `mask.origin`. A letter scores
    the share of its strokes with a road within `band_m`, less
    SHIFT_PENALTY for the longest move. Only the letter counts: a share of
    the whole word would reward the moves that shorten the gaps. A lone
    letter does not move: the search places the word. Nor does the first
    letter of a word with the pen up, where the route starts (TASK-197).
    """
    grid = shift_grid() if len(word.letters) > 1 else np.zeros((1, 2))
    points, _ = word.line(start)
    theta = math.radians(rotation_deg)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    turn = scale * np.array([[cos_t, -sin_t], [sin_t, cos_t]])
    xy = (points - points[0]) @ turn.T + origin_xy
    moves = grid * word.height @ turn.T  # in metres
    costs = SHIFT_PENALTY * np.hypot(grid[:, 0], grid[:, 1]) / MAX_SHIFT
    chosen: list[int] = []
    scores: list[float] = []
    for k, rows in enumerate(word.strokes(start)):
        # The first move of the grid is staying put.
        tried = 1 if word.pen_up and k == 0 else len(grid)
        score = mask.fits_xy(xy[rows], moves[:tried], band_m) - costs[:tried]
        chosen.append(int(np.argmax(score)))  # the shortest move on a tie
        scores.append(float(score[chosen[-1]]))
    return grid[chosen], np.array(scores)


def fit_letters(
    word: Word,
    start: int,
    rotation_deg: float,
    scale: float,
    origin_xy: np.ndarray,
    mask: RoadMask,
    band_m: float,
) -> tuple[list[Point], np.ndarray]:
    """Move each letter of `word` where its strokes have most roads
    (`letter_moves`, same arguments); the gaps stretch to follow, and the
    first point stays. Returns the normalized points, closed, and the moves
    in letter heights."""
    shifts, _ = letter_moves(word, start, rotation_deg, scale, origin_xy, mask, band_m)
    return word.moved(start, shifts), shifts


def word_similarity(
    word: Word,
    start: int,
    route: Sequence[LatLon],
    outline: Sequence[LatLon],
    height_m: float,
) -> float:
    """How well `route` writes `word`, placed as `outline` (in the order of
    Word.line(start)) with letters `height_m` high (TASK-050): the harmonic
    mean of the letters' coverage, on average over the letters, and of the
    precision on the whole word, within WORD_TOLERANCE letter heights."""
    tolerance = WORD_TOLERANCE * height_m
    covered = np.mean(
        [
            coverage(route, [outline[i] for i in rows], tolerance)
            for rows in word.strokes(start)
        ]
    )
    exact = precision(route, outline, tolerance)
    return (
        0.0 if covered + exact == 0 else float(2 * covered * exact / (covered + exact))
    )


def search(
    graph: Graph,
    shape: Sequence[Point],
    start: LatLon,
    distance_m: float,
    *,
    max_traces: int = MAX_TRACES,
    similarity: Similarity | None = None,
    trace: Tracer | None = None,
    reuse_penalty: float = EDGE_REUSE_PENALTY,
    move_start: bool = True,
    max_tilt_deg: float = FREE_TILT_DEG,
    starts: Sequence[tuple[LatLon, float]] | None = None,
    phases: Sequence[float] = PHASES,
    word: Word | None = None,
    doubled: float = 0.0,
    tilted_traces: int = TILTED_TRACES,
    first: Placement | None = None,
    first_scale_m: float | None = None,
) -> Search:
    """Best route for `shape` near `distance_m` on `graph`, starting at
    `start` or, with `move_start`, up to START_OFFSET_M away from it; or
    from the given `starts`, each with its distance from `start`. The shape
    turns at most `max_tilt_deg` either way from how it is drawn, and the
    route enters it at one of `phases`.

    The search goes upright first, within UPRIGHT_TILT_DEG and `max_traces`
    traces; when that gives no good route and `max_tilt_deg` allows more,
    it goes again over the tilts beyond, with `tilted_traces` traces more
    (TASK-232, ADR-0195). The best route of both is the result, and
    `Search.upright` that of the first.

    When `shape` is the `word`'s points and `phases` its phases, every
    trace first moves the letters to where the roads are (fit_letters). A
    word in block letters turns the way the streets run around each start
    (`grid_turns`), whatever `max_tilt_deg` says (TASK-077): up to
    UPRIGHT_GRID_TILT_DEG first, the steeper ones as tilts. A word with the
    pen up is traced letter by letter, walking between them (pen_up.py):
    its similarity and its distance are those of the letters alone.

    With `first`, a placement a search gave before (its start may be any
    point, `offset_m` from `start`; its phase one of `phases`), that one is
    traced first, at `first_scale_m` (the initial scale when None) and
    rescaled towards the target as any placement is: a route drawn before
    by another engine, drawn again (TASK-297 A2, ADR-0256). When it gives a
    good route the search ends there. Otherwise its traces are set aside
    (`Search.set_aside`) and the search is the one without `first`, with
    its own budget: the same result. A trace of `first` cheaper but less
    alike than 0.60 would otherwise be chosen, and refused (plan_shape)."""
    similarity = similarity or SIMILARITIES[SIMILARITY]
    if first is not None and first.phase not in phases:
        raise ValueError(f"the first placement's phase {first.phase} is not tried")

    def allowed(rotation_deg: float, tilted: bool) -> bool:
        """Whether the upright search (`tilted` False) or the tilted one
        may place the shape at `rotation_deg`."""
        gap = _angle_gap(rotation_deg, 0.0)
        if max_tilt_deg >= FREE_TILT_DEG:
            return not tilted  # no upright: one search, all the way round
        if tilted:
            return UPRIGHT_TILT_DEG + 1e-9 < gap <= max_tilt_deg + 1e-9
        return gap <= min(max_tilt_deg, UPRIGHT_TILT_DEG) + 1e-9

    retrace = 1.0 if word is None else WORD_RETRACE
    if trace is None and word is not None and word.pen_up:
        trace = pen_up.tracer(graph, word, reuse_penalty, retrace)
    trace = trace or _tracer(graph, reuse_penalty, retrace)
    mask = RoadMask(graph, start)
    base_scale = first_scale(shape, distance_m, word)
    low, high = (base_scale * f for f in SCALE_RANGE)
    if starts is None:
        starts = candidate_starts(start) if move_start else [(start, 0.0)]
    attempts: list[Attempt] = []
    # The road count works in metres around `start`, without projecting.
    phase_xy = {phase: np.array(start_at_phase(shape, phase)) for phase in phases}
    phase_corners = {phase: corner_indices(pts[:-1]) for phase, pts in phase_xy.items()}
    start_xy = {s: latlon_to_local_array(start, np.array([s]))[0] for s, _ in starts}
    if first is not None and first.start not in start_xy:
        start_xy[first.start] = latlon_to_local_array(start, np.array([first.start]))[0]
    # A shape with strokes is judged finer (ADR-0039); normalized, its sides
    # drawn twice coincide exactly.
    band_share = CORRIDOR_BAND * detail_scale(np.array(shape), near_m=1e-9)
    # One band for every trace, so the letters share one grid of roads.
    letter_band = float(round(LETTER_BAND * base_scale * word.height)) if word else 0.0
    grid: dict[LatLon, list[float]] = {}
    if word is not None and word.style == "block":
        far = pen_up.reach(shape) if word.pen_up else reach(shape, phases)
        grid = grid_turns(graph, start, starts, far * base_scale)

    def grid_of(s: LatLon, tilted: bool) -> list[float]:
        """The street directions around `s` the upright search tries, or
        upright without one; or those the tilted search tries."""
        steep = [g for g in grid[s] if _angle_gap(g, 0.0) > UPRIGHT_GRID_TILT_DEG]
        if tilted:
            return steep
        return [g for g in grid[s] if g not in steep] or [0.0]

    def rotations(s: LatLon, tilted: bool) -> list[float]:
        """The rotations a placement from `s` tries first."""
        if grid:
            return grid_of(s, tilted)
        steps = np.arange(0.0, 360.0, ROTATION_STEP_DEG)
        return [float(r) for r in steps if allowed(r, tilted)]

    def may_turn(p: Placement, tilted: bool) -> bool:
        """Whether the refinement may turn a placement this way."""
        if grid:
            return any(
                _angle_gap(p.rotation_deg, g) <= GRID_TILT_DEG + 1e-9
                for g in grid_of(p.start, tilted)
            )
        return allowed(p.rotation_deg, tilted)

    def outline_xy(p: Placement, scale: float) -> np.ndarray:
        """`project_shape` in metres around `start` (same scale and rotation)."""
        pts = phase_xy[p.phase]
        theta = math.radians(p.rotation_deg)
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        local = scale * np.column_stack(
            [
                pts[:, 0] * cos_t - pts[:, 1] * sin_t,
                pts[:, 0] * sin_t + pts[:, 1] * cos_t,
            ]
        )
        return local - local[0] + start_xy[p.start]

    def placed(p: Placement, scale: float) -> list[LatLon]:
        return project_shape(shape, p.start, scale, p.rotation_deg, p.phase)

    def road_fit(p: Placement, scale: float) -> float:
        # Moving the start and tilting the shape must earn their keep.
        moved = (
            OFFSET_FIT_PENALTY * p.offset_m / START_OFFSET_M
            + TILT_FIT_PENALTY * tilt_share(p.rotation_deg, max_tilt_deg)
        )
        if word is not None:  # letter by letter, each where it may move
            _, scores = letter_moves(
                word,
                word.phases.index(p.phase),
                p.rotation_deg,
                scale,
                start_xy[p.start],
                mask,
                letter_band,
            )
            return float(scores.mean()) - moved
        # The band follows the scale alone, so every placement at one scale
        # shares the same grid.
        band = round(band_share * perimeter(shape) * scale, 3)
        outline = outline_xy(p, scale)
        fit = mask.fit_xy(outline, band)
        corners = outline[phase_corners[p.phase]]
        bare = int((~mask.near_xy(corners, band)).sum()) if len(corners) else 0
        return fit - CORNER_PENALTY * bare - moved

    def attempt(p: Placement, scale: float) -> Attempt | None:
        """`p` traced at `scale`; None when its outline falls on a single
        road node (TASK-277): no route, and no distance to rescale from."""
        shifts: tuple[tuple[float, float], ...] = ()
        if word is None:
            outline = placed(p, scale)
        else:
            drawn, moved = fit_letters(
                word,
                word.phases.index(p.phase),
                p.rotation_deg,
                scale,
                start_xy[p.start],
                mask,
                letter_band,
            )
            place = pen_up.place_line if word.pen_up else project_shape
            outline = place(drawn, p.start, scale, p.rotation_deg)
            shifts = tuple((float(x), float(y)) for x, y in moved)
        try:
            route = trace(outline)
        except CollapsedShapeError:
            return None
        if word is None:
            sim = similarity(route.points, outline)
        elif word.pen_up:
            tolerance = WORD_TOLERANCE * scale * word.height
            sim = pen_up.similarity(word, route.points, route.walks, outline, tolerance)
        else:
            index = word.phases.index(p.phase)
            sim = word_similarity(
                word, index, route.points, outline, scale * word.height
            )
        ratio = drawn_distance(route) / distance_m
        cost = (
            W_SHAPE * (1 - sim)
            + W_DISTANCE * abs(ratio - 1)
            + W_OFFSET * p.offset_m / START_OFFSET_M
            + W_TILT * tilt_share(p.rotation_deg, max_tilt_deg)
        )
        if doubled:
            cost += doubled * extra_doubled_share(route.points, outline)
        result = Attempt(p, scale, outline, route, sim, ratio, cost, shifts)
        attempts.append(result)
        return result

    def good(a: Attempt) -> bool:
        return (
            abs(a.ratio - 1) <= DISTANCE_TOLERANCE
            and a.similarity >= SIMILARITY_THRESHOLD
        )

    def next_scale(history: list[Attempt]) -> float:
        """Scale expected to hit the target distance, within the bounds.

        After two traces of one placement, the secant through them; the
        distance is not proportional to the scale (a smaller shape fits
        differently on the roads), so a plain proportion overshoots.
        """
        last = history[-1]
        guess = last.scale_m / last.ratio
        if len(history) >= 2:
            prev = history[-2]
            d0, d1 = drawn_distance(prev.route), drawn_distance(last.route)
            if not math.isclose(d0, d1):
                slope = (last.scale_m - prev.scale_m) / (d1 - d0)
                secant = last.scale_m + (distance_m - d1) * slope
                if secant > 0:
                    guess = secant
        return min(high, max(low, guess))

    def rescale(
        p: Placement, scale: float, budget: int
    ) -> tuple[Attempt | None, float]:
        """Trace, rescale towards the target, repeat; returns the next scale.

        A scale already traced for this placement is not traced again: the
        secant asks for it when it points beyond a bound of SCALE_RANGE
        twice. The trace it gave stands in, and the budget is not spent.
        """
        history: list[Attempt] = []
        for _ in range(MAX_RESCALES):
            if len(attempts) >= budget:
                break
            known = next((a for a in history if math.isclose(a.scale_m, scale)), None)
            traced = known or attempt(p, scale)
            if traced is None:
                break  # on a single road node: no distance to aim from
            history.append(traced)
            if abs(history[-1].ratio - 1) <= DISTANCE_TOLERANCE:
                break
            new_scale = next_scale(history)
            if math.isclose(new_scale, scale):
                break  # at a bound
            scale = new_scale
        return (history[-1] if history else None), scale

    def polish(best: Attempt, budget: int) -> bool:
        """Spend the budget left on the distance of the best placement.

        Between a trace too short and one too long of the same placement,
        interpolate; otherwise take the secant through the two closest.
        Stops as soon as the distance is right: if the shape is still
        wrong then, rescaling will not fix it.
        """
        p = best.placement
        while len(attempts) < budget:
            same = [a for a in attempts if a.placement == p]
            if any(abs(a.ratio - 1) <= DISTANCE_TOLERANCE for a in same):
                return any(good(a) for a in same)
            short = [a for a in same if a.ratio < 1]
            long = [a for a in same if a.ratio > 1]
            if short and long:
                a = max(short, key=lambda x: x.ratio)
                b = min(long, key=lambda x: x.ratio)
                da, db = drawn_distance(a.route), drawn_distance(b.route)
                scale = a.scale_m + (distance_m - da) * (b.scale_m - a.scale_m) / (
                    db - da
                )
            else:
                closest = sorted(same, key=lambda x: abs(x.ratio - 1))[:2]
                scale = next_scale(closest[::-1])
            scale = min(high, max(low, scale))
            if any(math.isclose(scale, a.scale_m, rel_tol=1e-3) for a in same):
                return False
            polished = attempt(p, scale)
            if polished is None:
                return False  # on a single road node at that scale
            if good(polished):
                return True
        return False

    def best_placement(
        scale: float, tried: list[Placement], tilted: bool
    ) -> Placement | None:
        """Placement with most roads along the outline at `scale`, away from
        the tried ones (same start and phase, within two rotation steps)."""
        candidates = [
            Placement(s, offset, r, phase)
            for s, offset in starts
            for r in rotations(s, tilted)
            for phase in phases
        ]
        ranked = sorted(
            range(len(candidates)),
            key=lambda i: (
                -road_fit(candidates[i], scale),
                candidates[i].offset_m,
                i,
            ),
        )
        for i in ranked:
            p = candidates[i]
            near = any(
                t.start == p.start
                and t.phase == p.phase
                and _angle_gap(t.rotation_deg, p.rotation_deg) < 2 * ROTATION_STEP_DEG
                for t in tried
            )
            if not near:
                return p
        return None

    def go(tilted: bool, budget: int) -> bool:
        """The search over the rotations of the upright or the tilted
        stage, until `budget` traces in all; whether a route was good."""
        first = len(attempts)  # the stage's own attempts come after
        scale = base_scale
        tried: list[Placement] = []
        for _ in range(TOP_PLACEMENTS):
            placement = best_placement(scale, tried, tilted)
            if placement is None or len(attempts) >= budget:
                break
            tried.append(placement)
            last, scale = rescale(placement, scale, budget)
            if last is not None and good(last):
                return True
        if len(attempts) == first:
            return False  # nothing to try: no rotation, or no budget
        best = min(attempts[first:], key=lambda a: a.cost)
        turns = np.arange(-REFINE_SPAN_DEG, REFINE_SPAN_DEG + 1e-9, REFINE_STEP_DEG)
        traced = {a.placement for a in attempts}
        around = [
            Placement(
                best.placement.start,
                best.offset_m,
                float((best.rotation_deg + t) % 360),
                best.phase,
            )
            for t in turns
        ]
        refined = sorted(
            (p for p in around if p not in traced and may_turn(p, tilted)),
            key=lambda p: (-road_fit(p, best.scale_m), p.rotation_deg),
        )
        if refined and len(attempts) < budget:
            last, _ = rescale(refined[0], best.scale_m, budget)
            if last is not None and good(last):
                return True
        polish(min(attempts[first:], key=lambda a: a.cost), budget)
        return any(good(a) for a in attempts[first:])

    # The placement of a route drawn before (TASK-297 A2): when it is not
    # good, its traces are set aside, and the search below is the one
    # without it.
    aside: list[Attempt] = []
    if first is not None:
        scale = min(high, max(low, first_scale_m or base_scale))
        last, _ = rescale(first, scale, MAX_RESCALES)
        if last is not None and good(last):
            return _done(attempts, good, distance_m)
        aside = attempts[:]
        attempts.clear()

    if go(False, max_traces) or tilted_traces <= 0:
        found = _done(attempts, good, distance_m)
    else:
        # None when every upright outline fell on a single road node.
        upright = _done(list(attempts), good, distance_m).best if attempts else None
        upright_traces = len(attempts)
        go(True, max_traces + tilted_traces)
        found = _done(attempts, good, distance_m)
        if len(attempts) > upright_traces:
            found.upright = upright
    found.set_aside = aside
    return found


def _angle_gap(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def tilt_share(rotation_deg: float, max_tilt_deg: float) -> float:
    """How far a placement leans beyond UPRIGHT_TILT_DEG, as a share of
    the way to MAX_TILT_DEG: what its tilt costs (TILT_FIT_PENALTY, W_TILT).
    Nothing within UPRIGHT_TILT_DEG, as before TASK-232, nor for a shape that
    turns freely (`max_tilt_deg` FREE_TILT_DEG), which has no upright."""
    beyond = _angle_gap(rotation_deg, 0.0) - UPRIGHT_TILT_DEG
    span = MAX_TILT_DEG - UPRIGHT_TILT_DEG
    if max_tilt_deg >= FREE_TILT_DEG or beyond <= 0.0 or span <= 0.0:
        return 0.0
    return beyond / span


def shown_rotation(rotation_deg: float, max_tilt_deg: float) -> float:
    """`RouteResult.rotation_deg` of a route placed at `rotation_deg`:
    counterclockwise in (-180°, 180°], the angle the app turns the map back
    by so the drawing reads upright (TASK-232, ADR-0195). 0 for a shape that
    turns freely: it has no upright, and the map stays north-up."""
    if max_tilt_deg >= FREE_TILT_DEG:
        return 0.0
    signed = -((-rotation_deg + 180.0) % 360.0 - 180.0)
    return round(signed, 6) + 0.0  # no -0.0


def grid_turns(
    graph: Graph,
    origin: LatLon,
    starts: Sequence[tuple[LatLon, float]],
    radius_m: float,
) -> dict[LatLon, list[float]]:
    """For each of `starts`, the directions of the streets within
    `radius_m` of it (street_grid) at most GRID_MAX_TILT_DEG off level, as
    rotations in [0°, 360°): a word in block letters lies along them
    (TASK-077). Upright when there is none."""
    streets = StreetDirections(graph, origin)
    turns: dict[LatLon, list[float]] = {}
    for s, _ in starts:
        xy = latlon_to_local_array(origin, np.array([s]))[0]
        level = [
            d % 360.0
            for d in streets.around(xy, radius_m)
            if abs(d) <= GRID_MAX_TILT_DEG
        ]
        turns[s] = level or [0.0]
    return turns


def _done(
    attempts: list[Attempt], good: Callable[[Attempt], bool], distance_m: float
) -> Search:
    """The cheapest attempt that meets both thresholds; failing that, the
    cheapest within DISTANCE_FALLBACK_M of the target, if there is one.
    CollapsedShapeError when no outline was traced, each on a single road
    node (TASK-277)."""
    if not attempts:
        raise CollapsedShapeError()
    good_ones = [a for a in attempts if good(a)]
    converged = bool(good_ones)
    within = [
        a
        for a in attempts
        if abs(drawn_distance(a.route) - distance_m) <= DISTANCE_FALLBACK_M
    ]
    best = min(good_ones or within or attempts, key=lambda a: a.cost)
    warnings = list(best.route.warnings)
    if not converged:
        if abs(best.ratio - 1) > DISTANCE_TOLERANCE:
            warnings.append(
                f"distance on roads is {best.ratio - 1:+.0%} from the target "
                f"after {len(attempts)} attempts"
            )
        if best.similarity < SIMILARITY_THRESHOLD:
            warnings.append(
                f"shape similarity {best.similarity:.2f} is below "
                f"{SIMILARITY_THRESHOLD:.2f} after {len(attempts)} attempts"
            )
    return Search(best, attempts, converged, warnings)


# Vertices of the normalized shape (docs/ROUTE_ENGINE.md §2), to be tuned.
SHAPE_POINTS = 64
# Below this similarity no route is returned: better none than one that does
# not look like the shape (TASK-015, ADR-0025).
MIN_SIMILARITY = 0.60


# Around each corner of the shape, this share of its perimeter may be drawn
# twice without counting as retraced: the spike to a corner draws it.
CORNER_SPARE = 0.05
# Along a stroke of the shape, as far as the route may be from it and still
# draw it (TASK-037): there, going out and back is the point.
STROKE_SPARE = COVER_TOLERANCE


def _scale_of(placed: Sequence[LatLon], shape: Sequence[Point]) -> float:
    """Metres per normalized unit of a placed shape."""
    xy = latlon_to_local_array(placed[0], np.array(placed))
    return _perimeter_m(xy) / perimeter(shape)


def _compass(origin: LatLon, point: LatLon) -> str:
    x, y = latlon_to_local_array(origin, np.array([point]))[0]
    names = ("north", "north-east", "east", "south-east")
    names += ("south", "south-west", "west", "north-west")
    return names[round(math.degrees(math.atan2(x, y)) / 45.0) % 8]


class GraphLoader(Protocol):
    def load(self, bbox: BBox) -> Graph: ...


def planned_distance(distance_m: float, one_way: bool) -> float:
    """What the engine plans for: a one-way shape is planned out and back,
    twice as long, and the way out is kept (TASK-041)."""
    return 2 * distance_m if one_way else distance_m


def required_area(
    shape: Sequence[Point],
    start: LatLon,
    distance_m: float,
    optimize: bool = True,
    word: Word | None = None,
) -> BBox:
    """Area whose graph a request needs: the zone, or just the initial shape.
    `distance_m` is the planned one (`planned_distance`)."""
    if optimize:
        return zone_area(shape, start, distance_m, word=word)
    return area_around(_placed_once(shape, start, distance_m, word))


def _placed_once(
    shape: Sequence[Point], start: LatLon, distance_m: float, word: Word | None
) -> list[LatLon]:
    """The shape at its initial placement, as traced without a search; the
    open line of a word with the pen up stays open."""
    scale = first_scale(shape, distance_m, word)
    if word is not None and word.pen_up:
        return pen_up.place_line(shape, start, scale)
    return project_shape(shape, start, scale)


@dataclass
class Plan:
    result: RouteResult
    search: Search | None  # None when the shape was not optimized
    checks: dict[str, float] = field(default_factory=dict)  # validation.measure
    far: Search | None = None  # the second search, when there was one
    # Other plans to choose from, best first (TASK-093, alternatives.py).
    alternatives: list[Plan] = field(default_factory=list)


def plan_route(
    request: RouteRequest,
    source: GraphLoader,
    optimize: bool = True,
    reuse_penalty: float = EDGE_REUSE_PENALTY,
    style: Style | None = None,
    top_joins: bool | None = None,
    *,
    first: Placement | None = None,
    first_scale_m: float | None = None,
) -> Plan:
    """RouteRequest in, RouteResult out (docs/ARCHITECTURE.md §3).

    With `optimize` the shape is rotated, moved and rescaled to fit the
    roads (`search`); without, it is traced once at its initial placement,
    as in TASK-017. A word is written one letter at a time (TASK-050), in
    the letters of `style` (TASK-077), the request's when None (TASK-080),
    and comes back with `word` instead
    of `shape` (TASK-056). `top_joins` says whether its letters may be
    joined along the top line too (TASK-067), words.TOP_JOINS when None.
    With the request's `pen_up` each letter is drawn on its own, and the
    result says where the route walks between them (TASK-197); so each
    piece of a shape in pieces (TASK-223), and the result keeps the shape.
    `first` and `first_scale_m` go to the search (plan_shape).
    """
    if request.word is not None:
        word = compose(
            request.word,
            style=style or request.style,
            top_joins=top_joins,
            pen_up=request.pen_up,
        )
        plan = plan_shape(
            list(word.points),
            word.text,
            request.start,
            request.distance_m,
            source,
            optimize,
            reuse_penalty,
            MAX_TILT_DEG,
            word=word,
            activity=request.activity,
            first=first,
            first_scale_m=first_scale_m,
        )
        result = replace(plan.result, shape=None, word=word.text)
        return replace(plan, result=result)
    assert request.shape is not None  # RouteRequest has one of the two
    if request.pen_up:  # a shape in pieces, RouteRequest checks it
        drawn = pieces.compose_shape(request.shape)
        return plan_shape(
            list(drawn.points),
            request.shape,
            request.start,
            request.distance_m,
            source,
            optimize,
            reuse_penalty,
            tilt_limit(request.shape),
            word=drawn,
            activity=request.activity,
            first=first,
            first_scale_m=first_scale_m,
        )
    return plan_shape(
        get_shape(request.shape)(SHAPE_POINTS),
        request.shape,
        request.start,
        request.distance_m,
        source,
        optimize,
        reuse_penalty,
        tilt_limit(request.shape),
        activity=request.activity,
        first=first,
        first_scale_m=first_scale_m,
    )


def doubled_weight(name: str) -> float:
    """How much a route run twice over the same street costs for the shape
    called `name` (W_DOUBLED); nothing for the others."""
    return W_DOUBLED.get(name, 0.0)


def tilt_limit(name: str) -> float:
    """How far a shape may turn: freely if it looks the same at any angle,
    otherwise at most MAX_TILT_DEG off upright (ADR-0038, ADR-0195)."""
    return FREE_TILT_DEG if name in FREE_ROTATION else MAX_TILT_DEG


def plan_shape(
    shape: Sequence[Point],
    name: str,
    start: LatLon,
    distance_m: int,
    source: GraphLoader,
    optimize: bool = True,
    reuse_penalty: float = EDGE_REUSE_PENALTY,
    max_tilt_deg: float = MAX_TILT_DEG,
    one_way: bool = False,
    word: Word | None = None,
    activity: str = "running",
    *,
    first: Placement | None = None,
    first_scale_m: float | None = None,
) -> Plan:
    """plan_route for any normalized shape, also an outline read from a file
    (TASK-032). `name` only labels the result and its messages; start and
    distance are the caller's to check, as RouteRequest does. An outline
    tilts at most MAX_TILT_DEG unless told otherwise (ADR-0195), and the
    result says how far it turned (`shown_rotation`). The graphs `source`
    gives must be of the network of `activity` (network.check_network).

    A `one_way` shape is drawn out and back (Outline.one_way): it is planned
    as a closed shape twice `distance_m` long, entered at its first point,
    and the route keeps the way out, which ends at the shape's far end
    (TASK-041). Shares and scores are the same for the whole and the half.

    A `word` is a closed line whose `points` are `shape`: the search enters
    it half-way along a gap between letters, and moves the letters to where
    the roads are (TASK-050). A word with the pen up is an open line
    entered at its first letter; the route is open too, and its `walks`
    say where it goes from one letter to the next without drawing
    (TASK-197): `distance_m` is planned for the letters alone.

    After a search the result may advise another distance, where the
    search found the shape clearly better drawn (better_distance, TASK-234).

    With `first`, the search near the start traces that placement first, at
    `first_scale_m`, and goes on as without when it is not good (`search`,
    TASK-297 A2). Its start is at most START_OFFSET_M away, as the search
    near the start moves it: one farther, from the search 2 km away, is
    refused (ValueError), and that search has no `first`.
    """
    if first is not None and first.offset_m > START_OFFSET_M:
        raise ValueError(
            f"the first placement is {first.offset_m:.0f} m from the start, "
            f"at most {START_OFFSET_M:.0f} m"
        )
    similarity = SIMILARITIES[SIMILARITY]
    planned_m = planned_distance(distance_m, one_way)
    kept = 0.5 if one_way else 1.0  # of the planned route
    phases = (0.0,) if one_way else PHASES
    if word is not None:
        phases = word.phases
    graph = source.load(required_area(shape, start, planned_m, optimize, word))
    check_network(graph, activity)
    far: Search | None = None
    if optimize:
        try:
            found: Search | None = search(
                graph,
                shape,
                start,
                planned_m,
                reuse_penalty=reuse_penalty,
                max_tilt_deg=max_tilt_deg,
                phases=phases,
                word=word,
                doubled=doubled_weight(name),
                first=first,
                first_scale_m=first_scale_m,
            )
        except CollapsedShapeError:
            found = None  # every outline here on a single road node
        looked_far = False
        # Only when nothing here can be drawn: look for a place farther away
        # (ADR-0040). A route here that is drawable but not good is kept
        # instead (ADR-0230): the far search took half the time of a long
        # request and gave a better route in a case out of six. Judged on
        # the upright search, as before TASK-232: a drawable route found
        # tilted does not keep the far search out. Nothing here at all
        # when no outline could be traced (TASK-277).
        if found is None or not _drawable(found.upright_best, planned_m, kept):
            looked_far = True
            far_graph = source.load(
                zone_area(shape, start, planned_m, FAR_OFFSET_M, word)
            )
            check_network(far_graph, activity)
            try:
                far = search(
                    far_graph,
                    shape,
                    start,
                    planned_m,
                    max_traces=FAR_TRACES,
                    reuse_penalty=reuse_penalty,
                    max_tilt_deg=max_tilt_deg,
                    starts=far_starts(start),
                    phases=phases,
                    word=word,
                    doubled=doubled_weight(name),
                    # Upright only, as before TASK-232: tilting was tried
                    # where the user is, and the time stays within bounds.
                    tilted_traces=0,
                )
            except CollapsedShapeError:
                far = None  # nor there
            # The far route when it is good, or drawable where nothing
            # upright near the start was (a tilted one may have been: as
            # before TASK-232, it does not keep the far one out); any far
            # route where nothing here was traced.
            if far is not None and (
                found is None or far.converged or _drawable(far.best, planned_m, kept)
            ):
                found, graph = far, far_graph
        what = f"a {distance_m / 1000:g} km {name} cannot be drawn here"
        if looked_far:
            what += f", nor within {FAR_OFFSET_M / 1000:g} km"
        if found is None:
            raise CollapsedShapeError(
                f"{what}: too few roads, the shape collapses onto a single "
                "road node wherever it is placed"
            )
        best = found.best
        if best.similarity < MIN_SIMILARITY:
            raise ShapeNotDrawableError(
                f"{what}: the best route scores "
                f"{best.similarity:.2f} for shape, {MIN_SIMILARITY:.2f} needed"
            )
        gap = (drawn_distance(best.route) - planned_m) * kept
        if abs(gap) > DISTANCE_FALLBACK_M:
            raise ShapeNotDrawableError(
                f"{what}: the best shape is "
                f"{gap / 1000:+.1f} km from the target, at most "
                f"{DISTANCE_FALLBACK_M / 1000:g} km allowed",
                best_distance_m=drawn_distance(best.route) * kept,
            )
        route, sim, warnings = best.route, best.similarity, list(found.warnings)
        placed, chosen_start = best.shape, best.placement.start
        if best.offset_m > 0:
            direction = _compass(start, best.placement.start)
            moved = (
                f"{best.offset_m:.0f} m"
                if best.offset_m < 1000
                else f"{best.offset_m / 1000:g} km"
            )
            warnings.insert(
                0,
                f"start moved {moved} {direction} of the requested point, "
                "where the shape closes on the roads",
            )
    elif word is not None and word.pen_up:
        found = None
        projected = _placed_once(shape, start, planned_m, word)
        route = pen_up.trace(graph, word, projected, reuse_penalty, WORD_RETRACE)
        height_m = first_scale(shape, planned_m, word) * word.height
        sim = pen_up.similarity(
            word, route.points, route.walks, projected, WORD_TOLERANCE * height_m
        )
        warnings = list(route.warnings)
        placed, chosen_start = projected, start
    else:
        found = None
        projected = project_shape(shape, start, initial_scale(shape, planned_m))
        retrace = 1.0 if word is None else WORD_RETRACE
        route = snap_to_network(graph, projected, reuse_penalty, retrace=retrace)
        sim, warnings = similarity(route.points, projected), list(route.warnings)
        if word is not None:
            height_m = initial_scale(shape, planned_m) * word.height
            sim = word_similarity(word, 0, route.points, projected, height_m)
        placed, chosen_start = projected, start
    [first], _ = nearest_nodes(graph, [chosen_start])
    # A word with the pen up ends at its last letter: only where it begins.
    check = pen_up.check_begins if word is not None and word.pen_up else check_closed
    check(
        route.points,
        (graph.nodes[first]["y"], graph.nodes[first]["x"]),
        start,
        chosen_start,
        FAR_OFFSET_M if far is not None and found is far else START_OFFSET_M,
    )
    if one_way:  # the far end is half-way along the shape
        route = first_leg(graph, route, start_at_phase(placed, 0.5)[0])
    outline = latlon_to_local_array(placed[0], np.array(placed))
    corners = [placed[i] for i in corner_indices(outline[:-1])]
    strokes = [(placed[i], placed[i + 1]) for i in np.flatnonzero(twice_drawn(outline))]
    size = perimeter(shape) * _scale_of(placed, shape)
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
        better_distance_m=(
            None
            if found is None
            else better_distance(found, distance_m, activity, word)
        ),
        rotation_deg=(
            0.0 if found is None else shown_rotation(best.rotation_deg, max_tilt_deg)
        ),
    )
    return Plan(result, found, measures, far)


def _drawable(best: Attempt, distance_m: float, kept: float = 1.0) -> bool:
    """Whether plan_shape would return this attempt rather than refuse it,
    keeping that share of its route."""
    return (
        best.similarity >= MIN_SIMILARITY
        and abs(drawn_distance(best.route) - distance_m) * kept <= DISTANCE_FALLBACK_M
    )


def shape_cost(attempt: Attempt) -> float:
    """The cost of `attempt` without its distance part: the shape, the
    streets run twice beyond it, the start moved and the tilt (search)."""
    return attempt.cost - W_DISTANCE * abs(attempt.ratio - 1)


def better_distance(
    found: Search,
    distance_m: float,
    activity: str = "running",
    word: Word | None = None,
) -> int | None:
    """A distance to ask for instead of `distance_m`, where the shape came
    out clearly better (TASK-234, ADR-0197); None without one.

    From the routes `found` has already traced, nothing more: one whose
    `shape_cost` is at least BETTER_MARGIN below the chosen one's and whose
    similarity is at least SIMILARITY_THRESHOLD. Its distance is the one
    asked for that gives it (its ratio, as the search measures it), to the
    whole km as the API's suggested distance; never `distance_m` itself,
    nor one a request of `activity` (or of the letters of `word`) may not
    ask for. Of several, the cheapest; on a tie, the nearest. The chosen
    route stays what it is."""
    low, high = DISTANCE_LIMITS_M.get(activity, DISTANCE_LIMITS_M["running"])
    if word is not None and word.kind == "letter":  # models.check_word
        low = max(low, len(word.letters) * LETTER_DISTANCE_M)
    beaten = shape_cost(found.best) - BETTER_MARGIN + 1e-9
    costs: dict[int, float] = {}
    for a in found.attempts:
        if a.similarity < SIMILARITY_THRESHOLD or shape_cost(a) > beaten:
            continue
        km = round(a.ratio * distance_m / 1000) * 1000
        if km != distance_m and low <= km <= high:
            costs[km] = min(costs.get(km, math.inf), shape_cost(a))
    if not costs:
        return None
    return min(costs, key=lambda km: (costs[km], abs(km - distance_m), km))
