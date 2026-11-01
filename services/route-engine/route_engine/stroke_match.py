"""A stroke drawn on the map, anchored to the roads (TASK-347 part A,
ADR-0300; docs/ROUTE_ENGINE.md §4, «Il disegno ancorato e i tratti»).

`snap_stroke` is the map matching of the free drawing: zones and corridor,
as `snap_to_network` traces a shape, on one open polyline in WGS84, with no
closing and no search. The stroke stays where and as the finger drew it,
and the route follows the roads nearest to it. A stroke after the first
starts from the node the one before ended at (`start_node`), so the strokes
join along the roads by themselves.

The strength of the magnet is `fit`, in [0, 1]: the radius of the zones and
the band of the corridor are a share of the stroke's length between
TIGHT_SHARE (0, faithful to the drawing) and LOOSE_SHARE (1, the values of
today's tracing). The same share serves a whole drawing placed `anchored`
(anchored.py).

A new module, not a change to the engine's own: with anchored.py it is left
out of the API's fingerprint of the engine (route_store.ANCHORED_ONLY), so
the routes the server keeps stay valid. Strokes and anchored drawings are
never kept there.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from route_engine.errors import CollapsedShapeError
from route_engine.geo import LatLon, latlon_to_local_array, path_length_m
from route_engine.models import InvalidRequestError
from route_engine.network import (
    CORRIDOR_BAND,
    CORRIDOR_WEIGHT,
    EDGE_REUSE_PENALTY,
    SPARSE_THRESHOLD_M,
    ZONE_RADIUS,
    Graph,
    _corridor_costs,
    _edge_points,
    _node_latlon,
    _route_through_zones,
    check_network,
    corner_indices,
    distance_to_polyline,
    distance_to_segments,
    nearest_nodes,
    prune_parallel_spurs,
    prune_spurs,
    twice_drawn,
)

# The magnet (ADR-0300, part A): zones and corridor band as shares of the
# stroke's length, from a tight one at fit 0 to today's ZONE_RADIUS and
# CORRIDOR_BAND at fit 1. On a 3 km stroke, 0.5% is 15 m, about a finger at
# zoom 16; 2% is 60 m, a finger at zoom 13-14, where a 5 km drawing is made.
TIGHT_SHARE = 0.005
LOOSE_SHARE = ZONE_RADIUS
assert LOOSE_SHARE == CORRIDOR_BAND  # one share for both, as today
# Never tighter than this, in metres: a finger is never more precise, and a
# band of a metre or two on a short stroke would weigh every road by its
# distance alone.
FLOOR_M = 10.0
# The magnet when none is asked: today's values (--no-optimize, TASK-017).
DEFAULT_FIT = 1.0
# The most zones a stroke is traced through, one leg of routing each: a
# stroke comes with up to hundreds of points, and its anchors are the
# vertices Douglas-Peucker keeps within THIN_SHARE of the band, at most this
# many (the tolerance doubles until they fit). As many as the points of a
# shape (optimizer.SHAPE_POINTS).
MAX_ANCHORS = 64
THIN_SHARE = 0.25
COLLAPSED_STROKE = (
    "the stroke collapses onto a single road node: too few roads around it"
)
NO_START_NODE = "the start node is not on this graph"


@dataclass(frozen=True)
class StrokeMatch:
    """A stroke anchored to the roads: what POST /stroke-matches answers."""

    # The route along the roads, from the start node (or the node nearest
    # to the stroke's first point) to the zone of its last point.
    points: list[LatLon]
    # For each point of the stroke as drawn, in order, how far the route
    # runs from it, in metres: the app colours the points far from the roads.
    away_m: list[float]
    # True when the drawn points are, on average, farther from a road than
    # SPARSE_THRESHOLD_M: the stroke is in the fields, the match is a guess.
    off_roads: bool
    # The graph nodes of `points`, in order: the last one is where the next
    # stroke starts (`start_node`). Not in the contract.
    nodes: list[Any] = field(default_factory=list)


def check_fit(fit: float) -> None:
    """The magnet of an anchored drawing is a number in [0, 1] (TASK-347)."""
    if not (isinstance(fit, int | float) and math.isfinite(fit) and 0.0 <= fit <= 1.0):
        raise InvalidRequestError(f"fit must be between 0 and 1, got {fit!r}")


def magnet_share(fit: float) -> float:
    """The radius of the zones and the band of the corridor as a share of
    the drawing's length, for the magnet `fit` in [0, 1]."""
    check_fit(fit)
    return TIGHT_SHARE + fit * (LOOSE_SHARE - TIGHT_SHARE)


def magnet_m(fit: float, length_m: float) -> float:
    """`magnet_share` of a drawing `length_m` long, in metres, at least
    FLOOR_M."""
    return max(FLOOR_M, magnet_share(fit) * length_m)


def anchored_share(fit: float | None, length_m: float) -> float:
    """What `snap_to_network` takes for a whole drawing placed anchored
    (anchored.plan_anchored): the share of its `length_m` the zones and the
    band take, `magnet_share` of `fit` (DEFAULT_FIT when None), at least
    FLOOR_M of that length."""
    magnet = DEFAULT_FIT if fit is None else fit
    return max(magnet_share(magnet), FLOOR_M / max(length_m, 1.0))


def stroke_length_m(line: Sequence[LatLon]) -> float:
    """How long a stroke is, in metres along its points."""
    return path_length_m(line)


def thin(xy: np.ndarray, tolerance_m: float, most: int = MAX_ANCHORS) -> list[int]:
    """The indices of the vertices of the polyline `xy` that Douglas-Peucker
    keeps within `tolerance_m` of it, the two ends always; with more than
    `most`, the tolerance doubles until they fit."""
    kept = _peucker(xy, tolerance_m)
    while len(kept) > most:
        tolerance_m *= 2.0
        kept = _peucker(xy, tolerance_m)
    return kept


def _peucker(xy: np.ndarray, tolerance_m: float) -> list[int]:
    n = len(xy)
    if n <= 2:
        return list(range(n))
    kept = np.zeros(n, dtype=bool)
    kept[0] = kept[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        d = distance_to_segments(xy[a][None], xy[b][None], xy[a + 1 : b])
        i = int(np.argmax(d))
        if d[i] > tolerance_m:
            k = a + 1 + i
            kept[k] = True
            stack.append((k, b))
            stack.append((a, k))
    return [int(i) for i in np.flatnonzero(kept)]


def snap_stroke(
    line: Sequence[LatLon],
    graph: Graph,
    activity: str = "running",
    fit: float | None = None,
    start_node: Any | None = None,
    reuse_penalty: float = EDGE_REUSE_PENALTY,
) -> StrokeMatch:
    """The roads that draw the open polyline `line`, as the finger drew it.

    The route starts at `start_node`, the node the stroke before ended at,
    or, without one, at the node nearest to the first point; then it goes
    through a zone around each anchor of the stroke in order, along the
    roads the corridor keeps near it (network._route_through_zones), and
    ends in the zone of the last point. Nothing is turned, scaled or moved,
    and nothing closes the line. The anchors are the vertices `thin` keeps,
    so that a stroke of hundreds of points costs at most MAX_ANCHORS legs.
    `fit` sets the magnet (`magnet_m`): zones and band at fit 0 are tight,
    at fit 1 the values of `snap_to_network`; None is DEFAULT_FIT.

    Where the stroke goes back along itself within the band, the roads it
    has just used cost no more, as for the strokes of a shape (ADR-0039):
    it comes back on the same road. The out-and-back spurs inside the
    stroke are pruned as for a shape (network.prune_spurs), but never the
    tips where the stroke turns by more than CORNER_TURN_DEG, nor its two
    ends: those are what draws it, and the end is where the next stroke
    starts.

    `away_m` is the distance of each drawn point from the route;
    `off_roads` says the drawn points are, on average, farther than
    SPARSE_THRESHOLD_M from any road node: what warns of a sparse network
    in `snap_to_network`. The graph must be of the network of `activity`
    (network.check_network).

    Fewer than two points, a `fit` out of [0, 1] or a `start_node` not on
    the graph: InvalidRequestError. Every point with the same nearest node,
    and no other start: CollapsedShapeError, a ShapeNotDrawableError.
    """
    if len(line) < 2:
        raise InvalidRequestError("a stroke has at least 2 points")
    check_network(graph, activity)
    if start_node is not None and start_node not in graph:
        raise InvalidRequestError(NO_START_NODE)
    points_in = np.array(line, dtype=float)
    origin: LatLon = (float(points_in[0, 0]), float(points_in[0, 1]))
    xy = latlon_to_local_array(origin, points_in)
    length_m = float(np.hypot(*np.diff(xy, axis=0).T).sum())
    band_m = magnet_m(DEFAULT_FIT if fit is None else fit, length_m)

    nodes, distances = nearest_nodes(graph, [tuple(p) for p in points_in])
    distinct = set(nodes)
    if start_node is not None:
        distinct.add(start_node)
    if len(distinct) < 2:
        raise CollapsedShapeError(COLLAPSED_STROKE)
    off_roads = sum(distances) / len(distances) > SPARSE_THRESHOLD_M

    kept = thin(xy, THIN_SHARE * band_m)
    anchors_xy = xy[kept]
    anchors = [(float(points_in[i, 0]), float(points_in[i, 1])) for i in kept]
    # The anchors are 1-based in _route_through_zones; the first point is an
    # anchor only when the route starts elsewhere (from the stroke before).
    offset = 1 if start_node is not None else 0
    first = start_node if start_node is not None else nodes[0]
    legs = anchors[1 - offset :]
    last = len(anchors) - 1
    corners = {i + offset for i in corner_indices(anchors_xy) if 0 < i < last}
    # Side i of the anchors leads to anchor i + 1 (+ offset).
    retraced = twice_drawn(anchors_xy, near_m=band_m)
    twice = {int(i) + 1 + offset for i in np.flatnonzero(retraced)}

    costs = _corridor_costs(graph, origin, anchors_xy, CORRIDOR_WEIGHT, band_m)
    route_nodes, _, _, corner_nodes = _route_through_zones(
        graph,
        origin,
        first,
        legs,
        band_m,
        costs,
        reuse_penalty,
        corners,
        twice,
        1.0,
        closed=False,
    )
    keep = set(corner_nodes) | {route_nodes[0], route_nodes[-1]}
    pruned = list(route_nodes)
    while True:  # removing one kind of spur can expose the other
        before = pruned
        pruned = prune_spurs(pruned, keep=keep)
        pruned = prune_parallel_spurs(graph, pruned, keep=keep)
        if pruned == before:
            break
    if len(set(pruned)) >= 2:
        route_nodes = pruned

    points: list[LatLon] = [_node_latlon(graph, route_nodes[0])]
    for u, v in zip(route_nodes, route_nodes[1:], strict=False):
        points.extend(_edge_points(graph, u, v))
    route_xy = latlon_to_local_array(origin, np.array(points, dtype=float))
    if len(route_xy) >= 2:
        away = distance_to_polyline(route_xy, xy)
    else:
        away = np.hypot(xy[:, 0] - route_xy[0, 0], xy[:, 1] - route_xy[0, 1])
    return StrokeMatch(
        points=points,
        away_m=[float(d) for d in away],
        off_roads=off_roads,
        nodes=list(route_nodes),
    )
