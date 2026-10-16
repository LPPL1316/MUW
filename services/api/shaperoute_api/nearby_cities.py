"""The towns near a point, for "Near me" in "Explore" (TASK-236, ADR-0200).

GET /nearby-cities gives at most six places around where the user is. Four
are cities and towns: those within 20 km, the largest first; where there
are fewer than four, as around a city alone in its valley, the circle
widens up to 50 km and the nearest beyond fill the list. Two more are the
nearest of all within 20 km, villages too, however small (the user's
choice). The place the user is in is not one of them: "Near me" already
shows it.

They are OpenStreetMap's `place=city`, `place=town` and `place=village`,
through Geoapify's Places API with the key of the place search (places.py):
the same points and the same labels GET /cities gives for those names (a
village too, since TASK-249: a place's point is this one, ADR-0213), so a
town tapped here and the same town typed are one city, with the same
examples kept (route_store.py). The service is asked
from the middle of a square of about 1 km, not from the user's own
position, and the answer is kept a day.

A place has its photo when its Wikidata item has one (TASK-283, ADR-0243,
city_photos.py): only the item goes to Wikimedia.
"""

from __future__ import annotations

import threading
import time
import urllib.parse
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, HTTPException, Query
from pydantic import BaseModel
from route_engine.geo import haversine_m

from shaperoute_api.cities import place_label, result_point
from shaperoute_api.city_photos import CityPhotoBody, CityPhotos, is_item
from shaperoute_api.places import (
    Fetch,
    PlacesUnavailableError,
    fetch_json,
    fetch_together,
)
from shaperoute_api.route_store import RouteStore
from shaperoute_api.schemas import ErrorBody

LatLon = tuple[float, float]

PLACES_URL = "https://api.geoapify.com/v2/places"
CITIES = "populated_place.city"
TOWNS = "populated_place.town"
VILLAGES = "populated_place.village"
# The largest around, then the nearest, however small.
MAX_LARGE = 4
MAX_SMALL = 2
MAX_NEARBY = MAX_LARGE + MAX_SMALL
# A short drive: the towns looked at first.
NEAR_RADIUS_M = 20_000
# Where those are fewer than MAX_LARGE, as far as this.
FAR_RADIUS_M = 50_000
# The nearest place, when its centre is this close, is the one the user is
# in (the app's OWN_RADIUS_M, ownRoutes.ts).
OWN_RADIUS_M = 1500.0
# The service gives the nearest first: around Milan the towns within
# NEAR_RADIUS_M are about a hundred; of the villages only the nearest count.
ASK = {CITIES: 50, TOWNS: 100, VILLAGES: 20}
# About 1 km: the points of a neighbourhood share an answer.
CELL_DECIMALS = 2
CACHE_SIZE = 500
CACHE_TTL_S = 24 * 3600.0

NO_KEY = "Nearby towns are off on this API."
SERVICE_FAILED = "The nearby towns service did not answer; try again."


class NearbyCityBody(BaseModel):
    """A town near the point: its label and centre as GET /cities gives."""

    label: str
    point: tuple[float, float]
    """(lat, lon)."""
    away_m: int
    """From the point asked to the town's centre, as the crow flies."""
    photo: CityPhotoBody | None = None
    """Its photo, when it has one (TASK-283)."""


class NearbyCitiesBody(BaseModel):
    """The answer of GET /nearby-cities: the nearest first."""

    places: list[NearbyCityBody]


@dataclass(frozen=True)
class Town:
    label: str
    point: LatLon
    population: int
    """0 when OpenStreetMap does not say."""
    item: str | None = None
    """Its Wikidata item, "Q1442886", when OpenStreetMap names one."""


def nearby_url(key: str, categories: str, centre: LatLon, radius_m: int) -> str:
    lat, lon = centre
    params = {
        "categories": categories,
        "conditions": "named",
        "filter": f"circle:{lon},{lat},{radius_m}",
        "bias": f"proximity:{lon},{lat}",
        "limit": str(ASK[categories]),
        "apiKey": key,
    }
    return f"{PLACES_URL}?{urllib.parse.urlencode(params)}"


def population_of(properties: dict[str, Any]) -> int:
    source = properties.get("datasource")
    raw = source.get("raw") if isinstance(source, dict) else None
    value = raw.get("population") if isinstance(raw, dict) else None
    if isinstance(value, bool):
        return 0
    if isinstance(value, int | float):
        return max(int(value), 0)
    # OpenStreetMap's tag is text: "7915", now and then "7 915".
    digits = "".join(value.split()) if isinstance(value, str) else ""
    return int(digits) if digits.isdigit() else 0


def item_of(properties: dict[str, Any]) -> str | None:
    """The place's Wikidata item, as Geoapify gives it."""
    wiki = properties.get("wiki_and_media")
    source = properties.get("datasource")
    raw = source.get("raw") if isinstance(source, dict) else None
    for found in (
        wiki.get("wikidata") if isinstance(wiki, dict) else None,
        raw.get("wikidata") if isinstance(raw, dict) else None,
    ):
        if is_item(found):
            return str(found)
    return None


def parse_towns(body: Any) -> list[Town]:
    """The service's towns that read: a name, a point; each label once,
    with the first item one of them names."""
    features = body.get("features") if isinstance(body, dict) else None
    towns: dict[str, Town] = {}
    for feature in features if isinstance(features, list) else []:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        if not isinstance(properties, dict):
            continue
        point = result_point(properties)
        label = place_label(properties)
        if point is None or label is None:
            continue
        item = item_of(properties)
        kept = towns.get(label)
        if kept is None:
            towns[label] = Town(label, point, population_of(properties), item)
        elif kept.item is None and item is not None:
            towns[label] = replace(kept, item=item)
    return list(towns.values())


def own_place(centre: LatLon, places: list[Town]) -> str | None:
    """The label of the place the user is in: the nearest of all, when its
    centre is within OWN_RADIUS_M."""
    nearest = min(places, key=lambda t: haversine_m(centre, t.point), default=None)
    if nearest is None or haversine_m(centre, nearest.point) > OWN_RADIUS_M:
        return None
    return nearest.label


def choose(
    centre: LatLon, near: list[Town], far: list[Town], own: str | None = None
) -> list[Town]:
    """At most MAX_LARGE: the largest of `near`, then the nearest of `far`
    that are not among them, as a circle that widens; never `own`."""

    def away(town: Town) -> float:
        return haversine_m(centre, town.point)

    def largest(towns: list[Town]) -> list[Town]:
        return sorted(towns, key=lambda t: (-t.population, away(t)))

    chosen: dict[str, Town] = {}
    for town in [*largest(near), *sorted(far, key=away)]:
        if len(chosen) == MAX_LARGE:
            break
        if town.label != own:
            chosen.setdefault(town.label, town)
    return list(chosen.values())


def nearest_others(
    centre: LatLon, places: list[Town], taken: list[Town], own: str | None = None
) -> list[Town]:
    """At most MAX_SMALL of `places`, the nearest first, however small:
    those not `taken` already, and never `own`."""
    left_out = {town.label for town in taken} | {own}
    others = {t.label: t for t in places if t.label not in left_out}
    by_distance = sorted(others.values(), key=lambda t: haversine_m(centre, t.point))
    return by_distance[:MAX_SMALL]


class NearbyCities:
    def __init__(
        self,
        key: str | None,
        fetch: Fetch = fetch_json,
        clock: Callable[[], float] = time.monotonic,
        photos: CityPhotos | None = None,
    ) -> None:
        self.key = key
        self.photos = photos
        self._fetch = fetch
        self._clock = clock
        self._cache: OrderedDict[LatLon, tuple[float, list[Town]]] = OrderedDict()
        self._lock = threading.Lock()

    def towns(self, point: LatLon) -> list[Town]:
        """The towns near `point`'s square, the nearest to its middle first."""
        if self.key is None:
            raise PlacesUnavailableError(NO_KEY)
        centre = (round(point[0], CELL_DECIMALS), round(point[1], CELL_DECIMALS))
        now = self._clock()
        with self._lock:
            kept = self._cache.get(centre)
            if kept is not None and now - kept[0] < CACHE_TTL_S:
                self._cache.move_to_end(centre)
                return kept[1]
        try:
            cities, near, villages = self._ask(
                centre,
                (CITIES, FAR_RADIUS_M),
                (TOWNS, NEAR_RADIUS_M),
                (VILLAGES, NEAR_RADIUS_M),
            )
            near += [c for c in cities if haversine_m(centre, c.point) <= NEAR_RADIUS_M]
            small = [*villages, *near]
            own = own_place(centre, [*small, *cities])
            large = choose(centre, near, [], own)
            if len(large) < MAX_LARGE:
                (far_towns,) = self._ask(centre, (TOWNS, FAR_RADIUS_M))
                far = cities + far_towns
                large = choose(centre, near, far, own)
            chosen = sorted(
                [*large, *nearest_others(centre, small, large, own)],
                key=lambda t: haversine_m(centre, t.point),
            )
        except Exception:
            # The URL carries the key: no message, no chain.
            raise PlacesUnavailableError(SERVICE_FAILED) from None
        with self._lock:
            self._cache[centre] = (now, chosen)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
        return chosen

    def _ask(self, centre: LatLon, *asked: tuple[str, int]) -> list[list[Town]]:
        """The places of each (categories, radius) around `centre`, asked
        side by side (TASK-288); raises when one did not answer."""
        assert self.key is not None
        urls = [
            nearby_url(self.key, categories, centre, radius_m)
            for categories, radius_m in asked
        ]
        bodies = fetch_together(self._fetch, urls, len(urls))
        for body in bodies:
            if isinstance(body, Exception):
                raise body
        return [parse_towns(body) for body in bodies]

    def body(self, point: LatLon) -> NearbyCitiesBody:
        """The places of `point`'s square, the nearest to `point` first: two
        of them may be nearer the square's middle the other way round. With
        their photos, those that have one."""
        towns = self.towns(point)
        photos = (
            {}
            if self.photos is None
            else self.photos.photos(t.item for t in towns if t.item is not None)
        )
        places = [
            NearbyCityBody(
                label=town.label,
                point=town.point,
                away_m=round(haversine_m(point, town.point)),
                photo=None if town.item is None else photos.get(town.item),
            )
            for town in towns
        ]
        return NearbyCitiesBody(places=sorted(places, key=lambda p: p.away_m))


def install_nearby_cities(
    app: FastAPI, nearby: NearbyCities, route_store: RouteStore | None = None
) -> None:
    """GET /nearby-cities; the towns' centres are cities' centres for
    `route_store`: their examples are kept once drawn (ADR-0136)."""
    app.include_router(nearby_city_routes(nearby, route_store))


def nearby_city_routes(
    nearby: NearbyCities, route_store: RouteStore | None = None
) -> APIRouter:
    router = APIRouter()

    @router.get("/nearby-cities", responses={503: {"model": ErrorBody}})
    def nearby_cities(
        lat: Annotated[float, Query(ge=-90, le=90)],
        lon: Annotated[float, Query(ge=-180, le=180)],
    ) -> NearbyCitiesBody:
        try:
            found = nearby.body((lat, lon))
        except PlacesUnavailableError as exc:
            raise HTTPException(503, str(exc)) from None
        if route_store is not None:
            route_store.learn(place.point for place in found.places)
        return found

    return router
