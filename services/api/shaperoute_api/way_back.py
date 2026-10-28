"""The way back to a route, for the app (TASK-314, ADR-0274).

A runner off the route asks for the way back to it on the streets
(route_engine.way_back): where they are, and the stretch of the route where
they may rejoin it, which the app cuts (ADR-0263). The answer has the way's
points, where it rejoins and the directions of a route, with the street an
unnamed road runs along (ADR-0057), as POST /route-directions gives them.

The same bodies and the same code for POST /way-back (way_back_api.py) and
for the phone (on_phone.way_back_json): no FastAPI here. The zone is one
already kept: a way back never waits for OpenStreetMap.
"""

from __future__ import annotations

from dataclasses import asdict, replace
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from route_engine.models import WATER_ACTIVITIES, InvalidRequestError
from route_engine.network import BBox
from route_engine.optimizer import GraphLoader
from route_engine.way_back import WayBack, way_back

from shaperoute_api.activity_graphs import Graphs, check_supported, source_for
from shaperoute_api.alongs import with_alongs
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.jobs import KnowsNames
from shaperoute_api.line_directions import bbox_around
from shaperoute_api.schemas import DirectionBody

# The graph is cut this far around the runner and the stretch: a way back
# that goes further out than this round them is rare, and a wider crop
# takes longer.
MARGIN_M = 500.0
# The stretch of a run of 2 m points over the longest window of ADR-0263
# the app sends (a few km), with room.
MAX_AHEAD_POINTS = 10_000
# The answer's coordinates to about a centimetre, its metres and turns to the
# tenth.
COORD_DIGITS = 7
TENTH_DIGITS = 1

ON_THE_WATER = "No way back on the water: the straight line is the way."
NOT_KEPT = "No map kept here for this area."

Latitude = Annotated[float, Field(ge=-90.0, le=90.0)]
Longitude = Annotated[float, Field(ge=-180.0, le=180.0)]
Point = tuple[Latitude, Longitude]


class WayBackRequestBody(BaseModel):
    """What the app sends to POST /way-back:
    packages/shared-types/fixtures/way-back-request.json."""

    model_config = ConfigDict(extra="forbid")

    activity: str = Field(
        default="running",
        description="The run's activity: the way follows its network.",
    )
    here: Point = Field(description="Where the runner is, as [lat, lon].")
    ahead: list[Point] = Field(
        min_length=2,
        max_length=MAX_AHEAD_POINTS,
        description=(
            "The stretch of the route where the runner may rejoin it, as "
            "[lat, lon] points in the route's order (ADR-0263)."
        ),
    )


class WayBackBody(BaseModel):
    """What the app gets back: fixtures/way-back.json."""

    points: list[tuple[float, float]] = Field(
        description="The way, from the runner along the streets to the route."
    )
    distance_m: float = Field(description="The way's length.")
    rejoin: tuple[float, float] = Field(
        description="Where the way reaches the route, as [lat, lon]."
    )
    rejoin_m: float = Field(
        description="Where `rejoin` is along `ahead`, from its first point."
    )
    directions: list[DirectionBody] = Field(
        description=(
            "Turn by turn, as RouteResult.directions, distance_m along "
            "`points`: the street the way starts on first, the turn onto "
            "the route last."
        )
    )

    @classmethod
    def of(cls, way: WayBack) -> WayBackBody:
        """`way`, its points to about a centimetre and its metres to the
        tenth: the same on every machine, and a lighter answer."""
        return cls(
            points=[_rounded(point) for point in way.points],
            distance_m=round(way.distance_m, TENTH_DIGITS),
            rejoin=_rounded(way.rejoin),
            rejoin_m=round(way.rejoin_m, TENTH_DIGITS),
            directions=[
                DirectionBody(
                    **{
                        **asdict(d),
                        "point": _rounded(d.point),
                        "distance_m": round(d.distance_m, TENTH_DIGITS),
                        "angle_deg": round(d.angle_deg, TENTH_DIGITS),
                    }
                )
                for d in way.directions
            ],
        )


def _rounded(point: tuple[float, float]) -> tuple[float, float]:
    return (round(point[0], COORD_DIGITS), round(point[1], COORD_DIGITS))


def find_way_back(graphs: Graphs, body: WayBackRequestBody) -> WayBack:
    """The way back `body` asks for, on the zone of its activity's network
    already kept. InvalidRequestError on the water or with no way within
    MAX_WAY_M; MapDataUnavailableError with no zone kept for the area."""
    check_supported(body.activity)
    if body.activity in WATER_ACTIVITIES:
        raise InvalidRequestError(ON_THE_WATER)
    source = source_for(graphs, body.activity)
    bbox = bbox_around([body.here, *body.ahead], MARGIN_M)
    if _not_kept(source, bbox):
        raise MapDataUnavailableError(NOT_KEPT)
    graph = source.load(bbox)
    way = way_back(graph, body.here, body.ahead)
    names = source.named_roads if isinstance(source, KnowsNames) else None
    return replace(way, directions=with_alongs(graph, way.nodes, way.directions, names))


def _not_kept(source: GraphLoader, bbox: BBox) -> bool:
    """Whether loading `bbox` would download it: ZoneGraphs says; the
    phone's zones and the tests' graphs never download."""
    needs_download = getattr(source, "needs_download", None)
    return needs_download is not None and bool(needs_download(bbox))
