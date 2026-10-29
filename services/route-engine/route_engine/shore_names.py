"""The places with a name on the shore, to turn opposite (TASK-323 A2,
ADR-0283).

In the water a swimmer finds the way by lifting the head towards a point
ashore. For each turn of a swim (swim_turns.py) the engine looks for the
place with a name nearest it, within LANDMARK_REACH_M: a beach resort, a
pier, a lighthouse, a hotel, a church, a bar on the beach. The band of a
swim is within 150 m of the shore, so the nearest named place is on the
shore in front. It is data from OpenStreetMap, never a text of the AI: the
app says it in its own words («Turn opposite Bagno 54», part C).

The places come as files in `<cache>/shore_names/`, cut by the server from
OpenStreetMap along the shore (part B), each
`{"bbox": [s, w, n, e], "places": [{"name", "kind", "lat", "lon"}, ...]}`.
Without a file the turns have no name, and nothing fails; a file that cannot
be read is left out the same way, since the names only help. No network:
the files are read, never downloaded here.
"""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from route_engine.geo import LatLon, haversine_m, latlon_to_local
from route_engine.swim_turns import Landmark, SwimTurn

# A place farther than this from a turn is no help to find it.
LANDMARK_REACH_M = 300.0
# Inside the cache folder, beside the water (water.OverpassWaterSource).
FOLDER = "shore_names"

# (south, west, north, east) in degrees, as water.BBox.
BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class ShorePlace:
    """A place with a name on the shore, as a file of the cache has it."""

    name: str
    # What it is, from OpenStreetMap: "beach_resort", "pier", "lighthouse"...
    kind: str
    point: LatLon


class ShoreNameSource(Protocol):
    def places(self, bbox: BBox) -> list[ShorePlace]: ...


def read_shore_names(path: Path) -> tuple[BBox | None, list[ShorePlace]]:
    """A file of places: its area and its places, those with a name and a
    position; the others are left out."""
    data = json.loads(path.read_text(encoding="utf-8"))
    bbox: BBox | None = None
    if data.get("bbox"):
        south, west, north, east = (float(v) for v in data["bbox"])
        bbox = (south, west, north, east)
    return bbox, [p for p in map(_place, data.get("places", [])) if p is not None]


def _place(row: Any) -> ShorePlace | None:
    if not isinstance(row, dict):
        return None
    name = str(row.get("name") or "").strip()
    try:
        point = (float(row["lat"]), float(row["lon"]))
    except (KeyError, TypeError, ValueError):
        return None
    if not name or not all(math.isfinite(v) for v in point):
        return None
    return ShorePlace(name=name, kind=str(row.get("kind") or "place"), point=point)


class FileShoreNames:
    """The places of one file, whatever the area asked: fixtures."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def places(self, bbox: BBox) -> list[ShorePlace]:
        return read_shore_names(self.path)[1]


class FolderShoreNames:
    """The places of every file in `<cache_dir>/shore_names/` whose area
    meets the one asked, those inside it, each once. No folder, no file or
    a file that cannot be read: no places."""

    def __init__(self, cache_dir: Path) -> None:
        self.folder = cache_dir / FOLDER

    def places(self, bbox: BBox) -> list[ShorePlace]:
        found: dict[tuple[str, str, LatLon], ShorePlace] = {}
        for path in sorted(self.folder.glob("*.json")):
            try:
                covers, places = read_shore_names(path)
            except (OSError, ValueError):
                continue
            if covers is not None and not _meet(covers, bbox):
                continue
            for place in places:
                if _inside(place.point, bbox):
                    found.setdefault((place.name, place.kind, place.point), place)
        return list(found.values())


def _meet(a: BBox, b: BBox) -> bool:
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


def _inside(point: LatLon, bbox: BBox) -> bool:
    lat, lon = point
    return bbox[0] <= lat <= bbox[2] and bbox[1] <= lon <= bbox[3]


def landmarks(
    turns: Sequence[SwimTurn],
    places: Sequence[ShorePlace],
    reach_m: float = LANDMARK_REACH_M,
) -> list[Landmark | None]:
    """For each turn, the place with a name nearest it within `reach_m`,
    the first by name among equals, and the direction to look at it; None
    where there is none."""
    out: list[Landmark | None] = []
    for turn in turns:
        best: tuple[float, str, ShorePlace] | None = None
        for place in places:
            away = haversine_m(turn.point, place.point)
            if away <= reach_m and (best is None or (away, place.name) < best[:2]):
                best = (away, place.name, place)
        if best is None:
            out.append(None)
            continue
        away, _, place = best
        out.append(
            Landmark(
                name=place.name,
                kind=place.kind,
                point=place.point,
                distance_m=round(away, 1),
                bearing_deg=round(_bearing(turn.point, place.point), 1),
            )
        )
    return out


def _bearing(origin: LatLon, point: LatLon) -> float:
    """From `origin` to `point`, in degrees clockwise from north, [0, 360)."""
    east, north = latlon_to_local(origin, point)
    return math.degrees(math.atan2(east, north)) % 360.0
