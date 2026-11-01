"""A shape through real places of a theme, in any city (TASK-129, ADR-0099).

POST /themed-route-jobs takes the words ("a romantic heart in Paris") and,
when the app knows it, the point of the city; the job reads the words
(themes.py), finds the places of the theme around the city, and plans the
shape through them (route_engine.stops). GET /themed-route-jobs/{id} says
how it went: the route, and every place found, passed by or not.

The places are OpenStreetMap's, through Geoapify's Places API with the key
of the place search (places.py): named ones only, those with a Wikidata
entry first. Nothing is invented: too few places, and the job says so.

A place passed by has its photo when its Wikidata item has a free one
(TASK-329, ADR-0287): the photos of the towns nearby (city_photos.py,
ADR-0243), asked for at most WAIT_S; only the items go to Wikimedia.
"""

from __future__ import annotations

import logging
import threading
import time
import urllib.parse
import uuid
from collections import OrderedDict
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field
from route_engine.geo import LatLon
from route_engine.optimizer import (
    SHAPE_POINTS,
    GraphLoader,
    Plan,
    plan_shape,
    required_area,
    tilt_limit,
)
from route_engine.shapes import get_shape
from route_engine.stops import Stop, StopsPlan, plan_through_stops, union

from shaperoute_api.cities import CitySearch
from shaperoute_api.city_photos import CityPhotoBody, CityPhotos
from shaperoute_api.errors import error_of
from shaperoute_api.insights import Insights
from shaperoute_api.insights.events import redact
from shaperoute_api.nearby_cities import item_of
from shaperoute_api.places import Fetch, PlacesUnavailableError, fetch_json
from shaperoute_api.themes import (
    THEMES,
    Theme,
    ThemeChooser,
    plain,
    read_with_ai,
    request_core,
)

log = logging.getLogger(__name__)

PLACES_URL = "https://api.geoapify.com/v2/places"
# Places asked for, and kept: the best first, enough to choose starts from.
ASK_PLACES = 60
MAX_STOPS = 15
# Fewer than this, and there is no theme to draw through.
MIN_STOPS = 2
# A notable theme keeps only notable places when it has at least this many.
MIN_NOTABLE = 3
# Places within about the size of the shape: it passes through its start.
MIN_RADIUS_M = 800
MAX_RADIUS_M = 5_000
CACHE_SIZE = 200
CACHE_TTL_S = 24 * 3600.0
KEEP_S = 600.0

JobStatus = Literal["queued", "running", "done", "failed"]


class ThemedRequestBody(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    """The request in words, e.g. "voglio un percorso romantico a Parigi"."""
    centre: tuple[float, float] | None = None
    """(lat, lon) of the city, when the app already has it; else the city is
    read from the words and looked up."""
    city: str | None = Field(default=None, max_length=120)
    """How the app names the city, for the answer."""


@dataclass(frozen=True)
class Place(Stop):
    """A stop as Geoapify gives it, with its Wikidata item when it has one:
    the engine reads only the name and the point."""

    wikidata: str | None = None


class StopBody(BaseModel):
    name: str
    point: tuple[float, float]
    passed: bool
    wikidata: str | None = None
    """The place's Wikidata item ("Q12345"), when OpenStreetMap names one
    (TASK-329)."""
    photo: CityPhotoBody | None = None
    """A place passed by: its photo, with a free licence, kept on the API
    as the towns' are (/city-photos/{item}.jpg); null without one."""


class ThemedResultBody(BaseModel):
    points: list[tuple[float, float]]
    distance_m: float
    similarity: float
    shape: str
    theme: str
    theme_label: str
    target_m: int
    city: str | None
    centre: tuple[float, float]
    stops: list[StopBody]
    """Every place found, those passed by first, in the order met."""
    license: str = "Places and roads © OpenStreetMap contributors"


class ThemedError(BaseModel):
    code: str
    message: str


class ThemedJobBody(BaseModel):
    job_id: str
    status: JobStatus
    result: ThemedResultBody | None = None
    error: ThemedError | None = None


class ThemedRouteError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def search_radius_m(distance_m: int) -> int:
    return int(min(max(distance_m / 4, MIN_RADIUS_M), MAX_RADIUS_M))


def places_url(key: str, theme: Theme, centre: LatLon, radius_m: int) -> str:
    # About a kilometre, as every position sent to Geoapify (TASK-363): the
    # radius is kilometres wide, and the route still starts at the centre.
    lat, lon = round(centre[0], 2), round(centre[1], 2)
    params = {
        "categories": theme.categories,
        "conditions": "named",
        "filter": f"circle:{lon},{lat},{radius_m}",
        "bias": f"proximity:{lon},{lat}",
        "limit": str(ASK_PLACES),
        "apiKey": key,
    }
    return f"{PLACES_URL}?{urllib.parse.urlencode(params)}"


def parse_places(body: Any, notable_only: bool) -> list[Place]:
    """Named places with a point, each name once, with their Wikidata item;
    those with a Wikidata entry first, and with `notable_only` only those
    when there are enough. In the order the service gave, nearest first."""
    features = body.get("features") if isinstance(body, dict) else None
    notable: list[Place] = []
    others: list[Place] = []
    seen: set[str] = set()
    for feature in features if isinstance(features, list) else []:
        props = feature.get("properties") if isinstance(feature, dict) else None
        if not isinstance(props, dict):
            continue
        name, lat, lon = props.get("name"), props.get("lat"), props.get("lon")
        if not isinstance(name, str) or not name.strip():
            continue
        if not all(
            isinstance(v, int | float) and not isinstance(v, bool) for v in (lat, lon)
        ):
            continue
        key = plain(name)
        if key in seen:
            continue
        seen.add(key)
        stop = Place(name.strip(), (float(lat), float(lon)), item_of(props))
        wiki = props.get("wiki_and_media")
        if isinstance(wiki, dict) and wiki.get("wikidata"):
            notable.append(stop)
        else:
            others.append(stop)
    if notable_only and len(notable) >= MIN_NOTABLE:
        return notable[:MAX_STOPS]
    return (notable + others)[:MAX_STOPS]


class StopFinder:
    """The places of a theme around a point, behind a cache: the same city
    and theme cost one call a day."""

    def __init__(self, key: str | None, fetch: Fetch = fetch_json) -> None:
        self.key = key
        self._fetch = fetch
        self._cache: OrderedDict[tuple[object, ...], tuple[float, list[Place]]] = (
            OrderedDict()
        )
        self._lock = threading.Lock()

    def find(self, theme: Theme, centre: LatLon, radius_m: int) -> list[Place]:
        if self.key is None:
            raise ThemedRouteError(
                "places_unavailable", "Place search is off on this API."
            )
        cache_key = (
            theme.categories,
            round(centre[0], 3),
            round(centre[1], 3),
            radius_m,
        )
        now = time.monotonic()
        with self._lock:
            kept = self._cache.get(cache_key)
            if kept is not None and now - kept[0] < CACHE_TTL_S:
                return kept[1]
        try:
            body = self._fetch(places_url(self.key, theme, centre, radius_m))
        except Exception:
            # The URL carries the key: no message, no chain.
            raise ThemedRouteError(
                "places_unavailable", "The places service did not answer; try again."
            ) from None
        stops = parse_places(body, theme.notable)
        with self._lock:
            self._cache[cache_key] = (now, stops)
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
        return stops


PlanThrough = Callable[[str, int, LatLon, list[Place], GraphLoader], StopsPlan]


def plan_shape_through(
    shape: str,
    distance_m: int,
    centre: LatLon,
    stops: list[Place],
    source: GraphLoader,
) -> StopsPlan:
    outline = get_shape(shape)(SHAPE_POINTS)

    def plan_from(start: LatLon) -> Plan:
        return plan_shape(
            outline, shape, start, distance_m, source, max_tilt_deg=tilt_limit(shape)
        )

    def prepare(starts: Sequence[LatLon]) -> None:
        # One download for every start: Overpass refuses after a few.
        source.load(union([required_area(outline, s, distance_m) for s in starts]))

    return plan_through_stops(centre, stops, plan_from, prepare=prepare)


@dataclass
class ThemedJob:
    job_id: str
    body: ThemedRequestBody
    status: JobStatus = "queued"
    result: ThemedResultBody | None = None
    error: ThemedError | None = None
    finished_at: float | None = None
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def as_body(self) -> ThemedJobBody:
        return ThemedJobBody(
            job_id=self.job_id, status=self.status, result=self.result, error=self.error
        )


class ThemedJobs:
    def __init__(
        self,
        source: GraphLoader,
        finder: StopFinder,
        cities: CitySearch | None = None,
        ai: ThemeChooser | None = None,
        plan: PlanThrough = plan_shape_through,
        run_inline: bool = False,
        insights: Insights | None = None,
        photos: CityPhotos | None = None,
    ) -> None:
        self.source = source
        self.finder = finder
        self.cities = cities
        self.ai = ai
        self.plan = plan
        self.run_inline = run_inline
        # The photos of the places passed by (TASK-329); none without.
        self.photos = photos
        # The search events, and the learned vocabulary (TASK-130).
        self.insights = insights or Insights(None)
        self._jobs: dict[str, ThemedJob] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(1, thread_name_prefix="themed")

    def submit(self, body: ThemedRequestBody) -> ThemedJob:
        job = ThemedJob(uuid.uuid4().hex, body)
        with self._lock:
            self._forget_old()
            self._jobs[job.job_id] = job
        if self.run_inline:
            self._run(job)
        else:
            self._pool.submit(self._run, job)
        return job

    def get(self, job_id: str) -> ThemedJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _forget_old(self) -> None:
        now = time.monotonic()
        for job_id in [
            j.job_id
            for j in self._jobs.values()
            if j.finished_at is not None and now - j.finished_at > KEEP_S
        ]:
            del self._jobs[job_id]

    def _run(self, job: ThemedJob) -> None:
        job.status = "running"
        started = time.monotonic()
        # What result_of found out, for the event even when it fails.
        seen: dict[str, Any] = {}
        try:
            job.result = self.result_of(job.body, seen)
            job.status = "done"
        except ThemedRouteError as exc:
            job.error = ThemedError(code=exc.code, message=str(exc))
            job.status = "failed"
        except Exception as exc:  # the engine's, the AI's: as route jobs say
            _, detail = error_of(exc)
            if detail.code == "engine_error":
                log.exception("themed route failed")
            job.error = ThemedError(code=detail.code, message=detail.message)
            job.status = "failed"
        job.finished_at = time.monotonic()
        result = job.result
        self.insights.record(
            "themed",
            text=job.body.text,
            core=redact(request_core(job.body.text)),
            started=started,
            outcome="ok" if result is not None else "error",
            code=None if job.error is None else job.error.code,
            quality=None if result is None else round(result.similarity, 3),
            passed=None if result is None else sum(s.passed for s in result.stops),
            **seen,
        )

    def result_of(
        self, body: ThemedRequestBody, seen: dict[str, Any] | None = None
    ) -> ThemedResultBody:
        seen = {} if seen is None else seen
        vocab = self.insights.vocab
        reading_started = time.monotonic()
        reading = read_with_ai(body.text, self.ai, vocab.theme_for, vocab.correct)
        seen.update(
            theme=reading.theme,
            shape=reading.shape,
            by=reading.by,
            read_ms=round((time.monotonic() - reading_started) * 1000),
        )
        if reading.theme is None:
            raise ThemedRouteError(
                "theme_unknown",
                "Say what the route is about: romantic, food, famous places, "
                "views, parks or museums.",
            )
        centre, city = self._centre(body, reading.city)
        theme = THEMES[reading.theme]
        shape = reading.shape or theme.shape
        seen.update(city=city, shape=shape)
        stops = self.finder.find(theme, centre, search_radius_m(reading.distance_m))
        seen["found"] = len(stops)
        log.info(
            "themed: %s, %s, %d m, %d places (%s)",
            reading.theme,
            shape,
            reading.distance_m,
            len(stops),
            reading.by,
        )
        if len(stops) < MIN_STOPS:
            raise ThemedRouteError(
                "no_places",
                f"Not enough verified {theme.label} here ({len(stops)} found): "
                "try another theme or a bigger city.",
            )
        planned = self.plan(shape, reading.distance_m, centre, stops, self.source)
        route = planned.plan.result
        passed = {s.name for s in planned.passed}
        ordered = list(planned.passed) + [s for s in stops if s.name not in passed]
        items = {s.name: s.wikidata for s in stops}
        # Only the places passed by have their photo on the way.
        shown = [items.get(s.name) for s in planned.passed]
        photos = (
            {}
            if self.photos is None
            else self.photos.photos(item for item in shown if item is not None)
        )
        return ThemedResultBody(
            points=list(route.points),
            distance_m=route.distance_m,
            similarity=route.similarity,
            shape=shape,
            theme=reading.theme,
            theme_label=theme.label,
            target_m=reading.distance_m,
            city=city,
            centre=centre,
            stops=[
                StopBody(
                    name=s.name,
                    point=s.point,
                    passed=s.name in passed,
                    wikidata=items.get(s.name),
                    photo=(
                        photos.get(items.get(s.name) or "")
                        if s.name in passed
                        else None
                    ),
                )
                for s in ordered
            ],
        )

    def _centre(
        self, body: ThemedRequestBody, city_words: str | None
    ) -> tuple[LatLon, str | None]:
        """The app's point when it sent one; else the city in the words,
        looked up; else there is nowhere to draw."""
        if body.centre is not None and city_words is None:
            return body.centre, body.city
        if city_words is not None and self.cities is not None:
            try:
                found = self.cities.search(city_words)
            except PlacesUnavailableError:
                found = []
            if found:
                return found[0].point, found[0].label
        if body.centre is not None:
            return body.centre, body.city
        raise ThemedRouteError(
            "city_unknown", "Which city? Search for it, or write it in the request."
        )
