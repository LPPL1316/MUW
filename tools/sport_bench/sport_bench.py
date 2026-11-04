"""The shared sport bench (TASK-376, ADR-0320).

Given an activity (or a network of one still being built) and the fixed test
zones, it measures how much network there is, whether the shapes of the
catalogue come out on it and in how long: the same numbers for every sport,
so a new one starts from what the others measured, and a change is compared
with the numbers before it (``docs/sports/``).

Usage, from the repository root:

    python tools/sport_bench/sport_bench.py zones
    python tools/sport_bench/sport_bench.py run --activity running \\
        --zones trento valsugana --cache-dir data/cache --label phase0
    python tools/sport_bench/sport_bench.py run --activity hiking \\
        --distances 5000 10000 --loader out/hike/loader.py:make_source \\
        --label hike-try1
    python tools/sport_bench/sport_bench.py compare \\
        out/sport-bench/phase0/running.json out/sport-bench/after/running.json

``run`` writes ``out/sport-bench/<label>/<activity>.json`` and prints the
Markdown tables that go in ``docs/sports/<sport>.md``. Zones not in the cache
are downloaded from Overpass, as the CLI of the Route Engine does: run few
zones at a time (``docs/MAPS.md``), and one bench at a time on the Mac.
``--loader FILE:FUNCTION`` takes the graphs from ``FUNCTION(cache_dir)``, the
GraphLoader of a network not registered in the engine yet. ``compare`` says
what got worse: a shape that no longer comes out, a lower similarity, a
slower route.

The engine is imported only by ``run``: the rest is the standard library, so
the tests need no network and no zone.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import statistics
import subprocess
import sys
import time
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

LatLon = tuple[float, float]

# The engine's floor (route_engine.optimizer.MIN_SIMILARITY: below it a
# shape is refused) and the "good" mark of TASK-372 and TASK-373, from which
# a shape reads at a glance.
MIN_SIMILARITY = 0.60
GOOD_SIMILARITY = 0.90
# The shapes of every bench unless told otherwise: those of TASK-372, so its
# numbers stay comparable (foot network at Trento, 5 km: 0.90, 0.91, 0.98).
DEFAULT_SHAPES: tuple[str, ...] = ("circle", "heart", "star")
# Three distances for each activity, within its limits (models.py); one not
# here needs --distances.
DEFAULT_DISTANCES_M: dict[str, tuple[int, ...]] = {
    "running": (3_000, 5_000, 10_000),
    "walking": (2_000, 5_000, 10_000),
    "cycling": (10_000, 20_000, 30_000),
    "paddling": (2_000, 3_000, 5_000),
}
# Drawn on the water, from the zone's water start (plan_paddling).
WATER_ACTIVITIES = frozenset({"paddling"})
OUT_DIR = Path("out/sport-bench")
# What `compare` lets pass as noise: a similarity this much lower, a route
# up to SLOWER_FACTOR times or SLOWER_SLACK_S seconds slower.
SIMILARITY_SLACK = 0.02
SLOWER_FACTOR = 1.5
SLOWER_SLACK_S = 2.0
# Overpass, when full (502, 504, 429), asks to retry with a wait doubled
# each time; a zone still refused after the last one is left out of the run.
RETRY_WAITS_S: tuple[float, ...] = (60.0, 120.0, 240.0)


@dataclass(frozen=True)
class Zone:
    """A fixed test zone: where routes start and, where there is water, where
    a paddling route starts (near the shore: the engine moves it onto the
    shore and says how far, `move_m`)."""

    key: str
    name: str
    start: LatLon
    kind: str
    water_start: LatLon | None = None


# The zones every sport is measured on, the same for all (TASK-376): a city
# in a valley, a lake valley, a big flat city, two mountain areas with snow
# in winter, the plain.
ZONES: tuple[Zone, ...] = (
    Zone("trento", "Trento", (46.0679, 11.1211), "valley city"),
    Zone(
        "valsugana",
        "Valsugana (Levico Terme)",
        (46.0122, 11.2986),
        "lake valley",
        water_start=(46.0075, 11.2930),
    ),
    Zone(
        "milano",
        "Milano",
        (45.4642, 9.1900),
        "big city",
        water_start=(45.4660, 9.2780),
    ),
    Zone("fiemme", "Val di Fiemme (Cavalese)", (46.2915, 11.4605), "mountain"),
    Zone("asiago", "Asiago", (45.8757, 11.5097), "plateau"),
    Zone(
        "pianura",
        "Pianura (Mantova)",
        (45.1564, 10.7914),
        "plain",
        water_start=(45.1620, 10.7980),
    ),
)
ZONES_BY_KEY: dict[str, Zone] = {zone.key: zone for zone in ZONES}


@dataclass
class NetworkStats:
    """How much network a zone has, each street counted once."""

    km: float
    nodes: int
    junctions: int
    dead_ends: int
    pieces: int
    largest_km: float
    # Kilometres for each value of a tag (`network_stats(by_tag=...)`).
    km_by_tag: dict[str, float] = field(default_factory=dict)


def network_stats(
    edges: Iterable[tuple[Any, Any, float, Mapping[str, Any]]],
    by_tag: str | None = "highway",
) -> NetworkStats:
    """The stats of a graph given as (u, v, length in metres, tags) edges.

    An OSMnx graph holds a two-way street twice, u→v and v→u with the same
    length: it counts once. A junction is a node where three or more streets
    meet, a dead end one where only one arrives; a piece is a part connected
    to no other."""
    seen: set[tuple[Any, Any, float]] = set()
    neighbours: dict[Any, set[Any]] = defaultdict(set)
    parent: dict[Any, Any] = {}
    lengths: list[tuple[Any, float]] = []
    km_by_tag: dict[str, float] = defaultdict(float)

    def root(node: Any) -> Any:
        parent.setdefault(node, node)
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    for u, v, length, tags in edges:
        a, b = sorted((u, v), key=repr)
        key = (a, b, round(float(length), 1))
        if key in seen:
            continue
        seen.add(key)
        if u != v:
            neighbours[u].add(v)
            neighbours[v].add(u)
        parent[root(u)] = root(v)
        lengths.append((u, float(length)))
        if by_tag is not None:
            value = tags.get(by_tag)
            if isinstance(value, list):  # OSMnx keeps merged ways' tags as lists
                value = value[0] if value else None
            km_by_tag["-" if value is None else str(value)] += length / 1000
    by_piece: dict[Any, float] = defaultdict(float)
    for node, length in lengths:
        by_piece[root(node)] += length
    nodes = set(parent)
    return NetworkStats(
        km=sum(length for _, length in lengths) / 1000,
        nodes=len(nodes),
        junctions=sum(1 for node in nodes if len(neighbours[node]) >= 3),
        dead_ends=sum(1 for node in nodes if len(neighbours[node]) == 1),
        pieces=len({root(node) for node in nodes}),
        largest_km=max(by_piece.values(), default=0.0) / 1000,
        km_by_tag=dict(sorted(km_by_tag.items(), key=lambda item: -item[1])),
    )


@dataclass
class Row:
    """One route asked: what came out, or why not."""

    zone: str
    shape: str
    target_m: int
    seconds: float
    real_m: float | None = None
    similarity: float | None = None
    error: str | None = None
    # On the water: how far the start moved onto the shore, and how much the
    # shape shrank to fit (1: not at all).
    move_m: float | None = None
    scale: float | None = None

    @property
    def drawn(self) -> bool:
        return self.error is None and (self.similarity or 0.0) >= MIN_SIMILARITY

    @property
    def good(self) -> bool:
        return self.drawn and (self.similarity or 0.0) >= GOOD_SIMILARITY


# What measures one route: (zone, shape, target metres) -> a Row.
Planner = Callable[["Zone", str, int], Row]


def measure(
    zones: Sequence[Zone],
    shapes: Sequence[str],
    distances_m: Sequence[int],
    plan: Planner,
    echo: Callable[[str], None] = lambda line: None,
) -> list[Row]:
    """Every shape at every distance in every zone, one Row each, in order."""
    rows: list[Row] = []
    for zone in zones:
        for shape in shapes:
            for distance_m in distances_m:
                row = plan(zone, shape, distance_m)
                echo(json.dumps(asdict(row)))
                rows.append(row)
    return rows


@dataclass
class Summary:
    asked: int
    drawn: int
    good: int
    errors: int
    median_s: float
    max_s: float
    median_similarity: float | None


def summarize(rows: Sequence[Row]) -> Summary:
    """How many routes came out (≥ MIN_SIMILARITY), how many good (≥
    GOOD_SIMILARITY), how many refused, and how long they took."""
    seconds = [row.seconds for row in rows] or [0.0]
    similarities = [row.similarity for row in rows if row.similarity is not None]
    return Summary(
        asked=len(rows),
        drawn=sum(1 for row in rows if row.drawn),
        good=sum(1 for row in rows if row.good),
        errors=sum(1 for row in rows if row.error is not None),
        median_s=statistics.median(seconds),
        max_s=max(seconds),
        median_similarity=statistics.median(similarities) if similarities else None,
    )


def comma(value: float | None, digits: int = 2) -> str:
    """A number as the Italian documents write it: 0,90."""
    if value is None:
        return "—"
    return f"{value:.{digits}f}".replace(".", ",")


def network_table(stats: Mapping[str, NetworkStats]) -> str:
    """The Markdown table of the network of each zone."""
    lines = [
        "| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |",
        "|---|---|---|---|---|---|",
    ]
    for key, s in stats.items():
        lines.append(
            f"| {key} | {comma(s.km, 1)} | {s.pieces} | {comma(s.largest_km, 1)} km "
            f"| {s.junctions} | {s.dead_ends} |"
        )
    return "\n".join(lines)


def shapes_table(rows: Sequence[Row]) -> str:
    """The Markdown table of the routes of each zone, and of all: how many
    came out, how many good, the median similarity and the times."""
    lines = [
        "| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) "
        "| somiglianza mediana | tempo mediano | tempo massimo |",
        "|---|---|---|---|---|---|---|",
    ]
    by_zone: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        by_zone[row.zone].append(row)
    for key, zone_rows in [*by_zone.items(), ("tutte", list(rows))]:
        s = summarize(zone_rows)
        lines.append(
            f"| {key} | {s.asked} | {s.drawn} | {s.good} "
            f"| {comma(s.median_similarity)} | {comma(s.median_s, 1)} s "
            f"| {comma(s.max_s, 1)} s |"
        )
    return "\n".join(lines)


def outcome(row: Row) -> str:
    """One word on how a route went, as the tables say it."""
    if row.error is not None:
        return row.error.split(":")[0]
    if row.good:
        return "buono"
    return "riuscito" if row.drawn else "sotto 0,60"


def routes_table(rows: Sequence[Row]) -> str:
    """Every route asked, one line each."""
    lines = [
        "| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        real = None if row.real_m is None else row.real_m / 1000
        lines.append(
            f"| {row.zone} | {row.shape} | {row.target_m / 1000:g} "
            f"| {comma(real, 1)} | {comma(row.similarity)} "
            f"| {comma(row.seconds, 1)} s | {outcome(row)} |"
        )
    return "\n".join(lines)


@dataclass
class Change:
    zone: str
    shape: str
    target_m: int
    what: str


def compare(before: Sequence[Row], after: Sequence[Row]) -> list[Change]:
    """What got worse from `before` to `after`, route by route: a route that
    no longer comes out, a similarity lower by more than SIMILARITY_SLACK, a
    route more than SLOWER_FACTOR times and SLOWER_SLACK_S seconds slower. A
    route in only one of the two is said too, so nothing is compared on
    different requests unseen."""
    old = {(r.zone, r.shape, r.target_m): r for r in before}
    new = {(r.zone, r.shape, r.target_m): r for r in after}
    changes: list[Change] = []
    for key in sorted(old.keys() | new.keys()):
        a, b = old.get(key), new.get(key)
        if a is None or b is None:
            changes.append(Change(*key, "only before" if b is None else "only after"))
            continue
        if a.drawn and not b.drawn:
            why = b.error or f"similarity {b.similarity}"
            changes.append(Change(*key, f"no longer drawn: {why}"))
        elif (
            a.similarity is not None
            and b.similarity is not None
            and b.similarity < a.similarity - SIMILARITY_SLACK
        ):
            changes.append(
                Change(*key, f"similarity {a.similarity:.2f} -> {b.similarity:.2f}")
            )
        slower = b.seconds - a.seconds
        if b.seconds > a.seconds * SLOWER_FACTOR and slower > SLOWER_SLACK_S:
            changes.append(
                Change(*key, f"slower {a.seconds:.1f} s -> {b.seconds:.1f} s")
            )
    return changes


def read_rows(path: Path) -> list[Row]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Row(**row) for row in data["rows"]]


def write_results(
    path: Path,
    activity: str,
    label: str,
    stats: Mapping[str, NetworkStats],
    rows: Sequence[Row],
    commit: str | None,
) -> None:
    """The run as JSON: what was measured, on which commit, when."""
    path.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "activity": activity,
        "label": label,
        "commit": commit,
        "when": datetime.now(UTC).isoformat(timespec="seconds"),
        "network": {key: asdict(s) for key, s in stats.items()},
        "rows": [asdict(row) for row in rows],
    }
    path.write_text(json.dumps(document, indent=1) + "\n", encoding="utf-8")


def git_commit() -> str | None:
    try:
        answer = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return answer.stdout.strip() or None


def load_loader(spec: str, cache_dir: Path) -> Any:
    """`FILE:FUNCTION` -> FUNCTION(cache_dir): the GraphLoader of a network
    not registered in the engine yet."""
    file, _, function = spec.rpartition(":")
    if not file or not function:
        raise SystemExit(f"--loader wants FILE:FUNCTION, not {spec!r}")
    module_spec = importlib.util.spec_from_file_location("bench_loader", file)
    if module_spec is None or module_spec.loader is None:
        raise SystemExit(f"cannot read {file}")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return getattr(module, function)(cache_dir)


def engine_planner(
    activity: str,
    source: Any,
    sleep: Callable[[float], None] = time.sleep,
    echo: Callable[[str], None] = lambda line: None,
) -> Planner:
    """A Planner that asks the Route Engine as its CLI does: plan_route on
    the roads, plan_paddling on the water. A download refused (the water is
    fetched while planning) is tried again (`with_retries`); the time is the
    last try's."""
    from route_engine.models import RouteRequest
    from route_engine.optimizer import plan_route
    from route_engine.paddling import plan_paddling

    on_water = activity in WATER_ACTIVITIES

    def plan(zone: Zone, shape: str, distance_m: int) -> Row:
        start = zone.water_start if on_water else zone.start
        if start is None:
            return Row(zone.key, shape, distance_m, 0.0, error="NoStart: no water")
        request = RouteRequest(
            start=start, distance_m=distance_m, shape=shape, activity=activity
        )
        began = time.perf_counter()

        def attempt() -> tuple[Any, dict[str, float]]:
            nonlocal began
            began = time.perf_counter()
            if on_water:
                planned = plan_paddling(request, source)
                return planned.result, {
                    "move_m": round(planned.route.move_m),
                    "scale": round(planned.route.scale, 3),
                }
            return plan_route(request, source).result, {}

        try:
            result, extra = with_retries(
                attempt, sleep=sleep, echo=echo, retry_if=network_error
            )
        except Exception as exc:  # noqa: BLE001 - every refusal is a result
            return Row(
                zone.key,
                shape,
                distance_m,
                round(time.perf_counter() - began, 1),
                error=f"{type(exc).__name__}: {exc}"[:200],
            )
        return Row(
            zone.key,
            shape,
            distance_m,
            round(time.perf_counter() - began, 1),
            real_m=round(result.distance_m),
            similarity=round(result.similarity, 3),
            **extra,
        )

    return plan


# The errors of OSMnx when Overpass refuses or answers nothing: ValueErrors,
# told apart from a request the engine refuses by their names.
OVERPASS_ERRORS = frozenset({"ResponseStatusCodeError", "InsufficientResponseError"})


def network_error(exc: BaseException) -> bool:
    """Whether `exc` says the network failed (a download refused, a timeout),
    not the request: only these are worth trying again."""
    return isinstance(exc, OSError) or type(exc).__name__ in OVERPASS_ERRORS


def with_retries(
    task: Callable[[], Any],
    waits_s: Sequence[float] = RETRY_WAITS_S,
    sleep: Callable[[float], None] = time.sleep,
    echo: Callable[[str], None] = lambda line: None,
    retry_if: Callable[[BaseException], bool] = lambda exc: True,
) -> Any:
    """`task()`, tried again after each wait of `waits_s` when it raises an
    error `retry_if` accepts; any other error, and the last, is raised."""
    for wait_s in (*waits_s, None):
        try:
            return task()
        except Exception as exc:
            if wait_s is None or not retry_if(exc):
                raise
            echo(f"{type(exc).__name__}: {str(exc)[:80]!r}, again in {wait_s:g} s")
            sleep(wait_s)
    raise AssertionError("unreachable")


def zone_network(
    source: Any, zone: Zone, shapes: Sequence[str], distances_m: Sequence[int]
) -> NetworkStats:
    """The graph the longest routes of `zone` need, loaded once (the
    shorter ones are cut from it), and its stats."""
    from route_engine.optimizer import SHAPE_POINTS, required_area
    from route_engine.shapes import get_shape
    from route_engine.stops import union

    longest = max(distances_m)
    bbox = union(
        [
            required_area(get_shape(shape)(SHAPE_POINTS), zone.start, longest)
            for shape in shapes
        ]
    )
    graph = source.load(bbox)
    return network_stats(
        (u, v, data.get("length", 0.0), data) for u, v, data in graph.edges(data=True)
    )


def zone_water(
    source: Any,
    zone: Zone,
    activity: str,
    shapes: Sequence[str],
    distances_m: Sequence[int],
) -> None:
    """The water the longest routes of `zone` need, fetched once into the
    cache (the shorter ones read it from there): one request to Overpass for
    the zone, not one for each route."""
    from route_engine.models import RouteRequest
    from route_engine.paddling import water_area
    from route_engine.stops import union

    assert zone.water_start is not None
    longest = max(distances_m)
    bbox = union(
        [
            water_area(
                RouteRequest(
                    start=zone.water_start,
                    distance_m=longest,
                    shape=shape,
                    activity=activity,
                )
            )
            for shape in shapes
        ]
    )
    source.elements(bbox)


def _run(args: argparse.Namespace) -> int:
    activity: str = args.activity
    distances = tuple(args.distances or DEFAULT_DISTANCES_M.get(activity, ()))
    if not distances:
        raise SystemExit(f"no default distances for {activity}: use --distances")
    zones = [ZONES_BY_KEY[key] for key in args.zones]
    on_water = activity in WATER_ACTIVITIES
    if args.loader:
        source = load_loader(args.loader, args.cache_dir)
    elif on_water:
        from route_engine.water import OverpassWaterSource

        source = OverpassWaterSource(args.cache_dir)
    else:
        from route_engine.network import OsmnxSource

        source = OsmnxSource.for_activity(args.cache_dir, activity)
    stats: dict[str, NetworkStats] = {}
    if not on_water:
        reachable: list[Zone] = []
        for zone in zones:
            print(f"Network of {zone.key}...", file=sys.stderr, flush=True)
            try:
                stats[zone.key] = with_retries(
                    lambda zone=zone: zone_network(
                        source, zone, args.shapes, distances
                    ),
                    echo=lambda line: print(line, file=sys.stderr, flush=True),
                    retry_if=network_error,
                )
            except Exception as exc:  # noqa: BLE001 - said, and the zone left out
                print(f"Left out {zone.key}: {exc!r}"[:300], file=sys.stderr)
                continue
            reachable.append(zone)
        zones = reachable
    elif not args.loader:
        with_water: list[Zone] = []
        for zone in zones:
            if zone.water_start is None:
                continue
            print(f"Water of {zone.key}...", file=sys.stderr, flush=True)
            try:
                with_retries(
                    lambda zone=zone: zone_water(
                        source, zone, activity, args.shapes, distances
                    ),
                    echo=lambda line: print(line, file=sys.stderr, flush=True),
                    retry_if=network_error,
                )
            except Exception as exc:  # noqa: BLE001 - said, and the zone left out
                print(f"Left out {zone.key}: {exc!r}"[:300], file=sys.stderr)
                continue
            with_water.append(zone)
        zones = with_water
    rows = measure(
        zones,
        args.shapes,
        distances,
        engine_planner(
            activity,
            source,
            echo=lambda line: print(line, file=sys.stderr, flush=True),
        ),
        echo=lambda line: print(line, file=sys.stderr, flush=True),
    )
    out = args.out_dir / args.label / f"{activity}.json"
    write_results(out, activity, args.label, stats, rows, git_commit())
    if stats:
        print("### Rete\n\n" + network_table(stats) + "\n")
        for key, s in stats.items():
            kinds = ", ".join(
                f"{tag} {comma(km, 1)}" for tag, km in s.km_by_tag.items()
            )
            print(f"- {key}, km per `highway`: {kinds}")
        print()
    print("### Forme\n\n" + shapes_table(rows) + "\n")
    print("### Percorsi\n\n" + routes_table(rows))
    print(f"\nWrote {out}", file=sys.stderr)
    return 0


def _compare(args: argparse.Namespace) -> int:
    changes = compare(read_rows(args.before), read_rows(args.after))
    for change in changes:
        print(
            f"{change.zone} {change.shape} {change.target_m / 1000:g} km: "
            f"{change.what}"
        )
    print(f"{len(changes)} worse" if changes else "Nothing worse.")
    return 1 if changes else 0


def _zones(_: argparse.Namespace) -> int:
    for zone in ZONES:
        water = "" if zone.water_start is None else f", water {zone.water_start}"
        print(f"{zone.key:10} {zone.name} ({zone.kind}): {zone.start}{water}")
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    zones = commands.add_parser("zones", help="list the fixed zones")
    zones.set_defaults(func=_zones)
    run = commands.add_parser("run", help="measure an activity on the zones")
    run.add_argument("--activity", required=True, help="e.g. running, cycling")
    run.add_argument(
        "--zones", nargs="+", default=[z.key for z in ZONES], choices=ZONES_BY_KEY
    )
    run.add_argument("--shapes", nargs="+", default=list(DEFAULT_SHAPES))
    run.add_argument("--distances", nargs="+", type=int, help="in metres")
    run.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    run.add_argument("--loader", help="FILE:FUNCTION, a network not registered yet")
    run.add_argument("--label", required=True, help="the folder of the results")
    run.add_argument("--out-dir", type=Path, default=OUT_DIR)
    run.set_defaults(func=_run)
    compared = commands.add_parser("compare", help="what got worse between two runs")
    compared.add_argument("before", type=Path)
    compared.add_argument("after", type=Path)
    compared.set_defaults(func=_compare)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
