"""A walk, drawn as a run on the same foot network (TASK-371, ADR-0315;
TASK-376): a run's zones, no bests of its own."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

# Its GPX says "walking" in <type>; a run's says nothing, as before.
SPORT = ApiSport(
    activity="walking",
    strava_type="Walk",
    description="walking on the foot network of a run (TASK-371)",
    gpx_type="walking",
)
