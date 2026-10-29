"""The turns of a swim (TASK-323 A2, ADR-0283).

In the water a swimmer does not look at a phone and does not hear a voice:
before going in they see where to turn, and in the water they lift their
head towards a point on the shore. A turn is where the route changes
direction by more than TURN_MIN_DEG, looked at over TURN_WINDOW_M before
and after the point: the tips of a star and the cusp of a heart are turns,
the curve of a circle is not. Each turn says how far from the start it is,
which way (left or right) and by how much, and in which lap; shore_names.py
gives it the place on the shore to turn opposite.

The turns are data of the engine, as the route is: the app and the watch
say them in their own words. In the GPX they are waypoints, one for each
turn of the first lap (`with_turns`): the laps after turn at the same places.

Metres on the plane tangent at the start of the route; (lat, lon) in and
out. Nothing else in the engine imports this module (route_store.SWIM_ONLY).
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Literal

import numpy as np

from route_engine.export_gpx import COORDINATE_DECIMALS, GPX_NAMESPACE
from route_engine.geo import LatLon, latlon_to_local_array

# A change of direction larger than this is a turn: a swimmer lifts the
# head to find the next point.
TURN_MIN_DEG = 45.0
# The direction in and out of a point is looked at over this many metres:
# a sharp corner turns within it, the curve of a circle (100 m across or
# more) turns by less than 20° in it.
TURN_WINDOW_M = 15.0

Side = Literal["left", "right"]


@dataclass(frozen=True)
class Landmark:
    """A place with a name on the shore, to turn opposite (shore_names)."""

    name: str
    # What it is, from OpenStreetMap: "beach_resort", "pier", "lighthouse"...
    kind: str
    point: LatLon
    # From the turn, and the direction to look, clockwise from north.
    distance_m: float
    bearing_deg: float


@dataclass(frozen=True)
class SwimTurn:
    """Where the route turns: the point, metres from the start of the
    swim, which way and by how much (0-180°), the lap (from 1), and the
    place on the shore to turn opposite, when there is one."""

    point: LatLon
    at_m: float
    side: Side
    angle_deg: float
    lap: int = 1
    landmark: Landmark | None = None


def swim_turns(
    points: Sequence[LatLon],
    *,
    laps: int = 1,
    leg_m: float = 0.0,
    lap_m: float | None = None,
) -> list[SwimTurn]:
    """The turns of a route, in order: every point where the direction in
    (over TURN_WINDOW_M before it) and out (over TURN_WINDOW_M after it)
    differ by more than TURN_MIN_DEG, the sharpest of each run of such
    points. The first and the last point, on the shore, are no turns.

    With the laps of a swim (`laps`, the leg from the shore `leg_m` and
    the length of one lap `lap_m`, as swimming.SwimPlan has them) each
    turn says its lap; else every turn is in lap 1."""
    if len(points) < 3:
        return []
    xy = latlon_to_local_array(points[0], np.asarray(points, dtype=float))
    along = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
    total = float(along[-1])
    found: list[tuple[int, float]] = []  # (index, signed degrees)
    for i in range(1, len(xy) - 1):
        if along[i] < 1e-6 or total - along[i] < 1e-6:
            continue
        before = _at(xy, along, along[i] - TURN_WINDOW_M)
        after = _at(xy, along, along[i] + TURN_WINDOW_M)
        angle = _turned(xy[i] - before, after - xy[i])
        if abs(angle) > TURN_MIN_DEG:
            found.append((i, angle))
    turns: list[SwimTurn] = []
    for run in _runs(found, along):
        i, angle = max(run, key=lambda item: (abs(item[1]), -item[0]))
        at_m = float(along[i])
        turns.append(
            SwimTurn(
                point=(float(points[i][0]), float(points[i][1])),
                at_m=at_m,
                side="left" if angle > 0 else "right",
                angle_deg=round(abs(angle), 1),
                lap=_lap(at_m, laps, leg_m, lap_m),
            )
        )
    return turns


def _at(xy: np.ndarray, along: np.ndarray, metres: float) -> np.ndarray:
    """The point `metres` along the line, held at its ends."""
    metres = min(max(metres, 0.0), float(along[-1]))
    k = int(np.searchsorted(along, metres, side="right") - 1)
    k = min(max(k, 0), len(xy) - 2)
    span = along[k + 1] - along[k]
    t = 0.0 if span <= 0 else (metres - along[k]) / span
    point: np.ndarray = xy[k] + (xy[k + 1] - xy[k]) * t
    return point


def _turned(come: np.ndarray, go: np.ndarray) -> float:
    """How far the direction turns from `come` to `go`, in degrees in
    (-180, 180]: positive to the left (counterclockwise)."""
    if np.hypot(*come) < 1e-9 or np.hypot(*go) < 1e-9:
        return 0.0
    cross = come[0] * go[1] - come[1] * go[0]
    dot = come[0] * go[0] + come[1] * go[1]
    return math.degrees(math.atan2(cross, dot))


def _runs(
    found: Sequence[tuple[int, float]], along: np.ndarray
) -> list[list[tuple[int, float]]]:
    """`found` cut where two points are more than TURN_WINDOW_M apart along
    the line, or turn opposite ways: each run is one turn."""
    runs: list[list[tuple[int, float]]] = []
    for item in found:
        last = runs[-1][-1] if runs else None
        if (
            last is not None
            and along[item[0]] - along[last[0]] <= TURN_WINDOW_M
            and (item[1] > 0) == (last[1] > 0)
        ):
            runs[-1].append(item)
        else:
            runs.append([item])
    return runs


def _lap(at_m: float, laps: int, leg_m: float, lap_m: float | None) -> int:
    if laps <= 1 or not lap_m:
        return 1
    return min(max(int((at_m - leg_m) // lap_m) + 1, 1), laps)


def named(
    turns: Sequence[SwimTurn], landmarks: Sequence[Landmark | None]
) -> list[SwimTurn]:
    """`turns` with the landmark found for each (shore_names.landmarks)."""
    return [replace(t, landmark=mark) for t, mark in zip(turns, landmarks, strict=True)]


# --- The GPX ----------------------------------------------------------------


def turn_label(turn: SwimTurn) -> str:
    """The name of a turn's waypoint: «Turn left», «Turn right · Bagno 54»."""
    label = f"Turn {turn.side}"
    return label if turn.landmark is None else f"{label} · {turn.landmark.name}"


def with_turns(gpx: str, turns: Sequence[SwimTurn]) -> str:
    """The GPX document `gpx` (export_gpx.to_gpx) with a waypoint for each
    turn of the first lap, before the track as GPX 1.1 wants them: its name
    (`turn_label`) and the type "turn"."""
    ET.register_namespace("", GPX_NAMESPACE)
    root = ET.fromstring(gpx)
    first = next(
        (k for k, child in enumerate(root) if child.tag in _AFTER_WPT), len(root)
    )
    for offset, turn in enumerate(t for t in turns if t.lap == 1):
        lat, lon = turn.point
        wpt = ET.Element(
            f"{{{GPX_NAMESPACE}}}wpt",
            {
                "lat": f"{lat:.{COORDINATE_DECIMALS}f}",
                "lon": f"{lon:.{COORDINATE_DECIMALS}f}",
            },
        )
        ET.SubElement(wpt, f"{{{GPX_NAMESPACE}}}name").text = turn_label(turn)
        ET.SubElement(wpt, f"{{{GPX_NAMESPACE}}}type").text = "turn"
        root.insert(first + offset, wpt)
    ET.indent(root)
    body = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{body}\n'


# GPX 1.1 puts the waypoints after `metadata` and before these.
_AFTER_WPT = frozenset(
    f"{{{GPX_NAMESPACE}}}{tag}" for tag in ("rte", "trk", "extensions")
)
