"""The API's route job, run on the phone (TASK-214, ADR-0177).

The app sends the body of POST /route-jobs and gets back the body of
GET /route-jobs/{job_id}: the same request, the same code (RouteJobs,
with_choices, RouteResultBody), on the zones the phone has downloaded
(phone_zones.py). No FastAPI, no threads, no processes: it runs in Pyodide,
inside the app's WebView, one call at a time. The nearby starts are planned
one after the other, all of them: the server drops those still running at its
deadline.

On the phone go the shapes and the words on roads. A photo, the water, or a
zone the phone does not have: the job fails, and the app asks the server.
So does the way back to a route (TASK-314, ADR-0274): the body of POST
/way-back in, its answer out (`way_back_json`).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from route_engine.errors import ShapeNotDrawableError
from route_engine.models import InvalidRequestError, RouteRequest
from route_engine.nearby_starts import ShapeJob, plan_nearby
from route_engine.network import NETWORKS, area_around
from route_engine.optimizer import GraphLoader, Plan

from shaperoute_api.activity_graphs import ROAD_ACTIVITIES, ActivityGraphs, Ground
from shaperoute_api.errors import error_of
from shaperoute_api.graphs import MapDataUnavailableError, ZoneGraphs
from shaperoute_api.images import (
    AnyRequest,
    placement_of,
    plan_anchored,
    route_request_of,
    with_placed,
)
from shaperoute_api.jobs import RouteJobs
from shaperoute_api.phone_zones import PhoneZones
from shaperoute_api.schemas import (
    ErrorBody,
    RouteJobBody,
    RouteRequestBody,
    RouteResultBody,
)
from shaperoute_api.stroke_matches import (
    StrokeMatchBody,
    StrokeMatchRequestBody,
    match_stroke,
)
from shaperoute_api.way_back import WayBackBody, WayBackRequestBody, find_way_back

# One zone of each network in memory: the phone has less of it than the
# server (docs/tasks/TASK-214.md, choice 3).
ZONES_IN_MEMORY = 1
ON_THE_SERVER = "only the server draws this route"
# What `warm` reads ahead: the zone a route of 3-5 km from the phone is
# drawn on, whose crop reaches 1.4-2.8 km around its start (part E).
WARM_MARGIN_M = 2000.0


def to_request(body: RouteRequestBody) -> RouteRequest:
    """app.to_request for a shape or a word, without importing FastAPI;
    test_on_phone checks the two give the same request. An anchored one
    (TASK-347) is an AnchoredRouteRequest, as on the server."""
    return route_request_of(body)


def plan_on_phone(request: AnyRequest, source: Ground) -> Plan:
    """images.plan_request for a shape or a word on roads, with the nearby
    starts in this process; an anchored one traced once where it was drawn,
    as on the server (TASK-347)."""
    if not isinstance(request, RouteRequest):
        raise InvalidRequestError(ON_THE_SERVER)
    roads: GraphLoader = source  # type: ignore[assignment]  # water refused before
    if placement_of(request) == "anchored":
        return plan_anchored(request, roads)
    job = ShapeJob.of_request(request)
    return plan_nearby(job, request.start, roads, processes=False).plan


def phone_graphs(directory: Path) -> ActivityGraphs:
    """The zones of each network on the phone, in `directory`; no water."""
    graphs: dict[str, GraphLoader] = {}
    for activity in ROAD_ACTIVITIES:
        zones = PhoneZones(directory, NETWORKS[activity])
        graphs[activity] = ZoneGraphs(zones, max_zones=ZONES_IN_MEMORY, read=zones.read)
    return ActivityGraphs(graphs)


def warm(graphs: ActivityGraphs, activity: str, lat: float, lon: float) -> bool:
    """Reads into memory the zone a route of `activity` from (lat, lon) will
    be drawn on, as the app opens, so the first route does not wait for it
    (part E): 0.8 s and 57 MB for Trento's 2.7 MB in Pyodide on the Mac,
    more for a wider zone. False when no zone on the phone holds the area."""
    if activity not in ROAD_ACTIVITIES:
        return False
    try:
        graphs.for_activity(activity).load(area_around([(lat, lon)], WARM_MARGIN_M))
    except MapDataUnavailableError:
        return False
    return True


class _Here:
    """An executor that runs the job at once, in the caller."""

    def submit(self, fn: Any, *args: Any) -> None:
        fn(*args)

    def shutdown(self, wait: bool = True, cancel_futures: bool = False) -> None:
        pass


class PhoneJobs(RouteJobs):
    """RouteJobs whose jobs run in submit, one after the other."""

    def __init__(self, graphs: ActivityGraphs) -> None:
        super().__init__(graphs, plan_on_phone, workers=1)
        self._pool.shutdown()
        self._pool = _Here()  # type: ignore[assignment]


def plan_json(body_json: str, jobs: PhoneJobs) -> str:
    """The JSON of GET /route-jobs/{job_id} for the JSON of POST /route-jobs.
    A body the API would refuse raises, as the API answers 422."""
    request = to_request(RouteRequestBody.model_validate_json(body_json))
    submitted = jobs.submit(request)
    job = jobs.get(submitted.job_id)
    assert job is not None and job.status in ("done", "failed")
    result = None
    if job.result is not None:
        result = with_placed(RouteResultBody.from_result(job.result), job.placed)
    return RouteJobBody(
        job_id=job.job_id, status=job.status, result=result, error=job.error
    ).model_dump_json()


def way_back_json(body_json: str, graphs: ActivityGraphs) -> str:
    """The JSON POST /way-back answers for its JSON, on the phone's zones:
    the way, or the error the API would give. With no zone here, that is
    map_data_unavailable, and the app asks the server; with no way back,
    invalid_request, which the server would answer too. A body the API
    would refuse raises, as the API answers 422."""
    body = WayBackRequestBody.model_validate_json(body_json)
    try:
        way = find_way_back(graphs, body)
    except (InvalidRequestError, MapDataUnavailableError) as exc:
        _, detail = error_of(exc)
        return ErrorBody(error=detail).model_dump_json()
    return WayBackBody.of(way).model_dump_json()


def match_json(body_json: str, graphs: ActivityGraphs) -> str:
    """The JSON POST /stroke-matches answers for its JSON, on the phone's
    zones (TASK-347, part B calls it): the match, or the error the API would
    give. With no zone here, map_data_unavailable, and the app asks the
    server; a stroke on a single road node, shape_not_drawable, as the
    server would say. A body the API would refuse raises, as the API
    answers 422."""
    body = StrokeMatchRequestBody.model_validate_json(body_json)
    try:
        found = match_stroke(body, graphs.for_activity(body.activity))
    except (InvalidRequestError, ShapeNotDrawableError, MapDataUnavailableError) as exc:
        _, detail = error_of(exc)
        return ErrorBody(error=detail).model_dump_json()
    return StrokeMatchBody.of(found).model_dump_json()
