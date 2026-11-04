"""The registers of networks and activities (TASK-376, ADR-0320) give the
tables models.py and network.py wrote by hand before them, value for value
and in the same order: moving them drew no route otherwise
(services/api/tests/test_same_routes.py)."""

from __future__ import annotations

import ast
from pathlib import Path

import route_engine
from route_engine import models, network
from route_engine.activities import ENGINE_ACTIVITIES
from route_engine.networks import NETWORKS_BY_NAME, bike, foot

ENGINE = Path(route_engine.__file__).parent

# The tables as they were written before the registers.
BEFORE_SUPPORTED = ("running", "cycling", "paddling", "swimming")
BEFORE_LIMITS = {
    "running": (1_000, 50_000),
    "cycling": (10_000, 30_000),
    "paddling": (1_000, 5_000),
    "swimming": (500, 3_000),
}
BEFORE_NETWORKS = {"running": "foot", "cycling": "bike"}


def test_the_activities_are_those_of_before_in_their_order() -> None:
    assert models.SUPPORTED_ACTIVITIES == BEFORE_SUPPORTED
    assert models.ACTIVITIES == BEFORE_SUPPORTED
    assert list(models.DISTANCE_LIMITS_M.items()) == list(BEFORE_LIMITS.items())
    assert (models.MIN_DISTANCE_M, models.MAX_DISTANCE_M) == (1_000, 50_000)
    assert models.WATER_ACTIVITIES == {"paddling", "swimming"}
    assert models.DRAWN_ON_WATER == {"swimming"}


def test_the_networks_are_those_of_before() -> None:
    assert list(network.NETWORKS.items()) == list(BEFORE_NETWORKS.items())
    assert network.FILTERS == {
        "foot": network.FOOT_FILTER,
        "bike": network.BIKE_FILTER,
    }
    assert network.FOOT_NETWORK_NAME == "foot"
    assert network.BIKE_NETWORK_NAME == "bike"
    # The names of before are still read from network.py.
    assert network.rideable is bike.rideable
    assert network.download_bike_graph is bike.download_bike_graph


def test_every_activity_is_on_a_network_of_the_register_or_on_the_water() -> None:
    names = [activity.name for activity in ENGINE_ACTIVITIES]
    assert len(names) == len(set(names))
    for activity in ENGINE_ACTIVITIES:
        assert (activity.network is None) == activity.on_water, activity.name
        assert activity.network is None or activity.network in NETWORKS_BY_NAME
        assert not activity.drawn_on_water or activity.on_water
        low, high = activity.distance_m
        assert 0 < low < high, activity.name


def test_every_network_is_registered_under_its_own_name() -> None:
    assert NETWORKS_BY_NAME == {"foot": foot.NETWORK, "bike": bike.NETWORK}
    for name, registered in NETWORKS_BY_NAME.items():
        assert registered.name == name


def test_the_source_of_an_activity_is_its_network_s() -> None:
    source = network.OsmnxSource.for_activity(Path("cache"), "cycling")
    assert (source.network_name, source.custom_filter) == ("bike", bike.BIKE_FILTER)
    source = network.OsmnxSource.for_activity(Path("cache"), "running")
    assert (source.network_name, source.custom_filter) == ("foot", foot.FOOT_FILTER)


def _imports(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text("utf-8"))):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def test_the_registers_import_nothing_that_draws() -> None:
    # A network or an activity is data and its own rules: what draws reads
    # them, never the other way round, so a register has no import loop.
    allowed = {"route_engine.activities", "route_engine.networks"}
    for folder in ("activities", "networks"):
        for path in sorted((ENGINE / folder).glob("*.py")):
            ours = {m for m in _imports(path) if m.startswith("route_engine")}
            assert all(m.rpartition(".")[0] in allowed or m in allowed for m in ours), (
                path.name,
                ours,
            )
