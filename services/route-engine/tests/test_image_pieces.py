"""Images with the pen up (TASK-297 part C, ADR-0258): the other subjects
and the holes are pieces of the outline, drawn one at a time with a walk
between them; without `pen_up` nothing changes."""

from __future__ import annotations

import io
import json
import math
from collections.abc import Callable, Sequence
from pathlib import Path

import pytest
from PIL import Image, ImageDraw
from shapely.geometry import Point as Disc
from shapely.geometry import Polygon
from test_cli import _GridSource

import route_engine.__main__ as cli
from route_engine.__main__ import main, parse_args, parse_request
from route_engine.image_outline import (
    HOLE_SHARE,
    MAX_SUBJECT_POINTS,
    MAX_SUBJECTS,
    InvalidImageError,
    outline_data,
    outline_from_image,
)
from route_engine.pieces import compose
from route_engine.shapes.outline import parse_outline, read_outline

WIDTH, HEIGHT = 400, 300
Xy = tuple[float, float]
Drawing = Callable[[ImageDraw.ImageDraw], None]


def _png(draw_on: Drawing, size: tuple[int, int] = (WIDTH, HEIGHT)) -> bytes:
    image = Image.new("RGB", size, "white")
    draw_on(ImageDraw.Draw(image))
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _disc(draw: ImageDraw.ImageDraw, centre: Xy, radius: float, colour: str) -> None:
    x, y = centre
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=colour)


def _ring(points: Sequence[Sequence[float]]) -> Polygon:
    """A traced line in image pixels, y downwards like the drawing."""
    return Polygon([(x, -y) for x, y in points])


def _pieces(data: dict[str, object]) -> list[Polygon]:
    pieces = data.get("pieces", [])
    assert isinstance(pieces, list)
    return [_ring(piece) for piece in pieces]


def _overlap(a: Polygon, b: Polygon) -> float:
    return a.intersection(b).area / a.union(b).area


# --- The drawings ---


def ring(draw: ImageDraw.ImageDraw) -> None:
    """A ring: a disc with a hole worth a third of it."""
    _disc(draw, (180, 150), 120, "black")
    _disc(draw, (180, 150), 70, "white")


def ring_with_a_dot(draw: ImageDraw.ImageDraw) -> None:
    ring(draw)
    _disc(draw, (180, 150), 20, "black")


def ring_dot_and_disc(draw: ImageDraw.ImageDraw) -> None:
    """The ring with its dot, and a disc beside it."""
    _disc(draw, (120, 150), 100, "black")
    _disc(draw, (120, 150), 60, "white")
    _disc(draw, (120, 150), 18, "black")
    _disc(draw, (320, 150), 50, "black")


def disc_with_a_hole(radius: float) -> Drawing:
    def drawing(draw: ImageDraw.ImageDraw) -> None:
        _disc(draw, (180, 150), 120, "black")
        _disc(draw, (180, 150), radius, "white")

    return drawing


def nested(draw: ImageDraw.ImageDraw) -> None:
    """A ring, a ring inside its hole, a dot inside that one's hole."""
    _disc(draw, (200, 150), 130, "black")
    _disc(draw, (200, 150), 95, "white")
    _disc(draw, (200, 150), 60, "black")
    _disc(draw, (200, 150), 35, "white")
    _disc(draw, (200, 150), 12, "black")


def five_discs(draw: ImageDraw.ImageDraw) -> None:
    for k in range(5):
        _disc(draw, (60 + 100 * k, 150), 35, "black")


def saws(draw: ImageDraw.ImageDraw) -> None:
    """A disc, and three saws apart from it, each with many teeth wide
    enough to survive the smoothing: too many points for the pieces
    together, and for the strokes."""
    _disc(draw, (130, 95), 80, "black")
    for base in (230, 350, 470):
        top: list[Xy] = []
        x = 40
        while x + 30 <= 620:
            top.extend([(x, base), (x + 15, base - 40)])
            x += 30
        draw.polygon([(40, base + 10), *top, (x, base), (x, base + 10)], fill="black")


# --- The pieces ---


def test_without_the_pen_up_nothing_changes() -> None:
    png = _png(ring_dot_and_disc)
    down = outline_data(png)
    assert down == outline_data(png, pen_up=False)
    assert "pieces" not in down
    # As before: the disc beside is hung as a stroke; the hole, and the
    # dot inside it, are left out of the outline.
    strokes = down["strokes"]
    assert isinstance(strokes, list) and len(strokes) == 1
    assert _ring(down["points"]).contains(Disc(120, 150))  # type: ignore[arg-type]


def test_a_hole_becomes_a_piece_inside_the_outline() -> None:
    data = outline_data(_png(ring), pen_up=True)
    assert "strokes" not in data
    [hole] = _pieces(data)
    pieces = data["pieces"]
    assert isinstance(pieces, list) and pieces[0][0] == pieces[0][-1]  # closed
    assert _overlap(hole, Disc(180, 150).buffer(70)) > 0.9
    assert _ring(data["points"]).contains(hole)  # type: ignore[arg-type]
    # The outline is the ring's outside line, as with the pen down.
    assert data["points"] == outline_data(_png(ring))["points"]


def test_a_hole_under_the_share_of_its_subject_is_left_out() -> None:
    assert HOLE_SHARE == 0.03
    # A hole of radius 17 in a disc of radius 120 is 2 % of it; 24 is 4 %.
    small = outline_data(_png(disc_with_a_hole(17)), pen_up=True)
    assert "pieces" not in small
    large = outline_data(_png(disc_with_a_hole(24)), pen_up=True)
    [hole] = _pieces(large)
    assert _overlap(hole, Disc(180, 150).buffer(24)) > 0.8


def test_a_subject_inside_a_hole_is_a_piece_after_the_hole() -> None:
    data = outline_data(_png(ring_with_a_dot), pen_up=True)
    hole, dot = _pieces(data)
    assert hole.contains(dot)
    assert _overlap(dot, Disc(180, 150).buffer(20)) > 0.8
    # With the pen down the dot is an inner line, left out (TASK-084).
    assert "strokes" not in outline_data(_png(ring_with_a_dot))


def test_the_other_subjects_are_pieces_not_strokes() -> None:
    data = outline_data(_png(ring_dot_and_disc), pen_up=True)
    assert "strokes" not in data
    hole, disc, dot = _pieces(data)
    assert _overlap(disc, Disc(320, 150).buffer(50)) > 0.9
    assert hole.contains(dot) and not hole.intersects(disc)


def test_the_pieces_go_from_the_outside_in() -> None:
    data = outline_data(_png(nested), pen_up=True)
    pieces = _pieces(data)
    assert len(pieces) == 4
    lines = [_ring(data["points"]), *pieces]  # type: ignore[arg-type]
    for outer, inner in zip(lines, lines[1:], strict=False):
        assert outer.contains(inner) and outer.area > inner.area
    assert [round(p.area / math.pi) for p in pieces] == pytest.approx(
        [95**2, 60**2, 35**2, 12**2], rel=0.12
    )


def test_the_pieces_pass_the_checks_of_a_shape_in_pieces() -> None:
    data = outline_data(_png(nested), pen_up=True)
    outline = parse_outline(data)
    assert outline.in_pieces and len(outline.pieces) == 4
    word = compose(outline, "nested")
    assert word.pen_up and word.kind == "piece"
    assert len(word.letters) == 5
    assert outline_from_image(_png(nested), pen_up=True) == outline


def test_the_same_image_gives_the_same_pieces_every_time() -> None:
    png = _png(ring_dot_and_disc)
    assert outline_data(png, pen_up=True) == outline_data(png, pen_up=True)


def test_more_subjects_than_the_limit_are_refused_with_the_pen_up_too() -> None:
    assert MAX_SUBJECTS == 4
    with pytest.raises(InvalidImageError, match="5 subjects: at most 4") as info:
        outline_data(_png(five_discs, size=(520, 300)), pen_up=True)
    assert info.value.reason == "scattered"


def test_too_many_points_in_the_pieces_are_refused() -> None:
    png = _png(saws, size=(660, 540))
    with pytest.raises(InvalidImageError, match=f"at most {MAX_SUBJECT_POINTS}") as up:
        outline_data(png, pen_up=True)
    assert up.value.reason == "jagged"
    assert "the pieces are too jagged" in str(up.value)
    # Hung as strokes, with the pen down, they are too many points as well.
    with pytest.raises(InvalidImageError, match="other subjects are too jagged"):
        outline_data(png)


# --- The CLI: --image with --pen-up ---


@pytest.fixture
def badge(tmp_path: Path) -> Path:
    path = tmp_path / "badge.png"
    path.write_bytes(_png(ring_dot_and_disc))
    return path


def _image_args(image: Path, **overrides: str) -> list[str]:
    values = {"image": str(image), "distance": "3000", "start": "46.0122,11.2986"}
    values.update(overrides)
    return [f"--{name}={value}" for name, value in values.items()]


def test_the_cli_takes_an_image_with_the_pen_up(badge: Path) -> None:
    request, args = parse_args([*_image_args(badge), "--pen-up"])
    assert request.outline == outline_from_image(badge, "badge", "badge.png", True)
    assert args.pieces is not None and args.pieces.pen_up
    assert len(args.pieces.letters) == 4  # the outline, the hole, the disc, the dot
    assert "pieces" not in parse_request(_image_args(badge)).outline.__dict__ or (
        not parse_request(_image_args(badge)).outline.in_pieces
    )


def test_the_cli_draws_an_image_with_the_pen_up(
    badge: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(cli, "OsmnxSource", _GridSource)
    out = tmp_path / "badge.gpx"
    assert main([*_image_args(badge), "--pen-up", f"--out={out}"]) == 0
    printed = capsys.readouterr().out
    assert "badge (traced from" in printed
    assert "pen up: the outline, then 3 pieces each on its own" in printed
    assert "pieces:" in printed and "m drawn (target 3000 m)" in printed
    assert "walks:      3, not drawn:" in printed
    gpx = out.read_text(encoding="utf-8")
    assert "<name>badge 3 km" in gpx
    assert gpx.count("<trkpt") > 10


def test_the_cli_draws_an_image_without_pieces_as_one_line(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    disc = tmp_path / "disc.png"
    disc.write_bytes(_png(lambda draw: _disc(draw, (180, 150), 110, "black")))
    monkeypatch.setattr(cli, "OsmnxSource", _GridSource)
    out = tmp_path / "disc.gpx"
    assert main([*_image_args(disc), "--pen-up", f"--out={out}"]) == 0
    printed = capsys.readouterr().out
    assert "pen up: nothing apart in the image, drawn as one line" in printed
    assert "walks:" not in printed
    assert "on roads:" in printed
    assert "<name>disc 3 km" in out.read_text(encoding="utf-8")


def test_the_saved_outline_keeps_the_pieces_and_reads_back(
    badge: Path, tmp_path: Path
) -> None:
    saved = tmp_path / "badge.json"
    assert main([*_image_args(badge), "--pen-up", f"--save-outline={saved}"]) == 0
    assert len(json.loads(saved.read_text(encoding="utf-8"))["pieces"]) == 3
    outline = read_outline(saved)
    assert outline.in_pieces and len(outline.pieces) == 3
    argv = [f"--outline={saved}", "--distance=3000", "--start=46.0122,11.2986"]
    request, args = parse_args([*argv, "--pen-up"])
    assert request.outline == outline and args.pieces is not None
