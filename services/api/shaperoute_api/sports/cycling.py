"""A bike ride on the roads a bike may ride (TASK-190, ADR-0153; TASK-376)."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport, Distance, SportBests, Zones, at_speed

# By bike (the user's choice 3). No road record is kept over these
# distances, and a descent goes faster than the hour record (56.792 km,
# Ganna, 2022): the floor is the speed of a jump of the GPS, 90 km/h
# throughout (decided by the agent on the user's behalf, ADR-0312).
BY_BIKE_KMH = 90
BY_BIKE = SportBests(
    max_step_kmh=BY_BIKE_KMH,
    distances=tuple(
        Distance(f"{km}k", km * 1_000, at_speed(km * 1_000, BY_BIKE_KMH))
        for km in (10, 20, 40, 50, 100, 160)
    ),
)

# A bike zone for 30 km is about 26 km a side (prefetch_zones), two to three
# times the area of a foot zone: one in memory at a time, and a bike request
# in another city reads its zone from the disk again (docs/tasks/TASK-190.md,
# the memory). Its network has the roads whose sidewalks are apart: no
# street names.
SPORT = ApiSport(
    activity="cycling",
    strava_type="Ride",
    description="cycling is drawn on the roads a bike may ride, one-way "
    "streets kept (TASK-190)",
    zones=Zones(box="longest", street_names=False, in_memory=1),
    bests=BY_BIKE,
)
