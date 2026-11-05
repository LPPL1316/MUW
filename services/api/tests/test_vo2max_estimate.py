"""The VO₂ max MuW estimates from the running bests (TASK-397, ADR-0332,
point 3): Daniels and Gilbert's VDOT, the highest of the bests."""

from __future__ import annotations

from datetime import date

import pytest

from shaperoute_api.vo2max_estimate import (
    DISTANCES,
    Estimate,
    RecentBest,
    estimate,
    rounded,
    vdot,
)

DAY = date(2026, 10, 12)


@pytest.mark.parametrize(
    ("metres", "seconds", "expected"),
    [
        # Daniels's tables, VDOT 50: 5K 19:57, 10K 41:21, marathon 3:10:49.
        (5_000, 19 * 60 + 57, 50.0),
        (10_000, 41 * 60 + 21, 50.0),
        (42_195, 3 * 3600 + 10 * 60 + 49, 50.0),
        # VDOT 60: 5K 17:03.
        (5_000, 17 * 60 + 3, 60.0),
    ],
)
def test_the_formula_gives_daniels_tables(
    metres: float, seconds: int, expected: float
) -> None:
    assert vdot(metres, seconds) == pytest.approx(expected, abs=0.3)


def test_a_5k_in_20_minutes_is_50() -> None:
    assert vdot(5_000, 20 * 60) == pytest.approx(49.8, abs=0.05)
    assert estimate([RecentBest("5k", 20 * 60, DAY)]) == Estimate(50, "5k", DAY)


def test_half_up_as_one_reads_it() -> None:
    assert (rounded(49.5), rounded(49.49), rounded(50.0)) == (50, 49, 50)


def test_the_highest_best_wins_and_says_where_it_comes_from() -> None:
    later = date(2026, 10, 30)
    found = estimate(
        [
            RecentBest("5k", 22 * 60, DAY),  # 45
            RecentBest("10k", 41 * 60 + 21, later),  # 50
            RecentBest("half", 100 * 60, DAY),  # 45
        ]
    )
    assert found == Estimate(50, "10k", later)


def test_between_two_equal_values_the_shorter_distance() -> None:
    found = estimate(
        [
            RecentBest("marathon", 3 * 3600 + 10 * 60 + 49, DAY),
            RecentBest("5k", 19 * 60 + 57, DAY),
        ]
    )
    assert found is not None and found.distance == "5k"


def test_the_60k_and_the_bike_distances_are_left_out() -> None:
    assert "60k" not in DISTANCES
    assert estimate([RecentBest("60k", 4 * 3600, DAY)]) is None
    assert estimate([RecentBest("40k", 3600, DAY)]) is None


def test_no_best_no_estimate() -> None:
    assert estimate([]) is None


def test_a_number_outside_20_to_90_is_no_estimate() -> None:
    # A 5K in 12:30 is 86, kept; in 11:00 it is 100, past any runner.
    assert estimate([RecentBest("5k", 12 * 60 + 30, DAY)]) is not None
    assert estimate([RecentBest("5k", 11 * 60, DAY)]) is None
    # A marathon walked in nine hours is under 20.
    assert estimate([RecentBest("marathon", 9 * 3600, DAY)]) is None
