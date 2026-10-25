"""The rules of the shape game, pure (TASK-296 part A, ADR-0255,
docs/GIOCO.md §3–§5): runs drawn by hand along a meridian at known speeds,
so every metre and second is known before the rules count them."""

from __future__ import annotations

import pytest
from route_engine.geo import haversine_m

from shaperoute_api.game_rules import (
    DAILY_CAP_M,
    MAX_PROGRESS,
    NOT_RUNNING,
    VEHICLE,
    DistanceGoal,
    Fix,
    PaceGoal,
    RunPause,
    Totals,
    capped_m,
    evaluate,
    moving_clock,
    progress,
    reached,
    totals_of,
)

START = (46.0, 11.0)
# Metres in a degree of latitude, as haversine_m counts them.
M_PER_DEG = haversine_m((0.0, 0.0), (1.0, 0.0))


def fix_at(metres: float, t_s: float) -> Fix:
    """`metres` north of START."""
    return Fix(START[0] + metres / M_PER_DEG, START[1], t_s)


class Runner:
    """A track written leg by leg: so many metres at so many m/s, a fix
    every `every_s` seconds."""

    def __init__(self) -> None:
        self.fixes = [fix_at(0.0, 0.0)]

    @property
    def at(self) -> tuple[float, float]:
        last = self.fixes[-1]
        return (last.lat - START[0]) * M_PER_DEG, last.t_s

    def run(self, metres: float, speed_mps: float, every_s: float = 2.0) -> Runner:
        start_m, start_s = self.at
        steps = round(metres / (speed_mps * every_s))
        for k in range(1, steps + 1):
            self.fixes.append(
                fix_at(
                    start_m + metres * k / steps,
                    start_s + metres / speed_mps * k / steps,
                )
            )
        return self

    def stand(self, seconds: float, every_s: float = 2.0) -> Runner:
        start_m, start_s = self.at
        for k in range(1, round(seconds / every_s) + 1):
            self.fixes.append(fix_at(start_m, start_s + every_s * k))
        return self

    def jump(self, metres: float, seconds: float) -> Runner:
        """One step: no fix for `seconds`."""
        start_m, start_s = self.at
        self.fixes.append(fix_at(start_m + metres, start_s + seconds))
        return self


def test_a_steady_run_counts_whole_with_its_best_times() -> None:
    # 6 km at 3 m/s: 5:33 a kilometre.
    game = evaluate(Runner().run(6_000, 3.0).fixes, [], "running")
    assert game.counted and game.reason is None
    assert game.counted_m == 6_000
    assert game.best_s == {1_000: 333.3, 5_000: 1666.7}
    assert game.elapsed_s == pytest.approx(2_000)


@pytest.mark.parametrize("activity", ["cycling", "paddling"])
def test_only_runs_on_foot_count(activity: str) -> None:
    game = evaluate(Runner().run(6_000, 3.0).fixes, [], activity)
    assert not game.counted and game.reason == NOT_RUNNING
    assert game.counted_m == 0 and game.best_s == {}


def test_a_vehicle_stretch_of_more_than_a_tenth_voids_the_run() -> None:
    # 1 km at 9 m/s in a run of 6: a sixth of it.
    fixes = Runner().run(2_500, 3.0).run(1_000, 9.0).run(2_500, 3.0).fixes
    game = evaluate(fixes, [], "running")
    assert not game.counted and game.reason == VEHICLE
    assert game.counted_m == 0 and game.best_s == {}


def test_a_short_vehicle_stretch_is_left_out() -> None:
    # 300 m at 8 m/s in 6 km: 5 %, the run counts without it.
    fixes = Runner().run(3_000, 3.0).run(300, 8.0).run(2_700, 3.0).fixes
    game = evaluate(fixes, [], "running")
    assert game.counted
    # The stretch, and at most a few steps around it that its windows hold.
    assert 5_650 <= game.counted_m <= 5_700
    # The best times never cross it: each side is run at 3 m/s.
    assert game.best_s == {1_000: 333.3}


def test_seven_metres_a_second_is_still_a_runner() -> None:
    fixes = Runner().run(1_500, 6.9).fixes
    game = evaluate(fixes, [], "running")
    assert game.counted and game.counted_m == 1_500
    assert game.best_s == {1_000: pytest.approx(144.9, abs=0.1)}


def test_a_fast_mean_over_three_km_voids_the_run() -> None:
    # 6.5 m/s (2:34 a km): no stretch above 7, but a vehicle's mean.
    game = evaluate(Runner().run(4_000, 6.5).fixes, [], "running")
    assert not game.counted and game.reason == VEHICLE


def test_a_fast_mean_under_three_km_still_counts() -> None:
    game = evaluate(Runner().run(2_500, 6.5).fixes, [], "running")
    assert game.counted and game.counted_m == 2_500


def test_a_gap_counts_in_the_metres_but_breaks_the_best_times() -> None:
    # 40 s without a fix, at the runner's speed, half way.
    fixes = Runner().run(2_940, 3.0).jump(120, 40).run(2_940, 3.0).fixes
    game = evaluate(fixes, [], "running")
    assert game.counted and game.counted_m == 6_000
    # No 5 km without the gap.
    assert game.best_s == {1_000: 333.3}


def test_a_step_across_a_pause_asked_for_is_not_run() -> None:
    # The runner paused, then 500 m away: that step is not run.
    runner = Runner().run(3_000, 3.0)
    paused_at = runner.at[1]
    fixes = runner.jump(500, 300).run(3_000, 3.0).fixes
    pauses = [RunPause(paused_at, paused_at + 300, auto=False)]
    game = evaluate(fixes, pauses, "running")
    assert game.counted and game.counted_m == 6_000
    assert 5_000 not in game.best_s


def test_an_auto_pause_is_left_out_of_the_best_times() -> None:
    # 1.5 km with a minute standing still half way: every kilometre
    # crosses the stop.
    runner = Runner().run(750, 3.0)
    stop_at = runner.at[1]
    fixes = runner.stand(60).run(750, 3.0).fixes
    standing = evaluate(fixes, [], "running")
    assert standing.best_s == {1_000: pytest.approx(393.3, abs=0.1)}
    paused = evaluate(fixes, [RunPause(stop_at, stop_at + 60, auto=True)], "running")
    assert paused.best_s == {1_000: 333.3}
    assert paused.counted_m == standing.counted_m == 1_500


def test_a_sparse_track_has_no_best_times() -> None:
    # A fix every 15 s: under the gap, over the density a best time needs.
    game = evaluate(Runner().run(3_000, 3.0, every_s=15).fixes, [], "running")
    assert game.counted and game.counted_m == 3_000
    assert game.best_s == {}


def test_a_run_of_one_fix_counts_nothing() -> None:
    game = evaluate([fix_at(0, 0)], [], "running")
    assert game.counted and game.counted_m == 0 and game.best_s == {}


def test_the_moving_clock_leaves_out_every_pause_once() -> None:
    pauses = [
        RunPause(10, 20, auto=True),
        RunPause(15, 30, auto=False),  # overlaps the first
        RunPause(50, 60, auto=True),
    ]
    # 10–30 once, then 50–60: at 55 s, 55 - 20 - 5.
    assert moving_clock([0, 10, 15, 30, 40, 55, 70], pauses) == [
        0, 10, 10, 10, 20, 30, 40
    ]  # fmt: skip


def test_a_pause_before_the_first_fix_takes_nothing() -> None:
    assert moving_clock([5, 10], [RunPause(0, 3, auto=True)]) == [0, 5]


# --- Shapes ---

FIVE_KM = DistanceGoal(5_000)
FAST_KM = PaceGoal(1_000, 300)


def test_the_totals_add_the_metres_and_keep_the_best() -> None:
    totals = totals_of(
        [(6_000, {1_000: 333.3, 5_000: 1666.7}), (2_000, {1_000: 290.0})]
    )
    assert totals == Totals(8_000, {1_000: 290.0, 5_000: 1666.7}, 6_000)


def test_a_distance_goal_is_reached_by_the_total() -> None:
    assert not reached(FIVE_KM, Totals(4_999, {}, 4_999))
    assert reached(FIVE_KM, Totals(5_000, {}, 2_500))


def test_a_pace_goal_is_reached_by_one_best_time() -> None:
    assert FAST_KM.target_s == 300
    assert not reached(FAST_KM, Totals(9_000, {1_000: 300.1}, 9_000))
    assert reached(FAST_KM, Totals(9_000, {1_000: 300.0}, 9_000))


def test_the_half_marathon_target_is_exact() -> None:
    assert PaceGoal(21_097, 360).target_s == pytest.approx(7594.92)


def test_progress_of_a_distance_goal() -> None:
    assert progress(DistanceGoal(20_000), Totals(14_200, {}, 6_000)) == 0.71
    # Never full before it is reached.
    assert progress(DistanceGoal(20_000), Totals(19_999, {}, 6_000)) == MAX_PROGRESS
    assert progress(DistanceGoal(20_000), Totals(20_000, {}, 6_000)) == 1.0


def test_progress_of_a_pace_goal() -> None:
    # Best 5:22 against 5:00.
    assert progress(FAST_KM, Totals(9_000, {1_000: 322.0}, 9_000)) == pytest.approx(
        0.9317, abs=1e-4
    )
    # Never a kilometre in one go: the longest run against it.
    assert progress(FAST_KM, Totals(1_200, {}, 600)) == 0.6
    assert progress(FAST_KM, Totals(0, {}, 0)) == 0.0


def test_the_day_counts_up_to_its_cap() -> None:
    assert capped_m(10_000, 0) == 10_000
    assert capped_m(30_000, DAILY_CAP_M - 20_000) == 20_000
    assert capped_m(5_000, DAILY_CAP_M) == 0
