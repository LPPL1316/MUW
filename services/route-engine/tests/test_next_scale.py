"""A trace that draws nothing gives no distance to rescale from (TASK-395).

Found with TASK-297 C on 2026-10-25: an image in pieces with the pen up,
sent far (ADR-0040) on a small graph that ignores the area, ended in
`optimizer.next_scale` with a ZeroDivisionError. Every letter, or piece,
fell on a road node of its own, the route was only the walks between
them, its drawn distance 0 and so its ratio: `next_scale` divides by it.
Such a trace is now passed over like an outline on a single road node
(TASK-277). No network here: one short road stands for the small graph.
"""

from __future__ import annotations

from collections.abc import Callable
from itertools import count

import networkx as nx
import pytest
from test_collapsed_outline import _stub
from test_optimizer import LEVICO, _half_grid

from route_engine.errors import CollapsedShapeError, ShapeNotDrawableError
from route_engine.geo import LatLon, path_length_m
from route_engine.models import RouteRequest
from route_engine.network import NetworkRoute, snap_to_network
from route_engine.optimizer import (
    SHAPE_POINTS,
    SIMILARITY_THRESHOLD,
    Tracer,
    drawn_distance,
    plan_route,
    search,
)
from route_engine.shapes import get_shape

CIRCLE = get_shape("circle")(SHAPE_POINTS)


class _Same:
    """The same small graph wherever the search loads, as a FileSource does."""

    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph
        self.loads = 0

    def load(self, bbox: object) -> nx.MultiDiGraph:
        self.loads += 1
        return self.graph


def _walks_only(projected: list[LatLon]) -> NetworkRoute:
    """A route that only walks: out to the second point and back."""
    points = [projected[0], projected[1], projected[0]]
    return NetworkRoute(points=points, distance_m=path_length_m(points), walks=[(0, 2)])


def _drawing_nothing(
    graph: nx.MultiDiGraph, empty: Callable[[int], bool]
) -> tuple[list[int], Tracer]:
    """A tracer whose routes draw nothing on the calls `empty` picks (by
    their number, from 1) and that traces the others on `graph`."""
    calls: list[int] = []
    numbers = count(1)

    def trace(projected: list[LatLon]) -> NetworkRoute:
        n = next(numbers)
        calls.append(n)
        if empty(n):
            return _walks_only(projected)
        return snap_to_network(graph, projected)

    return calls, trace


def test_a_route_of_walks_alone_draws_nothing() -> None:
    projected = [LEVICO, (LEVICO[0], LEVICO[1] + 0.01)]
    route = _walks_only(projected)
    assert route.distance_m > 0
    assert drawn_distance(route) == 0


@pytest.mark.parametrize("word", ["HI", "OK"])
@pytest.mark.parametrize("road_m", [0.0, 300.0, 3000.0])
def test_a_word_with_the_pen_up_on_one_short_road_is_refused(
    word: str, road_m: float
) -> None:
    # The case of TASK-297 C: the far search loads the same small graph.
    # Each letter falls on a road node of its own: a ZeroDivisionError
    # before, a shape that cannot be drawn now.
    source = _Same(_stub(road_m))
    request = RouteRequest(start=LEVICO, word=word, distance_m=6000, pen_up=True)
    with pytest.raises(ShapeNotDrawableError, match="nor within 2 km"):
        plan_route(request, source)
    assert source.loads == 2  # here, then the far search


def test_a_search_where_no_trace_draws_anything_says_so() -> None:
    calls, trace = _drawing_nothing(_half_grid(), lambda n: True)
    with pytest.raises(CollapsedShapeError, match="single road node"):
        search(_half_grid(), CIRCLE, LEVICO, 3000.0, trace=trace)
    assert calls  # traced, and passed over


@pytest.mark.parametrize(
    "empty",
    [lambda n: n <= 3, lambda n: n % 2 == 0],
    ids=["first three", "every other"],
)
def test_the_search_goes_on_past_traces_that_draw_nothing(
    empty: Callable[[int], bool],
) -> None:
    graph = _half_grid()
    calls, trace = _drawing_nothing(graph, empty)
    found = search(graph, CIRCLE, LEVICO, 3000.0, trace=trace)
    skipped = [n for n in calls if empty(n)]
    assert skipped
    assert len(found.attempts) == len(calls) - len(skipped)
    assert all(a.ratio > 0 for a in found.attempts)
    assert found.converged
    assert found.best.similarity >= SIMILARITY_THRESHOLD
