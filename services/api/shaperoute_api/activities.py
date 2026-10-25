"""My activities: the runs an account recorded (TASK-172, ADR-0140,
docs/DATABASE.md).

The app sends a run as it recorded it: the fixes, the pauses, and the route
it followed when there was one, with the walks of a word with the pen up
(TASK-199). The API keeps where the runner was (the
engine's cleaning of the track, ADR-0090) and counts metres, seconds and
score itself: the app's own numbers are never asked for. The app names the
run with a key made from its track, so a run sent twice is kept once.

Every endpoint needs the token of an account (accounts.py): a run is seen,
opened and deleted only by its owner. Deleting the account deletes its runs
(ON DELETE CASCADE). A run opened whole has its pauses as they are kept
(TASK-200). A run says what it was, on foot, by bike or paddling (TASK-208):
its drawing shows it, and Strava takes it (drawings.py, strava.py). A run
along a route whose shape the engine turned keeps the turn (TASK-232,
ADR-0195): the app shows the run turned back, so the drawing reads upright.
"""

from __future__ import annotations

import json
import math
import os
import threading
import urllib.parse
from collections import OrderedDict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal, NotRequired

from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
)
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from route_engine.geo import haversine_m
from route_engine.pen_up import walks_problem
from route_engine.track_score import (
    TrackNotScorableError,
    TrackPoint,
    clean_track,
    score_track,
)

# Pydantic reads a TypedDict of `typing` only from Python 3.12; pydantic
# itself depends on typing_extensions.
from typing_extensions import TypedDict

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
    now_utc,
)
from shaperoute_api.best_routes import line_key
from shaperoute_api.db import Database
from shaperoute_api.game import after_run_saved, notify_unlocked
from shaperoute_api.insights import Insights
from shaperoute_api.places import KEY_VARIABLE, Fetch, fetch_json
from shaperoute_api.recommended import preview
from shaperoute_api.route_archive import count_run
from shaperoute_api.schemas import (
    MAX_ROUTE_POINTS,
    MAX_TRACK_FIXES,
    MAX_WALKS,
    ErrorBody,
    TrackFixBody,
    Walk,
)

# Years of a run a day, and one account cannot fill the database.
MAX_ACTIVITIES = 2_000
# A runner who stops at every crossing of a marathon has fewer.
MAX_PAUSES = 1_000
KEY_PATTERN = r"^[a-z0-9]{8,40}$"
# A page of the list: what a phone shows in a few screens.
PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
# Where a page ended: the start of its last run, in microseconds, and its
# row. Seventeen digits of microseconds reach the year 5138: a datetime.
CURSOR_PATTERN = r"^\d{1,17}-\d{1,18}$"
# A phone's clock that says a run began before this, or after tomorrow, is
# not a clock.
EARLIEST_RUN = datetime(2020, 1, 1, tzinfo=UTC)
CLOCK_AHEAD = timedelta(days=1)
EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
MICROSECOND = timedelta(microseconds=1)

# The name of the place a run starts from: Geoapify's reverse geocoding, with
# the key of the place search (places.py). It is asked for the start rounded
# to about a kilometre, as the place search does with what is near: the
# service never has the door the run began at.
REVERSE_URL = "https://api.geoapify.com/v1/geocode/reverse"
PLACE_DECIMALS = 2
MAX_PLACE_LENGTH = 80
PLACE_CACHE_SIZE = 2_000

ACTIVITIES_FULL = f"You have {MAX_ACTIVITIES} activities: delete one to save another."
UNKNOWN_ACTIVITY = "No activity with this key."
BAD_CLOCK = "This run cannot be saved: its times are not those of a clock."

LatLon = tuple[float, float]
Key = Annotated[str, Path(pattern=KEY_PATTERN)]
# What a run was (TASK-208): the activities of the API, SUPPORTED_ACTIVITIES.
RunActivity = Literal["running", "cycling", "paddling"]


def _on_earth(points: Sequence[LatLon]) -> None:
    for lat, lon in points:
        # Written so that NaN, which compares false with anything, fails.
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("a point is (lat, lon) in degrees, WGS84")


class PauseBody(BaseModel):
    """A stretch of the run that is not of it, on the clock of the fixes."""

    model_config = ConfigDict(extra="forbid")

    from_ms: float = Field(allow_inf_nan=False)
    to_ms: float = Field(allow_inf_nan=False)
    auto: bool = False
    """The app paused by itself because the runner stood still; false when
    the runner asked, and what lies between the two fixes around it is then
    not run."""
    pen: bool = False
    """The app paused by itself between two letters of a word with the pen
    up (TASK-198, TASK-199): the runner walks to the next letter. Counted as
    a pause the runner asked for; missing from an older app."""

    @model_validator(mode="after")
    def in_order(self) -> PauseBody:
        if self.to_ms < self.from_ms:
            raise ValueError("a pause ends after it begins")
        return self


class ActivityRequestBody(BaseModel):
    """PUT /me/activities/{key}: the run as the app recorded it:
    packages/shared-types/fixtures/activity-request.json."""

    model_config = ConfigDict(extra="forbid")

    track: list[TrackFixBody] = Field(min_length=2, max_length=MAX_TRACK_FIXES)
    pauses: list[PauseBody] = Field(default_factory=list, max_length=MAX_PAUSES)
    points: list[LatLon] | None = Field(
        default=None, min_length=2, max_length=MAX_ROUTE_POINTS
    )
    """The planned route, RouteResult.points; null for a run without one."""
    similarity: float | None = Field(default=None, ge=0, le=1)
    """The planned route's; null exactly when `points` is."""
    shape: str | None = Field(default=None, max_length=40)
    word: str | None = Field(default=None, max_length=40)
    style: Literal["round", "block"] | None = None
    title: str | None = Field(default=None, max_length=60)
    walks: list[Walk] = Field(default_factory=list, max_length=MAX_WALKS)
    """The planned route's, RouteResult.walks, for a word with the pen up
    (TASK-199): the score is then of the letters alone. Only with `points`;
    missing from an older app."""
    activity: RunActivity = "running"
    """What the run was (TASK-208); missing from an older app, which only
    ran. Its drawing may change it later."""
    rotation_deg: float | None = Field(
        default=None, ge=-180, le=180, allow_inf_nan=False
    )
    """How far the planned route's shape is turned, RouteResult.rotation_deg
    (TASK-232, ADR-0195): the app shows the run turned the other way, so the
    drawing reads upright. Only with `points`, and only when the route is
    turned: an older app, and a route north up, send nothing."""

    @field_validator("track")
    @classmethod
    def fixes_on_earth(cls, track: list[TrackFixBody]) -> list[TrackFixBody]:
        _on_earth([fix.point for fix in track])
        if not all(math.isfinite(fix.time_ms) for fix in track):
            raise ValueError("a fix has a time, in milliseconds")
        return track

    @field_validator("points")
    @classmethod
    def route_on_earth(cls, points: list[LatLon] | None) -> list[LatLon] | None:
        if points is not None:
            _on_earth(points)
        return points

    @model_validator(mode="after")
    def a_route_whole_or_none(self) -> ActivityRequestBody:
        if (self.points is None) != (self.similarity is None):
            raise ValueError("points and similarity come together, or neither")
        if self.walks and self.points is None:
            raise ValueError("walks are stretches of points: there are none")
        if self.rotation_deg is not None and self.points is None:
            raise ValueError("rotation_deg is the route's: there is none")
        # As POST /track-scores checks them (schemas.py).
        problem = walks_problem(self.walks, len(self.points or []))
        if problem is not None:
            raise ValueError(problem)
        return self


class ActivityBody(BaseModel):
    """One run of the list, with a light preview of its lines:
    packages/shared-types/fixtures/activities.json."""

    id: str
    """The key the app gave it."""
    started_at: datetime
    place: str | None
    shape: str | None
    word: str | None
    style: str | None
    title: str | None
    distance_m: int
    duration_s: int
    score: int | None
    fidelity: float | None
    rotation_deg: float | None = None
    """How far the planned route's shape is turned (TASK-232, ADR-0195):
    the app draws the run turned the other way. Null for a run without a
    route, one whose route was north up, and every run saved before. Always
    answered; the default is for the examples written before."""
    activity: RunActivity
    """What the run was (TASK-251): the app writes a paddler's pace."""
    route_preview: list[LatLon] | None
    track_preview: list[LatLon]


class ActivitiesBody(BaseModel):
    """A page of the list, the latest run first."""

    activities: list[ActivityBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""
    total: int
    """How many runs the account has, on every page."""


class RunPauseBody(TypedDict):
    """A pause of a run kept, as the `pauses` column has it: in seconds since
    the first point of `track`, only what lies inside the run."""

    from_s: float
    to_s: float
    auto: bool
    pen: NotRequired[bool]
    """Only when true: a pause of the pen between two letters (TASK-199)."""


# --- The post of a run (TASK-258, ADR-0222) ---

# The numbers a post can show, in its order (the app's POST_RESULTS).
PostResult = Literal["distance", "time", "pace"]
MAX_POST_EMOJI = 5
MAX_POST_TITLE = 120


class PostEmojiBody(BaseModel):
    """An emoji laid on the post, its centre as shares of the picture's
    width and height from the top left."""

    model_config = ConfigDict(extra="forbid")

    emoji: str = Field(min_length=1, max_length=16)
    x: float = Field(ge=0, le=1, allow_inf_nan=False)
    y: float = Field(ge=0, le=1, allow_inf_nan=False)


class RunPostRequestBody(BaseModel):
    """PUT /me/activities/{key}/post: the post as the app shared it, enough
    to make the same picture again from the run:
    packages/shared-types/fixtures/run-post-request.json. Never the
    picture itself."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=MAX_POST_TITLE)
    """What was written over the drawing: the run's title, or where it
    was and what it drew; null for a post without one."""
    results: list[PostResult] = Field(default_factory=list, max_length=3)
    """The results shown, in the post's order."""
    emoji: list[PostEmojiBody] = Field(default_factory=list, max_length=MAX_POST_EMOJI)

    @field_validator("results")
    @classmethod
    def each_once(cls, results: list[str]) -> list[str]:
        if len(set(results)) != len(results):
            raise ValueError("a result is shown once")
        return results


class RunPostBody(RunPostRequestBody):
    """The post kept, with when it was last shared:
    packages/shared-types/fixtures/run-post.json."""

    shared_at: datetime


class ActivityDetailBody(BaseModel):
    """GET /me/activities/{key}: the run whole, to show on the map:
    packages/shared-types/fixtures/activity.json, and activity-pauses.json
    since TASK-200."""

    id: str
    started_at: datetime
    place: str | None
    shape: str | None
    word: str | None
    style: str | None
    title: str | None
    distance_m: int
    duration_s: int
    score: int | None
    fidelity: float | None
    rotation_deg: float | None = None
    """As in the list: the planned route's turn, or null."""
    activity: RunActivity
    """What the run was (TASK-251)."""
    similarity: float | None
    """The planned route's."""
    points: list[LatLon] | None
    track: list[LatLon]
    walks: list[Walk]
    """The planned route's, for a word with the pen up (TASK-199): [from,
    to] indices into `points`; empty for any other run, and for the runs
    saved before."""
    pauses: list[RunPauseBody]
    """In the order they were sent, on the clock of `track` (TASK-200);
    empty for a run without."""
    post: RunPostBody | None = None
    """The post as it was last shared (TASK-258); null for a run whose post
    was never shared. Always answered; the default is for the examples
    written before."""


# --- The place a run starts from ---


def reverse_url(key: str, point: LatLon) -> str:
    params = {
        "lat": repr(point[0]),
        "lon": repr(point[1]),
        "type": "city",
        "limit": "1",
        "format": "json",
        "apiKey": key,
    }
    return f"{REVERSE_URL}?{urllib.parse.urlencode(params)}"


def parse_place(body: Any) -> str | None:
    """The city, town or village of the first result: "Trento"."""
    results = body.get("results") if isinstance(body, dict) else None
    first = results[0] if isinstance(results, list) and results else None
    if not isinstance(first, dict):
        return None
    for field in ("city", "name"):
        value = first.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()[:MAX_PLACE_LENGTH]
    return None


class PlaceNames:
    """The name of the town around a point. None without a key, when the
    service fails or when there is no town there: a run without the name of
    its place is still a run."""

    def __init__(self, key: str | None, fetch: Fetch = fetch_json) -> None:
        self.key = key
        self._fetch = fetch
        self._cache: OrderedDict[LatLon, str | None] = OrderedDict()
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> PlaceNames:
        return cls(environ.get(KEY_VARIABLE, "").strip() or None)

    def name_of(self, point: LatLon) -> str | None:
        if self.key is None:
            return None
        where = (round(point[0], PLACE_DECIMALS), round(point[1], PLACE_DECIMALS))
        with self._lock:
            if where in self._cache:
                self._cache.move_to_end(where)
                return self._cache[where]
        try:
            body = self._fetch(reverse_url(self.key, where))
        except Exception:
            # The URL carries the key and a position: nothing of it is
            # raised or logged. Not remembered: the next run asks again.
            return None
        name = parse_place(body)
        with self._lock:
            self._cache[where] = name
            while len(self._cache) > PLACE_CACHE_SIZE:
                self._cache.popitem(last=False)
        return name


# --- What the API counts of a run ---


@dataclass(frozen=True)
class Pause:
    """In seconds since the first point of the track."""

    from_s: float
    to_s: float
    auto: bool
    pen: bool = False


@dataclass(frozen=True)
class RecordedRun:
    """A run as it is kept: the track cleaned and what the API counted."""

    track: list[TrackPoint]
    pauses: list[Pause]
    started_at: datetime
    distance_m: int
    duration_s: int
    score: int | None
    fidelity: float | None

    @property
    def start(self) -> LatLon:
        return self.track[0].latlon


def _seconds(point: TrackPoint) -> float:
    assert point.time_s is not None  # every fix of a request has its time
    return point.time_s


def _paused_s(pauses: Sequence[Pause]) -> float:
    """The seconds some pause covers, counted once where two overlap."""
    total, covered = 0.0, 0.0
    for pause in sorted(pauses, key=lambda p: p.from_s):
        start = max(pause.from_s, covered)
        if pause.to_s > start:
            total += pause.to_s - start
            covered = pause.to_s
    return total


def _stopped_between(pauses: Sequence[Pause], from_s: float, to_s: float) -> bool:
    """Whether the runner paused the run between two points one after the
    other: wherever the pause was spent, the step across it is not run. As
    the app counts it (trackRecorder.ts): the pause begins at the first of
    the two or after it; when it ends is the clock's word, not the GPS's."""
    return any(not pause.auto and from_s <= pause.from_s < to_s for pause in pauses)


def recorded(body: ActivityRequestBody, now: datetime) -> RecordedRun:
    """The run in `body` as the API keeps it. AccountError, 422, for a track
    with less than two positions to believe, or with times of no clock."""
    fixes = [
        TrackPoint(
            lat=fix.point[0],
            lon=fix.point[1],
            time_s=fix.time_ms / 1000,
            accuracy_m=fix.accuracy_m,
        )
        for fix in body.track
    ]
    track = clean_track(fixes)
    if len(track) < 2:
        raise AccountError(
            422,
            "invalid_request",
            f"This run cannot be saved: the track has {len(track)} usable"
            " positions, 2 are needed.",
        )
    first_s, last_s = _seconds(track[0]), _seconds(track[-1])
    try:
        started_at = EPOCH + timedelta(seconds=first_s)
    except OverflowError:
        raise AccountError(422, "invalid_request", BAD_CLOCK) from None
    if not EARLIEST_RUN <= started_at <= now + CLOCK_AHEAD:
        raise AccountError(422, "invalid_request", BAD_CLOCK)

    # Only what of a pause lies inside the run, on the clock of the track.
    pauses: list[Pause] = []
    for pause in body.pauses:
        start = max(pause.from_ms / 1000, first_s)
        end = min(pause.to_ms / 1000, last_s)
        if end > start:
            pauses.append(Pause(start - first_s, end - first_s, pause.auto, pause.pen))
    track = [
        TrackPoint(p.lat, p.lon, _seconds(p) - first_s, p.accuracy_m) for p in track
    ]
    distance_m = sum(
        haversine_m(a.latlon, b.latlon)
        for a, b in zip(track, track[1:], strict=False)
        if not _stopped_between(pauses, _seconds(a), _seconds(b))
    )
    duration_s = max(0.0, _seconds(track[-1]) - _paused_s(pauses))

    score, fidelity = None, None
    if body.points is not None and body.similarity is not None:
        try:
            # A word with the pen up is judged on its letters alone, as POST
            # /track-scores judges it (TASK-199).
            scored = score_track(fixes, body.points, body.similarity, body.walks)
        except TrackNotScorableError:
            # Too short to judge against its route: kept, without a score.
            pass
        else:
            score, fidelity = scored.score, scored.fidelity
    return RecordedRun(
        track=track,
        pauses=pauses,
        started_at=started_at,
        distance_m=round(distance_m),
        duration_s=round(duration_s),
        score=score,
        fidelity=fidelity,
    )


# --- The runs in the database ---

COLUMNS = (
    "id, key, started_at, place, shape, word, style, title, distance_m,"
    " duration_s, score, fidelity, route_similarity, walks, activity,"
    " route_rotation_deg,"
    " ST_AsGeoJSON(route, 15) AS route,"
    " ST_AsGeoJSON(ST_Force2D(track), 15) AS track"
)
# A run opened whole: its pauses and its post too, which the list does not
# read.
DETAIL_COLUMNS = COLUMNS + ", pauses, post"


def _route_wkt(points: Sequence[LatLon]) -> str:
    """The line as PostGIS reads it: (lon lat), every digit kept."""
    return "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in points) + ")"


def _track_wkt(track: Sequence[TrackPoint]) -> str:
    """(lon lat m): m the seconds since the first point."""
    return (
        "LINESTRING M ("
        + ",".join(f"{p.lon!r} {p.lat!r} {round(_seconds(p), 3)!r}" for p in track)
        + ")"
    )


def _line(geojson: str) -> list[LatLon]:
    coordinates: list[list[float]] = json.loads(geojson)["coordinates"]
    return [(lat, lon) for lon, lat in coordinates]


def _fields(row: DictRow) -> dict[str, Any]:
    fidelity = row["fidelity"]
    return {
        "id": row["key"],
        "started_at": row["started_at"],
        "place": row["place"],
        "shape": row["shape"],
        "word": row["word"],
        "style": row["style"],
        "title": row["title"],
        "distance_m": row["distance_m"],
        "duration_s": row["duration_s"],
        "score": row["score"],
        # A `real` column: without rounding 0.83 comes back as 0.8299999833.
        "fidelity": None if fidelity is None else round(fidelity, 4),
        "rotation_deg": turn_kept(row["route_rotation_deg"]),
        "activity": row["activity"],
    }


def turn_kept(kept: float | None) -> float | None:
    """A `real` column, as the app sent it: whole degrees mostly, a
    half at most (route_engine.water_fit tries every 5°)."""
    return None if kept is None else round(kept, 2)


def _listed(row: DictRow) -> ActivityBody:
    route = row["route"]
    return ActivityBody(
        **_fields(row),
        route_preview=None if route is None else preview(_line(route)),
        track_preview=preview(_line(row["track"])),
    )


def _whole(row: DictRow) -> ActivityDetailBody:
    route, similarity = row["route"], row["route_similarity"]
    return ActivityDetailBody(
        **_fields(row),
        similarity=None if similarity is None else round(similarity, 4),
        points=None if route is None else _line(route),
        track=_line(row["track"]),
        walks=[(start, end) for start, end in row["walks"]],
        pauses=[_kept_pause(pause) for pause in row["pauses"]],
        post=_kept_post(row["post"]),
    )


def _kept_post(kept: dict[str, Any] | None) -> RunPostBody | None:
    """The post as the `post` column keeps it (TASK-258): what the app sent,
    with `shared_at`; null for none."""
    return None if kept is None else RunPostBody.model_validate(kept)


def _pause(pause: Pause) -> dict[str, Any]:
    """A pause as the `pauses` column keeps it: `pen` only when true, so the
    other pauses are kept as before TASK-199."""
    kept: dict[str, Any] = {
        "from_s": round(pause.from_s, 3),
        "to_s": round(pause.to_s, 3),
        "auto": pause.auto,
    }
    if pause.pen:
        kept["pen"] = True
    return kept


def _kept_pause(kept: dict[str, Any]) -> RunPauseBody:
    """A pause of the column as the detail answers it: `pen` only when
    true, as _pause writes it."""
    pause = RunPauseBody(from_s=kept["from_s"], to_s=kept["to_s"], auto=kept["auto"])
    if kept.get("pen") is True:
        pause["pen"] = True
    return pause


def _cursor(row: DictRow) -> str:
    started_at: datetime = row["started_at"]
    return f"{(started_at - EPOCH) // MICROSECOND}-{row['id']}"


def _after(cursor: str) -> tuple[datetime, int]:
    micros, row_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, int(row_id)


@dataclass
class Activities:
    """The runs in the database."""

    database: Database
    places: PlaceNames
    now: Callable[[], datetime] = now_utc

    def listing(
        self, user_id: int, limit: int = PAGE_SIZE, cursor: str | None = None
    ) -> ActivitiesBody:
        """A page, the latest run first. The cursor is a place in the order,
        not a row: the next page is right even after a run of this one was
        deleted, or a new one saved."""
        where = "user_id = %s"
        values: list[Any] = [user_id]
        if cursor is not None:
            where += " AND (started_at, id) < (%s, %s)"
            values += _after(cursor)
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {COLUMNS} FROM runs WHERE {where}"
                " ORDER BY started_at DESC, id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                "SELECT count(*) AS n FROM runs WHERE user_id = %s", (user_id,)
            ).fetchone()
        assert count is not None
        page, more = rows[:limit], len(rows) > limit
        return ActivitiesBody(
            activities=[_listed(row) for row in page],
            next=_cursor(page[-1]) if more else None,
            total=count["n"],
        )

    def _row(self, user_id: int, key: str, columns: str = COLUMNS) -> DictRow | None:
        with self.database.connect() as conn:
            return conn.execute(
                f"SELECT {columns} FROM runs WHERE user_id = %s AND key = %s",
                (user_id, key),
            ).fetchone()

    def get(self, user_id: int, key: str) -> ActivityDetailBody | None:
        row = self._row(user_id, key, DETAIL_COLUMNS)
        return None if row is None else _whole(row)

    def save(
        self, user_id: int, key: str, body: ActivityRequestBody
    ) -> tuple[ActivityBody, bool]:
        """The run, and whether it is new: one already saved stays as it
        was."""
        saved = self._row(user_id, key)
        if saved is not None:
            return _listed(saved), False
        run = recorded(body, self.now())
        # Asked before the transaction: the service may take seconds.
        place = self.places.name_of(run.start)
        with self.database.connect() as conn:
            # One account's runs change one at a time: the count below is
            # the count when the row goes in.
            conn.execute(
                "SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,)
            ).fetchone()
            saved = conn.execute(
                f"SELECT {COLUMNS} FROM runs WHERE user_id = %s AND key = %s",
                (user_id, key),
            ).fetchone()
            if saved is not None:
                return _listed(saved), False
            count = conn.execute(
                "SELECT count(*) AS n FROM runs WHERE user_id = %s", (user_id,)
            ).fetchone()
            assert count is not None
            if count["n"] >= MAX_ACTIVITIES:
                raise AccountError(422, "invalid_request", ACTIVITIES_FULL)
            row = conn.execute(
                "INSERT INTO runs (user_id, key, route, route_similarity, shape,"
                " word, style, title, track, pauses, started_at, distance_m,"
                " duration_s, score, fidelity, place, created_at, walks, activity,"
                " route_rotation_deg)"
                " VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s,"
                " ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
                " %s)"
                f" RETURNING {COLUMNS}",
                (
                    user_id,
                    key,
                    None if body.points is None else _route_wkt(body.points),
                    body.similarity,
                    body.shape,
                    body.word,
                    body.style,
                    body.title,
                    _track_wkt(run.track),
                    Jsonb([_pause(pause) for pause in run.pauses]),
                    run.started_at,
                    run.distance_m,
                    run.duration_s,
                    run.score,
                    run.fidelity,
                    place,
                    self.now(),
                    Jsonb([list(walk) for walk in body.walks]),
                    body.activity,
                    body.rotation_deg,
                ),
            ).fetchone()
            assert row is not None
            # What the run is worth to the shape game, in the same
            # transaction (TASK-296, game.py).
            after_run_saved(
                conn,
                user_id,
                row["id"],
                run.started_at,
                run.track,
                run.pauses,
                body.activity,
                self.now(),
            )
            # One more run along this line, for whoever asks it next
            # (ADR-0256): the line's name only, never who ran it.
            if body.points is not None:
                count_run(conn, line_key(body.points))
            return _listed(row), True

    def keep_post(
        self, user_id: int, key: str, body: RunPostRequestBody
    ) -> RunPostBody | None:
        """The post of the run, as shared now (TASK-258): written whole,
        over the one before. None for a run the account does not have."""
        post = RunPostBody(**body.model_dump(), shared_at=self.now())
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE runs SET post = %s WHERE user_id = %s AND key = %s"
                " RETURNING post",
                (Jsonb(post.model_dump(mode="json")), user_id, key),
            ).fetchone()
        return None if row is None else _kept_post(row["post"])

    def remove(self, user_id: int, key: str) -> None:
        """Gone, or never there: the same."""
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM runs WHERE user_id = %s AND key = %s", (user_id, key)
            )


def activities_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> Activities:
    """In the database of the accounts, on the same clock."""
    places: PlaceNames = request.app.state.run_places
    return Activities(accounts.database, places, accounts.now)


def activity_routes() -> APIRouter:
    router = APIRouter(tags=["activities"], responses=ACCOUNT_ERRORS)

    @router.get("/me/activities")
    def list_activities(
        activities: Annotated[Activities, Depends(activities_of)],
        user: Annotated[UserBody, Depends(current_user)],
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> ActivitiesBody:
        return activities.listing(user.id, limit, cursor)

    @router.get("/me/activities/{key}", responses={404: {"model": ErrorBody}})
    def get_activity(
        key: Key,
        activities: Annotated[Activities, Depends(activities_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> ActivityDetailBody:
        activity = activities.get(user.id, key)
        if activity is None:
            raise HTTPException(404, UNKNOWN_ACTIVITY)
        return activity

    # Sending a run twice saves it once: 201 the first time, then 200.
    @router.put("/me/activities/{key}", responses={201: {"model": ActivityBody}})
    def save_activity(
        key: Key,
        body: ActivityRequestBody,
        request: Request,
        response: Response,
        activities: Annotated[Activities, Depends(activities_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> ActivityBody:
        activity, created = activities.save(user.id, key, body)
        if created:
            response.status_code = 201
            if activity.score is not None:
                # A run along a route, kept: the search led somewhere
                # (TASK-130). Once, when the run is new, and only how well
                # it went: nothing of who ran it, nor where.
                insights: Insights = request.app.state.run_insights
                insights.record("run_scored", quality=round(activity.score / 100, 3))
            # The shapes the new run unlocked, told after its write (TASK-296).
            notify_unlocked(request, user.id, key)
        return activity

    # The post, as shared: the last one wins (TASK-258).
    @router.put("/me/activities/{key}/post", responses={404: {"model": ErrorBody}})
    def keep_post(
        key: Key,
        body: RunPostRequestBody,
        activities: Annotated[Activities, Depends(activities_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> RunPostBody:
        post = activities.keep_post(user.id, key, body)
        if post is None:
            raise HTTPException(404, UNKNOWN_ACTIVITY)
        return post

    @router.delete("/me/activities/{key}", status_code=204)
    def remove_activity(
        key: Key,
        activities: Annotated[Activities, Depends(activities_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        activities.remove(user.id, key)
        return Response(status_code=204)

    return router


def install_activities(
    app: FastAPI,
    places: PlaceNames | None = None,
    insights: Insights | None = None,
) -> None:
    """The runs of the accounts; after install_accounts, which sets the
    database and the errors. `places` None: the environment's key.
    `insights` hears of each new run saved with a score; None: nobody."""
    app.state.run_places = places if places is not None else PlaceNames.from_env()
    app.state.run_insights = insights if insights is not None else Insights(None)
    app.include_router(activity_routes())
