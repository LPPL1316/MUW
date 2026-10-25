"""Words written with the pen up (TASK-197, ADR-0157).

A word asked with `pen_up` is the open line of `words.compose(pen_up=True)`:
each letter once, from its entry to its exit on the base line. Here it
becomes a route:

- every letter is traced on its own, as an open line (`snap_to_network`
  with `closed=False`), with the zones and the corridor of the whole drawing
  (`trace`);
- from the end of one letter to the start of the next the route takes the
  shortest way along the roads: a walk, with neither zones nor corridor,
  that the runner walks with the recording paused;
- the route is one line, letters and walks in order, and `walks` says
  which stretches of it are walked: [from, to] indices into its points,
  both included. Where a walk ends, the next letter begins.
- a piece of a shape that leaves its line for a long detour is drawn in
  parts, and the detour is walked too (detours.py, TASK-242); so is a spike
  of its outline (TASK-243).

Only the letters count: the similarity looks at them alone (`similarity`),
and the distance asked for is theirs (`drawn_m`). The route's own length,
`distance_m`, still counts every point, walks included.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

import networkx as nx
import numpy as np

from route_engine import detours
from route_engine.errors import CollapsedShapeError, ShapeNotDrawableError
from route_engine.geo import (
    LatLon,
    haversine_m,
    latlon_to_local_array,
    local_to_latlon,
    path_length_m,
)
from route_engine.metrics import _dense
from route_engine.network import (
    CORRIDOR_BAND,
    STROKE_DETAIL,
    ZONE_RADIUS,
    Graph,
    NetworkRoute,
    _edge_points,
    _node_latlon,
    detail_scale,
    distance_to_segments,
    nearest_nodes,
    snap_to_network,
    step_cost,
)
from route_engine.projection import Point, transform
from route_engine.validation import InvalidRouteError
from route_engine.words import Word

# A walk: the points of a route from `from` to `to`, both included.
Walk = tuple[int, int]


@dataclass
class LiftedRoute(NetworkRoute):
    """The route of a shape in pieces with a detour walked instead of drawn
    (TASK-242): `lifted_m` are the metres its pieces lost to that, on a walk
    or left out."""

    lifted_m: float = 0.0


def place_line(
    points: Sequence[Point], start: LatLon, scale_m: float, rotation_deg: float = 0.0
) -> list[LatLon]:
    """An open line on the map, as `project_shape` places a closed one:
    scaled, turned, and its first point on `start`. It stays open."""
    local = transform(points, scale_m, rotation_deg)
    x0, y0 = local[0]
    return [local_to_latlon(start, x - x0, y - y0) for x, y in local]


def reach(points: Sequence[Point]) -> float:
    """How far an open line gets from its first point, where the route
    starts: what `optimizer.reach` is for a closed shape."""
    return max(math.dist(p, points[0]) for p in points)


def letter_lines(word: Word, line: Sequence[LatLon]) -> list[list[LatLon]]:
    """The points of each letter of `word`, placed as `line` (in the order
    of `word.line(0)`), without the gaps."""
    return [[line[int(i)] for i in rows] for rows in word.strokes(0)]


def tracer(
    graph: Graph, word: Word, reuse_penalty: float, retrace: float
) -> Callable[[list[LatLon]], NetworkRoute]:
    """`trace` on `graph` for `word`, as optimizer.search calls a tracer."""

    def trace_word(line: list[LatLon]) -> NetworkRoute:
        return trace(graph, word, line, reuse_penalty, retrace)

    return trace_word


def trace(
    graph: Graph,
    word: Word,
    line: Sequence[LatLon],
    reuse_penalty: float,
    retrace: float,
) -> NetworkRoute:
    """The route of `word` written with the pen up, placed as `line`: each
    letter traced on its own, then the shortest way on foot to the next
    (by bike, riding rather than with the bike on foot: `step_cost`).

    The zones and the corridor are those of the letters together, as if they
    were one shape: a share of their length (`snap_to_network`), finer when
    a letter has strokes drawn twice (ADR-0039). Each letter's warnings are
    named by its letter, but for where the route begins.

    The pieces of a shape (pieces.py, TASK-223) are its details, as strokes
    are: the zones and the corridor are always the finer ones. A closed
    piece, like an eye, is traced closed: it ends where it began. Where a
    piece goes a long way off its line the route walks instead of drawing
    (`_lifted`, TASK-242), and across a spike of the outline (TASK-243):
    there are more walks than pieces then. The route still begins where the
    outline does.
    """
    letters = letter_lines(word, line)
    xys = [latlon_to_local_array(letter[0], np.array(letter)) for letter in letters]
    lengths = [_length(xy) for xy in xys]
    fine = min(detail_scale(xy) for xy in xys)
    if word.kind == "piece":
        fine = min(fine, STROKE_DETAIL)
    drawing_m = fine * sum(lengths)
    pieces = [
        _trace_letter(
            graph,
            letter,
            detail_scale(xy) * own,
            drawing_m,
            reuse_penalty,
            retrace,
            closed=word.kind == "piece" and letter[0] == letter[-1],
        )
        for letter, xy, own in zip(letters, xys, lengths, strict=True)
    ]
    drawn = [(k, piece.nodes, piece.points) for k, piece in enumerate(pieces)]
    lifted_m = 0.0
    if word.kind == "piece":
        height_m = word.height * sum(lengths) / word.drawn_length
        drawn = _lifted(graph, letters, pieces, height_m)
        if any(part is not pieces[k].points for k, _, part in drawn):
            # What the pieces drew and no longer do, walked or left out.
            kept_m = sum(path_length_m(part) for _, _, part in drawn)
            lifted_m = sum(piece.distance_m for piece in pieces) - kept_m
    points = list(drawn[0][2])
    nodes = list(drawn[0][1])
    waypoints = list(pieces[0].waypoints)
    warnings = _named(word, 0, pieces[0].warnings)
    walks: list[Walk] = []
    last = 0  # the piece the route is on
    for k, part_nodes, part_points in drawn[1:]:
        try:
            way = nx.shortest_path(graph, nodes[-1], part_nodes[0], weight=step_cost)
        except nx.NetworkXNoPath:
            raise ShapeNotDrawableError(
                f"no road leads from {word.label(last)} to {word.label(k)}"
                if word.kind == "piece"
                else f"no road leads from the {word.letters[last].char} "
                f"to the {word.letters[k].char}"
            ) from None
        begin = len(points) - 1
        for u, v in zip(way, way[1:], strict=False):
            points.extend(_edge_points(graph, u, v))
        walks.append((begin, len(points) - 1))
        nodes.extend(way[1:])
        nodes.extend(part_nodes[1:])
        points.extend(part_points[1:])
        if k != last:
            waypoints.extend(pieces[k].waypoints)
            warnings.extend(_named(word, k, pieces[k].warnings))
        last = k
    route = NetworkRoute(
        points=points,
        distance_m=path_length_m(points),
        warnings=warnings,
        waypoints=waypoints,
        nodes=nodes,
        walks=walks,
    )
    if lifted_m:
        return LiftedRoute(**vars(route), lifted_m=lifted_m)
    return route


def _lifted(
    graph: Graph,
    lines: Sequence[list[LatLon]],
    pieces: Sequence[NetworkRoute],
    height_m: float,
) -> list[tuple[int, list[Any], list[LatLon]]]:
    """The stretches the route of a shape in pieces draws, in order: for
    each the piece it belongs to, its nodes and its points. A piece that
    stays by its line is drawn whole; a piece with detours (detours.strays,
    with pieces `height_m` high) is drawn in parts, without them. Each part
    more is a walk more: when the walks would be more than
    detours.MAX_WALKS, the deepest detours are the ones walked.

    The outline, the first piece, holds the start and loses its spikes only
    (`_spike`), at most detours.OUTLINE_WALKS of them on a walk: its other
    detours stay drawn. A loop back to the node it left is cut from any
    piece, and takes no walk."""
    found = {
        k: detours.strays(
            graph,
            piece.nodes,
            lines[k],
            detours.LIFT_NEAR * height_m,
            detours.LIFT_FAR * height_m,
            closed=k > 0 and lines[k][0] == lines[k][-1],
            held=k == 0,
        )
        for k, piece in enumerate(pieces)
        if len(piece.nodes) > 1
    }
    free = {k: detours.loops(pieces[k].nodes, strays) for k, strays in found.items()}
    deepest = sorted(
        (
            (detour.depth_m, k, detour)
            for k, strays in found.items()
            for detour in strays.detours
            if detour not in free[k]
        ),
        key=lambda entry: entry[:2],
        reverse=True,
    )
    # On the outline only the spikes, and few.
    spikes = [
        entry
        for entry in deepest
        if entry[1] == 0 and _spike(graph, pieces[0].nodes, entry[2], height_m)
    ][: detours.OUTLINE_WALKS]
    walked = [entry for entry in deepest if entry[1] > 0 or entry in spikes]
    walked = walked[: max(0, detours.MAX_WALKS - (len(pieces) - 1))]
    drawn: list[tuple[int, list[Any], list[LatLon]]] = []
    for k, piece in enumerate(pieces):
        if k not in found:
            drawn.append((k, piece.nodes, piece.points))
            continue
        lifted = free[k] + [detour for _, at, detour in walked if at == k]
        for part in detours.parts(piece.nodes, found[k], lifted):
            whole = part == piece.nodes
            points = piece.points if whole else detours.points_of(graph, part)
            drawn.append((k, part, points))
    return drawn


def _spike(
    graph: Graph, nodes: Sequence[Any], detour: detours.Detour, height_m: float
) -> bool:
    """Whether `detour` is a spike of the outline, with pieces `height_m`
    high: it skips little of the outline, and its road is much longer than
    its two ends are apart."""
    return detour.hole_m <= detours.OUTLINE_GAP * height_m and detours.road_m(
        graph, nodes, detour
    ) >= detours.OUTLINE_SPIKE * detours.gap_m(graph, nodes, detour)


def _trace_letter(
    graph: Graph,
    letter: list[LatLon],
    own_m: float,
    drawing_m: float,
    reuse_penalty: float,
    retrace: float,
    closed: bool = False,
) -> NetworkRoute:
    """One letter as an open route, or a closed one when told (a closed
    piece of a shape). `own_m` is the perimeter snap_to_network measures for
    it, `drawing_m` the one its zones and corridor are a share of. A letter
    that falls on a single node is that node."""
    scale = drawing_m / own_m if own_m > 0 else 1.0
    try:
        return snap_to_network(
            graph,
            letter,
            reuse_penalty,
            zone_radius=ZONE_RADIUS * scale,
            band=CORRIDOR_BAND * scale,
            retrace=retrace,
            closed=closed,
        )
    except CollapsedShapeError:
        pass  # the letter collapses onto a single road node
    except ShapeNotDrawableError:
        raise
    except ValueError:  # any other, as when the collapse was one (TASK-277)
        pass
    [node], _ = nearest_nodes(graph, letter[:1])
    return NetworkRoute(
        points=[_node_latlon(graph, node)], distance_m=0.0, nodes=[node]
    )


def _named(word: Word, k: int, warnings: Sequence[str]) -> list[str]:
    """The warnings of letter `k`, named by it; where the route begins only
    matters for the first letter, which holds the start."""
    if len(word.letters) == 1:
        return list(warnings)
    named = []
    for warning in warnings:
        if warning.startswith("start is "):
            if k == 0:
                named.append(warning)
            continue
        named.append(f"{word.label(k)}: {warning}")
    return named


def drawn_pieces(points: Sequence[LatLon], walks: Sequence[Walk]) -> list[list[LatLon]]:
    """The stretches of a route between its walks: the letters it draws."""
    pieces = []
    begin = 0
    for start, end in walks:
        pieces.append(list(points[begin : start + 1]))
        begin = end
    pieces.append(list(points[begin:]))
    return pieces


def drawn_m(
    points: Sequence[LatLon], distance_m: float, walks: Sequence[Walk]
) -> float:
    """The length of a route without its walks: what the run records and the
    distance asked for applies to. `distance_m` itself without walks."""
    if not walks:
        return distance_m
    return distance_m - sum(path_length_m(points[a : b + 1]) for a, b in walks)


def sized_m(route: NetworkRoute) -> float:
    """The length of `route` the distance asked for sizes: what it draws
    (`drawn_m`), and the detours of its pieces it walks instead (TASK-242).
    They still count, so that the search keeps the shape the size it had
    with them rather than making it larger to make up for them."""
    drawn = drawn_m(route.points, route.distance_m, route.walks)
    return drawn + (route.lifted_m if isinstance(route, LiftedRoute) else 0.0)


def walks_problem(walks: Sequence[Walk], count: int, what: str = "walk") -> str | None:
    """Why `walks` cannot belong to a route of `count` points, or None: each
    [from, to] within the points, from ≤ to, in order and not overlapping
    (one may start where the one before ended). `what` names them in the
    message: also the stretches with the bike on foot (TASK-206)."""
    end = 0
    for k, (start, stop) in enumerate(walks):
        if not 0 <= start <= stop < count:
            return (
                f"{what} {k} [{start}, {stop}] is not a stretch of the {count} "
                "points of the route"
            )
        if start < end:
            return (
                f"{what} {k} [{start}, {stop}] starts before the {what} before "
                "it ends"
            )
        end = stop
    return None


def similarity(
    word: Word,
    points: Sequence[LatLon],
    walks: Sequence[Walk],
    line: Sequence[LatLon],
    tolerance_m: float,
) -> float:
    """How well a route writes `word` with the pen up, placed as `line`
    (in the order of `word.line(0)`): `optimizer.word_similarity` on the
    letters alone. The coverage of each letter by the route, on average over
    the letters, and the precision of the route on the letters, within
    `tolerance_m`; their harmonic mean. Walks count in neither, and the
    gaps of `line` are not letters: each line stays open."""
    origin = line[0]
    letters = [
        latlon_to_local_array(origin, np.array(p)) for p in letter_lines(word, line)
    ]
    drawn = [
        latlon_to_local_array(origin, np.array(p)) for p in drawn_pieces(points, walks)
    ]
    route_a, route_b = _segments(drawn)
    covered = np.mean(
        [
            float(
                (
                    distance_to_segments(route_a, route_b, _dense(xy)) <= tolerance_m
                ).mean()
            )
            for xy in letters
        ]
    )
    letter_a, letter_b = _segments(letters)
    samples = np.vstack([_dense(xy) for xy in drawn])
    exact = float(
        (distance_to_segments(letter_a, letter_b, samples) <= tolerance_m).mean()
    )
    total = covered + exact
    return 0.0 if total == 0 else float(2 * covered * exact / total)


def check_begins(
    points: Sequence[LatLon],
    first: LatLon,
    requested: LatLon,
    start: LatLon,
    max_offset_m: float,
) -> None:
    """`validation.check_closed` for an open route: it begins at `first`,
    the road point nearest to the chosen `start`, and `start` is within
    `max_offset_m` of the `requested` one (ADR-0025)."""
    if not points or points[0] != first:
        raise InvalidRouteError("the route does not begin at its start")
    offset = haversine_m(start, requested)
    if offset > max_offset_m + 1.0:
        raise InvalidRouteError(
            f"the start was moved {offset:.0f} m from the requested one "
            f"(at most {max_offset_m:.0f} m)"
        )


def _segments(lines: Sequence[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """The sides of several lines, never one from a line to the next; a
    line of one point is a side of no length."""
    starts, ends = [], []
    for xy in lines:
        if len(xy) == 1:
            starts.append(xy)
            ends.append(xy)
        else:
            starts.append(xy[:-1])
            ends.append(xy[1:])
    return np.vstack(starts), np.vstack(ends)


def _length(xy: np.ndarray) -> float:
    return float(np.hypot(*np.diff(xy, axis=0).T).sum())
