"""What the engine keeps per graph between traces (TASK-203, ADR-0162).

The corridor's steps and edge samples, the node ids and their coordinates
are worked out once per graph and kept while the graph stays as it is; a
trace no longer counts the edges of the graph to know it. The routes are
those of before, point for point: `BEFORE` pins them, as `main` at 3f905d7
planned them, before the change.
"""

import hashlib
from pathlib import Path

import networkx as nx
import numpy as np
import pytest

from route_engine import network
from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import RouteRequest, RouteResult
from route_engine.nearby_starts import NearbyPlan, ShapeJob, plan_nearby
from route_engine.network import (
    FileSource,
    Graph,
    _distinct_samples,
    _edge_steps,
    nearest_nodes,
    snap_to_network,
)
from route_engine.optimizer import search
from route_engine.projection import project_shape
from route_engine.shapes import get_shape

TRENTO = (46.0671, 11.1214)
LEVICO = (46.0122, 11.2986)
FIXTURE = Path(__file__).parent / "fixtures" / "levico_walk_1km.graphml"


def _grid(origin: LatLon, spacing_m: float, half_m: float) -> nx.MultiDiGraph:
    """Streets every `spacing_m` around `origin`, both directions: many
    roads cost the same, so the order things are found in shows."""
    graph = nx.MultiDiGraph()
    n = int(half_m / spacing_m)
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            lat, lon = local_to_latlon(origin, i * spacing_m, j * spacing_m)
            graph.add_node((i, j), y=lat, x=lon)
    for i, j in list(graph.nodes):
        for b in ((i + 1, j), (i, j + 1)):
            if b in graph:
                graph.add_edge((i, j), b, length=spacing_m)
                graph.add_edge(b, (i, j), length=spacing_m)
    return graph


# Where the town has no streets, in metres from its centre, and how wide.
PARKS = (
    ((450.0, 350.0), 350.0),
    ((-600.0, -500.0), 400.0),
    ((900.0, -900.0), 300.0),
    ((-300.0, 900.0), 300.0),
)


def _town(origin: LatLon) -> nx.MultiDiGraph:
    """A grid every 90 m out to 3 km with its corners moved up to 25 m, parks
    without streets, a river east of the centre with a bridge every 1 km,
    and a third of the streets missing; always the same, from a fixed seed.
    The shapes fit badly: the search traces up to its budget, looks 2 km
    away, and some nearby starts cannot draw at all."""
    rng = np.random.RandomState(203)
    graph = nx.MultiDiGraph()
    n, spacing = 33, 90.0
    xy: dict[tuple[int, int], tuple[float, float]] = {}
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            x, y = i * spacing, j * spacing
            dx, dy = rng.uniform(-25.0, 25.0, size=2)
            if any(np.hypot(x - px, y - py) < r for (px, py), r in PARKS):
                continue
            if 150.0 < x + 0.3 * y < 330.0 and j % 11 != 0:
                continue  # the river, but for the bridges
            xy[(i, j)] = (x + dx, y + dy)
            lat, lon = local_to_latlon(origin, x + dx, y + dy)
            graph.add_node((i, j), y=lat, x=lon)
    for i, j in list(graph.nodes):
        for b in ((i + 1, j), (i, j + 1)):
            if b in graph and rng.uniform() > 0.35:
                length = float(np.hypot(*np.subtract(xy[b], xy[(i, j)])))
                graph.add_edge((i, j), b, length=length)
                graph.add_edge(b, (i, j), length=length)
    joined = max(nx.weakly_connected_components(graph), key=len)
    return graph.subgraph(joined).copy()


class _Source:
    """The same graph for any area, as a zone kept in memory hands out."""

    def __init__(self, graph: Graph) -> None:
        self.graph = graph

    def load(self, bbox: tuple[float, float, float, float]) -> Graph:
        return self.graph


# --- The routes of before ---

# `_digest` of plan_nearby, the API's planner, on main at 3f905d7. The
# Levico heart comes out another way with the libraries of CI (Python 3.11,
# NetworkX 3.6, NumPy 2.4) than on the Mac (3.12, 3.7, 2.5), already with
# the code of before: both are its route of before, each where it ran.
# Since TASK-232 the shapes that are not good upright are tried tilted too
# (ADR-0195): the Levico heart's alternatives, the town's CIAO and the
# alternatives of its heart and star are new, the grid and the circle not.
# Since TASK-203 B the far search starts only where nothing near the start
# can be drawn (ADR-0230): the town's heart and star, drawable near the
# start, no longer move 1-2 km away (tests/test_far_search_skipped.py).
# Since TASK-298 a stage whose best shape stays under 0.80 does not refine
# its rotation, and a scale already traced for a placement is not traced
# again (ADR-0259): the searches that converge are the same, trace for
# trace (the grid heart, the town circle, the CIAO with the pen up from the
# start); those that do not can end otherwise. The Levico heart's own route
# is the one of before after 27 traces instead of 30 (its warning says so)
# and one of its two nearby alternatives, 0.77, is gone; the town's heart
# at 8 km is the same route from the same nearby start, its alternative from
# the start is 0.79 instead of 0.74; the town's star is the same route, its
# second alternative 0.85 instead of 0.87; the CIAO gains an alternative,
# 0.71, from a nearby start that had 0.65; the CIAO with the pen up has the
# same route and alternatives, found otherwise from the nearby starts.
BEFORE: dict[str, str | tuple[str, ...]] = {
    "grid heart 5000": "3df8155c69e599f7",
    # Mac; the CI's digest (another route of before, see above) is added
    # from its first run.
    "levico heart 2000": ("942383944e56e20c",),
    "town CIAO 12000": "996dd61ff0eeaf94",
    "town CIAO pen up 12000": "7e88ef490a83b5e3",
    "town circle 10000": "96eb22388f95078e",
    "town heart 8000": "75d03ac7576dc1cd",
    "town star 5000": "503c08c226103dce",
}


def _request(case: str) -> RouteRequest:
    where, *what, km = case.split()
    start = LEVICO if where == "levico" else TRENTO
    distance = int(km)
    if what[0] == "CIAO":
        return RouteRequest(
            start=start, distance_m=distance, word="ciao", pen_up="pen" in what
        )
    return RouteRequest(start=start, distance_m=distance, shape=what[0])


def _source(case: str) -> object:
    where = case.split()[0]
    if where == "grid":
        return _Source(_grid(TRENTO, 60.0, 3000.0))
    if where == "town":
        return _Source(_town(TRENTO))
    return FileSource(FIXTURE)


def _plan(case: str) -> NearbyPlan:
    request = _request(case)
    job = ShapeJob.of_request(request)
    return plan_nearby(job, request.start, _source(case), processes=False)


def _digest(found: NearbyPlan) -> str:
    """Every route the plan gives and how each start scored: the chosen
    one, its alternatives, the points, distances, similarities, warnings
    and walks."""

    def route(result: RouteResult) -> tuple[object, ...]:
        return (
            [(round(a, 9), round(b, 9)) for a, b in result.points],
            round(result.distance_m, 6),
            round(result.similarity, 9),
            result.warnings,
            list(result.walks),
        )

    plan = found.plan
    text = repr(
        (
            found.chosen,
            route(plan.result),
            [route(other.result) for other in plan.alternatives],
            [
                (None if t.score is None else round(t.score, 9), t.note)
                for t in found.tried
            ],
        )
    )
    return hashlib.sha256(text.encode()).hexdigest()[:16]


@pytest.mark.parametrize("case", sorted(BEFORE))
def test_the_routes_are_those_of_before(case: str) -> None:
    before = BEFORE[case]
    assert _digest(_plan(case)) in (before if isinstance(before, tuple) else (before,))


@pytest.mark.parametrize("case", ["levico heart 2000", "town circle 10000"])
def test_keeping_changes_no_route(case: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """The same plan with nothing kept for any graph, all worked out again
    at every call: on any platform and library, what is kept per graph
    cannot change a route."""
    kept = _digest(_plan(case))
    monkeypatch.setattr(network, "_mark", lambda graph: None)
    assert _digest(_plan(case)) == kept


# --- Kept while the graph stays as it is ---


def _outline() -> list[LatLon]:
    """A heart of about 3 km at Trento."""
    return project_shape(get_shape("heart")(64), TRENTO, 450.0)


def test_a_trace_does_not_count_the_edges() -> None:
    """Counting them walked every node, 7-12 ms on a zone, twice a trace."""
    graph = _grid(TRENTO, 100.0, 2000.0)
    counted = 0
    count = graph.number_of_edges

    def counting(*args: object, **kwargs: object) -> int:
        nonlocal counted
        counted += 1
        return count(*args, **kwargs)

    graph.number_of_edges = counting  # type: ignore[method-assign]
    found = search(graph, get_shape("heart")(64), TRENTO, 4000.0, max_traces=4)
    assert len(found.attempts) >= 2
    assert counted == 0


def test_what_is_kept_stays_across_traces() -> None:
    """A trace adds a node of its own to the graph and takes it away again:
    the graph is as it was, and what was kept for it still holds."""
    graph = _grid(TRENTO, 100.0, 2000.0)
    steps, samples = _edge_steps(graph), _distinct_samples(graph)
    table = network._node_table(graph)
    snap_to_network(graph, _outline())
    assert _edge_steps(graph) is steps
    assert _distinct_samples(graph) is samples
    assert network._node_table(graph) is table
    assert network._SINK not in graph


def test_a_change_to_the_graph_is_seen() -> None:
    graph = _grid(TRENTO, 100.0, 500.0)
    steps, _, _ = _edge_steps(graph)
    points, _ = _distinct_samples(graph)
    far = local_to_latlon(TRENTO, 900.0, 900.0)
    graph.add_node("far", y=far[0], x=far[1])
    graph.add_edge((5, 5), "far", length=566.0)
    assert len(_edge_steps(graph)[0]) == len(steps) + 1
    assert len(_distinct_samples(graph)[0]) > len(points)
    [node], [away] = nearest_nodes(graph, [far])
    assert node == "far" and away < 0.01
    graph.remove_node("far")
    assert len(_edge_steps(graph)[0]) == len(steps)
    [node], _ = nearest_nodes(graph, [far])
    assert node == (5, 5)


def test_a_view_follows_its_graph() -> None:
    """A view changes with the graph under it: nothing is kept for it."""
    graph = _grid(TRENTO, 100.0, 500.0)
    view = graph.subgraph([(0, 0), (0, 1), (1, 1)])
    assert len(_edge_steps(view)[0]) == 4
    graph.add_edge((0, 0), (1, 1), length=141.0)
    assert len(_edge_steps(view)[0]) == 5


def test_the_kept_coordinates_are_those_of_the_nodes() -> None:
    graph = FileSource(FIXTURE).load(network.area_around([LEVICO]))
    ids, latlon = network._node_table(graph)
    assert ids == list(graph.nodes)
    expected = np.array([(graph.nodes[n]["y"], graph.nodes[n]["x"]) for n in ids])
    assert np.array_equal(latlon, expected)
