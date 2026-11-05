"""The personal bests of an account (TASK-368, ADR-0312, docs/API.md,
«Profile»): the fastest time over each distance, on foot and by bike, taken
from the best stretch inside any run it saved, private, group and imported
ones too (the user's choice, 2026-11-02).

How a stretch is timed (the user's choice 8):

- it starts at a point of the track and ends at the exact metre of the
  distance, between two points;
- the metres are those of the run (activities.recorded): along the track,
  none across a pause the runner made;
- the seconds are moving ones: those of every pause inside it are left out;
- a stretch with a jump of the GPS in it (faster than the sport's
  MAX_STEP_KMH between two points) does not count, the rest of the run does;
- a time under the world record of the distance is not believed.

Each run keeps its own bests (`run_bests`, migration 0042), for both sports
whatever it was: a run whose sport changes when its drawing is published
(drawings.py) needs nothing counted again. The profile takes the best of
the runs of the sport they are now; a run deleted takes its bests with it,
and the next best is there already.

What the profile shows of them is profile_bests.py's. Pure: no database
but keep_run_bests, which writes in the transaction it is given.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, Protocol, cast

import numpy as np
from psycopg import Connection
from psycopg.rows import DictRow
from route_engine.track_score import TrackPoint

from shaperoute_api.sports import API_SPORTS
from shaperoute_api.sports.base import Distance, SportBests
from shaperoute_api.sports.cycling import BY_BIKE, BY_BIKE_KMH  # noqa: F401
from shaperoute_api.sports.running import ON_FOOT  # noqa: F401

Sport = Literal["running", "cycling"]

# The bests of each sport that has them, in the order of the sports
# (shaperoute_api/sports, TASK-376): the rules of each are in its file.
SPORTS: dict[Sport, SportBests] = {
    cast(Sport, sport.activity): sport.bests
    for sport in API_SPORTS
    if sport.bests is not None
}

EARTH_RADIUS_M = 6_371_008.8
# A run whose metres round to the distance covers it, as distance_m rounds
# them: 9999.6 m are a 10K. Under a second at any pace.
ROUNDING_M = 0.5


class PauseLike(Protocol):
    """A pause of a run (activities.Pause): seconds since its first point."""

    @property
    def from_s(self) -> float: ...
    @property
    def to_s(self) -> float: ...
    @property
    def auto(self) -> bool: ...


@dataclass(frozen=True)
class RunBest:
    sport: Sport
    distance: str
    seconds: int


@dataclass(frozen=True)
class _Track:
    """The track as the sliding windows read it, one value a point."""

    metres: np.ndarray
    """Along the track from its first point, none across a pause."""
    moving_s: np.ndarray
    """Seconds since the first point, the pauses left out."""
    step_m: np.ndarray
    step_s: np.ndarray
    """Of the step that ends at each point; 0 at the first."""


def _steps_m(track: Sequence[TrackPoint]) -> np.ndarray:
    """The metres of each step, as haversine_m counts them for distance_m."""
    lat = np.radians([p.lat for p in track])
    lon = np.radians([p.lon for p in track])
    a = (
        np.sin(np.diff(lat) / 2) ** 2
        + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(np.diff(lon) / 2) ** 2
    )
    return np.concatenate(
        ([0.0], 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(np.clip(a, 0, 1))))
    )


def _merged(pauses: Sequence[PauseLike]) -> list[tuple[float, float]]:
    spans: list[tuple[float, float]] = []
    for pause in sorted(pauses, key=lambda p: p.from_s):
        if pause.to_s <= pause.from_s:
            continue
        if spans and pause.from_s <= spans[-1][1]:
            spans[-1] = (spans[-1][0], max(spans[-1][1], pause.to_s))
        else:
            spans.append((pause.from_s, pause.to_s))
    return spans


def _read(track: Sequence[TrackPoint], pauses: Sequence[PauseLike]) -> _Track:
    seconds = np.array([p.time_s or 0.0 for p in track], dtype=float)
    step_m = _steps_m(track)
    # A step the runner paused in is not run (activities._stopped_between):
    # the pause begins at its first point or after it.
    for pause in pauses:
        if not pause.auto:
            k = int(np.searchsorted(seconds, pause.from_s, side="right"))
            if 0 < k < len(seconds):
                step_m[k] = 0.0
    moving_s = seconds.copy()
    for start, end in _merged(pauses):
        moving_s -= np.clip(seconds - start, 0, end - start)
    step_s = np.concatenate(([0.0], np.diff(seconds)))
    return _Track(np.cumsum(step_m), moving_s, step_m, step_s)


def _best_s(read: _Track, jumps: np.ndarray, distance: Distance) -> int | None:
    """The fastest moving seconds of a stretch of `distance`, or None."""
    metres, moving = read.metres, read.moving_s
    reach = distance.metres - ROUNDING_M
    # For each start, the first point at or past the distance.
    ends = np.searchsorted(metres, metres + reach, side="left")
    starts = np.nonzero(ends < len(metres))[0]
    if len(starts) == 0:
        return None
    ends = ends[starts]
    # A stretch with a jump in it does not count: none from its start to
    # the step that reaches the distance.
    clean = jumps[ends] == jumps[starts]
    starts, ends = starts[clean], ends[clean]
    if len(starts) == 0:
        return None
    before = ends - 1
    gap = metres[ends] - metres[before]
    share = (metres[starts] + reach - metres[before]) / gap
    seconds = moving[before] + share * (moving[ends] - moving[before]) - moving[starts]
    seconds = np.rint(seconds)
    believed = seconds[seconds >= distance.record_s]
    if len(believed) == 0:
        return None
    return int(believed.min())


def bests(
    track: Sequence[TrackPoint], pauses: Sequence[PauseLike], sport: Sport
) -> dict[str, int]:
    """The best seconds over each distance of `sport` the run covers, by the
    name of the distance. `track` as activities.recorded keeps it: every
    point with its time since the first."""
    if len(track) < 2:
        return {}
    rules = SPORTS[sport]
    read = _read(track, pauses)
    limit = rules.max_step_kmh / 3.6
    jump = (read.step_m > limit * read.step_s) & (read.step_m > 0)
    # How many jumps up to each point: a stretch is clean when the count at
    # its end is the count at its start.
    jumps = np.cumsum(jump)
    found: dict[str, int] = {}
    for distance in rules.distances:
        best = _best_s(read, jumps, distance)
        if best is not None:
            found[distance.name] = best
    return found


def run_bests(
    track: Sequence[TrackPoint], pauses: Sequence[PauseLike]
) -> list[RunBest]:
    """The bests of a run for both sports, whatever it was."""
    return [
        RunBest(sport, name, seconds)
        for sport in SPORTS
        for name, seconds in bests(track, pauses, sport).items()
    ]


def keep_run_bests(
    conn: Connection[DictRow], run_id: int, found: list[RunBest]
) -> None:
    """The bests of a run, over those it had: in the run's transaction."""
    conn.execute("DELETE FROM run_bests WHERE run_id = %s", (run_id,))
    if found:
        conn.cursor().executemany(
            "INSERT INTO run_bests (run_id, sport, distance, seconds)"
            " VALUES (%s, %s, %s, %s)",
            [(run_id, b.sport, b.distance, b.seconds) for b in found],
        )
