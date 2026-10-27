"""The way back to a route, on the streets (TASK-314, ADR-0274).

A runner off the route is shown how to get back on it, as a navigator
recalculates: from the street nearest to them, the shortest way on the
roads to the stretch of the route where they may rejoin it, with the
directions of a route. Which stretch is the app's to say (ADR-0263: from
where the runner left, as far as the metres run off allow).

The way starts on the street, not at the nearest node: half-way along a
block the runner goes on to the next corner instead of back to the last
one. It ends at the first node of the route it meets, so it never runs
along the route itself; of rejoins equally near, the first along the route.

Not part of drawing routes: route_store's fingerprint leaves this file out
(ADR-0274), so a change here keeps the examples already drawn.
"""

from __future__ import annotations

import heapq
import itertools
import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

import numpy as np

from route_engine.directions import GROUP_M, Direction, guidance
from route_engine.geo import (
    LatLon,
    haversine_m,
    latlon_to_local_array,
    local_to_latlon,
    path_length_m,
)
from route_engine.models import InvalidRequestError
from route_engine.network import (
    Graph,
    _edge_coords,
    _node_latlon,
    _node_table,
    _shortest_edge,
    step_cost,
)
from route_engine.route_nodes import nodes_along

# A way back longer than this is no way back: the runner is lost, or the
# stretch is on another map.
MAX_WAY_M = 3000.0
# The street the way starts on is one of the roads of the nodes this close
# to the runner; with none that close, of the nearest node.
SNAP_RADIUS_M = 300.0
# Further than this from every road of the map, there is no way back on it:
# the runner is in a park or a field the map has no paths of, or elsewhere.
MAX_OFF_ROAD_M = 200.0
# Rejoins this close in metres are as near as each other: the first along
# the route is taken.
TIE_M = 1.0
# Consecutive points closer than this are one.
SAME_POINT_M = 0.5

NO_WAY = f"No way back to the route within {MAX_WAY_M:g} m on this map."
NO_ROAD = f"No road within {MAX_OFF_ROAD_M:g} m of the runner on this map."


class NoWayBackError(InvalidRequestError):
    """No way back on this map: no road within MAX_OFF_ROAD_M of the
    runner, or every way to the stretch is longer than MAX_WAY_M, the
    metres to the nearest road included."""


@dataclass(frozen=True)
class WayBack:
    """The way from the runner to the route.

    `points` start where the runner is and follow the streets to `rejoin`,
    the node of the route it ends at; `distance_m` is their length.
    `rejoin_m` is where `rejoin` is along the stretch, from its first point.
    `directions` are those of a route, `distance_m` along `points`: the
    first, "depart", on the street the way starts on; the last at `rejoin`
    when the route turns away from the way there. `nodes` are the nodes
    they were worked out on (the far end of the first street first, then
    one node of the route past `rejoin`), for the API's `with_alongs`.
    """

    points: list[LatLon]
    distance_m: float
    rejoin: LatLon
    rejoin_m: float
    directions: list[Direction]
    nodes: list[Any]


@dataclass(frozen=True)
class _Start:
    """Leaving the street the runner is on by one of its ends: `node`, at
    `cost` (the weight the search uses), along `coords` from the point of
    the street nearest to the runner; `behind` is the street's other end."""

    node: Any
    behind: Any
    cost: float
    coords: list[LatLon]


def way_back(graph: Graph, here: LatLon, ahead: Sequence[LatLon]) -> WayBack:
    """The shortest way on `graph` from `here` to the route stretch `ahead`
    (its points in the route's order). NoWayBackError when there is none
    within MAX_WAY_M, RouteNotOnGraphError when `ahead` is not on `graph`."""
    route = nodes_along(graph, ahead)
    along = _first_alongs(graph, ahead[0], route)
    starts = _starts(graph, here)
    start, path = _nearest_rejoin(graph, starts, along)
    rejoin = path[-1]
    following = route[route.index(rejoin) + 1 : route.index(rejoin) + 2]
    nodes = [start.behind, *path, *following]
    points, at = _points(graph, here, start, path)
    said = guidance(graph, nodes)
    return WayBack(
        points=points,
        distance_m=at[-1],
        rejoin=_node_latlon(graph, rejoin),
        rejoin_m=along[rejoin],
        directions=_from_here(said, path, at, start.coords[0]),
        nodes=nodes,
    )


def _first_alongs(
    graph: Graph, first: LatLon, route: Sequence[Any]
) -> dict[Any, float]:
    """Each node of `route` with where it first comes along the stretch:
    from its first point to the first node, then along the roads."""
    along = haversine_m(first, _node_latlon(graph, route[0]))
    found = {route[0]: along}
    for u, v in itertools.pairwise(route):
        along += float(_shortest_edge(graph, u, v)["length"])
        found.setdefault(v, along)
    return found


def _starts(graph: Graph, here: LatLon) -> list[_Start]:
    """The ends of the street nearest to `here` the way may leave it by:
    both on foot, on a one-way street only the end it goes to. Each costs
    the metres to the street, then its share of the street."""
    off, u, v, coords, index, point = _nearest_street(graph, here)
    if off > MAX_OFF_ROAD_M:
        raise NoWayBackError(NO_ROAD)
    on_street = [point]
    to_v = _clean([*on_street, *coords[index + 1 :]])
    to_u = _clean([*on_street, *reversed(coords[: index + 1])])
    length = path_length_m(coords)
    share = path_length_m(to_v) / length if length > 0 else 0.0
    starts = [_Start(v, u, off + share * step_cost(u, v, graph[u][v]), to_v)]
    if graph.has_edge(v, u):
        back = (1.0 - share) * step_cost(v, u, graph[v][u])
        starts.append(_Start(u, v, off + back, to_u))
    return starts


def _nearest_street(
    graph: Graph, here: LatLon
) -> tuple[float, Any, Any, list[LatLon], int, LatLon]:
    """How far `here` is from the edge u→v nearest to it, u and v, the
    edge's points from u to v, the index of the piece of it nearest to
    `here`, and the point on that piece."""
    ids, latlon = _node_table(graph)
    xy = latlon_to_local_array(here, latlon)
    off = np.hypot(xy[:, 0], xy[:, 1])
    near = np.flatnonzero(off <= SNAP_RADIUS_M)
    if near.size == 0:
        near = np.array([int(np.argmin(off))])
    edges: set[tuple[Any, Any]] = set()
    for i in near:
        node = ids[int(i)]
        edges.update((node, other) for other in graph.successors(node))
        edges.update((other, node) for other in graph.predecessors(node))
    best: tuple[float, Any, Any, list[LatLon], int, LatLon] | None = None
    for u, v in sorted(edges, key=repr):
        coords = _edge_coords(graph, u, v, _shortest_edge(graph, u, v))
        distance, index, point = _project(here, coords)
        if best is None or distance < best[0]:
            best = (distance, u, v, coords, index, point)
    if best is None:
        raise NoWayBackError(NO_ROAD)
    return best


def _project(here: LatLon, coords: Sequence[LatLon]) -> tuple[float, int, LatLon]:
    """How far `here` is from the line `coords`, the index of the piece
    nearest to it, and the nearest point on that piece."""
    xy = latlon_to_local_array(here, np.asarray(coords, dtype=float))
    best = (math.inf, 0, coords[0])
    for k in range(len(xy) - 1):
        (x0, y0), (x1, y1) = xy[k], xy[k + 1]
        dx, dy = x1 - x0, y1 - y0
        span = dx * dx + dy * dy
        t = 0.0 if span == 0 else min(1.0, max(0.0, -(x0 * dx + y0 * dy) / span))
        x, y = x0 + t * dx, y0 + t * dy
        distance = math.hypot(x, y)
        if distance < best[0]:
            best = (distance, k, local_to_latlon(here, x, y))
    return best


def _nearest_rejoin(
    graph: Graph, starts: Sequence[_Start], along: dict[Any, float]
) -> tuple[_Start, list[Any]]:
    """The start and the nodes of the cheapest way to a node of `along`,
    stopping at the first node of the route each way meets; of rejoins
    within TIE_M of the cheapest, the first along the route."""
    counter = itertools.count()
    cost: dict[Any, float] = {}
    came: dict[Any, Any] = {}
    origin: dict[Any, _Start] = {}
    heap: list[tuple[float, int, Any, Any, _Start]] = []
    for start in starts:
        heapq.heappush(heap, (start.cost, next(counter), start.node, None, start))
    found: list[tuple[float, Any]] = []
    limit = MAX_WAY_M
    while heap:
        spent, _, node, before, start = heapq.heappop(heap)
        if spent > limit:
            break
        if node in cost:
            continue
        cost[node], came[node], origin[node] = spent, before, start
        if node in along:
            found.append((spent, node))
            limit = min(limit, spent + TIE_M)
            continue
        for other, edges in graph[node].items():
            if other not in cost:
                heapq.heappush(
                    heap,
                    (
                        spent + step_cost(node, other, edges),
                        next(counter),
                        other,
                        node,
                        start,
                    ),
                )
    if not found:
        raise NoWayBackError(NO_WAY)
    _, rejoin = min(found, key=lambda f: (along[f[1]], f[0]))
    path = [rejoin]
    while came[path[-1]] is not None:
        path.append(came[path[-1]])
    path.reverse()
    return origin[rejoin], path


def _points(
    graph: Graph, here: LatLon, start: _Start, path: Sequence[Any]
) -> tuple[list[LatLon], list[float]]:
    """The way's points from `here`, and for each node of `path` how far
    along them it is."""
    points = _clean([here, *start.coords])
    length = path_length_m(points)
    at = [length]
    for u, v in itertools.pairwise(path):
        coords = _edge_coords(graph, u, v, _shortest_edge(graph, u, v))
        piece = _clean([points[-1], *coords[1:]])
        length += path_length_m(piece)
        points.extend(piece[1:])
        at.append(length)
    return points, at


def _from_here(
    said: Sequence[Direction], path: Sequence[Any], at: Sequence[float], street: LatLon
) -> list[Direction]:
    """`said` (the directions of the far end of the first street, `path`
    and a node past it) with their distances along the way's points: the
    departure where the way meets the street, the others at their node,
    `joined` again from those distances."""
    if not said:
        return []
    result = [replace(said[0], point=street, distance_m=0.0)]
    i = 0
    for direction in said[1:]:
        while i < len(path) and path[i] != direction.node:
            i += 1
        if i == len(path):
            break
        joined = at[i] - result[-1].distance_m < GROUP_M
        result.append(replace(direction, distance_m=at[i], joined=joined))
    return result


def _clean(points: Sequence[LatLon]) -> list[LatLon]:
    """`points` without a point that repeats the one before."""
    kept: list[LatLon] = []
    for point in points:
        if not kept or haversine_m(kept[-1], point) >= SAME_POINT_M:
            kept.append(point)
    return kept
