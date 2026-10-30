"""Central contract: RouteRequest in, RouteResult out (docs/ARCHITECTURE.md §3)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from route_engine.directions import Direction
from route_engine.shapes import SUPPORTED_SHAPES, in_pieces
from route_engine.words import (
    LETTER_DISTANCE_M,
    MAX_WORD_LETTERS,
    STYLES,
    InvalidWordError,
    Style,
    compose,
)

# The activities of the contract, what the API and the app offer:
# packages/shared-types mirrors them (ADR-0028). "cycling" joined them with
# the API's part of TASK-190 (ADR-0153), "paddling" with that of TASK-191
# (ADR-0164), "swimming" with that of TASK-323 (ADR-0283); an activity the
# engine draws joins them only when the API gives it its network, or its
# water.
SUPPORTED_ACTIVITIES: tuple[str, ...] = ("running", "cycling", "paddling", "swimming")

# Plausible target distances for running, in metres.
MIN_DISTANCE_M = 1_000
MAX_DISTANCE_M = 50_000

# Every activity the engine draws, each on its own network
# (network.NETWORKS) or on the water (WATER_ACTIVITIES), and its target
# distances in metres: a bike route is 10-30 km, the user's choice for a
# first step (TASK-190, ADR-0153); a paddling route 1-5 km, the user's choice
# too (TASK-191, ADR-0161): within 1 km of the shore a shape fits up to about
# 3 km at sea and 5-6 on a lake, and beyond that the error says what fits;
# an open-water swim 0.5-3 km, every lap and the legs from the shore
# (TASK-323, ADR-0283).
DISTANCE_LIMITS_M: dict[str, tuple[int, int]] = {
    "running": (MIN_DISTANCE_M, MAX_DISTANCE_M),
    "cycling": (10_000, 30_000),
    "paddling": (1_000, 5_000),
    "swimming": (500, 3_000),
}
ACTIVITIES: tuple[str, ...] = tuple(DISTANCE_LIMITS_M)

# The activities drawn on a lake or the sea, with no road network: where the
# shape fits on the water it is the route (water_fit.py, ADR-0154).
WATER_ACTIVITIES: frozenset[str] = frozenset({"paddling", "swimming"})
# Those that also take a drawn outline, an image's or one drawn by hand:
# a swim (TASK-323, the user's ask of 2026-10-29).
DRAWN_ON_WATER: frozenset[str] = frozenset({"swimming"})
# A swim goes round its shape this many times at most (TASK-323, the user's
# choice): 130 m of band hold about half a kilometre of shape.
MAX_SWIM_LAPS = 5
LAPS_SWIM_ONLY = "laps are for a swim"
# Why a word or an image on the water is refused (TASK-191, ADR-0161): only
# a shape of the catalogue is drawn there for now. The API says it for an
# image too (TASK-191 part B).
ON_WATER_SHAPES_ONLY = "on the water only a shape of the catalogue is drawn"


# Why a request with the pen up and no word is refused (TASK-197): the API
# says it for an image too.
PEN_UP_WITHOUT_WORD = "pen_up is for the letters of a word"
# A shape is drawn with the pen up only if it has pieces (TASK-223), on
# roads and on the water (TASK-226).
PEN_UP_WITHOUT_PIECES = f"{PEN_UP_WITHOUT_WORD}, or the pieces of a shape"


# A shape is moved only on the water (TASK-238): on the roads the search
# decides where it fits.
NEAR_ON_WATER_ONLY = "a shape is placed near a point only on the water"


# The turns of a swim (TASK-323, swim_turns.py): data of the contract, as
# the route, so here; swim_turns.py finds them, shore_names.py names them.
Side = Literal["left", "right"]


@dataclass(frozen=True)
class Landmark:
    """A place with a name on the shore, to turn opposite (shore_names)."""

    name: str
    # What it is, from OpenStreetMap: "beach_resort", "pier", "lighthouse"...
    kind: str
    point: tuple[float, float]
    # From the turn, and the direction to look, clockwise from north.
    distance_m: float
    bearing_deg: float


@dataclass(frozen=True)
class SwimTurn:
    """Where the route turns: the point, metres from the start of the
    swim, which way and by how much (0-180°), the lap (from 1), and the
    place on the shore to turn opposite, when there is one."""

    point: tuple[float, float]
    at_m: float
    side: Side
    angle_deg: float
    lap: int = 1
    landmark: Landmark | None = None


class InvalidRequestError(ValueError):
    """A RouteRequest field is outside its allowed range."""


@dataclass(frozen=True, kw_only=True)
class RouteRequest:
    start: tuple[float, float]
    distance_m: int
    # A shape of the catalogue, or a word written one letter at a time
    # (TASK-056): one of the two.
    shape: str | None = None
    word: str | None = None
    activity: str = "running"
    # The letters of a word (TASK-080, ADR-0075): "block" only for a word.
    style: Style = "round"
    # Each letter drawn on its own, walking from one to the next without
    # drawing (TASK-197, ADR-0157): for a word, or a shape in pieces, each
    # piece on its own (TASK-223, ADR-0185), on the water too (TASK-226,
    # ADR-0188).
    pen_up: bool = False
    # On the water, where the centre of the shape is wanted (TASK-238): the
    # `centre` of a route before, moved. The engine places the shape at the
    # nearest place to it where it fits.
    near: tuple[float, float] | None = None
    # A swim, how many times round its shape (TASK-323): fewer, a larger
    # shape, as many laps as that make the distance. None: the fewest it
    # fits in.
    laps: int | None = None

    def __post_init__(self) -> None:
        check_start(self.start)
        check_distance(self.distance_m, self.activity)
        if (self.shape is None) == (self.word is None):
            raise InvalidRequestError("give either a shape or a word, one of the two")
        if self.word is not None:
            check_drawn_on_land(self.activity, "a word")
            check_word(self.word, self.distance_m)
        elif self.shape not in SUPPORTED_SHAPES:
            raise InvalidRequestError(
                f"unknown shape {self.shape!r}; "
                f"choose one of: {', '.join(SUPPORTED_SHAPES)}"
            )
        check_activity(self.activity)
        if self.style not in STYLES:
            raise InvalidRequestError(
                f"unknown style {self.style!r}; choose one of: {', '.join(STYLES)}"
            )
        if self.style != "round" and self.word is None:
            raise InvalidRequestError(
                "a style is for the letters of a word, not a shape"
            )
        if self.pen_up and self.shape is not None and not in_pieces(self.shape):
            raise InvalidRequestError(f"{PEN_UP_WITHOUT_PIECES}; {self.shape} has none")
        if self.near is not None:
            if self.activity not in WATER_ACTIVITIES:
                raise InvalidRequestError(NEAR_ON_WATER_ONLY)
            check_start(self.near)
        check_laps(self.laps, self.activity)

    @property
    def name(self) -> str:
        """What is drawn, for names and messages: the shape, or the word
        in capitals."""
        return self.shape if self.word is None else self.word.strip().upper()


# The checks of RouteRequest that do not depend on the shape: the CLI also
# runs them for an outline read from a file (TASK-032).


def check_start(start: tuple[float, float]) -> None:
    lat, lon = start
    if not -90.0 <= lat <= 90.0:
        raise InvalidRequestError(f"latitude must be between -90 and 90, got {lat}")
    if not -180.0 <= lon <= 180.0:
        raise InvalidRequestError(f"longitude must be between -180 and 180, got {lon}")


def check_distance(distance_m: int, activity: str = "running") -> None:
    """Within the limits of `activity` (DISTANCE_LIMITS_M); an activity the
    engine does not draw has those of running, and check_activity refuses
    it afterwards, as before TASK-190."""
    own = activity != "running" and activity in DISTANCE_LIMITS_M
    low, high = DISTANCE_LIMITS_M[activity if own else "running"]
    if not low <= distance_m <= high:
        which = f" for {activity}" if own else ""
        raise InvalidRequestError(
            f"distance must be between {low} and {high} metres{which}, "
            f"got {distance_m}"
        )


def check_word(word: str, distance_m: int) -> None:
    """Letters the alphabet has, not too many, and enough distance for
    each (words.MAX_WORD_LETTERS, words.LETTER_DISTANCE_M)."""
    try:
        letters = len(compose(word).letters)
    except InvalidWordError as exc:
        raise InvalidRequestError(str(exc)) from None
    if letters > MAX_WORD_LETTERS:
        raise InvalidRequestError(
            f"a word has at most {MAX_WORD_LETTERS} letters, got {letters}"
        )
    needed_m = letters * LETTER_DISTANCE_M
    if distance_m < needed_m:
        raise InvalidRequestError(
            f"a {letters}-letter word needs at least {needed_m / 1000:g} km, "
            f"{LETTER_DISTANCE_M / 1000:g} km a letter; "
            f"got {distance_m / 1000:g} km"
        )


def check_activity(activity: str) -> None:
    if activity not in ACTIVITIES:
        raise InvalidRequestError(
            f"unsupported activity {activity!r}; "
            f"choose one of: {', '.join(ACTIVITIES)}"
        )


def check_drawn_on_land(activity: str, what: str) -> None:
    """Refuse `what` (a word, an image, an outline) for an activity on the
    water (WATER_ACTIVITIES): only a shape of the catalogue is drawn there."""
    if activity in WATER_ACTIVITIES:
        raise InvalidRequestError(f"{ON_WATER_SHAPES_ONLY}, not {what}")


def check_outline_drawn(activity: str, what: str) -> None:
    """Refuse `what` (an image, a drawing, an outline) where it is not drawn:
    on the water, but for a swim (DRAWN_ON_WATER, TASK-323)."""
    if activity not in DRAWN_ON_WATER:
        check_drawn_on_land(activity, what)


def check_laps(laps: int | None, activity: str) -> None:
    """None, or 1 to MAX_SWIM_LAPS for a swim (TASK-323)."""
    if laps is None:
        return
    if activity != "swimming":
        raise InvalidRequestError(LAPS_SWIM_ONLY)
    if not 1 <= laps <= MAX_SWIM_LAPS:
        raise InvalidRequestError(
            f"a swim goes round its shape 1 to {MAX_SWIM_LAPS} times, got {laps}"
        )


@dataclass(frozen=True)
class RouteResult:
    points: list[tuple[float, float]]
    distance_m: float
    similarity: float
    # The shape of the catalogue, or None for a word (TASK-056).
    shape: str | None
    warnings: list[str] = field(default_factory=list)
    # Turn-by-turn, from directions.guidance; the API fills it (TASK-048).
    directions: list[Direction] = field(default_factory=list)
    # The word in capitals, or None for a shape (TASK-056).
    word: str | None = None
    # Other routes for the same request, to choose from (TASK-093): whole
    # results, each with no alternatives of its own.
    alternatives: list[RouteResult] = field(default_factory=list)
    # A word with the pen up (TASK-197, ADR-0157): [from, to] indices into
    # `points`, both included, of each stretch walked from one letter to
    # the next without drawing; in order, the next letter beginning where a
    # walk ends. Empty for a shape, an image and a word without.
    walks: list[tuple[int, int]] = field(default_factory=list)
    # By bike (TASK-206, ADR-0167): [from, to] indices into `points`, both
    # included, of each stretch walked with the bike on foot, in order
    # (network.on_foot_stretches). Empty on foot and on the water.
    on_foot: list[tuple[int, int]] = field(default_factory=list)
    # A distance, in whole km, where the search found the shape clearly
    # better drawn (optimizer.better_distance, TASK-234, ADR-0197): for the
    # request, not its alternatives. None without one, and on the water.
    better_distance_m: int | None = None
    # On the water, the centre of the shape as placed (water_fit.WaterRoute):
    # moved and asked back as `RouteRequest.near`, it moves the shape
    # (TASK-238). None on the roads.
    centre: tuple[float, float] | None = None
    # How far the shape is turned, in degrees counterclockwise (ADR-0018),
    # in (-180, 180]: the app turns the map back by it so the drawing reads
    # upright (optimizer.shown_rotation, TASK-232, ADR-0195). 0 for a shape
    # that turns freely, like the circle, and without a search.
    rotation_deg: float = 0.0
    # A swim (TASK-323): how many times round its shape, how long one lap is
    # (the shape, without the legs from the shore and back), and its turns,
    # in order, every lap's, each with the place on the shore to turn
    # opposite (swim_turns.py, shore_names.py). 1, None and none for any
    # other route.
    laps: int = 1
    lap_m: float | None = None
    turns: list[SwimTurn] = field(default_factory=list)
