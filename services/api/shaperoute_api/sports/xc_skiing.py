"""A day of cross-country skiing, recorded without a shape (TASK-372,
TASK-375, ADR-0319; TASK-376)."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

SPORT = ApiSport(activity="xc_skiing", strava_type="NordicSki", record_only=True)
