"""Paddling on a lake or the sea (TASK-191; TASK-376)."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

# Stand-up paddling on Strava, the user's choice (2026-10-03).
SPORT = ApiSport(
    activity="paddling",
    strava_type="StandUpPaddling",
    description="paddling on a lake or the sea within 1 km of the shore, from "
    "a start on the shore, a shape of the catalogue only (TASK-191)",
)
