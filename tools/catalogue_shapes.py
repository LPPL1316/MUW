"""Write the shapes of the catalogue as the app draws them on the map
(TASK-281).

Usage (from the repository root, with the route engine importable):

    PYTHONPATH=services/route-engine python tools/catalogue_shapes.py

«Draw on the map» puts a shape of the catalogue on the map before any route
is asked for: the app needs its lines, and how long the engine takes them to
be, to show the distance the shape on the map would make. Both come from the
engine itself, here, once: the app never makes up a shape.

For each shape, in the engine's frame (x to the right, y up, within
[-1, 1]):

- ``down``: the shape as a request without ``pen_up`` draws it, one closed
  line (``Outline.path``: the strokes out and back, the pieces joined), and
  ``length``, the perimeter of the line the engine sizes it by
  (``get_shape(name)(SHAPE_POINTS)``): the distance asked for is ``length``
  times the metres of one unit;
- ``up``: for a shape in pieces, the lines drawn with the pen up
  (``Outline.pen_up_lines``) and their length together, the one the
  distance applies to with ``pen_up`` (``Word.drawn_length``).

The first point of the first line is where the route starts, at phase 0.
``tools/test_catalogue_shapes.py`` checks that the file in the app is the
one this script writes.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from pathlib import Path

from route_engine.optimizer import SHAPE_POINTS
from route_engine.projection import perimeter
from route_engine.shapes import SHAPES, get_shape
from route_engine.shapes.outline import Outline
from sample_pictures import as_prettier

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "apps" / "mobile" / "src" / "mapdraw" / "catalogueShapes.json"

# Enough to draw a smooth circle or heart on a phone: the shapes read from a
# file keep their own corners.
DRAWN_POINTS = 96
# A ten-thousandth of the frame: under a metre on a 21 km shape.
DECIMALS = 4

Point = tuple[float, float]


def _rounded(line: Sequence[Point]) -> list[list[float]]:
    return [[round(x, DECIMALS), round(y, DECIMALS)] for x, y in line]


def _length(lines: Sequence[Sequence[Point]]) -> float:
    return sum(
        math.dist(a, b) for line in lines for a, b in zip(line, line[1:], strict=False)
    )


def shape_entry(name: str) -> dict[str, object]:
    """The lines and lengths of the shape called `name`, as the app reads
    them."""
    shape = get_shape(name)
    sized = shape(SHAPE_POINTS)
    if isinstance(shape, Outline):
        drawn = shape.path()
    else:
        drawn = shape(DRAWN_POINTS)
    entry: dict[str, object] = {
        "down": {
            "lines": [_rounded(drawn)],
            "length": round(perimeter(sized), DECIMALS),
            "start": _rounded(sized[:1])[0],
        }
    }
    if isinstance(shape, Outline) and shape.in_pieces:
        lines = shape.pen_up_lines()
        entry["up"] = {
            "lines": [_rounded(line) for line in lines],
            "length": round(_length(lines), DECIMALS),
            "start": _rounded(lines[0][:1])[0],
        }
    return entry


def build() -> dict[str, object]:
    """The whole file: every shape of the catalogue, in its order."""
    return {
        "about": (
            "Written by tools/catalogue_shapes.py from the route engine "
            "(TASK-281): do not edit by hand."
        ),
        "shapes": {name: shape_entry(name) for name in SHAPES},
    }


def text() -> str:
    """The file as the app's Prettier writes it (TASK-280's `as_prettier`):
    `format:check` passes, and the test compares it as it is."""
    return as_prettier(build())


def main() -> None:
    OUT.write_text(text(), encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO_ROOT)} ({len(SHAPES)} shapes)")


if __name__ == "__main__":
    main()
