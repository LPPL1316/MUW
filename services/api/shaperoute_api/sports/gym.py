"""A workout at the gym, saved without a track (TASK-385, ADR-0327): its
sets are gym_sessions.py's. No shape, no personal best, no Strava."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport

SPORT = ApiSport(activity="gym", strava_type="WeightTraining", trackless=True)
