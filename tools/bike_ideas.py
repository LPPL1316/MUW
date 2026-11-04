"""Write the routes of «RIDE IT YOURSELF» in «Explore» (TASK-364, ADR-0309).

Usage (from the repository root, after the route engine planned the drafts):

    python tools/bike_ideas.py --drafts out/muw-bike-drafts

The drafts are bike routes the route engine planned on its bike network: this
tool only chooses among them and writes them with fewer points, so nothing
here invents a coordinate. The answers go to
``apps/mobile/src/explore/bikeIdeas.json``. After a run, format the file:

    npx prettier --write apps/mobile/src/explore/bikeIdeas.json
"""

from __future__ import annotations

import argparse
import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path
from typing import Any

DEFAULT_OUT = Path("apps/mobile/src/explore/bikeIdeas.json")
COORD_DECIMALS = 5
# A route keeps its shape within this, and is far lighter in the app.
KEEP_WITHIN_M = 2.0
PREVIEW_POINTS = 120
LICENSE = "Roads © OpenStreetMap contributors"

LatLon = tuple[float, float]


@dataclass(frozen=True)
class Chosen:
    """A draft chosen by the user on 2026-10-31, as the app names it. Autumn
    Mushroom and GO went to the Feed instead (TASK-365, the user's «Nel Feed»
    of 2026-11-01)."""

    draft: str
    city: str
    shape: str | None = None
    word: str | None = None
    style: str | None = None
    # The outline of a figure the catalogue does not have.
    outline: str | None = None


CHOSEN: tuple[Chosen, ...] = (
    Chosen("ghost", "Barcelona", shape="ghost"),
    Chosen("bat", "Madrid", shape="bat", outline="bat"),
    Chosen("pumpkin", "Turin", shape="pumpkin"),
)


def metres(a: LatLon, b: LatLon) -> float:
    """Haversine distance between two (lat, lon) points."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def length_m(points: Sequence[LatLon]) -> float:
    return sum(metres(a, b) for a, b in pairwise(points))


def _off_line_m(point: LatLon, a: LatLon, b: LatLon) -> float:
    """How far `point` is from the segment a-b, on a local plane in metres."""
    kx = 111_320.0 * math.cos(math.radians(a[0]))
    ky = 110_574.0
    px, py = (point[1] - a[1]) * kx, (point[0] - a[0]) * ky
    bx, by = (b[1] - a[1]) * kx, (b[0] - a[0]) * ky
    size = bx * bx + by * by
    t = 0.0 if size == 0 else max(0.0, min(1.0, (px * bx + py * by) / size))
    return math.hypot(px - t * bx, py - t * by)


def fewer_points(points: Sequence[LatLon], within_m: float) -> list[LatLon]:
    """Douglas-Peucker: the first and last stay, nothing moves further than
    `within_m`. Iterative, a route has thousands of points."""
    if len(points) < 3:
        return list(points)
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        far, at = 0.0, -1
        for i in range(first + 1, last):
            off = _off_line_m(points[i], points[first], points[last])
            if off > far:
                far, at = off, i
        if far > within_m:
            keep.add(at)
            stack += [(first, at), (at, last)]
    return [points[i] for i in sorted(keep)]


def preview_of(points: Sequence[LatLon], count: int = PREVIEW_POINTS) -> list[LatLon]:
    """The line of a card: at most `count` points, the ends kept."""
    if len(points) <= count:
        return list(points)
    step = (len(points) - 1) / (count - 1)
    return [points[round(i * step)] for i in range(count)]


def rounded(points: Sequence[LatLon]) -> list[list[float]]:
    return [
        [round(lat, COORD_DECIMALS), round(lon, COORD_DECIMALS)] for lat, lon in points
    ]


def entry(
    chosen: Chosen,
    meta: dict[str, Any],
    points: Sequence[LatLon],
    outline: list[list[float]] | None,
) -> dict[str, Any]:
    """One route as the app reads it. Always a bike route: it was planned on
    the bike network, and nobody has ridden it, so no time and no calories."""
    route_m = round(length_m(points))
    kept = fewer_points(points, KEEP_WITHIN_M)
    item: dict[str, Any] = {
        "id": f"bike-{chosen.draft}",
        "city": chosen.city,
        "shape": chosen.shape,
        "word": chosen.word,
        "style": chosen.style,
        "activity": "cycling",
        "route_m": route_m,
        "similarity": meta["similarity"],
        "license": LICENSE,
        "preview": rounded(preview_of(kept)),
        "points": rounded(kept),
    }
    if outline is not None:
        item["outline"] = outline
    return item


def read_draft(drafts: Path, chosen: Chosen) -> dict[str, Any]:
    post = drafts / "posts" / chosen.draft
    meta = json.loads((post / "meta.json").read_text())
    if meta.get("activity") != "cycling":
        raise ValueError(f"{chosen.draft} is not a bike route")
    line = json.loads((post / "route.geojson").read_text())["geometry"]["coordinates"]
    points = [(float(lat), float(lon)) for lon, lat in line]
    outline = None
    if chosen.outline is not None:
        drawn = json.loads((drafts / "outlines" / f"{chosen.outline}.json").read_text())
        outline = drawn["points"]
    return entry(chosen, meta, points, outline)


def ideas_file(items: Sequence[dict[str, Any]]) -> str:
    return json.dumps({"ideas": list(items)}, ensure_ascii=False) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--drafts", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)
    items = [read_draft(args.drafts, chosen) for chosen in CHOSEN]
    args.out.write_text(ideas_file(items))
    for item in items:
        print(item["id"], item["route_m"], "m", len(item["points"]), "points")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
