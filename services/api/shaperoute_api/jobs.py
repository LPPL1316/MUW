"""Route jobs: the request is answered at once, the route is computed in the
background and asked for until it is ready (ADR-0032).

A 15 km route or a zone to download takes longer than a phone waits for one
HTTP answer (TASK-023). Jobs live in memory, in this process: restarting the
API loses them, which is fine while it runs on the development PC.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from typing import Any, Protocol, runtime_checkable

from route_engine.directions import guidance
from route_engine.models import WATER_ACTIVITIES, RouteResult
from route_engine.nearby_starts import NearbyPlan
from route_engine.network import BBox, Graph
from route_engine.optimizer import GraphLoader, Plan
from route_engine.sidewalks import NamedRoad
from route_engine.water import Element, WaterSource

from shaperoute_api.activity_graphs import Graphs, Ground, source_for, water_for
from shaperoute_api.alongs import NamedRoads, with_alongs
from shaperoute_api.errors import error_of
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.images import AnyRequest
from shaperoute_api.job_times import JobTimes, line
from shaperoute_api.schemas import ErrorDetail, JobStatus

log = logging.getLogger(__name__)

# A shape, a word, or an image's outline (TASK-073), on the roads or on the
# water (TASK-191).
Planner = Callable[[AnyRequest, Ground], Plan]

# Two, not one: a cancelled 15 km keeps its thread until the engine ends,
# and the next request must not wait behind it.
WORKERS = 2
# A finished job is kept this long for the app to collect, then forgotten.
KEEP_S = 600.0


@runtime_checkable
class KnowsDownloads(Protocol):
    """A graph or water source that can tell a download in advance
    (ZoneGraphs, paddling.ServerWater)."""

    def needs_download(self, bbox: BBox) -> bool: ...


@runtime_checkable
class KnowsNames(Protocol):
    """A graph source with the names of the roads its graphs leave out, for
    the `along` of the directions (ZoneGraphs, ADR-0057)."""

    def named_roads(self, bbox: BBox) -> list[NamedRoad]: ...


class KeepsRoutes(Protocol):
    """Routes already drawn for the same request (route_store.RouteStore)."""

    def get(self, request: object) -> RouteResult | None: ...
    def put(self, request: object, result: RouteResult) -> bool: ...


@runtime_checkable
class FindsNearby(Protocol):
    """A store that also answers a request from a route kept a few metres
    away, reached along the roads (route_archive.RouteArchive, ADR-0256).
    It loads the zone, which takes seconds: asked in the job's thread, not
    in `submit`."""

    def nearby(
        self, request: object, source: GraphLoader, named_roads: NamedRoads | None
    ) -> RouteResult | None: ...


@runtime_checkable
class KeepsPlacements(Protocol):
    """A store that also keeps where the engine placed each route of the
    plan the result comes from, to draw it again from there once the
    engine has changed (route_archive.RouteArchive, TASK-297 A2)."""

    def put_plan(self, request: object, result: RouteResult, plan: Plan) -> bool: ...


class _Dropped(Exception):
    """The job was cancelled while its graph was loading: stop before the
    engine starts computing."""


@dataclass
class Job:
    job_id: str
    request: AnyRequest
    status: JobStatus = "queued"
    result: RouteResult | None = None
    error: ErrorDetail | None = None
    finished_at: float | None = None
    # The request as it arrived, for the request log (TASK-090).
    body: dict[str, Any] | None = None


# Told how a job ended, cancelled ones too (neither result nor error when
# it was dropped before computing), with its seconds: the request log.
JobEnd = Callable[[Job, RouteResult | None, ErrorDetail | None, float], None]


class RouteJobs:
    def __init__(
        self,
        source: Graphs,
        planner: Planner,
        workers: int = WORKERS,
        keep_s: float = KEEP_S,
        clock: Callable[[], float] = time.monotonic,
        on_end: JobEnd | None = None,
        store: KeepsRoutes | None = None,
    ) -> None:
        self._source = source
        self._planner = planner
        self._on_end = on_end
        self._store = store
        self._keep_s = keep_s
        self._clock = clock
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(workers, thread_name_prefix="route-job")

    def submit(self, request: AnyRequest, body: dict[str, Any] | None = None) -> Job:
        job = Job(job_id=uuid.uuid4().hex[:12], request=request, body=body)
        # A city's example someone already asked for (ADR-0136): done at
        # once, no worker and no engine. The app reads it from this answer.
        kept = None if self._store is None else self._store.get(request)
        if kept is not None:
            job.status, job.result, job.finished_at = "done", kept, self._clock()
        with self._lock:
            self._forget_old()
            self._jobs[job.job_id] = job
            snapshot = replace(job)
        what = f"{request.name} {request.distance_m} m"
        if kept is not None:
            log.info("job %s: %s already drawn", job.job_id, what)
            self._tell(job, kept, None, 0.0)
            return snapshot
        log.info("job %s: %s queued", job.job_id, what)
        self._pool.submit(self._run, job)
        return snapshot

    def get(self, job_id: str) -> Job | None:
        """A copy of the job, or None if unknown, cancelled or forgotten."""
        with self._lock:
            self._forget_old()
            job = self._jobs.get(job_id)
            return None if job is None else replace(job)

    def cancel(self, job_id: str) -> bool:
        """Forgets the job. A queued one never starts; a running one ends in
        its thread, and its result is dropped."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if job is not None:
            log.info("job %s: cancelled while %s", job_id, job.status)
        return job is not None

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _run(self, job: Job) -> None:
        if not self._set(job, status="computing"):
            return
        started = self._clock()
        activity = job.request.activity
        times = JobTimes()

        def report(status: JobStatus) -> bool:
            return self._set(job, status)

        def wanted() -> bool:
            return self._wanted(job)

        # Answered from a route kept nearby (ADR-0256): not kept again.
        from_archive = False
        plan: Plan | None = None  # on the roads, where its routes were placed
        try:
            if activity in WATER_ACTIVITIES:
                # On the water (TASK-191): no graph, so no directions.
                water = _ReportingWater(
                    water_for(self._source, activity),
                    report,
                    wanted,
                    times,
                    self._clock,
                )
                result = with_choices(self._plan(job, water, times), [])
            else:
                # The zones of the network of the request's activity (TASK-190).
                graphs = source_for(self._source, activity)
                source = _Reporting(graphs, report, wanted, times, self._clock)
                names = graphs if isinstance(graphs, KnowsNames) else None
                named = None if names is None else names.named_roads
                # A route kept within a few metres of the start, reached
                # along the roads (ADR-0256): the zone is loaded, the
                # engine does not run.
                kept = self._nearby(job, source, named)
                if kept is not None:
                    result, from_archive = kept, True
                else:
                    # The graphs the archive loaded are not the plan's: the
                    # directions are read on the plan's first (with_choices).
                    source.graphs.clear()
                    plan = self._plan(job, source, times)
                    began = self._clock()
                    result = with_choices(plan, source.graphs, named)
                    times.directions_s = self._clock() - began
        except _Dropped:
            log.info("job %s: dropped before computing", job.job_id)
            self._log_times(job, times, self._clock() - started)
            self._tell(job, None, None, self._clock() - started)
            return
        except Exception as exc:
            _, error = error_of(exc, activity)
            if error.code == "engine_error":
                log.exception("job %s: the engine failed", job.job_id, exc_info=exc)
            self._set(job, status="failed", error=error)
            log.info(
                "job %s: %s after %.1f s",
                job.job_id,
                error.code,
                self._clock() - started,
            )
            self._log_times(job, times, self._clock() - started)
            self._tell(job, None, error, self._clock() - started)
            return
        self._set(job, status="done", result=result)
        log.info(
            "job %s: %.0f m on roads, similarity %.2f, in %.1f s",
            job.job_id,
            result.distance_m,
            result.similarity,
            self._clock() - started,
        )
        self._log_times(job, times, self._clock() - started)
        # Also when cancelled meanwhile: the next to ask does not wait.
        if not from_archive and self._keep(job.request, result, plan):
            log.info("job %s: kept for the next to ask", job.job_id)
        self._tell(job, result, None, self._clock() - started)

    def _keep(
        self, request: AnyRequest, result: RouteResult, plan: Plan | None
    ) -> bool:
        """`result` kept for the next to ask, with the plan it comes from
        when the store keeps where its routes were placed."""
        if self._store is None:
            return False
        if plan is not None and isinstance(self._store, KeepsPlacements):
            return self._store.put_plan(request, result, plan)
        return self._store.put(request, result)

    def _nearby(
        self, job: Job, source: GraphLoader, named_roads: NamedRoads | None
    ) -> RouteResult | None:
        """The route the store keeps a few metres from the start, reached
        along the roads (FindsNearby); None when the store has none, or is
        not one that looks nearby. A store that fails leaves the job to the
        engine: its failure is logged, the job goes on."""
        if not isinstance(self._store, FindsNearby):
            return None
        try:
            found = self._store.nearby(job.request, source, named_roads)
        except _Dropped:
            raise
        except MapDataUnavailableError:
            return None  # the engine says so, as for any request
        except Exception:
            log.exception("job %s: the archive failed; drawn instead", job.job_id)
            return None
        if found is not None:
            log.info("job %s: kept route reached along the roads", job.job_id)
        return found

    def _plan(self, job: Job, ground: Ground, times: JobTimes) -> Plan:
        """The planner's plan, its seconds kept also when it fails."""
        began = self._clock()
        try:
            return self._planner(job.request, ground)
        finally:
            times.planner_s = self._clock() - began

    def _log_times(self, job: Job, times: JobTimes, elapsed_s: float) -> None:
        """One line with the job's phases (TASK-289, job_times)."""
        log.info("job %s: times %s", job.job_id, line(times, elapsed_s))

    def _tell(
        self,
        job: Job,
        result: RouteResult | None,
        error: ErrorDetail | None,
        elapsed_s: float,
    ) -> None:
        """After the job has its answer, so the app does not wait for it;
        whatever the listener does, the job stays as it ended."""
        if self._on_end is None:
            return
        try:
            self._on_end(job, result, error, elapsed_s)
        except Exception:
            log.exception("job %s: the listener of its end failed", job.job_id)

    def _set(
        self,
        job: Job,
        status: JobStatus,
        result: RouteResult | None = None,
        error: ErrorDetail | None = None,
    ) -> bool:
        """Updates the job; False if it was cancelled in the meantime."""
        with self._lock:
            if job.job_id not in self._jobs:
                return False
            job.status, job.result, job.error = status, result, error
            if status in ("done", "failed"):
                job.finished_at = self._clock()
            return True

    def _wanted(self, job: Job) -> bool:
        with self._lock:
            return job.job_id in self._jobs

    def _forget_old(self) -> None:
        now = self._clock()
        for job_id in [
            job.job_id
            for job in self._jobs.values()
            if job.finished_at is not None and now - job.finished_at > self._keep_s
        ]:
            del self._jobs[job_id]


class _Reporting:
    """The job's graph source: says when a download starts and ends, and
    stops the job if it was cancelled meanwhile. The engine loads its graph
    before computing, so a cancelled job spares the computing; when the
    shape does not fit near the start it loads a larger one and computes
    again (ADR-0040), and a download then shows between two computings.
    It also keeps the job's times: each load's, and how the nearby starts
    went (job_times.NotesNearby)."""

    def __init__(
        self,
        source: GraphLoader,
        report: Callable[[JobStatus], object],
        wanted: Callable[[], bool],
        times: JobTimes | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._source = source
        self._report = report
        self._wanted = wanted
        self._times = JobTimes() if times is None else times
        self._clock = clock
        self.graphs: list[Graph] = []  # as loaded, for the directions

    def note_nearby(self, nearby: NearbyPlan) -> None:
        self._times.nearby = nearby

    def load(self, bbox: BBox) -> Graph:
        downloading = isinstance(self._source, KnowsDownloads) and (
            self._source.needs_download(bbox)
        )
        if downloading:
            self._report("downloading_map")
        began = self._clock()
        try:
            graph = self._source.load(bbox)
        finally:  # a download that fails took its time too
            self._times.loaded(self._clock() - began, downloading)
        if not self._wanted():
            raise _Dropped
        if downloading:
            self._report("computing")
        self.graphs.append(graph)
        return graph


class _ReportingWater:
    """The job's water (TASK-191), as _Reporting for the graphs: says when a
    download starts and ends, and stops the job if it was cancelled
    meanwhile. The engine reads the water once, before placing the shape;
    the job's times count the reading as a load."""

    def __init__(
        self,
        source: WaterSource,
        report: Callable[[JobStatus], object],
        wanted: Callable[[], bool],
        times: JobTimes | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._source = source
        self._report = report
        self._wanted = wanted
        self._times = JobTimes() if times is None else times
        self._clock = clock

    def elements(self, bbox: BBox) -> list[Element]:
        downloading = isinstance(self._source, KnowsDownloads) and (
            self._source.needs_download(bbox)
        )
        if downloading:
            self._report("downloading_map")
        began = self._clock()
        try:
            elements = self._source.elements(bbox)
        finally:
            self._times.loaded(self._clock() - began, downloading)
        if not self._wanted():
            raise _Dropped
        if downloading:
            self._report("computing")
        return elements


def with_choices(
    plan: Plan, graphs: list[Graph], named_roads: NamedRoads | None = None
) -> RouteResult:
    """The plan's result with its directions, and its alternatives, each
    with its own directions (TASK-093): the app may choose any of them."""
    result = with_directions(plan, graphs, named_roads)
    others = [
        with_directions(other, graphs, named_roads) for other in plan.alternatives
    ]
    return replace(result, alternatives=others)


def with_directions(
    plan: Plan, graphs: list[Graph], named_roads: NamedRoads | None = None
) -> RouteResult:
    """The plan's result with its directions (TASK-048), computed on the
    graph the route was traced on: the last one loaded when the route comes
    from the search farther away (ADR-0040), else the first. A route that
    was not searched has no nodes, and no directions. Unnamed roads get the
    street they run along (`along`, ADR-0057), also from `named_roads`."""
    if plan.search is None or not graphs:
        return plan.result
    graph = (
        graphs[-1] if plan.far is not None and plan.search is plan.far else graphs[0]
    )
    nodes = plan.search.best.route.nodes
    directions = with_alongs(graph, nodes, guidance(graph, nodes), named_roads)
    return replace(plan.result, directions=directions)
