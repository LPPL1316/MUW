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
from typing import Literal, Protocol

import numpy as np
from psycopg import Connection
from psycopg.rows import DictRow
from route_engine.track_score import TrackPoint

Sport = Literal["running", "cycling"]


@dataclass(frozen=True)
class Distance:
    name: str
    """What the app names it with: 5k, half, marathon, 160k."""
    metres: float
    record_s: int
    """The fastest time anyone ever made over it, rounded down: a time
    faster than this is not believed."""


@dataclass(frozen=True)
class SportBests:
    max_step_kmh: float
    distances: tuple[Distance, ...]


def _at_speed(metres: float, kmh: float) -> int:
    return int(metres / (kmh / 3.6))


# On foot (the user's choice 1). The men's records, World Athletics, as of
# 2026-11: 5000 m 12:35.36 (Cheptegei, 2020), 10,000 m 26:11.00 (Cheptegei,
# 2020), half marathon 56:42 (Kiplimo, 2025), marathon 2:00:35 (Kiptum,
# 2023). No record is kept over 15, 30 and 60 km: the floor is a round time
# under what the best ever ran there on the way to a longer race. Rounded
# down, a floor never refuses a true time.
ON_FOOT = SportBests(
    max_step_kmh=25,
    distances=(
        Distance("5k", 5_000, 755),
        Distance("10k", 10_000, 1_571),
        Distance("15k", 15_000, 40 * 60),
        Distance("half", 21_097.5, 3_402),
        Distance("30k", 30_000, 85 * 60),
        Distance("marathon", 42_195, 7_235),
        Distance("60k", 60_000, 180 * 60),
    ),
)

# By bike (the user's choice 3). No road record is kept over these
# distances, and a descent goes faster than the hour record (56.792 km,
# Ganna, 2022): the floor is the speed of a jump of the GPS, 90 km/h
# throughout (decided by the agent on the user's behalf, ADR-0312).
BY_BIKE_KMH = 90
BY_BIKE = SportBests(
    max_step_kmh=BY_BIKE_KMH,
    distances=tuple(
        Distance(f"{km}k", km * 1_000, _at_speed(km * 1_000, BY_BIKE_KMH))
        for km in (10, 20, 40, 50, 100, 160)
    ),
)

SPORTS: dict[Sport, SportBests] = {"running": ON_FOOT, "cycling": BY_BIKE}

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


def keep_run_bests(conn: Connection[DictRow], run_id: int, found: list[RunBest]) -> None:
    """The bests of a run, over those it had: in the run's transaction."""
    conn.execute("DELETE FROM run_bests WHERE run_id = %s", (run_id,))
    if found:
        conn.cursor().executemany(
            "INSERT INTO run_bests (run_id, sport, distance, seconds)"
            " VALUES (%s, %s, %s, %s)",
            [(run_id, b.sport, b.distance, b.seconds) for b in found],
        )
