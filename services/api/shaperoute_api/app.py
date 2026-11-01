"""The HTTP API: RouteRequest in, RouteResult out (docs/API.md).

The API orchestrates and does not compute: the route comes from the engine's
plan_route, errors become a status and a code the app can explain. The app
uses route jobs (ADR-0032); POST /routes answers in one go, for /docs, curl
and measurements. POST /shape-readings asks the AI which shape of the
catalogue some words name (ADR-0012): the AI never sees the route.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import PoolTimeout
from route_engine.export_gpx import route_name, to_gpx
from route_engine.image_outline import InvalidImageError
from route_engine.models import (
    PEN_UP_WITHOUT_WORD,
    InvalidRequestError,
    RouteResult,
)
from route_engine.optimizer import ShapeNotDrawableError
from route_engine.outline_edits import InvalidEditError
from shaperoute_ai.reading import (
    InvalidTextError,
    ModelUnavailableError,
    ShapeReader,
    clean,
)
from starlette.exceptions import HTTPException as StarletteHTTPException

from shaperoute_api.access import protect
from shaperoute_api.accounts import Accounts, install_accounts
from shaperoute_api.activities import PlaceNames, install_activities
from shaperoute_api.activity_graphs import (
    Graphs,
    check_supported,
    ground_for,
    source_for,
)
from shaperoute_api.best_routes import install_best_routes
from shaperoute_api.cities import CitySearch, SuggestionsBody
from shaperoute_api.comments import install_comments
from shaperoute_api.contact import install_contact
from shaperoute_api.contact_people import install_contact_people
from shaperoute_api.contests import install_contests
from shaperoute_api.drawing_photos import install_drawing_photos
from shaperoute_api.drawing_search import install_drawing_search
from shaperoute_api.drawings import install_drawings
from shaperoute_api.errors import error_of
from shaperoute_api.favorites import install_favorites
from shaperoute_api.feed import install_feed
from shaperoute_api.feedback import install_feedback
from shaperoute_api.follows import install_follows
from shaperoute_api.game import install_game
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.group_runs import install_group_runs
from shaperoute_api.images import (
    AnyRequest,
    ImageRequest,
    decode_image,
    outline_of,
    placed_outlines,
    plan_request,
    route_request_of,
    trace,
    with_placed,
)
from shaperoute_api.insights import Insights, route_fields
from shaperoute_api.jobs import Job, JobEnd, Planner, RouteJobs
from shaperoute_api.line_directions import (
    RouteDirectionsBody,
    RouteDirectionsRequestBody,
    directions_of,
)
from shaperoute_api.messages import install_messages
from shaperoute_api.moderation import install_moderation
from shaperoute_api.notifications import install_notifications
from shaperoute_api.outline_edits import edit_outline
from shaperoute_api.places import (
    MAX_QUERY_LENGTH,
    MIN_QUERY_LENGTH,
    PlacesBody,
    PlaceSearch,
    PlacesUnavailableError,
)
from shaperoute_api.profile_photos import install_profile_photos
from shaperoute_api.profiles import install_profiles
from shaperoute_api.push import install_push
from shaperoute_api.reactions import install_reactions
from shaperoute_api.recommended import (
    DEFAULT_RADIUS_M,
    MAX_RADIUS_M,
    RecommendedCatalog,
    RecommendedRouteDetailBody,
    RecommendedRoutesBody,
)
from shaperoute_api.request_log import RequestLog
from shaperoute_api.route_store import RouteStore
from shaperoute_api.schemas import (
    ErrorBody,
    ErrorCode,
    ErrorDetail,
    GpxRequestBody,
    ImageOutlineBody,
    ImageOutlineEditRequestBody,
    ImageOutlineRequestBody,
    ImageRouteRequestBody,
    RouteJobBody,
    RouteRequestBody,
    RouteResultBody,
    ShapeReadingBody,
    ShapeReadingRequestBody,
    TrackScoreBody,
    TrackScoreRequestBody,
)
from shaperoute_api.sign_in_providers import (
    SignInProviders,
    install_sign_in_providers,
)
from shaperoute_api.signals import SignalBody, SignalGate, event_of
from shaperoute_api.strava import install_strava
from shaperoute_api.strava_client import Strava
from shaperoute_api.stroke_matches_api import install_stroke_matches
from shaperoute_api.themed import ThemedJobBody, ThemedJobs, ThemedRequestBody
from shaperoute_api.track_scores import score_run
from shaperoute_api.user_photos import install_user_photos
from shaperoute_api.way_back_api import install_way_back

log = logging.getLogger(__name__)

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorBody, "description": "invalid_request or shape_not_drawable"},
    500: {"model": ErrorBody, "description": "engine_error"},
    503: {"model": ErrorBody, "description": "map_data_unavailable"},
}
IMAGE_OUTLINE_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorBody, "description": "invalid_request or image_not_usable"},
}
OUTLINE_EDIT_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {
        "model": ErrorBody,
        "description": "invalid_request or outline_edit_rejected",
    },
}
SHAPE_READING_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorBody, "description": "invalid_request"},
    503: {"model": ErrorBody, "description": "ai_unavailable"},
}
# Less than this is not worth the CPU. Level 6 is zlib's own: Starlette's 9
# took five times as long for a page of the feed less than 1% smaller
# (0.4 ms against 2.2 ms for 33 KB, 2026-10-16).
GZIP_MIN_BYTES = 1024
GZIP_LEVEL = 6
AI_OFF = "This API was started without the AI that reads shape words."
UNKNOWN_JOB = (
    "Unknown route job: cancelled, finished more than 10 minutes ago, "
    "or the API was restarted."
)
DATABASE_BUSY = "The server is busy: try again in a moment."
# When to ask again after it: as long as the pool waited (db.POOL_WAIT_S).
DATABASE_BUSY_RETRY_S = 10


def error(status: int, code: ErrorCode, message: str) -> JSONResponse:
    body = ErrorBody.model_validate({"error": {"code": code, "message": message}})
    return JSONResponse(status_code=status, content=body.model_dump())


def validation_message(errors: Sequence[Any]) -> str:
    """Pydantic's errors in one line: "start: Field required; ..."."""
    parts = []
    for item in errors:
        where = ".".join(str(part) for part in item["loc"][1:]) or "body"
        parts.append(f"{where}: {item['msg']}")
    return "; ".join(parts)


def to_request(body: RouteRequestBody | ImageRouteRequestBody) -> AnyRequest:
    """The engine's RouteRequest checks the values, and ImageRequest those of
    an image route: InvalidRequestError. An image has no letters to draw
    with the pen up (TASK-197). The activity is one of the contract's: the
    engine may draw more (TASK-190)."""
    check_supported(body.activity)
    if isinstance(body, ImageRouteRequestBody):
        if body.pen_up:
            raise InvalidRequestError(PEN_UP_WITHOUT_WORD)
        return ImageRequest(
            start=body.start,
            outline=outline_of(body.outline, body.strokes),
            distance_m=body.distance_m,
            activity=body.activity,
            placement=body.placement,
            fit=body.fit,
        )
    return route_request_of(body)


def gpx_file_name(request: AnyRequest, when: datetime) -> str:
    """No spaces or odd characters: some apps refuse them, e.g.
    'sgrava-heart-5km-2026-09-23.gpx', 'sgrava-CIAO-15km-2026-09-24.gpx',
    'sgrava-image-15km-2026-09-26.gpx'."""
    km = f"{request.distance_m / 1000:g}km"
    return f"sgrava-{request.name}-{km}-{when:%Y-%m-%d}.gpx"


def job_body(job: Job) -> RouteJobBody:
    result = None
    if job.result is not None:
        # Where the engine placed the drawing (TASK-347): the job's, not the
        # engine's result's.
        result = with_placed(RouteResultBody.from_result(job.result), job.placed)
    return RouteJobBody(
        job_id=job.job_id, status=job.status, result=result, error=job.error
    )


def job_recorder(request_log: RequestLog) -> JobEnd:
    def record(
        job: Job,
        result: RouteResult | None,
        error: ErrorDetail | None,
        elapsed_s: float,
    ) -> None:
        request_log.record(job.body, result, error, elapsed_s, job.job_id)

    return record


def now_utc() -> datetime:
    return datetime.now(UTC)


def create_app(
    source: Graphs,
    planner: Planner = plan_request,
    jobs: RouteJobs | None = None,
    now: Callable[[], datetime] = now_utc,
    reader: ShapeReader | None = None,
    request_log: RequestLog | None = None,
    places: PlaceSearch | None = None,
    recommended: RecommendedCatalog | None = None,
    themed: ThemedJobs | None = None,
    cities: CitySearch | None = None,
    insights: Insights | None = None,
    signal_gate: SignalGate | None = None,
    accounts: Accounts | None = None,
    route_store: RouteStore | None = None,
    run_places: PlaceNames | None = None,
    strava: Strava | None = None,
    sign_in: SignInProviders | None = None,
) -> FastAPI:
    # The search events and the learned vocabulary (TASK-130, ADR-0101).
    insights = insights or Insights(None)
    # What the app did with the searches (TASK-142, ADR-0112).
    gate = signal_gate or SignalGate()
    # The request log (TASK-090) and the events hear how each job ended.
    logged = None if request_log is None else job_recorder(request_log)

    def on_end(
        job: Job, result: RouteResult | None, error: ErrorDetail | None, elapsed: float
    ) -> None:
        if logged is not None:
            logged(job, result, error, elapsed)
        # A cancelled job is already an event, from DELETE (TASK-142); one
        # that ended anyway, its result dropped, is not a route shown.
        if route_jobs.get(job.job_id) is None:
            return
        if result is not None or error is not None:
            fields = route_fields(
                job.body,
                None if result is None else result.similarity,
                None if error is None else error.code,
                None if result is None else 1 + len(result.alternatives),
            )
            insights.record("route", ms=round(elapsed * 1000), **fields)

    # A city's examples are kept once drawn (ADR-0136).
    route_jobs = jobs or RouteJobs(source, planner, on_end=on_end, store=route_store)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if reader is not None:
            # In the background: the API answers at once, even with Ollama
            # off or the model missing; the first word waits less (TASK-052).
            log.info("AI model: loading in the background")
            threading.Thread(
                target=reader.warm_up, name="ai-preload", daemon=True
            ).start()
        yield
        route_jobs.shutdown()
        if themed is not None:
            themed.shutdown()
        # The database's open connections closed (TASK-288 B): before
        # uvicorn gives SIGTERM back to the process.
        if accounts is not None:
            accounts.database.close()

    app = FastAPI(
        title="ShapeRoute API",
        version="0.2.0",
        description="Generates real routes that draw a shape on the map.",
        lifespan=lifespan,
    )
    # Answers of a kilobyte or more compressed for a phone that takes gzip
    # (TASK-288). Not the JPEGs and the zones' gzip files: Starlette leaves
    # those as they are. Added before protect, so inside it: the answer of
    # an endpoint comes whole, and its size is known; protect sends it on
    # in pieces, and pieces would all be compressed, however small.
    app.add_middleware(
        GZipMiddleware, minimum_size=GZIP_MIN_BYTES, compresslevel=GZIP_LEVEL
    )
    protect(app)
    # Sign up, sign in, /me (TASK-114, ADR-0115); without a database, 503.
    install_accounts(app, accounts)
    # The routes an account keeps (TASK-171); they need its token.
    install_favorites(app)
    # The runs an account recorded (TASK-172); the name of their place comes
    # from the place search's key, when the environment has one.
    install_activities(app, run_places, insights)
    # A run sent to the runner's Strava (TASK-187); off unless the
    # environment has this server's Strava application.
    install_strava(app, strava)
    # «Continue with Apple» and «Continue with Google» (TASK-322); each off
    # unless the environment has its keys.
    install_sign_in_providers(app, sign_in)
    # The profile picture of an account (TASK-178); it needs its token.
    install_profile_photos(app)
    # Username and bio, and the profile the others see (TASK-116); both need
    # a token.
    install_profiles(app)
    # The email and the phone number of an account, changed by their owner
    # (TASK-183); both need a token.
    install_contact(app)
    # The two notification switches of an account (TASK-185); push.py reads
    # «Push notifications» before sending; they need a token.
    install_notifications(app)
    # The phones of an account, and the push notifications sent to them
    # (TASK-262); the tokens need a token.
    install_push(app)
    # The runs an account publishes as drawings, cut for the others
    # (TASK-117); they need a token.
    install_drawings(app)
    # Up to three photos of a drawing, besides its map (TASK-208); they need
    # a token.
    install_drawing_photos(app)
    # The photos of a profile's drawings, a page at a time (TASK-324); they
    # need a token.
    install_user_photos(app)
    # Members found by name, and following with a request (TASK-211); they
    # need a token.
    install_follows(app)
    # What the members write under a drawing (TASK-120); they need a token.
    install_comments(app)
    # What the members leave under a drawing with one tap, the super like
    # with a comment (TASK-119); they need a token.
    install_reactions(app)
    # The drawings the members publish, read by whoever is signed in
    # (TASK-118); it needs a token.
    install_feed(app)
    # The search of the drawings from the lens of «Feed» (TASK-344); it
    # needs a token.
    install_drawing_search(app)
    # Blocking and reporting (TASK-121); they need a token.
    install_moderation(app)
    # Private messages, with message requests (TASK-319); after the blocks,
    # which delete a conversation; they need a token.
    install_messages(app)
    # The shape game (TASK-296): the catalog for anyone, the rest with a token.
    install_game(app)
    # The members found from the phone's contacts, by the hashes of their
    # numbers (TASK-262 C); it needs a token.
    install_contact_people(app)
    install_contests(app)
    # «Send feedback» in «Settings» (TASK-308); it needs a token.
    install_feedback(app)
    # Group runs on a route, «I'm going» and the reminder an hour before
    # (TASK-309); they need a token.
    install_group_runs(app)
    # A stroke drawn on the map, anchored to the roads as the finger lifts
    # (TASK-347 A), and the probe that says this server does it.
    install_stroke_matches(app, source)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/route-jobs", status_code=202, responses=ERROR_RESPONSES)
    def create_route_job(body: RouteRequestBody) -> RouteJobBody:
        return job_body(route_jobs.submit(to_request(body), body.model_dump()))

    # The route of an image's outline, drawn like a shape (ADR-0069); the
    # job is then read and cancelled at /route-jobs/{job_id}, as any other.
    @app.post("/image-route-jobs", status_code=202, responses=ERROR_RESPONSES)
    def create_image_route_job(body: ImageRouteRequestBody) -> RouteJobBody:
        return job_body(route_jobs.submit(to_request(body), body.model_dump()))

    # The engine traces the outline (ADR-0068): the app shows it before the
    # route is asked for. A plain def: decoding a photo takes a moment.
    @app.post("/image-outlines", responses=IMAGE_OUTLINE_RESPONSES)
    def trace_image(body: ImageOutlineRequestBody) -> ImageOutlineBody:
        return trace(decode_image(body.image))

    # A part or a detail drawn on the outline (TASK-079, ADR-0074): the
    # engine decides what it becomes; nothing is kept between two edits.
    @app.post("/image-outline-edits", responses=OUTLINE_EDIT_RESPONSES)
    def edit_image_outline(body: ImageOutlineEditRequestBody) -> ImageOutlineBody:
        return edit_outline(body)

    @app.get("/route-jobs/{job_id}", responses={404: {"model": ErrorBody}})
    def get_route_job(job_id: str) -> RouteJobBody:
        job = route_jobs.get(job_id)
        if job is None:
            raise HTTPException(404, UNKNOWN_JOB)
        return job_body(job)

    @app.delete(
        "/route-jobs/{job_id}", status_code=204, responses={404: {"model": ErrorBody}}
    )
    def cancel_route_job(job_id: str) -> Response:
        job = route_jobs.get(job_id)
        if not route_jobs.cancel(job_id):
            raise HTTPException(404, UNKNOWN_JOB)
        # Given up before it ended: waited too long, or asked otherwise
        # (TASK-142). The code says how far it had gone.
        if job is not None and job.status not in ("done", "failed"):
            fields = route_fields(job.body, None, None)
            fields.update(outcome="cancelled", code=job.status)
            insights.record("route", **fields)
        return Response(status_code=204)

    # The route as a GPX file, written by the engine's own export, the one the
    # CLI uses (ADR-0033). Nothing is kept: the app sends request and result.
    @app.post(
        "/gpx",
        response_class=Response,
        responses={
            200: {"content": {"application/gpx+xml": {}}, "description": "GPX 1.1"},
            422: ERROR_RESPONSES[422],
        },
    )
    def export_gpx(body: GpxRequestBody) -> Response:
        request = to_request(body.request)
        # A route worth running: the strongest sign a search was useful.
        fields = route_fields(body.request.model_dump(), body.result.similarity, None)
        fields.pop("point")
        insights.record("gpx_export", **fields)
        when = now()
        document = to_gpx(
            body.result.points,
            route_name(request.name, request.distance_m, when),
            when,
            # Where to pause between the letters of a word with the pen up.
            body.result.walks,
        )
        return Response(
            document,
            media_type="application/gpx+xml",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{gpx_file_name(request, when)}"'
                )
            },
        )

    # Places for the start, while typing (TASK-123, ADR-0095). 503 when the
    # API has no key or the service fails: the app then asks Photon itself.
    @app.get("/places", responses={503: {"model": ErrorBody}})
    def search_places(
        q: str = Query(min_length=MIN_QUERY_LENGTH, max_length=MAX_QUERY_LENGTH),
        lat: float | None = Query(default=None, ge=-90, le=90),
        lon: float | None = Query(default=None, ge=-180, le=180),
    ) -> PlacesBody:
        if places is None:
            raise HTTPException(503, "Place search is off on this API.")
        near = None if lat is None or lon is None else (lat, lon)
        try:
            return PlacesBody(places=places.search(q, near))
        except PlacesUnavailableError as exc:
            raise HTTPException(503, str(exc)) from None

    # The best routes already planned near a point, for "Explore" (TASK-126,
    # ADR-0098). The point is in the query: not in the access log (ADR-0096).
    catalog = recommended or RecommendedCatalog([])
    # The «Recommended» row: the same routes, the best drawn first, then the
    # most liked and run (TASK-092, ADR-0229); it needs a token.
    install_best_routes(app, catalog)

    @app.get("/recommended-routes")
    def list_recommended_routes(
        lat: float = Query(ge=-90, le=90),
        lon: float = Query(ge=-180, le=180),
        radius_m: int = Query(default=DEFAULT_RADIUS_M, ge=100, le=MAX_RADIUS_M),
        shape: str | None = Query(default=None, max_length=40),
        distance_m: int | None = Query(default=None, ge=0),
    ) -> RecommendedRoutesBody:
        routes = catalog.near((lat, lon), radius_m, shape, distance_m)
        insights.record(
            "recommended_list",
            point=(lat, lon),
            n=len(routes),
            outcome="ok" if routes else "empty",
            shape=shape,
        )
        return RecommendedRoutesBody(routes=routes)

    @app.get("/recommended-routes/{route_id}", responses={404: {"model": ErrorBody}})
    def get_recommended_route(route_id: str) -> RecommendedRouteDetailBody:
        route = catalog.get(route_id)
        if route is None:
            raise HTTPException(404, "No recommended route with this id.")
        insights.record(
            "recommended_open",
            city=route.city,
            shape=route.shape,
            word=route.word,
            quality=round(route.similarity, 3),
        )
        return route

    # Cities of the world by name, their centre, for "Explore" (TASK-129).
    @app.get("/cities", responses={503: {"model": ErrorBody}})
    def search_cities(
        q: str = Query(min_length=MIN_QUERY_LENGTH, max_length=MAX_QUERY_LENGTH),
    ) -> PlacesBody:
        if cities is None:
            raise HTTPException(503, "City search is off on this API.")
        # Words people searched and then left for another city (TASK-142):
        # "levic" searches "Levico Terme", not Levič.
        learned = insights.vocab.city_for(q)
        try:
            found = cities.body(learned or q)
        except PlacesUnavailableError as exc:
            insights.record("city_search", text=q, outcome="error", code="unavailable")
            raise HTTPException(503, str(exc)) from None
        # A city's centre is no one's position: it is kept as the cell.
        first = found.places[0] if found.places else None
        insights.record(
            "city_search",
            text=q,
            n=len(found.places),
            outcome="ok" if first else "empty",
            city=None if first is None else first.label,
            point=None if first is None else first.point,
            by=None if learned is None else "learned",
        )
        if route_store is not None:
            route_store.learn(place.point for place in found.places)
        return found

    # Cities and places while typing, for "Explore" (TASK-134, TASK-138):
    # "Par" → Parma, Paris; "arena di ver" → Arena di Verona. Empty below two
    # letters.
    @app.get("/city-suggestions", responses={503: {"model": ErrorBody}})
    def suggest_cities(
        q: str = Query(min_length=MIN_QUERY_LENGTH, max_length=MAX_QUERY_LENGTH),
    ) -> SuggestionsBody:
        if cities is None:
            raise HTTPException(503, "City search is off on this API.")
        try:
            suggested = cities.suggest(q)
        except PlacesUnavailableError as exc:
            raise HTTPException(503, str(exc)) from None
        if route_store is not None:
            # The cities only: a place may be the street someone lives in.
            route_store.learn(s.point for s in suggested if s.kind == "city")
        return SuggestionsBody(places=suggested)

    # What the app did with a search (TASK-142, ADR-0112): the city chosen,
    # the route among A, B and C, a hint taken. Always 204: a signal is never
    # worth an error on the phone; past the gate's limit, not recorded.
    @app.post("/signals", status_code=204, responses={422: {"model": ErrorBody}})
    def record_signal(body: SignalBody) -> Response:
        if gate.allows():
            kind, fields = event_of(body.root)
            insights.record(kind, **fields)
        else:
            log.warning("signal %s not recorded: too many this minute", body.root.kind)
        return Response(status_code=204)

    # A shape through the real places of a theme, in any city (TASK-129,
    # ADR-0099): a job, as a route, since it plans the shape a few times.
    @app.post(
        "/themed-route-jobs", status_code=202, responses={503: {"model": ErrorBody}}
    )
    def create_themed_route_job(body: ThemedRequestBody) -> ThemedJobBody:
        if themed is None:
            raise HTTPException(503, "Themed routes are off on this API.")
        return themed.submit(body).as_body()

    @app.get("/themed-route-jobs/{job_id}", responses={404: {"model": ErrorBody}})
    def get_themed_route_job(job_id: str) -> ThemedJobBody:
        job = None if themed is None else themed.get(job_id)
        if job is None:
            raise HTTPException(404, UNKNOWN_JOB)
        return job.as_body()

    # The score of a run against the route it followed (ADR-0093). Nothing
    # is kept and no graph is read: the engine compares two lines.
    @app.post("/track-scores", responses={422: SHAPE_READING_RESPONSES[422]})
    def score_track_run(body: TrackScoreRequestBody) -> TrackScoreBody:
        scored = score_run(body)
        # Run after it was found: the search led somewhere (TASK-130).
        insights.record("run_scored", quality=round(scored.score / 100, 3))
        return scored

    # The directions of a route of "Explore", which has only its points
    # (TASK-145, ADR-0117). A plain def: loading the zone takes seconds.
    @app.post("/route-directions", responses=ERROR_RESPONSES)
    def find_route_directions(body: RouteDirectionsRequestBody) -> RouteDirectionsBody:
        started = time.perf_counter()
        # A route of "Explore" is a run (TASK-190: on the foot network).
        directions = directions_of(source_for(source, "running"), body.points)
        log.info(
            "directions of %d points: %d, in %.1f s",
            len(body.points),
            len(directions),
            time.perf_counter() - started,
        )
        return RouteDirectionsBody.of(directions)

    # The way back to the route for a runner off it (TASK-314, ADR-0274).
    install_way_back(app, source)

    # The words the app's table does not know (ADR-0012). A plain def, like
    # /routes: a model on a laptop takes seconds, in a thread of its own.
    @app.post("/shape-readings", responses=SHAPE_READING_RESPONSES)
    def read_shape(body: ShapeReadingRequestBody) -> ShapeReadingBody:
        started = time.monotonic()
        # Learned from the AI's past answers (TASK-130): no call to the model.
        learned = insights.vocab.shape_for(body.text)
        if learned is not None:
            insights.record(
                "shape_reading",
                text=body.text,
                shape=learned,
                by="learned",
                started=started,
            )
            return ShapeReadingBody(text=clean(body.text), shape=learned)
        if reader is None:
            raise ModelUnavailableError(AI_OFF)
        choice = reader.read(body.text)
        insights.record(
            "shape_reading",
            text=body.text,
            shape=choice.shape,
            by="ai",
            outcome="ok" if choice.shape else "empty",
            started=started,
        )
        return ShapeReadingBody(text=clean(body.text), shape=choice.shape)

    # A plain def: FastAPI runs it in a thread, so a long route does not stop
    # the server from answering the other requests.
    @app.post("/routes", responses=ERROR_RESPONSES)
    def create_route(body: RouteRequestBody, http: Request) -> RouteResultBody:
        # Its errors suggest a distance of its activity (engine_answer).
        http.state.activity = body.activity
        request = to_request(body)
        what = f"{request.name} {request.distance_m} m"
        started = time.perf_counter()
        try:
            # On the network of its activity (TASK-190), or on the water.
            plan = planner(request, ground_for(source, request.activity))
            others = [other.result for other in plan.alternatives]
            result = replace(plan.result, alternatives=others)
            placed = placed_outlines(plan, request)
        except Exception as exc:
            elapsed = time.perf_counter() - started
            log.info("route %s: %s after %.1f s", what, type(exc).__name__, elapsed)
            _, detail = error_of(exc, request.activity)
            if request_log is not None:
                request_log.record(body.model_dump(), None, detail, elapsed)
            fields = route_fields(body.model_dump(), None, detail.code)
            insights.record("route", ms=round(elapsed * 1000), **fields)
            raise
        log.info(
            "route %s: %.0f m on roads, similarity %.2f, in %.1f s",
            what,
            result.distance_m,
            result.similarity,
            time.perf_counter() - started,
        )
        if request_log is not None:
            request_log.record(
                body.model_dump(), result, None, time.perf_counter() - started
            )
        fields = route_fields(
            body.model_dump(), result.similarity, None, 1 + len(others)
        )
        insights.record(
            "route", ms=round((time.perf_counter() - started) * 1000), **fields
        )
        return with_placed(RouteResultBody.from_result(result), placed)

    @app.exception_handler(RequestValidationError)
    def invalid_body(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error(422, "invalid_request", validation_message(exc.errors()))

    def engine_answer(request: Request, exc: Exception) -> JSONResponse:
        # POST /routes says the activity of the request (TASK-190).
        status, detail = error_of(exc, getattr(request.state, "activity", "running"))
        body = ErrorBody(error=detail)
        return JSONResponse(status_code=status, content=body.model_dump())

    @app.exception_handler(InvalidImageError)
    def image_not_usable(_: Request, exc: InvalidImageError) -> JSONResponse:
        detail = ErrorDetail(
            code="image_not_usable", message=str(exc), reason=exc.reason
        )
        return JSONResponse(
            status_code=422, content=ErrorBody(error=detail).model_dump()
        )

    @app.exception_handler(InvalidEditError)
    def outline_edit_rejected(_: Request, exc: InvalidEditError) -> JSONResponse:
        detail = ErrorDetail(
            code="outline_edit_rejected", message=str(exc), reason=exc.reason
        )
        return JSONResponse(
            status_code=422, content=ErrorBody(error=detail).model_dump()
        )

    for known in (
        InvalidRequestError,
        ShapeNotDrawableError,
        MapDataUnavailableError,
        InvalidTextError,
        ModelUnavailableError,
    ):
        app.add_exception_handler(known, engine_answer)

    # Every connection of the pool busy for db.POOL_WAIT_S (TASK-288 B): the
    # phone says to try again later, as for a server without a database.
    @app.exception_handler(PoolTimeout)
    def database_busy(_: Request, exc: PoolTimeout) -> JSONResponse:
        log.warning("database: %s", exc)
        answer = error(503, "accounts_unavailable", DATABASE_BUSY)
        answer.headers["Retry-After"] = str(DATABASE_BUSY_RETRY_S)
        return answer

    @app.exception_handler(StarletteHTTPException)
    def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error(exc.status_code, "http_error", str(exc.detail))

    # Anything else, InvalidRouteError included (ADR-0026). The traceback goes
    # to the server log, not to the phone.
    @app.exception_handler(Exception)
    def engine_error(request: Request, exc: Exception) -> JSONResponse:
        log.exception("route failed", exc_info=exc)
        return engine_answer(request, exc)

    return app
