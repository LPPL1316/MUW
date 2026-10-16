"""Cities of the whole world by name, for "Explore" (TASK-129, ADR-0099).

GET /cities asks Geoapify's geocoding for cities only, with the key of the
place search (places.py). Not its autocomplete: for a city that one gives
the middle of the municipality's area, which for Milan is in Baggio, 6 km
from the Duomo; the geocoding of a city gives the city's own point, its
centre. Answers are kept a day: city centres do not move.

A place has one point, OpenStreetMap's own for it: its `place` node
(TASK-249, ADR-0213). The geocoding of a village may give its municipality
instead, an area whose point is the middle of it, 650 m from the church in
Tenna. For each such area the Places API is asked for the place with the
same label inside it, all the areas side by side (TASK-288), and that point
is the city's: the one GET /city-suggestions and GET /nearby-cities give for
the same place. When the Places API does not answer, the search still does,
with the geocoding's points, and that answer is not kept: the next search
asks again. Neither is an answer without cities.

GET /city-suggestions (TASK-134, TASK-138, ADR-0110) suggests cities and
places in them while typing: "arena di ver" gives the Arena di Verona.
"""

from __future__ import annotations

import logging
import threading
import time
import urllib.parse
from collections import OrderedDict
from collections.abc import Callable, Iterator
from typing import Any, Literal

from pydantic import BaseModel
from route_engine.geo import haversine_m

from shaperoute_api.places import (
    Fetch,
    PlaceBody,
    PlacesBody,
    PlacesUnavailableError,
    failure_of,
    fetch_json,
    fetch_together,
)

log = logging.getLogger(__name__)

GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
# While typing (TASK-138): the autocomplete, any kind of result. Its city
# results carry the city's own point, as the geocoding's; the middle of the
# municipality's area comes with the county results, which are left out.
AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
# OpenStreetMap's places, each with its own point (TASK-249).
PLACES_URL = "https://api.geoapify.com/v2/places"
NODES = "populated_place.city,populated_place.town,populated_place.village"
# A result of this category is a municipality's area, not a place.
AREA = "administrative"
# Places asked within an area, the nearest its point first: the service
# takes the name as a part of theirs ("Milan" gives Novate Milanese too).
MAX_NODES = 20
# The areas' places asked side by side (TASK-288): with the geocoding, at
# most five requests at once, the free plan's five a second.
NODES_AT_ONCE = 4
# Fewer letters say too little about which city.
MIN_SUGGEST_LETTERS = 2
MAX_CITIES = 5
MAX_SUGGESTIONS = 6
# What a suggestion may be: a city, or a place in one. Counties, regions,
# countries and postcodes are areas, without a point to start from.
CITY_TYPES = frozenset({"city"})
PLACE_TYPES = frozenset({"amenity", "building", "street", "suburb", "district"})
# Two places this close are one start: "Verona Arena" and "Arena di Verona".
SAME_PLACE_M = 150.0
CACHE_SIZE = 500
CACHE_TTL_S = 24 * 3600.0

NO_KEY = "City search is off on this API."
SERVICE_FAILED = "The city search service did not answer; try again."


class SuggestionBody(BaseModel):
    """A city, its centre; or a place in a city, its point."""

    label: str
    point: tuple[float, float]
    """(lat, lon)."""
    kind: Literal["city", "place"]
    """Only a city is named in a request's words; a place goes by its point."""


class SuggestionsBody(BaseModel):
    """The answer of GET /city-suggestions: cities first, then places."""

    places: list[SuggestionBody]


def suggest_url(key: str, query: str) -> str:
    params = {
        "text": query.strip(),
        "limit": str(MAX_SUGGESTIONS + 4),  # areas and duplicates are dropped
        "format": "json",
        "apiKey": key,
    }
    return f"{AUTOCOMPLETE_URL}?{urllib.parse.urlencode(params)}"


def cities_url(key: str, query: str) -> str:
    params = {
        "text": query.strip(),
        "type": "city",
        "limit": str(MAX_CITIES),
        "format": "json",
        "apiKey": key,
    }
    return f"{GEOCODE_URL}?{urllib.parse.urlencode(params)}"


def city_label(result: dict[str, Any]) -> str | None:
    """The city, its region, its country: "Milan, Lombardy, Italy"."""
    name = result.get("city") or result.get("name")
    if not isinstance(name, str) or not name.strip():
        return None
    parts = [name.strip()]
    for key in ("state", "country"):
        value = result.get(key)
        if isinstance(value, str) and value.strip() and value.strip() not in parts:
            parts.append(value.strip())
    return ", ".join(parts)


def place_label(properties: dict[str, Any]) -> str | None:
    """The label of one of the Places API's places, as `city_label` of the
    city with its name: `city` there is the municipality around a village."""
    return city_label({**properties, "city": properties.get("name")})


def suggestion_label(result: dict[str, Any], kind: str) -> str | None:
    """Its name, the first wider area that differs, the country: "Verona,
    Veneto, Italy", "Parè, Colverde, Italy" (a village and its municipality),
    "Arena di Verona, Verona, Italy". Nothing without a name: a building
    known only by its address says little."""

    def text(key: str) -> str | None:
        value = result.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else None

    name = text("name")
    if name is None:
        return None
    areas = ("city", "state") if kind == "city" else ("city", "county", "state")
    parts = [name]
    area = next((a for k in areas if (a := text(k)) and a != name), None)
    for part in (area, text("country")):
        if part is not None and part not in parts:
            parts.append(part)
    return ", ".join(parts)


def result_point(result: dict[str, Any]) -> tuple[float, float] | None:
    lat, lon = result.get("lat"), result.get("lon")
    if not all(
        isinstance(v, int | float) and not isinstance(v, bool) for v in (lat, lon)
    ):
        return None
    return float(lat), float(lon)


def _cities(body: Any) -> Iterator[tuple[PlaceBody, dict[str, Any]]]:
    """The geocoding's cities that read, each label once, and the result
    each came from."""
    results = body.get("results") if isinstance(body, dict) else None
    labels: set[str] = set()
    for result in results if isinstance(results, list) else []:
        if not isinstance(result, dict):
            continue
        point = result_point(result)
        if point is None:
            continue
        label = city_label(result)
        if label is None or label in labels:
            continue
        labels.add(label)
        yield PlaceBody(label=label, point=point), result


def parse_cities(body: Any) -> list[PlaceBody]:
    return [city for city, _ in _cities(body)]


def node_url(key: str, result: dict[str, Any]) -> str | None:
    """Asks the places within the bounds of `result`, an area; None when it
    is a place already, with its own point, or its bounds do not read."""
    if result.get("category") != AREA:
        return None
    point = result_point(result)
    box = result.get("bbox")
    corners = (
        [box.get(k) for k in ("lon1", "lat1", "lon2", "lat2")]
        if isinstance(box, dict)
        else []
    )
    name = result.get("city") or result.get("name")
    if point is None or not isinstance(name, str) or len(corners) != 4:
        return None
    if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in corners):
        return None
    params = {
        "categories": NODES,
        "conditions": "named",
        "name": name.strip(),
        "filter": "rect:" + ",".join(str(v) for v in corners),
        "bias": f"proximity:{point[1]},{point[0]}",
        "limit": str(MAX_NODES),
        "apiKey": key,
    }
    return f"{PLACES_URL}?{urllib.parse.urlencode(params)}"


def node_point(label: str, body: Any) -> tuple[float, float] | None:
    """The point of the first place of `body`, the Places API's answer, with
    this label; None when the area has no place named as it is."""
    features = body.get("features") if isinstance(body, dict) else None
    for feature in features if isinstance(features, list) else []:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        if isinstance(properties, dict) and place_label(properties) == label:
            point = result_point(properties)
            if point is not None:
                return point
    return None


def parse_suggestions(body: Any) -> list[SuggestionBody]:
    """Cities and places in the service's order, the best match first; each
    label once, a place once within SAME_PLACE_M, at most MAX_SUGGESTIONS."""
    results = body.get("results") if isinstance(body, dict) else None
    kept: list[SuggestionBody] = []
    for result in results if isinstance(results, list) else []:
        if not isinstance(result, dict) or len(kept) == MAX_SUGGESTIONS:
            continue
        point = result_point(result)
        found = result.get("result_type")
        if point is None or found not in CITY_TYPES | PLACE_TYPES:
            continue
        kind: Literal["city", "place"] = "city" if found in CITY_TYPES else "place"
        label = suggestion_label(result, kind)
        if label is None or any(s.label == label for s in kept):
            continue
        if kind == "place" and any(
            s.kind == "place" and haversine_m(point, s.point) < SAME_PLACE_M
            for s in kept
        ):
            continue
        kept.append(SuggestionBody(label=label, point=point, kind=kind))
    return kept


class CitySearch:
    def __init__(
        self,
        key: str | None,
        fetch: Fetch = fetch_json,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.key = key
        self._fetch = fetch
        self._clock = clock
        self._cache: OrderedDict[str, tuple[float, list[PlaceBody]]] = OrderedDict()
        self._suggested: OrderedDict[str, tuple[float, list[SuggestionBody]]] = (
            OrderedDict()
        )
        self._lock = threading.Lock()

    def search(self, query: str) -> list[PlaceBody]:
        if self.key is None:
            raise PlacesUnavailableError(NO_KEY)
        text = " ".join(query.split()).lower()
        now = self._clock()
        with self._lock:
            kept = self._cache.get(text)
            if kept is not None and now - kept[0] < CACHE_TTL_S:
                self._cache.move_to_end(text)
                return kept[1]
        try:
            body = self._fetch(cities_url(self.key, query))
        except Exception:
            # The URL carries the key: no message, no chain.
            raise PlacesUnavailableError(SERVICE_FAILED) from None
        cities, at_their_nodes = self._at_their_nodes(body)
        if not at_their_nodes or not cities:
            # Not kept: the next search asks the places again, and a name
            # found nowhere is asked again too (TASK-288).
            return cities
        with self._lock:
            self._cache[text] = (now, cities)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
        return cities

    def _at_their_nodes(self, body: Any) -> tuple[list[PlaceBody], bool]:
        """The geocoding's cities, each at its place's own point when the
        geocoding gave an area (TASK-249): one more request for each, all of
        them side by side (TASK-288). False when the Places API did not
        answer for one: that city is at the geocoding's point."""
        assert self.key is not None
        found = list(_cities(body))
        urls = {
            n: url
            for n, (_, result) in enumerate(found)
            if (url := node_url(self.key, result)) is not None
        }
        answers = dict(
            zip(
                urls,
                fetch_together(self._fetch, list(urls.values()), NODES_AT_ONCE),
                strict=True,
            )
        )
        cities: list[PlaceBody] = []
        answered = True
        for n, (city, _) in enumerate(found):
            answer = answers.get(n)
            if isinstance(answer, Exception):
                # The URL carries the key: the kind of failure only.
                log.warning("a city's place not asked: %s", failure_of(answer))
                answered = False
            elif n in answers:
                point = node_point(city.label, answer)
                if point is not None:
                    city = PlaceBody(label=city.label, point=point)
            cities.append(city)
        return cities, answered

    def suggest(self, query: str) -> list[SuggestionBody]:
        """Cities and places whose name begins with what is typed: "Par"
        gives Parma, Paris...; "arena di ver" the Arena di Verona."""
        if self.key is None:
            raise PlacesUnavailableError(NO_KEY)
        text = " ".join(query.split()).lower()
        if len(text) < MIN_SUGGEST_LETTERS:
            return []
        now = self._clock()
        with self._lock:
            kept = self._suggested.get(text)
            if kept is not None and now - kept[0] < CACHE_TTL_S:
                self._suggested.move_to_end(text)
                return kept[1]
        try:
            body = self._fetch(suggest_url(self.key, query))
        except Exception:
            raise PlacesUnavailableError(SERVICE_FAILED) from None
        suggestions = parse_suggestions(body)
        with self._lock:
            self._suggested[text] = (now, suggestions)
            while len(self._suggested) > CACHE_SIZE:
                self._suggested.popitem(last=False)
        return suggestions

    def body(self, query: str) -> PlacesBody:
        return PlacesBody(places=self.search(query))
