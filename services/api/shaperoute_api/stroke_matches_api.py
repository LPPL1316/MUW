"""POST /stroke-matches and its probe (TASK-347 part A, ADR-0300): the
route of stroke_matches.py, which also runs on the phone without FastAPI.

The app draws by hand on the map (TASK-331) and, as the finger lifts, sends
each stroke here, or to the engine on the phone first (part B): the engine's
`snap_stroke` gives the roads that draw it, how far each drawn point is from
them, and whether the stroke is off the roads altogether. Synchronous and
small: one stroke is a few km and traced once, no search.

An app newer than its server must never send a stroke nobody matches: like
GET /feedback (TASK-308), GET /stroke-matches answers 204 here and 404 on a
server of before TASK-347, and the app asks only after that.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, FastAPI, Response
from route_engine.stroke_match import stroke_length_m

from shaperoute_api.activity_graphs import Graphs, source_for
from shaperoute_api.schemas import ErrorBody
from shaperoute_api.stroke_matches import (
    StrokeMatchBody,
    StrokeMatchRequestBody,
    match_stroke,
)

log = logging.getLogger(__name__)

RESPONSES = {
    422: {"model": ErrorBody, "description": "invalid_request or shape_not_drawable"},
    503: {"model": ErrorBody, "description": "map_data_unavailable"},
}


def stroke_router(graphs: Graphs) -> APIRouter:
    router = APIRouter()

    # The probe of the app: 204 here, 404 on an API of before TASK-347.
    @router.get("/stroke-matches", status_code=204)
    def matches_strokes() -> Response:
        return Response(status_code=204)

    # A plain def: FastAPI runs it in a thread, like POST /routes.
    @router.post("/stroke-matches", responses=RESPONSES)
    def match(body: StrokeMatchRequestBody) -> StrokeMatchBody:
        started = time.perf_counter()
        found = match_stroke(body, source_for(graphs, body.activity))
        log.info(
            "stroke of %d points, %.0f m: %d route points in %.2f s%s",
            len(body.line),
            stroke_length_m(body.line),
            len(found.points),
            time.perf_counter() - started,
            ", off the roads" if found.off_roads else "",
        )
        return StrokeMatchBody.of(found)

    return router


def install_stroke_matches(app: FastAPI, graphs: Graphs) -> None:
    """POST /stroke-matches and its probe, on the graphs of each activity."""
    app.include_router(stroke_router(graphs))
