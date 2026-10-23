"""The shapes of the game (TASK-296 part A, ADR-0255, docs/GIOCO.md §5.3):
the user's examples are in it, every shape has its five names and a closed
outline on the card, and every pace asks a distance the rules time."""

from __future__ import annotations

from shaperoute_api.game_catalog import BY_ID, CATALOG, LANGUAGES
from shaperoute_api.game_rules import BEST_DISTANCES_M, DistanceGoal, PaceGoal


def test_the_user_examples_are_in_the_catalog() -> None:
    # The request of 2026-10-23: 5 km a triangle, 20 km a hexagon, 100 km a
    # star; 1 km under 5:00, 5 km under 5:30.
    assert BY_ID["triangle"].goal == DistanceGoal(5_000)
    assert BY_ID["hexagon"].goal == DistanceGoal(20_000)
    assert BY_ID["star"].goal == DistanceGoal(100_000)
    assert BY_ID["lightning"].goal == PaceGoal(1_000, 300)
    assert BY_ID["diamond"].goal == PaceGoal(5_000, 330)


def test_each_shape_once_with_its_names() -> None:
    assert len(BY_ID) == len(CATALOG) == 12
    for shape in CATALOG:
        assert set(shape.names) == set(LANGUAGES)
        assert all(name.strip() for name in shape.names.values())


def test_each_outline_is_closed_on_the_card() -> None:
    for shape in CATALOG:
        outline = shape.outline
        assert len(outline) >= 4, shape.id
        assert outline[0] == outline[-1], shape.id
        assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in outline), shape.id


def test_the_triangle_points_up() -> None:
    # y grows downwards: the top corner has the smallest y.
    top = min(BY_ID["triangle"].outline, key=lambda p: p[1])
    assert top == (0.5, 0.0)


def test_every_pace_asks_a_timed_distance() -> None:
    for shape in CATALOG:
        if isinstance(shape.goal, PaceGoal):
            assert shape.goal.distance_m in BEST_DISTANCES_M, shape.id


def test_the_distance_shapes_grow_in_order() -> None:
    totals = [s.goal.total_m for s in CATALOG if isinstance(s.goal, DistanceGoal)]
    assert totals == sorted(totals)
