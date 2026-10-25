"""Turn-by-turn directions at the junctions of a route (TASK-047, ADR-0045).

A direction is given where the route changes road at a junction, or takes
one of two ways ahead at a fork, not where the track changes heading. A
junction is a node with at least MIN_BRANCHES roads; on any other node
nothing is said, whatever the angle: the graph is simplified (OSMnx keeps a
road's bends in its edges), and the few nodes left with two roads are cut
borders or ways joined end to end. The one exception is turning back: at a
dead end, or in the middle of a road, a route that goes back to the node it
came from is told "u-turn" (TASK-271).

Branches are counted on the roads, not with `graph.degree`: in a two-way
MultiDiGraph a node in the middle of a road has degree 4, two edges in and
two out, and would look like a junction.

Works in metres on the plane tangent at each node (route_engine.geo).
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, replace
from typing import Any, Literal

import networkx as nx

from route_engine.geo import LatLon, latlon_to_local

# A node is a junction from this many roads up: fewer is the middle of a road
# (two) or its dead end (one), where only turning back is told.
MIN_BRANCHES = 3
# The heading of a road at a node is taken this far along it: far enough to
# ignore how a way is drawn into the node, the few metres of a kerb or a
# mapping kink, near enough that a bend after the junction is not part of the
# turn made at it.
HEADING_PROBE_M = 20.0
# Turn angles, in degrees either side. Up to TURN_MIN_DEG the route goes
# straight on: a road meeting another at 150° instead of 180° still reads as
# straight ahead, and only a change of road, or a fork (another road as
# straight ahead or more), makes it worth a direction. From
# SHARP_MIN_DEG, half-way between a right angle and turning back, a turn is
# sharp; from U_TURN_MIN_DEG the route turns back, whether along the road it
# came on (180°) or onto the one beside it.
TURN_MIN_DEG = 30.0
SHARP_MIN_DEG = 135.0
U_TURN_MIN_DEG = 165.0
# Directions closer than this to the one before are read with it, "left,
# then right": mostly crossing a street from one pavement to the other
# (TASK-048, ADR-0047).
GROUP_M = 15.0

Turn = Literal[
    "depart", "left", "right", "sharp-left", "sharp-right", "straight", "u-turn"
]


@dataclass(frozen=True)
class Direction:
    """What to do at one junction of the route, or where it turns back.

    `angle_deg` is the turn, positive to the right, in (-180, 180]; `turn`
    names it (`turn_of`), except at a fork, where a turn of TURN_MIN_DEG or
    less is "left" or "right" of the other road straight ahead.
    `street` is the name of the road entered, its `ref` (like "SP12") when
    OpenStreetMap has no name, or None when it has neither: never made up.
    `road_type` is its OSM `highway` (like "footway"), for a road without
    either. A way whose simplified edge merges several names or types
    carries them all, joined by " / ".
    `joined` is True when the direction comes less than GROUP_M after the
    one before, to be read with it. The departure (`guidance`) has turn
    "depart", angle 0, and the road the route starts on.
    `along` is the street an unnamed road runs along (sidewalks.alongs,
    ADR-0054, ADR-0057): a deduction, never put in `street`; `guidance`
    leaves it None, the API fills it.
    """

    node: Any
    point: LatLon
    distance_m: float  # along the route from its start
    turn: Turn
    angle_deg: float
    street: str | None
    road_type: str | None
    branches: int
    joined: bool = False
    along: str | None = None


def guidance(graph: nx.MultiDiGraph, nodes: Sequence[Any]) -> list[Direction]:
    """What a runner is told along a route: the road it starts on, then
    `directions`, each marked `joined` when it comes less than GROUP_M
    after the one before. None of them is dropped. Empty for a route of
    fewer than two nodes."""
    if len(nodes) < 2:
        return []
    first = _edge(graph, nodes[0], nodes[1])
    said = [
        Direction(
            node=nodes[0],
            point=_latlon(graph, nodes[0]),
            distance_m=0.0,
            turn="depart",
            angle_deg=0.0,
            street=_join(_road(first)),
            road_type=_join(_labels(first.get("highway"))),
            branches=branch_count(graph, nodes[0]),
        )
    ]
    for direction in directions(graph, nodes):
        joined = direction.distance_m - said[-1].distance_m < GROUP_M
        said.append(replace(direction, joined=joined))
    return said


def directions(graph: nx.MultiDiGraph, nodes: Sequence[Any]) -> list[Direction]:
    """The directions of a route given as the graph nodes it passes, in order.

    One at every junction where the route turns by more than TURN_MIN_DEG,
    or goes on straight but either changes road (from one name to another,
    or between a named road and one without a name) or leaves another road
    as straight ahead as its own: at a fork "straight on" says nothing.
    Off a junction, at a dead end or in the middle of a road, one only where
    the route goes back to the node it came from and turns by U_TURN_MIN_DEG
    or more: "u-turn", with the road's name. None on the first and last
    node. Between two nodes the route takes the shortest edge, as the router
    does.
    """
    result: list[Direction] = []
    along = 0.0
    for i in range(1, len(nodes) - 1):
        before, node, after = nodes[i - 1], nodes[i], nodes[i + 1]
        entering = _edge(graph, before, node)
        leaving = _edge(graph, node, after)
        along += float(entering["length"])
        count = branch_count(graph, node)
        if count < MIN_BRANCHES and after != before:
            continue
        arrival = heading(graph, node, before, entering) + 180.0
        angle = _signed(heading(graph, node, after, leaving) - arrival)
        came, going = _road(entering), _road(leaving)
        changed = came != going and not came & going
        turn = turn_of(angle)
        if count < MIN_BRANCHES and turn != "u-turn":
            continue  # back by another road to the same node: round a loop
        if turn == "straight":
            taken = {_key(before, entering), _key(after, leaving)}
            fork = _straighter(graph, node, arrival, angle, taken)
            if fork is not None:
                turn = "right" if angle > fork else "left"
            elif not changed:
                continue
        result.append(
            Direction(
                node=node,
                point=_latlon(graph, node),
                distance_m=along,
                turn=turn,
                angle_deg=angle,
                street=_join(came & going or going),
                road_type=_join(_labels(leaving.get("highway"))),
                branches=count,
            )
        )
    return result


def branch_count(graph: nx.MultiDiGraph, node: Any) -> int:
    """Roads that meet at `node`, whichever way their edges point.

    A two-way road is an edge out and an edge in with the same neighbour and
    length; two different roads to the same neighbour count twice, and a
    road that loops back to `node` counts twice, like OSMnx's street_count.
    """
    roads = _roads(graph, node)
    return len(roads) + sum(other == node for other, _ in roads.values())


def heading(
    graph: nx.MultiDiGraph,
    node: Any,
    other: Any,
    data: dict[str, Any],
    probe_m: float = HEADING_PROBE_M,
) -> float:
    """Compass bearing, in [0, 360), of the road between `node` and `other`
    as it leaves `node`: towards its point `probe_m` along, or its far end
    if it is shorter."""
    origin = _latlon(graph, node)
    xy = [latlon_to_local(origin, p) for p in _coords_from(graph, node, other, data)]
    x, y = xy[-1]
    walked = 0.0
    for (x0, y0), (x1, y1) in zip(xy, xy[1:], strict=False):
        step = math.hypot(x1 - x0, y1 - y0)
        if step > 0 and walked + step >= probe_m:
            t = (probe_m - walked) / step
            x, y = x0 + t * (x1 - x0), y0 + t * (y1 - y0)
            break
        walked += step
    return math.degrees(math.atan2(x, y)) % 360.0


def turn_of(angle_deg: float) -> Turn:
    """The kind of turn for a signed angle, positive to the right."""
    size = abs(angle_deg)
    if size <= TURN_MIN_DEG:
        return "straight"
    if size >= U_TURN_MIN_DEG:
        return "u-turn"
    if size >= SHARP_MIN_DEG:
        return "sharp-right" if angle_deg > 0 else "sharp-left"
    return "right" if angle_deg > 0 else "left"


def _edge(graph: nx.MultiDiGraph, u: Any, v: Any) -> dict[str, Any]:
    """The shortest u→v edge, the one network.snap_to_network draws."""
    if not graph.has_edge(u, v):
        raise ValueError(f"route nodes {u!r} and {v!r} are not joined by a road")
    data: dict[str, Any] = min(graph[u][v].values(), key=lambda d: float(d["length"]))
    return data


Road = tuple[Any, float]  # (neighbour, length to 0.1 m): one road at a node


def _key(other: Any, data: dict[str, Any]) -> Road:
    return other, round(float(data["length"]), 1)


def _roads(graph: nx.MultiDiGraph, node: Any) -> dict[Road, tuple[Any, dict[str, Any]]]:
    """The roads at `node`, each with its neighbour and one of its edges: a
    two-way road is an edge out and an edge in, same neighbour and length."""
    roads: dict[Road, tuple[Any, dict[str, Any]]] = {}
    for _, other, data in graph.out_edges(node, data=True):
        roads.setdefault(_key(other, data), (other, data))
    for other, _, data in graph.in_edges(node, data=True):
        roads.setdefault(_key(other, data), (other, data))
    return roads


def _straighter(
    graph: nx.MultiDiGraph,
    node: Any,
    arrival: float,
    angle: float,
    taken: set[Road],
) -> float | None:
    """The turn onto the road straightest ahead, when it is as straight as
    the route's `angle` or more: a fork, where "straight on" does not say
    which way. None when the route is the straightest way on. The roads in
    `taken`, where the route comes from and goes to, and loops are left out.
    """
    best: float | None = None
    for key, (other, data) in _roads(graph, node).items():
        if key in taken or other == node:
            continue
        turn = _signed(heading(graph, node, other, data) - arrival)
        if abs(turn) <= abs(angle) and (best is None or abs(turn) < abs(best)):
            best = turn
    return best


def _latlon(graph: nx.MultiDiGraph, node: Any) -> LatLon:
    return graph.nodes[node]["y"], graph.nodes[node]["x"]


def _coords_from(
    graph: nx.MultiDiGraph, node: Any, other: Any, data: dict[str, Any]
) -> list[LatLon]:
    """Points of an edge between `node` and `other`, starting at `node`,
    whichever way the edge points (same convention as network.py)."""
    start = _latlon(graph, node)
    geometry = data.get("geometry")
    if geometry is None:
        return [start, _latlon(graph, other)]
    coords = [(lat, lon) for lon, lat in geometry.coords]
    if math.dist(coords[-1], start) < math.dist(coords[0], start):
        coords.reverse()
    return coords


def _road(data: dict[str, Any]) -> frozenset[str]:
    """What names a road for the runner: its names, else its refs."""
    return _labels(data.get("name")) or _labels(data.get("ref"))


def _labels(value: Any) -> frozenset[str]:
    """An OSM tag as a set: simplified edges carry a list when the ways
    they merge disagree; a missing tag is an empty set."""
    if isinstance(value, str):
        values: Iterable[Any] = [value]
    elif isinstance(value, list | tuple | set | frozenset):
        values = value
    else:
        return frozenset()
    return frozenset(v.strip() for v in values if isinstance(v, str) and v.strip())


def _join(labels: frozenset[str]) -> str | None:
    return " / ".join(sorted(labels)) if labels else None


def _signed(angle_deg: float) -> float:
    """An angle in (-180, 180]."""
    wrapped = (angle_deg + 180.0) % 360.0 - 180.0
    return 180.0 if wrapped == -180.0 else wrapped
