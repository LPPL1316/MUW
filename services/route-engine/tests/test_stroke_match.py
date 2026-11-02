"""A stroke drawn on the map, anchored to the roads (stroke_match.py,
TASK-347 part A, ADR-0300). No network: street grids made here, as in
test_network.py, and the Levico fixture."""

from __future__ import annotations

from pathlib import Path

import networkx as nx
import numpy as np
import osmnx as ox
import pytest

from route_engine.errors import CollapsedShapeError, ShapeNotDrawableError
from route_engine.geo import LatLon, latlon_to_local_array, local_to_latlon
from route_engine.models import InvalidRequestError
from route_engine.network import (
    CORRIDOR_BAND,
    SPARSE_THRESHOLD_M,
    ZONE_RADIUS,
    Graph,
    WrongNetworkError,
    nearest_nodes,
)
from route_engine.stroke_match import (
    DEFAULT_FIT,
    FLOOR_M,
    LOOSE_SHARE,
    MAX_ANCHORS,
    TIGHT_SHARE,
    StrokeMatch,
    anchored_share,
    magnet_m,
    magnet_share,
    snap_stroke,
    thin,
)

LEVICO = (46.0122, 11.2986)
FIXTURE = Path(__file__).parent / "fixtures" / "levico_walk_1km.graphml"
SPACING_M = 100.0


def _grid(rows: int, columns: int) -> Graph:
    """rows × columns crossings SPACING_M apart from LEVICO, both ways:
    node (i, j) is i cells east and j cells north."""
    graph: Graph = nx.MultiDiGraph(crs="epsg:4326")
    for i in range(columns):
        for j in range(rows):
            lat, lon = local_to_latlon(LEVICO, i * SPACING_M, j * SPACING_M)
            graph.add_node((i, j), y=lat, x=lon)
    for i in range(columns):
        for j in range(rows):
            for di, dj in ((1, 0), (0, 1)):
                a, b = (i, j), (i + di, j + dj)
                if b in graph:
                    graph.add_edge(a, b, length=SPACING_M)
                    graph.add_edge(b, a, length=SPACING_M)
    return graph


def _at(i: float, j: float) -> LatLon:
    return local_to_latlon(LEVICO, i * SPACING_M, j * SPACING_M)


def _dense(corners: list[LatLon], between: int = 10) -> list[LatLon]:
    """The polyline through `corners`, with `between` points on each side:
    a finger's line, as the app sends it."""
    points: list[LatLon] = []
    for a, b in zip(corners, corners[1:], strict=False):
        for k in range(between):
            f = k / between
            points.append((a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])))
    points.append(corners[-1])
    return points


GRID = _grid(12, 30)


def test_the_magnet_runs_from_tight_to_todays_values() -> None:
    assert magnet_share(0.0) == TIGHT_SHARE
    assert magnet_share(1.0) == LOOSE_SHARE == ZONE_RADIUS == CORRIDOR_BAND
    assert TIGHT_SHARE < magnet_share(0.5) < LOOSE_SHARE
    # Never tighter than a finger: 0.5% of 1 km is 5 m, the floor is 10.
    assert magnet_m(0.0, 1000.0) == FLOOR_M
    assert magnet_m(1.0, 3000.0) == pytest.approx(60.0)
    # For a whole drawing, as a share of its length, the floor included.
    assert anchored_share(None, 5000.0) == pytest.approx(magnet_share(DEFAULT_FIT))
    assert anchored_share(0.0, 500.0) == pytest.approx(FLOOR_M / 500.0)


@pytest.mark.parametrize("fit", [-0.1, 1.5, float("nan")])
def test_a_magnet_out_of_range_is_refused(fit: float) -> None:
    with pytest.raises(InvalidRequestError, match="fit must be between 0 and 1"):
        magnet_share(fit)
    with pytest.raises(InvalidRequestError, match="fit must be between 0 and 1"):
        snap_stroke([_at(1, 1), _at(5, 1)], GRID, fit=fit)


def test_thinning_keeps_the_ends_and_the_corners() -> None:
    corners = [_at(1, 1), _at(5, 1), _at(5, 6), _at(9, 6)]
    xy = latlon_to_local_array(corners[0], np.array(_dense(corners, 20)))
    kept = thin(xy, 5.0)
    assert kept[0] == 0 and kept[-1] == len(xy) - 1
    # The two corners of the line, and nothing on its straight sides.
    assert kept == [0, 20, 40, len(xy) - 1]
    # Too many vertices within the tolerance: it doubles until they fit.
    wiggly = np.column_stack([np.arange(500) * 2.0, (np.arange(500) % 2) * 30.0])
    assert len(thin(wiggly, 1.0, most=MAX_ANCHORS)) <= MAX_ANCHORS
    assert thin(wiggly[:2], 1.0) == [0, 1]


def test_a_straight_stroke_follows_the_road_beside_it() -> None:
    # Along the row j = 5, a finger's wobble of up to 15 m.
    line = [
        local_to_latlon(LEVICO, x, 5 * SPACING_M + 15.0 * np.sin(x / 50.0))
        for x in np.linspace(200.0, 2000.0, 60)
    ]
    match = snap_stroke(line, GRID)
    assert isinstance(match, StrokeMatch)
    assert match.nodes[0] == (2, 5) and match.nodes[-1] == (20, 5)
    assert all(j == 5 for _, j in match.nodes)
    assert match.points[0] == pytest.approx(_at(2, 5))
    assert len(match.away_m) == len(line)
    assert max(match.away_m) <= 15.0 + 1e-6
    assert not match.off_roads


def test_a_w_keeps_its_tips() -> None:
    # Four strokes of a W: the tips at the bottom and the top are corners,
    # reached and left again, never pruned as spurs.
    corners = [_at(2, 10), _at(6, 2), _at(10, 10), _at(14, 2), _at(18, 10)]
    match = snap_stroke(_dense(corners), GRID, fit=0.5)
    assert match.nodes[0] == (2, 10) and match.nodes[-1] == (18, 10)
    for tip in ((6, 2), (10, 10), (14, 2)):
        assert tip in match.nodes
    assert max(match.away_m) < SPACING_M / 2


def test_a_stroke_after_the_first_starts_at_the_given_node() -> None:
    corners = [_at(10, 5), _at(14, 5)]
    far = (2, 9)  # where the stroke before ended, 1.2 km away
    match = snap_stroke(_dense(corners), GRID, start_node=far)
    assert match.nodes[0] == far
    assert match.points[0] == pytest.approx(_at(2, 9))
    assert match.nodes[-1] == (14, 5)
    # The way from the node before to the stroke is in the route, so the
    # strokes join along the roads: the stroke itself is still followed.
    assert (10, 5) in match.nodes
    assert max(match.away_m) < 1e-6
    # The same stroke on its own starts at the node nearest to its first point.
    alone = snap_stroke(_dense(corners), GRID)
    assert alone.nodes[0] == (10, 5)
    with pytest.raises(InvalidRequestError, match="start node is not on this graph"):
        snap_stroke(_dense(corners), GRID, start_node=("nowhere", 0))


def test_a_tight_magnet_follows_the_finger_a_loose_one_takes_the_road() -> None:
    # A zigzag along the row j = 5, 100 m a step, its peaks 60 m up between
    # the rows, 4.7 km long. At fit 1 the zones are 2% of it, 93 m: the
    # road at j = 5 is 60 m from every peak, within them, and cheaper than
    # climbing to j = 6 (40 m away) and back. At fit 0 they are 23 m: no node
    # is that close to a peak, the nearest one, at j = 6, is taken, and the
    # route climbs to each.
    wide = _grid(12, 50)  # 4.7 km of zigzag need 45 columns
    corners = [_at(2 + k, 5 + 0.6 * (k % 2)) for k in range(41)]
    line = _dense(corners, 4)
    loose = snap_stroke(line, wide, fit=1.0)
    tight = snap_stroke(line, wide, fit=0.0)
    assert not any(j == 6 for _, j in loose.nodes)
    assert sum(1 for _, j in tight.nodes if j == 6) >= 15
    assert max(loose.away_m) == pytest.approx(60.0, abs=0.5)
    assert max(tight.away_m) < max(loose.away_m)
    assert len(tight.points) > len(loose.points)


def test_a_stroke_going_back_on_itself_comes_back_on_the_same_road() -> None:
    # Out along the row and back: the tip is a corner, the way back costs
    # no more than the way out (ADR-0039), and nothing is pruned.
    corners = [_at(2, 5), _at(8, 5), _at(2, 5)]
    match = snap_stroke(_dense(corners), GRID)
    assert match.nodes[0] == match.nodes[-1] == (2, 5)
    assert (8, 5) in match.nodes
    assert all(j == 5 for _, j in match.nodes)
    assert len(match.nodes) == 13


def test_a_stroke_in_the_fields_is_off_the_roads() -> None:
    # 600 m north of the top row: every point is far from a road, the route
    # runs along the nearest roads anyway, and off_roads says so.
    line = [
        local_to_latlon(LEVICO, x, 11 * SPACING_M + 600.0)
        for x in range(200, 2001, 600)
    ]
    match = snap_stroke(line, GRID)
    assert match.off_roads
    assert all(j == 11 for _, j in match.nodes)
    assert min(match.away_m) > SPARSE_THRESHOLD_M
    on = snap_stroke([_at(2, 11), _at(8, 11), _at(14, 11)], GRID)
    assert not on.off_roads


def test_a_stroke_on_a_single_road_node_is_not_drawable() -> None:
    # Every point nearest to the corner of the grid, and no other start.
    line = [local_to_latlon(LEVICO, 4000.0 + x, 4000.0) for x in (0.0, 20.0, 40.0)]
    with pytest.raises(CollapsedShapeError, match="single road node"):
        snap_stroke(line, GRID)
    assert issubclass(CollapsedShapeError, ShapeNotDrawableError)
    # From another node the route exists: that node to this one.
    match = snap_stroke(line, GRID, start_node=(27, 11))
    assert match.nodes[0] == (27, 11) and match.nodes[-1] == (29, 11)
    with pytest.raises(InvalidRequestError, match="at least 2 points"):
        snap_stroke([_at(1, 1)], GRID)


def test_a_graph_of_another_network_is_refused() -> None:
    with pytest.raises(WrongNetworkError):
        snap_stroke([_at(1, 1), _at(5, 1)], GRID, activity="cycling")


def test_hundreds_of_points_are_traced_through_a_few_anchors() -> None:
    # The app's line may have hundreds of points: the anchors are at most
    # MAX_ANCHORS, every point still gets its distance.
    corners = [_at(2, 2), _at(20, 2), _at(20, 9), _at(2, 9)]
    line = _dense(corners, 150)
    match = snap_stroke(line, GRID, fit=0.0)
    assert len(match.away_m) == len(line) == 451
    assert match.nodes[0] == (2, 2) and match.nodes[-1] == (2, 9)
    assert max(match.away_m) < 1e-6


def test_a_real_street_is_followed_on_the_levico_fixture() -> None:
    graph = ox.load_graphml(FIXTURE)
    # A stroke along the points of a road of the fixture, pushed 20 m west.
    nodes = list(graph.nodes)[:1]
    path = nx.single_source_dijkstra_path_length(graph, nodes[0], cutoff=600.0)
    far = max(path, key=path.get)
    along = nx.shortest_path(graph, nodes[0], far, weight="length")
    line = [
        local_to_latlon((graph.nodes[n]["y"], graph.nodes[n]["x"]), -20.0, 0.0)
        for n in along
    ]
    match = snap_stroke(line, graph, fit=0.5)
    assert match.nodes[0] == nodes[0]
    [nearest_end], _ = nearest_nodes(graph, [line[-1]])
    assert match.nodes[-1] == nearest_end
    assert not match.off_roads
    assert max(match.away_m) <= 20.0 + 1e-6
    assert all(
        nx.has_path(graph, u, v)
        for u, v in zip(match.nodes, match.nodes[1:], strict=False)
    )
