"""Cycling, on the bike network (TASK-190, ADR-0153)."""

from route_engine.activities.base import Activity
from route_engine.networks.bike import BIKE_NETWORK_NAME

# 10-30 km, the user's choice for a first step.
ACTIVITY = Activity("cycling", (10_000, 30_000), network=BIKE_NETWORK_NAME)
