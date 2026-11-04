"""Request and response bodies: the shared-types contract, field for field.

Pydantic checks types only. The allowed values (distances, shapes,
activities) are checked once, by the engine's RouteRequest (models.py).
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator
from route_engine.anchored import PLACEMENTS
from route_engine.directions import GROUP_M, Turn
from route_engine.image_outline import MAX_POINTS as MAX_OUTLINE_POINTS
from route_engine.models import (
    DISTANCE_LIMITS_M,
    MAX_DISTANCE_M,
    SUPPORTED_ACTIVITIES,
    RouteResult,
)
from route_engine.outline_edits import MAX_DETAIL_POINTS, MAX_DRAWN_POINTS
from route_engine.pen_up import walks_problem
from route_engine.pieces import compose_shape
from route_engine.shapes import SUPPORTED_SHAPES, in_pieces
from route_engine.words import (
    ALPHABET,
    LETTER_DISTANCE_M,
    MAX_WORD_LETTERS,
    spell_letters,
)
from shaperoute_ai.reading import MAX_TEXT_LENGTH

# The largest image POST /image-outlines takes, and its length in base64
# (ADR-0069): a phone photo re-encoded as JPEG is 1-4 MB.
MAX_IMAGE_BYTES = 10_000_000
MAX_IMAGE_BASE64 = 4 * -(-MAX_IMAGE_BYTES // 3)
# The shapes of the catalogue that may be drawn with the pen up (TASK-223).
PEN_UP_SHAPES = tuple(name for name in SUPPORTED_SHAPES if in_pieces(name))
# A walk between two letters of a word with the pen up (TASK-197), or two
# pieces of a shape (TASK-223): its first and last point, indices into the
# route's points; one fewer than letters or pieces, 8 for the sun. On the
# water the route also comes back to the outline it left (TASK-226): one
# more than that, 9 for the sun.
Walk = tuple[int, int]
MAX_WALKS = max(
    MAX_WORD_LETTERS - 1,
    *(len(compose_shape(name).letters) for name in PEN_UP_SHAPES),
)
# A stretch walked with the bike on foot (TASK-206, ADR-0167): its first and
# last point, indices into the route's points, as a walk.
Stretch = tuple[int, int]
# The most a route kept may have (a favorite): far above any drawn, which
# walk a few blocks on 10-20 km (Trento, TASK-206).
MAX_ON_FOOT = 1000
# Each activity has its own distances (TASK-190): "1000–50000 for running,
# 10000–30000 for cycling".
DISTANCE_DESCRIPTION = "Target distance in metres, " + ", ".join(
    f"{DISTANCE_LIMITS_M[a][0]}–{DISTANCE_LIMITS_M[a][1]} for {a}"
    for a in SUPPORTED_ACTIVITIES
)
ACTIVITY_DESCRIPTION = (
    f"One of: {', '.join(SUPPORTED_ACTIVITIES)}; cycling is drawn on the "
    f"roads a bike may ride, one-way streets kept (TASK-190); paddling on a "
    f"lake or the sea within 1 km of the shore, from a start on the shore, "
    f"a shape of the catalogue only (TASK-191)."
)
WALKS_DESCRIPTION = (
    "A word with the pen up (TASK-197), or a shape in pieces (TASK-223): "
    "[from, to] indices into points, both included, of each stretch walked "
    "from one letter or piece to the next without drawing; in order, the "
    "next beginning where a walk ends. On the water (TASK-226) they are "
    "paddled: from the outline to a piece, between the pieces and back to "
    "the outline. Empty for a shape with the pen down, an image and a word "
    "without; missing from an older API."
)
ON_FOOT_DESCRIPTION = (
    "By bike (TASK-206): [from, to] indices into points, both included, of "
    "each stretch walked with the bike on foot, in order; also in the "
    "approach from a nearby start. Empty on foot and on the water; missing "
    "from an older API."
)


def _check_walks(walks: list[Walk], count: int, what: str = "walk") -> None:
    """Pydantic's check of `walks` against a route of `count` points; also
    of the stretches with the bike on foot, named by `what`."""
    problem = walks_problem(walks, count, what)
    if problem is not None:
        raise ValueError(problem)


# Where the shape goes (TASK-347, ADR-0300) and the magnet of an anchored one.
PLACEMENT_DESCRIPTION = (
    f"One of: {', '.join(PLACEMENTS)}. free: the search turns, scales and moves "
    "the shape to where the roads draw it best, as before. anchored: the shape "
    "stays where and as it was drawn (its first point on start, upright, at the "
    "scale of distance_m), traced once with the magnet fit and never rescaled; "
    "a distance off by more than 10% is a warning, not a refusal. Only on the "
    "roads: on the water, invalid_request."
)
FIT_DESCRIPTION = (
    "With placement anchored: the magnet, from 0 (faithful to the drawing: "
    "tight zones and corridor) to 1 (today's tracing, wide); the engine's "
    "default when missing. With placement free, invalid_request."
)


class RouteRequestBody(BaseModel):
    """What the app sends: RouteRequest in packages/shared-types."""

    # A misspelt field is an error, not a silently ignored extra.
    model_config = ConfigDict(extra="forbid")

    start: tuple[float, float] = Field(
        description="Start point as [lat, lon], WGS84.",
        examples=[[46.0671, 11.1214]],
    )
    shape: str | None = Field(
        default=None,
        description=f"One of: {', '.join(SUPPORTED_SHAPES)}; or give a word.",
        examples=["heart"],
    )
    word: str | None = Field(
        default=None,
        description=(
            f"A word written one letter at a time (TASK-056), instead of a "
            f"shape: at most {MAX_WORD_LETTERS} of the letters "
            f"{spell_letters(ALPHABET)} (TASK-059), upper or lower case, and "
            f"{LETTER_DISTANCE_M / 1000:g} km of route for each."
        ),
        examples=[None],
    )
    distance_m: int = Field(description=DISTANCE_DESCRIPTION, examples=[5000])
    activity: str = Field(default="running", description=ACTIVITY_DESCRIPTION)
    style: str = Field(
        default="round",
        description=(
            "The letters of a word (TASK-080): round, or block for square "
            "letters on the street grid (ADR-0072). Only round with a shape."
        ),
    )
    pen_up: bool = Field(
        default=False,
        description=(
            "With a word (TASK-197): each letter drawn on its own, and the "
            "route walks from one to the next without drawing (walks in the "
            "result). The distance is the letters'. So with a shape in "
            f"pieces, one of {', '.join(PEN_UP_SHAPES)}, piece by piece "
            "(TASK-223); on the water too (TASK-226), where the distance is "
            "the whole route's, the stretches with the pen up included."
        ),
    )
    # Missing from an app of before TASK-238.
    near: tuple[float, float] | None = Field(
        default=None,
        description=(
            "On the water (TASK-238), where the centre of the shape is wanted, "
            "as [lat, lon]: the centre of a result before, moved. The shape is "
            "placed at the nearest place to it where it fits. With another "
            "activity, invalid_request."
        ),
        examples=[None],
    )
    # Missing from an app of before TASK-347.
    placement: str = Field(default="free", description=PLACEMENT_DESCRIPTION)
    fit: float | None = Field(
        default=None, description=FIT_DESCRIPTION, examples=[None]
    )


class DirectionBody(BaseModel):
    """What to do at one junction: Direction in packages/shared-types
    (route_engine/directions.py, ADR-0045)."""

    node: int = Field(description="OpenStreetMap id of the junction's node.")
    point: tuple[float, float] = Field(description="The junction as [lat, lon].")
    distance_m: float = Field(description="Along the route from its start.")
    turn: Turn
    angle_deg: float = Field(description="The turn, positive to the right.")
    street: str | None = Field(
        description="Name or ref of the road entered; null when OSM has neither."
    )
    road_type: str | None = Field(description='OSM highway, like "footway".')
    branches: int = Field(description="Roads that meet at the junction.")
    joined: bool = Field(
        description=f"Less than {GROUP_M:g} m after the direction before: read with it."
    )
    # Missing from an older API, or in a GPX request from an older app.
    along: str | None = Field(
        default=None,
        description=(
            "When street is null, the street the road runs along, deduced "
            "(ADR-0054, ADR-0057); never a name of the road itself."
        ),
    )


class RouteResultBody(BaseModel):
    """What the app gets back: RouteResult in packages/shared-types."""

    points: list[tuple[float, float]] = Field(
        description=(
            "The route as [lat, lon] points, closed; a word with the pen up "
            "goes from its first letter to its last, a shape in pieces from "
            "its outline to its last piece."
        )
    )
    distance_m: float = Field(description="Distance actually covered, in metres.")
    similarity: float = Field(description="How much the route looks like the shape.")
    shape: str | None = Field(description="Null for a word or an image.")
    warnings: list[str]
    # Missing in a GPX request from an older app: nothing to check there.
    directions: list[DirectionBody] = Field(
        default_factory=list,
        description=(
            "Turn by turn, the start first; empty without a search, and on "
            "the water, which has no roads (TASK-191)."
        ),
    )
    word: str | None = Field(
        default=None, description="The word in capitals; null for a shape or an image."
    )
    # Missing in a GPX request from an older app.
    alternatives: list[RouteResultBody] = Field(
        default_factory=list,
        description=(
            "Other routes for the same request, best first, to choose from "
            "(TASK-093): whole results, with no alternatives of their own. "
            "None on the water (TASK-191)."
        ),
    )
    # Missing from an older API, and in a GPX request from an older app.
    walks: list[Walk] = Field(
        default_factory=list, max_length=MAX_WALKS, description=WALKS_DESCRIPTION
    )
    # Missing from an older API, and in a GPX request from an older app.
    on_foot: list[Stretch] = Field(
        default_factory=list, description=ON_FOOT_DESCRIPTION
    )
    # Missing from an older API, and in a GPX request from an older app.
    better_distance_m: int | None = Field(
        default=None,
        description=(
            "A distance in whole km where the search found the shape clearly "
            "better drawn, to offer as «Try N km» (TASK-234, ADR-0197); null "
            "without one, in the alternatives and on the water."
        ),
    )
    # Missing from an older API, and in a GPX request from an older app.
    centre: tuple[float, float] | None = Field(
        default=None,
        description=(
            "On the water, the centre of the shape as placed, as [lat, lon] "
            "(TASK-238): moved and sent back as the request's near, it moves "
            "the shape. Null on the roads."
        ),
    )
    # Missing from an older API, and in a GPX request from an older app.
    rotation_deg: float = Field(
        default=0.0,
        ge=-180.0,
        le=180.0,
        description=(
            "How far the shape is turned, in degrees counterclockwise, in "
            "(-180, 180] (TASK-232, ADR-0195): the app turns the map by its "
            "opposite (a MapLibre bearing of -rotation_deg) so the drawing "
            "reads upright. 0 for a shape that turns freely, like the "
            "circle; each alternative has its own."
        ),
    )

    # Missing from an older API, and in a GPX request from an older app.
    placed_outline: list[list[tuple[float, float]]] = Field(
        default_factory=list,
        description=(
            "The drawing as the engine placed it, in [lat, lon] lines (TASK-347, "
            "ADR-0300): turned, scaled and moved by the search when free, left "
            "where it was drawn when anchored; one closed line for a shape, one "
            "open line per letter or piece with the pen up. The app draws it as "
            "a ghost under the route. Empty on the water."
        ),
    )

    @model_validator(mode="after")
    def _walks_within_points(self) -> Self:
        _check_walks(self.walks, len(self.points))
        _check_walks(self.on_foot, len(self.points), "stretch on foot")
        return self

    @classmethod
    def from_result(cls, result: RouteResult) -> RouteResultBody:
        return cls(**asdict(result))


ErrorCode = Literal[
    "invalid_request",
    "shape_not_drawable",
    "map_data_unavailable",
    "engine_error",
    "http_error",
    "ai_unavailable",
    "image_not_usable",
    # A line drawn on an image's outline gives no outline (TASK-079).
    "outline_edit_rejected",
    # A key is set and the request has the wrong one (TASK-081, ADR-0076).
    "unauthorized",
    # Too many POSTs from one client in a minute (TASK-081); with accounts,
    # also too many wrong passwords for one email (TASK-114).
    "too_many_requests",
    # Accounts (TASK-114, ADR-0115): signing up with an email or a username
    # already used; a wrong email or password; no token, or an unknown one;
    # a session unused for 90 days; an API without a database.
    "email_taken",
    "username_taken",
    "wrong_credentials",
    "not_signed_in",
    "session_expired",
    "accounts_unavailable",
    # A comment the filter refuses (TASK-120, ADR-0176): `reason` says why.
    "comment_rejected",
    # No contest open, nor one closed less than a week ago (TASK-299).
    "no_contest",
    # An entry in a monthly challenge refused (TASK-343, ADR-0296): the
    # contest takes no entries (ended, closed, or without a theme); the
    # drawing cannot take part (another's, not for everyone, imported,
    # published outside the period, hidden).
    "contest_closed",
    "not_entrant",
    # A run added from a file is not sent to Strava (TASK-312, ADR-0272).
    "imported_run",
    # Signing in with Apple or Google (TASK-322, ADR-0282): no account yet
    # for that identity or its email, so the app asks for a username; the
    # server has no keys for that provider.
    "new_account",
    "provider_unavailable",
]

# Why an image gives no outline: InvalidImageError.reason in
# route_engine/image_outline.py (ADR-0068).
ImageReason = Literal[
    "format",
    "unreadable",
    "background",
    "no_subject",
    "scattered",
    "edge",
    "small",
    "jagged",
]

# Why a line drawn on an outline was refused: InvalidEditError.reason in
# route_engine/outline_edits.py (TASK-079, ADR-0074).
EditReason = Literal[
    "short",
    "covers_detail",
    "too_many_corners",
]

# Why a comment was refused: check_comment in comment_filter.py (TASK-213,
# ADR-0176).
CommentReason = Literal["negative"]


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    # Only with shape_not_drawable: a distance the shape fits, in whole km
    # (TASK-031).
    suggested_distance_m: int | None = None
    # Only with image_not_usable: why the engine found no outline (TASK-073);
    # with outline_edit_rejected, why the drawing was refused (TASK-079);
    # with comment_rejected, why the comment was (TASK-120).
    reason: ImageReason | EditReason | CommentReason | None = None


class ErrorBody(BaseModel):
    """Every error the API returns has this shape."""

    error: ErrorDetail


JobStatus = Literal["queued", "downloading_map", "computing", "done", "failed"]


class RouteJobBody(BaseModel):
    """A route request the API is working on (ADR-0032): RouteJob in
    packages/shared-types."""

    job_id: str
    status: JobStatus
    result: RouteResultBody | None = Field(description="Only when status is done.")
    error: ErrorDetail | None = Field(description="Only when status is failed.")


class GpxRequestBody(BaseModel):
    """What the app sends to POST /gpx: GpxRequest in packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    # An image route has its own request (TASK-073), defined below.
    request: RouteRequestBody | ImageRouteRequestBody
    result: RouteResultBody


# The longest run POST /track-scores takes: a fix every 5 m (the app's
# FIX_EVERY_M) along twice the longest route.
MAX_TRACK_FIXES = 2 * MAX_DISTANCE_M // 5
# The longest planned route it takes: far more points than the engine writes.
MAX_ROUTE_POINTS = 50_000


class TrackFixBody(BaseModel):
    """One GPS fix of a run: TrackFix in packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    point: tuple[float, float] = Field(description="Where, as [lat, lon].")
    time_ms: float = Field(description="When, in milliseconds on the phone's clock.")
    accuracy_m: float | None = Field(
        default=None, description="Radius of the fix's error; null when unknown."
    )


class TrackScoreRequestBody(BaseModel):
    """What the app sends to POST /track-scores: TrackScoreRequest in
    packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    points: list[tuple[float, float]] = Field(
        max_length=MAX_ROUTE_POINTS,
        description="The planned route: RouteResult.points.",
    )
    similarity: float = Field(
        ge=0.0, le=1.0, description="The planned route's: RouteResult.similarity."
    )
    track: list[TrackFixBody] = Field(
        max_length=MAX_TRACK_FIXES, description="The run, fix by fix, in order."
    )
    walks: list[Walk] = Field(
        default_factory=list,
        max_length=MAX_WALKS,
        description=(
            "The planned route's: RouteResult.walks (TASK-197). The run is "
            "then judged on the letters alone. Missing from an older app."
        ),
    )

    @model_validator(mode="after")
    def _walks_within_points(self) -> Self:
        _check_walks(self.walks, len(self.points))
        return self


class TrackScoreBody(BaseModel):
    """What the app gets back: TrackScore in packages/shared-types
    (route_engine/track_score.py, ADR-0090)."""

    score: int = Field(description="From 0 to 100.")
    fidelity: float = Field(description="How much of the plan was run, 0 to 1.")
    covered: float = Field(description="Share of the route with the run near it.")
    on_route: float = Field(description="Share of the run near the route.")
    distance_m: float = Field(description="Length of the run, in metres.")


class ShapeReadingRequestBody(BaseModel):
    """What the app sends to POST /shape-readings: ShapeReadingRequest in
    packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        description=(
            f"The words of the shape field, at most {MAX_TEXT_LENGTH} characters."
        ),
        examples=["stemma della Ferrari"],
    )


class ShapeReadingBody(BaseModel):
    """The AI's reading of the words (ADR-0012): ShapeReading in
    packages/shared-types."""

    text: str = Field(description="The words as read: single spaces, none at the ends.")
    shape: str | None = Field(
        description=(
            f"One of: {', '.join(SUPPORTED_SHAPES)}; null when none fits the words."
        )
    )


class ImageOutlineRequestBody(BaseModel):
    """What the app sends to POST /image-outlines (ADR-0069):
    ImageOutlineRequest in packages/shared-types."""

    model_config = ConfigDict(extra="forbid")

    image: str = Field(
        max_length=MAX_IMAGE_BASE64,
        description=(
            f"A PNG or JPEG file in base64, at most {MAX_IMAGE_BYTES // 1_000_000} "
            f"MB before encoding: one clear subject on a plain background."
        ),
    )


class ImageOutlineBody(BaseModel):
    """The outline the engine traced from the image (ADR-0068, ADR-0069):
    ImageOutline in packages/shared-types."""

    points: list[tuple[float, float]] = Field(
        description=(
            "The outline, closed, centred and scaled into [-1, 1], y upwards: "
            "what an image route request sends back."
        )
    )
    image_points: list[tuple[float, float]] = Field(
        description=(
            "The same corners over the image, as shares of its width and "
            "height from the top left: to draw the outline on the picture."
        )
    )
    aspect: float = Field(description="Width over height of the image, upright.")
    strokes: list[list[tuple[float, float]]] = Field(
        default_factory=list,
        description=(
            "The other subjects of the image (TASK-084) and the details "
            "drawn by hand (TASK-079), in the frame of points: each starts on "
            "the outline or on an earlier one, and the route goes along it "
            "and back; one that ends on its own second point closes a loop, "
            "drawn once. None for one subject as traced."
        ),
    )
    image_strokes: list[list[tuple[float, float]]] = Field(
        default_factory=list,
        description="The same strokes over the image, like image_points.",
    )


class ImageRouteRequestBody(BaseModel):
    """What the app sends to POST /image-route-jobs: ImageRouteRequest in
    packages/shared-types. The outline is the one POST /image-outlines
    answered, checked again like any input (ADR-0069)."""

    model_config = ConfigDict(extra="forbid")

    start: tuple[float, float] = Field(
        description="Start point as [lat, lon], WGS84.",
        examples=[[46.0671, 11.1214]],
    )
    outline: list[tuple[float, float]] = Field(
        min_length=4,
        max_length=MAX_OUTLINE_POINTS + 1,
        description=(
            f"The points of an ImageOutline: closed, within [-1, 1], at most "
            f"{MAX_OUTLINE_POINTS} corners."
        ),
    )
    strokes: list[list[tuple[float, float]]] = Field(
        default_factory=list,
        max_length=MAX_DETAIL_POINTS // 2,
        description=(
            f"The strokes of an ImageOutline, unchanged (TASK-079): at most "
            f"{MAX_DETAIL_POINTS} points in all, those run out and back "
            f"counted twice. None for an outline without."
        ),
    )
    distance_m: int = Field(description=DISTANCE_DESCRIPTION, examples=[15000])
    activity: str = Field(default="running", description=ACTIVITY_DESCRIPTION)
    pen_up: bool = Field(
        default=False,
        description="Only for a word (TASK-197): true is refused, invalid_request.",
    )
    # Missing from an app of before TASK-347.
    placement: str = Field(default="free", description=PLACEMENT_DESCRIPTION)
    fit: float | None = Field(
        default=None, description=FIT_DESCRIPTION, examples=[None]
    )


class ImageOutlineEditRequestBody(BaseModel):
    """What the app sends to POST /image-outline-edits (TASK-079, ADR-0074):
    ImageOutlineEditRequest in packages/shared-types. The outline as the app
    shows it over the picture, and one line drawn on it with a finger; the
    API keeps nothing between two edits."""

    model_config = ConfigDict(extra="forbid")

    image_points: list[tuple[float, float]] = Field(
        min_length=4,
        max_length=MAX_OUTLINE_POINTS + 1,
        description="The image_points of the ImageOutline shown.",
    )
    image_strokes: list[list[tuple[float, float]]] = Field(
        default_factory=list,
        max_length=MAX_DETAIL_POINTS // 2,
        description="The image_strokes of the ImageOutline shown.",
    )
    aspect: float = Field(description="The aspect of the ImageOutline shown.")
    kind: Literal["part", "detail"] = Field(
        description=(
            "part: a closed line joined to the silhouette; detail: a line from "
            "the outline, which the route goes along and back."
        )
    )
    line: list[tuple[float, float]] = Field(
        min_length=2,
        max_length=MAX_DRAWN_POINTS,
        description=(
            "The line drawn, as shares of the image's width and height from "
            "the top left, like image_points."
        ),
    )
