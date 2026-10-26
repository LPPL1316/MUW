"""Tests for sample_logos.py: the logos and what the engine makes of them
with the pen up (TASK-297 part C, ADR-0258); and the pictures of «Draw»,
traced with the pen down point for point as before."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence

import pytest
from route_engine.image_outline import MAX_SUBJECT_POINTS, outline_data
from route_engine.pieces import compose
from route_engine.shapes.outline import parse_outline
from sample_logos import LOGOS, NAMES, drawn, traced
from sample_pictures import PICTURES
from sample_pictures import drawn as drawn_picture
from shapely.geometry import Polygon

# The pieces each logo gives with the pen up: the subjects after the first,
# and the holes worth HOLE_SHARE of their subject, the largest first.
PIECES = {
    "ring_star": 2,  # the hole of the ring, then the star inside it
    "badge_band": 1,  # the lower part of the shield
    "peaks_sun": 1,  # the sun
    "rc_letters": 2,  # the C, then the eye of the R
    "three_bars": 2,  # the other two bars
    "shoe_swoosh": 1,  # the swoosh
    "wheel": 4,  # the four holes between the spokes
    "muw": 2,  # the other two letters
}
# The strokes each logo gives with the pen down, as before: a stem and a
# loop for each subject apart; nothing for a hole, nor for what is inside it.
STROKES = {
    "ring_star": 0,
    "badge_band": 1,
    "peaks_sun": 1,
    "rc_letters": 1,
    "three_bars": 2,
    "shoe_swoosh": 1,
    "wheel": 0,
    "muw": 2,
}

# The outline of each picture of «Draw» with the pen down, as the engine
# traced it before TASK-297 (sha256 of its JSON with the keys sorted, 16 hex
# digits) on the Mac (Python 3.12, shapely 2.1.2, Pillow 12.3, NumPy 2.5):
# without `pen_up` nothing changes, point for point.
BEFORE = {
    "dinosaur": "1d059aacdf1374d4",
    "mushroom": "e3e728f0d79802b8",
    "car": "b0bcae4a353aafdc",
    "eiffel_tower": "338d70c50ad8193f",
    "t_shirt": "b10f4901e8868b6e",
    "plane": "c95658637367d1f2",
    "boot": "0c465baca9f75277",
    "guitar": "c0764e4ece408ca2",
    "house": "8d741ff85ff939e3",
    "balloon": "3b946bef7c6309e3",
    "duck": "462d3f4e4f94409e",
    "trophy": "63f058c1d5251425",
    "bone": "ad9c43501c143e46",
    "rocket": "0038fa28525e7960",
    "running_shoe": "4dceeeace48beb87",
    "leaf": "c65fb70e47fc5734",
}
# With the pen up, the pieces of the pictures of «Draw»: each is one
# subject, so only its holes worth HOLE_SHARE (3 %) of it.
PICTURE_PIECES = {
    "dinosaur": 0,
    "mushroom": 0,  # three spots, each under 3 % of the mushroom
    "car": 2,  # the windows; the hubs of the wheels are under 3 %
    "eiffel_tower": 0,
    "t_shirt": 0,
    "plane": 0,
    "boot": 0,
    "guitar": 1,  # the sound hole
    "house": 0,
    "balloon": 0,
    "duck": 0,  # the eye is under 3 %
    "trophy": 2,  # the handles
    "bone": 0,
    "rocket": 0,  # the window is under 3 %
    "running_shoe": 0,
    "leaf": 0,  # the veins are under 3 %
}


def _ring(points: Sequence[Sequence[float]]) -> Polygon:
    return Polygon([(x, y) for x, y in points])


def _pieces(data: dict[str, object]) -> list[Polygon]:
    pieces = data.get("pieces", [])
    assert isinstance(pieces, list)
    return [_ring(piece) for piece in pieces]


def test_the_eight_logos_in_their_order() -> None:
    assert NAMES == (
        "ring_star",
        "badge_band",
        "peaks_sun",
        "rc_letters",
        "three_bars",
        "shoe_swoosh",
        "wheel",
        "muw",
    )
    assert list(LOGOS) == list(NAMES[:-1])


@pytest.mark.parametrize("name", NAMES)
def test_a_logo_gives_its_pieces_with_the_pen_up(name: str) -> None:
    data = traced(drawn(name), pen_up=True)
    pieces = data.get("pieces", [])
    assert isinstance(pieces, list)
    assert len(pieces) == PIECES[name]
    assert "strokes" not in data
    assert sum(len(piece) for piece in pieces) <= MAX_SUBJECT_POINTS
    # Every piece is closed and apart from the others.
    rings = _pieces(data)
    assert all(piece[0] == piece[-1] for piece in pieces)
    assert all(not a.crosses(b) for i, a in enumerate(rings) for b in rings[i + 1 :])
    # The pieces pass the checks of a shape in pieces, and compose as one
    # line with the pen up: the outline, then each piece.
    outline = parse_outline(data)
    assert outline.in_pieces
    word = compose(outline, name)
    assert word.pen_up and word.kind == "piece"
    assert len(word.letters) == PIECES[name] + 1


@pytest.mark.parametrize("name", NAMES)
def test_with_the_pen_down_a_logo_is_traced_as_before(name: str) -> None:
    data = traced(drawn(name), pen_up=False)
    assert "pieces" not in data
    strokes = data.get("strokes", [])
    assert isinstance(strokes, list)
    assert len(strokes) == STROKES[name]
    assert data == traced(drawn(name), pen_up=False)


def test_the_ring_with_the_star_gives_the_hole_then_the_star_inside_it() -> None:
    data = traced(drawn("ring_star"), pen_up=True)
    outline = _ring(data["points"])  # type: ignore[arg-type]
    hole, star = _pieces(data)
    assert outline.contains(hole) and hole.contains(star)
    assert hole.area > star.area
    # A star is spiky: its hull is well larger than it.
    assert star.convex_hull.area > 1.4 * star.area


def test_the_letters_rc_give_the_c_then_the_eye_of_the_r() -> None:
    data = traced(drawn("rc_letters"), pen_up=True)
    r = _ring(data["points"])  # type: ignore[arg-type]
    c, eye = _pieces(data)
    assert r.contains(eye) and not r.intersects(c)
    assert c.area > eye.area >= 0.03 * r.area


def test_the_wheel_gives_the_four_holes_between_the_spokes() -> None:
    data = traced(drawn("wheel"), pen_up=True)
    rim = _ring(data["points"])  # type: ignore[arg-type]
    holes = _pieces(data)
    assert len(holes) == 4
    assert all(rim.contains(hole) for hole in holes)
    assert all(not a.intersects(b) for i, a in enumerate(holes) for b in holes[i + 1 :])
    areas = sorted(hole.area for hole in holes)
    assert areas[-1] < 1.2 * areas[0]


def test_the_muw_wordmark_is_three_letters_apart() -> None:
    data = traced(drawn("muw"), pen_up=True)
    first = _ring(data["points"])  # type: ignore[arg-type]
    others = _pieces(data)
    assert len(others) == 2
    # Beside the first letter, not inside it: no letter has a hole.
    assert all(not first.intersects(other) for other in others)


@pytest.mark.parametrize("name", list(PICTURES))
def test_a_picture_of_draw_is_traced_as_before_with_the_pen_down(name: str) -> None:
    png = drawn_picture(name)
    data = outline_data(png, name=name, source="x")
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    assert digest[:16] == BEFORE[name]
    assert data == outline_data(png, name=name, source="x", pen_up=False)


@pytest.mark.parametrize("name", list(PICTURES))
def test_a_picture_of_draw_with_the_pen_up_keeps_the_holes_worth_drawing(
    name: str,
) -> None:
    data = outline_data(drawn_picture(name), name=name, source="x", pen_up=True)
    holes = _pieces(data)
    assert len(holes) == PICTURE_PIECES[name]
    outline = _ring(data["points"])  # type: ignore[arg-type]
    assert all(outline.contains(hole) for hole in holes)
    parse_outline(data)
