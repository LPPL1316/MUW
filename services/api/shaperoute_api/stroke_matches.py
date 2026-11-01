"""A stroke drawn on the map, anchored to the roads (TASK-347 part A,
ADR-0300): the bodies of POST /stroke-matches and the match itself. The
route and its probe are in stroke_matches_api.py: this module also runs in
Pyodide, on the phone (on_phone.match_json), where there is no FastAPI.

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

from pydantic import BaseModel, ConfigDict, Field, model_validator
from route_engine.models import (
    InvalidRequestError,
    check_activity,
    check_drawn_on_land,
    check_start,
)
from route_engine.network import AREA_MARGIN_M, area_around, nearest_nodes
from route_engine.optimizer import GraphLoader
from route_engine.stroke_match import (
    DEFAULT_FIT,
    StrokeMatch,
    check_fit,
    snap_stroke,
    stroke_length_m,
)

from shaperoute_api.activity_graphs import check_supported
from shaperoute_api.schemas import ACTIVITY_DESCRIPTION

# The most points of one stroke: the app simplifies the finger's line before
# sending it (Douglas-Peucker at 1% of the drawing), and the engine traces
# through at most 64 anchors of it whatever their number; beyond this the
# stroke is split by the app (ADR-0300, «tratto lungo»). shared-types has
# the same two limits.
MAX_STROKE_POINTS = 500
# The longest stroke, in metres along its points: a stroke of a drawing of
# a few km; a longer one is split by the app. Whatever the activity: by bike
# too a stroke is a piece of the drawing, not the route.
MAX_STROKE_M = 10_000
# Digits of the points answered: a tenth of a metre, as the API's zones.
DIGITS = 6

TOO_LONG = f"the stroke is longer than {MAX_STROKE_M // 1000} km along its points"


class StrokeMatchRequestBody(BaseModel):
    """What the app sends: StrokeMatchRequest in packages/shared-types."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    activity: str = Field(default="running", description=ACTIVITY_DESCRIPTION)
    fit: float | None = Field(
        default=None,
        description=(
            "The magnet, from 0 (faithful to the drawing: tight zones and "
            "corridor) to 1 (today's tracing, wide); the engine's default "
            f"({DEFAULT_FIT:g}) when missing."
        ),
        examples=[0.5],
    )
    line: list[tuple[float, float]] = Field(
        min_length=2,
        max_length=MAX_STROKE_POINTS,
        description=(
            "The stroke as drawn, [lat, lon] points in order, at most "
            f"{MAX_STROKE_POINTS} and {MAX_STROKE_M // 1000} km long."
        ),
    )
    # `from` is a keyword in Python: the field is from_ here, "from" on the
    # wire, as the contract names it.
    from_: tuple[float, float] | None = Field(
        default=None,
        alias="from",
        description=(
            "Where the stroke before ended, as [lat, lon]: the route starts at "
            "the road node nearest to it, so the strokes join along the "
            "roads. Missing for the first stroke."
        ),
        examples=[None],
    )

    @model_validator(mode="after")
    def _within_limits(self) -> StrokeMatchRequestBody:
        # The same checks as a route request's: InvalidRequestError, 422.
        check_supported(self.activity)
        check_drawn_on_land(self.activity, "a stroke")
        check_activity(self.activity)
        for point in self.line:
            check_start(point)
        if self.from_ is not None:
            check_start(self.from_)
        if self.fit is not None:
            check_fit(self.fit)
        if stroke_length_m(self.line) > MAX_STROKE_M:
            raise InvalidRequestError(TOO_LONG)
        return self


class StrokeMatchBody(BaseModel):
    """What the app gets back: StrokeMatchResult in packages/shared-types."""

    points: list[tuple[float, float]] = Field(
        description=(
            "The roads that draw the stroke, as [lat, lon] points from the "
            "node nearest to `from` (or to the first point) to the roads near "
            "the last point."
        )
    )
    away_m: list[float] = Field(
        description=(
            "For each point of the stroke as sent, in order, how far the "
            "route runs from it, in metres: the app colours the far ones."
        )
    )
    off_roads: bool = Field(
        description=(
            "True when the drawn points are, on average, farther from a road "
            "than the engine's sparse-network threshold: the stroke is in the "
            "fields, and the match is a guess the app may leave as a ghost."
        )
    )

    @classmethod
    def of(cls, match: StrokeMatch) -> StrokeMatchBody:
        return cls(
            points=[
                (round(lat, DIGITS), round(lon, DIGITS)) for lat, lon in match.points
            ],
            away_m=[round(d, 1) for d in match.away_m],
            off_roads=match.off_roads,
        )


def match_stroke(body: StrokeMatchRequestBody, roads: GraphLoader) -> StrokeMatch:
    """The engine's match of the stroke, on the graph of the area around it
    and `from` (the zone cropped, as for a route): InvalidRequestError and
    ShapeNotDrawableError as the engine raises them, MapDataUnavailableError
    from `roads`."""
    around = [*body.line, *([body.from_] if body.from_ is not None else [])]
    graph = roads.load(area_around(around, AREA_MARGIN_M))
    start_node = None
    if body.from_ is not None:
        [start_node], _ = nearest_nodes(graph, [body.from_])
    return snap_stroke(list(body.line), graph, body.activity, body.fit, start_node)
