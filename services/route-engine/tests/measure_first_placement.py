"""Measure the API's planner without and with the placement of before
(TASK-297 A2, ADR-0256): the catalogue's shapes, before and after a change.

Not a test. For every shape of the catalogue it plans as the API does
(nearby_starts.plan_nearby, here without worker processes, so the times
add up), from a centre: on the fake town and street grid of
test_kept_per_graph, a grid of streets every 250 m turned 30° and the
Levico fixture, and on the zones of a cache directory when given (never
downloads). Then it plans the same request
again, the search near the start trying first the placement of the route
just drawn (`first`, when this engine has it): what the API does after the
engine changes. Each row has the times of TASK-289 (job_times.line):
`start`, the seconds of the start's plan; `traces`, its search's and the
one farther away's; `converged`, `far`, `nearby` and `chosen`; and the
digest of every route the plan gives, so that two runs, before and after a
change, can be compared route by route:

    python tests/measure_first_placement.py --out after.json
    python tests/measure_first_placement.py --cache-dir ~/zones \\
        --city trento=46.0671,11.1214 --out trento.json
    python tests/measure_first_placement.py --compare before.json after.json
"""

from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import math
import sys
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import networkx as nx

# The engine this script sits in, not the one a venv may have installed
# from another checkout: the measure is of this code.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from test_kept_per_graph import (  # noqa: E402
    FIXTURE,
    LEVICO,
    TRENTO,
    _grid,
    _Source,
    _town,
)

from route_engine.geo import LatLon, local_to_latlon  # noqa: E402
from route_engine.models import RouteRequest, RouteResult  # noqa: E402
from route_engine.nearby_starts import NearbyPlan, ShapeJob, plan_nearby  # noqa: E402
from route_engine.network import (  # noqa: E402
    BBox,
    FileSource,
    Graph,
    OsmnxSource,
    crop,
    largest_piece,
    read_graph,
)
from route_engine.optimizer import (  # noqa: E402
    GraphLoader,
    Placement,
    Plan,
    plan_shape,
    search,
)
from route_engine.shapes import SUPPORTED_SHAPES  # noqa: E402

# Whether this engine takes a placement to try first (TASK-297 A2).
HAS_FIRST = "first" in inspect.signature(search).parameters


@dataclass(frozen=True)
class FirstJob(ShapeJob):
    """ShapeJob whose plan from the start tries `first` first, as the API's
    archive draws a route of before again (route_archive._FromPlacement)."""

    first: Placement | None = None
    first_scale_m: float | None = None

    def plan(self, start: LatLon, source: GraphLoader) -> Plan:
        plan = plan_shape(
            self.shape,
            self.name,
            start,
            self.distance_m,
            source,
            reuse_penalty=self.reuse_penalty,
            max_tilt_deg=self.max_tilt_deg,
            one_way=self.one_way,
            word=self.word,
            activity=self.activity,
            first=self.first,  # type: ignore[call-arg]
            first_scale_m=self.first_scale_m,  # type: ignore[call-arg]
        )
        return self._as_asked(plan)


def turned(origin: LatLon, spacing_m: float, half_m: float, deg: float) -> Graph:
    """Streets every `spacing_m`, turned `deg` counterclockwise: a shape with
    a top and a bottom fits them tilted, after the upright stage (TASK-232),
    or not at all."""
    graph = nx.MultiDiGraph()
    n, theta = int(half_m / spacing_m), math.radians(deg)
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            x, y = i * spacing_m, j * spacing_m
            lat, lon = local_to_latlon(
                origin,
                x * math.cos(theta) - y * math.sin(theta),
                x * math.sin(theta) + y * math.cos(theta),
            )
            graph.add_node((i, j), y=lat, x=lon)
    for i, j in list(graph.nodes):
        for b in ((i + 1, j), (i, j + 1)):
            if b in graph:
                graph.add_edge((i, j), b, length=spacing_m)
                graph.add_edge(b, (i, j), length=spacing_m)
    return graph


class CachedSource:
    """The cached zones only, each file read once."""

    def __init__(self, cache_dir: Path) -> None:
        self.source = OsmnxSource(cache_dir)

    @staticmethod
    @lru_cache(maxsize=2)
    def _read(path: Path) -> Graph:
        return read_graph(path)

    def load(self, bbox: BBox) -> Graph:
        exact = self.source.cache_path(bbox)
        if exact.exists():
            return largest_piece(self._read(exact))
        covering = self.source.covering_path(bbox)
        if covering is None:
            raise FileNotFoundError(f"no cached zone covers {bbox}")
        return crop(self._read(covering), bbox)


def digest(found: NearbyPlan) -> str:
    """Every route of the plan, as test_kept_per_graph._digest."""

    def route(result: RouteResult) -> tuple[object, ...]:
        return (
            [(round(a, 9), round(b, 9)) for a, b in result.points],
            round(result.distance_m, 6),
            round(result.similarity, 9),
            result.warnings,
            list(result.walks),
        )

    plan = found.plan
    text = repr(
        (
            found.chosen,
            route(plan.result),
            [route(other.result) for other in plan.alternatives],
            [
                (None if t.score is None else round(t.score, 9), t.note)
                for t in found.tried
            ],
        )
    )
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def times(found: NearbyPlan, total_s: float) -> dict[str, Any]:
    """The fields of TASK-289 (job_times.line) the plan knows."""
    start = found.tried[0]
    plan = start.plan
    traces: int | None = None
    converged = far = None
    if plan is not None and plan.search is not None:
        # The traces of a placement of before set aside count too.
        traces = len(plan.search.attempts) + len(getattr(plan.search, "set_aside", []))
        if plan.far is not None and plan.far is not plan.search:
            traces += len(plan.far.attempts)
        converged = plan.search.converged
        far = plan.far is not None
    return {
        "total": round(total_s, 2),
        "start": round(start.seconds, 2),
        "traces": traces,
        "converged": converged,
        "far": far,
        "nearby": [round(t.seconds, 2) for t in found.tried[1:]],
        "chosen": found.chosen,
        "similarity": round(found.plan.result.similarity, 4),
        "distance_m": round(found.plan.result.distance_m),
        "digest": digest(found),
    }


def placement_of(found: NearbyPlan) -> tuple[Placement, float] | None:
    """The start's own search's best placement, as the API keeps it
    (route_archive.placed_by); None from the search 2 km away."""
    plan = found.tried[0].plan
    if plan is None or plan.search is None or plan.search is plan.far:
        return None
    return plan.search.best.placement, plan.search.best.scale_m


def plan(job: ShapeJob, start: LatLon, source: GraphLoader) -> tuple[NearbyPlan, float]:
    began = time.perf_counter()
    found = plan_nearby(job, start, source, processes=False)
    return found, time.perf_counter() - began


def measure(
    place: str, start: LatLon, source: GraphLoader, distance_m: int
) -> list[dict[str, Any]]:
    rows = []
    for name in SUPPORTED_SHAPES:
        request = RouteRequest(start=start, distance_m=distance_m, shape=name)
        row: dict[str, Any] = {"place": place, "shape": name, "distance_m": distance_m}
        try:
            found, seconds = plan(ShapeJob.of_request(request), start, source)
        except ValueError as exc:  # ShapeNotDrawableError
            row["before"] = {"error": type(exc).__name__}
            rows.append(row)
            print(line(row), flush=True)
            continue
        row["before"] = times(found, seconds)
        placed = placement_of(found)
        if HAS_FIRST and placed is not None:
            job = replace(
                FirstJob.of_request(request), first=placed[0], first_scale_m=placed[1]
            )
            again, seconds = plan(job, start, source)
            row["again"] = times(again, seconds)
            row["again"]["same"] = again.plan.result.points == found.plan.result.points
        rows.append(row)
        print(line(row), flush=True)
    return rows


def _cell(t: dict[str, Any] | None) -> str:
    if t is None:
        return f"{'-':>32}"
    if "error" in t:
        return f"{t['error']:>32}"
    ok = "ok" if t["converged"] else "no"
    return (
        f"{t['traces']!s:>4} {ok} {t['similarity']:.2f}"
        f" start {t['start']:5.2f} total {t['total']:5.2f}"
    )


def line(row: dict[str, Any]) -> str:
    again = row.get("again")
    same = "" if again is None else (" same" if again["same"] else " OTHER")
    return (
        f"{row['place']:<8} {row['shape']:<15} {row['distance_m'] / 1000:>3g}"
        f" | {_cell(row['before'])} | {_cell(again)}{same}"
    )


def totals(rows: Sequence[dict[str, Any]], which: str) -> str:
    done = [r[which] for r in rows if which in r and "error" not in r[which]]
    traces = sum(int(t["traces"] or 0) for t in done)
    good = sum(1 for t in done if t["converged"])
    start = sum(float(t["start"]) for t in done)
    total = sum(float(t["total"]) for t in done)
    return (
        f"{which}: {len(done)} plans, good {good}, traces of the start {traces},"
        f" start {start:.1f} s, total {total:.1f} s"
    )


def compare(before: Path, after: Path) -> None:
    """The plans of two runs side by side, without `first`: the same
    routes, digest for digest, and their traces and seconds."""
    a = {(r["place"], r["shape"], r["distance_m"]): r for r in _rows(before)}
    b = {(r["place"], r["shape"], r["distance_m"]): r for r in _rows(after)}
    same = 0
    for key in sorted(a.keys() & b.keys()):
        x, y = a[key]["before"], b[key]["before"]
        equal = x.get("digest") == y.get("digest") and x.get("error") == y.get("error")
        same += equal
        print(
            f"{key[0]:<8} {key[1]:<15} {key[2] / 1000:>3g}"
            f" | {_cell(x)} | {_cell(y)} {'same' if equal else 'OTHER'}"
        )
    print(f"{same} of {len(a.keys() & b.keys())} plans the same")


def _rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = json.loads(path.read_text())
    return rows


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--city", action="append", default=[], help="name=lat,lon")
    parser.add_argument("--km", type=int, default=5)
    parser.add_argument("--compare", nargs=2, type=Path)
    args = parser.parse_args(argv)
    if args.compare:
        compare(*args.compare)
        return 0
    places: list[tuple[str, LatLon, Callable[[], GraphLoader], int]] = [
        ("grid", TRENTO, lambda: _Source(_grid(TRENTO, 60.0, 3000.0)), args.km * 1000),
        ("town", TRENTO, lambda: _Source(_town(TRENTO)), args.km * 1000),
        (
            "turned",
            TRENTO,
            lambda: _Source(turned(TRENTO, 250.0, 3000.0, 30.0)),
            args.km * 1000,
        ),
        # The fixture holds a kilometre around Levico.
        ("levico", LEVICO, lambda: FileSource(FIXTURE), 1000),
    ]
    if args.cache_dir is not None:
        cached = CachedSource(args.cache_dir)
        for city in args.city:
            name, at = city.split("=")
            lat, lon = (float(v) for v in at.split(","))
            places.append((name, (lat, lon), lambda: cached, args.km * 1000))
    print(f"first placement in this engine: {HAS_FIRST}")
    rows: list[dict[str, Any]] = []
    for place, start, source, distance_m in places:
        rows.extend(measure(place, start, source(), distance_m))
    print(totals(rows, "before"))
    print(totals(rows, "again"))
    if args.out is not None:
        args.out.write_text(json.dumps(rows, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
