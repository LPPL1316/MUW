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
"""

from __future__ import annotations

import logging
import math
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import networkx as nx
import psycopg
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from route_engine.directions import guidance
from route_engine.geo import LatLon, local_to_latlon, path_length_m
from route_engine.models import WATER_ACTIVITIES, RouteRequest, RouteResult
from route_engine.nearby_starts import APPROACH_MAX_M, NEARBY_MAX_M
from route_engine.network import (
    BBox,
    Graph,
    nearest_nodes,
    on_foot_stretches,
    one_way_streets,
    step_cost,
)
from route_engine.optimizer import GraphLoader
from route_engine.route_nodes import RouteNotOnGraphError, nodes_along

from shaperoute_api.alongs import NamedRoads, with_alongs
from shaperoute_api.best_routes import line_key
from shaperoute_api.db import Database
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
    " start, route, result, similarity, line_key"
)
# A point as PostGIS reads it, from (lon, lat) parameters.
POINT = "ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography"


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
    ) -> None:
        self._database = database
        self._behind = behind
        self._engine = engine_fingerprint() if engine is None else engine
        self._keep_s = keep_s
        self._max_routes = max_routes
        self._clock = clock or (lambda: datetime.now(UTC))

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
        its alternatives; None without one. psycopg.Error and the zone's
        own errors are the caller's (jobs.RouteJobs)."""
        if not _kept(request) or request.activity in WATER_ACTIVITIES:
            return None
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
        kept = self._behind is not None and self._behind.put(request, result)
        if not _kept(request):
            return kept
        rows = [result, *result.alternatives]
        try:
            with self._database.connect() as conn:
                for each in rows:
                    self._insert(conn, request, replace(each, alternatives=[]))
                self._prune(conn)
        except (psycopg.Error, TypeError, ValueError) as exc:
            log.warning("route not archived: %s", type(exc).__name__)
            return kept
        return True

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
        self, conn: psycopg.Connection[Any], request: RouteRequest, result: RouteResult
    ) -> None:
        """The row of `result`, unless the same line is there already for
        the same request. The start kept is the one asked for: the route
        begins at the road node nearest to it, which may be tens of metres
        away, and the next request from the same spot asks from the spot."""
        lat, lon = request.start
        conn.execute(
            f"INSERT INTO drawn_routes ({COLUMNS})"
            " SELECT %(drawn_at)s, %(engine)s, %(shape)s, %(word)s, %(style)s,"
            f" %(distance_m)s, %(activity)s, %(pen_up)s, {POINT},"
            " ST_GeomFromText(%(wkt)s, 4326), %(result)s, %(similarity)s,"
            " %(line_key)s"
            " WHERE NOT EXISTS (SELECT 1 FROM drawn_routes"
            " WHERE engine = %(engine)s AND line_key = %(line_key)s"
            " AND activity = %(activity)s AND distance_m = %(distance_m)s"
            " AND shape IS NOT DISTINCT FROM %(shape)s"
            " AND word IS NOT DISTINCT FROM %(word)s"
            " AND style = %(style)s AND pen_up = %(pen_up)s)",
            {
                **self._key(request),
                "drawn_at": self._clock(),
                "lat": lat,
                "lon": lon,
                "wkt": _wkt(result.points),
                "result": Jsonb(asdict(result)),
                "similarity": result.similarity,
                "line_key": line_key(result.points),
            },
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


def _kept(request: object) -> bool:
    """A shape or a word, not moved by hand: what the archive keeps. An
    image's outline is the user's own (ADR-0136)."""
    return isinstance(request, RouteRequest) and request.near is None


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
