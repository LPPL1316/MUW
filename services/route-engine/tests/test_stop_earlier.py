"""Where the search gives up sooner (TASK-298, ADR-0259).

Measured trace by trace on 252 requests in seven cities, a good route can
come from any placement and as late as the last trace, so the search skips
no placement and keeps its budget. What it no longer does is trace a
placement twice at the same scale, which the secant asks for at a bound of
SCALE_RANGE: the known trace stands in, and the budget buys another one. A
search that converges gives the route of before, point for point. On the
fake town of test_kept_per_graph, which fits the shapes badly, no road
graph is read.
"""

import hashlib
from collections.abc import Sequence

import pytest
from test_kept_per_graph import TRENTO, _grid, _town

from route_engine.geo import LatLon
from route_engine.optimizer import (
    SHAPE_POINTS,
    Attempt,
    Search,
    doubled_weight,
    search,
    tilt_limit,
)
from route_engine.shapes import get_shape


def _search(graph: object, name: str, distance_m: float) -> Search:
    """The search as plan_shape calls it for a shape of the catalogue."""
    shape = tuple(get_shape(name)(SHAPE_POINTS))
    return search(
        graph,  # type: ignore[arg-type]
        shape,
        TRENTO,
        distance_m,
        max_tilt_deg=tilt_limit(name),
        doubled=doubled_weight(name),
    )


def _digest(points: Sequence[LatLon]) -> str:
    text = repr([(round(a, 9), round(b, 9)) for a, b in points])
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _repeated(attempts: Sequence[Attempt]) -> list[tuple[object, float]]:
    seen: set[tuple[object, float]] = set()
    twice = []
    for a in attempts:
        key = (a.placement, round(a.scale_m, 6))
        if key in seen:
            twice.append(key)
        seen.add(key)
    return twice


# --- No trace is repeated ---


@pytest.mark.parametrize("case", ["cat 5000", "heart 8000", "star 8000", "snail 5000"])
def test_no_trace_repeats_a_placement_at_a_scale_already_traced(case: str) -> None:
    name, distance = case.split()
    found = _search(_town(TRENTO), name, float(distance))
    assert _repeated(found.attempts) == []


def test_the_known_trace_stands_in_for_the_repeated_one() -> None:
    """The secant asks for the bound of SCALE_RANGE again: the run goes on
    as before, with the trace it already has, and the budget buys another
    trace instead. The cat at 5 km in the town traced one scale twice: 30
    traces, 29 distinct; now 30 distinct."""
    found = _search(_town(TRENTO), "cat", 5000.0)
    assert not found.converged
    assert len(found.attempts) == 30
    assert _repeated(found.attempts) == []


# --- A search that converges gives the route of before ---

# `_digest` of the best route, as `main` at bd4ccafc found it, before the
# change: the same searches, trace for trace, until the good route.
BEFORE = {
    "town moon 8000": ("815cd83577417d8f", 20),
    "town snail 8000": ("9d295b3bb0709b12", 13),
    "grid heart 5000": ("38510f70f8e6ca9c", 2),
    "grid snail 3000": ("63ed2e2fac30649c", 8),
}


@pytest.mark.parametrize("case", sorted(BEFORE))
def test_a_search_that_converges_gives_the_route_of_before(case: str) -> None:
    where, name, distance = case.split()
    graph = _town(TRENTO) if where == "town" else _grid(TRENTO, 60.0, 3000.0)
    found = _search(graph, name, float(distance))
    digest, traces = BEFORE[case]
    assert found.converged
    assert (_digest(found.best.route.points), len(found.attempts)) == (digest, traces)
