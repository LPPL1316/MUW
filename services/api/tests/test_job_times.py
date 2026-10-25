"""The line of a route job's times (TASK-289): each phase in the log, from a
clock the test moves, and no position."""

from __future__ import annotations

import logging
import math
import threading
import time
from collections.abc import Callable, Iterator
from types import SimpleNamespace
from typing import cast

import pytest
from route_engine.models import RouteRequest, RouteResult
from route_engine.nearby_starts import NearbyPlan, Tried
from route_engine.network import BBox, Graph
from route_engine.optimizer import GraphLoader, Plan, Search, ShapeNotDrawableError

from shaperoute_api import images
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.job_times import JobTimes, line, noted
from shaperoute_api.jobs import RouteJobs

START = (46.0671, 11.1214)
REQUEST = RouteRequest(start=START, shape="heart", distance_m=5000)
RESULT = RouteResult(
    points=[START, (46.0680, 11.1220), START],
    distance_m=5100.0,
    similarity=0.9,
    shape="heart",
)
BBOX = (46.0, 11.0, 46.1, 11.1)


def searched(traces: int, converged: bool = True) -> Search:
    """A search of `traces` traces: the times read no more of it."""
    return cast(Search, SimpleNamespace(attempts=[None] * traces, converged=converged))


class Clock:
    """The jobs' clock, moved by the test's graphs and planners only."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class Graphs:
    """Loads in `seconds` of the clock; a download when asked to, one that
    fails when `fails`."""

    def __init__(
        self, clock: Clock, seconds: float, download: bool = False, fails: bool = False
    ):
        self.clock, self.seconds, self.download = clock, seconds, download
        self.fails = fails

    def needs_download(self, bbox: BBox) -> bool:
        return self.download

    def load(self, bbox: BBox) -> Graph:
        self.clock.now += self.seconds
        if self.fails:
            raise MapDataUnavailableError("Overpass did not answer")
        return Graph()


def nearby_planner(
    clock: Clock, start_plan: Plan | None, after_s: float
) -> Callable[[RouteRequest, GraphLoader], Plan]:
    """A planner as images.plan_request: crops the start's graph, then
    plans for `after_s` from the start and two nearby ones, one of them
    still running when the time was up."""

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        source.load(BBOX)
        clock.now += after_s
        tried = [
            Tried(START, 0.0, start_plan, 0.9, 1.5),
            Tried(START, 60.0, None, None, 1.25, "the search moved this start"),
            Tried(START, 55.0, None, None, math.nan, "still running 8 s in"),
        ]
        nearby = NearbyPlan(Plan(RESULT, None), 0, tried)
        return noted(source, nearby)

    return planner


@pytest.fixture
def made() -> Iterator[list[RouteJobs]]:
    jobs: list[RouteJobs] = []
    yield jobs
    for each in jobs:
        each.shutdown()


def wait_until(check: Callable[[], bool], timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not check():
        assert time.monotonic() < deadline, "the job did not get there in time"
        time.sleep(0.01)


def run(
    made: list[RouteJobs],
    caplog: pytest.LogCaptureFixture,
    graphs: Graphs,
    planner: Callable[[RouteRequest, GraphLoader], Plan],
) -> tuple[str, str]:
    """The job's line of times, without its id; and the whole log."""
    jobs = RouteJobs(graphs, planner, workers=1, clock=graphs.clock)
    made.append(jobs)
    with caplog.at_level(logging.INFO, logger="shaperoute_api.jobs"):
        job = jobs.submit(REQUEST)
        wait_until(lambda: "times" in caplog.text)
    [times] = [
        r.getMessage() for r in caplog.records if r.getMessage().count(" times ")
    ]
    prefix = f"job {job.job_id}: times "
    assert times.startswith(prefix)
    return times[len(prefix) :], caplog.text


def test_a_route_logs_each_phase_on_one_line(
    made: list[RouteJobs], caplog: pytest.LogCaptureFixture
) -> None:
    clock = Clock()
    planner = nearby_planner(clock, Plan(RESULT, searched(24)), 3.0)
    times, everything = run(made, caplog, Graphs(clock, 0.25), planner)
    # The planner took 3.25 s: 0.25 s the crop, 1.5 s the start's own plan,
    # the remaining 1.5 s the nearby starts.
    assert times == (
        "total=3.25 crop=0.25 loads=1 download=0.00 start=1.50 traces=24 "
        "converged=yes far=no wait=1.50 nearby=1.25,- chosen=0 directions=0.00"
    )
    # Where the user is stays out of the log (TASK-091).
    assert "46.06" not in everything and "11.12" not in everything


def test_a_failed_route_logs_what_it_knows(
    made: list[RouteJobs], caplog: pytest.LogCaptureFixture
) -> None:
    clock = Clock()

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        source.load(BBOX)
        clock.now += 2.0
        raise ShapeNotDrawableError("a 5 km heart cannot be drawn here")

    times, _ = run(made, caplog, Graphs(clock, 0.5), planner)
    assert times == (
        "total=2.50 crop=0.50 loads=1 download=0.00 start=- traces=- "
        "converged=- far=- wait=- nearby=- chosen=- directions=-"
    )


def test_a_download_counts_apart_from_the_crops(
    made: list[RouteJobs], caplog: pytest.LogCaptureFixture
) -> None:
    clock = Clock()
    planner = nearby_planner(clock, Plan(RESULT, searched(24)), 3.0)
    times, _ = run(made, caplog, Graphs(clock, 40.0, download=True), planner)
    assert times.startswith("total=43.00 crop=0.00 loads=1 download=40.00 ")
    assert " wait=1.50 " in times


def test_a_download_that_fails_counts_its_seconds(
    made: list[RouteJobs], caplog: pytest.LogCaptureFixture
) -> None:
    clock = Clock()
    graphs = Graphs(clock, 39.0, download=True, fails=True)
    planner = nearby_planner(clock, Plan(RESULT, searched(24)), 3.0)
    times, _ = run(made, caplog, graphs, planner)
    assert times.startswith("total=39.00 crop=0.00 loads=1 download=39.00 start=- ")


def test_the_traces_farther_away_count_too() -> None:
    near, far = searched(24, converged=False), searched(12, converged=False)
    kept_far = Plan(RESULT, far, far=far)  # the farther route was kept
    looked_far = Plan(RESULT, near, far=far)  # the near one was
    for plan, traces in ((kept_far, 12), (looked_far, 36)):
        times = JobTimes(nearby=NearbyPlan(plan, 0, [Tried(START, 0, plan, 0.8, 4)]))
        assert f" traces={traces} converged=no far=yes " in line(times, 5.0)


def test_no_nearby_start_and_a_start_that_did_not_draw() -> None:
    alone = NearbyPlan(Plan(RESULT, None), 0, [Tried(START, 0, None, None, 2.0)])
    times = JobTimes(planner_s=2.0, nearby=alone)
    assert line(times, 2.0) == (
        "total=2.00 crop=0.00 loads=0 download=0.00 start=2.00 traces=- "
        "converged=- far=- wait=0.00 nearby=none chosen=0 directions=-"
    )


class Noting:
    """A job's source that keeps what it is told, as jobs._Reporting."""

    def __init__(self) -> None:
        self.nearby: list[NearbyPlan] = []

    def note_nearby(self, nearby: NearbyPlan) -> None:
        self.nearby.append(nearby)

    def load(self, bbox: BBox) -> Graph:
        return Graph()


def test_the_api_planner_tells_the_job_how_the_nearby_starts_went(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    planned = NearbyPlan(Plan(RESULT, None), 0, [])
    monkeypatch.setattr(images, "plan_nearby", lambda job, start, source: planned)
    source = Noting()
    assert images.plan_request(REQUEST, source) is planned.plan
    assert source.nearby == [planned]


def test_two_jobs_at_once_keep_their_own_times(
    made: list[RouteJobs], caplog: pytest.LogCaptureFixture
) -> None:
    """Two workers (ADR-0032): each job's line has its own planner's
    numbers, not the other's."""
    both = threading.Barrier(2)
    clock = Clock()

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        traces = request.distance_m // 1000
        both.wait(5)  # both jobs are planning
        start = Plan(RESULT, searched(traces))
        nearby = NearbyPlan(start, 0, [Tried(START, 0.0, start, 0.9, 1.0)])
        return noted(source, nearby)

    jobs = RouteJobs(Graphs(clock, 0.0), planner, workers=2, clock=clock)
    made.append(jobs)
    with caplog.at_level(logging.INFO, logger="shaperoute_api.jobs"):
        five = jobs.submit(REQUEST)
        ten = jobs.submit(RouteRequest(start=START, shape="heart", distance_m=10000))
        wait_until(lambda: caplog.text.count(" times ") == 2)
    lines = {r.getMessage() for r in caplog.records}
    assert any(f"job {five.job_id}: times " in m and " traces=5 " in m for m in lines)
    assert any(f"job {ten.job_id}: times " in m and " traces=10 " in m for m in lines)
