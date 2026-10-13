"""Deterministic tests for tools/catalogue_shapes.py: the shapes «Draw on
the map» puts on the map are the engine's (TASK-281). No network."""

from __future__ import annotations

import json

import pytest

pytest.importorskip("route_engine")

from catalogue_shapes import OUT, build, text  # noqa: E402
from route_engine import pieces  # noqa: E402
from route_engine.shapes import SHAPES, in_pieces  # noqa: E402


def test_the_file_in_the_app_is_the_one_the_engine_gives() -> None:
    # Run `python tools/catalogue_shapes.py` after changing a shape.
    assert OUT.read_text(encoding="utf-8") == text()


def test_every_shape_of_the_catalogue_is_there_in_order() -> None:
    assert list(build()["shapes"]) == list(SHAPES)  # type: ignore[call-overload]


def test_the_lines_stay_in_the_frame_and_the_down_line_is_closed() -> None:
    for name, entry in build()["shapes"].items():  # type: ignore[attr-defined]
        down = entry["down"]
        assert len(down["lines"]) == 1, name
        line = down["lines"][0]
        assert line[0] == line[-1], name
        assert down["length"] > 0, name
        for kind in ("down", "up"):
            for drawn in entry.get(kind, {}).get("lines", []):
                for x, y in drawn:
                    assert abs(x) <= 1 and abs(y) <= 1, name


def test_the_pen_up_length_is_the_one_the_engine_sizes_by() -> None:
    shapes = build()["shapes"]
    for name in SHAPES:
        entry = shapes[name]  # type: ignore[index]
        if not in_pieces(name):
            assert "up" not in entry, name
            continue
        drawn = pieces.compose_shape(name).drawn_length
        assert entry["up"]["length"] == pytest.approx(drawn, rel=1e-3), name


def test_the_file_is_compact_json() -> None:
    data = json.loads(text())
    assert data["about"].startswith("Written by tools/catalogue_shapes.py")
    assert len(text()) < 80_000
