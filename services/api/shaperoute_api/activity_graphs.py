"""The zone graphs of each activity (TASK-190, ADR-0153).

A running route is drawn on the foot network, a cycling route on the bike
network: each has its own cached zones (`foot_*`, `bike_*`), and the engine
refuses a graph of another network (`network.check_network`). The API keeps
one ZoneGraphs for each and gives a route the one of its activity. What has
no activity, the themed routes and the directions of a route of "Explore",
is on foot, as before. A paddling route has no network: it is drawn on the
water of the cache (paddling.ServerWater, TASK-191).
"""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path

from route_engine.models import (
    SUPPORTED_ACTIVITIES,
    WATER_ACTIVITIES,
    InvalidRequestError,
)
from route_engine.network import OsmnxSource
from route_engine.optimizer import GraphLoader
from route_engine.walking import API_ACTIVITIES, drawn_as
from route_engine.water import WaterSource

from shaperoute_api.graphs import MAX_ZONES, ZoneGraphs
from shaperoute_api.paddling import ServerWater

# Zones kept in memory, for each activity. A bike zone for 30 km is about
# 26 km a side (prefetch_zones.bike_zone_box), two to three times the area
# of a foot zone: one at a time, and a bike request in another city reads
# its zone from the disk again (docs/tasks/TASK-190.md, the memory).
ZONES_IN_MEMORY: dict[str, int] = {"running": MAX_ZONES, "cycling": 1}
# The activities of the contract drawn on roads, each on its network's zones;
# the others are drawn on the water (TASK-191).
ROAD_ACTIVITIES: tuple[str, ...] = tuple(
    activity for activity in SUPPORTED_ACTIVITIES if activity not in WATER_ACTIVITIES
)


def check_supported(activity: str) -> None:
    """The activities of the contract (walking.API_ACTIVITIES: those of
    models.SUPPORTED_ACTIVITIES and the walk, TASK-371): the engine may draw
    more, which the API does not offer before it gives them their network."""
    if activity not in API_ACTIVITIES:
        raise InvalidRequestError(
            f"unsupported activity {activity!r}; "
            f"choose one of: {', '.join(API_ACTIVITIES)}"
        )


class ActivityGraphs:
    """One graph loader for each activity of the contract on roads, and the
    water for those on the water."""

    def __init__(
        self, graphs: Mapping[str, GraphLoader], water: WaterSource | None = None
    ) -> None:
        self._graphs = dict(graphs)
        self.water = water

    @classmethod
    def from_cache(cls, cache_dir: Path) -> ActivityGraphs:
        """Each activity's zones in `cache_dir`, and the water in its
        `water/` folder, downloaded there when missing, as the CLI does
        (OsmnxSource.for_activity, water.OverpassWaterSource)."""
        return cls(
            {
                activity: ZoneGraphs(
                    OsmnxSource.for_activity(cache_dir, activity),
                    max_zones=ZONES_IN_MEMORY[activity],
                )
                for activity in ROAD_ACTIVITIES
            },
            water=ServerWater(cache_dir),
        )

    def for_activity(self, activity: str) -> GraphLoader:
        check_supported(activity)
        # A walk on the foot network of a run, its zones already in memory.
        graphs = self._graphs.get(drawn_as(activity))
        if graphs is None:
            raise InvalidRequestError(f"no {activity} routes on this API")
        return graphs


# What the API is given to draw with: the graphs of each activity, or, in
# the tests, one graph loader for every route.
Graphs = ActivityGraphs | GraphLoader
# What a route is drawn on: the roads of its network, or the water.
Ground = GraphLoader | WaterSource


def source_for(graphs: Graphs, activity: str) -> GraphLoader:
    """The graphs a route of `activity` is drawn on: those of its network,
    or the only ones there are; on a network not its own the engine refuses
    to draw it (WrongNetworkError, an engine_error)."""
    if isinstance(graphs, ActivityGraphs):
        return graphs.for_activity(activity)
    return graphs


def water_for(graphs: Graphs, activity: str) -> WaterSource:
    """The water a route of `activity` is drawn on (TASK-191): an API with
    one graph loader only, as the tests give, has none."""
    check_supported(activity)
    water = graphs.water if isinstance(graphs, ActivityGraphs) else None
    if water is None:
        raise InvalidRequestError(f"no {activity} routes on this API")
    return water


def ground_for(graphs: Graphs, activity: str) -> Ground:
    """What a route of `activity` is drawn on: the water for one on the water
    (models.WATER_ACTIVITIES), else the graphs of its network."""
    if activity in WATER_ACTIVITIES:
        return water_for(graphs, activity)
    return source_for(graphs, activity)
