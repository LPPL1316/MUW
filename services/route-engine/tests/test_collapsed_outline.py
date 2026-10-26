"""An outline whose points all have the same nearest road node cannot be
drawn there, and the search goes on (TASK-277).

On 2026-10-10 two 5 km circles on a rural zone downloaded on demand ended
as `engine_error`: every point of an outline fell on one road node,
snap_to_network said so with a plain ValueError, and that ended the whole
request, without the far search (ADR-0040) and without the nearby starts
(ADR-0071). No network here: a short road far from the start stands for
that zone, and a street grid 1 km away for the roads the far search finds.
"""

from __future__ import annotations

from collections.abc import Callable
from itertools import count

import networkx as nx
import pytest
from test_optimizer import LEVICO, _grid_from_x, _half_grid

from route_engine.errors import CollapsedShapeError, ShapeNotDrawableError
from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import RouteRequest
from route_engine.nearby_starts import ShapeJob, plan_nearby
from route_engine.network import BBox, NetworkRoute, snap_to_network
from route_engine.optimizer import (
    FAR_OFFSET_M,
    MAX_TILT_DEG,
    SHAPE_POINTS,
    SIMILARITY_THRESHOLD,
    TOP_PLACEMENTS,
    UPRIGHT_TILT_DEG,
    Tracer,
    plan_route,
    search,
    tilt_limit,
)
from route_engine.projection import initial_scale, project_shape
from route_engine.shapes import get_shape

CIRCLE = get_shape("circle")(SHAPE_POINTS)
HEART = get_shape("heart")(SHAPE_POINTS)


def _stub(x_m: float) -> nx.MultiDiGraph:
    """One road 50 m long, from x_m east of LEVICO further east: every point
    west of its middle has its first node as the nearest."""
    graph = nx.MultiDiGraph()
    for node, x in enumerate((x_m, x_m + 50.0)):
        lat, lon = local_to_latlon(LEVICO, x, 0.0)
        graph.add_node(node, y=lat, x=lon)
    graph.add_edge(0, 1, length=50.0)
    graph.add_edge(1, 0, length=50.0)
    return graph


class _NearThenFar:
    """The roads where the user is, then those the far search loads."""

    def __init__(self, near: nx.MultiDiGraph, far: nx.MultiDiGraph) -> None:
        self.graphs = [near, far]
        self.loads: list[BBox] = []

    def load(self, bbox: BBox) -> nx.MultiDiGraph:
        self.loads.append(bbox)
        return self.graphs[min(len(self.loads), 2) - 1]


def _collapsing(
    graph: nx.MultiDiGraph, collapses: Callable[[int], bool]
) -> tuple[list[int], Tracer]:
    """A tracer that says CollapsedShapeError on the calls `collapses`
    picks (by their number, from 1) and traces the others on `graph`."""
    calls: list[int] = []
    numbers = count(1)

    def trace(projected: list[LatLon]) -> NetworkRoute:
        n = next(numbers)
        calls.append(n)
        if collapses(n):
            raise CollapsedShapeError()
        return snap_to_network(graph, projected)

    return calls, trace


def test_an_outline_on_a_single_road_node_cannot_be_drawn() -> None:
    # A 5 km circle around the start, the road 3 km east: all on node 0.
    outline = project_shape(CIRCLE, LEVICO, initial_scale(CIRCLE, 5000.0))
    with pytest.raises(CollapsedShapeError, match="single road node") as refused:
        snap_to_network(_stub(3000.0), outline)
    # Answered as any shape that cannot be drawn (API: shape_not_drawable),
    # and still a ValueError for whoever caught that before.
    assert isinstance(refused.value, ShapeNotDrawableError)
    assert isinstance(refused.value, ValueError)
    assert refused.value.best_distance_m is None


@pytest.mark.parametrize(
    "collapses",
    [lambda n: n <= 3, lambda n: n % 2 == 0],
    ids=["first three", "every other"],
)
def test_the_search_goes_on_past_outlines_that_collapse(
    collapses: Callable[[int], bool],
) -> None:
    graph = _half_grid()
    calls, trace = _collapsing(graph, collapses)
    found = search(graph, CIRCLE, LEVICO, 3000.0, trace=trace)
    collapsed = [n for n in calls if collapses(n)]
    assert collapsed  # some outlines fell on one node, and were passed over
    assert len(found.attempts) == len(calls) - len(collapsed)
    assert found.converged
    assert found.best.similarity >= SIMILARITY_THRESHOLD


def test_with_no_upright_outline_traced_the_tilted_ones_are_the_search() -> None:
    # Everything the upright stage traces collapses: one trace for each of
    # its placements, none to rescale from. The tilted stage goes on.
    graph = _half_grid()
    calls, trace = _collapsing(graph, lambda n: n <= TOP_PLACEMENTS)
    found = search(
        graph,
        HEART,
        LEVICO,
        3000.0,
        max_tilt_deg=MAX_TILT_DEG,
        trace=trace,
    )
    assert len(calls) > TOP_PLACEMENTS
    assert len(found.attempts) == len(calls) - TOP_PLACEMENTS
    assert found.upright is None
    assert found.upright_best is found.best
    tilts = [min(a.rotation_deg, 360.0 - a.rotation_deg) for a in found.attempts]
    assert min(tilts) > UPRIGHT_TILT_DEG


@pytest.mark.parametrize("name", ["circle", "heart"])
def test_a_search_where_every_outline_collapses_says_so(name: str) -> None:
    shape = get_shape(name)(SHAPE_POINTS)
    with pytest.raises(CollapsedShapeError, match="single road node"):
        search(_stub(3000.0), shape, LEVICO, 5000.0, max_tilt_deg=tilt_limit(name))


def test_where_nothing_here_can_be_traced_the_far_search_runs() -> None:
    # The case of 2026-10-10: a 5 km circle, one short road here. The far
    # search finds the grid from 1 km east and draws the circle there.
    source = _NearThenFar(_stub(3000.0), _grid_from_x(1000.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=5000)
    plan = plan_route(request, source)
    assert len(source.loads) == 2
    assert plan.far is not None and plan.search is plan.far
    assert plan.result.similarity >= SIMILARITY_THRESHOLD


def test_where_nothing_can_be_traced_even_far_the_shape_is_not_drawable() -> None:
    # The road 10 km east: every outline here and within 2 km collapses.
    source = _NearThenFar(_stub(10_000.0), _stub(10_000.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=5000)
    with pytest.raises(ShapeNotDrawableError) as refused:
        plan_route(request, source)
    assert isinstance(refused.value, CollapsedShapeError)
    assert str(refused.value) == (
        f"a 5 km circle cannot be drawn here, nor within "
        f"{FAR_OFFSET_M / 1000:g} km: too few roads, the shape collapses onto "
        "a single road node wherever it is placed"
    )
    assert refused.value.best_distance_m is None
    assert len(source.loads) == 2


def test_a_drawing_far_from_a_short_road_gets_a_route_as_the_api_plans_it() -> None:
    # The API's path (images.plan_request → plan_nearby): it raised the
    # ValueError from the start's own plan.
    source = _NearThenFar(_stub(3000.0), _grid_from_x(1000.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=5000)
    found = plan_nearby(ShapeJob.of_request(request), LEVICO, source, processes=False)
    assert found.chosen == 0
    assert found.plan.far is not None
    assert found.plan.result.similarity >= SIMILARITY_THRESHOLD


def test_nothing_drawable_anywhere_is_refused_as_the_api_plans_it() -> None:
    source = _NearThenFar(_stub(10_000.0), _stub(10_000.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=5000)
    with pytest.raises(ShapeNotDrawableError, match="nor within 2 km"):
        plan_nearby(ShapeJob.of_request(request), LEVICO, source, processes=False)
