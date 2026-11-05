"""The VO₂ max MuW estimates from the running bests (TASK-397, ADR-0332,
point 3), for a profile whose phone sent no value from Apple Health or
Health Connect.

Daniels and Gilbert's VDOT of each best of the last 365 days from the 5K
to the marathon, the highest one, rounded: the oxygen a race at that speed
costs, over the share of the maximum a runner holds for that long. The 60K
is left out: past four hours the share no longer holds. A number outside
20–90 is no estimate. Worked out on every read from run_bests (TASK-368):
nothing to keep in step when a best changes or a run is deleted.

Pure, but recent_bests_sql, a subquery for profiles.py.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from shaperoute_api.sports.running import ON_FOOT

DISTANCES = ("5k", "10k", "15k", "half", "30k", "marathon")
METRES = {d.name: d.metres for d in ON_FOOT.distances if d.name in DISTANCES}
DAYS = 365
LOWEST = 20
HIGHEST = 90


@dataclass(frozen=True)
class RecentBest:
    """The fastest moving seconds over a distance in the last DAYS days."""

    distance: str
    seconds: int
    run_on: date


@dataclass(frozen=True)
class Estimate:
    value: int
    distance: str
    run_on: date


def vdot(metres: float, seconds: float) -> float:
    """Daniels and Gilbert: v in metres a minute, t in minutes."""
    t = seconds / 60
    v = metres / t
    oxygen = -4.60 + 0.182258 * v + 0.000104 * v * v
    share = (
        0.8 + 0.1894393 * math.exp(-0.012778 * t) + 0.2989558 * math.exp(-0.1932605 * t)
    )
    return oxygen / share


def rounded(value: float) -> int:
    """Half up, as one reads it: 49.5 is 50."""
    return math.floor(value + 0.5)


def estimate(bests: Iterable[RecentBest]) -> Estimate | None:
    """The highest VDOT of the bests, or None: no best of these distances,
    or a number outside LOWEST–HIGHEST. Between two equal values the
    shorter distance."""
    found: Estimate | None = None
    kept = [b for b in bests if b.distance in METRES and b.seconds > 0]
    for best in sorted(kept, key=lambda b: DISTANCES.index(b.distance)):
        value = rounded(vdot(METRES[best.distance], best.seconds))
        if found is None or value > found.value:
            found = Estimate(value, best.distance, best.run_on)
    if found is None or not LOWEST <= found.value <= HIGHEST:
        return None
    return found


def recent_bests_sql(user_column: str, since: str) -> str:
    """The running bests of the account in `user_column` of the runs begun
    from `since` (a placeholder or a column), as a subquery: a JSON array of
    {"distance", "seconds", "run_on"}, one per distance of DISTANCES, empty
    without one. Private runs too, as the profile's bests (ADR-0312)."""
    names = ", ".join(f"'{name}'" for name in DISTANCES)
    return (
        "(SELECT COALESCE(json_agg(json_build_object('distance', best.distance,"
        " 'seconds', best.seconds, 'run_on', best.run_on)), '[]'::json)"
        " FROM (SELECT DISTINCT ON (b.distance) b.distance, b.seconds,"
        " (r.started_at AT TIME ZONE 'UTC')::date AS run_on"
        " FROM run_bests b JOIN runs r ON r.id = b.run_id AND r.activity = b.sport"
        f" WHERE r.user_id = {user_column} AND b.sport = 'running'"
        f" AND b.distance IN ({names}) AND r.started_at >= {since}"
        " ORDER BY b.distance, b.seconds, r.started_at, r.id) best)"
    )
