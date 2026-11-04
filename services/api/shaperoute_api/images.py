"""Images (TASK-073, ADR-0069): the outline of a picture, for the app to
show before asking for a route, and the route of that outline.

The engine traces the outline (route_engine/image_outline.py, ADR-0068);
the API only carries it. The app sends the image once, in base64 inside
JSON, and gets the outline back; the route request then sends the outline,
not the image again. That outline comes from the phone, so it is checked
again like any input: its size, its numbers, and the engine's own check of
an outline (parse_outline).
"""

from __future__ import annotations

import binascii
import io
import logging
import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any, cast

from PIL import Image
from route_engine.anchored import AnchoredPlan, check_placement, placed_lines
from route_engine.anchored import plan_anchored as trace_anchored
from route_engine.geo import LatLon
from route_engine.image_outline import ANALYSIS_SIDE, MAX_POINTS, outline_data
from route_engine.models import (
    WATER_ACTIVITIES,
    InvalidRequestError,
    RouteRequest,
    check_activity,
    check_distance,
    check_drawn_on_land,
    check_start,
)
from route_engine.nearby_starts import ShapeJob, plan_nearby
from route_engine.optimizer import (
    SHAPE_POINTS,
    GraphLoader,
    Plan,
    tilt_limit,
)
from route_engine.outline_edits import MAX_DETAIL_POINTS, travelled_points
from route_engine.pieces import compose
from route_engine.shapes.outline import InvalidOutlineError, Outline, parse_outline
from route_engine.water import WaterSource
from route_engine.words import Word

from shaperoute_api.job_times import noted
from shaperoute_api.paddling import plan_water
from shaperoute_api.schemas import (
    MAX_IMAGE_BYTES,
    ImageOutlineBody,
    RouteRequestBody,
    RouteResultBody,
)

log = logging.getLogger(__name__)

# What an image route is called in names and messages, like "heart".
IMAGE_NAME = "image"
# Normalized points may overshoot [-1, 1] by rounding, no more.
SLACK = 1e-6
# Digits of the points sent to the app: well below a pixel.
DIGITS = 5
# EXIF orientations that turn the picture on its side (ImageOps.exif_transpose).
SIDEWAYS = (5, 6, 7, 8)


@dataclass(frozen=True, kw_only=True)
class ImageRequest:
    """A route request whose shape is the outline of an image. Checked like
    RouteRequest, but not part of it: the engine's contract stays shape or
    word (models.py)."""

    start: tuple[float, float]
    outline: Outline
    distance_m: int
    activity: str = "running"
    # Draw the pieces of the outline, the other subjects and the holes of
    # the image, one at a time, walking between them (TASK-297, ADR-0258);
    # an outline without pieces is drawn as without it.
    pen_up: bool = False
    # Where the outline goes (TASK-347, ADR-0300): searched for ("free"), or
    # left where it was drawn ("anchored") with the magnet `fit`, as
    # AnchoredRouteRequest for a shape or a word.
    placement: str = "free"
    fit: float | None = None

    def __post_init__(self) -> None:
        check_start(self.start)
        # Only a shape of the catalogue on the water (ADR-0161), whatever
        # the distance: "... not an image".
        check_drawn_on_land(self.activity, "an image")
        # The limits of its activity: 10-30 km by bike (TASK-190).
        check_distance(self.distance_m, self.activity)
        check_activity(self.activity)
        check_placement(self.placement, self.fit, self.activity)

    @property
    def name(self) -> str:
        return IMAGE_NAME


@dataclass(frozen=True, kw_only=True)
class AnchoredRouteRequest(RouteRequest):
    """A shape or a word left where it was drawn (TASK-347, ADR-0300): the
    engine's RouteRequest with the magnet `fit`, planned by `plan_anchored`
    with no search. A RouteRequest everywhere else (the jobs, the request
    log, the GPX name); the stores never keep it (route_store._path,
    route_archive._kept): its place is the user's own, like an image's
    outline. The engine's models.py stays as it is: this request is the
    API's, as ImageRequest is."""

    placement: str = "anchored"
    fit: float | None = None

    def __post_init__(self) -> None:
        super().__post_init__()
        check_placement(self.placement, self.fit, self.activity)


# What route jobs and /gpx take.
AnyRequest = RouteRequest | ImageRequest


def placement_of(request: object) -> str:
    """Where the request's drawing goes: "anchored" for an AnchoredRouteRequest
    or an ImageRequest asked so, "free" for every other."""
    placement: str = getattr(request, "placement", "free")
    return placement


def route_request_of(body: RouteRequestBody) -> RouteRequest:
    """The engine's request for the body of POST /routes and /route-jobs:
    RouteRequest checks the values (InvalidRequestError); an anchored one is
    an AnchoredRouteRequest (TASK-347), and `fit` with a free placement is
    refused. Without FastAPI: on_phone.to_request calls it too."""
    fields: dict[str, Any] = {
        "start": body.start,
        "shape": body.shape,
        "word": body.word,
        "distance_m": body.distance_m,
        "activity": body.activity,
        "style": body.style,  # RouteRequest checks it
        "pen_up": body.pen_up,
        "near": body.near,
    }
    if body.placement == "anchored":
        return AnchoredRouteRequest(**fields, fit=body.fit)
    check_placement(body.placement, body.fit, body.activity)
    return RouteRequest(**fields)


def decode_image(text: str) -> bytes:
    """The bytes of an image sent in base64; InvalidRequestError if it is
    not base64 or larger than MAX_IMAGE_BYTES."""
    try:
        data = binascii.a2b_base64(text.encode("ascii"), strict_mode=True)
    except (binascii.Error, UnicodeEncodeError):
        raise InvalidRequestError("image: not valid base64") from None
    if len(data) > MAX_IMAGE_BYTES:
        raise InvalidRequestError(
            f"image: at most {MAX_IMAGE_BYTES // 1_000_000} MB, "
            f"got {len(data) / 1_000_000:.1f} MB"
        )
    return data


def trace(image: bytes) -> ImageOutlineBody:
    """The outline of the image's subject, both for the route and for the
    picture, with its other subjects as strokes (TASK-084);
    InvalidImageError, with its reason, when there is none."""
    data = outline_data(image, name=IMAGE_NAME, source="an image from the app")
    outline = parse_outline(data)
    width, height = _analysed_size(image)
    pixels: list[list[float]] = data["points"]  # type: ignore[assignment]
    stroke_pixels: list[list[list[float]]] = data.get("strokes", [])  # type: ignore[assignment]

    def shares(line: list[list[float]]) -> list[tuple[float, float]]:
        # The engine's y is upwards: the row of a pixel is -y.
        return [(round(x / width, DIGITS), round(-y / height, DIGITS)) for x, y in line]

    def rounded(line: tuple[tuple[float, float], ...]) -> list[tuple[float, float]]:
        return [(round(x, DIGITS), round(y, DIGITS)) for x, y in line]

    return ImageOutlineBody(
        points=rounded(outline.points),
        image_points=shares(pixels),
        aspect=round(width / height, DIGITS),
        strokes=[rounded(stroke) for stroke in outline.strokes],
        image_strokes=[shares(stroke) for stroke in stroke_pixels],
    )


def _analysed_size(image: bytes) -> tuple[float, float]:
    """Width and height of the picture the engine traced: upright, and
    reduced to ANALYSIS_SIDE a side as image_outline does. Pillow rounds
    its sides to whole pixels; a fraction of a pixel does not show."""
    with Image.open(io.BytesIO(image)) as picture:
        width, height = picture.size
        if picture.getexif().get(0x0112) in SIDEWAYS:
            width, height = height, width
    scale = min(1.0, ANALYSIS_SIDE / max(width, height))
    return width * scale, height * scale


def outline_of(
    points: list[tuple[float, float]],
    strokes: list[list[tuple[float, float]]] | None = None,
) -> Outline:
    """The outline an image route request sends back, with its other
    subjects (TASK-084) and the details drawn on it (TASK-079) as strokes,
    checked as any input (ADR-0069): InvalidRequestError,
    which says what is wrong with it."""
    strokes = strokes or []
    if len(points) - 1 > MAX_POINTS:
        raise InvalidRequestError(
            f"outline: at most {MAX_POINTS} corners, got {len(points) - 1}"
        )
    detail_points = travelled_points(strokes) if all(strokes) else 0
    if detail_points > MAX_DETAIL_POINTS:
        raise InvalidRequestError(
            f"strokes: at most {MAX_DETAIL_POINTS} points to travel in all, "
            f"got {detail_points}"
        )
    for x, y in [*points, *(p for stroke in strokes for p in stroke)]:
        if not (math.isfinite(x) and math.isfinite(y)):
            raise InvalidRequestError("outline: every point must be a finite number")
        if abs(x) > 1 + SLACK or abs(y) > 1 + SLACK:
            raise InvalidRequestError(
                "outline: the points must be within [-1, 1], as POST "
                "/image-outlines gives them"
            )
    data: dict[str, object] = {
        "name": IMAGE_NAME,
        "source": "an image traced by the engine (TASK-073)",
        "license": "as the image",
        "points": [[x, y] for x, y in points],
    }
    if strokes:
        data["strokes"] = [[[x, y] for x, y in stroke] for stroke in strokes]
    try:
        # Details drawn by hand may cross (TASK-079, ADR-0074).
        return parse_outline(data, allow_crossings=True)
    except InvalidOutlineError as exc:
        raise InvalidRequestError(f"outline: {exc}") from None


def image_job(request: ImageRequest) -> ShapeJob:
    """The route of an image's outline, as the CLI's --image plans it: kept
    upright (ADR-0038), from any start. The nearby starts give an image its
    alternatives too (TASK-093, the user's choice), and may find a better
    route than the start's own, as for a shape (ADR-0071). On the network
    of its activity (TASK-190). With the pen up and pieces apart, the
    outline is composed as a shape in pieces (pieces.compose) and searched
    as a word with the pen up: the distance asked for is the drawing's, and
    the result says the walks (ADR-0258)."""
    if request.pen_up and request.outline.in_pieces:
        pieces = compose(request.outline, IMAGE_NAME)
        return ShapeJob(
            tuple(pieces.points),
            IMAGE_NAME,
            request.distance_m,
            max_tilt_deg=tilt_limit(IMAGE_NAME),
            word=pieces,
            activity=request.activity,
        )
    return ShapeJob(
        tuple(request.outline(SHAPE_POINTS)),
        IMAGE_NAME,
        request.distance_m,
        max_tilt_deg=tilt_limit(IMAGE_NAME),
        activity=request.activity,
    )


def plan_request(request: AnyRequest, source: GraphLoader | WaterSource) -> Plan:
    """The API's planner: a shape, a word or an image, also from a few road
    nodes near the start, keeping the best (TASK-076, ADR-0071) and the
    others worth choosing (TASK-093, ADR-0087). A shape on the water is
    placed on the water `source` gives (TASK-191): there are no roads. An
    anchored request (TASK-347, ADR-0300) is traced once where it was drawn,
    from its own start, with no search, no nearby starts and no
    alternatives: `plan_anchored`."""
    if request.activity in WATER_ACTIVITIES:
        # ImageRequest and the words of RouteRequest refuse the water.
        assert isinstance(request, RouteRequest)
        return plan_water(request, cast(WaterSource, source))
    roads = cast(GraphLoader, source)
    if placement_of(request) == "anchored":
        return plan_anchored(request, roads)
    # The job's source keeps how the nearby starts went, for its times.
    if isinstance(request, ImageRequest):
        plan = noted(source, plan_nearby(image_job(request), request.start, roads))
        return replace(
            _unnamed(plan), alternatives=[_unnamed(p) for p in plan.alternatives]
        )
    job = ShapeJob.of_request(request)
    return noted(source, plan_nearby(job, request.start, roads))


def plan_anchored(request: AnyRequest, roads: GraphLoader) -> AnchoredPlan:
    """The route of a drawing left where it was drawn (TASK-347 A): the
    engine's `anchored.plan_anchored` for the shape, the word or the image's
    outline of the request, from its own start, with the magnet `fit`; no
    search, no nearby starts, no alternatives, and the job's times keep
    nothing of it. The result names the shape or the word as `plan_request`
    does, and nothing for an image."""
    fit: float | None = getattr(request, "fit", None)
    if isinstance(request, ImageRequest):
        word = _word_of(request)
        shape = word.points if word is not None else request.outline(SHAPE_POINTS)
        plan = trace_anchored(
            list(shape),
            IMAGE_NAME,
            request.start,
            request.distance_m,
            roads,
            fit=fit,
            activity=request.activity,
            one_way=request.outline.one_way,
            word=word,
        )
        return cast(AnchoredPlan, _unnamed(plan))
    job = ShapeJob.of_request(request)
    plan = trace_anchored(
        list(job.shape),
        job.name,
        request.start,
        request.distance_m,
        roads,
        fit=fit,
        activity=request.activity,
        word=job.word,
    )
    if job.word_result:
        result = replace(plan.result, shape=None, word=job.name)
        return replace(plan, result=result)
    return plan


def _word_of(request: AnyRequest) -> Word | None:
    """The letters or the pieces of the request drawn with the pen up, as
    the engine composes them (ShapeJob.of_request, image_job): what tells
    the lines of the drawing apart. None for one line."""
    if isinstance(request, ImageRequest):
        if request.pen_up and request.outline.in_pieces:
            return compose(request.outline, IMAGE_NAME)
        return None
    return ShapeJob.of_request(request).word


def placed_outline_of(plan: Plan, request: AnyRequest) -> list[list[LatLon]]:
    """The drawing as the engine placed it, as RouteResult.placed_outline of
    the contract (TASK-347): where an anchored plan traced it, or where the
    search put the chosen route (`plan.search.best.shape`); one line per
    letter or piece with the pen up. Empty from the archive, on the water
    (there is no plan, or no roads), and from a plan that does not say: the
    ghost is a help for the eye, never a reason for a route to fail."""
    if isinstance(plan, AnchoredPlan):
        placed: Sequence[LatLon] = plan.placed
    elif plan.search is not None:
        placed = getattr(getattr(plan.search, "best", None), "shape", None) or []
    else:
        return []
    if not placed:
        return []
    try:
        word = _word_of(request)
        if word is not None and word.pen_up and len(placed) != len(word.points):
            word = None  # placed otherwise than as the letters: one line
        return placed_lines(word, placed)
    except Exception:
        log.warning("the placed outline of %s is left out", request.name, exc_info=True)
        return []


def placed_outlines(plan: Plan, request: AnyRequest) -> list[list[list[LatLon]]]:
    """`placed_outline_of` the plan and of each of its alternatives, in
    their order (jobs.with_choices): what a job keeps for its body."""
    return [
        placed_outline_of(plan, request),
        *(placed_outline_of(other, request) for other in plan.alternatives),
    ]


def with_placed(
    body: RouteResultBody, placed: Sequence[list[list[LatLon]]]
) -> RouteResultBody:
    """`body` with `placed` (placed_outlines) on it and its alternatives;
    without any, as it is. Only the bodies of this API carry it: the
    engine's RouteResult does not."""
    if not placed:
        return body
    body.placed_outline = placed[0]
    for other, lines in zip(body.alternatives, placed[1:], strict=False):
        other.placed_outline = lines
    return body


def _unnamed(plan: Plan) -> Plan:
    """An image's route names no shape and no word."""
    return replace(plan, result=replace(plan.result, shape=None, word=None))
