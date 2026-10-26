"""Measure where the search finds its first good route and how many traces
it spends (TASK-298, ADR-0259).

Not a test: it reads the zone graphs from a cache directory, never
downloads, and runs `optimizer.search` as the API's planner calls it for
each shape and distance from six starts around a city centre (the
requests of ADR-0257: heart, star, cat, snail and moon at 5 km, the heart
at 2 km; 36 per city). It prints one row per request and writes every
attempt of every search to a JSON file, so a change to the search can be
compared on the same numbers, trace by trace: traces are the engine's
cost unit, seconds depend on the machine.

    python tests/measure_stop_earlier.py --out before.json
    python tests/measure_stop_earlier.py --cache-dir /tmp/zones \\
        --city milano=45.4642,9.1900 --out milano.json
    python tests/measure_stop_earlier.py --compare before.json after.json

Columns: the shape, the target in km, the start, the traces spent, the
trace of the first good route (distance within 10%, similarity at least
0.90) or «-», the best route's similarity and distance ratio, whether the
search converged, and the time.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
from collections.abc import Sequence
from functools import lru_cache
from pathlib import Path

# The engine this script sits in, not the one a venv may have installed
# from another checkout: the measure is of this code.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from route_engine import optimizer  # noqa: E402
from route_engine.geo import LatLon  # noqa: E402
from route_engine.network import (  # noqa: E402
    BBox,
    Graph,
    OsmnxSource,
    crop,
    largest_piece,
    read_graph,
)
from route_engine.optimizer import (  # noqa: E402
    DISTANCE_TOLERANCE,
    SHAPE_POINTS,
    SIMILARITY_THRESHOLD,
    UPRIGHT_TILT_DEG,
    Attempt,
    doubled_weight,
    required_area,
    search,
    tilt_limit,
)
from route_engine.shapes import get_shape  # noqa: E402

TRENTO = (46.0671, 11.1214)
# East and north of the centre, in metres: the six starts of ADR-0257.
START_MOVES = ((0, 0), (400, 300), (-500, 200), (200, -600), (-300, -450), (700, -100))
CASES: tuple[tuple[str, int], ...] = (
    ("heart", 5000),
    ("star", 5000),
    ("cat", 5000),
    ("snail", 5000),
    ("moon", 5000),
    ("heart", 2000),
)


def moved(centre: LatLon, east_m: float, north_m: float) -> LatLon:
    lat, lon = centre
    dlat = north_m / 111_320.0
    dlon = east_m / (111_320.0 * math.cos(math.radians(lat)))
    return (round(lat + dlat, 6), round(lon + dlon, 6))


class CachedSource:
    """The cached zones only, each file read once: a zone of a city is
    tens of MB, and the 36 requests crop it 36 times."""

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


def good(a: Attempt) -> bool:
    return (
        abs(a.ratio - 1) <= DISTANCE_TOLERANCE and a.similarity >= SIMILARITY_THRESHOLD
    )


def digest(points: Sequence[LatLon]) -> str:
    text = repr([(round(a, 9), round(b, 9)) for a, b in points])
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def record(a: Attempt, tilt: float) -> dict[str, object]:
    gap = abs((a.rotation_deg + 180.0) % 360.0 - 180.0)
    return {
        "start": list(a.placement.start),
        "offset_m": round(a.offset_m),
        "rotation_deg": a.rotation_deg,
        "phase": a.phase,
        "scale_m": round(a.scale_m, 3),
        "similarity": round(a.similarity, 4),
        "ratio": round(a.ratio, 4),
        "cost": round(a.cost, 5),
        "good": good(a),
        "tilted": tilt < optimizer.FREE_TILT_DEG and gap > UPRIGHT_TILT_DEG + 1e-9,
    }


def measure(
    city: str, centre: LatLon, source: CachedSource, cases: Sequence[tuple[str, int]]
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for name, distance in cases:
        shape = tuple(get_shape(name)(SHAPE_POINTS))
        tilt = tilt_limit(name)
        for east, north in START_MOVES:
            start = moved(centre, east, north)
            graph = source.load(required_area(shape, start, distance))
            t0 = time.perf_counter()
            found = search(
                graph,
                shape,
                start,
                distance,
                max_tilt_deg=tilt,
                doubled=doubled_weight(name),
            )
            elapsed = time.perf_counter() - t0
            attempts = [record(a, tilt) for a in found.attempts]
            first = next((i + 1 for i, a in enumerate(attempts) if a["good"]), None)
            best = found.best
            row = {
                "city": city,
                "shape": name,
                "distance_m": distance,
                "start": list(start),
                "nodes": graph.number_of_nodes(),
                "traces": len(attempts),
                "converged": found.converged,
                "first_good": first,
                "similarity": round(best.similarity, 4),
                "ratio": round(best.ratio, 4),
                "cost": round(best.cost, 5),
                "best_index": found.attempts.index(best) + 1,
                "digest": digest(best.route.points),
                "s": round(elapsed, 1),
                "attempts": attempts,
            }
            rows.append(row)
            print(line(row), flush=True)
    return rows


def line(row: dict[str, object]) -> str:
    lat, lon = row["start"]  # type: ignore[misc]
    first = row["first_good"]
    return (
        f"{row['city']:<8} {row['shape']:<6} {row['distance_m'] / 1000:>3g}"  # type: ignore[operator]
        f" {lat:.4f},{lon:.4f} {row['traces']:>3} {first if first else '-':>3}"
        f" {row['similarity']:.2f} {row['ratio']:.2f}"
        f" {'ok' if row['converged'] else 'no':<3} {row['s']:>5.1f}s"
    )


def totals(rows: Sequence[dict[str, object]]) -> str:
    traces = sum(int(r["traces"]) for r in rows)  # type: ignore[call-overload]
    goods = sum(1 for r in rows if r["converged"])
    seconds = sum(float(r["s"]) for r in rows)  # type: ignore[arg-type]
    return f"{len(rows)} requests: good {goods}, traces {traces}, {seconds:.0f} s"


def key(row: dict[str, object]) -> tuple[object, ...]:
    return (row["city"], row["shape"], row["distance_m"], tuple(row["start"]))  # type: ignore[arg-type]


def ok(row: dict[str, object]) -> str:
    return "ok" if row["converged"] else "no"


def compare(before: Sequence[dict[str, object]], after: Sequence[dict[str, object]]):
    """Before and after, request by request: whether a good route was kept
    or lost, the traces saved, and whether the route is the same."""
    later = {key(r): r for r in after}
    print(
        f"{'city':<8} {'shape':<6} {'km':>3} {'start':<17} {'traces':>9}"
        f" {'good':>7} {'similarity':>11} {'same':>4}"
    )
    lost = same = 0
    for b in before:
        a = later.get(key(b))
        if a is None:
            continue
        lat, lon = b["start"]  # type: ignore[misc]
        same_route = a["digest"] == b["digest"]
        same += same_route
        lost += bool(b["converged"]) and not a["converged"]
        print(
            f"{b['city']:<8} {b['shape']:<6} {b['distance_m'] / 1000:>3g}"  # type: ignore[operator]
            f" {lat:.4f},{lon:.4f} {b['traces']:>4}>{a['traces']:<4}"
            f" {ok(b):>3}>{ok(a):<3}"
            f" {b['similarity']:.2f}>{a['similarity']:.2f}   "
            f" {'yes' if same_route else 'no':>4}"
        )
    print(f"before: {totals(before)}")
    print(f"after:  {totals(after)}")
    print(f"good routes lost: {lost}; same route: {same}/{len(before)}")


def parse_city(text: str) -> tuple[str, LatLon]:
    name, _, where = text.partition("=")
    lat, lon = (float(v) for v in where.split(","))
    return name, (lat, lon)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache-dir", type=Path, default=Path("../../data/cache"))
    parser.add_argument(
        "--city",
        action="append",
        type=parse_city,
        help="name=lat,lon of a centre whose zone is cached; default Trento",
    )
    parser.add_argument("--only", help="a shape name, e.g. cat")
    parser.add_argument("--out", type=Path, help="write every attempt here (JSON)")
    parser.add_argument(
        "--compare",
        nargs=2,
        type=Path,
        metavar=("BEFORE", "AFTER"),
        help="two --out files to set side by side",
    )
    args = parser.parse_args(argv)
    if args.compare:
        before, after = (json.loads(p.read_text()) for p in args.compare)
        compare(before, after)
        return 0
    cities = args.city or [("trento", TRENTO)]
    cases = [c for c in CASES if args.only is None or c[0] == args.only]
    source = CachedSource(args.cache_dir)
    print(f"engine: {optimizer.__file__}")
    print(
        f"{'city':<8} {'shape':<6} {'km':>3} {'start':<17} {'tr':>3} {'1st':>3}"
        f" {'sim':>4} {'dist':>4} {'ok':<3} {'time':>6}"
    )
    rows: list[dict[str, object]] = []
    for city, centre in cities:
        rows += measure(city, centre, source, cases)
        if args.out is not None:
            args.out.write_text(json.dumps(rows, indent=1))
    print(totals(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
