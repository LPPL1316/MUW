"""The sports of the API (TASK-376, ADR-0320), in the order of the contract
(packages/shared-types RUN_ACTIVITIES): those planned by the engine, then
those recorded without a shape. A new sport is a file of this folder and a
line here."""

from __future__ import annotations

from shaperoute_api.sports import (
    cycling,
    paddling,
    running,
    skiing,
    swimming,
    walking,
    xc_skiing,
)
from shaperoute_api.sports.base import ApiSport

API_SPORTS: tuple[ApiSport, ...] = (
    running.SPORT,
    cycling.SPORT,
    paddling.SPORT,
    swimming.SPORT,
    walking.SPORT,
    skiing.SPORT,
    xc_skiing.SPORT,
)
SPORTS_BY_ACTIVITY: dict[str, ApiSport] = {s.activity: s for s in API_SPORTS}
