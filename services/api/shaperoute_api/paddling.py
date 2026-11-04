"""Paddling routes in the API (TASK-191 part B, ADR-0161, ADR-0164).

On the water there is no road network: the engine's `plan_paddling` places
a shape of the catalogue on a lake or the sea, within 1 km of the shore, and
joins it to a start on the shore reachable on foot (ADR-0154). The API gives
it the water of its cache folder, `<cache>/water/` beside the zones,
downloaded from Overpass on a miss, and answers its plan as any other route:
a RouteResult, with no directions (they are read on a road graph, and the
water has none) and no alternatives (the engine places the shape once).

A swim (TASK-323 part B, ADR-0283) is planned on the same water by the
engine's `plan_swimming`: 20-150 m from the shore, lap after lap, its turns
named after the places of `<cache>/shore_names/` (shore_names.py), which
the server cuts from OpenStreetMap along the shore (shore_extract.py); a
drawing comes as an outline (images.py).
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from route_engine.models import RouteRequest
from route_engine.optimizer import Plan
from route_engine.paddling import plan_paddling
from route_engine.shore_names import FolderShoreNames, ShoreNameSource, ShorePlace
from route_engine.swimming import ACTIVITY as SWIMMING
from route_engine.swimming import SwimRequest, plan_swimming
from route_engine.water import BBox, Element, OverpassWaterSource, WaterSource

from shaperoute_api.graphs import MapDataUnavailableError

log = logging.getLogger(__name__)


class ServerWater:
    """The water of the API's cache folder (water.OverpassWaterSource): a
    cached file whose area contains the one asked serves it, else one
    Overpass request, saved for the next. A download that fails is
    map_data_unavailable, as a zone's (graphs.ZoneGraphs)."""

    def __init__(self, cache_dir: Path) -> None:
        self._source = OverpassWaterSource(cache_dir)
        # One download at a time: water is asked for rarely, and a request
        # for the same area meanwhile finds the file the first one saved.
        self._downloading = threading.Lock()
        # The places with a name along the shore, for a swim's turns
        # (TASK-323): files only, never downloaded here.
        self._names = FolderShoreNames(cache_dir)

    def places(self, bbox: BBox) -> list[ShorePlace]:
        """The places with a name on the shore inside `bbox`: none without
        the files (shore_names.ShoreNameSource)."""
        return self._names.places(bbox)

    @property
    def folder(self) -> Path:
        return self._source.folder

    def needs_download(self, bbox: BBox) -> bool:
        """True when no cached file covers `bbox`: reading it means Overpass."""
        return not self._source.is_cached(bbox)

    def elements(self, bbox: BBox) -> list[Element]:
        started = time.perf_counter()
        if self.needs_download(bbox):
            with self._downloading:
                # Checked again: the download before may have covered it.
                if self.needs_download(bbox):
                    return self._logged("network", self._download(bbox), started)
        return self._logged("disk", self._source.elements(bbox), started)

    def _download(self, bbox: BBox) -> list[Element]:
        try:
            return self._source.elements(bbox)
        except Exception as exc:
            raise MapDataUnavailableError(
                f"OpenStreetMap water for this area could not be downloaded: {exc}"
            ) from exc

    @staticmethod
    def _logged(origin: str, elements: list[Element], started: float) -> list[Element]:
        log.info(
            "water from %s, %d elements, in %.1f s",
            origin,
            len(elements),
            time.perf_counter() - started,
        )
        return elements


def plan_water(request: RouteRequest, water: WaterSource) -> Plan:
    """The plan of a request on the water `water`: the engine's route,
    closed, from the shore and checked on the water; no search, so no
    directions, and no alternatives. A paddling route (plan_paddling), or a
    swim of its shape (plan_swim, TASK-323). NoWaterError and WaterFitError
    are ShapeNotDrawableError: shape_not_drawable, with the distance the
    shape fits at (errors.suggested_distance)."""
    if request.activity == SWIMMING:
        return plan_swim(SwimRequest.of(request), water)
    planned = plan_paddling(request, water)
    route = planned.route
    # No position: the log never has where a user is (API.md, «Grafi»).
    log.info(
        "on the water: %s %d m, scale %.2f, %s start, legs of %.0f m",
        request.shape,
        request.distance_m,
        route.scale,
        route.shore_access,
        route.approach_m,
    )
    return Plan(result=planned.result, search=None)


def plan_swim(swim: SwimRequest, water: WaterSource) -> Plan:
    """The plan of a swim (TASK-323), of a shape or a drawing, on `water`:
    lap after lap in the bathers' band, its turns named after the places on
    the shore `water` has (ServerWater.places), if any."""
    names = water if isinstance(water, ShoreNameSource) else None
    planned = plan_swimming(swim, water, names=names)
    # No position: the log never has where a user is (API.md, «Grafi»).
    log.info(
        "swim: %s %d m, %d laps of %.0f m, %s start, legs of %.0f m, %d turns",
        swim.name,
        swim.distance_m,
        planned.laps,
        planned.lap_m,
        planned.route.shore_access,
        planned.route.approach_m,
        len(planned.turns),
    )
    return Plan(result=planned.result, search=None)
