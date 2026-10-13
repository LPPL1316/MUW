"""Draw the ready-made pictures of «Draw» and trace their outlines (TASK-280).

Usage (from the repository root, with the route-engine installed):

    python tools/sample_pictures.py

Twelve silhouettes, drawn here with Pillow from circles, lines and polygons:
no picture of anyone else, no licence. Each is one dark figure on a light
background, what the engine traces best (ADR-0068). The PNGs go to
``apps/mobile/assets/pictures/``; the outline the engine traces from each
goes to ``apps/mobile/src/route/samplePictures.json``, in the shape of the
answer of POST /image-outlines (ADR-0069), so the app shows a picture's
outline at once, without asking the API.

The outline is the engine's (``route_engine.image_outline``), turned into the
API's answer as ``shaperoute_api.images.trace`` does: the API is not
imported, so this runs with the route-engine alone, like CI's tools job.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import re
from collections.abc import Callable, Sequence
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps
from route_engine.image_outline import ANALYSIS_SIDE, outline_data
from route_engine.shapes.outline import parse_outline

Point = tuple[float, float]

REPO_ROOT = Path(__file__).resolve().parent.parent
PICTURES_DIR = REPO_ROOT / "apps" / "mobile" / "assets" / "pictures"
OUTLINES_FILE = REPO_ROOT / "apps" / "mobile" / "src" / "route" / "samplePictures.json"

# The side of a picture: the side the engine analyses, so it traces the
# picture as drawn.
SIDE = ANALYSIS_SIDE
# Drawn this many times larger, then reduced: smooth edges.
SCALE = 4
# The figure and the background: dark on light, far apart (MIN_CONTRAST).
INK = (34, 34, 38)
PAPER = (244, 241, 234)
# As the API rounds the points it sends (images.py).
DIGITS = 5

FIGURE = 0
BACKGROUND = 255


class Pen:
    """Draws in the coordinates of a SIDE × SIDE picture, y downwards."""

    def __init__(self) -> None:
        self.image = Image.new("L", (SIDE * SCALE, SIDE * SCALE), BACKGROUND)
        self.draw = ImageDraw.Draw(self.image)

    @staticmethod
    def _xy(points: Sequence[Point]) -> list[Point]:
        return [(x * SCALE, y * SCALE) for x, y in points]

    def polygon(self, points: Sequence[Point], fill: int = FIGURE) -> None:
        self.draw.polygon(self._xy(points), fill=fill)

    def disc(self, centre: Point, radius: float, fill: int = FIGURE) -> None:
        x, y = centre
        box = [(x - radius) * SCALE, (y - radius) * SCALE]
        box += [(x + radius) * SCALE, (y + radius) * SCALE]
        self.draw.ellipse(box, fill=fill)

    def ring(self, centre: Point, radius: float, width: float) -> None:
        self.disc(centre, radius + width / 2)
        self.disc(centre, radius - width / 2, fill=BACKGROUND)

    def line(self, points: Sequence[Point], width: float, fill: int = FIGURE) -> None:
        """A thick line with round ends and joints."""
        self.draw.line(self._xy(points), fill=fill, width=round(width * SCALE))
        for point in points:
            self.disc(point, width / 2, fill=fill)

    def box(
        self, left: float, top: float, right: float, bottom: float, radius: float = 0
    ) -> None:
        corners = [left * SCALE, top * SCALE, right * SCALE, bottom * SCALE]
        self.draw.rounded_rectangle(corners, radius=radius * SCALE, fill=FIGURE)

    def picture(self) -> Image.Image:
        small = self.image.resize((SIDE, SIDE), Image.Resampling.LANCZOS)
        return ImageOps.colorize(small, black=INK, white=PAPER)


def bezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: int = 24) -> list[Point]:
    """A cubic Bézier curve as points, both ends included."""
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        points.append((x, y))
    return points


def mirrored(right: Sequence[Point], axis: float) -> list[Point]:
    """A figure symmetric about x = `axis` from its right half, given top to
    bottom: the right half down, then the left half back up."""
    return [*right, *[(2 * axis - x, y) for x, y in reversed(right)]]


def turned(points: Sequence[Point], centre: Point, degrees: float) -> list[Point]:
    angle = math.radians(degrees)
    cos, sin = math.cos(angle), math.sin(angle)
    cx, cy = centre
    return [
        (cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos)
        for x, y in points
    ]


def bike(pen: Pen) -> None:
    rear, front = (178, 405), (462, 405)
    bracket, seat, head = (305, 410), (278, 248), (436, 252)
    for hub in (rear, front):
        pen.ring(hub, 108, 26)
        pen.disc(hub, 15)
    for stretch in (
        (rear, bracket),
        (bracket, seat),
        (seat, rear),
        (seat, head),
        (bracket, head),
        (head, front),
    ):
        pen.line(stretch, 20)
    pen.line([head, (426, 200), (470, 192)], 18)
    pen.box(236, 226, 316, 248, radius=11)


def running_shoe(pen: Pen) -> None:
    outline = [
        *bezier((92, 452), (220, 470), (420, 472), (518, 462)),
        *bezier((518, 462), (566, 456), (584, 428), (566, 398)),
        *bezier((566, 398), (520, 370), (420, 330), (348, 262)),
        *bezier((348, 262), (330, 230), (318, 206), (296, 200)),
        *bezier((296, 200), (272, 196), (262, 230), (232, 254)),
        *bezier((232, 254), (204, 268), (176, 250), (160, 226)),
        *bezier((160, 226), (138, 212), (112, 214), (104, 236)),
        *bezier((104, 236), (84, 300), (76, 380), (92, 452)),
    ]
    pen.polygon(outline)
    # The laces, and the line of the sole: inside, never across the shoe.
    for x, y in ((352, 318), (384, 340), (416, 360), (448, 378)):
        pen.line([(x - 10, y + 12), (x + 10, y - 10)], 7, fill=BACKGROUND)
    pen.line([(120, 420), (300, 430), (520, 428)], 7, fill=BACKGROUND)


def dinosaur(pen: Pen) -> None:
    pen.polygon(
        [
            *bezier((150, 330), (230, 270), (360, 266), (420, 300)),
            *bezier((420, 300), (450, 250), (468, 180), (488, 132)),
            *bezier((488, 132), (500, 104), (540, 92), (566, 108)),
            *bezier((566, 108), (584, 120), (576, 142), (548, 146)),
            *bezier((548, 146), (526, 160), (510, 220), (476, 330)),
            *bezier((476, 330), (470, 390), (420, 430), (330, 440)),
            *bezier((330, 440), (240, 446), (180, 430), (150, 420)),
            *bezier((150, 420), (110, 440), (70, 470), (40, 476)),
            *bezier((40, 476), (60, 440), (100, 380), (150, 330)),
        ]
    )
    for left in (196, 262, 352, 418):
        pen.box(left, 390, left + 44, 548, radius=12)
    pen.disc((548, 118), 6, fill=BACKGROUND)


def guitar(pen: Pen) -> None:
    pen.disc((320, 458), 122)
    pen.disc((320, 318), 90)
    pen.box(302, 70, 338, 260)
    pen.box(290, 26, 350, 104, radius=12)
    for x in (282, 358):
        for y in (46, 80):
            pen.disc((x, y), 10)
    pen.disc((320, 334), 34, fill=BACKGROUND)
    pen.line([(286, 478), (354, 478)], 12, fill=BACKGROUND)


def eiffel_tower(pen: Pen) -> None:
    axis = 320
    right = [
        (axis + 3, 28),
        (axis + 9, 64),
        (axis + 16, 90),
        (axis + 28, 90),
        (axis + 28, 102),
        (axis + 24, 108),
        (axis + 34, 160),
        (axis + 46, 222),
        (axis + 58, 270),
        (axis + 76, 270),
        (axis + 76, 290),
        (axis + 66, 290),
        (axis + 74, 330),
        (axis + 88, 380),
        (axis + 104, 418),
        (axis + 138, 418),
        (axis + 138, 442),
        (axis + 120, 442),
        *bezier(
            (axis + 120, 442), (axis + 146, 500), (axis + 176, 560), (axis + 212, 602)
        ),
        (axis + 128, 602),
        *bezier((axis + 128, 602), (axis + 110, 530), (axis + 64, 486), (axis, 482)),
    ]
    pen.polygon(mirrored(right, axis))


def rocket(pen: Pen) -> None:
    axis = 320
    right = [
        *bezier((axis, 40), (axis + 46, 84), (axis + 70, 140), (axis + 70, 196)),
        (axis + 70, 380),
        (axis + 136, 446),
        (axis + 144, 540),
        (axis + 70, 486),
        (axis + 52, 486),
        (axis + 62, 520),
        *bezier((axis + 40, 520), (axis + 40, 556), (axis + 20, 584), (axis, 608)),
    ]
    pen.polygon(mirrored(right, axis))
    pen.ring((axis, 262), 30, 12)


def heart_with_arrow(pen: Pen) -> None:
    def at(t: float) -> Point:
        x = 16 * math.sin(t) ** 3
        y = (
            13 * math.cos(t)
            - 5 * math.cos(2 * t)
            - 2 * math.cos(3 * t)
            - math.cos(4 * t)
        )
        return (320 + 11.5 * x, 300 - 11.5 * y)

    pen.polygon([at(2 * math.pi * i / 240) for i in range(240)])
    tail, tip = (96, 486), (548, 160)
    pen.line([tail, tip], 18)
    length = math.dist(tail, tip)
    along = ((tip[0] - tail[0]) / length, (tip[1] - tail[1]) / length)
    across = (-along[1], along[0])

    def step(point: Point, forward: float, side: float) -> Point:
        return (
            point[0] + forward * along[0] + side * across[0],
            point[1] + forward * along[1] + side * across[1],
        )

    head = step(tip, 30, 0)
    pen.polygon([head, step(tip, -40, 34), step(tip, -40, -34)])
    for back in (0, 26, 52):
        feather = step(tail, back, 0)
        pen.polygon(
            [
                feather,
                step(feather, -30, 28),
                step(feather, -12, 28),
                step(feather, 18, 0),
                step(feather, -12, -28),
                step(feather, -30, -28),
            ]
        )


def anchor(pen: Pen) -> None:
    pen.ring((320, 96), 38, 22)
    pen.box(212, 158, 428, 190, radius=14)
    pen.box(302, 130, 338, 540)
    centre, radius = (320, 352), 196
    arc = [
        (
            centre[0] + radius * math.cos(math.radians(a)),
            centre[1] + radius * math.sin(math.radians(a)),
        )
        for a in range(22, 159, 2)
    ]
    pen.line(arc, 36)
    for degrees, onward in ((22, -1), (158, 1)):
        a = math.radians(degrees)
        end = (centre[0] + radius * math.cos(a), centre[1] + radius * math.sin(a))
        # Along the arc, past its end, and across it.
        tangent = (onward * -math.sin(a), onward * math.cos(a))
        normal = (math.cos(a), math.sin(a))
        pen.polygon(
            [
                (end[0] + 78 * tangent[0], end[1] + 78 * tangent[1]),
                (
                    end[0] + 40 * normal[0] - 12 * tangent[0],
                    end[1] + 40 * normal[1] - 12 * tangent[1],
                ),
                (
                    end[0] - 40 * normal[0] - 12 * tangent[0],
                    end[1] - 40 * normal[1] - 12 * tangent[1],
                ),
            ]
        )


def plane(pen: Pen) -> None:
    axis = 320
    pen.box(axis - 28, 46, axis + 28, 590, radius=28)
    wing = [(axis, 244), (axis + 268, 368), (axis + 268, 398), (axis, 336)]
    pen.polygon(mirrored(wing, axis))
    tail = [(axis, 512), (axis + 112, 572), (axis + 112, 592), (axis, 566)]
    pen.polygon(mirrored(tail, axis))
    for x in (axis + 120, axis - 120):
        pen.box(x - 15, 268, x + 15, 338, radius=12)


def ice_cream(pen: Pen) -> None:
    # The scoop wider than the cone, so its edge shows in the outline.
    pen.polygon([(236, 352), (404, 352), (320, 606)])
    pen.disc((320, 316), 124)
    for centre, radius in (((222, 380), 22), ((418, 374), 18)):
        pen.disc(centre, radius)
    pen.disc((320, 184), 82)
    pen.disc((320, 88), 24)
    pen.line([(322, 68), (346, 44)], 12)
    for x, y in ((292, 450), (348, 450), (320, 496), (320, 540)):
        pen.polygon(
            [(x, y - 14), (x + 14, y), (x, y + 14), (x - 14, y)], fill=BACKGROUND
        )


def balloon(pen: Pen) -> None:
    centre, wide, tall = (320, 236), 158, 188
    pen.polygon(
        [
            (
                centre[0] + wide * math.cos(t) * (1 - 0.14 * math.sin(t)),
                centre[1] + tall * math.sin(t),
            )
            for t in (2 * math.pi * i / 240 for i in range(240))
        ]
    )
    pen.polygon([(320, 416), (346, 452), (294, 452)])
    pen.line(bezier((320, 448), (350, 500), (290, 540), (314, 604), 16), 16)
    pen.line(
        bezier((214, 196), (220, 140), (250, 104), (290, 88), 12), 12, fill=BACKGROUND
    )


def leaf(pen: Pen) -> None:
    length, wide = 470, 120
    base = (320 - length / 2, 320)

    def edge(side: int) -> list[Point]:
        steps = 60
        points = []
        for i in range(steps + 1):
            u = i / steps
            width = wide * math.sin(math.pi * u) ** 0.85 * (1 - 0.25 * u)
            points.append((base[0] + length * u, base[1] + side * width))
        return points

    body = [*edge(-1), *reversed(edge(1))]
    centre = (320, 320)
    pen.polygon(turned(body, centre, -42))
    stem = turned(
        [base, (base[0] - 40, base[1] + 14), (base[0] - 70, base[1] + 40)], centre, -42
    )
    pen.line(stem, 18)
    rib = turned(
        [(base[0] + 40, base[1]), (base[0] + length - 50, base[1])], centre, -42
    )
    pen.line(rib, 8, fill=BACKGROUND)
    for u in (0.25, 0.42, 0.59, 0.74):
        x = base[0] + length * u
        for side in (-1, 1):
            vein = [(x, base[1]), (x + 50, base[1] + side * 62)]
            pen.line(turned(vein, centre, -42), 6, fill=BACKGROUND)


# In the order of the row in «Draw»: the user's choice of 2026-10-13.
PICTURES: dict[str, Callable[[Pen], None]] = {
    "bike": bike,
    "running_shoe": running_shoe,
    "dinosaur": dinosaur,
    "guitar": guitar,
    "eiffel_tower": eiffel_tower,
    "rocket": rocket,
    "heart_with_arrow": heart_with_arrow,
    "anchor": anchor,
    "plane": plane,
    "ice_cream": ice_cream,
    "balloon": balloon,
    "leaf": leaf,
}


def drawn(name: str) -> bytes:
    """The PNG of the picture `name`."""
    pen = Pen()
    PICTURES[name](pen)
    buffer = io.BytesIO()
    pen.picture().save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def traced(png: bytes) -> dict[str, object]:
    """The outline of the picture as POST /image-outlines answers it:
    ``shaperoute_api.images.trace`` for a picture of SIDE × SIDE pixels."""
    data = outline_data(png, name="image", source="a picture of the app")
    outline = parse_outline(data)
    pixels: list[list[float]] = data["points"]  # type: ignore[assignment]
    stroke_pixels: list[list[list[float]]] = data.get("strokes", [])  # type: ignore[assignment]

    def shares(line: Sequence[Sequence[float]]) -> list[list[float]]:
        # The engine's y is upwards: the row of a pixel is -y.
        return [[round(x / SIDE, DIGITS), round(-y / SIDE, DIGITS)] for x, y in line]

    def rounded(line: Sequence[Sequence[float]]) -> list[list[float]]:
        return [[round(x, DIGITS), round(y, DIGITS)] for x, y in line]

    return {
        "points": rounded(outline.points),
        "image_points": shares(pixels),
        "aspect": 1,
        "strokes": [rounded(stroke) for stroke in outline.strokes],
        "image_strokes": [shares(stroke) for stroke in stroke_pixels],
    }


def as_prettier(value: object) -> str:
    """JSON as the app's Prettier writes it: two spaces, a point [x, y] on
    one line. Written again unchanged, the file shows no difference."""
    text = json.dumps(value, indent=2, ensure_ascii=False)
    number = r"-?\d+(?:\.\d+)?(?:e-?\d+)?"
    return re.sub(rf"\[\s+({number}),\s+({number})\s+\]", r"[\1, \2]", text) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.parse_args(argv)
    PICTURES_DIR.mkdir(parents=True, exist_ok=True)
    outlines = {}
    for name in PICTURES:
        png = drawn(name)
        (PICTURES_DIR / f"{name}.png").write_bytes(png)
        outlines[name] = traced(png)
        corners = len(outlines[name]["points"]) - 1  # type: ignore[arg-type]
        print(f"{name}: {len(png) // 1000} kB, {corners} corners")
    OUTLINES_FILE.write_text(as_prettier(outlines), encoding="utf-8")
    print(f"wrote {OUTLINES_FILE.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
