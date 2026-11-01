"""POST /phone-zones/{network}/places: a place the user keeps on the phone
(TASK-334, ADR-0290).

In «Settings» → «Offline maps» the user adds a town by name, and the phone
asks here whether the server has its zone: PLACE_MARGIN_M around the place,
as the zone around the phone of TASK-214 part E. When it has, the answer is
`ready`, and the phone downloads it from GET /phone-zones as any other zone.
When it has not, the server prepares it: one place at a time, downloaded
from Overpass as a route would (OsmnxSource.load), with the street names
for the foot network, then the phone's file. Meanwhile the answer is
`preparing`, and the phone asks again.

Overpass refuses an address after a few large downloads (MAPS.md): each
phone gets PLACES_A_DAY new zones a day and the server SERVER_PLACES_A_DAY
in all; beyond, 429 with Retry-After until midnight UTC (the TrafficCap of
TASK-214 part A2, counting zones instead of bytes). A place whose download
failed is refused with 503 for FAILED_FOR_S, then it may be asked again.

A place is prepared only while the API draws no route (RouteWork): the
night run of draw_examples asks and follows its route jobs one after the
other, as a phone does, so no place starts while it runs, nor while a phone
waits for its route; the place waits for QUIET_S without one. PAUSE_FILE in
the cache folder holds them too, for a heavy job outside the API
(prefetch_zones, phone_zone_api). Asked meanwhile, a place is `preparing`.

The queue is in memory, as the cap: a restart forgets it, and the phone,
asking again, puts its place back.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from collections import deque
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from route_engine.geo import LatLon
from route_engine.network import (
    FILTERS,
    FOOT_NETWORK_NAME,
    BBox,
    OsmnxSource,
    area_around,
)
from starlette.middleware.base import RequestResponseEndpoint

from shaperoute_api.access import refuse
from shaperoute_api.phone_zone_cap import TrafficCap, phone_of
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

# The room the phone asks for around itself (part E, AROUND_MARGIN_M): a
# route of up to 8 km on foot from anywhere near the place fits in it.
PLACE_MARGIN_M = 6000.0
# The user's choice of 2026-10-29: three new places a day for each phone.
PLACES_A_DAY = 3
# Decided by the agent: each zone is two Overpass requests of a few tens of
# MB, beside the routes' own, and Overpass allows about 1 GB a day.
SERVER_PLACES_A_DAY = 20
# After a download that failed (Overpass busy or refusing, no roads there).
FAILED_FOR_S = 3600
# Decided by the agent: no place starts until the API has had no route job
# asked or followed for this long. draw_examples asks the next as soon as
# one ends, a phone follows its own every second.
QUIET_S = 120.0
# How often a place held back looks again.
LOOK_AGAIN_S = 30.0
# Present in the cache folder, it holds every place (touch it, remove it).
PAUSE_FILE = "places.pause"
# The requests of a route being drawn.
ROUTE_PATHS = "/route-jobs"
UNKNOWN_NETWORK = f"Unknown network; one of: {', '.join(FILTERS)}."
ENOUGH_TODAY = "Enough new places prepared today: try again tomorrow."
NOT_NOW = "The map of this place could not be prepared now: try again later."

State = Literal["ready", "preparing", "failed", "refused"]
# Downloads the zone of `bbox` into the source's cache.
Download = Callable[[OsmnxSource, BBox], object]
# Writes the phone's file of a cached zone (phone_zone_api.phone_file).
Finish = Callable[[OsmnxSource, Path], object]


class PlaceBody(BaseModel):
    lat: Annotated[float, Field(ge=-90, le=90)]
    lon: Annotated[float, Field(ge=-180, le=180)]


class PlaceAnswer(BaseModel):
    state: Literal["ready", "preparing"]


class RouteWork:
    """When the API last had a route job asked or followed (ROUTE_PATHS)."""

    def __init__(
        self, quiet_s: float = QUIET_S, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._quiet_s = quiet_s
        self._clock = clock
        self._last = -math.inf

    def seen(self) -> None:
        self._last = self._clock()

    def busy(self) -> bool:
        """True until QUIET_S have gone by without a route request."""
        return self._clock() - self._last < self._quiet_s


def watch_route_work(app: FastAPI, work: RouteWork) -> None:
    """Tells `work` of every request of a route job, before it is answered."""

    @app.middleware("http")
    async def note_route_work(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path.startswith(ROUTE_PATHS):
            work.seen()
        return await call_next(request)


def download_zone(source: OsmnxSource, bbox: BBox) -> None:
    """The zone of `bbox` from Overpass, saved in the cache as a route saves
    it; on foot also its street names (ADR-0057), which a route never waits
    for. A zone without names is still a zone: their failure is only told."""
    source.load(bbox)
    if source.network_name == FOOT_NETWORK_NAME:
        try:
            source.named_roads(bbox)
        except Exception:
            log.warning("street names of the place %s not downloaded", bbox)


class PlaceBuilds:
    """The places being prepared, one at a time, the oldest first.

    With `background` False nothing runs by itself: `work_once` prepares
    the next place (the tests)."""

    def __init__(
        self,
        cache_dir: Path,
        finish: Finish,
        cap: TrafficCap | None = None,
        download: Download = download_zone,
        clock: Callable[[], float] = time.monotonic,
        background: bool = True,
        busy: Callable[[], bool] = lambda: False,
    ) -> None:
        self._cache_dir = cache_dir
        self._busy_now = busy
        self._finish = finish
        self._cap = (
            cap
            if cap is not None
            else TrafficCap(per_phone=PLACES_A_DAY, total=SERVER_PLACES_A_DAY)
        )
        self._download = download
        self._clock = clock
        self._background = background
        self._queue: deque[tuple[str, BBox]] = deque()
        self._busy: tuple[str, BBox] | None = None
        self._failed: dict[tuple[str, BBox], float] = {}
        self._lock = threading.Lock()
        self._wake = threading.Condition(self._lock)
        self._worker: threading.Thread | None = None

    def source(self, network: str) -> OsmnxSource:
        return OsmnxSource(self._cache_dir, network, FILTERS[network])

    def ask(self, network: str, point: LatLon, phone: str) -> tuple[State, int]:
        """The place's state, with the seconds to wait when it is `failed`
        or `refused`. A place neither ready nor waiting is queued, when the
        phone and the server have room for it today."""
        bbox = area_around([point], PLACE_MARGIN_M)
        if self.source(network).covering_path(bbox) is not None:
            return "ready", 0
        key = (network, bbox)
        with self._lock:
            if key == self._busy or key in self._queue:
                return "preparing", 0
            until = self._failed.get(key, 0.0)
            if self._clock() < until:
                return "failed", math.ceil(until - self._clock())
            wait = self._cap.take(phone, 1)
            if wait > 0:
                return "refused", wait
            self._queue.append(key)
            self._failed.pop(key, None)
            self._wake.notify()
            if self._background and self._worker is None:
                self._worker = threading.Thread(
                    target=self._work, name="place-zones", daemon=True
                )
                self._worker.start()
        # Never the box: it is a place someone keeps (TASK-363).
        log.info("place zone %s queued", network)
        return "preparing", 0

    def held(self) -> bool:
        """True while no place may start: routes are being drawn, or
        PAUSE_FILE is there."""
        return self._busy_now() or (self._cache_dir / PAUSE_FILE).exists()

    def work_once(self) -> bool:
        """Prepares the oldest place waiting; False when none is, or while
        the places are held."""
        if self.held():
            return False
        with self._lock:
            if not self._queue:
                return False
            key = self._busy = self._queue.popleft()
        self._prepare(*key)
        with self._lock:
            self._busy = None
        return True

    def _work(self) -> None:
        while True:
            with self._lock:
                while not self._queue:
                    self._wake.wait()
            if self.held():
                time.sleep(LOOK_AGAIN_S)
                continue
            self.work_once()

    def _prepare(self, network: str, bbox: BBox) -> None:
        source = self.source(network)
        started = time.perf_counter()
        try:
            # A route may have brought a zone holding it meanwhile.
            if source.covering_path(bbox) is None:
                self._download(source, bbox)
            zone = source.covering_path(bbox)
            if zone is None:
                raise RuntimeError("no zone saved for the place")
            self._finish(source, zone)
        except Exception:
            log.exception("place zone %s not prepared", network)
            with self._lock:
                self._failed[(network, bbox)] = self._clock() + FAILED_FOR_S
            return
        log.info(
            "place zone %s prepared in %.1f s",
            network,
            time.perf_counter() - started,
        )


def place_routes(builds: PlaceBuilds) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/phone-zones/{network}/places",
        response_model=PlaceAnswer,
        responses={
            202: {"model": PlaceAnswer, "description": "Being prepared."},
            404: {"model": ErrorBody},
            429: {"model": ErrorBody, "description": ENOUGH_TODAY},
            503: {"model": ErrorBody, "description": NOT_NOW},
        },
    )
    def keep_place(
        request: Request, network: str, place: PlaceBody, response: Response
    ) -> PlaceAnswer | JSONResponse:
        if network not in FILTERS:
            raise HTTPException(404, UNKNOWN_NETWORK)
        state, wait = builds.ask(network, (place.lat, place.lon), phone_of(request))
        if state == "refused":
            return refuse(
                429, "too_many_requests", ENOUGH_TODAY, **{"Retry-After": str(wait)}
            )
        if state == "failed":
            return refuse(
                503, "map_data_unavailable", NOT_NOW, **{"Retry-After": str(wait)}
            )
        response.status_code = 200 if state == "ready" else 202
        return PlaceAnswer(state=state)

    return router
