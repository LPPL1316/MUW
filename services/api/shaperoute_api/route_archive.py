"""Every route the engine drew, kept for whoever asks the same nearby
(TASK-297 part A, ADR-0256).

Keeping all the routes generated is the user's choice (ADR-0086). Until now
the API kept a route only from a city's centre or a point on the water
(route_store.py, ADR-0136): a request carries where the user is, and the
API kept no one's position. Here every route that ends goes in the
database, **without who asked it**: a drawn route is everyone's, and
deleting an account touches nothing here.

The same request (route_store._same: the shape or the word, the style, the
distance, the activity, the pen up or not), drawn by the same engine, less
than KEEP_S ago:

- from within EXACT_M of its start, the row answers at once (`get`), as a
  city's example does: a job already done in the POST;
- from within NEARBY_M, the distance the engine tries its nearby starts at
  (ADR-0071), the kept route is reached along the roads from the user's
  start and left the same way (`reach`), as `with_approach` does for an
  alternative: the zone is loaded, the engine does not run. That takes
  the seconds of a zone, so `nearby` is asked in the job's thread
  (jobs.FindsNearby), not in the POST. Not on the water: no roads there.

Several rows good: first the one most run and most kept among the
favorites (`runs` and `favorites`, counted by the line's name from
activities.py and favorites.py, never by whom), then the most similar,
then the nearest; the others are the alternatives.

Never kept: an image's outline (the user's own) and a shape moved by hand
on the water (`near`), as in route_store. The file store stays behind this
one: `get` asks it when no row answers, `put` writes to both (the files
keep what starts from a centre or a point on the water, and drop the
rest). Over MAX_ROUTES rows, the oldest never run nor kept go first.

A row keeps where the engine placed its route, too (`put_plan`, TASK-297
part A2): the start, turn, phase and scale of the search near the start.
After the engine changes, or KEEP_S later, the rows no longer answer; then
`nearby` draws the best good one again from its own start, the engine
trying its placement first (optimizer.search's `first`): the same
placement from the same start drew the same route 36 times out of 36,
with a trace or two (ADR-0257). It is the API's planner otherwise, nearby
starts and alternatives included, and goes on as without the placement
when that is no longer good. The route is kept, and reached from the
user's start as any row nearby.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import networkx as nx
import psycopg
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from route_engine.directions import guidance
from route_engine.geo import LatLon, local_to_latlon, path_length_m
from route_engine.models import WATER_ACTIVITIES, RouteRequest, RouteResult
from route_engine.nearby_starts import (
    APPROACH_MAX_M,
    NEARBY_MAX_M,
    NearbyPlan,
    ShapeJob,
    plan_nearby,
)
from route_engine.network import (
    BBox,
    Graph,
    nearest_nodes,
    on_foot_stretches,
    one_way_streets,
    step_cost,
)
from route_engine.optimizer import (
    SIMILARITY_THRESHOLD,
    GraphLoader,
    Placement,
    Plan,
    ShapeNotDrawableError,
    plan_shape,
)
from route_engine.route_nodes import RouteNotOnGraphError, nodes_along

from shaperoute_api.alongs import NamedRoads, with_alongs
from shaperoute_api.best_routes import line_key
from shaperoute_api.db import Database
from shaperoute_api.job_times import noted
from shaperoute_api.jobs import with_choices
from shaperoute_api.route_store import KEEP_S, engine_fingerprint, result_from

log = logging.getLogger(__name__)

# The same start: about the square of 10 m of route_store.cell.
EXACT_M = 10.0
# A kept route this far away is reached along the roads, as a nearby start
# is (ADR-0071), when the way to it is at most APPROACH_M.
NEARBY_M = NEARBY_MAX_M
APPROACH_M = APPROACH_MAX_M
# About 50 kB a row with its directions: 2.5 GB at most. Over it the oldest
# rows never run nor kept go, a hundredth more than needed, so the cleaning
# does not run at every route.
MAX_ROUTES = 50_000
# The rows looked at for one request: the answer and its alternatives, as
# many as the nearby starts give (nearby_starts.NEARBY_COUNT).
MAX_ALTERNATIVES = 3
# The zone is cut this far around the routes and the start, as for the
# directions of a route of "Explore" (line_directions.MARGIN_M).
MARGIN_M = 250.0

COLUMNS = (
    "drawn_at, engine, shape, word, style, distance_m, activity, pen_up,"
    " start, route, result, similarity, line_key,"
    " placed_start, offset_m, rotation_deg, phase, scale_m"
)
# A point as PostGIS reads it, from (lon, lat) parameters.
POINT = "ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography"
PLACED = "ST_SetSRID(ST_MakePoint(%(placed_lon)s, %(placed_lat)s), 4326)::geography"

# Where the engine placed a route and at what scale (optimizer.Placement,
# Attempt.scale_m).
Placed = tuple[Placement, float]
# The API's planner for a shape or a word, from a start and its nearby
# ones (nearby_starts.plan_nearby, images.plan_request).
PlansNearby = Callable[[ShapeJob, LatLon, GraphLoader], NearbyPlan]


class Behind(Protocol):
    """The store the archive keeps behind it (route_store.RouteStore)."""

    def get(self, request: object) -> RouteResult | None: ...
    def put(self, request: object, result: RouteResult) -> bool: ...


class RouteArchive:
    def __init__(
        self,
        database: Database,
        behind: Behind | None = None,
        engine: str | None = None,
        keep_s: float = KEEP_S,
        max_routes: int = MAX_ROUTES,
        clock: Callable[[], datetime] | None = None,
        plans_nearby: PlansNearby = plan_nearby,
    ) -> None:
        self._database = database
        self._behind = behind
        self._engine = engine_fingerprint() if engine is None else engine
        self._keep_s = keep_s
        self._max_routes = max_routes
        self._clock = clock or (lambda: datetime.now(UTC))
        self._plans_nearby = plans_nearby

    def learn(self, centres: Iterable[LatLon]) -> None:
        """The city centres the files keep routes from (route_store.learn):
        theirs to learn, nothing here."""
        learn = getattr(self._behind, "learn", None)
        if learn is not None:
            learn(centres)

    def get(self, request: object) -> RouteResult | None:
        """The route kept for `request` from the same start, at once and
        without the roads; else what the store behind keeps, or None."""
        if _kept(request):
            try:
                rows = self._rows(request, EXACT_M)
            except psycopg.Error as exc:
                log.warning("archive not read: %s", type(exc).__name__)
                rows = []
            if rows:
                return _answer(rows)
        return None if self._behind is None else self._behind.get(request)

    def nearby(
        self,
        request: object,
        source: GraphLoader,
        named_roads: NamedRoads | None = None,
    ) -> RouteResult | None:
        """The best route kept within NEARBY_M of the start, reached along
        the roads of the zone `source` gives, with the others reached as
        its alternatives; None without one. Without one by this engine, a
        route of before drawn again first (`_draw_again`). psycopg.Error
        and the zone's own errors are the caller's (jobs.RouteJobs)."""
        if not _kept(request) or request.activity in WATER_ACTIVITIES:
            return None
        rows = self._rows(request, NEARBY_M)
        if not rows and self._draw_again(request, source, named_roads):
            rows = self._rows(request, NEARBY_M)
        if not rows:
            return None
        kept = [(row, result_from(row["result"])) for row in rows]
        around = [request.start, *(p for _, result in kept for p in result.points)]
        graph = source.load(_bbox(around))
        reached: list[tuple[DictRow, RouteResult]] = []
        for row, result in kept:
            found = reach(graph, request.start, result, named_roads)
            if found is not None:
                reached.append((row, found))
        if not reached:
            return None
        (row, best), others = reached[0], reached[1:]
        log.info("kept route reached from %.0f m away", row["away_m"])
        return replace(
            best, alternatives=[other for _, other in others[:MAX_ALTERNATIVES]]
        )

    def put(self, request: object, result: RouteResult) -> bool:
        """Keeps `result` and each of its alternatives as a row, for a shape
        or a word not moved by hand; the store behind keeps what it keeps.
        Says whether anyone did. Never raises: without the row the route is
        drawn again."""
        return self._put(request, result, [])

    def put_plan(self, request: object, result: RouteResult, plan: Plan) -> bool:
        """`put`, each row with where the engine placed its route when the
        search near the start did (`placed_by`): `plan` is the one `result`
        and its alternatives come from (jobs.with_choices), in their order
        (jobs.KeepsPlacements)."""
        placed: list[Placed | None] = []
        if isinstance(request, RouteRequest):
            placed = [placed_by(request, p) for p in [plan, *plan.alternatives]]
        return self._put(request, result, placed)

    def _put(
        self, request: object, result: RouteResult, placed: Sequence[Placed | None]
    ) -> bool:
        kept = self._behind is not None and self._behind.put(request, result)
        if not _kept(request):
            return kept
        rows = [result, *result.alternatives]
        try:
            with self._database.connect() as conn:
                for i, each in enumerate(rows):
                    where = placed[i] if i < len(placed) else None
                    self._insert(conn, request, replace(each, alternatives=[]), where)
                self._prune(conn)
        except (psycopg.Error, TypeError, ValueError) as exc:
            log.warning("route not archived: %s", type(exc).__name__)
            return kept
        return True

    def _draw_again(
        self,
        request: RouteRequest,
        source: GraphLoader,
        named_roads: NamedRoads | None,
    ) -> bool:
        """The best good route kept within NEARBY_M by another engine, or
        longer ago than KEEP_S, with its placement (`_stale`), drawn again
        from its own start by this engine, as the API's planner draws it but
        trying that placement first (ADR-0256, point 6); kept with its
        alternatives (`put_plan`). Says whether it was. Its start is someone
        else's, as for a route reached nearby: `nearby` then reaches it from
        `request`'s start. A shape this engine cannot draw there is left to
        the planner, from the user's start."""
        row = self._stale(request)
        if row is None:
            return False
        asked = replace(request, start=(row["lat"], row["lon"]))
        offset_m = float(row["offset_m"])
        first = Placement(
            # The start itself when not moved, as the search places it.
            asked.start if offset_m == 0 else (row["placed_lat"], row["placed_lon"]),
            offset_m,
            float(row["rotation_deg"]),
            float(row["phase"]),
        )
        job = replace(
            _FromPlacement.of_request(asked),
            first=first,
            first_scale_m=float(row["scale_m"]),
        )
        loaded = _Loaded(source)
        try:
            plan = noted(source, self._plans_nearby(job, asked.start, loaded))
        except ShapeNotDrawableError as exc:
            log.info("kept route not drawn again: %s", type(exc).__name__)
            return False
        result = with_choices(plan, loaded.graphs, named_roads)
        log.info("kept route drawn again from %.0f m away", row["away_m"])
        return self.put_plan(asked, result, plan)

    def _stale(self, request: RouteRequest) -> DictRow | None:
        """The row of `request` within NEARBY_M by another engine or older
        than KEEP_S, good (SIMILARITY_THRESHOLD) and with its placement:
        the most chosen first, as `_rows`, then the newest."""
        lat, lon = request.start
        with self._database.connect() as conn:
            row: DictRow | None = conn.execute(
                "SELECT ST_Y(start::geometry) AS lat, ST_X(start::geometry) AS lon,"
                " ST_Y(placed_start::geometry) AS placed_lat,"
                " ST_X(placed_start::geometry) AS placed_lon,"
                " offset_m, rotation_deg, phase, scale_m,"
                f" ST_Distance(start, {POINT}) AS away_m"
                " FROM drawn_routes"
                " WHERE NOT (engine = %(engine)s AND drawn_at > %(since)s)"
                " AND activity = %(activity)s AND distance_m = %(distance_m)s"
                " AND shape IS NOT DISTINCT FROM %(shape)s"
                " AND word IS NOT DISTINCT FROM %(word)s"
                " AND style = %(style)s AND pen_up = %(pen_up)s"
                " AND scale_m IS NOT NULL AND similarity >= %(good)s::real"
                f" AND ST_DWithin(start, {POINT}, %(within_m)s)"
                " ORDER BY runs + favorites DESC, similarity DESC, away_m,"
                " drawn_at DESC, id"
                " LIMIT 1",
                {
                    **self._key(request),
                    "lat": lat,
                    "lon": lon,
                    "since": self._clock() - timedelta(seconds=self._keep_s),
                    "good": SIMILARITY_THRESHOLD,
                    "within_m": NEARBY_M,
                },
            ).fetchone()
        return row

    def _rows(self, request: RouteRequest, within_m: float) -> list[DictRow]:
        """The rows of `request` whose start is within `within_m` of its
        start, the most chosen first."""
        lat, lon = request.start
        with self._database.connect() as conn:
            return conn.execute(
                "SELECT id, result, runs, favorites,"
                f" ST_Distance(start, {POINT}) AS away_m"
                " FROM drawn_routes"
                " WHERE engine = %(engine)s AND activity = %(activity)s"
                " AND distance_m = %(distance_m)s"
                " AND shape IS NOT DISTINCT FROM %(shape)s"
                " AND word IS NOT DISTINCT FROM %(word)s"
                " AND style = %(style)s AND pen_up = %(pen_up)s"
                " AND drawn_at > %(since)s"
                f" AND ST_DWithin(start, {POINT}, %(within_m)s)"
                " ORDER BY runs + favorites DESC, similarity DESC, away_m, id"
                " LIMIT %(limit)s",
                {
                    **self._key(request),
                    "lat": lat,
                    "lon": lon,
                    "since": self._clock() - timedelta(seconds=self._keep_s),
                    "within_m": within_m,
                    "limit": 1 + MAX_ALTERNATIVES,
                },
            ).fetchall()

    def _insert(
        self,
        conn: psycopg.Connection[Any],
        request: RouteRequest,
        result: RouteResult,
        placed: Placed | None = None,
    ) -> None:
        """The row of `result`, with where the engine placed it when known.
        The start kept is the one asked for: the route begins at the road
        node nearest to it, which may be tens of metres away, and the next
        request from the same spot asks from the spot.

        The same line already there for the same request and engine is not
        kept twice: that row is drawn now (`drawn_at`), with this result and
        its placement, if any. A route of more than KEEP_S ago drawn again
        the same answers again, its runs and favorites with it."""
        lat, lon = request.start
        placement, scale_m = placed if placed is not None else (None, None)
        placed_lat, placed_lon = (None, None) if placement is None else placement.start
        values = {
            **self._key(request),
            "drawn_at": self._clock(),
            "lat": lat,
            "lon": lon,
            "wkt": _wkt(result.points),
            "result": Jsonb(asdict(result)),
            "similarity": result.similarity,
            "line_key": line_key(result.points),
            "placed_lat": placed_lat,
            "placed_lon": placed_lon,
            "offset_m": None if placement is None else placement.offset_m,
            "rotation_deg": None if placement is None else placement.rotation_deg,
            "phase": None if placement is None else placement.phase,
            "scale_m": scale_m,
        }
        drawn_again = conn.execute(
            "UPDATE drawn_routes SET drawn_at = %(drawn_at)s, result = %(result)s,"
            " similarity = %(similarity)s"
            + (
                ""
                if placement is None
                else f", placed_start = {PLACED}, offset_m = %(offset_m)s,"
                " rotation_deg = %(rotation_deg)s, phase = %(phase)s,"
                " scale_m = %(scale_m)s"
            )
            + " WHERE engine = %(engine)s AND line_key = %(line_key)s"
            " AND activity = %(activity)s AND distance_m = %(distance_m)s"
            " AND shape IS NOT DISTINCT FROM %(shape)s"
            " AND word IS NOT DISTINCT FROM %(word)s"
            " AND style = %(style)s AND pen_up = %(pen_up)s",
            values,
        ).rowcount
        if drawn_again:
            return
        conn.execute(
            f"INSERT INTO drawn_routes ({COLUMNS})"
            " VALUES (%(drawn_at)s, %(engine)s, %(shape)s, %(word)s, %(style)s,"
            f" %(distance_m)s, %(activity)s, %(pen_up)s, {POINT},"
            " ST_GeomFromText(%(wkt)s, 4326), %(result)s, %(similarity)s,"
            f" %(line_key)s, {PLACED}, %(offset_m)s, %(rotation_deg)s,"
            " %(phase)s, %(scale_m)s)",
            values,
        )

    def _prune(self, conn: psycopg.Connection[Any]) -> None:
        """Over the cap: the oldest rows never run nor kept, a hundredth of
        the cap more than needed."""
        row = conn.execute("SELECT count(*) AS n FROM drawn_routes").fetchone()
        assert row is not None
        over = int(row["n"]) - self._max_routes
        if over <= 0:
            return
        conn.execute(
            "DELETE FROM drawn_routes WHERE id IN ("
            " SELECT id FROM drawn_routes WHERE runs = 0 AND favorites = 0"
            " ORDER BY drawn_at, id LIMIT %s)",
            (over + self._max_routes // 100,),
        )

    def _key(self, request: RouteRequest) -> dict[str, Any]:
        """What makes two requests the same one (route_store._same)."""
        return {
            "engine": self._engine,
            "shape": request.shape,
            "word": request.word,
            "style": request.style,
            "distance_m": request.distance_m,
            "activity": request.activity,
            "pen_up": request.pen_up,
        }


def count_run(conn: psycopg.Connection[Any], key: str) -> None:
    """One more run saved along the line named `key` (best_routes.line_key):
    its rows, if any, go first for the next to ask."""
    conn.execute("UPDATE drawn_routes SET runs = runs + 1 WHERE line_key = %s", (key,))


def count_favorite(conn: psycopg.Connection[Any], key: str, delta: int) -> None:
    """One favorite more (or fewer) of the line named `key`."""
    conn.execute(
        "UPDATE drawn_routes SET favorites = greatest(0, favorites + %s)"
        " WHERE line_key = %s",
        (delta, key),
    )


def reach(
    graph: Graph,
    start: LatLon,
    result: RouteResult,
    named_roads: NamedRoads | None = None,
) -> RouteResult | None:
    """`result` run from `start`: along the roads from the start's node to
    where the route begins and, when the route closes, back the same way
    (the shortest way allowed, with one-way streets), as
    nearby_starts.with_approach does from a nearby start. The walks move
    along with the points; the directions are those of the whole line.
    None when the start is off these roads, the route is not on them, or
    the way to it is longer than APPROACH_M."""
    try:
        nodes = nodes_along(graph, result.points)
    except RouteNotOnGraphError:
        return None
    [home], [off_m] = nearest_nodes(graph, [start])
    if off_m > NEARBY_M:
        return None
    first, last = nodes[0], nodes[-1]
    try:
        approach = [home] if home == first else _shortest(graph, home, first)
    except nx.NetworkXNoPath:
        return None
    ahead = _line(graph, approach)
    if path_length_m(ahead) > APPROACH_M:
        return None
    if len(approach) < 2 or last != first:
        back = [last]
    elif one_way_streets(graph):
        try:
            back = _shortest(graph, last, home)
        except nx.NetworkXNoPath:
            return None
    else:
        back = approach[::-1]
    all_nodes = [*approach[:-1], *nodes, *back[1:]]
    points = [*ahead, *result.points[1:], *_line(graph, back)[1:]]
    shift = len(ahead) - 1
    directions = with_alongs(graph, all_nodes, guidance(graph, all_nodes), named_roads)
    return replace(
        result,
        points=points,
        distance_m=path_length_m(points),
        walks=[(a + shift, b + shift) for a, b in result.walks],
        on_foot=on_foot_stretches(graph, all_nodes),
        directions=directions,
        alternatives=[],
    )


def placed_by(request: RouteRequest, plan: Plan) -> Placed | None:
    """Where the search near `request`'s start placed the route of `plan`,
    and at what scale: what `first` draws again (optimizer.search). None
    when another search drew it: a nearby start's, whose route is then
    reached from the start (nearby_starts.with_approach), or the one 2 km
    away (ADR-0040), which takes no `first`; and on the water, or without
    a search."""
    found = plan.search
    if request.activity in WATER_ACTIVITIES or found is None or found is plan.far:
        return None
    placement = found.best.placement
    if placement.offset_m == 0 and placement.start != request.start:
        return None  # from a nearby start
    return placement, found.best.scale_m


@dataclass(frozen=True)
class _FromPlacement(ShapeJob):
    """The API's job (images.plan_request), whose plan from the start tries
    `first` first; the nearby starts plan as without (`here`). Plain data,
    as the worker processes want it."""

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
            first=self.first,
            first_scale_m=self.first_scale_m,
        )
        return self._as_asked(plan)


class _Loaded:
    """`source`, and the graphs a plan loaded from it, in order: those its
    directions are read on (jobs.with_directions)."""

    def __init__(self, source: GraphLoader) -> None:
        self._source = source
        self.graphs: list[Graph] = []

    def load(self, bbox: BBox) -> Graph:
        graph = self._source.load(bbox)
        self.graphs.append(graph)
        return graph


def _kept(request: object) -> bool:
    """A shape or a word, not moved by hand nor anchored where the user drew
    it (TASK-347): what the archive keeps. An image's outline is the user's
    own (ADR-0136)."""
    return (
        isinstance(request, RouteRequest)
        and request.near is None
        and getattr(request, "placement", "free") == "free"
    )


def _answer(rows: Sequence[DictRow]) -> RouteResult:
    """The first row's route, the others as its alternatives."""
    best, *others = (result_from(row["result"]) for row in rows)
    return replace(best, alternatives=others[:MAX_ALTERNATIVES])


def _shortest(graph: Graph, a: Any, b: Any) -> list[Any]:
    path: list[Any] = nx.shortest_path(graph, a, b, weight=step_cost)
    return path


def _line(graph: Graph, nodes: Sequence[Any]) -> list[LatLon]:
    """The points of the way along `nodes`, as the engine's routes carry
    them (network._edge_points): the first node, then those of each edge."""
    points = [_node_point(graph, nodes[0])]
    for u, v in zip(nodes, nodes[1:], strict=False):
        points.extend(_edge_points(graph, u, v))
    return points


def _node_point(graph: Graph, node: Any) -> LatLon:
    return graph.nodes[node]["y"], graph.nodes[node]["x"]


def _edge_points(graph: Graph, u: Any, v: Any) -> list[LatLon]:
    """The points of the shortest u→v edge after u, from u to v."""
    data = min(graph[u][v].values(), key=lambda d: float(d["length"]))
    start, end = _node_point(graph, u), _node_point(graph, v)
    geometry = data.get("geometry")
    if geometry is None:
        return [end]
    coords = [(lat, lon) for lon, lat in geometry.coords]
    if math.dist(coords[-1], start) < math.dist(coords[0], start):
        coords.reverse()
    return coords[1:]


def _bbox(points: Sequence[LatLon], margin_m: float = MARGIN_M) -> BBox:
    """The box of `points`, `margin_m` wider on every side."""
    lats = [lat for lat, _ in points]
    lons = [lon for _, lon in points]
    south, west = local_to_latlon((min(lats), min(lons)), -margin_m, -margin_m)
    north, east = local_to_latlon((max(lats), max(lons)), margin_m, margin_m)
    return (south, west, north, east)


def _wkt(points: Sequence[LatLon]) -> str:
    """The line as PostGIS reads it: (lon lat), every digit kept."""
    return "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in points) + ")"
