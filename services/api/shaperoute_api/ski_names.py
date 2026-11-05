"""The lifts taken and the pistes skied in a day, by name (TASK-375 part D,
ADR-0319).

The track of a saved day of skiing is matched with the lifts and pistes of
OpenStreetMap (ski_extract.py), on the server: the position goes to no
other service. In metres, on the plane tangent at the track's box:

- a **ride** is a stretch of the track within NEAR_M of a lift that moves
  along it, from the bottom up as OSM draws lifts, for at least LIFT_COVER
  of its length. Skiing down under a chairlift, or walking beside a few
  metres of it, is no ride. Of two lifts side by side the nearer has it;
- a **piste** is skied where the track, off the rides, stays within NEAR_M
  of a piste with that name for at least PISTE_MIN_M. A piste made of
  several ways is one name; a few fixes away from it (GAP_FIXES) do not cut
  it in two. Pistes without a name are not counted.

Each lift and each piste comes once, in the order of the day, with how many
times it was taken or skied.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import shapely
from route_engine.geo import LatLon, latlon_to_local_array

from shaperoute_api.ski_extract import BBox, Kind, SkiLine, box_of, read_lines

# How far the track may be from a lift's cable or a piste's line: GPS on
# the snow, and a piste mapped down its middle, are 10–20 m off.
NEAR_M = 30.0
# A ride covers this much of its lift at least: a lift's last fixes before
# the station, or a stop at a middle station, still count.
LIFT_COVER = 0.6
# A piste counts after this much of the track on it.
PISTE_MIN_M = 150.0
# Fixes off a lift or a piste that do not end the stretch.
GAP_FIXES = 3
# Going back along a lift by more than this ends a climb: a fix of a ride
# is 10–20 m off along the cable too.
BACK_M = 50.0


@dataclass(frozen=True)
class Used:
    """A lift taken or a piste skied: its name (a lift may have none, then
    its type says what it is), its type or difficulty, and how many times."""

    kind: Kind
    name: str | None
    type: str
    times: int


@dataclass(frozen=True)
class SkiNames:
    lifts: tuple[Used, ...]
    pistes: tuple[Used, ...]


NOTHING = SkiNames(lifts=(), pistes=())


def ski_names_from(points: Sequence[LatLon], cache_dir: Path) -> SkiNames:
    """`ski_names` with the lines of the tiles around the track."""
    if len(points) < 2:
        return NOTHING
    return ski_names(points, read_lines(cache_dir, _grown(box_of(points))))


def ski_names(points: Sequence[LatLon], lines: Sequence[SkiLine]) -> SkiNames:
    """The lifts and pistes of `lines` the track through `points` used."""
    if len(points) < 2 or not lines:
        return NOTHING
    south, west, north, east = box_of(points)
    origin = ((south + north) / 2.0, (west + east) / 2.0)
    xy = latlon_to_local_array(origin, np.array(points, dtype=float))
    fixes = shapely.points(xy)
    steps = np.hypot(*np.diff(xy, axis=0).T)

    def shape(line: SkiLine) -> shapely.Geometry:
        local = latlon_to_local_array(origin, np.array(line.points, dtype=float))
        if line.area and len(local) >= 4:
            return shapely.Polygon(local)
        return shapely.LineString(local)

    lifts = [line for line in lines if line.kind == "lift"]
    pistes = [line for line in lines if line.kind == "piste" and line.name]
    rides = _rides(fixes, lifts, [shape(line) for line in lifts])
    on_lift = np.zeros(len(points), dtype=bool)
    for start, end, _ in rides:
        on_lift[start : end + 1] = True
    skied = _skied(fixes, steps, on_lift, pistes, [shape(p) for p in pistes])
    taken: list[SkiLine] = []
    last_end = -GAP_FIXES - 2
    for start, end, k in rides:
        # The second section of a lift with a middle station, ridden on.
        same = bool(taken) and lifts[k].name and taken[-1].name == lifts[k].name
        if not (same and start - last_end <= GAP_FIXES + 1):
            taken.append(lifts[k])
        last_end = end
    return SkiNames(lifts=_counted(taken), pistes=_counted(skied))


def _grown(bbox: BBox) -> BBox:
    south, west, north, east = bbox
    dlat = NEAR_M / 111_320
    dlon = NEAR_M / (111_320 * np.cos(np.radians((south + north) / 2)))
    return south - dlat, west - dlon, north + dlat, east + dlon


def _stretches(indices: Sequence[int]) -> list[list[int]]:
    """`indices`, sorted, cut where more than GAP_FIXES fixes are missing."""
    out: list[list[int]] = []
    for i in indices:
        if out and i - out[-1][-1] <= GAP_FIXES + 1:
            out[-1].append(i)
        else:
            out.append([i])
    return out


def _rides(
    fixes: np.ndarray, lifts: Sequence[SkiLine], shapes: Sequence[shapely.Geometry]
) -> list[tuple[int, int, int]]:
    """(first fix, last fix, lift index) of each ride, in the order of the
    day; where two overlap, the one nearer to its lift on average."""
    if not lifts:
        return []
    tree = shapely.STRtree(shapes)
    hits = tree.query(fixes, predicate="dwithin", distance=NEAR_M)
    near: dict[int, list[int]] = {}
    for fix, lift in zip(hits[0], hits[1], strict=True):
        near.setdefault(int(lift), []).append(int(fix))
    found: list[tuple[float, int, int, int]] = []
    for k, indices in near.items():
        cable = shapes[k]
        for stretch in _stretches(sorted(indices)):
            along = shapely.line_locate_point(cable, fixes[stretch])
            for low, high in _climbs(along, LIFT_COVER * cable.length):
                ride = stretch[low : high + 1]
                off = float(np.mean(shapely.distance(cable, fixes[ride])))
                found.append((off, ride[0], ride[-1], k))
    kept: list[tuple[int, int, int]] = []
    for _, start, end, k in sorted(found):
        if not any(_overlap((start, end), (s, e)) for s, e, _ in kept):
            kept.append((start, end, k))
    return sorted(kept)


def _climbs(along: np.ndarray, need_m: float) -> list[tuple[int, int]]:
    """(lowest, highest) positions of each climb of at least `need_m` along
    a lift: a ride up, then skiing down beside the same lift, then another
    ride are two climbs. Going back by less than BACK_M is GPS, not the
    end of a climb."""
    out: list[tuple[int, int]] = []
    low = high = 0
    for t in range(1, len(along)):
        if low == high and along[t] < along[low]:
            low = high = t
        elif along[t] > along[high]:
            high = t
        elif along[high] - along[t] > BACK_M:
            if along[high] - along[low] >= need_m:
                out.append((low, high))
            low = high = t
    if along[high] - along[low] >= need_m:
        out.append((low, high))
    return out


def _overlap(a: tuple[int, int], b: tuple[int, int]) -> bool:
    """Two rides on the same fixes for more than half of the shorter: two
    lifts side by side. The sections of a lift with a middle station share
    a fix or two, and both count."""
    shared = min(a[1], b[1]) - max(a[0], b[0]) + 1
    return shared > 0.5 * min(a[1] - a[0] + 1, b[1] - b[0] + 1)


def _skied(
    fixes: np.ndarray,
    steps: np.ndarray,
    on_lift: np.ndarray,
    pistes: Sequence[SkiLine],
    shapes: Sequence[shapely.Geometry],
) -> list[SkiLine]:
    """A piste for each time the track skied it, in the order of the day."""
    if not pistes:
        return []
    tree = shapely.STRtree(shapes)
    free = np.flatnonzero(~on_lift)
    hits = tree.query_nearest(fixes[free], max_distance=NEAR_M)
    by_name: dict[str, list[int]] = {}
    first: dict[str, SkiLine] = {}
    for fix, piste in zip(hits[0], hits[1], strict=True):
        line = pistes[int(piste)]
        assert line.name is not None
        by_name.setdefault(line.name, []).append(int(free[int(fix)]))
        first.setdefault(line.name, line)
    passes: list[tuple[int, SkiLine]] = []
    for name, indices in by_name.items():
        for stretch in _stretches(sorted(set(indices))):
            if float(steps[stretch[0] : stretch[-1]].sum()) >= PISTE_MIN_M:
                passes.append((stretch[0], first[name]))
    return [line for _, line in sorted(passes, key=lambda p: p[0])]


def _counted(used: Sequence[SkiLine]) -> tuple[Used, ...]:
    """Each lift or piste once, by its name (a lift without one by its
    way), in the order of its first use, with how many times."""
    times: dict[object, int] = {}
    lines: dict[object, SkiLine] = {}
    for line in used:
        key: object = line.name if line.name else line.id
        times[key] = times.get(key, 0) + 1
        lines.setdefault(key, line)
    return tuple(
        Used(kind=lines[k].kind, name=lines[k].name, type=lines[k].type, times=n)
        for k, n in times.items()
    )
