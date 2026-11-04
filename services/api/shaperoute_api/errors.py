"""From an exception of the engine, or of the AI, to what the API answers
(docs/API.md).

Used both by POST /routes, as an HTTP error, and by route jobs, as the
error of a failed job: the two paths say the same thing.
"""

from __future__ import annotations

import math

from route_engine.models import (
    DISTANCE_LIMITS_M,
    WATER_ACTIVITIES,
    InvalidRequestError,
)
from route_engine.optimizer import ShapeNotDrawableError
from route_engine.walking import API_DISTANCE_LIMITS_M
from shaperoute_ai.reading import InvalidTextError, ModelUnavailableError

from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.schemas import ErrorDetail

ENGINE_FAILED = "The route engine failed; see the API log."
# On the water a shape fits up to some distance and no further (ADR-0154):
# the distance suggested is rounded down to this, so that it fits when asked
# (TASK-191, ADR-0164). Half a km: paddling routes are 1-5 km.
WATER_STEP_M = 500


def error_of(exc: Exception, activity: str = "running") -> tuple[int, ErrorDetail]:
    """HTTP status and error; anything unknown is an engine error, whose
    details stay in the log (ADR-0026, InvalidRouteError included). The
    distance suggested is one `activity` may ask for (TASK-190)."""
    if isinstance(exc, InvalidRequestError | InvalidTextError):
        return 422, ErrorDetail(code="invalid_request", message=str(exc))
    if isinstance(exc, ShapeNotDrawableError):
        return 422, ErrorDetail(
            code="shape_not_drawable",
            message=str(exc),
            suggested_distance_m=suggested_distance(exc.best_distance_m, activity),
        )
    if isinstance(exc, MapDataUnavailableError):
        return 503, ErrorDetail(code="map_data_unavailable", message=str(exc))
    if isinstance(exc, ModelUnavailableError):
        return 503, ErrorDetail(code="ai_unavailable", message=str(exc))
    return 500, ErrorDetail(code="engine_error", message=ENGINE_FAILED)


def suggested_distance(
    best_distance_m: float | None, activity: str = "running"
) -> int | None:
    """The distance of the engine's best route, to the whole km and within
    the limits of a request of `activity`: one the user can ask for
    (TASK-031); 10-30 km by bike (TASK-190), 1-30 km on a walk (TASK-371).
    On the water, down to the half km it fits at, and None when that is
    below the shortest route: a shorter one cannot be asked (TASK-191)."""
    if best_distance_m is None:
        return None
    low, high = API_DISTANCE_LIMITS_M.get(activity, DISTANCE_LIMITS_M["running"])
    if activity in WATER_ACTIVITIES:
        fits = math.floor(best_distance_m / WATER_STEP_M) * WATER_STEP_M
        return None if fits < low else min(fits, high)
    km = round(best_distance_m / 1000)
    return min(max(km * 1000, low), high)
