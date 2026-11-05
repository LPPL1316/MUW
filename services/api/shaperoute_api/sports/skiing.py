"""A day of alpine skiing, recorded without a shape (TASK-375, ADR-0319;
TASK-376). Its speeds are no runner's nor rider's: no personal best."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

SPORT = ApiSport(activity="skiing", strava_type="AlpineSki", record_only=True)
