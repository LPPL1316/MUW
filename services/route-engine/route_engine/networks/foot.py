"""The foot network: runs and walks (ADR-0022, ADR-0054)."""

from __future__ import annotations

from route_engine.networks.base import BBox, Filter, Graph, Network

# OSMnx 2.1 "walk" filter without its `cycleway` exclusion: in Trentino most
# cycle paths are shared with pedestrians (ADR-0022). The name keeps these
# graphs apart from the plain "walk" ones cached by TASK-014.
FOOT_NETWORK_NAME = "foot"
FOOT_FILTER = (
    '["highway"]["area"!~"yes"]["access"!~"private"]'
    '["highway"!~"abandoned|bus_guideway|construction|motor|no|planned|platform'
    '|proposed|raceway|razed|rest_area|services"]'
    '["foot"!~"no"]["service"!~"private"]["sidewalk"!~"separate"]'
    '["sidewalk:both"!~"separate"]["sidewalk:left"!~"separate"]'
    '["sidewalk:right"!~"separate"]'
)


def download_foot_graph(bbox: BBox, custom_filter: Filter) -> Graph:
    """The foot network of `bbox` from Overpass, every piece of it."""
    import osmnx as ox

    south, west, north, east = bbox
    # network_type="walk" keeps every edge two-way: one-way
    # streets do not bind pedestrians. The filter picks the ways.
    return ox.graph_from_bbox(
        bbox=(west, south, east, north),
        network_type="walk",
        custom_filter=custom_filter,
        # Without it OSMnx keeps the largest piece of the whole
        # zone, and an island with fewer roads than the mainland
        # beside it is left with none: Venice (ADR-0148). The
        # largest piece is chosen area by area, in `crop`.
        retain_all=True,
    )


NETWORK = Network(FOOT_NETWORK_NAME, FOOT_FILTER, download_foot_graph)
