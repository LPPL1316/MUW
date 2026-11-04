"""The bike network: rides (TASK-190, ADR-0153; TASK-206, ADR-0167)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import networkx as nx

from route_engine.networks.base import BBox, Filter, Graph, Network, way_tags

# The bike network (TASK-190, ADR-0153): roads and cycleways, and the paths
# and pedestrian streets open to bikes; never steps, trunk roads or
# motorways. Its graphs keep one-way streets one way. Since TASK-206
# (ADR-0167) they also hold the ways a rider may walk with the bike on foot
# (`walkable`, `on_foot_edge`), which cost WALK_COST times their length.
BIKE_NETWORK_NAME = "bike"
# Ways a bike rides unless a tag says otherwise (`rideable`).
BIKE_ROADS = frozenset(
    {
        "cycleway",
        "primary",
        "primary_link",
        "secondary",
        "secondary_link",
        "tertiary",
        "tertiary_link",
        "unclassified",
        "residential",
        "living_street",
        "service",
        "road",
        "track",
    }
)
# Ways for walking, ridden only where marked as a cycle path.
BIKE_PATHS = frozenset({"path", "footway", "bridleway"})
# Ways the rider may walk along with the bike on foot where riding is not
# allowed (TASK-206, ADR-0167); steps never: a bike is not carried.
WALK_WAYS = BIKE_PATHS | {"pedestrian"}
# A metre with the bike on foot costs as much as WALK_COST metres ridden:
# the route walks only where the shape gains a lot from it. At Trento, 10 km
# routes walked 0.7-1.1 km with it, 1.2-2.6 km at 3 times; the user chose
# "a little" (ADR-0167).
WALK_COST = 6.0
# Two Overpass filters, one request each: the roads, and the paths, footways
# and pedestrian streets, ridden where their tags let bikes on and walked
# with the bike on foot elsewhere (TASK-206; before it, only those open to
# bikes). Wider than `rideable` and `walkable`, which decide on the tags
# kept, save the roads with `access=private`, left out as on foot even when
# a `bicycle` tag would open them.
BIKE_FILTER = [
    f'["highway"~"^({"|".join(sorted(BIKE_ROADS))})$"]["area"!~"yes"]'
    '["access"!~"private"]["service"!~"private"]',
    '["highway"~"^(bridleway|footway|path|pedestrian)$"]["area"!~"yes"]',
]
# The tags `rideable`, `bike_direction` and the checks (validation.py) read,
# kept on the edges of a bike graph besides OSMnx's own.
BIKE_TAGS = (
    "bicycle",
    "vehicle",
    "motorroad",
    "oneway:bicycle",
    "cycleway",
    "cycleway:both",
    "cycleway:left",
    "cycleway:right",
    "cycleway:left:oneway",
    "cycleway:right:oneway",
    "surface",
    "tracktype",
    "foot",
)
BIKE_ALLOWED = frozenset({"yes", "designated", "permissive", "destination"})
BIKE_BANNED = frozenset({"no", "private", "dismount", "use_sidepath"})
NO_ENTRY = frozenset({"no", "private", "agricultural", "forestry"})
ONE_WAY_FORWARD = frozenset({"yes", "true", "1"})
ONE_WAY_BACKWARD = frozenset({"-1", "reverse"})


def download_bike_graph(bbox: BBox, custom_filter: Filter) -> Graph:
    """The bike network of `bbox` from Overpass, every piece of it.

    network_type="bike" makes OSMnx keep one-way streets one way. The graph
    comes unsimplified, one edge for each stretch of a way, so `bike_ways`
    can drop ways and turn directions with each way's own tags before the
    ways are joined into roads."""
    import osmnx as ox

    south, west, north, east = bbox
    with way_tags(BIKE_TAGS):
        graph = ox.graph_from_bbox(
            bbox=(west, south, east, north),
            network_type="bike",
            custom_filter=custom_filter,
            retain_all=True,
            simplify=False,
        )
    return bike_ways(graph)


def rideable(tags: Mapping[str, Any]) -> bool:
    """Whether a bike may ride a way with these tags (ADR-0153).

    Roads and cycleways unless closed to bikes (`bicycle=no`, `dismount`,
    `use_sidepath`, a road for motor vehicles only) or to every vehicle
    (`access`, `vehicle`); an explicit `bicycle=yes` opens them. Paths,
    footways and bridleways only when marked as cycle paths
    (`bicycle=designated`), pedestrian streets when open to bikes. Steps,
    trunk roads and motorways never."""
    highway, bicycle = tags.get("highway"), tags.get("bicycle")
    if highway in BIKE_PATHS:
        return bicycle == "designated"
    if highway == "pedestrian":
        return bicycle in BIKE_ALLOWED
    if highway not in BIKE_ROADS:
        return False
    if bicycle in BIKE_ALLOWED:
        return True
    if bicycle in BIKE_BANNED:
        return False
    return not (
        tags.get("motorroad") == "yes"
        or tags.get("vehicle") in NO_ENTRY
        or tags.get("access") in NO_ENTRY
    )


def walkable(tags: Mapping[str, Any]) -> bool:
    """Whether a rider may walk a way with the bike on foot, where `rideable`
    says no (TASK-206, ADR-0167): footways, paths, bridleways and
    pedestrian streets, and any way that says to get off the bike
    (`bicycle=dismount`), unless closed to people on foot. Never steps."""
    highway = tags.get("highway")
    if highway == "steps":
        return False
    if highway not in WALK_WAYS and not (
        tags.get("bicycle") == "dismount" and highway in BIKE_ROADS
    ):
        return False
    foot = tags.get("foot")
    if foot in NO_ENTRY:
        return False
    return foot in BIKE_ALLOWED or tags.get("access") not in NO_ENTRY


def bike_direction(tags: Mapping[str, Any]) -> str | None:
    """Which way a bike may ride a way, when its tags say so apart from
    `oneway`: "both" on a one-way street open to bikes against the traffic
    (`oneway:bicycle=no`, a `cycleway=opposite*`, a cycle lane the other way
    on one side), "forward" or "backward" on a two-way road one-way for
    bikes (`oneway:bicycle`). None: as `oneway` says, as for cars."""
    oneway = tags.get("oneway:bicycle")
    if oneway == "no":
        return "both"
    if oneway in ONE_WAY_FORWARD:
        return "forward"
    if oneway in ONE_WAY_BACKWARD:
        return "backward"
    for key in ("cycleway", "cycleway:both", "cycleway:left", "cycleway:right"):
        if str(tags.get(key, "")).startswith("opposite"):
            return "both"
    for side in ("left", "right"):
        lane = tags.get(f"cycleway:{side}")
        if tags.get(f"cycleway:{side}:oneway") in {"-1", "no"} and lane not in {
            None,
            "no",
            "separate",
        }:
            return "both"
    return None


def bike_ways(graph: Graph) -> Graph:
    """An unsimplified OSMnx graph made with network_type="bike" turned
    into the bike network: the ways a bike may not ride dropped, the one-way
    streets open to bikes the other way joined both ways, and the two-way
    roads one-way for bikes made one-way; then simplified as OSMnx does,
    and marked as a bike graph (`one_way_streets`).

    Since TASK-206 (ADR-0167) the ways a bike may not ride but its rider
    may walk (`walkable`) stay, both ways, marked `walk`; so does the other
    way of each one-way street, on foot. A walked edge beside a ridden one
    between the same two nodes, the same way, is dropped: there the bike is
    ridden. Simplifying never joins a walked stretch to a ridden one."""
    import osmnx as ox

    edges = graph.edges(keys=True, data=True)
    dropped = []
    for u, v, k, data in edges:
        if rideable(data):
            continue
        if walkable(data):
            data["walk"] = True
        else:
            dropped.append((u, v, k))
    graph.remove_edges_from(dropped)
    added: list[tuple[Any, Any, dict[str, Any]]] = []
    removed: list[tuple[Any, Any, Any]] = []
    for u, v, k, data in graph.edges(keys=True, data=True):
        if data.get("walk"):
            if data.get("oneway"):  # on foot every way goes both ways
                data["oneway"] = False
                added.append((v, u, {**data, "reversed": not data.get("reversed")}))
            continue
        way = bike_direction(data)
        if way == "both" and data.get("oneway"):
            data["oneway"] = False
            added.append((v, u, {**data, "reversed": not data.get("reversed")}))
        elif way in ("forward", "backward") and not data.get("oneway"):
            if bool(data.get("reversed")) == (way == "forward"):
                removed.append((u, v, k))
            else:
                data["oneway"] = True
    graph.remove_edges_from(removed)
    for u, v, data in added:
        graph.add_edge(u, v, **data)
    graph.remove_nodes_from(list(nx.isolates(graph)))
    # Counted on the ways downloaded, footways too: simplify_graph counts
    # them again on the bike network.
    for _, node in graph.nodes(data=True):
        node.pop("street_count", None)
    graph = ox.simplify_graph(graph, edge_attrs_differ=["walk"])
    # After simplifying: in it, a node of a one-way street with the other
    # way on foot beside would have had walked and ridden edges, and ended
    # every edge there.
    against = [
        (v, u, {**data, "walk": True, "oneway": False, "reversed": _flip(data)})
        for u, v, data in graph.edges(data=True)
        if data.get("oneway") and not data.get("walk") and walkable_beside(data)
    ]
    for u, v, data in against:
        graph.add_edge(u, v, **data)
    ridden = {(u, v) for u, v, data in graph.edges(data=True) if not data.get("walk")}
    graph.remove_edges_from(
        [
            (u, v, k)
            for u, v, k, data in graph.edges(keys=True, data=True)
            if data.get("walk") and (u, v) in ridden
        ]
    )
    graph.graph["network"] = BIKE_NETWORK_NAME
    graph.graph["on_foot"] = True
    return graph


def _flip(data: Mapping[str, Any]) -> Any:
    """`reversed` of an edge run the other way; OSMnx keeps a list for the
    ways of a simplified edge."""
    value = data.get("reversed")
    if isinstance(value, list):
        return [not v for v in value]
    return not value


def walkable_beside(tags: Mapping[str, Any]) -> bool:
    """Whether the other way of a one-way street a bike rides may be walked
    with the bike on foot: on its sidewalk, unless the street is closed to
    people on foot. A simplified edge joins ways, and OSMnx keeps a list of
    their values: closed on one of them is closed."""
    foot = tags.get("foot")
    values = set(foot) if isinstance(foot, list) else {foot}
    return not values & NO_ENTRY


NETWORK = Network(BIKE_NETWORK_NAME, BIKE_FILTER, download_bike_graph)
