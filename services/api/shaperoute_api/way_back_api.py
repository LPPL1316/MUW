"""POST /way-back (TASK-314, ADR-0274): the way back to a route on the
streets, for a phone that cannot work it out itself (way_back.py).

A runner off the route asks again while they stay off it, at most every
few seconds (the app's WAY_BACK_EVERY_S). On top of the API's limit on every
POST (access.py), two of its own: one for each phone (its anonymous
X-Phone-Id, else its address, as phone_zone_cap.phone_of) and a wider one
for each address, which a mobile network shares among many phones. Not one
for each account: the run and its guidance work without one. Beyond
either, 429 with Retry-After, and the app keeps the straight line.
"""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from shaperoute_api.access import RateLimiter, refuse
from shaperoute_api.activity_graphs import Graphs
from shaperoute_api.phone_zone_cap import phone_of
from shaperoute_api.schemas import ErrorBody
from shaperoute_api.way_back import WayBackBody, WayBackRequestBody, find_way_back

log = logging.getLogger(__name__)

# One every 10 s from each phone: twice what the app asks.
PER_PHONE_A_MINUTE = 6
# Ten phones asking all the time behind one address.
PER_ADDRESS_A_MINUTE = 60

TOO_OFTEN = "Too many ways back asked in a minute: keep to the line for now."

RESPONSES: dict[int | str, dict[str, object]] = {
    422: {"model": ErrorBody, "description": "invalid_request: no way back"},
    429: {"model": ErrorBody, "description": "too_many_requests"},
    503: {"model": ErrorBody, "description": "map_data_unavailable"},
}


def way_back_routes(
    graphs: Graphs, clock: Callable[[], float] = time.monotonic
) -> APIRouter:
    router = APIRouter(tags=["routes"])
    phones = RateLimiter(PER_PHONE_A_MINUTE, clock=clock)
    addresses = RateLimiter(PER_ADDRESS_A_MINUTE, clock=clock)

    # A plain def: cropping the zone takes a moment, in a thread of its own.
    @router.post("/way-back", response_model=WayBackBody, responses=RESPONSES)
    def find(body: WayBackRequestBody, request: Request) -> WayBackBody | JSONResponse:
        address = request.client.host if request.client else "unknown"
        wait = addresses.wait_s(address) or phones.wait_s(phone_of(request))
        if wait > 0:
            # Told apart from the 429 of access.py, the limit on every POST.
            log.info("way back refused: asked again in %.0f s", wait)
            return refuse(
                429,
                "too_many_requests",
                TOO_OFTEN,
                **{"Retry-After": str(math.ceil(wait))},
            )
        started = time.perf_counter()
        way = find_way_back(graphs, body)
        log.info(
            "way back of %.0f m, %d directions, in %.2f s",
            way.distance_m,
            len(way.directions),
            time.perf_counter() - started,
        )
        return WayBackBody.of(way)

    return router


def install_way_back(app: FastAPI, graphs: Graphs) -> None:
    """POST /way-back on the graphs the routes are drawn on; the API's
    exception handlers answer its errors."""
    app.include_router(way_back_routes(graphs))
