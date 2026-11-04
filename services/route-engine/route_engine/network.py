"""Road network access, snapping and routing (docs/ROUTE_ENGINE.md §4, ADR-0020).

The only module that talks to OSMnx. Graphs follow the OSMnx convention:
nodes carry `y` (lat) and `x` (lon), edges carry `length` in metres and,
when the road is not straight, a `geometry` LineString in (lon, lat).
"""

from __future__ import annotations

import json
import logging
import math
import os
import pickle
import urllib.parse
import urllib.request
import uuid
import weakref
from collections.abc import Callable, Collection, Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol, TypeVar

import networkx as nx
import numpy as np

from route_engine.activities import ENGINE_ACTIVITIES
from route_engine.errors import CollapsedShapeError, NoRoadsError
from route_engine.geo import (
    LatLon,
    latlon_to_local,
    latlon_to_local_array,
    local_to_latlon,
    path_length_m,
)
from route_engine.networks import NETWORKS_BY_NAME
from route_engine.networks.bike import (  # noqa: F401 - imported from here
    BIKE_ALLOWED,
    BIKE_BANNED,
    BIKE_FILTER,
    BIKE_NETWORK_NAME,
    BIKE_PATHS,
    BIKE_ROADS,
    BIKE_TAGS,
    NO_ENTRY,
    ONE_WAY_BACKWARD,
    ONE_WAY_FORWARD,
    WALK_COST,
    WALK_WAYS,
    bike_direction,
    bike_ways,
    download_bike_graph,
    rideable,
    walkable,
    walkable_beside,
)
from route_engine.networks.foot import FOOT_FILTER, FOOT_NETWORK_NAME
from route_engine.networks.foot import NETWORK as FOOT_NETWORK
from route_engine.overpass_address import reachable
from route_engine.sidewalks import NamedRoad

log = logging.getLogger(__name__)

# Where a route drawn out and back turns (first_leg): a metre from the far
# end of the shape weighs as much as ten from half-way along the route. The
# way back may take other roads than the way out, and be some hundred metres
# longer or shorter; an earlier pass near the far end is kilometres before
# half-way (TASK-041).
HALF_WAY_WEIGHT = 0.1

# Starting values, to be tuned on samples (docs/MAPS.md).
AREA_MARGIN_M = 500.0
EDGE_REUSE_PENALTY = 2.0
SPARSE_THRESHOLD_M = 150.0
# Fractions of the shape perimeter, tuned in TASK-017 (docs/MAPS.md).
ZONE_RADIUS = 0.02
CORRIDOR_BAND = 0.02
CORRIDOR_WEIGHT = 2.0
# A vertex where the outline turns more than this is a corner of the shape,
# like the heart's tip and dip (TASK-015); the circle has none.
CORNER_TURN_DEG = 60.0
# Out-and-back on parallel roads (TASK-016, ADR-0026): a return within
# SPUR_NEAR_M after at least SPUR_MIN_M, over at most SPUR_MAX_SHARE of the
# route, on a stretch that runs beside itself for SPUR_THIN_SHARE of it.
SPUR_NEAR_M = 20.0
SPUR_MIN_M = 60.0
SPUR_MAX_SHARE = 0.15
SPUR_THIN_SHARE = 0.7
# Distances from the outline are exact up to this far beyond its band.
CORRIDOR_EXACT_M = 1000.0
# A side of a shape this close to another side is drawn twice on purpose: a
# stroke, out and back (TASK-037). Other sides are never this close.
TWICE_NEAR_M = 1.0
# A shape with strokes has details about as wide as ZONE_RADIUS and
# CORRIDOR_BAND of its perimeter: for it these fractions, and the tolerance
# of the similarity, shrink by this much, so the search sees the details
# (TASK-037, ADR-0039).
STROKE_DETAIL = 0.5

# The network each activity is drawn on, by its name in the cache, and the
# Overpass filter of each network: from the registers of networks/ and
# activities/ (TASK-376, ADR-0320).
NETWORKS: dict[str, str] = {
    activity.name: activity.network
    for activity in ENGINE_ACTIVITIES
    if activity.network is not None
}
FILTERS: dict[str, str | list[str]] = {
    name: network.overpass_filter for name, network in NETWORKS_BY_NAME.items()
}

# The named roads FOOT_FILTER leaves out because their sidewalks are drawn
# apart: only to name those sidewalks (sidewalks.py, ADR-0054), never walked.
NAMED_ROADS_QUERY = (
    "[out:json][timeout:{timeout}];"
    'way["highway"]["name"][~"^sidewalk(:both|:left|:right)?$"~"separate"]'
    "({south},{west},{north},{east});out tags geom;"
)
NAMED_ROADS_TIMEOUT_S = 180

# (south, west, north, east) in degrees.
BBox = tuple[float, float, float, float]
Graph = nx.MultiDiGraph


class GraphSource(Protocol):
    def load(self, bbox: BBox) -> Graph: ...


class FileSource:
    """A graph saved as GraphML; the requested area is ignored. Used by tests."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self, bbox: BBox) -> Graph:
        import osmnx as ox

        return ox.load_graphml(self.path)


class OsmnxSource:
    """Foot network from OpenStreetMap, cached as GraphML in `cache_dir`;
    the bike network with `network_name` BIKE_NETWORK_NAME (`for_activity`).
    Each network has its own files: `<network_name>_<area>.graphml`."""

    def __init__(
        self,
        cache_dir: Path,
        network_name: str = FOOT_NETWORK_NAME,
        custom_filter: str | list[str] = FOOT_FILTER,
    ) -> None:
        self.cache_dir = cache_dir
        self.network_name = network_name
        self.custom_filter = custom_filter

    @classmethod
    def for_activity(cls, cache_dir: Path, activity: str) -> OsmnxSource:
        """The source of the network `activity` is drawn on (NETWORKS)."""
        name = NETWORKS[activity]
        return cls(cache_dir, name, FILTERS[name])

    def cache_path(self, bbox: BBox) -> Path:
        south, west, north, east = bbox
        name = f"{self.network_name}_{south:.5f}_{west:.5f}_{north:.5f}_{east:.5f}"
        return self.cache_dir / f"{name}.graphml"

    def covering_path(self, bbox: BBox) -> Path | None:
        """Smallest cached graph of this network whose area contains `bbox`."""
        exact = self.cache_path(bbox)
        if exact.exists():
            return exact
        south, west, north, east = bbox
        eps = 1e-5  # names are rounded to 5 decimals
        best: tuple[float, Path] | None = None
        for path in self.cache_dir.glob(f"{self.network_name}_*.graphml"):
            parts = path.stem.split("_")[1:]
            try:
                s, w, n, e = (float(p) for p in parts)
            except ValueError:
                continue
            if (
                s <= south + eps
                and w <= west + eps
                and n >= north - eps
                and e >= east - eps
            ):
                size = (n - s) * (e - w)
                if best is None or size < best[0]:
                    best = (size, path)
        return None if best is None else best[1]

    def is_cached(self, bbox: BBox) -> bool:
        return self.covering_path(bbox) is not None

    def names_path(self, bbox: BBox) -> Path:
        south, west, north, east = bbox
        return (
            self.cache_dir / f"names_{south:.5f}_{west:.5f}_{north:.5f}_{east:.5f}.json"
        )

    def named_roads(self, bbox: BBox, download: bool = True) -> list[NamedRoad]:
        """The named roads of `bbox` that the foot graph leaves out
        (NAMED_ROADS_QUERY): from a cached file whose area contains `bbox`,
        else one Overpass request, saved beside the graphs. A few MB where a
        graph takes a hundred (ADR-0054). With `download` False, none when
        no file covers `bbox` (the API, ADR-0057)."""
        covering = _covering_file(self.cache_dir, "names", ".json", bbox)
        if covering is not None:
            return [r for r in read_named_roads(covering) if _touches(r, bbox)]
        if not download:
            return []
        roads = parse_named_roads(_overpass(named_roads_query(bbox)))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        write_named_roads(roads, self.names_path(bbox))
        return roads

    def load(self, bbox: BBox) -> Graph:
        """Graph of `bbox`: from its cache file, cropped from a larger cached
        graph, or downloaded and saved.

        A crop is never saved (TASK-136, ADR-0108): it is 3 to 170 MB for
        each new start, and it is made again from its zone without the
        network. The API does the same (ADR-0030).

        The file of a zone holds every connected piece of its roads
        (TASK-180, ADR-0148); what is returned is one piece, the largest of
        the area asked, as before."""
        import osmnx as ox

        path = self.cache_path(bbox)
        if path.exists():
            return largest_piece(read_graph(path))
        covering = self.covering_path(bbox)
        if covering is not None:
            return crop(read_graph(covering), bbox)
        ox.settings.cache_folder = str(self.cache_dir / "http")
        south, west, north, east = bbox
        # Through an address of Overpass that answers (TASK-127, ADR-0100).
        with reachable(ox.settings.overpass_url):
            # Each network downloads its own way (networks/); a name of
            # none of them, the foot network's.
            network = NETWORKS_BY_NAME.get(self.network_name, FOOT_NETWORK)
            graph = network.download(bbox, self.custom_filter)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        _write_graph(graph, path)
        return largest_piece(graph)


def read_graph(path: Path) -> Graph:
    """A cached graph: from its pickle when there is one, else from GraphML.

    GraphML is the cache of record (readable, what OSMnx writes); the pickle
    beside it only saves time, since parsing a zone's GraphML takes up to a
    minute. Both are written by this module into the ignored cache folder.

    A pickle that cannot be read, half written by a process stopped before
    TASK-133 or from another version of networkx, gives way to the GraphML
    and is written again (ADR-0104).
    """
    import osmnx as ox

    fast = path.with_suffix(".pickle")
    if fast.exists() and fast.stat().st_mtime >= path.stat().st_mtime:
        try:
            with fast.open("rb") as file:
                graph: Graph = pickle.load(file)
            return graph
        except Exception as exc:
            log.warning("%s cannot be read (%r): reading the GraphML", fast.name, exc)
    graph = ox.load_graphml(path)
    _write_pickle(graph, fast)
    return graph


def _write_graph(graph: Graph, path: Path) -> None:
    import osmnx as ox

    with _whole(path) as temporary:
        ox.save_graphml(graph, temporary)
    _write_pickle(graph, path.with_suffix(".pickle"))


def _write_pickle(graph: Graph, path: Path) -> None:
    """The pickle only saves time: one that cannot be written (disk full,
    a folder that is read-only) is left out, and the GraphML is read."""
    try:
        with _whole(path) as temporary, temporary.open("wb") as file:
            pickle.dump(graph, file, protocol=pickle.HIGHEST_PROTOCOL)
    except OSError as exc:
        log.warning("%s not written (%s): the GraphML stays", path.name, exc)


@contextmanager
def _whole(path: Path) -> Iterator[Path]:
    """A temporary file beside `path`, which takes the name `path` only once
    written to the end (TASK-133, ADR-0104): a write stopped half-way never
    leaves half a file under a name the cache looks for. An error removes
    it; a process killed outright leaves it, and its name, starting with a
    dot, matches none of the cache's names."""
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex[:8]}.part")
    try:
        yield temporary
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class WrongNetworkError(ValueError):
    """A route asked for one activity on the graph of another network: a
    bug of the caller, which handed the wrong source (ADR-0153)."""


def network_of(graph: Graph) -> str:
    """The network a graph was built for: what its `network` attribute says,
    set on bike graphs; foot graphs, also those cached before, have none."""
    return str(graph.graph.get("network", FOOT_NETWORK_NAME))


def one_way_streets(graph: Graph) -> bool:
    """Whether `graph` keeps one-way streets one way, as the bike network
    does; on foot every road goes both ways."""
    return network_of(graph) == BIKE_NETWORK_NAME


def check_network(graph: Graph, activity: str) -> None:
    """Raise unless `graph` is of the network `activity` is drawn on: a
    cycling route on the foot network would take steps and go against
    one-way streets."""
    wanted, found = NETWORKS[activity], network_of(graph)
    if found != wanted:
        raise WrongNetworkError(
            f"a {activity} route is drawn on the {wanted} network, "
            f"not on the {found} one"
        )


def on_foot_edge(data: Mapping[str, Any]) -> bool:
    """Whether an edge of the bike network is walked with the bike on foot:
    `walk` is True in a graph made here, "True" in one read from GraphML."""
    return str(data.get("walk")) == "True"


def step_cost(u: Any, v: Any, edges: Mapping[Any, Mapping[str, Any]]) -> float:
    """A networkx weight: the cheapest u→v edge, an edge walked with the
    bike on foot costing WALK_COST times its length. On foot, and on a bike
    graph cached before TASK-206, the length."""
    return min(
        float(d["length"]) * (WALK_COST if on_foot_edge(d) else 1.0)
        for d in edges.values()
    )


def area_around(points: Sequence[LatLon], margin_m: float = AREA_MARGIN_M) -> BBox:
    """Bounding box of `points` grown by `margin_m` on every side, rounded outward.

    Rounding to 1e-4° (≈ 10 m) keeps cache names stable across float noise.
    """
    origin = points[0]
    local = [latlon_to_local(origin, p) for p in points]
    xs = [x for x, _ in local]
    ys = [y for _, y in local]
    south, west = local_to_latlon(origin, min(xs) - margin_m, min(ys) - margin_m)
    north, east = local_to_latlon(origin, max(xs) + margin_m, max(ys) + margin_m)
    step = 1e-4
    return (
        math.floor(south / step) * step,
        math.floor(west / step) * step,
        math.ceil(north / step) * step,
        math.ceil(east / step) * step,
    )


def named_roads_query(bbox: BBox, timeout_s: int = NAMED_ROADS_TIMEOUT_S) -> str:
    south, west, north, east = bbox
    return NAMED_ROADS_QUERY.format(
        timeout=timeout_s, south=south, west=west, north=north, east=east
    )


def parse_named_roads(answer: dict[str, Any]) -> list[NamedRoad]:
    """Roads from an Overpass JSON answer with `out tags geom`."""
    roads: list[NamedRoad] = []
    for element in answer.get("elements", []):
        name = element.get("tags", {}).get("name", "").strip()
        points = tuple(
            (float(p["lat"]), float(p["lon"])) for p in element.get("geometry", [])
        )
        if element.get("type") == "way" and name and len(points) >= 2:
            roads.append(NamedRoad(name, points))
    return roads


def write_named_roads(roads: Sequence[NamedRoad], path: Path) -> None:
    rows = [
        {"name": r.name, "points": [[round(a, 7), round(b, 7)] for a, b in r.points]}
        for r in roads
    ]
    text = json.dumps({"roads": rows}, ensure_ascii=False)
    with _whole(path) as temporary:
        temporary.write_text(text, encoding="utf-8")


def read_named_roads(path: Path) -> list[NamedRoad]:
    rows = json.loads(path.read_text(encoding="utf-8"))["roads"]
    return [
        NamedRoad(row["name"], tuple((float(a), float(b)) for a, b in row["points"]))
        for row in rows
    ]


def _touches(road: NamedRoad, bbox: BBox) -> bool:
    south, west, north, east = bbox
    return any(
        south <= lat <= north and west <= lon <= east for lat, lon in road.points
    )


def _covering_file(
    directory: Path, prefix: str, suffix: str, bbox: BBox
) -> Path | None:
    """Smallest `<prefix>_<s>_<w>_<n>_<e><suffix>` in `directory` whose area
    contains `bbox`."""
    south, west, north, east = bbox
    eps = 1e-5  # names are rounded to 5 decimals
    best: tuple[float, Path] | None = None
    for path in directory.glob(f"{prefix}_*{suffix}"):
        try:
            s, w, n, e = (float(p) for p in path.stem.split("_")[1:])
        except ValueError:
            continue
        if (
            s <= south + eps
            and w <= west + eps
            and n >= north - eps
            and e >= east - eps
        ):
            size = (n - s) * (e - w)
            if best is None or size < best[0]:
                best = (size, path)
    return None if best is None else best[1]


def _overpass(query: str) -> dict[str, Any]:
    """One request to the Overpass server OSMnx uses, with its User-Agent.
    One attempt: MAPS.md, «Overpass: come si scarica»."""
    import osmnx as ox

    request = urllib.request.Request(
        f"{ox.settings.overpass_url.rstrip('/')}/interpreter",
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": ox.settings.http_user_agent},
    )
    with (
        reachable(ox.settings.overpass_url),
        urllib.request.urlopen(request, timeout=NAMED_ROADS_TIMEOUT_S + 10) as answer,
    ):
        result: dict[str, Any] = json.load(answer)
    return result


def crop(graph: Graph, bbox: BBox) -> Graph:
    """Nodes inside `bbox`, the edges between them, largest connected piece.

    Close to what downloading `bbox` alone gives: there too only the largest
    piece is kept (`largest_piece`), but OSMnx simplifies the ways before
    cutting them at the border. With no node inside there is no piece to
    keep: NoRoadsError (TASK-180).
    """
    south, west, north, east = bbox
    inside = [
        n
        for n, d in graph.nodes(data=True)
        if south <= d["y"] <= north and west <= d["x"] <= east
    ]
    if not inside:
        raise NoRoadsError()
    pieces = _pieces(graph.subgraph(inside))
    return graph.subgraph(max(pieces, key=len)).copy()


def largest_piece(graph: Graph) -> Graph:
    """`graph` itself when its roads are all joined, as in every zone saved
    before TASK-180; else a copy of its largest connected piece, which is
    what OSMnx kept of a download until then (ADR-0148)."""
    pieces = _pieces(graph)
    largest = max(pieces, key=len, default=set())
    if len(largest) == len(graph):
        return graph
    return graph.subgraph(largest).copy()


def _pieces(graph: Graph) -> Iterator[set[Any]]:
    """The connected pieces of `graph`. With one-way streets (the bike
    network) a piece is one where every node is reached from every other:
    a route that rides into a one-way dead end never comes back
    (ADR-0153). On foot every road goes both ways, and that is any piece
    whose roads are joined."""
    if one_way_streets(graph):
        return iter(nx.strongly_connected_components(graph))
    return iter(nx.weakly_connected_components(graph))


@dataclass
class NetworkRoute:
    points: list[LatLon]
    distance_m: float
    warnings: list[str] = field(default_factory=list)
    waypoints: list[Any] = field(default_factory=list)  # node reached per zone
    nodes: list[Any] = field(default_factory=list)  # graph nodes, in order
    # A word with the pen up (TASK-197): [from, to] indices into `points`,
    # each the stretch walked from one letter to the next, not drawn.
    walks: list[tuple[int, int]] = field(default_factory=list)


def nearest_nodes(
    graph: Graph, points: Sequence[LatLon]
) -> tuple[list[Any], list[float]]:
    """Nearest graph node for each point, and its distance in metres."""
    origin = points[0]
    node_ids, latlon = _node_table(graph)
    local = latlon_to_local_array(origin, latlon)
    nearest: list[Any] = []
    distances: list[float] = []
    for point in points:
        x, y = latlon_to_local(origin, point)
        d = np.hypot(local[:, 0] - x, local[:, 1] - y)
        i = int(np.argmin(d))
        nearest.append(node_ids[i])
        distances.append(float(d[i]))
    return nearest, distances


def prune_spurs(
    route_nodes: Sequence[Any], keep: Collection[Any] = frozenset()
) -> list[Any]:
    """Remove out-and-back detours: every A → B → A becomes A, repeatedly,
    unless B is in `keep`.

    Reaching a waypoint down a side street and coming back draws a spike
    that is not part of the shape; dropping it keeps the outer contour. A
    spike out to a corner of the shape, such as the heart's tip, is what
    draws the corner: those nodes go in `keep`.
    """
    result: list[Any] = []
    for node in route_nodes:
        if len(result) >= 2 and result[-2] == node and result[-1] not in keep:
            result.pop()
        else:
            result.append(node)
    return result


def prune_parallel_spurs(
    graph: Graph,
    route_nodes: Sequence[Any],
    keep: Collection[Any] = frozenset(),
    near_m: float = SPUR_NEAR_M,
    min_m: float = SPUR_MIN_M,
    max_share: float = SPUR_MAX_SHARE,
) -> list[Any]:
    """Remove out-and-back detours that return on a parallel road.

    `prune_spurs` catches A → B → A; going out on one side of a street and
    back on the other (or on a footway beside it) uses different nodes and
    still draws a spike. A stretch from node i to a later node j is such a
    spike when j is within `near_m` of i after at least `min_m` along the
    route (at most `max_share` of it), most of the stretch runs within
    `near_m` of itself, no node of it is in `keep` (corners of the shape),
    and a road joins i and j in at most 3 × `near_m`: then that road
    replaces the stretch.
    """
    nodes = list(route_nodes)
    if len(nodes) < 4:
        return nodes
    origin = _node_latlon(graph, nodes[0])
    xy = latlon_to_local_array(
        origin, np.array([_node_latlon(graph, n) for n in nodes])
    )
    steps = [0.0] + [
        min(float(d["length"]) for d in graph[u][v].values())
        for u, v in zip(nodes, nodes[1:], strict=False)
    ]
    along = np.cumsum(steps)
    total = float(along[-1])
    result: list[Any] = []
    i = 0
    while i < len(nodes):
        result.append(nodes[i])
        gap = np.hypot(xy[:, 0] - xy[i, 0], xy[:, 1] - xy[i, 1])
        spans = along - along[i]
        candidates = np.flatnonzero(
            (np.arange(len(nodes)) > i)
            & (gap <= near_m)
            & (spans >= min_m)
            & (spans <= max_share * total)
        )
        for j in candidates[::-1]:
            inner = nodes[i + 1 : j]
            if any(n in keep for n in inner):
                continue
            if not _thin(xy[i : j + 1], along[i : j + 1], near_m):
                continue
            if nodes[j] == nodes[i]:  # a thin loop back to the same node
                i = int(j) + 1
                break
            try:
                link = nx.shortest_path(graph, nodes[i], nodes[j], weight="length")
            except nx.NetworkXNoPath:
                continue
            link_m = sum(
                min(float(d["length"]) for d in graph[u][v].values())
                for u, v in zip(link, link[1:], strict=False)
            )
            if link_m > 3 * near_m:
                continue
            result.extend(link[1:-1])
            i = int(j)
            break
        else:
            i += 1
    return result


def _thin(xy: np.ndarray, along: np.ndarray, near_m: float) -> bool:
    """Whether most of a stretch (by length) runs within `near_m` of another
    part of itself at least 2 × `near_m` away along it: a spike."""
    if len(xy) < 3:
        return False
    d = np.hypot(xy[:, None, 0] - xy[None, :, 0], xy[:, None, 1] - xy[None, :, 1])
    apart = np.abs(along[:, None] - along[None, :]) >= 2 * near_m
    d[~apart] = np.inf
    close = d.min(axis=1) <= 1.5 * near_m
    weights = np.diff(along, prepend=along[0]) + np.diff(along, append=along[-1])
    return bool(weights[close].sum() >= SPUR_THIN_SHARE * weights.sum())


def corner_indices(xy: np.ndarray) -> list[int]:
    """Indices of the vertices of a closed polyline (no repeated closing
    point) where the outline turns by more than CORNER_TURN_DEG."""
    before = xy - np.roll(xy, 1, axis=0)
    after = np.roll(xy, -1, axis=0) - xy
    cross = before[:, 0] * after[:, 1] - before[:, 1] * after[:, 0]
    dot = (before * after).sum(axis=1)
    turn = np.degrees(np.abs(np.arctan2(cross, dot)))
    return [int(i) for i in np.flatnonzero(turn > CORNER_TURN_DEG)]


def distance_to_polyline(polyline: np.ndarray, points: np.ndarray) -> np.ndarray:
    """Distance in metres from each (x, y) point to the nearest polyline segment."""
    return distance_to_segments(polyline[:-1], polyline[1:], points)


def distance_to_segments(
    a: np.ndarray, b: np.ndarray, points: np.ndarray
) -> np.ndarray:
    """Distance in metres from each (x, y) point to the nearest segment a-b."""
    ab = b - a
    ab2 = np.maximum((ab**2).sum(axis=1), 1e-12)
    ax, ay, abx, aby = a[:, 0], a[:, 1], ab[:, 0], ab[:, 1]
    result = np.empty(len(points))
    # x and y apart, in chunks of about a million pairs: the same arithmetic
    # as on (x, y) pairs, about twice as fast (TASK-063).
    chunk = max(1, 2**20 // max(1, len(a)))
    for s in range(0, len(points), chunk):
        px = points[s : s + chunk, 0][:, None]
        py = points[s : s + chunk, 1][:, None]
        t = np.clip(((px - ax) * abx + (py - ay) * aby) / ab2, 0.0, 1.0)
        d = np.hypot(px - (ax + t * abx), py - (ay + t * aby))
        result[s : s + chunk] = d.min(axis=1)
    return result


def twice_drawn(xy: np.ndarray, near_m: float = TWICE_NEAR_M) -> np.ndarray:
    """For each side of a closed polyline (last point repeating the first),
    whether its middle lies on a side going the other way: the shape draws
    it twice, like a stroke out and back (TASK-037). A side cut in two where
    the route starts goes on the same way, and does not count."""
    a, b = xy[:-1], xy[1:]
    ab = b - a
    middles = (a + b) / 2
    twice = np.zeros(len(a), bool)
    for i, middle in enumerate(middles):
        back = (ab @ ab[i]) < 0
        if back.any():
            d = distance_to_segments(a[back], b[back], middle[None])
            twice[i] = bool(d[0] <= near_m)
    return twice


def detail_scale(xy: np.ndarray, near_m: float = TWICE_NEAR_M) -> float:
    """STROKE_DETAIL for a shape with strokes (a side drawn twice), 1 for a
    plain outline: what the tolerances of a shape are multiplied by."""
    return STROKE_DETAIL if twice_drawn(xy, near_m).any() else 1.0


def _edge_key(u: Any, v: Any) -> frozenset[Any]:
    return frozenset((u, v))


def _node_latlon(graph: Graph, node: Any) -> LatLon:
    return graph.nodes[node]["y"], graph.nodes[node]["x"]


def _edge_coords(graph: Graph, u: Any, v: Any, data: dict[str, Any]) -> list[LatLon]:
    """All points of one u→v edge, from u to v, both ends included."""
    start, end = _node_latlon(graph, u), _node_latlon(graph, v)
    geometry = data.get("geometry")
    if geometry is None:
        return [start, end]
    coords = [(lat, lon) for lon, lat in geometry.coords]
    if math.dist(coords[-1], start) < math.dist(coords[0], start):
        coords.reverse()
    return coords


def _shortest_edge(graph: Graph, u: Any, v: Any) -> dict[str, Any]:
    """The data of the shortest u→v edge: the one a route's points follow."""
    data: dict[str, Any] = min(graph[u][v].values(), key=lambda d: float(d["length"]))
    return data


def _edge_points(graph: Graph, u: Any, v: Any) -> list[LatLon]:
    """Points of the shortest u→v edge, from u to v, excluding u itself."""
    return _edge_coords(graph, u, v, _shortest_edge(graph, u, v))[1:]


def on_foot_stretches(graph: Graph, nodes: Sequence[Any]) -> list[tuple[int, int]]:
    """Where a route walks with the bike on foot (TASK-206, ADR-0167):
    [from, to] indices into its points, both included, one for each run of
    edges in a row that `on_foot_edge`, in order. The points are those of
    `nodes` as every route makes them: the first node, then `_edge_points`
    of each edge. Empty on foot, and on a bike graph made before TASK-206."""
    stretches: list[tuple[int, int]] = []
    index = 0
    for u, v in zip(nodes, nodes[1:], strict=False):
        data = _shortest_edge(graph, u, v)
        end = index + len(_edge_coords(graph, u, v, data)) - 1
        if on_foot_edge(data):
            if stretches and stretches[-1][1] == index:
                stretches[-1] = (stretches[-1][0], end)
            else:
                stretches.append((index, end))
        index = end
    return stretches


def _corridor_costs(
    graph: Graph, origin: LatLon, outline: np.ndarray, weight: float, band_m: float
) -> dict[tuple[Any, Any], float]:
    """Cost of each u→v step: its length × (1 + weight · excess / band).

    `excess` is how far the road runs from the shape outline beyond
    `band_m`, measured at its two ends and its middle point. Roads inside
    the band cost their length, so zig-zagging to stay closer gains nothing;
    roads outside cost more the farther they are, so the route follows the
    contour instead of cutting through the shape.
    """
    steps, which, lengths = _edge_steps(graph)
    if weight > 0:
        # Edges share their ends, and each road runs both ways: every
        # distinct point once (TASK-063).
        points, rows = _distinct_samples(graph)
        xy = latlon_to_local_array(origin, points)
        distance = _distance_to_outline(outline, xy, CORRIDOR_EXACT_M + band_m)
        distance = distance[rows].reshape(-1, 3).mean(axis=1)
        excess = np.maximum(0.0, distance - band_m) / max(band_m, 1.0)
        factors = 1.0 + weight * excess
    else:
        factors = np.ones(len(lengths))
    # Parallel edges share a step, which costs the cheapest of them.
    cheapest = np.full(len(steps), math.inf)
    np.minimum.at(cheapest, which, lengths * factors)
    return dict(zip(steps, cheapest.tolist(), strict=True))


# What the engine works out once per graph and keeps while the graph stays
# as it is (TASK-203, ADR-0162): a graph is traced up to 20 times a
# search, and its edge samples, its u→v steps (TASK-063), its node ids and
# their coordinates are the same every time. NetworkX empties a graph's
# `__networkx_cache__` whenever it adds or removes a node or an edge, so a
# mark kept there says the graph is still the one the data was worked out
# for. Counting its edges to know it, as before, walked every node: 7-12 ms
# on a zone, twice a trace. Weak mappings, so nothing outlives the graph or
# ends up in a GraphML file. A change made to the attributes of an edge in
# place is not seen, as it was not before.
_MARK = "route_engine"

_T = TypeVar("_T")


def _mark(graph: Graph) -> object | None:
    """The mark of `graph` as it is now: a new one after every change
    NetworkX makes to it. None for a view of another graph, which changes
    with it unseen: nothing is kept for a view."""
    if hasattr(graph, "_graph"):  # a subgraph or reverse view
        return None
    cache: dict[str, Any] | None = getattr(graph, "__networkx_cache__", None)
    if cache is None:  # a graph pickled by a NetworkX before 3.3
        cache = {}
        graph.__networkx_cache__ = cache
    mark = cache.get(_MARK)
    if mark is None:
        mark = cache[_MARK] = object()
    return mark


def _kept(
    store: weakref.WeakKeyDictionary[Graph, tuple[object, _T]],
    graph: Graph,
    work_out: Callable[[Graph], _T],
) -> _T:
    """`work_out(graph)`, kept in `store` while `graph` keeps its mark."""
    mark = _mark(graph)
    if mark is not None:
        cached = store.get(graph)
        if cached is not None and cached[0] is mark:
            return cached[1]
    value = work_out(graph)
    if mark is not None:
        store[graph] = (mark, value)
    return value


def _same_graph(graph: Graph, mark: object | None) -> None:
    """Gives `graph` its `mark` back after a change undone, like the sink of
    `_route_through_zones`: the graph is the one the kept data was worked
    out for, node for node and edge for edge, in the same order."""
    if mark is not None:
        graph.__networkx_cache__[_MARK] = mark


_nodes_kept: weakref.WeakKeyDictionary[
    Graph, tuple[object, tuple[list[Any], np.ndarray]]
] = weakref.WeakKeyDictionary()


def _node_table(graph: Graph) -> tuple[list[Any], np.ndarray]:
    """The node ids of `graph` in its order, and their (lat, lon) rows; not
    to be changed by the caller."""
    return _kept(_nodes_kept, graph, _work_out_nodes)


def _work_out_nodes(graph: Graph) -> tuple[list[Any], np.ndarray]:
    ids = list(graph.nodes)
    return ids, np.array([_node_latlon(graph, n) for n in ids])


_samples_kept: weakref.WeakKeyDictionary[Graph, tuple[object, np.ndarray]] = (
    weakref.WeakKeyDictionary()
)


def _edge_samples(graph: Graph) -> np.ndarray:
    """(lat, lon) of both ends and the middle point of every edge, three rows
    per edge in `graph.edges()` order."""
    return _kept(_samples_kept, graph, _work_out_samples)


def _work_out_samples(graph: Graph) -> np.ndarray:
    samples = []
    for u, v, data in graph.edges(data=True):
        coords = _edge_coords(graph, u, v, data)
        samples.extend((coords[0], coords[len(coords) // 2], coords[-1]))
    return np.array(samples).reshape(-1, 2)


_distinct_kept: weakref.WeakKeyDictionary[
    Graph, tuple[object, tuple[np.ndarray, np.ndarray]]
] = weakref.WeakKeyDictionary()


def _distinct_samples(graph: Graph) -> tuple[np.ndarray, np.ndarray]:
    """The distinct points of `_edge_samples`, and for each sample its row
    among them."""
    return _kept(_distinct_kept, graph, _work_out_distinct)


def _work_out_distinct(graph: Graph) -> tuple[np.ndarray, np.ndarray]:
    points, rows = np.unique(_edge_samples(graph), axis=0, return_inverse=True)
    return points, rows.reshape(-1)


# The u→v steps of each graph (TASK-063): a zone has 100 000 edges and
# more, and listing them in Python took most of the time of the corridor,
# trace after trace.
_steps_kept: weakref.WeakKeyDictionary[
    Graph, tuple[object, tuple[list[tuple[Any, Any]], np.ndarray, np.ndarray]]
] = weakref.WeakKeyDictionary()


def _edge_steps(graph: Graph) -> tuple[list[tuple[Any, Any]], np.ndarray, np.ndarray]:
    """The distinct u→v steps of `graph`, the step of each edge in
    `graph.edges()` order, and the cost of each edge: its length, WALK_COST
    times it with the bike on foot (TASK-206)."""
    return _kept(_steps_kept, graph, _work_out_steps)


def _work_out_steps(
    graph: Graph,
) -> tuple[list[tuple[Any, Any]], np.ndarray, np.ndarray]:
    index: dict[tuple[Any, Any], int] = {}
    which, lengths = [], []
    for u, v, data in graph.edges(data=True):
        which.append(index.setdefault((u, v), len(index)))
        # A metre with the bike on foot costs WALK_COST (TASK-206).
        walked = WALK_COST if on_foot_edge(data) else 1.0
        lengths.append(float(data["length"]) * walked)
    return list(index), np.array(which), np.array(lengths)


def _distance_to_outline(
    outline: np.ndarray, points: np.ndarray, exact_within_m: float
) -> np.ndarray:
    """Distance of each point from the outline, exact within `exact_within_m`
    of its bounding box; farther out, the distance from the box (a lower
    bound, already beyond any road the corridor lets the route use)."""
    low, high = outline.min(axis=0), outline.max(axis=0)
    gap = np.maximum(0.0, np.maximum(low - points, points - high))
    to_box = np.hypot(gap[:, 0], gap[:, 1])
    result = to_box.copy()
    near = to_box <= exact_within_m
    result[near] = distance_to_polyline(outline, points[near])
    return result


_SINK = ("zone-sink",)


def _route_through_zones(
    graph: Graph,
    origin: LatLon,
    first: Any,
    anchors: Sequence[LatLon],
    radius_m: float,
    costs: dict[tuple[Any, Any], float],
    reuse_penalty: float,
    corners: Collection[int] = frozenset(),
    twice: Collection[int] = frozenset(),
    retrace: float = 1.0,
    closed: bool = True,
) -> tuple[list[Any], list[Any], list[int], set[Any]]:
    """Closed route from `first` through a zone around each anchor, back to `first`;
    not `closed`, it ends in the zone of the last anchor (TASK-197).

    A zone is every node within `radius_m` of its anchor, or the nearest
    one if none is that close. Reaching a zone node costs, on top of the
    road, its distance from the anchor: the route takes the node that is
    cheap to reach instead of the single nearest one, which may lie across
    a river or a railway. Used roads cost `reuse_penalty` times more, except
    on the way to the anchors in `twice` (1-based, 0 for the way home),
    which the shape draws twice on purpose: there they cost `retrace` times
    as much, less than 1 to come back on the same road (TASK-050).

    Each leg adds a temporary sink node to `graph`, linked from the zone,
    and removes it afterwards. Returns the route nodes, the node reached in
    each zone, the indices of the anchors that could not be reached, and the
    nodes reached for the anchors listed in `corners` (1-based, like the
    indices of the unreached ones).
    """
    node_ids, latlon = _node_table(graph)
    xy = latlon_to_local_array(origin, latlon)
    mark = _mark(graph)
    used: set[frozenset[Any]] = set()
    penalty = reuse_penalty

    def weight(u: Any, v: Any, edges: dict[Any, dict[str, Any]]) -> float:
        cost = costs[(u, v)]
        return cost * penalty if _edge_key(u, v) in used else cost

    def walk(path: list[Any]) -> None:
        for u, v in zip(path, path[1:], strict=False):
            used.add(_edge_key(u, v))
        route_nodes.extend(path[1:])

    route_nodes = [first]
    reached = [first]
    skipped: list[int] = []
    corner_nodes: set[Any] = set()
    for index, anchor in enumerate(anchors, start=1):
        penalty = retrace if index in twice else reuse_penalty
        ax, ay = latlon_to_local(origin, anchor)
        d = np.hypot(xy[:, 0] - ax, xy[:, 1] - ay)
        zone = np.flatnonzero(d <= radius_m)
        if len(zone) == 0:
            zone = np.array([int(np.argmin(d))])
        graph.add_node(_SINK)
        try:
            for i in zone:
                graph.add_edge(node_ids[i], _SINK)
                costs[(node_ids[i], _SINK)] = float(d[i])
            path = nx.shortest_path(graph, route_nodes[-1], _SINK, weight=weight)
        except nx.NetworkXNoPath:
            skipped.append(index)
            continue
        finally:
            graph.remove_node(_SINK)
            for i in zone:
                costs.pop((node_ids[i], _SINK), None)
            _same_graph(graph, mark)
        walk(path[:-1])
        if index in corners:
            corner_nodes.add(path[-2])
        if path[-2] != reached[-1]:
            reached.append(path[-2])
    if not closed:
        return route_nodes, reached, skipped, corner_nodes
    penalty = retrace if 0 in twice else reuse_penalty
    try:
        walk(nx.shortest_path(graph, route_nodes[-1], first, weight=weight))
    except nx.NetworkXNoPath:
        skipped.append(0)
    return route_nodes, reached, skipped, corner_nodes


def first_leg(graph: Graph, route: NetworkRoute, turn: LatLon) -> NetworkRoute:
    """The way out of a route drawn out and back (TASK-041): from its start
    to the node nearest to `turn`, the far end of the shape.

    The route may pass near `turn` on its way there too, like a word that
    ends where one of its letters begins; so the node chosen is the one
    nearest to `turn` plus, weighed HALF_WAY_WEIGHT, nearest to half-way
    along the route, both in metres.
    """
    nodes = route.nodes
    xy = latlon_to_local_array(
        turn, np.array([_node_latlon(graph, node) for node in nodes])
    )
    along = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
    cost = np.hypot(xy[:, 0], xy[:, 1]) + HALF_WAY_WEIGHT * np.abs(
        along - along[-1] / 2
    )
    kept = nodes[: max(1, int(np.argmin(cost))) + 1]
    points: list[LatLon] = [_node_latlon(graph, kept[0])]
    for u, v in zip(kept, kept[1:], strict=False):
        points.extend(_edge_points(graph, u, v))
    reached = set(kept)
    return NetworkRoute(
        points=points,
        distance_m=path_length_m(points),
        warnings=list(route.warnings),
        waypoints=[node for node in route.waypoints if node in reached],
        nodes=kept,
    )


def snap_to_network(
    graph: Graph,
    shape_points: Sequence[LatLon],
    reuse_penalty: float = EDGE_REUSE_PENALTY,
    sparse_threshold_m: float = SPARSE_THRESHOLD_M,
    *,
    zone_radius: float = ZONE_RADIUS,
    corridor: float = CORRIDOR_WEIGHT,
    band: float = CORRIDOR_BAND,
    retrace: float = 1.0,
    closed: bool = True,
) -> NetworkRoute:
    """Turn a projected shape into a closed route on the road network.

    `shape_points[0]` is the user's start: the route begins and ends at the
    node nearest to it. Every other point is reached through a zone of
    nodes around it, and roads far from the outline cost more
    (docs/ROUTE_ENGINE.md §4). `zone_radius` and `band` are fractions of
    the shape perimeter, so they scale with the requested distance. Where
    the shape goes back along itself, used roads cost `retrace` times as
    much (_route_through_zones).

    Not `closed`, the points are an open line, like a letter written with
    the pen up (TASK-197): the route ends in the zone of the last point
    instead of coming back, and the perimeter is the line's own length.

    When every point has the same nearest node there is nothing to draw:
    CollapsedShapeError, a ShapeNotDrawableError (TASK-277).
    """
    warnings: list[str] = []
    nodes, distances = nearest_nodes(graph, shape_points)
    if len(set(nodes)) < 2:
        raise CollapsedShapeError()

    mean_distance = sum(distances) / len(distances)
    if mean_distance > sparse_threshold_m:
        warnings.append(
            f"sparse road network: shape points are {mean_distance:.0f} m from "
            f"the nearest road on average (threshold {sparse_threshold_m:.0f} m)"
        )
    if distances[0] > sparse_threshold_m:
        warnings.append(
            f"start is {distances[0]:.0f} m from the nearest road; "
            "the route begins there"
        )

    origin = shape_points[0]
    outline = latlon_to_local_array(origin, np.array(shape_points))
    if closed and not np.allclose(outline[0], outline[-1]):
        outline = np.vstack([outline, outline[:1]])
    drawn_twice = twice_drawn(outline)
    # Strokes have small details: finer zones and corridor (ADR-0039).
    fine = STROKE_DETAIL if drawn_twice.any() else 1.0
    perimeter = fine * float(np.hypot(*np.diff(outline, axis=0).T).sum())
    anchors = list(shape_points[1:])
    if closed and anchors and anchors[-1] == shape_points[0]:
        anchors.pop()

    costs = _corridor_costs(graph, origin, outline, corridor, band * perimeter)
    # Side i - 1 of the outline leads to anchor i; the last one leads home.
    sides = len(outline) - 1
    if closed:
        corners = set(corner_indices(outline[:-1]))
        twice = {(i + 1) % sides for i in np.flatnonzero(drawn_twice)}
    else:  # no way home, and the two ends turn nowhere
        corners = {i for i in corner_indices(outline) if 0 < i < sides}
        twice = {int(i) + 1 for i in np.flatnonzero(drawn_twice)}
    route_nodes, reached, skipped, corner_nodes = _route_through_zones(
        graph,
        origin,
        nodes[0],
        anchors,
        zone_radius * perimeter,
        costs,
        reuse_penalty,
        corners,
        twice,
        retrace,
        closed,
    )
    for index in skipped:
        warnings.append(f"no road path to shape point {index}; skipped")

    if 0 in corners:
        corner_nodes.add(route_nodes[0])
    pruned = list(route_nodes)
    while True:  # removing one kind of spur can expose the other
        before = pruned
        pruned = prune_spurs(pruned, keep=corner_nodes)
        pruned = prune_parallel_spurs(graph, pruned, keep=corner_nodes)
        if pruned == before:
            break
    if len(set(pruned)) >= 3:  # keep it only if a loop survives
        route_nodes = pruned
    points: list[LatLon] = [_node_latlon(graph, route_nodes[0])]
    for u, v in zip(route_nodes, route_nodes[1:], strict=False):
        points.extend(_edge_points(graph, u, v))
    return NetworkRoute(
        points=points,
        distance_m=path_length_m(points),
        warnings=warnings,
        waypoints=reached,
        nodes=route_nodes,
    )
