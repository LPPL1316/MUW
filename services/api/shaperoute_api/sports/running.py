"""A run (TASK-376, ADR-0320)."""

from __future__ import annotations

from shaperoute_api.sports.base import ApiSport, Distance, SportBests, Zones

# On foot (the user's choice 1). The men's records, World Athletics, as of
# 2026-11: 5000 m 12:35.36 (Cheptegei, 2020), 10,000 m 26:11.00 (Cheptegei,
# 2020), half marathon 56:42 (Kiplimo, 2025), marathon 2:00:35 (Kiptum,
# 2023). No record is kept over 15, 30 and 60 km: the floor is a round time
# under what the best ever ran there on the way to a longer race. Rounded
# down, a floor never refuses a true time.
ON_FOOT = SportBests(
    max_step_kmh=25,
    distances=(
        Distance("5k", 5_000, 755),
        Distance("10k", 10_000, 1_571),
        Distance("15k", 15_000, 40 * 60),
        Distance("half", 21_097.5, 3_402),
        Distance("30k", 30_000, 85 * 60),
        Distance("marathon", 42_195, 7_235),
        Distance("60k", 60_000, 180 * 60),
    ),
)

SPORT = ApiSport(
    activity="running",
    strava_type="Run",
    zones=Zones(box="explore", street_names=True),
    bests=ON_FOOT,
)
