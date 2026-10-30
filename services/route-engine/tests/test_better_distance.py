"""The distance where the shape comes out better (TASK-234, ADR-0197).

From the attempts the search has already traced: fake ones here, whose
cost is the search's own formula, and a real search on a street grid with
one more attempt added, through plan_route and a nearby start's plan.
"""

import json
from dataclasses import dataclass, fields, replace
from pathlib import Path
from typing import Any

import pytest
from test_nearby_starts import ORIGIN, GridSource, LoopJob, _grid, _latlon
from test_optimizer import LEVICO, _half_grid, _Loader

from route_engine import nearby_starts, optimizer
from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import RouteRequest, RouteResult
from route_engine.nearby_starts import ShapeJob, plan_nearby
from route_engine.network import NetworkRoute
from route_engine.optimizer import (
    BETTER_MARGIN,
    SIMILARITY_THRESHOLD,
    START_OFFSET_M,
    W_DISTANCE,
    W_OFFSET,
    W_SHAPE,
    Attempt,
    Placement,
    Plan,
    Search,
    better_distance,
    plan_route,
    shape_cost,
)
from route_engine.pieces import compose_shape
from route_engine.words import compose

FIXTURES = Path(__file__).resolve().parents[3] / "packages/shared-types/fixtures"


def _attempt(
    similarity: float,
    ratio: float,
    *,
    offset_m: float = 0.0,
    doubled: float = 0.0,
    planned_m: float = 15_000.0,
) -> Attempt:
    """An attempt as search() scores it, without tracing anything."""
    cost = (
        W_SHAPE * (1 - similarity)
        + W_DISTANCE * abs(ratio - 1)
        + W_OFFSET * offset_m / START_OFFSET_M
        + doubled
    )
    route = NetworkRoute([LEVICO, LEVICO], planned_m * ratio)
    placement = Placement(LEVICO, offset_m, 0.0, 0.0)
    return Attempt(placement, 1.0, [LEVICO], route, similarity, ratio, cost)


def _found(best: Attempt, *others: Attempt) -> Search:
    return Search(best, [best, *others], converged=True)


CHOSEN = _attempt(0.85, 1.0)  # 15 km, a shape cost of 0.45


def test_a_clearly_better_attempt_at_another_distance_is_advised() -> None:
    found = _found(CHOSEN, _attempt(0.95, 0.8))  # 12 km, a shape cost of 0.15
    assert better_distance(found, 15_000) == 12_000


def test_the_cost_without_the_distance_part_is_what_is_compared() -> None:
    attempt = _attempt(0.95, 0.8, doubled=0.1)
    assert shape_cost(attempt) == pytest.approx(W_SHAPE * 0.05 + 0.1)
    assert BETTER_MARGIN == pytest.approx(W_SHAPE * 0.05)


def test_better_by_exactly_the_margin_is_enough() -> None:
    found = _found(_attempt(0.90, 1.0), _attempt(0.95, 0.8))
    assert better_distance(found, 15_000) == 12_000


def test_an_attempt_only_a_little_better_is_not_advised() -> None:
    found = _found(_attempt(0.91, 1.0), _attempt(0.95, 0.8))
    assert better_distance(found, 15_000) is None


def test_an_attempt_below_the_similarity_threshold_is_not_advised() -> None:
    found = _found(_attempt(0.70, 1.0), _attempt(0.89, 0.8))
    assert 0.89 < SIMILARITY_THRESHOLD
    assert better_distance(found, 15_000) is None


def test_an_attempt_with_streets_run_twice_or_a_far_start_is_not_better() -> None:
    whisker = _attempt(0.97, 0.8, doubled=0.4)
    far = _attempt(0.97, 0.8, offset_m=2000.0)
    assert better_distance(_found(CHOSEN, whisker), 15_000) is None
    assert better_distance(_found(CHOSEN, far), 15_000) is None


def test_no_advice_when_it_rounds_to_the_distance_asked_for() -> None:
    found = _found(CHOSEN, _attempt(0.97, 0.98))  # 14.7 km
    assert better_distance(found, 15_000) is None


def test_the_distance_is_rounded_to_the_whole_km() -> None:
    found = _found(CHOSEN, _attempt(0.97, 0.7867))  # 11.8 km
    assert better_distance(found, 15_000) == 12_000


def test_the_distance_stays_within_the_limits_of_the_activity() -> None:
    by_bike = _attempt(0.85, 1.0, planned_m=12_000.0)
    short = _attempt(0.97, 0.7, planned_m=12_000.0)  # 8.4 km
    assert better_distance(_found(by_bike, short), 12_000, "cycling") is None
    assert better_distance(_found(by_bike, short), 12_000) == 8_000
    ride = _attempt(0.85, 1.0, planned_m=20_000.0)
    shorter = _attempt(0.97, 0.75, planned_m=20_000.0)  # 15 km
    assert better_distance(_found(ride, shorter), 20_000, "cycling") == 15_000
    tiny = _found(_attempt(0.85, 1.0, planned_m=2000.0), _attempt(0.97, 0.2))
    assert better_distance(tiny, 2000) is None  # 0 km


def test_a_word_is_not_advised_below_its_distance_a_letter() -> None:
    word = compose("CIAO")  # 4 letters, at least 12 km
    found = _found(CHOSEN, _attempt(0.97, 0.6))  # 9 km
    assert better_distance(found, 15_000, word=word) is None
    nearer = _found(CHOSEN, _attempt(0.97, 0.8))  # 12 km
    assert better_distance(nearer, 15_000, word=word) == 12_000
    # A shape in pieces has no such limit.
    pieces = compose_shape("cat")
    assert better_distance(found, 15_000, word=pieces) == 9_000


def test_of_several_the_cheapest_then_the_nearest() -> None:
    cheapest = _found(CHOSEN, _attempt(0.95, 0.8), _attempt(0.99, 0.6))
    assert better_distance(cheapest, 15_000) == 9_000
    tie = _found(CHOSEN, _attempt(0.97, 0.8), _attempt(0.97, 1.1333))
    assert better_distance(tie, 15_000) == 17_000  # 2 km away, not 3


def test_the_attempts_of_one_distance_count_by_their_best() -> None:
    # 12 km once at 0.92 and once at 0.99, beside 9 km at 0.97.
    found = _found(
        CHOSEN, _attempt(0.92, 0.8), _attempt(0.97, 0.6), _attempt(0.99, 0.81)
    )
    assert better_distance(found, 15_000) == 12_000


START = local_to_latlon(LEVICO, 1500.0, 0.0)
REQUEST = RouteRequest(start=START, shape="heart", distance_m=3000)


def test_plan_route_gives_the_advice_of_its_own_search() -> None:
    plan = plan_route(REQUEST, _Loader(_half_grid()))
    assert plan.search is not None
    advised = better_distance(plan.search, 3000)
    assert plan.result.better_distance_m == advised


def test_plan_route_advises_a_better_attempt_and_keeps_its_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    before = plan_route(REQUEST, _Loader(_half_grid())).result
    monkeypatch.setattr(optimizer, "search", _with_a_better_one(optimizer.search))
    after = plan_route(REQUEST, _Loader(_half_grid())).result
    assert after.better_distance_m == 2000  # 1.8 km
    assert after.points == before.points
    assert after.similarity == before.similarity


def _with_a_better_one(real: Any) -> Any:
    """`search` with one more attempt at 0.6 of the distance, better than
    the chosen route by exactly the margin."""

    def search(*args: object, **kwargs: object) -> Search:
        found: Search = real(*args, **kwargs)
        cost = shape_cost(found.best) - BETTER_MARGIN + W_DISTANCE * 0.4
        better = replace(found.best, similarity=0.95, ratio=0.6, cost=cost)
        return replace(found, attempts=[*found.attempts, better])

    return search


def test_a_nearby_start_gives_the_advice_of_its_own_search(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start = _latlon(_grid(), (3, -2))
    job = ShapeJob.of_request(
        RouteRequest(start=start, shape="circle", distance_m=3000)
    )
    before = job.here(start, GridSource()).result
    assert before.better_distance_m == better_distance(
        job.here(start, GridSource()).search, 3000  # type: ignore[arg-type]
    )
    monkeypatch.setattr(nearby_starts, "search", _with_a_better_one(optimizer.search))
    after = job.here(start, GridSource()).result
    assert after.better_distance_m == 2000  # 1.8 km
    assert after.points == before.points


@dataclass(frozen=True)
class _AdvisedLoopJob(LoopJob):
    """LoopJob whose every plan advises 7 km."""

    def plan(self, start: LatLon, source: Any) -> Plan:
        plan = super().plan(start, source)
        return replace(plan, result=replace(plan.result, better_distance_m=7000))

    here = plan


def test_the_advice_is_the_request_s_not_the_alternatives() -> None:
    job = _AdvisedLoopJob(similarity=(((2, 0), 0.90), ((-2, 0), 0.86)))
    found = plan_nearby(job, ORIGIN, GridSource(), count=4, processes=False)
    assert found.plan.result.better_distance_m == 7000
    assert found.plan.alternatives
    for other in found.plan.alternatives:
        assert other.result.better_distance_m is None


def test_the_contract_fixture_has_every_field_of_the_result() -> None:
    data = json.loads(
        (FIXTURES / "route-result-better-distance.json").read_text(encoding="utf-8")
    )
    # Every field of its day: the rotation came after (TASK-232), the laps
    # and the turns of a swim too (TASK-323).
    names = {f.name for f in fields(RouteResult)} - {"rotation_deg", "laps", "turns"}
    for each in (data, *data["alternatives"]):
        assert set(each) == names
    assert data["better_distance_m"] == 12_000
    assert [o["better_distance_m"] for o in data["alternatives"]] == [None]
