"""Bike routes on the bike network (TASK-190 part A, ADR-0153).

No network: the Overpass answer is a small town made here, a grid of
streets with one-way rows, steps, a footway, a trunk road, a street closed
to bikes and a cycle path, which OSMnx turns into graphs as it does a real
answer. The foot network is the one of every other test. Since TASK-206
the bike network also holds the footway and the other way of the one-way
rows, walked with the bike on foot (tests/test_bike_on_foot.py): what a
bike rides is its other edges.
"""

from __future__ import annotations

import re
import shutil
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import osmnx._overpass as osmnx_overpass
import pytest

import route_engine.__main__ as cli
import route_engine.network as network
from route_engine.__main__ import main, parse_request
from route_engine.geo import latlon_to_local, local_to_latlon
from route_engine.models import (
    ACTIVITIES,
    DISTANCE_LIMITS_M,
    MAX_DISTANCE_M,
    MIN_DISTANCE_M,
    SUPPORTED_ACTIVITIES,
    WATER_ACTIVITIES,
    InvalidRequestError,
    RouteRequest,
    check_distance,
)
from route_engine.nearby_starts import ShapeJob, with_approach
from route_engine.network import (
    BIKE_FILTER,
    BIKE_NETWORK_NAME,
    BIKE_PATHS,
    BIKE_ROADS,
    FOOT_FILTER,
    FOOT_NETWORK_NAME,
    NETWORKS,
    Graph,
    OsmnxSource,
    WrongNetworkError,
    area_around,
    bike_direction,
    check_network,
    crop,
    largest_piece,
    nearest_nodes,
    on_foot_edge,
    one_way_streets,
    read_graph,
    rideable,
    walkable,
)
from route_engine.optimizer import (
    SHAPE_POINTS,
    Plan,
    plan_route,
    plan_shape,
    required_area,
)
from route_engine.shapes import get_shape
from route_engine.validation import measure, unpaved, validate
from route_engine.zone_crop import ZoneCrop

TOWN = (46.0122, 11.2986)
SPACING_M = 300.0
LINES = 47  # streets each way: the town is 13.8 km wide, centred on TOWN
FIXTURE = Path(__file__).parent / "fixtures" / "levico_walk_1km.graphml"

# Rows run west to east, in that node order; columns south to north.
EAST_ROW = 21  # oneway=yes: eastbound only
WEST_ROW = 19  # oneway=-1: westbound only
CONTRA_ROW = 25  # oneway=yes, oneway:bicycle=no: both ways by bike
OPPOSITE_ROW = 29  # oneway=yes, cycleway:left=opposite_lane: both ways by bike
TRUNK_COL, FOOT_COL, STEPS_COL, NO_BIKES_COL = 22, 24, 26, 28
PATH_COL = 20  # highway=path, bicycle=designated: a cycle path
TRACK_COL = 18  # highway=track, no surface: unpaved
COLUMN_TAGS: dict[int, dict[str, str]] = {
    TRUNK_COL: {"highway": "trunk"},
    FOOT_COL: {"highway": "footway"},
    STEPS_COL: {"highway": "steps"},
    NO_BIKES_COL: {"highway": "residential", "bicycle": "no"},
    PATH_COL: {"highway": "path", "bicycle": "designated", "foot": "designated"},
    TRACK_COL: {"highway": "track"},
}
NOT_FOR_BIKES = {"trunk", "footway", "steps"}


def _row_tags(row: int) -> dict[str, str]:
    tags = {"highway": "residential", "name": f"Row {row}"}
    if row == CONTRA_ROW:
        tags.update(oneway="yes", **{"oneway:bicycle": "no"})
    elif row == OPPOSITE_ROW:
        tags.update(oneway="yes", **{"cycleway:left": "opposite_lane"})
    elif row % 4 == 1:
        tags["oneway"] = "yes"
    elif row % 4 == 3:
        tags["oneway"] = "-1"
    return tags


def _node_id(row: int, column: int) -> int:
    return 1 + row * LINES + column


def _row_way(row: int) -> int:
    return 100_000 + row


def _column_way(column: int) -> int:
    return 200_000 + column


def _offset(index: int) -> float:
    return (index - LINES // 2) * SPACING_M


def town_answer() -> dict[str, Any]:
    """What Overpass would answer for the town, whatever the filter: the
    graph is made of what the engine keeps of it."""
    elements: list[dict[str, Any]] = []
    for row in range(LINES):
        for column in range(LINES):
            lat, lon = local_to_latlon(TOWN, _offset(column), _offset(row))
            elements.append(
                {"type": "node", "id": _node_id(row, column), "lat": lat, "lon": lon}
            )
    for row in range(LINES):
        nodes = [_node_id(row, column) for column in range(LINES)]
        elements.append(
            {"type": "way", "id": _row_way(row), "nodes": nodes, "tags": _row_tags(row)}
        )
    for column in range(LINES):
        nodes = [_node_id(row, column) for row in range(LINES)]
        tags = COLUMN_TAGS.get(column, {"highway": "residential"})
        elements.append(
            {"type": "way", "id": _column_way(column), "nodes": nodes, "tags": tags}
        )
    return {"version": 0.6, "elements": elements}


@contextmanager
def _anywhere(url: str) -> Iterator[None]:
    yield None


@pytest.fixture
def downloads(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, Any]]:
    """Every download asked of Overpass, as (network_type, custom_filter),
    each answered with the town."""
    asked: list[tuple[str, Any]] = []

    def download(polygon: Any, network_type: str, custom_filter: Any) -> Iterator[Any]:
        asked.append((network_type, custom_filter))
        yield town_answer()

    monkeypatch.setattr(osmnx_overpass, "_download_overpass_network", download)
    monkeypatch.setattr(network, "reachable", _anywhere)
    monkeypatch.setattr(ox.settings, "cache_folder", ox.settings.cache_folder)
    return asked


def _town_box(half_m: float) -> network.BBox:
    return area_around([TOWN], margin_m=half_m)


@pytest.fixture
def bike_town(tmp_path: Path, downloads: list[tuple[str, Any]]) -> Graph:
    """The town's bike network, downloaded once into `tmp_path`."""
    source = OsmnxSource.for_activity(tmp_path, "cycling")
    return source.load(_town_box(6000.0))


def _ways(data: dict[str, Any], key: str) -> set[Any]:
    value = data.get(key)
    return set(value) if isinstance(value, list) else {value}


def _edges_of(graph: Graph, way: int) -> list[tuple[Any, Any]]:
    return [(u, v) for u, v, d in graph.edges(data=True) if way in _ways(d, "osmid")]


def _east(graph: Graph, u: Any, v: Any) -> bool:
    return bool(graph.nodes[v]["x"] > graph.nodes[u]["x"])


# --- which ways, and which way along them ---


@pytest.mark.parametrize(
    ("tags", "rides"),
    [
        ({"highway": "residential"}, True),
        ({"highway": "cycleway"}, True),
        ({"highway": "secondary"}, True),
        ({"highway": "primary"}, True),
        ({"highway": "track"}, True),
        ({"highway": "trunk"}, False),
        ({"highway": "trunk", "bicycle": "yes"}, False),
        ({"highway": "motorway"}, False),
        ({"highway": "steps"}, False),
        ({"highway": "steps", "bicycle": "designated"}, False),
        ({"highway": "footway"}, False),
        ({"highway": "footway", "bicycle": "yes"}, False),
        ({"highway": "footway", "bicycle": "designated"}, True),
        ({"highway": "path"}, False),
        ({"highway": "path", "bicycle": "yes"}, False),
        ({"highway": "path", "bicycle": "designated"}, True),
        ({"highway": "pedestrian"}, False),
        ({"highway": "pedestrian", "bicycle": "yes"}, True),
        ({"highway": "residential", "bicycle": "no"}, False),
        ({"highway": "residential", "bicycle": "dismount"}, False),
        ({"highway": "primary", "bicycle": "use_sidepath"}, False),
        ({"highway": "primary", "motorroad": "yes"}, False),
        ({"highway": "service", "access": "private"}, False),
        ({"highway": "track", "access": "forestry"}, False),
        ({"highway": "residential", "access": "no", "bicycle": "yes"}, True),
        ({"highway": "residential", "vehicle": "no"}, False),
        ({"highway": "residential", "access": "destination"}, True),
    ],
)
def test_a_bike_rides_roads_and_cycle_paths_never_steps_or_trunk_roads(
    tags: dict[str, str], rides: bool
) -> None:
    assert rideable(tags) is rides


@pytest.mark.parametrize(
    ("tags", "way"),
    [
        ({"oneway": "yes"}, None),
        ({"oneway": "yes", "oneway:bicycle": "no"}, "both"),
        ({"oneway": "yes", "cycleway": "opposite"}, "both"),
        ({"oneway": "yes", "cycleway:left": "opposite_lane"}, "both"),
        ({"oneway": "yes", "cycleway:right": "opposite_track"}, "both"),
        (
            {"oneway": "yes", "cycleway:left": "lane", "cycleway:left:oneway": "-1"},
            "both",
        ),
        (
            {
                "oneway": "yes",
                "cycleway:left": "separate",
                "cycleway:left:oneway": "-1",
            },
            None,
        ),
        ({"oneway:bicycle": "yes"}, "forward"),
        ({"oneway:bicycle": "-1"}, "backward"),
        ({}, None),
    ],
)
def test_a_one_way_street_binds_bikes_unless_its_tags_open_it(
    tags: dict[str, str], way: str | None
) -> None:
    assert bike_direction(tags) == way


def _ridden(graph: Graph) -> list[tuple[Any, Any, dict[str, Any]]]:
    """The edges a bike rides: all but those walked with the bike on foot."""
    return [(u, v, d) for u, v, d in graph.edges(data=True) if not on_foot_edge(d)]


def test_the_bike_rides_no_steps_footways_trunk_or_closed_streets(
    bike_town: Graph, downloads: list[tuple[str, Any]]
) -> None:
    assert downloads == [("bike", BIKE_FILTER)]
    assert bike_town.graph["network"] == BIKE_NETWORK_NAME
    assert one_way_streets(bike_town)
    for _, _, data in _ridden(bike_town):
        assert not _ways(data, "highway") & NOT_FOR_BIKES
        assert "no" not in _ways(data, "bicycle")
    for column in (TRUNK_COL, STEPS_COL, NO_BIKES_COL):
        assert _edges_of(bike_town, _column_way(column)) == []
    footway = _edges_of(bike_town, _column_way(FOOT_COL))
    assert footway  # walked, with the bike on foot (TASK-206)
    assert all(on_foot_edge(d) for u, v in footway for d in bike_town[u][v].values())
    assert _edges_of(bike_town, _column_way(PATH_COL))  # the cycle path


def test_one_way_streets_go_one_way_by_bike_unless_open_to_bikes(
    bike_town: Graph,
) -> None:
    ridden = nx.MultiDiGraph()
    ridden.add_nodes_from(bike_town.nodes(data=True))
    ridden.add_edges_from(_ridden(bike_town))
    east = _edges_of(ridden, _row_way(EAST_ROW))
    west = _edges_of(ridden, _row_way(WEST_ROW))
    assert east and all(_east(ridden, u, v) for u, v in east)
    assert west and not any(_east(ridden, u, v) for u, v in west)
    for row in (CONTRA_ROW, OPPOSITE_ROW, EAST_ROW - 1):
        both = [_east(ridden, u, v) for u, v in _edges_of(ridden, _row_way(row))]
        assert True in both and False in both
    # The other way of a one-way street is there, on foot (TASK-206).
    against = [
        (u, v)
        for u, v in _edges_of(bike_town, _row_way(EAST_ROW))
        if not _east(bike_town, u, v)
    ]
    assert against
    assert all(on_foot_edge(d) for u, v in against for d in bike_town[u][v].values())


def test_on_foot_the_same_town_is_two_way_with_its_steps(
    tmp_path: Path, downloads: list[tuple[str, Any]]
) -> None:
    foot = OsmnxSource(tmp_path).load(_town_box(6000.0))
    assert downloads == [("walk", FOOT_FILTER)]
    assert not one_way_streets(foot)
    assert "network" not in foot.graph
    east = [_east(foot, u, v) for u, v in _edges_of(foot, _row_way(EAST_ROW))]
    assert True in east and False in east
    assert _edges_of(foot, _column_way(STEPS_COL))


# --- a bike route ---


def _legal(graph: Graph, nodes: list[Any]) -> list[dict[str, Any]]:
    """The edge of every step of the route, failing on a step no road
    allows: against a one-way street, or along a way left out."""
    steps = []
    for u, v in zip(nodes, nodes[1:], strict=False):
        assert graph.has_edge(u, v), f"no road from {u} to {v}"
        steps.append(min(graph[u][v].values(), key=lambda d: float(d["length"])))
    return steps


def test_a_cycling_route_is_closed_and_rides_only_where_bikes_may(
    tmp_path: Path, downloads: list[tuple[str, Any]]
) -> None:
    request = RouteRequest(
        start=TOWN, shape="circle", distance_m=10_000, activity="cycling"
    )
    source = OsmnxSource.for_activity(tmp_path, "cycling")
    plan = plan_route(request, source)
    assert plan.search is not None
    route = plan.search.best.route
    assert plan.result.points[0] == plan.result.points[-1]
    assert route.nodes[0] == route.nodes[-1]
    zone = read_graph(next(tmp_path.glob(f"{BIKE_NETWORK_NAME}_*.graphml")))
    steps = _legal(zone, route.nodes)
    ridden = [d for d in steps if not on_foot_edge(d)]
    assert any(d["oneway"] for d in ridden)  # one-way streets, the right way
    for data in ridden:
        assert not _ways(data, "highway") & NOT_FOR_BIKES
    for data in steps:  # walked, a footway or the other way of a street
        assert not _ways(data, "highway") & {"trunk", "steps"}
    assert plan.checks["steps"] == 0.0
    assert "unpaved" in plan.checks
    assert "on_foot" in plan.checks
    assert list(tmp_path.glob(f"{FOOT_NETWORK_NAME}_*")) == []


def test_the_cli_draws_a_cycling_route_on_the_bike_network(
    tmp_path: Path,
    downloads: list[tuple[str, Any]],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    plans: list[Plan] = []

    def kept(*args: Any, **kwargs: Any) -> Plan:
        plans.append(plan_shape(*args, **kwargs))
        return plans[-1]

    monkeypatch.setattr(cli, "plan_shape", kept)
    out = tmp_path / "heart.gpx"
    argv = [
        "--shape=heart",
        "--distance=10000",
        f"--start={TOWN[0]},{TOWN[1]}",
        "--activity=cycling",
        f"--cache-dir={tmp_path / 'cache'}",
        f"--out={out}",
    ]
    assert main(argv) == 0
    printed = capsys.readouterr().out
    assert "activity: cycling" in printed
    assert "m unpaved" in printed
    # The zone, and the farther one if the search looked there too.
    assert downloads and all(d == ("bike", BIKE_FILTER) for d in downloads)
    zones = [read_graph(p) for p in sorted((tmp_path / "cache").glob("*.graphml"))]
    assert all(p.name.startswith("bike_") for p in (tmp_path / "cache").iterdir())
    [plan] = plans
    assert plan.search is not None
    nodes = plan.search.best.route.nodes
    assert nodes[0] == nodes[-1]
    zone = next(z for z in zones if all(n in z for n in nodes))
    for data in _legal(zone, nodes):
        assert not _ways(data, "highway") & NOT_FOR_BIKES
    gpx = out.read_text(encoding="utf-8")
    assert gpx.count("<trkpt") > 10


# --- the two caches ---


def test_the_foot_cache_of_a_zone_is_not_used_for_a_bike_route(
    tmp_path: Path, downloads: list[tuple[str, Any]]
) -> None:
    bbox = _town_box(1000.0)
    foot = OsmnxSource(tmp_path)
    shutil.copy(FIXTURE, foot.cache_path(_town_box(3000.0)))
    bike = OsmnxSource.for_activity(tmp_path, "cycling")
    assert foot.is_cached(bbox)
    assert not bike.is_cached(bbox)
    assert bike.covering_path(bbox) is None
    assert bike.cache_path(bbox).name.startswith("bike_")
    graph = bike.load(bbox)
    assert downloads == [("bike", BIKE_FILTER)]
    assert one_way_streets(graph)
    assert bike.cache_path(bbox).exists()
    assert bike.cache_path(bbox).with_suffix(".pickle").exists()


def test_the_bike_cache_of_a_zone_is_not_used_for_a_foot_route(
    tmp_path: Path, bike_town: Graph
) -> None:
    bike = OsmnxSource.for_activity(tmp_path, "cycling")
    foot = OsmnxSource(tmp_path)
    bbox = _town_box(1000.0)
    assert bike.is_cached(bbox)
    assert not foot.is_cached(bbox)
    assert foot.covering_path(bbox) is None


def test_the_foot_source_and_its_files_are_those_of_before() -> None:
    cache = Path("cache")
    running = OsmnxSource.for_activity(cache, "running")
    default = OsmnxSource(cache)
    bbox = (46.0, 11.0, 46.1, 11.1)
    assert running.cache_path(bbox) == default.cache_path(bbox)
    assert (
        default.cache_path(bbox).name
        == "foot_46.00000_11.00000_46.10000_11.10000.graphml"
    )
    assert running.custom_filter == FOOT_FILTER


def test_each_activity_has_a_network_and_distance_limits() -> None:
    # Each activity is drawn on a network, or on the water (TASK-191).
    assert set(DISTANCE_LIMITS_M) == set(ACTIVITIES)
    assert set(NETWORKS) | WATER_ACTIVITIES == set(ACTIVITIES)
    assert not set(NETWORKS) & WATER_ACTIVITIES
    assert NETWORKS == {"running": "foot", "cycling": "bike"}
    # The contract offers cycling since the API's part (TASK-190, ADR-0153),
    # paddling since its own (TASK-191), swimming since TASK-323 part B.
    assert SUPPORTED_ACTIVITIES == ("running", "cycling", "paddling", "swimming")


# --- the Overpass filters ---

_CONDITION = re.compile(r'\["([^"]+)"(?:(=|!=|~|!~)"([^"]*)")?\]')


def _keeps(overpass: str) -> Callable[[dict[str, str]], bool]:
    """The tags a filter made of plain conditions keeps; anything else
    fails, as it would in the API's zones from an extract (zone_extract)."""
    conditions = list(_CONDITION.finditer(overpass))
    assert "".join(m.group(0) for m in conditions) == overpass

    def keep(tags: dict[str, str]) -> bool:
        for match in conditions:
            key, op, value = match.groups()
            if op is None and key not in tags:
                return False
            if op == "~" and not (key in tags and re.search(value, tags[key])):
                return False
            if op == "!~" and key in tags and re.search(value, tags[key]):
                return False
        return True

    return keep


def test_overpass_downloads_every_way_a_bike_may_ride_or_be_walked() -> None:
    keeps = [_keeps(f) for f in BIKE_FILTER]
    values = [None, "yes", "designated", "permissive", "no", "private"]
    for highway in sorted(BIKE_ROADS | BIKE_PATHS | {"pedestrian", "steps"}):
        for bicycle in values:
            for access in (None, "private", "no"):
                tags = {"highway": highway}
                if bicycle is not None:
                    tags["bicycle"] = bicycle
                if access is not None:
                    tags["access"] = access
                if (rideable(tags) or walkable(tags)) and access != "private":
                    assert any(keep(tags) for keep in keeps), tags
    # Footways are walked with the bike on foot since TASK-206.
    assert any(keep({"highway": "footway"}) for keep in keeps)
    assert not any(keep({"highway": "steps"}) for keep in keeps)
    assert not any(keep({"highway": "trunk"}) for keep in keeps)


# --- pieces, crops and the way back from a nearby start ---


def _one_way_stub() -> Graph:
    """A two-way square 1-2-3-4 and a one-way street 2 → 5 into a dead end."""
    graph: Graph = nx.MultiDiGraph(crs="epsg:4326", network=BIKE_NETWORK_NAME)
    corners = {1: (0, 0), 2: (100, 0), 3: (100, 100), 4: (0, 100), 5: (200, 0)}
    for node, (x, y) in corners.items():
        lat, lon = local_to_latlon(TOWN, x, y)
        graph.add_node(node, y=lat, x=lon)
    for u, v in ((1, 2), (2, 3), (3, 4), (4, 1)):
        graph.add_edge(u, v, length=100.0, highway="residential", oneway=False)
        graph.add_edge(v, u, length=100.0, highway="residential", oneway=False)
    graph.add_edge(2, 5, length=100.0, highway="residential", oneway=True)
    return graph


def test_a_bike_crop_leaves_out_a_one_way_dead_end() -> None:
    graph = _one_way_stub()
    bbox = _town_box(1000.0)
    assert set(crop(graph, bbox)) == {1, 2, 3, 4}
    assert set(ZoneCrop(graph).crop(bbox)) == {1, 2, 3, 4}
    assert set(largest_piece(graph)) == {1, 2, 3, 4}
    foot = _one_way_stub()
    del foot.graph["network"]
    assert set(crop(foot, bbox)) == {1, 2, 3, 4, 5}


def test_the_way_back_from_a_nearby_start_follows_the_one_way_streets(
    bike_town: Graph,
) -> None:
    job = ShapeJob(
        tuple(get_shape("circle")(SHAPE_POINTS)), "circle", 10_000, activity="cycling"
    )

    class Town:
        def load(self, bbox: network.BBox) -> Graph:
            return crop(bike_town, bbox)

    graph = Town().load(job.area(TOWN))
    [home], _ = nearest_nodes(graph, [TOWN])
    # The start is on a westbound street: one block west along it, the
    # way back cannot ride the same street, only walk it (TASK-206).
    there = next(
        v
        for v in graph.successors(home)
        if all(d["oneway"] for d in graph[home][v].values())
    )
    assert all(on_foot_edge(d) for d in graph[there][home].values())
    plan = job.here((graph.nodes[there]["y"], graph.nodes[there]["x"]), Town())
    assert plan.search is not None
    assert plan.search.best.route.nodes[0] == there
    reached = with_approach(graph, plan, [home, there])
    assert reached.search is not None
    nodes = reached.search.best.route.nodes
    assert nodes[0] == nodes[-1] == home
    _legal(graph, nodes)
    # Back around the block by bike, not 300 m walked back (`step_cost`).
    assert not all(on_foot_edge(d) for d in graph[nodes[-2]][home].values())
    points = reached.result.points
    assert points[0] == points[-1]
    assert reached.result.distance_m > plan.result.distance_m


# --- distances, checks and the right network ---


def test_a_cycling_route_is_10_to_30_km_and_the_error_says_so() -> None:
    for distance in (10_000, 20_000, 30_000):
        RouteRequest(start=TOWN, shape="heart", distance_m=distance, activity="cycling")
    for distance in (5_000, 9_999, 30_001, 50_000):
        with pytest.raises(InvalidRequestError) as error:
            RouteRequest(
                start=TOWN, shape="heart", distance_m=distance, activity="cycling"
            )
        assert str(error.value) == (
            "distance must be between 10000 and 30000 metres for cycling, "
            f"got {distance}"
        )


def test_running_keeps_its_limits_and_messages() -> None:
    assert DISTANCE_LIMITS_M["running"] == (MIN_DISTANCE_M, MAX_DISTANCE_M)
    RouteRequest(start=TOWN, shape="heart", distance_m=5_000)
    with pytest.raises(InvalidRequestError) as error:
        check_distance(500)
    assert str(error.value) == "distance must be between 1000 and 50000 metres, got 500"
    # An activity the engine does not draw: the distance first, as before.
    with pytest.raises(InvalidRequestError) as error:
        RouteRequest(start=TOWN, shape="heart", distance_m=500, activity="hiking")
    assert str(error.value) == "distance must be between 1000 and 50000 metres, got 500"
    with pytest.raises(InvalidRequestError, match="choose one of: running, cycling"):
        RouteRequest(start=TOWN, shape="heart", distance_m=5_000, activity="hiking")


def test_the_cli_takes_cycling_and_states_its_limits(
    capsys: pytest.CaptureFixture[str],
) -> None:
    start = f"--start={TOWN[0]},{TOWN[1]}"
    request = parse_request(
        ["--shape=star", "--distance=20000", start, "--activity=cycling"]
    )
    assert request == RouteRequest(
        start=TOWN, shape="star", distance_m=20_000, activity="cycling"
    )
    for argv in (
        ["--shape=star", "--distance=5000", start, "--activity=cycling"],
        ["--word=CIAO", "--distance=40000", start, "--activity=cycling"],
    ):
        with pytest.raises(SystemExit) as exit_info:
            parse_request(argv)
        assert exit_info.value.code == 2
        assert "between 10000 and 30000 metres for cycling" in capsys.readouterr().err


def test_unpaved_metres_count_on_the_bike_network_only(bike_town: Graph) -> None:
    track = _edges_of(bike_town, _column_way(TRACK_COL))
    assert track
    u, v = track[0]
    data = min(bike_town[u][v].values(), key=lambda d: float(d["length"]))
    assert unpaved(data)
    checks = measure(bike_town, [TOWN, TOWN], [u, v])
    assert checks["unpaved"] == pytest.approx(float(data["length"]))
    [issue] = [i for i in validate(checks) if i.code == "unpaved"]
    assert issue.message == f"{checks['unpaved']:.0f} m of the route on unpaved roads"
    foot = ox.load_graphml(FIXTURE)
    a, b = next(iter(foot.edges()))
    assert set(measure(foot, [TOWN, TOWN], [a, b])) == {
        "reuse",
        "retrace",
        "steps",
        "busy",
        "tunnel",
    }


def test_a_route_is_never_drawn_on_the_network_of_another_activity(
    bike_town: Graph,
) -> None:
    foot = ox.load_graphml(FIXTURE)
    check_network(foot, "running")
    check_network(bike_town, "cycling")
    with pytest.raises(WrongNetworkError, match="cycling route is drawn on the bike"):
        check_network(foot, "cycling")
    with pytest.raises(WrongNetworkError, match="running route is drawn on the foot"):
        check_network(bike_town, "running")

    class Foot:
        def load(self, bbox: network.BBox) -> Graph:
            return foot

    heart = get_shape("heart")(SHAPE_POINTS)
    with pytest.raises(WrongNetworkError):
        plan_shape(heart, "heart", TOWN, 10_000, Foot(), activity="cycling")
    request = RouteRequest(
        start=TOWN, shape="heart", distance_m=10_000, activity="cycling"
    )
    with pytest.raises(WrongNetworkError):
        ShapeJob.of_request(request).here(TOWN, Foot())


def test_bike_zones_for_30_km_are_wider_than_todays_zones() -> None:
    """What the API's part must know: the zone of a 30 km circle."""
    circle = get_shape("circle")(SHAPE_POINTS)
    south, west, north, east = required_area(circle, TOWN, 30_000)
    x0, y0 = latlon_to_local(TOWN, (south, west))
    x1, y1 = latlon_to_local(TOWN, (north, east))
    assert 22_000 < x1 - x0 < 24_000
    assert 22_000 < y1 - y0 < 24_000
