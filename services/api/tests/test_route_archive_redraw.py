"""A route of before drawn again from where it was placed (TASK-297 part
A2, ADR-0256): each row keeps the placement of the search near the start;
after the engine changes, or 30 days later, the best good row within 100 m
is drawn again from its own start, the search trying that placement first,
kept, and reached from the user's start as any row nearby. In a real
PostgreSQL (skipped without one, as test_route_archive), on a street grid
where a 5 km heart is good at once; the API's planner without processes."""

from __future__ import annotations

import time
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import networkx as nx
import pytest
from fastapi.testclient import TestClient
from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import RouteRequest, RouteResult
from route_engine.nearby_starts import NearbyPlan, ShapeJob, plan_nearby
from route_engine.network import BBox, Graph
from route_engine.optimizer import GraphLoader, Plan, Search, ShapeNotDrawableError

from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.jobs import RouteJobs, with_choices
from shaperoute_api.route_archive import RouteArchive, placed_by

TRENTO = (46.0671, 11.1214)
HEART = RouteRequest(start=TRENTO, shape="heart", distance_m=5000)
HEART_BODY = {"start": list(TRENTO), "shape": "heart", "distance_m": 5000}
NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


def _grid(origin: LatLon, spacing_m: float = 60.0, half_m: float = 2500.0) -> Graph:
    """Streets every `spacing_m` around `origin`, both ways: any heart is
    good on it at once. Whole numbers name the nodes, as OpenStreetMap's."""
    graph = nx.MultiDiGraph()
    n = int(half_m / spacing_m)

    def node(i: int, j: int) -> int:
        return (i + n) * (2 * n + 1) + (j + n)

    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            lat, lon = local_to_latlon(origin, i * spacing_m, j * spacing_m)
            graph.add_node(node(i, j), y=lat, x=lon)
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            for a, b in ((i + 1, j), (i, j + 1)):
                if max(abs(a), abs(b)) <= n:
                    graph.add_edge(node(i, j), node(a, b), length=spacing_m)
                    graph.add_edge(node(a, b), node(i, j), length=spacing_m)
    return graph


GRID = _grid(TRENTO)


class Roads:
    """The grid for any area, as a zone kept in memory hands it out."""

    def __init__(self, graph: Graph = GRID) -> None:
        self.graph = graph

    def load(self, bbox: BBox) -> Graph:
        return self.graph


class Planner:
    """The API's planner for a shape (images.plan_request) without the
    worker processes, keeping each job and plan it made."""

    def __init__(self, outcome: Exception | None = None) -> None:
        self.outcome = outcome
        self.jobs: list[ShapeJob] = []
        self.plans: list[NearbyPlan] = []

    def __call__(self, job: ShapeJob, start: LatLon, source: GraphLoader) -> NearbyPlan:
        self.jobs.append(job)
        if self.outcome is not None:
            raise self.outcome
        found = plan_nearby(job, start, source, processes=False)
        self.plans.append(found)
        return found

    def plan(self, request: Any, source: GraphLoader) -> Plan:
        """As jobs.Planner: the request's plan."""
        return self(ShapeJob.of_request(request), request.start, source).plan


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture(scope="module")
def drawn() -> tuple[RouteResult, Plan]:
    """The heart as the API draws and keeps it: with its alternatives from
    the nearby starts, and the directions."""
    plan = Planner().plan(HEART, Roads())
    assert plan.search is not None and plan.search.converged
    return with_choices(plan, [GRID]), plan


def archive(
    database: Database, engine: str, clock: Clock, planner: Planner | None = None
) -> RouteArchive:
    return RouteArchive(
        database, engine=engine, clock=clock, plans_nearby=planner or Planner()
    )


def placements(database: Database) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return conn.execute(
            "SELECT engine, ST_Y(start::geometry) AS lat,"
            " ST_X(start::geometry) AS lon,"
            " ST_Y(placed_start::geometry) AS placed_lat,"
            " ST_X(placed_start::geometry) AS placed_lon,"
            " offset_m, rotation_deg, phase, scale_m FROM drawn_routes ORDER BY id"
        ).fetchall()


def test_a_route_keeps_where_the_search_near_the_start_placed_it(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    assert plan.search is not None
    assert len(result.alternatives) == len(plan.alternatives) >= 1
    assert archive(database, "engine-a", clock).put_plan(HEART, result, plan)
    first, *others = placements(database)
    best = plan.search.best
    # The same numbers, to the last digit: they draw the same route.
    assert (first["placed_lat"], first["placed_lon"]) == best.placement.start
    assert first["offset_m"] == best.placement.offset_m == 0.0
    assert first["rotation_deg"] == best.placement.rotation_deg
    assert first["phase"] == best.placement.phase
    assert first["scale_m"] == best.scale_m
    # The alternatives come from the nearby starts' own searches, reached
    # from the start: not a placement of the search near it.
    assert len(others) == len(result.alternatives)
    assert all(row["scale_m"] is None and row["placed_lat"] is None for row in others)


def test_put_keeps_no_placement(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, _ = drawn
    assert archive(database, "engine-a", clock).put(HEART, result)
    assert all(row["scale_m"] is None for row in placements(database))


def test_placed_by_names_only_the_search_near_the_start(
    drawn: tuple[RouteResult, Plan],
) -> None:
    _, plan = drawn
    assert plan.search is not None
    best = plan.search.best
    assert placed_by(HEART, plan) == (best.placement, best.scale_m)
    # A nearby start's search: placed at its own node, not moved.
    elsewhere = local_to_latlon(TRENTO, 60.0, 0.0)
    other = replace(best, placement=replace(best.placement, start=elsewhere))
    assert placed_by(HEART, _with_best(plan, other)) is None
    # The search 2 km away, which takes no `first`.
    assert placed_by(HEART, replace(plan, far=plan.search)) is None
    # On the water, and without a search.
    assert placed_by(replace(HEART, activity="paddling"), plan) is None
    assert placed_by(HEART, replace(plan, search=None)) is None
    # A start the search near it moved, 250-500 m away: its own.
    moved = replace(best.placement, start=elsewhere, offset_m=250.0)
    assert placed_by(HEART, _with_best(plan, replace(best, placement=moved))) == (
        moved,
        best.scale_m,
    )


def _with_best(plan: Plan, best: Any) -> Plan:
    assert plan.search is not None
    found: Search = replace(plan.search, best=best)
    return replace(plan, search=found)


def test_after_the_engine_changes_the_route_is_drawn_again_from_its_placement(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    assert plan.search is not None
    archive(database, "engine-a", clock).put_plan(HEART, result, plan)
    planner = Planner()
    changed = archive(database, "engine-b", clock, planner)
    # Not this engine's: no answer in the POST.
    assert changed.get(HEART) is None
    again = changed.nearby(HEART, Roads())
    assert again is not None
    # The engine started from the placement kept, and drew it at once.
    [job] = planner.jobs
    assert job.first == plan.search.best.placement
    assert job.first_scale_m == plan.search.best.scale_m
    [found] = planner.plans
    start = found.tried[0].plan
    assert start is not None and start.search is not None
    assert len(start.search.attempts) == 1
    # The same route from the same start, its alternatives with it.
    assert again.points == result.points
    assert again.similarity == result.similarity
    assert len(again.alternatives) >= 1
    # Kept for this engine, with its placement: the next answer is at once.
    rows = placements(database)
    assert [r["engine"] for r in rows].count("engine-b") == 1 + len(
        found.plan.alternatives
    )
    answer = changed.get(HEART)
    assert answer is not None and answer.points == result.points
    # Drawn again once: the row of this engine answers from now on.
    assert changed.nearby(HEART, Roads()) is not None
    assert len(planner.jobs) == 1


def test_a_route_older_than_30_days_is_drawn_again(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    kept = archive(database, "engine-a", clock)
    kept.put_plan(HEART, result, plan)
    clock.now = NOW + timedelta(days=31)
    planner = Planner()
    again = archive(database, "engine-a", clock, planner).nearby(HEART, Roads())
    assert again is not None and again.points == result.points
    assert len(planner.jobs) == 1


def test_from_a_start_nearby_the_route_drawn_again_is_reached(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    archive(database, "engine-a", clock).put_plan(HEART, result, plan)
    planner = Planner()
    here = local_to_latlon(TRENTO, 0.0, 60.0)  # a crossing 60 m north
    asked = replace(HEART, start=here)
    again = archive(database, "engine-b", clock, planner).nearby(asked, Roads())
    assert again is not None
    # Drawn again from the start it was drawn from, not from the user's.
    [found] = planner.plans
    assert found.tried[0].start == TRENTO
    assert {(r["lat"], r["lon"]) for r in placements(database)} == {TRENTO}
    # Reached from the user's start along the roads, and back.
    assert again.points[0] == again.points[-1]
    assert again.points[0] == pytest.approx(here, abs=1e-6)
    assert again.distance_m == pytest.approx(result.distance_m + 120.0, abs=1.0)


def test_a_route_without_its_placement_or_not_good_is_left_to_the_planner(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    kept = archive(database, "engine-a", clock)
    kept.put(HEART, replace(result, alternatives=[]))  # kept before TASK-297 A2
    planner = Planner()
    assert archive(database, "engine-b", clock, planner).nearby(HEART, Roads()) is None
    # Good no more: the placement would not be either, and the planner
    # draws from the user's own start.
    worse = replace(result, similarity=0.85, alternatives=[])
    other = replace(HEART, distance_m=6000)
    kept.put_plan(other, worse, replace(plan, alternatives=[]))
    assert archive(database, "engine-b", clock, planner).nearby(other, Roads()) is None
    assert planner.jobs == []


def test_a_route_this_engine_cannot_draw_there_is_left_to_the_planner(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    archive(database, "engine-a", clock).put_plan(HEART, result, plan)
    planner = Planner(ShapeNotDrawableError("no heart here"))
    assert archive(database, "engine-b", clock, planner).nearby(HEART, Roads()) is None
    assert len(planner.jobs) == 1
    assert {r["engine"] for r in placements(database)} == {"engine-a"}


def test_on_the_water_nothing_is_drawn_again(
    database: Database, clock: Clock, drawn: tuple[RouteResult, Plan]
) -> None:
    result, plan = drawn
    archive(database, "engine-a", clock).put_plan(HEART, result, plan)
    planner = Planner()
    water = replace(HEART, shape="circle", distance_m=2000, activity="paddling")
    assert archive(database, "engine-b", clock, planner).nearby(water, Roads()) is None
    assert planner.jobs == []


# --- Through the API ---


def finished(client: TestClient, job_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 60
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.02)


def wait_until(check: Any, timeout: float = 10.0) -> None:
    """A job is `done` before its route is kept (jobs.RouteJobs._run)."""
    deadline = time.monotonic() + timeout
    while not check():
        assert time.monotonic() < deadline, "the archive did not get there in time"
        time.sleep(0.02)


def test_through_the_api_the_route_of_before_is_drawn_again(
    database: Database, clock: Clock
) -> None:
    """A job drawn and kept with its placement (jobs.KeepsPlacements); after
    the engine changes, the same request is drawn again by the archive from
    there, and the job's planner does not run."""
    before = Planner()
    kept = archive(database, "engine-a", clock)
    app = create_app(Roads(), planner=before.plan, route_store=kept)  # type: ignore[arg-type]
    with TestClient(app) as client:
        first = client.post("/route-jobs", json=HEART_BODY).json()
        drawn = finished(client, first["job_id"])
        assert drawn["status"] == "done", drawn
        wait_until(lambda: len(placements(database)) >= 1)
    assert placements(database)[0]["scale_m"] is not None

    after = Planner()
    changed = archive(database, "engine-b", clock, Planner())
    app = create_app(Roads(), planner=after.plan, route_store=changed)  # type: ignore[arg-type]
    with TestClient(app) as client:
        job = client.post("/route-jobs", json=HEART_BODY).json()
        assert job["status"] == "queued"  # an engine to run: not in the POST
        again = finished(client, job["job_id"])
        assert again["status"] == "done", again
        assert again["result"]["points"] == drawn["result"]["points"]
        assert again["result"]["directions"]
        assert after.jobs == []  # the archive drew it, not the job's planner
        # Kept by the archive: the next one is done in the POST.
        third = client.post("/route-jobs", json=HEART_BODY).json()
        assert third["status"] == "done"


# --- RouteJobs, without a database ---


class KeepsPlans:
    """A store that keeps the plan with the route (jobs.KeepsPlacements)."""

    def __init__(self) -> None:
        self.plans: list[Plan] = []
        self.puts = 0

    def get(self, request: object) -> RouteResult | None:
        return None

    def put(self, request: object, result: RouteResult) -> bool:
        self.puts += 1
        return True

    def put_plan(self, request: object, result: RouteResult, plan: Plan) -> bool:
        self.plans.append(plan)
        return True


class LoadsAndAnswersNot(KeepsPlans):
    """An archive that loads a zone of its own and has nothing nearby."""

    def nearby(
        self, request: object, source: GraphLoader, named_roads: object = None
    ) -> RouteResult | None:
        source.load((0.0, 0.0, 0.1, 0.1))
        return None


class Zones:
    """The grid for the plan's area, an empty graph for the archive's."""

    def load(self, bbox: BBox) -> Graph:
        return nx.MultiDiGraph() if bbox == (0.0, 0.0, 0.1, 0.1) else GRID


def test_a_job_keeps_its_route_with_the_plan_it_came_from() -> None:
    kept = KeepsPlans()
    planner = Planner()
    jobs = RouteJobs(Roads(), planner.plan, store=kept)  # type: ignore[arg-type]
    try:
        job = jobs.submit(HEART)
        wait_until(lambda: len(kept.plans) == 1)
        done = jobs.get(job.job_id)
        assert done is not None and done.status == "done"
        assert kept.plans == [planner.plans[0].plan] and kept.puts == 0
    finally:
        jobs.shutdown()


def test_the_directions_are_read_on_the_plans_graph_not_the_archives() -> None:
    """The archive loaded a zone and answered nothing: the directions of
    the plan are read on the graph the plan was traced on (with_choices
    reads the first loaded), not on the archive's."""
    kept = LoadsAndAnswersNot()
    planner = Planner()
    jobs = RouteJobs(Zones(), planner.plan, store=kept)  # type: ignore[arg-type]
    try:
        job = jobs.submit(HEART)
        wait_until(lambda: (jobs.get(job.job_id) or job).status in ("done", "failed"))
        done = jobs.get(job.job_id)
        assert done is not None and done.status == "done", done.error
        assert done.result is not None and done.result.directions
    finally:
        jobs.shutdown()
