"""Draw synthetic logos and trace them with the pen up (TASK-297, ADR-0258).

Usage (from the repository root, with the route-engine installed):

    python tools/sample_logos.py [--out DIR]

Seven badges drawn here with Pillow, like the pictures of «Draw»
(sample_pictures.py): a ring with a star, a shield with a band, peaks and a
sun, the letters RC, three bars, a shoe with a swoosh, a wheel with spokes;
and the MuW wordmark of the app's splash screen, the only real logo in the
repository (ADR-0258: no logo of a company or of a club). They have what a
logo is made of: subjects apart, holes, a subject inside a hole.

Nothing of this goes into the app. The script writes each logo as a PNG and
its outline twice, as the engine traces it with the pen down (the other
subjects hung by a stem, the holes left out) and with the pen up (the
subjects and the holes as pieces), to look at: in ``out/logos/`` of the
repository, ignored by git, or in ``--out DIR``. ``tools/test_sample_logos.py``
checks the pieces each logo gives.
"""

from __future__ import annotations

import argparse
import io
import json
import math
from collections.abc import Callable, Sequence
from pathlib import Path

from route_engine.image_outline import outline_data
from sample_pictures import BACKGROUND, Pen, Point, running_shoe

REPO_ROOT = Path(__file__).resolve().parent.parent
# The MuW wordmark as the splash screen shows it: three letters apart.
MUW_LOGO = REPO_ROOT / "apps" / "mobile" / "assets" / "splash-logo-dark.png"
OUT_DIR = REPO_ROOT / "out" / "logos"


def star(centre: Point, radius: float, tips: int = 5) -> list[Point]:
    """A star with `tips` points, the first one up."""
    cx, cy = centre
    corners = []
    for k in range(2 * tips):
        angle = -math.pi / 2 + k * math.pi / tips
        r = radius if k % 2 == 0 else radius * 0.45
        corners.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return corners


def ring_star(pen: Pen) -> None:
    """A ring with a star inside it: a hole, and a subject inside the hole."""
    pen.ring((320, 320), 210, 55)
    pen.polygon(star((320, 320), 120))


def badge_band(pen: Pen) -> None:
    """A shield cut in two by a band: two subjects apart."""
    pen.polygon([(160, 120), (480, 120), (480, 330), (320, 540), (160, 330)])
    pen.polygon([(120, 300), (520, 300), (520, 370), (120, 370)], fill=BACKGROUND)


def peaks_sun(pen: Pen) -> None:
    """Mountains, and a sun apart from them."""
    pen.polygon([(90, 520), (260, 230), (360, 400), (420, 300), (560, 520)])
    pen.disc((470, 160), 70)


def rc_letters(pen: Pen) -> None:
    """The letters R and C apart; the eye of the R is a hole."""
    pen.line(
        [
            (110, 520),
            (110, 150),
            (230, 150),
            (270, 200),
            (270, 270),
            (230, 320),
            (110, 320),
        ],
        48,
    )
    pen.line([(190, 320), (290, 520)], 48)
    arc = []
    for k in range(25):
        angle = math.radians(40 + k * 280 / 24)
        arc.append((470 + 140 * math.cos(angle), 335 + 185 * math.sin(angle)))
    pen.line(arc, 48)


def three_bars(pen: Pen) -> None:
    """Three slanted bars apart."""
    for k in range(3):
        x = 150 + 130 * k
        pen.polygon([(x, 500), (x + 70, 500), (x + 170, 160), (x + 100, 160)])


def shoe_swoosh(pen: Pen) -> None:
    """The running shoe of «Draw» with a swoosh under it."""
    running_shoe(pen)
    pen.line([(140, 560), (300, 600), (520, 560)], 30)


def wheel(pen: Pen) -> None:
    """A wheel with four spokes: one subject with four holes."""
    pen.ring((320, 320), 220, 50)
    for k in range(4):
        angle = math.radians(45 + 90 * k)
        end = (320 + 220 * math.cos(angle), 320 + 220 * math.sin(angle))
        pen.line([(320, 320), end], 40)
    pen.disc((320, 320), 45)


# The seven drawn here, in the order of the sheet of the proposal of
# 2026-10-24 (out/archivio-apprendimento/logos/all-logos.png on the Mac).
LOGOS: dict[str, Callable[[Pen], None]] = {
    "ring_star": ring_star,
    "badge_band": badge_band,
    "peaks_sun": peaks_sun,
    "rc_letters": rc_letters,
    "three_bars": three_bars,
    "shoe_swoosh": shoe_swoosh,
    "wheel": wheel,
}
# Every logo: the seven, then the MuW wordmark read from the app.
NAMES: tuple[str, ...] = (*LOGOS, "muw")


def drawn(name: str) -> bytes:
    """The PNG of the logo `name`: drawn here, or the wordmark of the app."""
    if name == "muw":
        return MUW_LOGO.read_bytes()
    pen = Pen()
    LOGOS[name](pen)
    buffer = io.BytesIO()
    pen.picture().save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def traced(png: bytes, pen_up: bool) -> dict[str, object]:
    """The outline the engine traces from the logo, with the pen up or down,
    as an outline file holds it (pixels, y upwards)."""
    return outline_data(png, name="logo", source="a sample logo", pen_up=pen_up)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT_DIR,
        help="where to write the logos and their outlines (default: out/logos/)",
    )
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        png = drawn(name)
        (args.out / f"{name}.png").write_bytes(png)
        down = traced(png, pen_up=False)
        up = traced(png, pen_up=True)
        for label, data in (("down", down), ("up", up)):
            text = json.dumps(data, indent=1) + "\n"
            (args.out / f"{name}-pen-{label}.json").write_text(text, encoding="utf-8")
        corners = len(up["points"]) - 1  # type: ignore[arg-type]
        strokes = len(down.get("strokes", []))  # type: ignore[arg-type]
        pieces = len(up.get("pieces", []))  # type: ignore[arg-type]
        print(
            f"{name}: {corners} corners; pen down {strokes} strokes, "
            f"pen up {pieces} pieces"
        )
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
