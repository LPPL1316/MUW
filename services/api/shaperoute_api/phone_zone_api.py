"""GET /phone-zones/{network}: the cached zone around a point, as the phone
draws on it (TASK-214, ADR-0177).

The file is written once beside the zone (phone_zones.py) and again when the
zone is newer; its ETag lets the phone ask again and get 304. A point with no
cached zone around it is a 404: the server draws routes there until a route
asked of it downloads the zone. Nothing here downloads from Overpass.

A zone the phone downloads ahead, not the one around it, comes with
`?prefetch=1` and counts against the day's cap (phone_zone_cap.py, part A2):
beyond it, 429 with Retry-After.

The app of part E asks for more room around itself with `?margin_m=`: the
smallest zone holding that much, when its file is small enough for the
phone's memory, else the zone every phone gets. It sends the ETags of all
the zones it has there (If-None-Match and X-Zone-ETags), and gets 304 for
any of them.

`python -m shaperoute_api.phone_zone_api` writes the file of every cached
zone ahead, so no phone waits for it (with the user's OK, as draw_examples).

A place the user keeps on the phone (TASK-334) is prepared beside these, by
POST /phone-zones/{network}/places (phone_zone_places.py): that one does
download from Overpass, a few places a day.
"""

from __future__ import annotations

import argparse
import logging
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from route_engine.geo import LatLon
from route_engine.network import (
    FILTERS,
    BBox,
    OsmnxSource,
    area_around,
    read_graph,
)

from shaperoute_api.access import refuse
from shaperoute_api.phone_zone_cap import TrafficCap, phone_of
from shaperoute_api.phone_zone_places import (
    PlaceBuilds,
    RouteWork,
    place_routes,
    watch_route_work,
)
from shaperoute_api.phone_zones import SUFFIX, write_zone, zone_bbox
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

# The zone must hold this much around the point: a route of a few km from
# there fits in it (ROUTE_ENGINE.md §4); a longer one the phone checks.
ZONE_MARGIN_M = 3000.0
# How much an app may ask for with `margin_m` (part E). The app of part E
# asks 6 km around itself: a route of up to 8 km crops at most 3.8 km around
# its start, so it fits from 2 km away too.
MAX_MARGIN_M = 10_000.0
# A wider zone is given only up to this size of its file: the largest one
# phones already draw on, Trento's bike zone (11.5 MB). Read, a zone takes
# about 21 MB of the phone's memory for each MB of its file (part E).
WIDE_MAX_BYTES = 12_000_000
NO_ZONE = "No zone around this point on the server yet."
UNKNOWN_NETWORK = f"Unknown network; one of: {', '.join(FILTERS)}."
ENOUGH_TODAY = "Enough maps downloaded ahead today: try again tomorrow."


def install_phone_zones(
    app: FastAPI,
    cache_dir: Path,
    cap: TrafficCap | None = None,
    wide_max_bytes: int = WIDE_MAX_BYTES,
    places: PlaceBuilds | None = None,
    work: RouteWork | None = None,
) -> None:
    """The zones of `cache_dir` for the phone; `cap` defaults to the user's
    300 MB a phone and 300 GB in all, a day. With them, the places the user
    keeps on the phone (TASK-334), prepared by `places` while `work` says
    no route is being drawn."""
    app.include_router(
        phone_zone_routes(
            cache_dir, cap if cap is not None else TrafficCap(), wide_max_bytes
        )
    )
    work = work if work is not None else RouteWork()
    watch_route_work(app, work)
    app.include_router(
        place_routes(
            places
            if places is not None
            else PlaceBuilds(cache_dir, phone_file, busy=work.busy)
        )
    )


def phone_zone_routes(
    cache_dir: Path, cap: TrafficCap, wide_max_bytes: int = WIDE_MAX_BYTES
) -> APIRouter:
    router = APIRouter()

    @router.get(
        "/phone-zones/{network}",
        response_class=FileResponse,
        responses={
            200: {"content": {"application/gzip": {}}},
            304: {"description": "The phone already has this zone."},
            404: {"model": ErrorBody},
            429: {"model": ErrorBody, "description": ENOUGH_TODAY},
        },
    )
    def phone_zone(
        request: Request,
        network: str,
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
        prefetch: Annotated[bool, Query()] = False,
        margin_m: Annotated[
            float, Query(ge=ZONE_MARGIN_M, le=MAX_MARGIN_M)
        ] = ZONE_MARGIN_M,
        if_none_match: Annotated[str | None, Header()] = None,
        x_zone_etags: Annotated[str | None, Header()] = None,
    ) -> Response:
        if network not in FILTERS:
            raise HTTPException(404, UNKNOWN_NETWORK)
        source = OsmnxSource(cache_dir, network, FILTERS[network])
        path = wide_file(source, (lat, lon), margin_m, wide_max_bytes)
        if path is None:
            zone = source.covering_path(area_around([(lat, lon)], ZONE_MARGIN_M))
            if zone is None:
                raise HTTPException(404, NO_ZONE)
            path = phone_file(source, zone)
        stat = path.stat()
        tag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
        if tag in tags_of(if_none_match) | tags_of(x_zone_etags):
            return Response(status_code=304, headers={"ETag": tag})
        if prefetch:
            wait = cap.take(phone_of(request), stat.st_size)
            if wait > 0:
                log.info(
                    "phone zone ahead refused: %.0f MB given today",
                    cap.given_today() / 1e6,
                )
                return refuse(
                    429, "too_many_requests", ENOUGH_TODAY, **{"Retry-After": str(wait)}
                )
        return FileResponse(
            path,
            media_type="application/gzip",
            filename=path.name,
            headers={"ETag": tag},
        )

    return router


def wide_file(
    source: OsmnxSource, point: LatLon, margin_m: float, max_bytes: int
) -> Path | None:
    """The phone's file of the smallest cached zone holding `margin_m` around
    `point`, of at most `max_bytes` (part E); None when there is none, or
    when `margin_m` asks no more than every phone gets. A file is written
    when missing, as for the zone of ZONE_MARGIN_M."""
    if margin_m <= ZONE_MARGIN_M:
        return None
    for zone in covering_zones(source, area_around([point], margin_m)):
        path = phone_file(source, zone)
        if path.stat().st_size <= max_bytes:
            return path
    return None


def covering_zones(source: OsmnxSource, bbox: BBox) -> list[Path]:
    """Every cached zone of `source`'s network whose area contains `bbox`,
    the smallest first: OsmnxSource.covering_path gives only that one."""
    south, west, north, east = bbox
    eps = 1e-5  # names are rounded to 5 decimals
    found: list[tuple[float, str, Path]] = []
    for path in source.cache_dir.glob(f"{source.network_name}_*.graphml"):
        area = zone_bbox(path.with_name(f"{path.stem}{SUFFIX}"))
        if area is None:
            continue
        s, w, n, e = area
        if (
            s <= south + eps
            and w <= west + eps
            and n >= north - eps
            and e >= east - eps
        ):
            found.append(((n - s) * (e - w), path.name, path))
    return [path for _, _, path in sorted(found)]


def tags_of(header: str | None) -> set[str]:
    """The ETags of a header that lists them, as If-None-Match may (RFC 9110).
    The app of part E sends the ETag of its smallest zone around the point in
    If-None-Match, as before, and those of its other zones there in
    X-Zone-ETags: a server before part E reads the first only, and answers
    as it always did."""
    if not header:
        return set()
    return {tag.strip().removeprefix("W/") for tag in header.split(",")}


def phone_file(source: OsmnxSource, zone: Path) -> Path:
    """The phone's file of the cached `zone`, written when missing or older
    than the zone. Two requests at once may both write it: each writes whole
    and the second replaces the first (write_zone)."""
    path = zone.with_name(f"{zone.stem}{SUFFIX}")
    newest = max(p.stat().st_mtime_ns for p in _zone_files(zone))
    if path.exists() and path.stat().st_mtime_ns >= newest:
        return path
    bbox = zone_bbox(path)
    assert bbox is not None  # named as OsmnxSource names its zones
    started = time.perf_counter()
    graph = read_graph(zone)
    write_zone(
        graph, source.named_roads(bbox, download=False), source.network_name, bbox, path
    )
    log.info(
        "phone zone %s written in %.1f s", path.name, time.perf_counter() - started
    )
    return path


def _zone_files(zone: Path) -> list[Path]:
    """The GraphML of the zone and its pickle, when there is one."""
    fast = zone.with_suffix(".pickle")
    return [zone, fast] if fast.exists() else [zone]


def write_all(cache_dir: Path) -> list[Path]:
    """The phone's file of every cached zone, foot and bike; those already
    up to date are left as they are."""
    written: list[Path] = []
    for network, custom_filter in FILTERS.items():
        source = OsmnxSource(cache_dir, network, custom_filter)
        for zone in sorted(cache_dir.glob(f"{network}_*.graphml")):
            if zone_bbox(zone.with_name(f"{zone.stem}{SUFFIX}")) is not None:
                written.append(phone_file(source, zone))
    return written


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.phone_zone_api",
        description="Write the phone's file of every cached zone (TASK-214).",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("data/cache"),
        help="the API's cache of zones (default: data/cache)",
    )
    args = parser.parse_args(argv)
    total = 0
    for path in write_all(args.cache_dir):
        size = path.stat().st_size
        total += size
        print(f"{path.name}: {size / 1e6:.1f} MB")
    print(f"{total / 1e6:.0f} MB for the phones")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
