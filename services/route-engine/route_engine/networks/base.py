"""What a network of the register is (TASK-376, ADR-0320).

A network is the graph of roads an activity is drawn on, one module of
networks/ each: its name in the cache files and in the graph
(`graph.graph["network"]`, network.check_network), its Overpass filter and
how its graph is downloaded. network.py does the rest for every network.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass

import networkx as nx

# (south, west, north, east) in degrees.
BBox = tuple[float, float, float, float]
Graph = nx.MultiDiGraph
Filter = str | list[str]


@dataclass(frozen=True)
class Network:
    name: str
    overpass_filter: Filter
    # The graph of a bounding box from Overpass, with the filter given.
    download: Callable[[BBox, Filter], Graph]


@contextmanager
def way_tags(extra: Sequence[str]) -> Iterator[None]:
    """OSMnx keeps the `extra` tags of the ways too, for the block."""
    import osmnx as ox

    saved = list(ox.settings.useful_tags_way)
    ox.settings.useful_tags_way = saved + [t for t in extra if t not in saved]
    try:
        yield
    finally:
        ox.settings.useful_tags_way = saved
