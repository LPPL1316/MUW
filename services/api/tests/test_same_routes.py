"""An engine that only moved its code keeps the routes kept (TASK-376,
ADR-0320): route_store.SAME_ROUTES_AS says which fingerprint draws the same
routes as an earlier one, and this file is its proof.

A fixed set of routes, offline, of every activity the engine draws (runs on
the Levico graph and on a town of streets downloaded from a fake Overpass,
bike rides on the same town, paddling and swims on the coast and the lake
of the water fixtures), each as a hash of its whole result. A proof is the
file tests/fixtures/same_routes/<fingerprint>.json those hashes were
written into by the engine of that fingerprint:

    cd services/api && python tests/test_same_routes.py

A line of SAME_ROUTES_AS needs the proofs of both its fingerprints, made
on the same platform, with the same hashes. A change of behaviour never
gets a line: its routes are drawn again.

The last digits of a route are the platform's: the Mac (arm64) and Linux in
CI draw some of these routes apart, as they do the search of
test_first_placement. So a proof says where it was made, and the engine of
now is checked against it only there.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import platform
import sys
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType
from typing import Any

import pytest
from route_engine import water
from route_engine.geo import local_to_latlon
from route_engine.models import RouteRequest
from route_engine.network import FileSource, OsmnxSource
from route_engine.optimizer import plan_route
from route_engine.paddling import plan_paddling
from route_engine.swimming import SwimRequest, plan_swimming
from route_engine.water import FileWaterSource

from shaperoute_api import paddle_examples, route_store
from shaperoute_api.route_store import SAME_ROUTES_AS, code_fingerprint, same_routes_as

PROOFS = Path(__file__).parent / "fixtures" / "same_routes"
ENGINE_TESTS = Path(__file__).resolve().parents[2] / "route-engine" / "tests"
ENGINE_FIXTURES = ENGINE_TESTS / "fixtures"
LEVICO = (46.0122, 11.2986)
# The fingerprints a proof is written for: every route but a swim, the
# swims', and that of the paddling examples of the app.
KINDS = ("engine", "swims", "paddle")


def platform_now() -> str:
    """Where the routes are drawn: "darwin-arm64", "linux-x86_64"."""
    return f"{sys.platform}-{platform.machine()}"


def _module(name: str, path: Path) -> ModuleType:
    """A module of the engine's tests, read from its file: in CI the tests
    folder is not a package."""
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@contextmanager
def _offline(patch: pytest.MonkeyPatch) -> Iterator[None]:
    """Overpass answers every road download with the town of
    test_bike_network, and refuses every water download."""
    import osmnx as ox
    import osmnx._overpass as osmnx_overpass
    import route_engine.network as network

    town = _module("same_routes_town", ENGINE_TESTS / "test_bike_network.py")

    def download(polygon: Any, network_type: str, custom_filter: Any) -> Any:
        yield town.town_answer()

    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("water downloaded")

    patch.setattr(osmnx_overpass, "_download_overpass_network", download)
    patch.setattr(network, "reachable", town._anywhere)
    patch.setattr(ox.settings, "cache_folder", ox.settings.cache_folder)
    patch.setattr(water, "overpass", refused)
    yield


def _routes(cache: Path) -> dict[str, Callable[[], Any]]:
    """The fixed routes, each a call that draws its result."""
    build = _module("same_routes_water", ENGINE_FIXTURES / "make_water_fixtures.py")
    coast = FileWaterSource(ENGINE_FIXTURES / "water_coast.json")
    lake = FileWaterSource(ENGINE_FIXTURES / "water_lake.json")
    coast_start = local_to_latlon(build.COAST_ORIGIN, 100.0, 80.0)
    lake_start = local_to_latlon(build.LAKE_ORIGIN, -700.0, 0.0)
    levico = FileSource(ENGINE_FIXTURES / "levico_walk_1km.graphml")
    foot = OsmnxSource(cache / "foot")
    bike = OsmnxSource.for_activity(cache / "bike", "cycling")

    def run(source: Any, shape: str, distance_m: int, start: Any = LEVICO) -> Any:
        request = RouteRequest(start=start, shape=shape, distance_m=distance_m)
        return lambda: plan_route(request, source).result

    def ride(shape: str) -> Any:
        request = RouteRequest(
            start=LEVICO, shape=shape, distance_m=10_000, activity="cycling"
        )
        return lambda: plan_route(request, bike).result

    def paddle(source: Any, start: Any, shape: str) -> Any:
        request = RouteRequest(
            start=start, shape=shape, distance_m=2000, activity="paddling"
        )
        return lambda: plan_paddling(request, source).result

    def swim(source: Any, start: Any) -> Any:
        request = SwimRequest(start=start, distance_m=500, shape="star")
        return lambda: plan_swimming(request, source).result

    return {
        "running-levico-circle-1km": run(levico, "circle", 1000),
        "running-town-heart-3km": run(foot, "heart", 3000),
        "running-town-star-5km": run(foot, "star", 5000),
        "cycling-town-circle-10km": ride("circle"),
        "cycling-town-heart-10km": ride("heart"),
        "paddling-coast-heart-2km": paddle(coast, coast_start, "heart"),
        "paddling-lake-circle-2km": paddle(lake, lake_start, "circle"),
        "swimming-coast-star": swim(coast, coast_start),
        "swimming-lake-star": swim(lake, lake_start),
    }


def result_hash(result: Any) -> str:
    """The whole result, points and all, as a few letters."""
    text = json.dumps(asdict(result), sort_keys=True, default=repr)
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def drawn_now(patch: pytest.MonkeyPatch, cache: Path) -> dict[str, str]:
    """The fixed routes, as the engine of now draws them."""
    with _offline(patch):
        return {name: result_hash(draw()) for name, draw in _routes(cache).items()}


def fingerprints_now() -> dict[str, str]:
    """The fingerprints of the engine's code as it is, before SAME_ROUTES_AS."""
    return {
        "engine": code_fingerprint(),
        "swims": code_fingerprint(swims=True),
        "paddle": paddle_examples.code_fingerprint(),
    }


def proofs() -> list[dict[str, Any]]:
    return [json.loads(p.read_text("utf-8")) for p in sorted(PROOFS.glob("*.json"))]


def proof_of(fingerprint: str) -> dict[str, Any] | None:
    """The proof written by the engine with `fingerprint`, of any kind."""
    for proof in proofs():
        if fingerprint in proof["fingerprints"].values():
            return proof
    return None


def record() -> Path:
    """Write the proof of the engine of now."""
    with TemporaryDirectory() as folder, pytest.MonkeyPatch.context() as patch:
        routes = drawn_now(patch, Path(folder))
    fingerprints = fingerprints_now()
    PROOFS.mkdir(parents=True, exist_ok=True)
    path = PROOFS / f"{fingerprints['engine']}.json"
    proof = {"fingerprints": fingerprints, "platform": platform_now(), "routes": routes}
    path.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", "utf-8")
    return path


# --- SAME_ROUTES_AS ----------------------------------------------------------


def test_every_line_has_the_proof_of_its_two_fingerprints() -> None:
    # No proof, no line: a change of behaviour draws its routes again.
    for moved, earlier in SAME_ROUTES_AS.items():
        after, before = proof_of(moved), proof_of(earlier)
        assert after is not None, f"no proof of {moved} in {PROOFS}"
        assert before is not None, f"no proof of {earlier} in {PROOFS}"
        kind = next(k for k, v in after["fingerprints"].items() if v == moved)
        assert before["fingerprints"][kind] == earlier, (moved, earlier)
        assert after["platform"] == before["platform"], (moved, earlier)
        assert after["routes"] == before["routes"], (moved, earlier)


def test_the_engine_of_now_draws_what_its_proof_says(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # The proofs are true: written by this engine, not by hand.
    proof = proof_of(code_fingerprint())
    if proof is None:
        pytest.skip("no proof of this engine: it needs none without a line")
    if proof["platform"] != platform_now():
        pytest.skip(f"the proof was made on {proof['platform']}")
    assert proof["fingerprints"] == fingerprints_now()
    assert drawn_now(monkeypatch, tmp_path) == proof["routes"]


def test_the_routes_are_the_same_drawn_twice(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    first = drawn_now(monkeypatch, tmp_path / "first")
    assert len(first) == 9
    assert drawn_now(monkeypatch, tmp_path / "second") == first


def test_a_moved_engine_keeps_the_earliest_fingerprint_in_a_chain() -> None:
    aliases = {"c": "b", "b": "a"}
    assert same_routes_as("c", aliases) == "a"
    assert same_routes_as("b", aliases) == "a"
    assert same_routes_as("a", aliases) == "a"
    assert same_routes_as("z", aliases) == "z"


def test_a_chain_that_goes_round_is_refused() -> None:
    with pytest.raises(ValueError, match="goes round"):
        same_routes_as("a", {"a": "b", "b": "a"})


def test_the_fingerprints_follow_the_lines(monkeypatch: pytest.MonkeyPatch) -> None:
    now = fingerprints_now()
    aliases = {now["engine"]: "e0", now["swims"]: "s0", now["paddle"]: "p0"}
    monkeypatch.setattr(route_store, "SAME_ROUTES_AS", aliases)
    assert route_store.engine_fingerprint() == "e0"
    assert route_store.engine_fingerprint(swims=True) == "s0"
    assert paddle_examples.engine_fingerprint() == "p0"


if __name__ == "__main__":
    sys.exit(print(record()))
