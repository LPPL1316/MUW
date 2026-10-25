"""Draw the ready-made pictures of «Draw» and trace their outlines (TASK-280).

Usage (from the repository root, with the route-engine installed):

    python tools/sample_pictures.py

Sixteen silhouettes, drawn here with Pillow from circles, lines and polygons:
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


def plane(pen: Pen) -> None:
    axis = 320
    pen.box(axis - 28, 46, axis + 28, 590, radius=28)
    wing = [(axis, 244), (axis + 268, 368), (axis + 268, 398), (axis, 336)]
    pen.polygon(mirrored(wing, axis))
    tail = [(axis, 512), (axis + 112, 572), (axis + 112, 592), (axis, 566)]
    pen.polygon(mirrored(tail, axis))
    for x in (axis + 120, axis - 120):
        pen.box(x - 15, 268, x + 15, 338, radius=12)


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


def mushroom(pen: Pen) -> None:
    axis = 320
    right = [
        *bezier((axis, 90), (axis + 150, 90), (axis + 250, 200), (axis + 260, 330)),
        (axis + 70, 330),
        *bezier((axis + 70, 330), (axis + 80, 420), (axis + 96, 500), (axis + 92, 560)),
        *bezier((axis + 92, 560), (axis + 60, 580), (axis + 20, 584), (axis, 584)),
    ]
    pen.polygon(mirrored(right, axis))
    # The spots: inside the cap, never on its edge.
    for centre, radius in (((230, 210), 30), ((380, 170), 24), ((450, 270), 26)):
        pen.disc(centre, radius, fill=BACKGROUND)


def t_shirt(pen: Pen) -> None:
    axis = 320
    right = [
        *bezier((axis, 140), (axis + 40, 140), (axis + 66, 120), (axis + 72, 96)),
        (axis + 150, 112),
        (axis + 270, 210),
        (axis + 214, 296),
        (axis + 160, 262),
        (axis + 160, 560),
    ]
    pen.polygon(mirrored(right, axis))


def car(pen: Pen) -> None:
    pen.polygon(
        [
            (60, 470),
            (60, 360),
            *bezier((60, 360), (80, 330), (120, 320), (160, 316)),
            *bezier((160, 316), (210, 220), (260, 196), (340, 196)),
            *bezier((340, 196), (420, 196), (460, 240), (500, 316)),
            *bezier((500, 316), (560, 320), (590, 340), (590, 400)),
            (590, 470),
        ]
    )
    # The wheels below the body, so their round shows in the outline.
    for x in (176, 470):
        pen.disc((x, 474), 66)
        pen.disc((x, 474), 26, fill=BACKGROUND)
    pen.polygon([(206, 310), (250, 236), (316, 230), (316, 310)], fill=BACKGROUND)
    pen.polygon([(346, 310), (346, 230), (420, 236), (456, 310)], fill=BACKGROUND)


def duck(pen: Pen) -> None:
    pen.polygon(
        [
            *bezier((80, 380), (90, 300), (160, 290), (220, 330)),
            *bezier((220, 330), (300, 330), (340, 320), (340, 280)),
            *bezier((340, 280), (300, 230), (290, 120), (400, 100)),
            *bezier((400, 100), (470, 90), (510, 140), (500, 200)),
            (580, 210),
            *bezier((580, 210), (590, 240), (560, 260), (500, 262)),
            *bezier((500, 262), (480, 290), (470, 300), (480, 330)),
            *bezier((480, 330), (580, 380), (570, 520), (420, 540)),
            (220, 540),
            *bezier((220, 540), (120, 530), (80, 470), (80, 380)),
        ]
    )
    pen.disc((420, 170), 13, fill=BACKGROUND)


def boot(pen: Pen) -> None:
    pen.polygon(
        [
            (200, 60),
            (400, 60),
            (400, 360),
            *bezier((400, 360), (500, 380), (580, 420), (590, 500)),
            (590, 580),
            (170, 580),
            *bezier((170, 580), (180, 400), (200, 300), (200, 60)),
        ]
    )
    pen.box(180, 40, 420, 90, radius=12)


def house(pen: Pen) -> None:
    pen.polygon(
        [
            (320, 70),
            (590, 300),
            (520, 300),
            (520, 580),
            (120, 580),
            (120, 300),
            (50, 300),
        ]
    )
    pen.box(420, 110, 480, 230)
    # The door, open at the bottom: it shows in the outline.
    pen.polygon([(272, 430), (368, 430), (368, 580), (272, 580)], fill=BACKGROUND)


def bone(pen: Pen) -> None:
    # Drawn level, then turned: a bone lies at a slant.
    centre, degrees = (320, 320), -30
    pen.polygon(
        turned([(170, 280), (470, 280), (470, 360), (170, 360)], centre, degrees)
    )
    for end in turned(
        [(150, 270), (150, 370), (490, 270), (490, 370)], centre, degrees
    ):
        pen.disc(end, 62)


def trophy(pen: Pen) -> None:
    axis = 320
    right = [
        (axis + 160, 80),
        *bezier(
            (axis + 160, 80), (axis + 160, 260), (axis + 100, 330), (axis + 40, 360)
        ),
        (axis + 40, 440),
        (axis + 120, 480),
        (axis + 120, 560),
        (axis, 560),
    ]
    # The handles first, so the cup covers their inner half.
    for x in (130, 510):
        pen.ring((x, 190), 70, 40)
    pen.polygon(mirrored(right, axis))


# In the order of the row in «Draw», the clearest first: the sixteen whose
# routes came out recognisable in the cities tried by TASK-290 (2026-10-16).
PICTURES: dict[str, Callable[[Pen], None]] = {
    "dinosaur": dinosaur,
    "mushroom": mushroom,
    "car": car,
    "eiffel_tower": eiffel_tower,
    "t_shirt": t_shirt,
    "plane": plane,
    "boot": boot,
    "guitar": guitar,
    "house": house,
    "balloon": balloon,
    "duck": duck,
    "trophy": trophy,
    "bone": bone,
    "rocket": rocket,
    "running_shoe": running_shoe,
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
