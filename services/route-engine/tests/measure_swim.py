"""Measure how large a swim fits in the bathers' band (TASK-323 A1).

Not a test: for each place, each band and each shape it finds the longest
lap that fits, trying the distances of DISTANCES from the longest down,
and draws the samples of the task (circle, heart and star at 0.5, 1 and
1.5 km) with the band as it is, lap after lap as a swim is
(swimming.swim_on). It prints one row per place, band and shape
and, with --json, writes the rows, the samples and the water to look at
(the page of the samples reads it).

    python tests/measure_swim.py                       # the two fixtures
    python tests/measure_swim.py --cache-dir ../../data/cache \\
        --place "Levico,46.0126,11.2968" --json out/TASK-323/swim.json

A place is NAME,LAT,LON on the shore; its water comes from
`<cache-dir>/water/` (nothing is downloaded: a place without it is skipped)
or, for the fixtures, from their files. The bands are those of --band
MIN-MAX, the proposal first; with --fine-grid also the proposal on cells of
5 m instead of 10 (water_fit.MIN_CELL_M, here only: the engine is not
changed), to see what the search's grid takes of a narrow band.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any

import shapely
from shapely.geometry import mapping

from route_engine import water_fit
from route_engine.errors import ShapeNotDrawableError
from route_engine.geo import LatLon, local_to_latlon
from route_engine.shapes import FREE_ROTATION
from route_engine.swim_water import SWIM_BAND, SwimBand, SwimWater, build_swim_area
from route_engine.swimming import SwimRequest, check_in_band, swim_lines, swim_on
from route_engine.water import FileWaterSource, OverpassWaterSource, WaterSource

FIXTURES = Path(__file__).parent / "fixtures"
SHAPES = ("circle", "heart", "star")
SAMPLE_DISTANCES = (500, 1000, 1500)
# Longest first: the first that fits is the largest.
DISTANCES = (3000, 2500, 2000, 1500, 1200, 1000, 800, 700, 600, 500, 400, 300)
BANDS = ("20-150", "20-200", "20-300", "20-500")


def _fixtures() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "make_water_fixtures", FIXTURES / "make_water_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@dataclass(frozen=True)
class Place:
    name: str
    start: LatLon
    source: WaterSource


def fixture_places() -> list[Place]:
    build = _fixtures()
    return [
        Place(
            "coast (fixture)",
            local_to_latlon(build.COAST_ORIGIN, 100.0, 80.0),
            FileWaterSource(FIXTURES / "water_coast.json"),
        ),
        Place(
            "lake (fixture)",
            local_to_latlon(build.LAKE_ORIGIN, -700.0, 0.0),
            FileWaterSource(FIXTURES / "water_lake.json"),
        ),
    ]


def _place(text: str, cache_dir: Path) -> Place:
    name, lat, lon = text.rsplit(",", 2)
    return Place(name, (float(lat), float(lon)), OverpassWaterSource(cache_dir, False))


def _band(text: str) -> SwimBand:
    low, high = (float(part) for part in text.split("-"))
    return SwimBand(min_shore_m=low, max_shore_m=high)


@contextmanager
def _cells(metres: float | None) -> Iterator[None]:
    """The search on cells of `metres` at the least, for a measure only."""
    before = water_fit.MIN_CELL_M
    if metres is not None:
        water_fit.MIN_CELL_M = metres
    try:
        yield
    finally:
        water_fit.MIN_CELL_M = before


def _water(place: Place, band: SwimBand) -> SwimWater:
    """The water for the longest swim of DISTANCES, which also serves the
    shorter: the box of the largest request."""
    request = SwimRequest(start=place.start, distance_m=3000, shape="star")
    shape, pieces = swim_lines(request)
    bbox = water_fit.water_bbox(place.start, shape, 3000, pieces)
    return build_swim_area(place.source.elements(bbox), place.start, bbox, band)


def _fit(
    water: SwimWater, shape: str, distance_m: int
) -> tuple[water_fit.WaterRoute | None, float | None]:
    """One lap of `shape` at `distance_m`, legs included, checked, or None
    and the distance the error says it fits at (None when it fits
    nowhere)."""
    outline = swim_lines(SwimRequest(start=(0.0, 0.0), distance_m=500, shape=shape))[0]
    try:
        route = water_fit.fit_shape(
            outline,
            distance_m,
            water.area,
            name=shape,
            free_rotation=shape in FREE_ROTATION,
        )
    except ShapeNotDrawableError as exc:
        return None, exc.best_distance_m
    check_in_band(route, water, distance_m)
    return route, None


def _geometry(water: SwimWater, geometry: Any) -> dict[str, Any]:
    def degrees(xy: Any) -> Any:
        import numpy as np

        rows = [local_to_latlon(water.area.origin, x, y) for x, y in xy]
        return np.array([[lon, lat] for lat, lon in rows]).reshape(-1, 2)

    return mapping(shapely.transform(geometry.simplify(2.0), degrees))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python tests/measure_swim.py")
    parser.add_argument("--place", action="append", default=[], help="NAME,LAT,LON")
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    parser.add_argument("--band", action="append", help="MIN-MAX metres; repeat")
    parser.add_argument("--fine-grid", action="store_true")
    parser.add_argument("--json", type=Path, help="rows, samples and water")
    args = parser.parse_args(argv)

    places = [_place(text, args.cache_dir) for text in args.place] or fixture_places()
    bands = [(text, _band(text), None) for text in (args.band or BANDS)]
    if args.fine_grid:
        proposal = f"{SWIM_BAND.min_shore_m:.0f}-{SWIM_BAND.max_shore_m:.0f}"
        bands.append((f"{proposal} cells 5 m", SWIM_BAND, 5.0))
    rows: list[dict[str, Any]] = []
    samples: list[dict[str, Any]] = []
    waters: dict[str, Any] = {}
    print(f"{'place':22} {'band':18} {'shape':7} {'largest':>8} {'time':>6}")
    for place in places:
        for label, band, cells in bands:
            try:
                water = _water(place, band)
            except LookupError:
                print(
                    f"{place.name:22} no water in the cache: skipped", file=sys.stderr
                )
                break
            seen = waters.setdefault(place.name, {"bands": {}})
            if label == bands[0][0]:
                seen["dry"] = _geometry(water, water.area.dry)
                seen["danger"] = (
                    None if water.danger.is_empty else _geometry(water, water.danger)
                )
            seen["bands"][label] = _geometry(water, water.area.band)
            with _cells(cells):
                for shape in SHAPES:
                    began = time.perf_counter()
                    largest = None
                    for distance in DISTANCES:
                        route = _fit(water, shape, distance)[0]
                        if route is not None:
                            largest = (distance, route)
                            break
                    seconds = time.perf_counter() - began
                    fits = "-" if largest is None else f"{largest[0] / 1000:g} km"
                    print(
                        f"{place.name:22} {label:18} {shape:7} {fits:>8} "
                        f"{seconds:5.1f}s"
                    )
                    rows.append(
                        {
                            "place": place.name,
                            "band": label,
                            "shape": shape,
                            "largest_m": None if largest is None else largest[0],
                            "route": None if largest is None else largest[1].points,
                        }
                    )
                    if label != bands[0][0]:
                        continue
                    for distance in SAMPLE_DISTANCES:
                        request = SwimRequest(
                            start=place.start, distance_m=distance, shape=shape
                        )
                        sample: dict[str, Any] = {
                            "place": place.name,
                            "shape": shape,
                            "distance_m": distance,
                        }
                        try:
                            plan = swim_on(water, request)
                        except ShapeNotDrawableError as exc:
                            sample["fits_m"] = exc.best_distance_m
                        else:
                            sample["route"] = plan.route.points
                            sample["route_m"] = plan.route.distance_m
                            sample["laps"] = plan.laps
                            sample["lap_m"] = plan.lap_m
                        samples.append(sample)
    if args.json is not None:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps({"rows": rows, "samples": samples, "water": waters}),
            encoding="utf-8",
        )
        print(f"Wrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
