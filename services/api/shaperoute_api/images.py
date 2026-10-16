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
import math
from dataclasses import dataclass, replace
from typing import cast

from PIL import Image
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
from route_engine.shapes.outline import InvalidOutlineError, Outline, parse_outline
from route_engine.water import WaterSource

from shaperoute_api.job_times import noted
from shaperoute_api.paddling import plan_water
from shaperoute_api.schemas import MAX_IMAGE_BYTES, ImageOutlineBody

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

    def __post_init__(self) -> None:
        check_start(self.start)
        # Only a shape of the catalogue on the water (ADR-0161), whatever
        # the distance: "... not an image".
        check_drawn_on_land(self.activity, "an image")
        # The limits of its activity: 10-30 km by bike (TASK-190).
        check_distance(self.distance_m, self.activity)
        check_activity(self.activity)

    @property
    def name(self) -> str:
        return IMAGE_NAME


# What route jobs and /gpx take.
AnyRequest = RouteRequest | ImageRequest


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
    of its activity (TASK-190)."""
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
    placed on the water `source` gives (TASK-191): there are no roads."""
    if request.activity in WATER_ACTIVITIES:
        # ImageRequest and the words of RouteRequest refuse the water.
        assert isinstance(request, RouteRequest)
        return plan_water(request, cast(WaterSource, source))
    roads = cast(GraphLoader, source)
    # The job's source keeps how the nearby starts went, for its times.
    if isinstance(request, ImageRequest):
        plan = noted(source, plan_nearby(image_job(request), request.start, roads))
        return replace(
            _unnamed(plan), alternatives=[_unnamed(p) for p in plan.alternatives]
        )
    job = ShapeJob.of_request(request)
    return noted(source, plan_nearby(job, request.start, roads))


def _unnamed(plan: Plan) -> Plan:
    """An image's route names no shape and no word."""
    return replace(plan, result=replace(plan.result, shape=None, word=None))
