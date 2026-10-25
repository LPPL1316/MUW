"""The far search starts only where nothing near the start can be drawn
(TASK-203 B, ADR-0230).

It used to start whenever the search near the start found no good route
(ADR-0040): half the time of a long request, and on fifteen requests in
six cities it gave a better route in one. Now a route near the start that
is drawable, good or not, keeps it out: the request is faster, and the
shape stays where the user is. Where nothing near can be drawn it runs as
before, and wins with any drawable route.
"""

import pytest
from test_kept_per_graph import NearbyPlan, _digest, _plan
from test_optimizer import LEVICO, _grid_from_x

from route_engine.geo import haversine_m
from route_engine.models import RouteRequest
from route_engine.optimizer import (
    FAR_OFFSET_M,
    MIN_SIMILARITY,
    SIMILARITY_THRESHOLD,
    START_OFFSET_M,
    plan_route,
)


class _Counting:
    """A graph source that hands out one graph and counts the loads."""

    def __init__(self, graph: object) -> None:
        self.graph = graph
        self.loads = 0

    def load(self, bbox: tuple[float, float, float, float]) -> object:
        self.loads += 1
        return self.graph


def test_a_drawable_route_near_the_start_keeps_the_far_search_out() -> None:
    # Roads only from 700 m east: a 3 km circle through the start moved the
    # most, 500 m, still has an arc on empty ground (0.76): drawable, not
    # good. From 1 km east it would be whole, and before the far search
    # went there (1.00); now the route stays within 500 m of the user.
    source = _Counting(_grid_from_x(700.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=3000)
    plan = plan_route(request, source)
    assert plan.far is None
    assert plan.search is not None and not plan.search.converged
    assert MIN_SIMILARITY <= plan.result.similarity < SIMILARITY_THRESHOLD
    assert plan.search.best.offset_m <= START_OFFSET_M
    # The route begins on the first road, 700 m east, not 1 km away.
    assert haversine_m(LEVICO, plan.result.points[0]) <= 700.0 + 50.0
    assert source.loads == 1  # the far graph is never read


def test_the_far_search_still_runs_where_nothing_near_can_be_drawn() -> None:
    # Roads only from 1 km east: within 500 m the circle is below
    # MIN_SIMILARITY, so the far search runs as before and finds it whole.
    source = _Counting(_grid_from_x(1000.0))
    request = RouteRequest(start=LEVICO, shape="circle", distance_m=3000)
    plan = plan_route(request, source)
    assert plan.far is not None and plan.search is plan.far
    assert plan.result.similarity >= SIMILARITY_THRESHOLD
    moved = haversine_m(LEVICO, plan.result.points[0])
    assert 1000.0 - 50.0 <= moved <= FAR_OFFSET_M + 50.0
    assert source.loads == 2


# The routes of test_kept_per_graph's town that the far search used to move
# 1-2 km away: the start's own route now, drawable but not good, or a nearby
# start's. `_digest` of plan_nearby as the API plans it (processes=False):
# the chosen route, its alternatives and every start's score and note.
# The digests are those of test_kept_per_graph.BEFORE: since TASK-298 the
# alternatives of the two plans come out otherwise (ADR-0259), the chosen
# route and its start do not.
AFTER: dict[str, tuple[str, int, float]] = {
    # Before: 9441bb1743c10811, 0.912 from the start moved by the far search.
    "town heart 8000": ("75d03ac7576dc1cd", 1, 0.819),
    # Before: 7f7106f7b85e4a4a, 0.935 from the start moved by the far search.
    "town star 5000": ("503c08c226103dce", 0, 0.831),
}


@pytest.mark.parametrize("case", sorted(AFTER))
def test_the_town_routes_stay_near_the_start(case: str) -> None:
    digest, chosen, similarity = AFTER[case]
    found: NearbyPlan = _plan(case)
    assert _digest(found) == digest
    assert found.chosen == chosen
    assert found.plan.result.similarity == pytest.approx(similarity, abs=0.0005)
    own = found.tried[0].plan
    assert own is not None and own.far is None  # the far search did not run
    assert own.search is not None and not own.search.converged
    assert MIN_SIMILARITY <= own.result.similarity < SIMILARITY_THRESHOLD
