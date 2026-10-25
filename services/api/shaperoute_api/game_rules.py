"""The rules of the shape game (TASK-296, ADR-0255, docs/GIOCO.md): pure.

A saved run in, what it is worth to the game out: whether it counts, the
metres that count, and the best moving times over a few distances. Then the
totals of an account in, what its shapes need and how far along each is.
Nothing here reads the database, the network or a clock, so every rule has
deterministic tests (tests/test_game_rules.py).

The track is the one `runs` keeps: the engine's cleaning already dropped the
fixes too uncertain, repeated, or jumping faster than 12 m/s (clean_track),
and the accuracy is not kept. So these rules read positions, times and the
pauses only. What they catch and what they cannot is in docs/GIOCO.md, §4.
"""

from __future__ import annotations

import bisect
import math
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field

from route_engine.geo import haversine_m

# Raised whenever a rule below changes: game_backfill.py computes the runs
# again.
RULES_VERSION = 1

# A stretch of at least VEHICLE_WINDOW_M covered faster than this is not
# run: 2:23 a kilometre, quicker than a world record over 1500 m.
VEHICLE_SPEED_MPS = 7.0
VEHICLE_WINDOW_M = 200.0
# A run with more than this share of such stretches is not counted at all.
VEHICLE_SHARE = 0.10
# Nor is one faster than this on average, moving, over more than
# MEAN_SPEED_FROM_M.
MAX_MEAN_SPEED_MPS = 6.0
MEAN_SPEED_FROM_M = 3_000.0
# Two fixes further apart than this in time: the step between them counts
# in the metres, never inside a best time.
MAX_GAP_S = 30.0
# A best time needs, on average, a fix at least this often.
MAX_FIX_INTERVAL_S = 10.0
# The metres of one account that count in one day (UTC).
DAILY_CAP_M = 120_000
# The distances of the best times, in metres: what the pace shapes ask.
BEST_DISTANCES_M: tuple[int, ...] = (1_000, 5_000, 10_000, 21_097)
# A shape not unlocked yet shows at most this much of its way.
MAX_PROGRESS = 0.99

# Why a run does not count, or counts less.
NOT_RUNNING = "not_running"
VEHICLE = "vehicle"
OVERLAP = "overlap"
DAILY_CAP = "daily_cap"
RUNNING = "running"


@dataclass(frozen=True)
class Fix:
    """A position of the kept track; `t_s` is its M, the seconds since the
    first fix, pauses included."""

    lat: float
    lon: float
    t_s: float


@dataclass(frozen=True)
class RunPause:
    """A pause as `runs.pauses` keeps it, on the clock of the fixes."""

    from_s: float
    to_s: float
    auto: bool


@dataclass(frozen=True)
class RunGame:
    """What one run is worth to the game, before the rules that need the
    other runs of the account (overlap, daily cap: game.py)."""

    counted: bool
    reason: str | None
    counted_m: int
    # Best moving seconds over each of BEST_DISTANCES_M the run covered.
    best_s: dict[int, float] = field(default_factory=dict)
    # From the first fix to the last, pauses included: when the run ended.
    elapsed_s: float = 0.0


@dataclass(frozen=True)
class _Step:
    length_m: float
    moving_s: float
    # Across a pause the runner asked for: not run (activities.recorded).
    stopped: bool
    # Longer than MAX_GAP_S between its fixes.
    gap: bool


def evaluate(
    fixes: Sequence[Fix], pauses: Sequence[RunPause], activity: str
) -> RunGame:
    """The run as the game sees it. Only runs on foot count."""
    elapsed_s = fixes[-1].t_s - fixes[0].t_s if fixes else 0.0
    if activity != RUNNING:
        return RunGame(False, NOT_RUNNING, 0, {}, elapsed_s)
    if len(fixes) < 2:
        return RunGame(True, None, 0, {}, elapsed_s)
    clock = moving_clock([f.t_s for f in fixes], pauses)
    steps = [
        _Step(
            length_m=haversine_m((a.lat, a.lon), (b.lat, b.lon)),
            moving_s=max(0.0, clock[i + 1] - clock[i]),
            stopped=_stopped_between(pauses, a.t_s, b.t_s),
            gap=b.t_s - a.t_s > MAX_GAP_S,
        )
        for i, (a, b) in enumerate(zip(fixes, fixes[1:], strict=False))
    ]
    fast = _vehicle_steps(steps)
    run_m = sum(s.length_m for s in steps if not s.stopped)
    moving_s = sum(s.moving_s for s in steps if not s.stopped)
    vehicle_m = sum(s.length_m for s, f in zip(steps, fast, strict=True) if f)
    if run_m > 0 and vehicle_m > VEHICLE_SHARE * run_m:
        return RunGame(False, VEHICLE, 0, {}, elapsed_s)
    if run_m > MEAN_SPEED_FROM_M and (
        moving_s <= 0 or run_m / moving_s > MAX_MEAN_SPEED_MPS
    ):
        return RunGame(False, VEHICLE, 0, {}, elapsed_s)
    best = best_times(steps, fast, clock)
    return RunGame(True, None, round(run_m - vehicle_m), best, elapsed_s)


def moving_clock(times: Sequence[float], pauses: Sequence[RunPause]) -> list[float]:
    """At each time of `times` (in order), the seconds since the first one
    spent outside every pause: the clock of a best time."""
    spans = _merged((p.from_s, p.to_s) for p in pauses)
    clock: list[float] = []
    paused, k = 0.0, 0
    start = times[0] if times else 0.0
    for t in times:
        # The pauses wholly before t are counted once, as k moves on.
        while k < len(spans) and spans[k][1] <= t:
            paused += max(0.0, spans[k][1] - max(spans[k][0], start))
            k += 1
        inside = max(0.0, t - max(spans[k][0], start)) if k < len(spans) else 0.0
        clock.append(t - start - paused - inside)
    return clock


def _merged(spans: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
    merged: list[tuple[float, float]] = []
    for start, end in sorted(spans):
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _stopped_between(pauses: Sequence[RunPause], from_s: float, to_s: float) -> bool:
    """As activities._stopped_between: a pause the runner asked for (a pen
    pause too) begins at the first fix or after it, before the second."""
    return any(not p.auto and from_s <= p.from_s < to_s for p in pauses)


def _vehicle_steps(steps: Sequence[_Step]) -> list[bool]:
    """Which steps lie in a stretch of at least VEHICLE_WINDOW_M covered
    faster than VEHICLE_SPEED_MPS. A pause the runner asked for ends a
    stretch."""
    fast = [False] * len(steps)
    start = 0
    for end in range(len(steps) + 1):
        if end == len(steps) or steps[end].stopped:
            chain = steps[start:end]
            for i, f in enumerate(_fast_in(chain)):
                fast[start + i] = f
            start = end + 1
    return fast


def _fast_in(chain: Sequence[_Step]) -> list[bool]:
    """Two indices along the chain: each window is the shortest run of
    steps from i reaching VEHICLE_WINDOW_M."""
    n = len(chain)
    fast = [False] * n
    j, length, moving, marked = 0, 0.0, 0.0, 0
    for i in range(n):
        while j < n and length < VEHICLE_WINDOW_M:
            length += chain[j].length_m
            moving += chain[j].moving_s
            j += 1
        if length < VEHICLE_WINDOW_M:
            break
        if moving <= 0 or length / moving > VEHICLE_SPEED_MPS:
            for k in range(max(i, marked), j):
                fast[k] = True
            marked = max(marked, j)
        length -= chain[i].length_m
        moving -= chain[i].moving_s
    return fast


def best_times(
    steps: Sequence[_Step], fast: Sequence[bool], clock: Sequence[float]
) -> dict[int, float]:
    """The fewest moving seconds over each of BEST_DISTANCES_M, inside one
    stretch of steps that are run, not fast and not a gap."""
    best: dict[int, float] = {}
    start = 0
    for end in range(len(steps) + 1):
        if end == len(steps) or not _timed(steps[end], fast[end]):
            if end > start:
                # Fixes start..end: steps start..end-1.
                along = [0.0]
                for step in steps[start:end]:
                    along.append(along[-1] + step.length_m)
                for distance_m in BEST_DISTANCES_M:
                    found = _fewest_s(along, clock[start : end + 1], distance_m)
                    if found is not None and found < best.get(distance_m, math.inf):
                        best[distance_m] = found
            start = end + 1
    return {d: round(s, 1) for d, s in sorted(best.items())}


def _timed(step: _Step, fast: bool) -> bool:
    return not (step.stopped or step.gap or fast)


def _fewest_s(
    along: Sequence[float], clock: Sequence[float], distance_m: float
) -> float | None:
    """The fewest seconds to cover `distance_m`: each window ends at a fix
    and begins where the distance is exactly covered, between two fixes, its
    time read in a straight line between theirs."""
    if along[-1] < distance_m:
        return None
    fewest: float | None = None
    i = 0
    for j in range(1, len(along)):
        while i + 1 < j and along[j] - along[i + 1] >= distance_m:
            i += 1
        if along[j] - along[i] < distance_m:
            continue
        begin_m = along[j] - distance_m
        side_m = along[i + 1] - along[i]
        share = (begin_m - along[i]) / side_m if side_m > 0 else 0.0
        begin_s = clock[i] + (clock[i + 1] - clock[i]) * share
        seconds = clock[j] - begin_s
        # Dense enough: on average a fix every MAX_FIX_INTERVAL_S.
        if seconds <= 0 or seconds > (j - i) * MAX_FIX_INTERVAL_S:
            continue
        if fewest is None or seconds < fewest:
            fewest = seconds
    return fewest


# --- The shapes: what they ask, and how far along an account is ---


@dataclass(frozen=True)
class DistanceGoal:
    """So many metres, counted, in all."""

    total_m: int


@dataclass(frozen=True)
class PaceGoal:
    """`distance_m` in one run at `pace_s` a kilometre or better."""

    distance_m: int
    pace_s: int

    @property
    def target_s(self) -> float:
        return self.pace_s * self.distance_m / 1000


Goal = DistanceGoal | PaceGoal


@dataclass(frozen=True)
class Totals:
    """What an account ran, as the game counts it."""

    counted_m: int
    best_s: Mapping[int, float]
    # The most metres one run counted.
    longest_m: int


def totals_of(runs: Iterable[tuple[int, Mapping[int, float]]]) -> Totals:
    """The totals of the counted runs, each as (counted_m, best_s)."""
    counted_m, longest_m = 0, 0
    best: dict[int, float] = {}
    for metres, run_best in runs:
        counted_m += metres
        longest_m = max(longest_m, metres)
        for distance_m, seconds in run_best.items():
            if seconds < best.get(distance_m, math.inf):
                best[distance_m] = seconds
    return Totals(counted_m, best, longest_m)


def reached(goal: Goal, totals: Totals) -> bool:
    if isinstance(goal, DistanceGoal):
        return totals.counted_m >= goal.total_m
    best = totals.best_s.get(goal.distance_m)
    return best is not None and best <= goal.target_s


def progress(goal: Goal, totals: Totals) -> float:
    """1 once reached; before, the share of the way, at most MAX_PROGRESS.
    A pace goal: target / best time once the distance was run in one go,
    else the longest run / the distance."""
    if reached(goal, totals):
        return 1.0
    if isinstance(goal, DistanceGoal):
        share = totals.counted_m / goal.total_m
    else:
        best = totals.best_s.get(goal.distance_m)
        if best is not None and best > 0:
            share = goal.target_s / best
        else:
            share = totals.longest_m / goal.distance_m
    return round(min(MAX_PROGRESS, max(0.0, share)), 4)


def capped_m(counted_m: int, counted_today_m: int) -> int:
    """The metres of a run that still count on a day the account already
    counted `counted_today_m`."""
    return max(0, min(counted_m, DAILY_CAP_M - counted_today_m))


# --- The pieces of a challenge: the outline cut for a team (part C) ---

Point = tuple[float, float]
# The points of a piece are rounded to this many decimals, like the
# catalog's: the phone cutting the same shape gets the same numbers.
OUTLINE_DECIMALS = 4


def pieces_of(outline: Sequence[Point], n: int) -> list[list[Point]]:
    """The closed outline cut into `n` pieces of equal length along it, from
    its first point on: piece k runs from k·L/n to (k+1)·L/n, L the length of
    the outline with each segment measured as sqrt(dx² + dy²); the last piece
    ends at L itself. A piece has its two ends, read in a straight line on
    the segment they fall in, and the outline's points strictly between them,
    all rounded to OUTLINE_DECIMALS. The phone cuts the same way
    (docs/GIOCO.md §6.2)."""
    if n < 1:
        raise ValueError("a shape is cut into at least one piece")
    points = list(outline)
    if not points:
        return [[] for _ in range(n)]
    along = [0.0]
    for (x0, y0), (x1, y1) in zip(points, points[1:], strict=False):
        along.append(along[-1] + math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2))
    length = along[-1]
    pieces: list[list[Point]] = []
    for k in range(n):
        start = length * k / n
        end = length if k == n - 1 else length * (k + 1) / n
        piece = [_point_at(points, along, start)]
        piece += [p for p, d in zip(points, along, strict=True) if start < d < end]
        piece.append(_point_at(points, along, end))
        pieces.append(
            [(round(x, OUTLINE_DECIMALS), round(y, OUTLINE_DECIMALS)) for x, y in piece]
        )
    return pieces


def _point_at(
    points: Sequence[Point], along: Sequence[float], distance: float
) -> Point:
    """The point `distance` along the outline, between two of its points."""
    if distance <= 0:
        return points[0]
    if distance >= along[-1]:
        return points[-1]
    i = bisect.bisect_right(along, distance) - 1
    side = along[i + 1] - along[i]
    share = (distance - along[i]) / side if side > 0 else 0.0
    (x0, y0), (x1, y1) = points[i], points[i + 1]
    return (x0 + (x1 - x0) * share, y0 + (y1 - y0) * share)
