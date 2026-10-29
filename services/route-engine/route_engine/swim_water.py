"""Water to swim in (TASK-323 A1, ADR-0283): the canoe's water with the band
turned inside out.

The canoe keeps past the bathers' band, 200 m off the shore at sea and 50 m
on a lake (water.py, ADR-0161); a swimmer keeps inside it, between
`SwimBand.min_shore_m` and `SwimBand.max_shore_m` from the shore, at sea and
on a lake: in the water many beach ordinances keep motor boats out of
(usually 200 m off a beach and 100 m off a cliff, but they change from place
to place, and the engine knows none of them). Harbours, marinas and the
mouths of rivers and canals are kept farther off (`danger_margin_m`), and a
swimmer goes in only from a beach or a way one can walk, not by a slipway or
a pier, where boats are.

water.py stays the canoe's, byte for byte (ADR-0283): the water, the land,
the obstacles and the shore points reachable on foot are those of
`water.build_area`, and only the band, the water a leg from the shore may
cross and the ways in are a swimmer's. No module but swimming.py imports
this one, and the fingerprint of the routes kept leaves both out
(`route_store.SWIM_ONLY`): the canoe's routes and the examples kept do not
change.

Metres on the plane tangent at the requested start, as in water.py.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace

import numpy as np
import shapely
from shapely.geometry.base import BaseGeometry

from route_engine.water import (
    EMPTY,
    OBSTACLE_MARGIN_M,
    SHORE_MARGIN_M,
    BBox,
    Element,
    WaterArea,
    _area,
    _body,
    _valid,
    build_area,
)
from route_engine.water_fit import ON_LAND_M


@dataclass(frozen=True)
class SwimBand:
    """Where a swimmer may be, in metres from the shore: the user's choice
    after the samples, a longer swim going round the shape in laps
    (ADR-0283, TASK-323 A1)."""

    # Off the shore: on a beach the water's edge moves by tens of metres
    # (water.SHORE_MARGIN_M), and a turn is not swum on the sand.
    min_shore_m: float = 20.0
    # Within the bathers' band of most ordinances, with room to spare.
    max_shore_m: float = 150.0
    # Off harbours, marinas and the mouths of rivers and canals: boats go in
    # and out there.
    danger_margin_m: float = 200.0


SWIM_BAND = SwimBand()
# The ways a swimmer goes in (water.ACCESS_KINDS): not a slipway nor a pier.
SWIM_ACCESS = frozenset({"beach", "path"})
# Water that boats come in and out of (`water=` of `natural=water`): the
# Adriatic's harbours are often canals, as Riccione's.
HARBOUR_WATER = frozenset({"harbour"})
RIVER_WATER = frozenset({"river", "canal"})
# A river or a canal this close to the lake or the sea is its mouth: farther
# up it runs on land, behind the beach, and keeps no one out of the water.
MOUTH_REACH_M = 50.0


@dataclass(frozen=True)
class SwimWater:
    """The water around a start as a swimmer has it: `area` is the canoe's
    with a swimmer's band, legs and ways in; `danger` is where boats come in
    and out (harbours, marinas, river mouths), kept `danger_margin_m` off."""

    area: WaterArea
    danger: BaseGeometry
    band: SwimBand


def is_harbour(tags: dict[str, str]) -> bool:
    """A harbour, a marina or a harbour basin, kept off whole."""
    return (
        tags.get("leisure") == "marina"
        or tags.get("landuse") == "harbour"
        or tags.get("seamark:type") == "harbour"
        or (tags.get("natural") == "water" and tags.get("water") in HARBOUR_WATER)
    )


def is_river(tags: dict[str, str]) -> bool:
    """A river or a canal drawn as water, kept off at its mouth."""
    return tags.get("natural") == "water" and tags.get("water") in RIVER_WATER


def build_swim_area(
    elements: Sequence[Element],
    origin: tuple[float, float],
    bbox: BBox,
    band: SwimBand = SWIM_BAND,
) -> SwimWater:
    """The water of `water.build_area`, with the band where a swimmer may
    be (between `band.min_shore_m` and `band.max_shore_m` from the shore,
    off the obstacles as the canoe and off `danger` by
    `band.danger_margin_m`), the water a leg from the shore may cross
    (within `band.max_shore_m` of it, off `danger`), and the shore points
    reachable from a beach or a path only, off `danger` too."""
    area = build_area(elements, origin, bbox)
    danger = _danger(elements, area)
    kept_off = danger.buffer(band.danger_margin_m) if not danger.is_empty else EMPTY
    edge = max(SHORE_MARGIN_M, OBSTACLE_MARGIN_M)
    swim = area.navigable.intersection(area.box.buffer(-edge))
    if not swim.is_empty:
        swim = swim.intersection(area.shore.buffer(band.max_shore_m))
        swim = swim.difference(area.dry.buffer(band.min_shore_m))
        if not area.obstacles.is_empty:
            swim = swim.difference(area.obstacles.buffer(OBSTACLE_MARGIN_M))
        if not kept_off.is_empty:
            swim = swim.difference(kept_off)
    reach = area.navigable.intersection(area.shore.buffer(band.max_shore_m))
    if not kept_off.is_empty:
        reach = reach.difference(kept_off)
    access, kinds = _ways_in(area, danger, band)
    swimmer = replace(
        area,
        band=_valid(swim),
        wet=_valid(reach).buffer(ON_LAND_M),
        access=access,
        access_kind=kinds,
    )
    return SwimWater(swimmer, danger, band)


def _danger(elements: Sequence[Element], area: WaterArea) -> BaseGeometry:
    """Harbours and marinas whole, and rivers and canals within
    MOUTH_REACH_M of the lake or the sea, inside the area's box."""
    open_water = area.box.difference(area.dry)
    mouths = open_water.buffer(MOUTH_REACH_M)
    parts: list[BaseGeometry] = []
    for element in elements:
        tags = element.get("tags", {})
        if is_harbour(tags):
            parts.append(_body(element, area.origin).intersection(area.box))
        elif is_river(tags):
            river = _area(element, area.origin)
            if river is not None:
                parts.append(river.intersection(mouths))
    parts = [part for part in parts if not part.is_empty]
    return _valid(shapely.unary_union(parts)) if parts else EMPTY


def _ways_in(
    area: WaterArea, danger: BaseGeometry, band: SwimBand
) -> tuple[np.ndarray, tuple[str, ...]]:
    """The shore points of `area` reached by a beach or a path
    (SWIM_ACCESS), at least `band.danger_margin_m` from `danger`."""
    keep = np.array([kind in SWIM_ACCESS for kind in area.access_kind], dtype=bool)
    if len(area.access) and not danger.is_empty:
        away = shapely.distance(shapely.points(area.access), danger)
        keep &= away >= band.danger_margin_m
    kinds = tuple(
        kind for kind, kept in zip(area.access_kind, keep, strict=True) if kept
    )
    return area.access[keep].reshape(-1, 2), kinds
