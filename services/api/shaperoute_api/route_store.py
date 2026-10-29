"""A city's examples, drawn once and kept for whoever asks next.

In "Explore" every phone asks the same of a city: a heart, a circle and a
star of 5 km from its centre (exampleRoutes.ts). The engine draws the same
routes each time, some seconds each on the PC and many more on the server,
one after the other. Here a route drawn from a city's centre is kept in a
file, and the same request is answered from it at once, as a job already
done: only the first phone in a city waits.

Only from a city's centre. A request carries where the user is; keeping
every route is the user's choice of ADR-0086, and belongs to TASK-092, in
the database, with the rules on personal data still to write. Until then
the API keeps no one's position (ADR-0085, ADR-0092), and a city's centre is
no one's position. TASK-092 can take this over: RouteJobs calls `put` for
every route that ends, and here the ones from elsewhere are dropped.

The centres are those the API itself gave to GET /cities and GET
/city-suggestions, and a start is one of them when it falls in the same
square of about 10 m (4 decimals, as the app's `cityKey`). A route from
anywhere else is never written, and an image's outline neither.

The same request: the same shape or word, style, distance and activity, the
pen up or not, from the same centre, drawn by the same engine. A route is
drawn again after KEEP_S, for the roads that changed, and at once when the
engine's code is another: its fingerprint is part of the name of the file.

On the water (TASK-246 part B): the points of the app's lists of lakes and
beaches (water_spots.py) are centres too, given when the API starts. A
phone asks the eight shapes of the three points nearest it from the points
themselves, and a point of a list is no one's position. Their routes are in
a folder of their own with a limit of its own: the lists' eight shapes are
many more routes than the cities', and much lighter, and drawing them all
must not push a city's examples out.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections.abc import Callable, Iterable
from dataclasses import asdict
from pathlib import Path
from typing import Any

import route_engine
from route_engine.directions import Direction
from route_engine.models import RouteRequest, RouteResult

log = logging.getLogger(__name__)

LatLon = tuple[float, float]

# Beside the zones, in the folder the server already keeps (deploy/): a route
# kept is a cache as they are, and their file names never match (`foot_*`).
STORE_FOLDER = "routes"
CENTRES_FILE = "city-centres.txt"
# Inside STORE_FOLDER: the routes from a point on the water.
WATER_FOLDER = "water"
# After this a route is drawn again: the zone may be newer than the route.
KEEP_S = 30 * 24 * 3600.0
# About 100 kB each with its alternatives: 300 MB at most.
MAX_ROUTES = 3000
# About 10 kB each, no alternatives and no directions: eight shapes of
# about 800 points of the lists, with room for more, 100 MB at most.
MAX_WATER_ROUTES = 10_000
# Six centres for each few letters typed (GET /city-suggestions): the oldest
# are forgotten, and found again when someone types that city.
MAX_CENTRES = 50_000
# 4 decimals: 11 m of latitude, the app's `cityKey`.
CELL_DECIMALS = 4
# Files of the engine that draw no route: the way back to a route
# (TASK-314, ADR-0274). Changing them keeps the routes kept; a test fails
# when a module of the engine imports one.
NOT_ROUTES = frozenset({"way_back.py"})
# Files of the engine that draw only swims (TASK-323, ADR-0283): no route
# kept is a swim, so changing them keeps the routes kept; a test fails when a
# module that draws other routes imports one.
SWIM_ONLY = frozenset(
    {"shore_names.py", "swim_turns.py", "swim_water.py", "swimming.py"}
)


def engine_fingerprint(folder: Path | None = None) -> str:
    """The engine's code and outlines, as a few letters: another engine,
    other routes. From the files' content, not their dates: a new image of
    the same code keeps what it drew. `folder`: the engine's own."""
    folder = Path(route_engine.__file__).parent if folder is None else folder
    digest = hashlib.sha256()
    for path in sorted(folder.rglob("*")):
        if path.relative_to(folder).as_posix() in NOT_ROUTES | SWIM_ONLY:
            continue
        if path.suffix in (".py", ".json") and path.is_file():
            digest.update(path.relative_to(folder).as_posix().encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def cell(point: LatLon) -> str:
    """The square of about 10 m `point` falls in: "45.8906,11.0401"."""
    return f"{point[0]:.{CELL_DECIMALS}f},{point[1]:.{CELL_DECIMALS}f}"


def result_from(data: dict[str, Any]) -> RouteResult:
    """A RouteResult as `asdict` wrote it, read from JSON: points are pairs
    again. Raises on anything else: the file is then as not kept."""
    return RouteResult(
        points=[_pair(point) for point in data["points"]],
        distance_m=float(data["distance_m"]),
        similarity=float(data["similarity"]),
        shape=data["shape"],
        warnings=[str(warning) for warning in data["warnings"]],
        directions=[
            Direction(**{**direction, "point": _pair(direction["point"])})
            for direction in data["directions"]
        ],
        word=data["word"],
        alternatives=[result_from(other) for other in data["alternatives"]],
        # Kept before TASK-197: none.
        walks=[(int(a), int(b)) for a, b in data.get("walks", [])],
        # Kept before TASK-206 part B: none.
        on_foot=[(int(a), int(b)) for a, b in data.get("on_foot", [])],
        # Kept before TASK-234, or without advice: none (TASK-232 noticed
        # it was dropped, and «Try N km» with it, on a repeated request).
        better_distance_m=(
            None
            if data.get("better_distance_m") is None
            else int(data["better_distance_m"])
        ),
        # Kept before TASK-238, or on the roads: none.
        centre=None if data.get("centre") is None else _pair(data["centre"]),
        # Kept before TASK-232: upright.
        rotation_deg=float(data.get("rotation_deg", 0.0)),
    )


def _pair(point: Any) -> LatLon:
    lat, lon = point
    return float(lat), float(lon)


class RouteStore:
    def __init__(
        self,
        directory: Path,
        engine: str | None = None,
        keep_s: float = KEEP_S,
        max_routes: int = MAX_ROUTES,
        max_centres: int = MAX_CENTRES,
        clock: Callable[[], float] = time.time,
        water: Iterable[LatLon] = (),
        max_water_routes: int = MAX_WATER_ROUTES,
    ) -> None:
        self._directory = directory
        self._engine = engine_fingerprint() if engine is None else engine
        self._keep_s = keep_s
        self._max_routes = max_routes
        self._max_centres = max_centres
        self._clock = clock
        self._lock = threading.Lock()
        # In the order they were learned: a dict keeps it, a set does not.
        self._centres: dict[str, None] = dict.fromkeys(self._read_centres())
        # The points on the water: never written, never forgotten.
        self._water = frozenset(map(cell, water))
        self._max_water_routes = max_water_routes

    def __len__(self) -> int:
        """The routes kept from a city's centre."""
        return sum(1 for _ in self._directory.glob("*.json"))

    @property
    def water_points(self) -> int:
        """The points on the water a route may be kept from."""
        return len(self._water)

    def kept_on_water(self) -> int:
        """The routes kept from a point on the water."""
        return sum(1 for _ in self._water_directory.glob("*.json"))

    def learn(self, centres: Iterable[LatLon]) -> None:
        """Centres the API gave for a city: a route from one may be kept."""
        with self._lock:
            new = [
                c for c in dict.fromkeys(map(cell, centres)) if c not in self._centres
            ]
            if not new:
                return
            self._centres.update(dict.fromkeys(new))
            try:
                self._directory.mkdir(parents=True, exist_ok=True)
                if len(self._centres) > self._max_centres:
                    # The newest half, written again: the file stays small.
                    kept = list(self._centres)[-(self._max_centres // 2) :]
                    self._centres = dict.fromkeys(kept)
                    self._centres_path.write_text("".join(f"{c}\n" for c in kept))
                else:
                    with self._centres_path.open("a") as file:
                        file.writelines(f"{c}\n" for c in new)
            except OSError as exc:
                # Known until the API restarts: the routes are kept anyway.
                log.warning("city centres not written: %s", type(exc).__name__)

    def get(self, request: object) -> RouteResult | None:
        """The route kept for `request`, or None: never asked, from no
        city's centre nor point on the water, too old, drawn by another
        engine, or not readable."""
        path = self._path(request)
        if path is None:
            return None
        try:
            text = path.read_text()
        except OSError:
            return None  # never asked, or the folder is not there
        try:
            data = json.loads(text)
            if self._clock() - float(data["saved_at"]) <= self._keep_s:
                return result_from(data["result"])
        except Exception as exc:
            # Half written, or of a model that changed: drawn again.
            log.warning("kept route %s not readable: %s", path.name, type(exc).__name__)
        path.unlink(missing_ok=True)
        return None

    def put(self, request: object, result: RouteResult) -> bool:
        """Keeps `result` when `request` starts from a city's centre or a
        point on the water; says whether it did. Never raises: without the
        file the route is drawn again."""
        path = self._path(request)
        if path is None or not isinstance(request, RouteRequest):
            return False
        on_water = cell(request.start) in self._water
        with self._lock:
            if not on_water and cell(request.start) not in self._centres:
                return False
        kept = {
            "saved_at": self._clock(),
            "engine": self._engine,
            "request": self._same(request),
            "result": asdict(result),
        }
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            # Whole or not at all: a reader never finds half a file.
            draft = path.with_suffix(f".{threading.get_ident()}.tmp")
            draft.write_text(json.dumps(kept, separators=(",", ":")))
            draft.replace(path)
            if on_water:
                self._forget_oldest(self._water_directory, self._max_water_routes)
            else:
                self._forget_oldest(self._directory, self._max_routes)
        except (OSError, TypeError, ValueError) as exc:
            log.warning("route not kept: %s", type(exc).__name__)
            return False
        return True

    @property
    def _water_directory(self) -> Path:
        return self._directory / WATER_FOLDER

    @property
    def _centres_path(self) -> Path:
        return self._directory / CENTRES_FILE

    def _read_centres(self) -> list[str]:
        try:
            return self._centres_path.read_text().split()
        except OSError:
            return []

    def _same(self, request: RouteRequest) -> dict[str, Any]:
        """What makes two requests the same one. The pen up only when asked
        (TASK-197): the others keep the names they had."""
        same: dict[str, Any] = {
            "shape": request.shape,
            "word": request.word,
            "style": request.style,
            "distance_m": request.distance_m,
            "activity": request.activity,
            "start": cell(request.start),
        }
        if request.pen_up:
            same["pen_up"] = True
        return same

    def _path(self, request: object) -> Path | None:
        if not isinstance(request, RouteRequest):
            return None  # an image: its outline is the user's own
        if request.near is not None:
            return None  # a shape moved by the user (TASK-238): theirs too
        same = json.dumps([self._engine, self._same(request)], sort_keys=True)
        name = hashlib.sha256(same.encode()).hexdigest()[:24]
        on_water = cell(request.start) in self._water
        folder = self._water_directory if on_water else self._directory
        return folder / f"{name}.json"

    def _forget_oldest(self, folder: Path, most: int) -> None:
        paths = list(folder.glob("*.json"))
        if len(paths) <= most:
            return

        def written(path: Path) -> float:
            try:
                return path.stat().st_mtime
            except OSError:
                return 0.0

        for path in sorted(paths, key=written)[: len(paths) - most]:
            path.unlink(missing_ok=True)
