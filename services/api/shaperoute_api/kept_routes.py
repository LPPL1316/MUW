"""The routes the API already keeps, and nothing else (TASK-316, ADR-0276).

"Explore" prepares the examples of the towns near the user and of the region
as the app opens, before anyone taps them. Asked with POST /route-jobs, every
phone would have the engine draw what is not kept yet, and the server
download the towns' zones: here a phone asks a town's examples at once, and
gets back only those kept, null for the others. No job, no zone, no
engine, nothing written: what is not kept is drawn when someone taps the
town, as before, or ahead by draw_examples.

Only the routes of the files (route_store.py): those from a city's centre
or a point on the water, which are no one's position. Never the archive's
(route_archive.py, ADR-0256), which keeps routes drawn from where users
were, without who: asked of an endpoint whose answer is "kept" or "not",
a point would say whether someone drew there.

    POST /kept-routes  {"requests": [RouteRequest, ...]}
                       -> {"routes": [RouteResult | null, ...]}

One answer for each request, in the same order. A shape or a word only, as
POST /route-jobs takes them: an image's outline is the user's own and never
kept. One POST, counted as any other in the minute's limit (access.py).
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.app import to_request
from shaperoute_api.jobs import KeepsRoutes
from shaperoute_api.schemas import ErrorBody, RouteRequestBody, RouteResultBody

# A city's examples: eight shapes and six words (exampleRoutes.ts), with room
# for a few more.
MAX_REQUESTS = 16


class KeptRoutesRequestBody(BaseModel):
    """What the app sends: KeptRoutesRequest in packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    requests: list[RouteRequestBody] = Field(min_length=1, max_length=MAX_REQUESTS)


class KeptRoutesBody(BaseModel):
    """What the app gets back: KeptRoutes in packages/shared-types."""

    routes: list[RouteResultBody | None] = Field(
        description="The route kept for each request, in its order; null when "
        "none is kept."
    )


def kept_routes(
    store: KeepsRoutes | None, body: KeptRoutesRequestBody
) -> KeptRoutesBody:
    """Each request's route as the store keeps it. A request the engine
    would refuse raises InvalidRequestError, a 422 as from /route-jobs."""
    asked = [to_request(request) for request in body.requests]
    found = [None if store is None else store.get(request) for request in asked]
    return KeptRoutesBody(
        routes=[None if r is None else RouteResultBody.from_result(r) for r in found]
    )


def kept_route_routes(store: KeepsRoutes | None) -> APIRouter:
    router = APIRouter()

    @router.post("/kept-routes", responses={422: {"model": ErrorBody}})
    def read_kept_routes(body: KeptRoutesRequestBody) -> KeptRoutesBody:
        return kept_routes(store, body)

    return router


def install_kept_routes(app: FastAPI, store: KeepsRoutes | None) -> None:
    """POST /kept-routes, read from `store`: the files of the cities'
    centres (route_store.RouteStore), never the archive. Without them,
    every answer is null."""
    app.include_router(kept_route_routes(store))
