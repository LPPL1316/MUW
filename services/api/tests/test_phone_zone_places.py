"""POST /phone-zones/{network}/places (phone_zone_places.py, TASK-334)."""

from __future__ import annotations

import shutil
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import BBox, FileSource, OsmnxSource, area_around

from shaperoute_api import __main__ as entry
from shaperoute_api.app import create_app
from shaperoute_api.phone_zone_api import install_phone_zones, phone_file
from shaperoute_api.phone_zone_cap import TrafficCap
from shaperoute_api.phone_zone_places import (
    FAILED_FOR_S,
    PAUSE_FILE,
    PLACE_MARGIN_M,
    QUIET_S,
    PlaceBuilds,
    RouteWork,
    download_zone,
)
from shaperoute_api.phone_zones import SUFFIX, zone_name

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"
# Levico's zone holds 6 km around Levico; Trento, Rovereto and Arco are
# outside it.
BBOX = (45.95, 11.2, 46.07, 11.4)
LEVICO = {"lat": 46.0122, "lon": 11.2986}
TRENTO = {"lat": 46.0679, "lon": 11.1211}
ROVERETO = {"lat": 45.8906, "lon": 11.0401}
ARCO = {"lat": 45.9177, "lon": 10.8867}
RIVA = {"lat": 45.8858, "lon": 10.8411}
PHONE = {"X-Phone-Id": "0123456789abcdef0123456789abcdef"}
OTHER_PHONE = {"X-Phone-Id": "fedcba9876543210fedcba9876543210"}


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def saved(source: OsmnxSource, bbox: BBox) -> None:
    """A download that saves Levico's roads under the place's name."""
    shutil.copy(LEVICO_GRAPH, source.cache_path(bbox))


@pytest.fixture
def cache(tmp_path: Path) -> Path:
    shutil.copy(LEVICO_GRAPH, tmp_path / f"{zone_name('foot', BBOX)}.graphml")
    return tmp_path


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def builds(cache: Path, clock: Clock) -> PlaceBuilds:
    return PlaceBuilds(cache, phone_file, download=saved, clock=clock, background=False)


@pytest.fixture
def client(cache: Path, builds: PlaceBuilds) -> TestClient:
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, places=builds)
    return TestClient(app)


def keep(
    client: TestClient, place: dict[str, float], phone: dict[str, str] = PHONE
) -> Any:
    return client.post("/phone-zones/foot/places", json=place, headers=phone)


def test_a_place_the_server_has_is_ready(client: TestClient) -> None:
    answer = keep(client, LEVICO)
    assert answer.status_code == 200
    assert answer.json() == {"state": "ready"}


def test_a_place_it_has_not_is_prepared_then_downloaded(
    client: TestClient, builds: PlaceBuilds, cache: Path
) -> None:
    assert keep(client, TRENTO).status_code == 202
    again = keep(client, TRENTO)
    assert again.status_code == 202
    assert again.json() == {"state": "preparing"}
    assert builds.work_once()
    assert not builds.work_once()  # asked twice, prepared once
    assert keep(client, TRENTO).json() == {"state": "ready"}
    name = zone_name(
        "foot", area_around([(TRENTO["lat"], TRENTO["lon"])], PLACE_MARGIN_M)
    )
    assert (cache / f"{name}{SUFFIX}").exists()  # written before the phone asks
    zone = client.get(
        "/phone-zones/foot", params={**TRENTO, "margin_m": PLACE_MARGIN_M}
    )
    assert zone.status_code == 200
    assert f"{name}{SUFFIX}" in zone.headers["content-disposition"]


def test_three_new_places_a_day_for_each_phone(client: TestClient) -> None:
    for place in (TRENTO, ROVERETO, ARCO):
        assert keep(client, place).status_code == 202
    refused = keep(client, RIVA)
    assert refused.status_code == 429
    assert refused.json()["error"]["code"] == "too_many_requests"
    assert 0 < int(refused.headers["retry-after"]) <= 86_400
    assert keep(client, RIVA, OTHER_PHONE).status_code == 202
    # One the server has costs nothing.
    assert keep(client, LEVICO).status_code == 200


def test_the_server_prepares_a_few_a_day_in_all(cache: Path) -> None:
    builds = PlaceBuilds(
        cache,
        phone_file,
        cap=TrafficCap(per_phone=3, total=2),
        download=saved,
        background=False,
    )
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, places=builds)
    client = TestClient(app)
    assert keep(client, TRENTO).status_code == 202
    assert keep(client, ROVERETO, OTHER_PHONE).status_code == 202
    assert keep(client, ARCO).status_code == 429


def test_a_place_that_failed_waits_before_it_is_asked_again(
    cache: Path, clock: Clock
) -> None:
    def refused(source: OsmnxSource, bbox: BBox) -> None:
        raise RuntimeError("Overpass is busy")

    builds = PlaceBuilds(
        cache, phone_file, download=refused, clock=clock, background=False
    )
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, places=builds)
    client = TestClient(app)
    assert keep(client, TRENTO).status_code == 202
    assert builds.work_once()
    failed = keep(client, TRENTO)
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "map_data_unavailable"
    assert int(failed.headers["retry-after"]) == FAILED_FOR_S
    clock.now += FAILED_FOR_S
    assert keep(client, TRENTO).status_code == 202


def test_a_place_on_an_unknown_network(client: TestClient) -> None:
    answer = client.post("/phone-zones/boat/places", json=LEVICO, headers=PHONE)
    assert answer.status_code == 404


def test_a_place_off_the_map_is_refused(client: TestClient) -> None:
    answer = client.post(
        "/phone-zones/foot/places", json={"lat": 91, "lon": 0}, headers=PHONE
    )
    assert answer.status_code == 422


def test_the_bike_place_is_prepared_on_the_bike_network(
    client: TestClient, builds: PlaceBuilds, cache: Path
) -> None:
    answer = client.post("/phone-zones/bike/places", json=LEVICO, headers=PHONE)
    assert answer.json() == {"state": "preparing"}  # Levico has only foot
    assert builds.work_once()
    assert list(cache.glob(f"bike_*{SUFFIX}"))


class Source:
    def __init__(self, network_name: str, names_fail: bool = False) -> None:
        self.network_name = network_name
        self.names_fail = names_fail
        self.asked: list[str] = []

    def load(self, bbox: BBox) -> None:
        self.asked.append("roads")

    def named_roads(self, bbox: BBox) -> None:
        self.asked.append("names")
        if self.names_fail:
            raise RuntimeError("Overpass is busy")


def test_on_foot_the_street_names_too() -> None:
    foot, bike = Source("foot"), Source("bike")
    download_zone(foot, BBOX)  # type: ignore[arg-type]
    download_zone(bike, BBOX)  # type: ignore[arg-type]
    assert foot.asked == ["roads", "names"]
    assert bike.asked == ["roads"]


def test_a_zone_without_names_is_still_a_zone() -> None:
    foot = Source("foot", names_fail=True)
    download_zone(foot, BBOX)  # type: ignore[arg-type]
    assert foot.asked == ["roads", "names"]


def test_the_places_run_by_themselves(cache: Path) -> None:
    builds = PlaceBuilds(cache, phone_file, download=saved)
    point = (TRENTO["lat"], TRENTO["lon"])
    assert builds.ask("foot", point, "id:a") == ("preparing", 0)
    for _ in range(200):
        if builds.ask("foot", point, "id:a") == ("ready", 0):
            break
        time.sleep(0.05)
    assert builds.ask("foot", point, "id:a") == ("ready", 0)


def test_the_api_started_from_the_command_line_has_them(
    monkeypatch: pytest.MonkeyPatch, cache: Path
) -> None:
    served: dict[str, Any] = {}

    def run(app: Any, host: str, port: int) -> None:
        served["app"] = app

    monkeypatch.setattr(entry.uvicorn, "run", run)
    entry.main(["--cache-dir", str(cache)])
    client = TestClient(served["app"])
    assert keep(client, LEVICO).json() == {"state": "ready"}


def test_no_place_starts_while_routes_are_drawn(cache: Path) -> None:
    drawing = {"now": True}
    builds = PlaceBuilds(
        cache,
        phone_file,
        download=saved,
        background=False,
        busy=lambda: drawing["now"],
    )
    point = (TRENTO["lat"], TRENTO["lon"])
    assert builds.ask("foot", point, "id:a") == ("preparing", 0)
    assert not builds.work_once()  # the night run of draw_examples
    assert builds.ask("foot", point, "id:a") == ("preparing", 0)
    drawing["now"] = False
    assert builds.work_once()
    assert builds.ask("foot", point, "id:a") == ("ready", 0)


def test_the_pause_file_holds_every_place(cache: Path, builds: PlaceBuilds) -> None:
    point = (TRENTO["lat"], TRENTO["lon"])
    builds.ask("foot", point, "id:a")
    (cache / PAUSE_FILE).touch()
    assert not builds.work_once()
    (cache / PAUSE_FILE).unlink()
    assert builds.work_once()


def test_the_api_sees_the_route_jobs_asked_and_followed(
    cache: Path, builds: PlaceBuilds, clock: Clock
) -> None:
    work = RouteWork(clock=clock)
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, places=builds, work=work)
    client = TestClient(app)
    assert not work.busy()
    client.get("/phone-zones/foot", params=LEVICO)  # not a route
    keep(client, TRENTO)
    assert not work.busy()
    client.get("/route-jobs/unknown")  # draw_examples follows its job
    assert work.busy()
    clock.now += QUIET_S - 1
    assert work.busy()
    client.post("/route-jobs", json={})  # and asks the next one
    clock.now += QUIET_S - 1
    assert work.busy()
    clock.now += 1
    assert not work.busy()
