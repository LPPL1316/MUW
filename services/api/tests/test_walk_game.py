"""A walk in the shape game (TASK-371 part C, ADR-0315): its metres count as
a run's, with the same checks, but it has no best times, so it never brings
a pace shape (the user's choice: «Solo i metri»). Pure: game_rules only."""

from __future__ import annotations

from test_game_rules import Runner

from shaperoute_api.game_rules import (
    RULES_VERSION,
    VEHICLE,
    WALKING,
    DistanceGoal,
    PaceGoal,
    evaluate,
    reached,
    totals_of,
)


def test_the_rules_changed_for_the_walk() -> None:
    # game_backfill computes the runs kept with rules 1 again.
    assert RULES_VERSION == 2
    assert WALKING == "walking"


def test_a_walk_counts_its_metres_without_best_times() -> None:
    # 6 km at 1.4 m/s, about 11:54 a km.
    game = evaluate(Runner().run(6_000, 1.4).fixes, [], "walking")
    assert game.counted and game.reason is None
    assert abs(game.counted_m - 6_000) <= 1
    assert game.best_s == {}


def test_a_walk_has_the_checks_of_a_run() -> None:
    # A kilometre by car in the middle: more than a tenth of it.
    fixes = Runner().run(2_000, 1.4).run(1_000, 15.0).run(2_000, 1.4).fixes
    game = evaluate(fixes, [], "walking")
    assert not game.counted and game.reason == VEHICLE


def test_a_run_saved_as_a_walk_gets_no_best_times() -> None:
    # As fast as a run: the metres count, the pace shapes stay a run's.
    fixes = Runner().run(6_000, 3.0).fixes
    walk, run = evaluate(fixes, [], "walking"), evaluate(fixes, [], "running")
    assert walk.counted_m == run.counted_m
    assert walk.best_s == {} and run.best_s != {}


def test_walks_bring_distance_shapes_never_pace_shapes() -> None:
    walk = evaluate(Runner().run(6_000, 1.4).fixes, [], "walking")
    totals = totals_of([(walk.counted_m, walk.best_s)] * 2)
    assert reached(DistanceGoal(total_m=10_000), totals)
    assert not reached(PaceGoal(distance_m=5_000, pace_s=900), totals)
