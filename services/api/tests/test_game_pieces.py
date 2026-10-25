"""The outline of a shape cut into the pieces of a challenge (TASK-296 part
C, ADR-0255, docs/GIOCO.md §6.2): pure, from the shape and N, the same on
the phone and on the server."""

from __future__ import annotations

import math

import pytest

from shaperoute_api.game_catalog import CATALOG
from shaperoute_api.game_rules import OUTLINE_DECIMALS, pieces_of

SQUARE = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]


def length_of(points: list[tuple[float, float]]) -> float:
    return sum(
        math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
        for (x0, y0), (x1, y1) in zip(points, points[1:], strict=False)
    )


def test_a_square_in_four_is_its_sides() -> None:
    assert pieces_of(SQUARE, 4) == [
        [(0.0, 0.0), (1.0, 0.0)],
        [(1.0, 0.0), (1.0, 1.0)],
        [(1.0, 1.0), (0.0, 1.0)],
        [(0.0, 1.0), (0.0, 0.0)],
    ]


def test_a_cut_inside_a_side_is_interpolated() -> None:
    pieces = pieces_of(SQUARE, 8)
    assert pieces[0] == [(0.0, 0.0), (0.5, 0.0)]
    assert pieces[1] == [(0.5, 0.0), (1.0, 0.0)]
    assert pieces[5] == [(0.5, 1.0), (0.0, 1.0)]


def test_a_piece_keeps_the_corners_it_runs_through() -> None:
    assert pieces_of(SQUARE, 2) == [
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)],
        [(1.0, 1.0), (0.0, 1.0), (0.0, 0.0)],
    ]


def test_one_piece_is_the_whole_outline() -> None:
    assert pieces_of(SQUARE, 1) == [SQUARE]


def test_a_cut_on_a_corner_lists_the_corner_once_in_each_piece() -> None:
    # Six pieces of two thirds of a side: the second runs through a corner,
    # the third ends on one and the fourth starts there.
    pieces = pieces_of(SQUARE, 6)
    assert pieces[1] == [(0.6667, 0.0), (1.0, 0.0), (1.0, 0.3333)]
    assert pieces[2] == [(1.0, 0.3333), (1.0, 1.0)]
    assert pieces[3] == [(1.0, 1.0), (0.3333, 1.0)]


@pytest.mark.parametrize("n", [2, 3, 5, 7, 12])
def test_every_shape_of_the_catalog_cuts_into_equal_pieces(n: int) -> None:
    for shape in CATALOG:
        pieces = pieces_of(shape.outline, n)
        assert len(pieces) == n
        whole = length_of(list(shape.outline))
        for piece in pieces:
            assert len(piece) >= 2
            # Rounded ends move a piece by a few units of the last decimal.
            assert length_of(piece) == pytest.approx(whole / n, abs=1e-3)
            assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in piece)
            assert all(
                round(x, OUTLINE_DECIMALS) == x and round(y, OUTLINE_DECIMALS) == y
                for x, y in piece
            )
        # The pieces join end to end, and close the outline.
        for before, after in zip(pieces, pieces[1:], strict=False):
            assert before[-1] == after[0]
        assert pieces[-1][-1] == pieces[0][0]


def test_the_pieces_join_end_to_end_and_cover_the_outline() -> None:
    outline = CATALOG[4].outline  # the star
    pieces = pieces_of(outline, 5)
    covered = [pieces[0][0]]
    for piece in pieces:
        covered += piece[1:]
    rounded = [
        (round(x, OUTLINE_DECIMALS), round(y, OUTLINE_DECIMALS)) for x, y in outline
    ]
    # Every point of the outline is in the pieces, in order (the cuts add
    # points between them).
    it = iter(covered)
    assert all(point in it for point in rounded)


def test_fewer_than_one_piece_is_refused() -> None:
    with pytest.raises(ValueError):
        pieces_of(SQUARE, 0)


def test_an_outline_of_one_point_gives_pieces_of_that_point() -> None:
    assert pieces_of([(0.5, 0.5)], 3) == [[(0.5, 0.5), (0.5, 0.5)]] * 3
