"""What the API knows of a sport (TASK-376, ADR-0320): one ApiSport in a file
of its own, shaperoute_api/sports/<activity>.py, and the tables of before
derived from them (strava.SPORT_TYPES, activity_graphs.ZONES_IN_MEMORY,
personal_bests.SPORTS, activities.RECORD_ACTIVITIES, prefetch_zones,
run_gpx.GPX_TYPES, schemas.ACTIVITY_DESCRIPTION).

Data and its own rules only: what reads a sport imports this, never the
other way round. The phone's engine takes it too (activity_graphs, schemas):
no database, no web framework here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


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


def at_speed(metres: float, kmh: float) -> int:
    """The seconds over `metres` at `kmh`, rounded down."""
    return int(metres / (kmh / 3.6))


@dataclass(frozen=True)
class Zones:
    """The cached zones of a sport drawn on roads (TASK-190, ADR-0153)."""

    box: Literal["explore", "longest"]
    """The area prefetched around a city: what "Explore" asks of it
    (prefetch_zones.zone_box), or the sport's longest route with every shape
    of the catalogue (prefetch_zones.longest_route_box)."""
    street_names: bool
    """Whether the zones keep the street names (ADR-0057)."""
    in_memory: int | None = None
    """Zones kept in memory at once; None, graphs.MAX_ZONES."""


@dataclass(frozen=True)
class ApiSport:
    activity: str
    """The name of the contract (packages/shared-types RUN_ACTIVITIES)."""
    strava_type: str
    """What Strava calls it (strava.SPORT_TYPES, TASK-208)."""
    description: str | None = None
    """Its words in the API's description of `activity`, if any."""
    record_only: bool = False
    """Recorded without a shape, never planned (TASK-375, ADR-0319)."""
    trackless: bool = False
    """Saved without a track, never planned nor sent to Strava (TASK-385,
    ADR-0327): a workout at the gym."""
    zones: Zones | None = None
    """Drawn on roads: its zones. None on the water, a walk on a run's,
    a day on the snow on none."""
    bests: SportBests | None = None
    """Its personal bests (TASK-368, ADR-0312), if it has any."""
    gpx_type: str | None = None
    """The `<type>` of its track's GPX; None, a run's file as before."""
