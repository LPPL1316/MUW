"""A swim in open water (TASK-323; TASK-376)."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

# Strava's "Swim": it has no open-water type of its own.
SPORT = ApiSport(
    activity="swimming",
    strava_type="Swim",
    description="swimming 20-150 m from the shore, lap after lap, a shape of "
    "the catalogue or a drawing (TASK-323)",
)
