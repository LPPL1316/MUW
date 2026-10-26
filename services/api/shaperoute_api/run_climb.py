"""The metres a run climbed (TASK-305, ADR-0265, docs/API.md, «My
activities»).

The app sends the height of each fix as the phone measured it; the API
counts the climb itself, as it counts metres and seconds (activities.py),
with the rule of the end of a run on the phone (runMetrics.ts, climbM): the
sum of the rises, each at least CLIMB_STEP_M above the last height that
counted. Descents take nothing away. Only the fixes the engine believes
(clean_track) count, and nothing is climbed across a pause the runner asked
for, as nothing is run there.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

# The GPS's height wanders by a few metres standing still: as the app's.
CLIMB_STEP_M = 3.0


def climb_m(heights: Sequence[float | None], stops: Sequence[bool]) -> int | None:
    """The metres climbed along `heights`, one per fix in order; None for a
    fix without one. `stops[i]` is true when the runner paused the run
    between the fix i - 1 and the fix i: the height there counts from
    anew. None when no fix has a height: a phone that gave none, or an app
    older than TASK-305."""
    from_m: float | None = None
    climbed = 0.0
    # A pause before a fix without a height still begins anew at the next.
    anew = True
    for height, stopped in zip(heights, stops, strict=True):
        anew = anew or stopped
        if height is None or not math.isfinite(height):
            continue
        if anew or from_m is None:
            from_m, anew = height, False
        elif height - from_m >= CLIMB_STEP_M:
            climbed += height - from_m
            from_m = height
        elif from_m - height >= CLIMB_STEP_M:
            from_m = height
    return None if from_m is None else round(climbed)
