"""Places for the start, suggested while typing (TASK-123, ADR-0095).

GET /places asks Geoapify's autocomplete, OpenStreetMap data, with a key the
app never sees: GEOAPIFY_API_KEY in the API's environment. Without the key
the API answers 503 and the app asks Photon itself, as before (ADR-0029).
Answers are kept in memory for a while: the same letters typed again, or
"Search" after a suggestion, cost nothing and wait for nothing.

The only place that names the service: change it here.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from pydantic import BaseModel

log = logging.getLogger(__name__)

KEY_VARIABLE = "GEOAPIFY_API_KEY"
AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
MAX_PLACES = 5
MIN_QUERY_LENGTH = 1
MAX_QUERY_LENGTH = 200
# Geoapify answers in a fraction of a second: a request still waiting after
# this is asked once more (TASK-288), rather than waited for longer.
TIMEOUT_S = 3.0
ATTEMPTS = 2
# Before asking again: a moment, or a second when the service said it is
# busy (429; the free plan takes 5 requests a second).
RETRY_AFTER_S = 0.5
BUSY_RETRY_AFTER_S = 1.0
# A morning of typing fits; an hour later the same words ask again.
CACHE_SIZE = 500
CACHE_TTL_S = 3600.0
# Places "near" the same point within ~1 km share an answer.
NEAR_DECIMALS = 2

NO_KEY = f"Place search is off: {KEY_VARIABLE} is not set on the API."
SERVICE_FAILED = "The place search service did not answer; try again."

Fetch = Callable[[str], Any]
"""Gets a URL and returns its JSON; raises on any failure."""


class PlaceBody(BaseModel):
    """What the user reads, e.g. "Via Rodolfo Belenzani, Trento"."""

    label: str
    point: tuple[float, float]
    """(lat, lon)."""


class PlacesBody(BaseModel):
    """The answer of GET /places: packages/shared-types/fixtures/places.json."""

    places: list[PlaceBody]


class PlacesUnavailableError(Exception):
    """No key, or the service failed: the app falls back to Photon."""


def failure_of(exc: BaseException) -> str:
    """What went wrong, for a log: "HTTP 429", "TimeoutError". Never the
    message, which may hold the URL, and the URL holds the key."""
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, BaseException):
        return type(exc.reason).__name__
    return type(exc).__name__


def worth_asking_again(exc: BaseException) -> bool:
    """A slow or broken connection, a busy service, a failure on its side:
    another try may do. Any other answer would be the same."""
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code == 429 or exc.code >= 500
    return isinstance(exc, urllib.error.URLError | TimeoutError | ConnectionError)


def fetch_json(
    url: str,
    open_url: Callable[..., Any] = urllib.request.urlopen,
    sleep: Callable[[float], None] = time.sleep,
) -> Any:
    """The JSON at `url`, asked once more after a failure worth it; raises
    the last failure. Logs what failed, never the URL."""
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with open_url(request, timeout=TIMEOUT_S) as response:
                return json.load(response)
        except Exception as exc:
            said = failure_of(exc)
            if attempt == ATTEMPTS or not worth_asking_again(exc):
                log.warning("Geoapify did not answer: %s", said)
                raise
            wait = BUSY_RETRY_AFTER_S if said == "HTTP 429" else RETRY_AFTER_S
            log.info("Geoapify did not answer (%s): asking again in %.1f s", said, wait)
            sleep(wait)
    raise AssertionError("unreachable")  # pragma: no cover


def fetch_together(fetch: Fetch, urls: Sequence[str], workers: int) -> list[Any]:
    """The JSON of each URL, or what it raised, in the order of `urls`:
    asked side by side, at most `workers` at a time, so the wait is the
    slowest one's and not their sum (TASK-288)."""
    if len(urls) <= 1:
        return [_fetched(fetch, url) for url in urls]
    with ThreadPoolExecutor(max_workers=min(workers, len(urls))) as pool:
        return list(pool.map(lambda url: _fetched(fetch, url), urls))


def _fetched(fetch: Fetch, url: str) -> Any:
    try:
        return fetch(url)
    except Exception as exc:
        return exc


def autocomplete_url(
    key: str, query: str, near: tuple[float, float] | None = None
) -> str:
    """With `near`, places around it come first (as Photon's lat/lon)."""
    params = {
        "text": query.strip(),
        "limit": str(MAX_PLACES),
        "format": "json",
        "apiKey": key,
    }
    if near is not None:
        params["bias"] = f"proximity:{near[1]},{near[0]}"
    return f"{AUTOCOMPLETE_URL}?{urllib.parse.urlencode(params)}"


def place_label(result: Mapping[str, Any]) -> str | None:
    """The name, then the first wider area that differs from it: the same
    labels the app makes from Photon (apps/mobile/src/places/photon.ts)."""

    def text(key: str) -> str | None:
        value = result.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else None

    address = " ".join(
        part for part in (text("street"), text("housenumber")) if part is not None
    )
    name = text("name") or address or None
    if name is None:
        return None
    for key in ("city", "county", "state", "country"):
        area = text(key)
        if area is not None and area != name:
            return f"{name}, {area}"
    return name


def parse_autocomplete(body: Any) -> list[PlaceBody]:
    """Results without a name or a point are skipped, and so are repeated
    labels."""
    results = body.get("results") if isinstance(body, dict) else None
    places: list[PlaceBody] = []
    labels: set[str] = set()
    for result in results if isinstance(results, list) else []:
        if not isinstance(result, dict):
            continue
        lat, lon = result.get("lat"), result.get("lon")
        if not all(
            isinstance(value, int | float) and not isinstance(value, bool)
            for value in (lat, lon)
        ):
            continue
        label = place_label(result)
        if label is None or label in labels:
            continue
        labels.add(label)
        places.append(PlaceBody(label=label, point=(float(lat), float(lon))))
    return places


class PlaceSearch:
    """Geoapify behind a small cache. `key` None: every search is
    PlacesUnavailableError."""

    def __init__(
        self,
        key: str | None,
        fetch: Fetch = fetch_json,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.key = key
        self._fetch = fetch
        self._clock = clock
        self._cache: OrderedDict[tuple[object, ...], tuple[float, list[PlaceBody]]] = (
            OrderedDict()
        )
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> PlaceSearch:
        return cls(environ.get(KEY_VARIABLE, "").strip() or None)

    def search(
        self, query: str, near: tuple[float, float] | None = None
    ) -> list[PlaceBody]:
        if self.key is None:
            raise PlacesUnavailableError(NO_KEY)
        text = " ".join(query.split()).lower()
        where = (
            None
            if near is None
            else (round(near[0], NEAR_DECIMALS), round(near[1], NEAR_DECIMALS))
        )
        cache_key = (text, where)
        now = self._clock()
        with self._lock:
            kept = self._cache.get(cache_key)
            if kept is not None and now - kept[0] < CACHE_TTL_S:
                self._cache.move_to_end(cache_key)
                return kept[1]
        try:
            body = self._fetch(autocomplete_url(self.key, query, where))
        except Exception:
            # The URL carries the key: neither the message nor the chain
            # (`from None`) may bring it to a log.
            raise PlacesUnavailableError(SERVICE_FAILED) from None
        places = parse_autocomplete(body)
        with self._lock:
            self._cache[cache_key] = (now, places)
            self._cache.move_to_end(cache_key)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
        return places
