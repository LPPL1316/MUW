"""RouteJobs: states in order, errors, cancelling, forgetting, two workers,
routes kept."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable, Iterator
from dataclasses import replace

import pytest
from route_engine.models import RouteRequest, RouteResult
from route_engine.network import BBox, Graph
from route_engine.optimizer import GraphLoader, Plan, ShapeNotDrawableError
from route_engine.validation import InvalidRouteError

from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.jobs import RouteJobs
from shaperoute_api.schemas import ErrorDetail

REQUEST = RouteRequest(start=(46.0671, 11.1214), shape="heart", distance_m=5000)
RESULT = RouteResult(
    points=[(46.0671, 11.1214), (46.0680, 11.1220), (46.0671, 11.1214)],
    distance_m=5100.0,
    similarity=0.9,
    shape="heart",
)


def wait_until(check: Callable[[], bool], timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not check():
        assert time.monotonic() < deadline, "the job did not get there in time"
        time.sleep(0.01)


class Gate:
    """A planner that waits for `open()`, then answers or raises."""

    def __init__(self, outcome: RouteResult | Exception = RESULT) -> None:
        self.outcome = outcome
        self.opened = threading.Event()
        self.calls = 0

    def __call__(self, request: RouteRequest, source: GraphLoader) -> Plan:
        self.calls += 1
        source.load((46.0, 11.0, 46.1, 11.1))
        self.opened.wait(5)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return Plan(result=self.outcome, search=None)

    def open(self) -> None:
        self.opened.set()


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class Graphs:
    """A source that loads at once, or waits for `downloaded` if asked to."""

    def __init__(self, needs_download: bool = False) -> None:
        self.download = needs_download
        self.downloaded = threading.Event()

    def needs_download(self, bbox: BBox) -> bool:
        return self.download

    def load(self, bbox: BBox) -> Graph:
        if self.download:
            self.downloaded.wait(5)
        return Graph()


@pytest.fixture
def made() -> Iterator[list[RouteJobs]]:
    """Every RouteJobs made in a test is shut down after it."""
    jobs: list[RouteJobs] = []
    yield jobs
    for each in jobs:
        each.shutdown()


def status(jobs: RouteJobs, job_id: str) -> str | None:
    job = jobs.get(job_id)
    return None if job is None else job.status


def test_queued_computing_done(made: list[RouteJobs]) -> None:
    first, second = Gate(), Gate()
    planners = iter([first, second])
    jobs = RouteJobs(
        Graphs(), lambda r, s: next(planners)(r, s), workers=1, clock=Clock()
    )
    made.append(jobs)
    a = jobs.submit(REQUEST)
    b = jobs.submit(REQUEST)
    assert a.status == "queued"
    wait_until(lambda: status(jobs, a.job_id) == "computing")
    assert status(jobs, b.job_id) == "queued"

    first.open()
    second.open()
    wait_until(lambda: status(jobs, b.job_id) == "done")
    done = jobs.get(a.job_id)
    assert done is not None and done.result == RESULT and done.error is None


def test_a_zone_to_download_shows_downloading_map(made: list[RouteJobs]) -> None:
    graphs = Graphs(needs_download=True)
    gate = Gate()
    jobs = RouteJobs(graphs, gate, clock=Clock())
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, job.job_id) == "downloading_map")
    graphs.downloaded.set()
    wait_until(lambda: status(jobs, job.job_id) == "computing")
    gate.open()
    wait_until(lambda: status(jobs, job.job_id) == "done")


@pytest.mark.parametrize(
    ("exc", "code", "message"),
    [
        (ShapeNotDrawableError("no heart here"), "shape_not_drawable", "no heart here"),
        (MapDataUnavailableError("no Overpass"), "map_data_unavailable", "no Overpass"),
        (
            InvalidRouteError("not closed"),
            "engine_error",
            "The route engine failed; see the API log.",
        ),
    ],
)
def test_errors_end_in_failed(
    made: list[RouteJobs], exc: Exception, code: str, message: str
) -> None:
    gate = Gate(exc)
    gate.open()
    jobs = RouteJobs(Graphs(), gate, clock=Clock())
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, job.job_id) == "failed")
    failed = jobs.get(job.job_id)
    assert failed is not None and failed.error == ErrorDetail(
        code=code, message=message
    )
    assert failed.result is None


def test_a_cancelled_queued_job_never_starts(made: list[RouteJobs]) -> None:
    first, second = Gate(), Gate()
    planners = iter([first, second])
    jobs = RouteJobs(
        Graphs(), lambda r, s: next(planners)(r, s), workers=1, clock=Clock()
    )
    made.append(jobs)
    a = jobs.submit(REQUEST)
    b = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, a.job_id) == "computing")
    assert jobs.cancel(b.job_id)
    first.open()
    wait_until(lambda: status(jobs, a.job_id) == "done")
    jobs.shutdown()
    assert second.calls == 0
    assert jobs.get(b.job_id) is None


def test_a_cancelled_running_job_drops_its_result(made: list[RouteJobs]) -> None:
    gate = Gate()
    jobs = RouteJobs(Graphs(), gate, clock=Clock())
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, job.job_id) == "computing")
    assert jobs.cancel(job.job_id)
    assert not jobs.cancel(job.job_id)
    gate.open()
    time.sleep(0.1)
    assert jobs.get(job.job_id) is None


def test_finished_jobs_are_forgotten_after_ten_minutes(made: list[RouteJobs]) -> None:
    clock = Clock()
    gate = Gate()
    gate.open()
    jobs = RouteJobs(Graphs(), gate, clock=clock)
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, job.job_id) == "done")
    clock.now += 600
    assert jobs.get(job.job_id) is not None
    clock.now += 1
    assert jobs.get(job.job_id) is None


def test_a_long_job_does_not_hold_up_a_short_one(made: list[RouteJobs]) -> None:
    long, short = Gate(), Gate()
    short.open()
    planners = iter([long, short])
    jobs = RouteJobs(Graphs(), lambda r, s: next(planners)(r, s), clock=Clock())
    made.append(jobs)
    slow = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, slow.job_id) == "computing")
    quick = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, quick.job_id) == "done")
    assert status(jobs, slow.job_id) == "computing"
    long.open()


def test_a_job_cancelled_while_downloading_never_computes(
    made: list[RouteJobs],
) -> None:
    graphs = Graphs(needs_download=True)
    computed: list[bool] = []

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        source.load((46.0, 11.0, 46.1, 11.1))
        computed.append(True)
        return Plan(result=RESULT, search=None)

    jobs = RouteJobs(graphs, planner, clock=Clock())
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: status(jobs, job.job_id) == "downloading_map")
    assert jobs.cancel(job.job_id)
    graphs.downloaded.set()
    jobs.shutdown()
    time.sleep(0.2)
    assert computed == []


class Kept:
    """A store that keeps every route by the shape asked."""

    def __init__(self) -> None:
        self.routes: dict[str | None, RouteResult] = {}

    def get(self, request: object) -> RouteResult | None:
        assert isinstance(request, RouteRequest)
        return self.routes.get(request.shape)

    def put(self, request: object, result: RouteResult) -> bool:
        assert isinstance(request, RouteRequest)
        self.routes[request.shape] = result
        return True


def test_a_route_already_drawn_is_done_at_once(made: list[RouteJobs]) -> None:
    gate = Gate()
    ends: list[tuple[str, RouteResult | None, float]] = []
    kept = Kept()
    jobs = RouteJobs(
        Graphs(),
        gate,
        clock=Clock(),
        on_end=lambda job, result, error, s: ends.append((job.job_id, result, s)),
        store=kept,
    )
    made.append(jobs)
    first = jobs.submit(REQUEST)
    assert first.status == "queued"
    gate.open()
    wait_until(lambda: status(jobs, first.job_id) == "done")
    wait_until(lambda: len(ends) == 1)
    assert kept.routes == {"heart": RESULT}

    # The same request again: no worker, no engine, the answer in the POST.
    again = jobs.submit(REQUEST)
    assert again.status == "done" and again.result == RESULT
    assert again.job_id != first.job_id
    assert gate.calls == 1
    assert ends[1] == (again.job_id, RESULT, 0.0)
    # Read and cancelled as any other job.
    read = jobs.get(again.job_id)
    assert read is not None and read.result == RESULT
    assert jobs.cancel(again.job_id) is True


def test_a_failed_route_is_not_kept(made: list[RouteJobs]) -> None:
    gate = Gate(ShapeNotDrawableError("no heart here"))
    kept = Kept()
    jobs = RouteJobs(Graphs(), gate, clock=Clock(), store=kept)
    made.append(jobs)
    job = jobs.submit(REQUEST)
    gate.open()
    wait_until(lambda: status(jobs, job.job_id) == "failed")
    assert kept.routes == {}


def test_a_route_cancelled_while_drawn_is_kept_for_the_next(
    made: list[RouteJobs],
) -> None:
    gate = Gate()
    kept = Kept()
    jobs = RouteJobs(Graphs(), gate, clock=Clock(), store=kept)
    made.append(jobs)
    job = jobs.submit(REQUEST)
    wait_until(lambda: gate.calls == 1)
    assert jobs.cancel(job.job_id) is True
    gate.open()
    wait_until(lambda: kept.routes == {"heart": RESULT})
    assert jobs.submit(REQUEST).status == "done"


class Archive(Kept):
    """A store that also answers from a route kept a few metres away
    (jobs.FindsNearby, ADR-0256): here, from any start but the request's."""

    def __init__(self) -> None:
        super().__init__()
        self.asked: list[RouteRequest] = []

    def nearby(
        self, request: object, source: GraphLoader, named_roads: object = None
    ) -> RouteResult | None:
        assert isinstance(request, RouteRequest)
        self.asked.append(request)
        source.load((46.0, 11.0, 46.1, 11.1))
        return None if request.start == REQUEST.start else RESULT


def test_a_route_kept_nearby_is_reached_without_the_engine(
    made: list[RouteJobs],
) -> None:
    gate = Gate()
    kept = Archive()
    jobs = RouteJobs(Graphs(), gate, clock=Clock(), store=kept)
    made.append(jobs)
    nearby = replace(REQUEST, start=(46.0675, 11.1214))
    job = jobs.submit(nearby)
    assert job.status == "queued"  # the roads are needed: not in the POST
    wait_until(lambda: status(jobs, job.job_id) == "done")
    done = jobs.get(job.job_id)
    assert done is not None and done.result == RESULT
    # The engine did not run, and the route is not kept again.
    assert gate.calls == 0 and kept.asked == [nearby] and kept.routes == {}

    # From the request's own start the archive has nothing: the engine
    # draws, and the route is kept.
    job = jobs.submit(REQUEST)
    gate.open()
    wait_until(lambda: status(jobs, job.job_id) == "done")
    assert gate.calls == 1 and kept.routes == {"heart": RESULT}
