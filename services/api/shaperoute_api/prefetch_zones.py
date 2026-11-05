"""Zones downloaded before anyone asks for them (TASK-137, ADR-0119).

For each city, the zone that serves "Explore" from its centre: the shape of
every theme at 10 km from any start the themed search may take (within
`search_radius_m` of the centre), with the engine's far search from there
(FAR_OFFSET_M more), and the city's examples, a 5 km heart, circle and star
from any start the engine may move them to (FAR_OFFSET_M).
A city whose zone is already in the cache is ready; the others are
downloaded one at a time, with their street names (ADR-0057), as MAPS.md
asks of Overpass: a pause between cities, one attempt each, and the first
failure stops the command. Run again, it goes on from the missing cities.

    python -m shaperoute_api.prefetch_zones --preset italy
    python -m shaperoute_api.prefetch_zones "Vercelli" "Lucca" --dry-run

With `--extract italy-highways.osm.pbf` the zones come from an OpenStreetMap
extract instead (zone_extract.py): no request to Overpass, no pause.

With `--activity cycling` they are bike zones (TASK-190, ADR-0153): the bike
network, the area of the longest bike route from the city's centre, and no
street names. Only from an extract: a bike zone is two large Overpass
queries, which Overpass refuses after a few.

    python -m shaperoute_api.prefetch_zones --activity cycling \
        --extract italy-highways.osm.pbf Trento
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import sys
import time
import urllib.request
from collections.abc import Callable, Iterable, Sequence
from contextlib import AbstractContextManager, nullcontext
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Literal, Protocol

from route_engine.geo import LatLon, local_to_latlon
from route_engine.models import DISTANCE_LIMITS_M
from route_engine.network import OsmnxSource
from route_engine.optimizer import FAR_OFFSET_M, SHAPE_POINTS, required_area, zone_area
from route_engine.overpass_address import reachable
from route_engine.shapes import SUPPORTED_SHAPES, get_shape
from route_engine.stops import union

from shaperoute_api.activity_graphs import ROAD_ACTIVITIES
from shaperoute_api.cities import CitySearch
from shaperoute_api.places import KEY_VARIABLE, PlaceSearch
from shaperoute_api.sports import API_SPORTS
from shaperoute_api.themed import search_radius_m
from shaperoute_api.themes import THEMES
from shaperoute_api.zone_extract import zone_from_extract

BBox = tuple[float, float, float, float]

# What "Explore" asks (themed.py; apps/mobile/src/explore/exampleRoutes.ts).
THEMED_DISTANCE_M = 10_000
# In the order the app asks them (ADR-0144): the circle first, because its
# zone holds the heart's and the star's. With the heart first, a city
# without a zone had a second one downloaded for the circle.
EXAMPLE_SHAPES = ("circle", "heart", "star")
EXAMPLE_DISTANCE_M = 5_000
# The longest bike route (TASK-190): its zone holds every shorter one.
BIKE_DISTANCE_M = DISTANCE_LIMITS_M["cycling"][1]
# Below this the cache stops growing (MAPS.md: the disk fills up).
MIN_FREE_BYTES = 5 * 1024**3
DEFAULT_PAUSE_S = 60.0
# Overpass gives each address two slots; a slot is free again some seconds
# after a query. Longer than this, the command stops instead of waiting.
MAX_SLOT_WAIT_S = 300.0
# A busy Overpass answers 504 now and then: a city that fails is left for
# the next run; this many failures in a row stop the command.
MAX_FAILURES_IN_A_ROW = 2
OVERPASS_STATUS = "https://overpass-api.de/api/status"
USER_AGENT = "ShapeRoute zone prefetch (https://github.com/rockydalbianco/shaperoute)"

# The cities of Italy first asked (ADR-0119): the regional capitals, then
# the largest and most visited. Names only: each centre comes from the city
# search, as the app gets it when the city is tapped.
ITALY = (
    "Roma",
    "Milano",
    "Napoli",
    "Torino",
    "Palermo",
    "Genova",
    "Bologna",
    "Firenze",
    "Bari",
    "Venezia",
    "Catania",
    "Verona",
    "Trieste",
    "Cagliari",
    "Perugia",
    "Ancona",
    "Trento",
    "Bolzano",
    "L'Aquila",
    "Potenza",
    "Campobasso",
    "Catanzaro",
    "Aosta",
    "Messina",
    "Padova",
    "Brescia",
    "Parma",
    "Modena",
    "Reggio Emilia",
    "Reggio Calabria",
    "Taranto",
    "Prato",
    "Livorno",
    "Ravenna",
    "Rimini",
    "Salerno",
    "Ferrara",
    "Sassari",
    "Bergamo",
    "Pescara",
    "Vicenza",
    "Pisa",
    "Siena",
    "Lucca",
    "Lecce",
    "Como",
    "Monza",
    "Udine",
    "Treviso",
    "Novara",
    "Vercelli",
    "Levico Terme",
)
# The cities "Explore" shows first (apps/mobile/src/explore/presets.ts).
FEATURED = (
    "New York",
    "London",
    "Paris",
    "Tokyo",
    "Rome",
    "Milan",
    "Torino",
    "Barcelona",
    "Dubai",
    "Amsterdam",
    "Berlin",
    "Lisbon",
    "Sydney",
    "San Francisco",
)
PRESETS = {"italy": ITALY, "featured": FEATURED}

Status = Literal["ready", "downloaded", "missing", "not_found"]


class ZoneSource(Protocol):
    """What the command needs of OsmnxSource."""

    cache_dir: Path

    def cache_path(self, bbox: BBox) -> Path: ...

    def covering_path(self, bbox: BBox) -> Path | None: ...

    def load(self, bbox: BBox) -> object: ...

    def named_roads(self, bbox: BBox, download: bool = True) -> object: ...


@dataclass(frozen=True)
class Outcome:
    city: str
    status: Status
    detail: str = ""

    def line(self) -> str:
        return f"{self.city}: {self.status}" + (
            f", {self.detail}" if self.detail else ""
        )


def around(centre: LatLon, radius_m: float) -> list[LatLon]:
    """The centre and the four farthest starts north, east, south and west:
    their boxes hold the box of any start within `radius_m`."""
    return [centre] + [
        local_to_latlon(centre, radius_m * math.sin(a), radius_m * math.cos(a))
        for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2)
    ]


def zone_box(centre: LatLon) -> BBox:
    """The area "Explore" needs around a city's centre."""
    boxes: list[BBox] = []
    themed = sorted({theme.shape for theme in THEMES.values()})
    for shape in themed:
        outline = get_shape(shape)(SHAPE_POINTS)
        for start in around(centre, search_radius_m(THEMED_DISTANCE_M)):
            # A shape that does not fit near a start is looked for farther
            # (optimizer: the far search), in this area.
            boxes.append(zone_area(outline, start, THEMED_DISTANCE_M, FAR_OFFSET_M))
    for shape in EXAMPLE_SHAPES:
        outline = get_shape(shape)(SHAPE_POINTS)
        for start in around(centre, FAR_OFFSET_M):
            boxes.append(required_area(outline, start, EXAMPLE_DISTANCE_M))
    return union(boxes)


@cache
def longest_route_box(activity: str) -> Callable[[LatLon], BBox]:
    """The box of the area a route of `activity` up to its longest
    (models.DISTANCE_LIMITS_M) from a city's centre needs, the engine's far
    search included: every shape of the catalogue, the circle the widest.
    The same function for the same activity."""
    longest = DISTANCE_LIMITS_M[activity][1]

    def box(centre: LatLon) -> BBox:
        return union(
            [
                zone_area(get_shape(shape)(SHAPE_POINTS), centre, longest, FAR_OFFSET_M)
                for shape in SUPPORTED_SHAPES
            ]
        )

    return box


# The area a bike route of up to 30 km from a city's centre needs: about
# 26 x 26 km (ADR-0153). A shorter route fits it from a start farther out:
# 20 km within about 3.4 km of the centre, 10 km within 6.9; a word, whose
# letters fold its line, needs less than a shape.
bike_zone_box = longest_route_box("cycling")


def _box_of(activity: str, box: str) -> Callable[[LatLon], BBox]:
    return zone_box if box == "explore" else longest_route_box(activity)


# The box of each activity's zones, and whether they keep the street names
# (ADR-0057): each sport on roads says them (shaperoute_api/sports,
# TASK-376); the bike network has the roads whose sidewalks are apart.
ZONE_BOXES: dict[str, Callable[[LatLon], BBox]] = {
    sport.activity: _box_of(sport.activity, sport.zones.box)
    for sport in API_SPORTS
    if sport.zones is not None
}
STREET_NAMES = {
    sport.activity: sport.zones.street_names
    for sport in API_SPORTS
    if sport.zones is not None
}


def box_size_km(box: BBox) -> tuple[float, float]:
    """(width, height) of `box` in kilometres."""
    south, west, north, east = box
    middle = (south + north) / 2
    height = (north - south) * math.pi / 180 * 6_371
    width = (east - west) * math.pi / 180 * 6_371 * math.cos(math.radians(middle))
    return width, height


def names_cached(cache_dir: Path, box: BBox) -> bool:
    """A street-name file whose area holds `box` (as OsmnxSource looks)."""
    south, west, north, east = box
    eps = 1e-5
    for path in cache_dir.glob("names_*.json"):
        try:
            s, w, n, e = (float(p) for p in path.stem.split("_")[1:])
        except ValueError:
            continue
        if (
            s <= south + eps
            and w <= west + eps
            and n >= north - eps
            and e >= east - eps
        ):
            return True
    return False


def slot_wait_s(status: str) -> float | None:
    """From Overpass's status page: 0 when a slot is free now, the seconds
    until the first one is, or None when it says neither."""
    if "slots available now" in status or "slot available now" in status:
        return 0.0
    waits = [float(s) for s in re.findall(r"in (\d+) seconds", status)]
    return min(waits) if waits else None


def overpass_wait_s(
    url: str = OVERPASS_STATUS, timeout_s: float = 20.0
) -> float | None:
    """Seconds to wait for a free slot of Overpass, through an address that
    accepts; None when it does not answer or makes us wait too long."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with reachable(url), urllib.request.urlopen(request, timeout=timeout_s) as r:
            wait = slot_wait_s(r.read().decode("utf-8", "replace"))
    except Exception:
        return None
    return wait if wait is not None and wait <= MAX_SLOT_WAIT_S else None


def http_code(exc: BaseException) -> int | None:
    """The HTTP status of a failed download (urllib or requests)."""
    code = getattr(exc, "code", None) or getattr(
        getattr(exc, "response", None), "status_code", None
    )
    return code if isinstance(code, int) else None


def prefetch(
    cities: Iterable[str],
    source: ZoneSource,
    find_centre: Callable[[str], tuple[str, LatLon] | None],
    *,
    overpass_wait: Callable[[], float | None] = overpass_wait_s,
    free_bytes: Callable[[], int] | None = None,
    pause_s: float = DEFAULT_PAUSE_S,
    max_downloads: int | None = None,
    dry_run: bool = False,
    zone_data: Callable[[BBox], AbstractContextManager[None]] | None = None,
    box_of: Callable[[LatLon], BBox] = zone_box,
    street_names: bool = True,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    report: Callable[[Outcome], None] = lambda o: None,
) -> list[Outcome]:
    """Each city ready, downloaded, missing or not found, in order. A city
    whose download fails is missing; after a stop (failures in a row,
    Overpass silent, the disk, the budget) the cities left are not tried.
    `box_of` gives a city's zone and `street_names` says whether its names
    are kept too: those of "Explore" on foot, by default."""
    if free_bytes is None:

        def free_bytes() -> int:
            return shutil.disk_usage(source.cache_dir).free

    outcomes: list[Outcome] = []
    stopped: str | None = None
    downloads = 0
    tries = 0
    failures = 0

    def done(outcome: Outcome) -> None:
        outcomes.append(outcome)
        report(outcome)

    for city in cities:
        if stopped is not None:
            done(Outcome(city, "missing", f"not tried: {stopped}"))
            continue
        found = find_centre(city)
        if found is None:
            done(Outcome(city, "not_found", "the city search knows no such city"))
            continue
        label, centre = found
        box = box_of(centre)
        width, height = box_size_km(box)
        size = f"{label}, {width:.0f} x {height:.0f} km"
        graph = source.covering_path(box) is not None
        names = not street_names or names_cached(source.cache_dir, box)
        if graph and names:
            done(Outcome(city, "ready", size))
            continue
        if dry_run:
            what = "street names to download" if graph else "to download"
            done(Outcome(city, "missing", f"{size}, {what}"))
            continue
        if max_downloads is not None and downloads >= max_downloads:
            stopped = f"stopped after {max_downloads} downloads"
            done(Outcome(city, "missing", stopped))
            continue
        if free_bytes() < MIN_FREE_BYTES:
            stopped = "less than 5 GB free on the disk"
            done(Outcome(city, "missing", stopped))
            continue
        if tries > 0 and zone_data is None:
            sleep(pause_s)
        wait = 0.0 if zone_data is not None else overpass_wait()
        if wait is None:
            stopped = "Overpass did not answer, or had no slot for minutes"
            done(Outcome(city, "missing", stopped))
            continue
        if wait > 0:
            sleep(wait + 2)
        started = clock()
        tries += 1
        try:
            with nullcontext() if zone_data is None else zone_data(box):
                if not graph:
                    source.load(box)
                if street_names:
                    source.named_roads(box, download=True)
        except Exception as exc:
            code = http_code(exc)
            failed = f"the download failed ({type(exc).__name__}" + (
                f" {code})" if code is not None else ")"
            )
            failures += 1
            if failures >= MAX_FAILURES_IN_A_ROW:
                stopped = f"{failures} downloads failed in a row, the last: {failed}"
            done(Outcome(city, "missing", failed))
            continue
        failures = 0
        downloads += 1
        path = source.covering_path(box)
        megabytes = (
            path.stat().st_size / 1e6 if path is not None and path.exists() else 0
        )
        what = f"{megabytes:.0f} MB" if not graph else "street names only"
        done(Outcome(city, "downloaded", f"{size}, {what}, {clock() - started:.0f} s"))
    return outcomes


def centre_finder(search: CitySearch) -> Callable[[str], tuple[str, LatLon] | None]:
    def find(city: str) -> tuple[str, LatLon] | None:
        found = search.search(city)
        return (found[0].label, found[0].point) if found else None

    return find


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.prefetch_zones",
        description="Download the zones of cities before anyone asks for them.",
    )
    parser.add_argument("cities", nargs="*", help="city names, as typed in the app")
    parser.add_argument("--preset", choices=sorted(PRESETS), action="append")
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    parser.add_argument("--pause-s", type=float, default=DEFAULT_PAUSE_S)
    parser.add_argument("--max-downloads", type=int, default=None)
    parser.add_argument(
        "--dry-run", action="store_true", help="say what is ready, download nothing"
    )
    parser.add_argument(
        "--extract",
        type=Path,
        default=None,
        help="an OpenStreetMap .pbf to cut the zones from, instead of Overpass",
    )
    parser.add_argument(
        "--activity",
        # Paddling has no zones: it is drawn on the water (TASK-191).
        choices=ROAD_ACTIVITIES,
        default="running",
        help="the network of the zones: running, those of Explore (default), "
        "or cycling, for bike routes up to 30 km from the centre (--extract)",
    )
    args = parser.parse_args(argv)
    cities = list(args.cities)
    for preset in args.preset or []:
        cities += [c for c in PRESETS[preset] if c not in cities]
    if not cities:
        parser.error("name some cities, or a --preset")
    if args.activity == "cycling" and args.extract is None and not args.dry_run:
        parser.error("bike zones come from an extract: give --extract (ADR-0153)")
    search = PlaceSearch.from_env()
    if search.key is None:
        print(f"{KEY_VARIABLE} is not set: the city centres come from it.")
        return 2
    outcomes = prefetch(
        cities,
        OsmnxSource.for_activity(args.cache_dir, args.activity),
        centre_finder(CitySearch(search.key)),
        pause_s=args.pause_s,
        max_downloads=args.max_downloads,
        dry_run=args.dry_run,
        zone_data=(
            None
            if args.extract is None
            else lambda box: zone_from_extract(args.extract, box)
        ),
        box_of=ZONE_BOXES[args.activity],
        street_names=STREET_NAMES[args.activity],
        report=lambda o: print(o.line(), flush=True),
    )
    tally = {
        status: sum(o.status == status for o in outcomes)
        for status in ("ready", "downloaded", "missing", "not_found")
    }
    print(json.dumps(tally))
    return 0 if tally["missing"] == 0 and tally["not_found"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
