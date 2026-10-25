"""The route job on the phone gives what /route-jobs gives (on_phone.py,
TASK-214, ADR-0177)."""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any

import osmnx as ox
import pytest
from fastapi.testclient import TestClient
from route_engine.models import InvalidRequestError
from route_engine.network import OsmnxSource, write_named_roads
from route_engine.sidewalks import NamedRoad

from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app
from shaperoute_api.app import to_request as api_to_request
from shaperoute_api.graphs import ZoneGraphs
from shaperoute_api.jobs import Job
from shaperoute_api.on_phone import (
    PhoneJobs,
    phone_graphs,
    plan_json,
    plan_on_phone,
    to_request,
    warm,
)
from shaperoute_api.phone_zones import SUFFIX, PhoneZones, write_zone, zone_name
from shaperoute_api.schemas import RouteRequestBody

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"
# The name of a zone that holds the Levico graph and the area of its routes.
BBOX = (45.95, 11.2, 46.07, 11.4)
LEVICO = (46.0122, 11.2986)
LEVICO_CIRCLE = {"start": list(LEVICO), "shape": "circle", "distance_m": 1500}


@pytest.fixture
def server_cache(tmp_path: Path) -> Path:
    """The server's cache: the Levico zone as GraphML, and named roads."""
    cache = tmp_path / "server"
    cache.mkdir()
    shutil.copy(LEVICO_GRAPH, cache / f"{zone_name('foot', BBOX)}.graphml")
    graph = ox.load_graphml(LEVICO_GRAPH)
    lat_lon = [(d["y"], d["x"]) for _, d in list(graph.nodes(data=True))[:3]]
    write_named_roads(
        [NamedRoad("Via Dante", tuple(lat_lon))],
        OsmnxSource(cache).names_path(BBOX),
    )
    return cache


@pytest.fixture
def phone_dir(tmp_path: Path, server_cache: Path) -> Path:
    """The phone's folder, with the zone the server would send for Levico."""
    phone = tmp_path / "phone"
    phone.mkdir()
    source = OsmnxSource(server_cache)
    write_zone(
        ox.load_graphml(LEVICO_GRAPH),
        source.named_roads(BBOX, download=False),
        "foot",
        BBOX,
        phone / f"{zone_name('foot', BBOX)}{SUFFIX}",
    )
    return phone


def from_the_server(cache: Path, body: dict[str, Any]) -> dict[str, Any]:
    """The finished job of POST /route-jobs, planned as the phone plans."""
    graphs = ActivityGraphs({"running": ZoneGraphs(OsmnxSource(cache))})
    with TestClient(create_app(graphs, planner=plan_on_phone)) as client:
        job_id = client.post("/route-jobs", json=body).json()["job_id"]
        deadline = time.monotonic() + 120
        while True:
            job: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
            if job["status"] in ("done", "failed"):
                return job
            assert time.monotonic() < deadline, job
            time.sleep(0.05)


@pytest.mark.parametrize(
    "body",
    [
        LEVICO_CIRCLE,
        {"start": [46.0, 11.3], "word": "CIAO", "distance_m": 12000, "style": "block"},
        {"start": [46.0, 11.3], "word": "SGRAVA", "distance_m": 18000, "pen_up": True},
        {
            "start": [46.0, 11.3],
            "shape": "heart",
            "distance_m": 15000,
            "activity": "cycling",
        },
    ],
)
def test_the_request_is_the_api_one(body: dict[str, Any]) -> None:
    parsed = RouteRequestBody.model_validate(body)
    assert to_request(parsed) == api_to_request(parsed)


def test_the_phone_answers_as_the_server(server_cache: Path, phone_dir: Path) -> None:
    # Two real runs of the engine, a few seconds each.
    server = from_the_server(server_cache, LEVICO_CIRCLE)
    phone = json.loads(
        plan_json(json.dumps(LEVICO_CIRCLE), PhoneJobs(phone_graphs(phone_dir)))
    )
    assert server["status"] == phone["status"] == "done"
    assert phone["result"] == server["result"]
    assert phone["error"] is None
    assert set(phone) == set(server)


def test_without_the_zone_the_phone_leaves_it_to_the_server(tmp_path: Path) -> None:
    phone = json.loads(
        plan_json(json.dumps(LEVICO_CIRCLE), PhoneJobs(phone_graphs(tmp_path)))
    )
    assert phone["status"] == "failed"
    assert phone["error"]["code"] == "map_data_unavailable"


def test_on_the_water_the_phone_leaves_it_to_the_server(phone_dir: Path) -> None:
    body = {**LEVICO_CIRCLE, "activity": "paddling"}
    phone = json.loads(plan_json(json.dumps(body), PhoneJobs(phone_graphs(phone_dir))))
    assert phone["status"] == "failed"
    assert phone["error"]["code"] == "invalid_request"


def test_a_body_the_api_refuses_raises(phone_dir: Path) -> None:
    body = {**LEVICO_CIRCLE, "distance_m": 100}
    with pytest.raises(InvalidRequestError, match="distance must be between"):
        plan_json(json.dumps(body), PhoneJobs(phone_graphs(phone_dir)))


def test_the_jobs_run_at_once_one_after_the_other(phone_dir: Path) -> None:
    jobs = PhoneJobs(phone_graphs(phone_dir))
    first = json.loads(plan_json(json.dumps(LEVICO_CIRCLE), jobs))
    second = json.loads(plan_json(json.dumps(LEVICO_CIRCLE), jobs))
    assert first["job_id"] != second["job_id"]
    assert first["result"] == second["result"]


def test_the_zone_read_as_the_app_opens_is_not_read_again(
    phone_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    reads: list[str] = []
    read = PhoneZones.read

    def counted(self: PhoneZones, path: Path) -> Any:
        reads.append(path.name)
        return read(self, path)

    monkeypatch.setattr(PhoneZones, "read", counted)
    graphs = phone_graphs(phone_dir)
    assert warm(graphs, "running", *LEVICO)
    assert reads == [f"{zone_name('foot', BBOX)}{SUFFIX}"]
    answer = json.loads(plan_json(json.dumps(LEVICO_CIRCLE), PhoneJobs(graphs)))
    assert answer["status"] == "done"
    assert len(reads) == 1


def test_nothing_to_read_ahead(tmp_path: Path, phone_dir: Path) -> None:
    assert not warm(phone_graphs(tmp_path), "running", *LEVICO)
    assert not warm(phone_graphs(phone_dir), "paddling", *LEVICO)
    assert not warm(phone_graphs(phone_dir), "cycling", *LEVICO)
    assert not warm(phone_graphs(phone_dir), "running", 45.4642, 9.19)


def test_the_phone_draws_without_the_archive(phone_dir: Path) -> None:
    """The archive of the drawn routes (TASK-297, ADR-0256) is the server's:
    the phone's jobs have no store, look nothing up nearby, and draw as
    before."""
    graphs = phone_graphs(phone_dir)
    jobs = PhoneJobs(graphs)
    assert jobs._store is None
    request = to_request(RouteRequestBody(**LEVICO_CIRCLE))
    job = Job(job_id="on-the-phone", request=request)
    assert jobs._nearby(job, graphs.for_activity("running"), None) is None
    answer = json.loads(plan_json(json.dumps(LEVICO_CIRCLE), jobs))
    assert answer["status"] == "done" and answer["result"]["points"]
