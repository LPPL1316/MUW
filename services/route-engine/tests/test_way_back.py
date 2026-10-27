"""The way back to a route, on the streets (TASK-314, ADR-0274), in a
made-up town: streets every 100 m, "Row j" running east, "Column i"
running north, the route along Row 0 going east."""

from collections.abc import Collection
from typing import Any

import networkx as nx
import pytest

from route_engine.geo import LatLon, haversine_m, latlon_to_local, local_to_latlon
from route_engine.network import WALK_COST
from route_engine.route_nodes import RouteNotOnGraphError
from route_engine.way_back import MAX_OFF_ROAD_M, MAX_WAY_M, NoWayBackError, way_back

TRENTO = (46.0671, 11.1214)
STREET_M = 100.0


def _at(x_m: float, y_m: float) -> LatLon:
    return local_to_latlon(TRENTO, x_m, y_m)


def _node(i: int, j: int) -> LatLon:
    return _at(i * STREET_M, j * STREET_M)


def _town(
    crossings: Collection[int] | None = None,
    one_way_up: Collection[int] = (),
    walked_down: Collection[int] = (),
    size: int = 12,
) -> nx.MultiDiGraph:
    """Streets every 100 m, both ways. With `crossings`, only those columns
    go from Row 0 to Row 1 (a railway in between); a column of
    `one_way_up` goes only north there, one of `walked_down` south with the
    bike on foot."""
    graph = nx.MultiDiGraph()
    span = range(-2, size)
    for i in span:
        for j in span:
            lat, lon = _node(i, j)
            graph.add_node((i, j), y=lat, x=lon)
    for i, j in list(graph.nodes):
        east, north = (i + 1, j), (i, j + 1)
        if east in graph:
            for a, b in (((i, j), east), (east, (i, j))):
                graph.add_edge(
                    a, b, length=STREET_M, name=f"Row {j}", highway="residential"
                )
        if north in graph:
            if j == 0 and crossings is not None and i not in crossings:
                continue
            up = {"length": STREET_M, "name": f"Column {i}", "highway": "residential"}
            graph.add_edge((i, j), north, **up)
            if not (j == 0 and i in one_way_up):
                down = {**up, "walk": "True"} if j == 0 and i in walked_down else up
                graph.add_edge(north, (i, j), **down)
    return graph


def _route(first: int = 0, last: int = 10) -> list[LatLon]:
    step = 1 if last >= first else -1
    return [_node(i, 0) for i in range(first, last + step, step)]


def _near(a: LatLon, b: LatLon, metres: float = 1.0) -> bool:
    return haversine_m(a, b) <= metres


def test_half_way_along_a_block_the_way_goes_on_to_the_next_corner() -> None:
    # Column 4 does not cross the railway: from 40 m past it the nearest
    # node is behind, the way forward is shorter.
    graph = _town(crossings=[5, 6])
    here = _at(440.0, 210.0)  # 10 m off Row 2

    way = way_back(graph, here, _route())

    assert way.points[0] == here
    assert _near(way.points[1], _at(440.0, 200.0))
    assert _near(way.points[2], _node(5, 2))
    assert _near(way.rejoin, _node(5, 0))
    assert way.rejoin_m == pytest.approx(500.0, abs=0.5)
    assert way.distance_m == pytest.approx(10.0 + 60.0 + 200.0, abs=0.5)


def test_the_rejoin_is_the_nearest_by_street_not_in_a_straight_line() -> None:
    # Row 0 is 100 m south, but only Column 8 crosses the railway.
    graph = _town(crossings=[8])
    here = _node(2, 1)

    way = way_back(graph, here, _route())

    assert _near(way.rejoin, _node(8, 0))
    assert way.distance_m == pytest.approx(700.0, abs=0.5)
    assert way.rejoin_m == pytest.approx(800.0, abs=0.5)


def test_the_way_never_runs_along_the_route() -> None:
    graph = _town(crossings=[8])

    way = way_back(graph, _at(150.0, 130.0), _route())

    # Every point but the last is north of the railway.
    assert all(latlon_to_local(TRENTO, p)[1] > 50.0 for p in way.points[:-1])
    assert _near(way.points[-1], way.rejoin)


def test_of_two_rejoins_as_near_the_first_along_the_route() -> None:
    graph = _town(crossings=[3, 5])
    here = _node(4, 1)

    east = way_back(graph, here, _route(0, 10))
    west = way_back(graph, here, _route(10, 0))

    assert _near(east.rejoin, _node(3, 0))
    assert _near(west.rejoin, _node(5, 0))
    assert west.rejoin_m == pytest.approx(500.0, abs=0.5)


def test_only_the_stretch_sent_is_a_rejoin() -> None:
    # The route from Column 6 on: Row 0 behind it is a street like another,
    # down Column 3 and along it, shorter than round by Column 9.
    graph = _town(crossings=[3, 9])

    way = way_back(graph, _node(3, 1), _route(6, 10))

    assert _near(way.rejoin, _node(6, 0))
    assert way.rejoin_m == pytest.approx(0.0, abs=0.5)
    assert way.distance_m == pytest.approx(400.0, abs=0.5)


def test_a_one_way_street_is_not_ridden_against() -> None:
    here = _at(320.0, 100.0)

    on_foot = way_back(_town(crossings=[3, 6]), here, _route())
    by_bike = way_back(_town(crossings=[3, 6], one_way_up=[3]), here, _route())

    assert _near(on_foot.rejoin, _node(3, 0))
    assert _near(by_bike.rejoin, _node(6, 0))


def test_a_street_walked_with_the_bike_costs_more() -> None:
    # Down Column 3 on foot: 20 + 100 m, costing 20 + 100 x WALK_COST.
    # Down Column 8 riding: 480 + 100 m, cheaper than that.
    assert 580.0 < 20.0 + 100.0 * WALK_COST
    here = _at(320.0, 100.0)

    way = way_back(_town(crossings=[3, 8], walked_down=[3]), here, _route())

    assert _near(way.rejoin, _node(8, 0))


def test_on_a_one_way_street_the_way_leaves_by_the_end_it_goes_to() -> None:
    graph = _town(crossings=[2, 5])
    # Row 1 between Columns 2 and 3 only goes east.
    graph.remove_edge((3, 1), (2, 1))
    here = _at(220.0, 100.0)

    way = way_back(graph, here, _route())

    assert _near(way.points[1], _node(3, 1)) or _near(way.points[2], _node(3, 1))
    assert _near(way.rejoin, _node(5, 0))


def test_the_directions_start_from_the_runner_and_end_at_the_rejoin() -> None:
    graph = _town(crossings=[5, 6])

    way = way_back(graph, _at(440.0, 210.0), _route())

    said = [(d.turn, d.street, round(d.distance_m)) for d in way.directions]
    assert said == [
        ("depart", "Row 2", 0),
        ("right", "Column 5", 70),
        ("left", "Row 0", 270),
    ]
    assert _near(way.directions[0].point, _at(440.0, 200.0))
    assert _near(way.directions[-1].point, way.rejoin)
    assert [d.joined for d in way.directions] == [False, False, False]


def test_a_turn_right_after_the_start_is_read_with_it() -> None:
    graph = _town(crossings=[5, 6])

    way = way_back(graph, _at(495.0, 200.0), _route())

    assert [(d.turn, d.joined) for d in way.directions[:2]] == [
        ("depart", False),
        ("right", True),
    ]


def test_the_nodes_are_those_the_directions_were_worked_out_on() -> None:
    graph = _town(crossings=[5, 6])

    way = way_back(graph, _at(440.0, 210.0), _route())

    assert way.nodes == [(4, 2), (5, 2), (5, 1), (5, 0), (6, 0)]


def test_a_runner_on_the_route_rejoins_where_they_are() -> None:
    graph = _town()

    way = way_back(graph, _at(300.0, 2.0), _route())

    assert way.distance_m < 105.0
    assert way.rejoin in (_node(3, 0), _node(4, 0))


def test_no_way_back_beyond_the_longest() -> None:
    # Only Column 35 crosses: 3.5 km along Row 1 from Column 0, 500 m from
    # Column 30.
    graph = _town(crossings=[35], size=40)
    assert MAX_WAY_M == 3000.0

    assert way_back(graph, _node(30, 1), _route(0, 38)).distance_m < 700.0
    with pytest.raises(NoWayBackError):
        way_back(graph, _node(0, 1), _route(0, 38))


def test_the_metres_to_the_road_count_in_the_longest() -> None:
    # From the town's west corner of Row 1 along it to Column 26 and down:
    # 2.9 km by road. From 150 m west of that corner, 3.05 km in all.
    graph = _town(crossings=[26], size=40)

    assert way_back(graph, _node(-2, 1), _route(0, 38)).distance_m < MAX_WAY_M
    with pytest.raises(NoWayBackError):
        way_back(graph, _at(-350.0, 100.0), _route(0, 38))


def test_far_from_every_road_there_is_no_way_back() -> None:
    graph = _town(crossings=[5])

    near = way_back(graph, _at(450.0, -2 * STREET_M - MAX_OFF_ROAD_M + 5.0), _route())
    assert near.points[0] != near.points[1]
    with pytest.raises(NoWayBackError):
        way_back(graph, _at(450.0, -2 * STREET_M - MAX_OFF_ROAD_M - 5.0), _route())


def test_no_way_back_from_roads_that_do_not_reach_the_route() -> None:
    graph = _town(crossings=[])

    with pytest.raises(NoWayBackError):
        way_back(graph, _node(4, 3), _route())


def test_a_stretch_off_the_map_is_refused() -> None:
    graph = _town()
    far: Any = [_at(50_000.0, 0.0), _at(50_500.0, 0.0)]

    with pytest.raises(RouteNotOnGraphError):
        way_back(graph, _node(1, 1), far)


def test_the_same_question_gives_the_same_way() -> None:
    graph = _town(crossings=[3, 5])
    here = _node(4, 1)

    assert way_back(graph, here, _route()) == way_back(graph, here, _route())
