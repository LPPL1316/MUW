"""A placement drawn before, tried first (TASK-297 part A2, ADR-0256).

After the engine changes, the API's archive has routes drawn by the engine
of before: it gives the search the placement of one (`first`, with its
scale) and the search traces that first. The same placement from the same
start drew the same route 36 times out of 36 at Trento (ADR-0257): when it
is good the search ends there, after a trace or two. When it is not, its
traces are set aside and the search is the one without it; and without
`first` it is the search of before, trace for trace: `BEFORE` pins it, as
`main` at 5abf78d searched, before the change. On the fake towns of
test_kept_per_graph, test_tilt and test_optimizer, and the Levico fixture.
"""

import hashlib
from collections.abc import Callable, Sequence
from dataclasses import replace
from typing import Any

import pytest
from test_kept_per_graph import FIXTURE, LEVICO, TRENTO, _grid, _Source, _town
from test_optimizer import CIRCLE, _grid_from_x
from test_tilt import DISTANCE_M, HEART, _hearts

from route_engine.models import RouteRequest
from route_engine.network import FileSource, Graph, area_around
from route_engine.optimizer import (
    MAX_RESCALES,
    MAX_TILT_DEG,
    MIN_SIMILARITY,
    SHAPE_POINTS,
    START_OFFSET_M,
    UPRIGHT_TILT_DEG,
    Attempt,
    Placement,
    Search,
    doubled_weight,
    plan_route,
    plan_shape,
    search,
    tilt_limit,
)
from route_engine.shapes import get_shape
from route_engine.words import Style, compose


def _graph(where: str) -> Graph:
    if where == "grid":
        return _grid(TRENTO, 60.0, 3000.0)
    if where == "town":
        return _town(TRENTO)
    return FileSource(FIXTURE).load(area_around([LEVICO]))


def _search(case: str, **first: Any) -> Search:
    """The search as plan_shape calls it for `case`, a shape of the
    catalogue or the word «ciao»; with `first`, from there."""
    where, what, km = case.split()
    graph = _graph(where)
    start = LEVICO if where == "levico" else TRENTO
    if what == "ciao":
        word = compose("ciao", style="round")
        return search(
            graph,
            word.points,
            start,
            float(km),
            max_tilt_deg=MAX_TILT_DEG,
            phases=word.phases,
            word=word,
            **first,
        )
    return search(
        graph,
        tuple(get_shape(what)(SHAPE_POINTS)),
        start,
        float(km),
        max_tilt_deg=tilt_limit(what),
        doubled=doubled_weight(what),
        **first,
    )


def _again(found: Search) -> dict[str, Any]:
    """`first` for drawing the best route of `found` again."""
    return {"first": found.best.placement, "first_scale_m": found.best.scale_m}


def _rows(attempts: Sequence[Attempt]) -> list[tuple[object, ...]]:
    """Every trace, in order: where it was placed, at what scale, how it
    scored, its route and how its letters moved."""
    return [
        (
            round(a.placement.start[0], 9),
            round(a.placement.start[1], 9),
            a.placement.offset_m,
            a.placement.rotation_deg,
            a.placement.phase,
            round(a.scale_m, 6),
            round(a.similarity, 9),
            round(a.ratio, 9),
            [(round(x, 9), round(y, 9)) for x, y in a.route.points],
            a.shifts,
        )
        for a in attempts
    ]


def _digest(found: Search) -> str:
    """The search's traces; which was best, which best upright, whether it
    converged, and the warnings."""
    best = found.attempts.index(found.best)
    upright = None if found.upright is None else found.attempts.index(found.upright)
    text = repr((_rows(found.attempts), best, upright, found.converged, found.warnings))
    return hashlib.sha256(text.encode()).hexdigest()[:16]


# --- Without `first`, the search of before ---

# `_digest` of the search on main at 5abf78d, before the change. The town's
# heart comes out another way with the libraries of CI (Python 3.11, NumPy
# 2.4, NetworkX 3.6) than with newer ones (3.13, 2.5, 3.7), already with the
# code of before, as test_kept_per_graph's Levico heart: both are its search
# of before. The grid's heart converges at once; the others spend their
# budget, upright and tilted; the circle turns freely; «ciao» moves its
# letters (fit_letters).
BEFORE: dict[str, str | tuple[str, ...]] = {
    "grid heart 5000": "eeff83340d44bae7",
    "levico heart 1000": "fd122d1e20852ee4",
    "town heart 5000": ("417cb19096621c8c", "1cabb151250ece13"),  # CI, newer
    "town star 5000": "40a06f58f54d2659",
    "town cat 5000": "671bc212a66d021f",
    "town circle 8000": "8daaedc11a47b712",
    "town ciao 8000": "ae6c8a1dd1ea2335",
}


@pytest.mark.parametrize("case", sorted(BEFORE))
def test_without_first_the_search_is_that_of_before(case: str) -> None:
    before = BEFORE[case]
    pinned = before if isinstance(before, tuple) else (before,)
    assert _digest(_search(case)) in pinned


def test_without_first_the_plan_is_that_of_before() -> None:
    """plan_route passes `first` on, None by default: the same plan."""
    request = RouteRequest(start=TRENTO, distance_m=5000, shape="heart")
    source = _Source(_graph("grid"))
    plan = plan_route(request, source)
    assert plan.search is not None
    assert _digest(plan.search) == BEFORE["grid heart 5000"]


# --- A good placement, drawn again at once ---

# Each: the roads, the shape, its start and distance, how far it may tilt.
GOOD: dict[str, Callable[[], tuple[Any, ...]]] = {
    # Upright, from the start itself.
    "upright": lambda: (
        _grid(TRENTO, 60.0, 3000.0),
        get_shape("heart")(64),
        TRENTO,
        5000.0,
        MAX_TILT_DEG,
    ),
    # Tilted 30°, found after the upright stage gave nothing good.
    "tilted": lambda: (_hearts(30.0), HEART, LEVICO, DISTANCE_M, MAX_TILT_DEG),
    # From a start moved 500 m, where the circle closes on the roads.
    "moved start": lambda: (_grid_from_x(400.0), CIRCLE, LEVICO, 3000.0, 180.0),
}


@pytest.mark.parametrize("case", sorted(GOOD))
def test_a_good_placement_draws_the_same_route_at_once(case: str) -> None:
    graph, shape, start, distance_m, max_tilt_deg = GOOD[case]()
    found = search(graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg)
    assert found.converged
    again = search(
        graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg, **_again(found)
    )
    assert again.converged
    assert len(again.attempts) == 1
    assert again.best.placement == found.best.placement
    assert again.best.route.points == found.best.route.points
    assert again.best.similarity == found.best.similarity


def test_the_moved_start_and_the_tilt_are_drawn_again_as_they_were() -> None:
    graph, shape, start, distance_m, max_tilt_deg = GOOD["moved start"]()
    found = search(graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg)
    assert found.best.offset_m == START_OFFSET_M
    again = search(
        graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg, **_again(found)
    )
    assert again.best.offset_m == START_OFFSET_M
    assert again.best.cost == found.best.cost  # the start moved costs as before
    graph, shape, start, distance_m, max_tilt_deg = GOOD["tilted"]()
    found = search(graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg)
    assert found.best.rotation_deg == 30.0
    assert found.upright is not None  # upright first, then tilted
    again = search(
        graph, shape, start, distance_m, max_tilt_deg=max_tilt_deg, **_again(found)
    )
    assert again.best.rotation_deg == 30.0 > UPRIGHT_TILT_DEG
    assert again.upright is None and again.upright_best is again.best


@pytest.mark.parametrize("pen_up", [False, True])
@pytest.mark.parametrize("style", ["round", "block"])
def test_a_word_draws_the_same_letters_again(style: Style, pen_up: bool) -> None:
    graph = _grid(TRENTO, 60.0, 3000.0)
    word = compose("ciao", style=style, pen_up=pen_up)

    def drawn(**first: Any) -> Search:
        return search(
            graph,
            word.points,
            TRENTO,
            6000.0,
            max_tilt_deg=MAX_TILT_DEG,
            phases=word.phases,
            word=word,
            **first,
        )

    found = drawn()
    again = drawn(**_again(found))
    assert again.converged and len(again.attempts) == 1
    assert again.best.route.points == found.best.route.points
    assert again.best.route.walks == found.best.route.walks
    assert again.best.shifts == found.best.shifts


def test_without_its_scale_the_placement_starts_from_the_initial_one() -> None:
    graph = _grid(TRENTO, 60.0, 3000.0)
    heart = get_shape("heart")(64)
    found = search(graph, heart, TRENTO, 5000.0, max_tilt_deg=MAX_TILT_DEG)
    again = search(
        graph,
        heart,
        TRENTO,
        5000.0,
        max_tilt_deg=MAX_TILT_DEG,
        first=found.best.placement,
    )
    assert again.attempts[0].scale_m == found.attempts[0].scale_m
    assert again.converged and len(again.attempts) <= MAX_RESCALES


def test_plan_route_draws_again_from_the_placement() -> None:
    request = RouteRequest(start=TRENTO, distance_m=5000, shape="star")
    source = _Source(_graph("grid"))
    plan = plan_route(request, source)
    assert plan.search is not None and plan.search.converged
    best = plan.search.best
    again = plan_route(
        request, source, first=best.placement, first_scale_m=best.scale_m
    )
    assert again.search is not None and len(again.search.attempts) == 1
    assert again.result == plan.result


# --- A placement no longer good: the search of before ---


@pytest.mark.parametrize("case", ["town star 5000", "town circle 8000"])
def test_a_placement_not_good_leaves_the_search_as_it_was(case: str) -> None:
    before = _search(case)
    assert not before.converged
    # Its own best, turned a quarter and halved: drawn worse than before.
    p = before.best.placement
    worse = replace(p, rotation_deg=(p.rotation_deg + 90.0) % 360.0)
    found = _search(case, first=worse, first_scale_m=before.best.scale_m * 0.5)
    # Its traces set aside, what they cost more; then the search of before,
    # trace for trace, its best, its upright stage and its warnings.
    assert 1 <= len(found.set_aside) <= MAX_RESCALES
    assert all(a.placement == worse for a in found.set_aside)
    assert _digest(found) == _digest(before)
    assert before.set_aside == []


def test_its_own_placement_not_good_gives_the_route_of_before() -> None:
    """The town's star from its own placement: not good, so the search of
    before, which finds that star again."""
    before = _search("town star 5000")
    found = _search("town star 5000", **_again(before))
    assert found.set_aside[0].placement == before.best.placement
    assert found.set_aside[0].route.points == before.best.route.points
    assert _digest(found) == _digest(before)


def test_a_trace_set_aside_never_refuses_the_plan() -> None:
    """Rescaled towards the target, the town's circle drew a trace cheaper
    than the search's best but less alike than MIN_SIMILARITY: chosen, it
    refused the plan the search gave. Set aside, the plan is the one of
    before."""
    request = RouteRequest(start=TRENTO, distance_m=5000, shape="circle")
    source = _Source(_graph("town"))
    before = plan_route(request, source)
    assert before.search is not None and not before.search.converged
    best = before.search.best
    again = plan_route(
        request, source, first=best.placement, first_scale_m=best.scale_m
    )
    assert again.search is not None and again.search.set_aside
    assert min(a.similarity for a in again.search.set_aside) < MIN_SIMILARITY
    assert again.result == before.result


# --- What `first` may be ---


def test_a_phase_the_search_does_not_try_is_refused() -> None:
    graph = _grid(TRENTO, 60.0, 3000.0)
    with pytest.raises(ValueError, match="phase"):
        search(
            graph,
            get_shape("heart")(64),
            TRENTO,
            5000.0,
            phases=(0.0,),
            first=Placement(TRENTO, 0.0, 0.0, 0.25),
        )


def test_a_placement_from_the_search_far_away_is_refused() -> None:
    far = Placement(TRENTO, START_OFFSET_M + 500.0, 0.0, 0.0)
    with pytest.raises(ValueError, match="from the start"):
        plan_shape(
            get_shape("heart")(64),
            "heart",
            TRENTO,
            5000,
            _Source(_graph("grid")),
            first=far,
        )
