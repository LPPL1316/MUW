"""Drawings: the runs an account shows the other members (TASK-117,
TASK-208, docs/API.md, «Drawings»).

A run saved in My activities (activities.py) is private. Its owner may give
it a title, a description, the members it tags, up to three photos
(drawing_photos.py), and say who can see it (ADR-0170): every member, the
members who follow it with the request accepted (follows.py), or only
itself. The photos are kept here only while others can see the drawing:
while only its owner does, they stay on the phone (the user's choice,
2026-10-03).

What the others see is cut: the track without its first and its last
CUT_M metres along it, without times, without the planned route, which
begins at the runner's door (ADR-0114, point 4). The owner keeps the whole
run in My activities.

Who may see a drawing is asked in one place, drawing_seen_sql: the
drawing, its photos and its comments (TASK-120) follow it.

Score, metres and seconds are the run's, counted by the API when it was
saved: nothing here takes them from the app. Deleting the run, or the
account, deletes its drawing (ON DELETE CASCADE); deleting an account
tagged takes its name off the drawing.
"""

from __future__ import annotations

import json
import unicodedata
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field
from route_engine.geo import (
    haversine_m,
    latlon_to_local,
    local_to_latlon,
    path_length_m,
)

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import (
    EPOCH,
    MICROSECOND,
    UNKNOWN_ACTIVITY,
    Key,
    RunActivity,
    turn_kept,
)
from shaperoute_api.db import Database
from shaperoute_api.follows import apart_sql, follows_sql
from shaperoute_api.push import notify_tagged, tagged_before
from shaperoute_api.recommended import preview
from shaperoute_api.schemas import ErrorBody

# What the others never see of a published run, from either end (ADR-0114).
CUT_M = 200.0
# Less is a rounding of the cut, not a drawing.
MIN_LEFT_M = 1.0
# Two points closer than this are one.
SAME_POINT_M = 0.01
MAX_TITLE_LENGTH = 60
MAX_DESCRIPTION_LENGTH = 500
MAX_TAGS = 10
# Besides the map, which is the first picture of a drawing (TASK-208).
MAX_PHOTOS = 3
PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
# Where a page ended: the start of its last run, in microseconds, and the id
# of its drawing, which is random, so a cursor says nothing about the others.
CURSOR_PATTERN = r"^\d{1,17}-[0-9a-f]{32}$"

# Who can see a drawing (ADR-0170): every member, the members who follow its
# owner with the request accepted, or only its owner.
Visibility = Literal["everyone", "followers", "only_me"]
# The only ones that come with the line of a description.
LINE_BREAK = "\n"

TITLE_TOO_LONG = f"A title is at most {MAX_TITLE_LENGTH} characters."
TITLE_NOT_TEXT = "A title is one line of words: it cannot hold control characters."
DESCRIPTION_TOO_LONG = f"A description is at most {MAX_DESCRIPTION_LENGTH} characters."
DESCRIPTION_NOT_TEXT = (
    "A description is lines of words: it cannot hold other control characters."
)
NO_VISIBILITY = "Say who can see it: visibility."
VISIBILITY_TWICE = "Say who can see it once: visibility, or public, not both."
TAG_UNKNOWN = "Only MuW members can be tagged: one of these is not."
TAG_YOURSELF = "You cannot tag yourself."
TAG_TWICE = "Each person is tagged once."
TOO_SHORT = (
    f"This run is too short to publish: its first and last {CUT_M:.0f} m are"
    " never shown, and nothing would be left."
)
NO_DRAWING = "No drawing with this id."
PHOTOS_ON_THE_PHONE = (
    "Photos stay on the phone while only you see this run: choose Everyone or"
    " Followers first."
)
NO_PROFILE = "No profile with this id."

LatLon = tuple[float, float]


# --- Who may see a drawing, in the SQL of this module and of the others ---


def drawing_seen_sql(viewer: str) -> str:
    """An SQL condition: the account `viewer` may open the drawing `d` of the
    run `r` (FROM drawings d JOIN runs r ON r.id = d.run_id). Its owner
    always; the others when it is for everyone, or for the followers and
    they follow its owner with the request accepted. `viewer` is a column or
    a placeholder holding a users.id, read once: one value for a `%s`.

    The question every reader of a drawing asks: its photos, and its
    comments (TASK-120), are seen by whoever sees it. Never across a block,
    either way (TASK-121, ADR-0228): as for an id that is not there. Hidden
    from a report's email (TASK-291, ADR-0251), only its owner sees it."""
    return (
        f"EXISTS (SELECT 1 FROM (SELECT {viewer}::bigint AS id) seer"
        " WHERE (seer.id = r.user_id OR (d.hidden_at IS NULL"
        " AND (d.visibility = 'everyone' OR (d.visibility = 'followers'"
        f" AND {follows_sql('seer.id', 'r.user_id')}))))"
        f" AND NOT {apart_sql('seer.id', 'r.user_id')})"
    )


def shown_sql(viewer: str) -> str:
    """An SQL condition, as drawing_seen_sql: the drawing `d` is on its
    owner's profile for `viewer`. Only the published ones, also to the owner
    (ADR-0159, point 8): for everyone, or for the followers and `viewer` is
    one of them or the owner. Never across a block (TASK-121): the feed and
    the profiles leave those drawings out. Hidden from a report's email
    (TASK-291), only on its owner's own view of its profile."""
    return (
        f"EXISTS (SELECT 1 FROM (SELECT {viewer}::bigint AS id) seer"
        " WHERE (d.visibility = 'everyone' OR (d.visibility = 'followers'"
        f" AND (seer.id = r.user_id OR {follows_sql('seer.id', 'r.user_id')})))"
        " AND (d.hidden_at IS NULL OR seer.id = r.user_id)"
        f" AND NOT {apart_sql('seer.id', 'r.user_id')})"
    )


def published_count_sql(user_column: str, viewer: str | None = None) -> str:
    """How many drawings of the account in `user_column` are on its profile
    for `viewer`, as a subquery: the number on its profile (profiles.py).
    Without `viewer`, those every member sees: not those hidden (TASK-291).
    """
    shown = (
        "d.visibility = 'everyone' AND d.hidden_at IS NULL"
        if viewer is None
        else shown_sql(viewer)
    )
    return (
        "(SELECT count(*) FROM drawings d JOIN runs r ON r.id = d.run_id"
        f" WHERE r.user_id = {user_column} AND {shown})"
    )


# --- What the others see of a track ---


def _after(points: Sequence[LatLon], metres: float) -> list[LatLon]:
    """The line from `metres` along it to its end; [] when it is shorter.
    The first point is where those metres end, on the segment they end in."""
    walked = 0.0
    for i, (a, b) in enumerate(zip(points, points[1:], strict=False)):
        step = haversine_m(a, b)
        if walked + step > metres:
            if walked + step - metres < SAME_POINT_M:
                # The cut falls on `b`, give or take a rounding: not twice.
                return list(points[i + 1 :])
            # In metres on the plane around `a`, never in degrees.
            share = (metres - walked) / step
            x_m, y_m = latlon_to_local(a, b)
            return [local_to_latlon(a, share * x_m, share * y_m), *points[i + 1 :]]
        walked += step
    return []


def cut_track(points: Sequence[LatLon], cut_m: float = CUT_M) -> list[LatLon]:
    """The track without its first and last `cut_m` metres along it; [] when
    less than MIN_LEFT_M is left of it."""
    if path_length_m(points) - 2 * cut_m < MIN_LEFT_M:
        return []
    head_cut = _after(points, cut_m)
    return _after(head_cut[::-1], cut_m)[::-1]


def checked_title(value: str | None) -> str | None:
    """The title as kept: without spaces at either end, None for none; or
    422 saying what is wrong with it."""
    if value is None:
        return None
    title = value.strip()
    if len(title) > MAX_TITLE_LENGTH:
        raise AccountError(422, "invalid_request", TITLE_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" for c in title):
        raise AccountError(422, "invalid_request", TITLE_NOT_TEXT)
    return title or None


def checked_description(value: str | None) -> str | None:
    """The description as kept: its lines ended by "\\n" alone, without
    spaces at either end, None for none; or 422 saying what is wrong with
    it. Not filtered for negative words: the owner's own account of its own
    run (the user's choice, ADR-0170)."""
    if value is None:
        return None
    text = value.replace("\r\n", LINE_BREAK).replace("\r", LINE_BREAK).strip()
    if len(text) > MAX_DESCRIPTION_LENGTH:
        raise AccountError(422, "invalid_request", DESCRIPTION_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" and c != LINE_BREAK for c in text):
        raise AccountError(422, "invalid_request", DESCRIPTION_NOT_TEXT)
    return text or None


# --- The bodies ---


class DrawingRequestBody(BaseModel):
    """PUT /me/activities/{key}/drawing: the drawing as it should be now:
    packages/shared-types/fixtures/drawing-request-details.json, and
    drawing-request.json as an app before TASK-208 sends it."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(
        default=None,
        description=f"At most {MAX_TITLE_LENGTH} characters; null or empty: none.",
    )
    visibility: Visibility | None = Field(
        default=None,
        description="Who can see it; or `public`, never both.",
    )
    public: bool | None = Field(
        default=None,
        description=(
            "An app before TASK-208: true is `everyone`, false `only_me`; or"
            " `visibility`, never both."
        ),
    )
    description: str | None = Field(
        default=None,
        description=(
            f"At most {MAX_DESCRIPTION_LENGTH} characters, lines and all; null"
            " or empty: none; missing: as it was."
        ),
    )
    activity: RunActivity | None = Field(
        default=None, description="What the run was; missing or null: as it was."
    )
    tags: list[UUID] | None = Field(
        default=None,
        max_length=MAX_TAGS,
        description=(
            f"The public_id of the members tagged, in order, at most {MAX_TAGS};"
            " []: none; missing or null: as they were."
        ),
    )

    def chosen(self) -> Visibility:
        """Who can see it, from either field; 422 for none or both."""
        if self.visibility is not None and self.public is not None:
            raise AccountError(422, "invalid_request", VISIBILITY_TWICE)
        if self.visibility is not None:
            return self.visibility
        if self.public is not None:
            return "everyone" if self.public else "only_me"
        raise AccountError(422, "invalid_request", NO_VISIBILITY)


class TagBody(BaseModel):
    """A member tagged in a drawing, as the profile says it: never the
    email."""

    public_id: UUID
    username: str


class PhotoBody(BaseModel):
    """A photo of a drawing, besides its map: a JPEG fetched with the token
    from `url` (GET /drawings/{id}/photos/{n})."""

    n: int
    """Its place, 1 to MAX_PHOTOS: a place emptied stays empty."""
    url: str
    """On this API; it changes when the photo does."""
    width: int
    height: int


class MyDrawingBody(BaseModel):
    """What the owner chose for one of its runs:
    packages/shared-types/fixtures/my-drawing-details.json, and
    my-drawing.json as an API before TASK-208 answered."""

    key: str
    """The run's, as in My activities."""
    id: UUID | None
    """What the others open it with; null for a run never given a drawing:
    no title, no photo, never published."""
    title: str | None
    public: bool
    """Every member sees it: `visibility` is `everyone`. For an app before
    TASK-208."""
    published_at: datetime | None
    """When the others could first see it since it was last `only_me`; null
    while it is."""
    visibility: Visibility
    description: str | None
    activity: RunActivity
    """The run's."""
    tags: list[TagBody]
    photos: list[PhotoBody]


class MyDrawingsBody(BaseModel):
    """GET /me/drawings: every run of the account given a drawing, the
    latest run first."""

    drawings: list[MyDrawingBody]


class AuthorBody(BaseModel):
    """Who published a drawing, as the profile says it: never the email."""

    public_id: UUID
    username: str


class SeenFields(BaseModel):
    """What the others see of a drawing, in a list and whole."""

    id: UUID
    title: str | None
    """The owner's; null: none."""
    started_at: datetime
    published_at: datetime | None
    """Null only for its owner, on one only it sees."""
    place: str | None
    shape: str | None
    word: str | None
    style: str | None
    route_title: str | None
    """What the planned route draws, when neither a shape nor a word says it:
    the run's `title` in My activities."""
    distance_m: int
    duration_s: int
    score: int | None
    fidelity: float | None
    visibility: Visibility
    description: str | None
    activity: RunActivity
    tags: list[TagBody]
    photos: list[PhotoBody]
    rotation_deg: float | None = None
    """How far the planned route's shape is turned (TASK-232, ADR-0195),
    as My activities has it: the drawing is shown turned back, so it reads
    upright. Null for a run without a route, one north up and every run
    saved before. Always answered; the default is for the examples written
    before."""


class DrawingBody(SeenFields):
    """A drawing as the others see it in a list, with a light preview of its
    cut track: packages/shared-types/fixtures/drawings-details.json."""

    track_preview: list[LatLon]


class DrawingsBody(BaseModel):
    """A page of a profile's drawings, the latest run first."""

    drawings: list[DrawingBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""
    total: int
    """How many drawings of the profile the one who asks sees, on every
    page."""


class DrawingDetailBody(SeenFields):
    """GET /drawings/{id}: one drawing whole, to show on the map:
    packages/shared-types/fixtures/drawing-details.json."""

    author: AuthorBody
    public: bool
    """Every member sees it: `visibility` is `everyone`."""
    track: list[LatLon]
    """The cut track, every point of it; empty only for its owner's run
    too short to publish."""


# --- The drawings in the database ---

_SEEN_FIELDS = (
    "d.id, d.title, d.visibility, d.description, d.published_at,"
    " r.started_at, r.place, r.shape, r.word, r.style, r.title AS route_title,"
    " r.distance_m, r.duration_s, r.score, r.fidelity, r.activity,"
    " r.route_rotation_deg"
)
# One drawing, its cut track whole.
SEEN_COLUMNS = f"{_SEEN_FIELDS}, ST_AsGeoJSON(d.track, 15) AS track"
# A drawing in a list: as `track`, the preview PostgreSQL keeps of it
# (migration 0022, TASK-288), the points `preview` would take of the whole.
LISTED_COLUMNS = f"{_SEEN_FIELDS}, ST_AsGeoJSON(d.preview, 15) AS track"
MINE_COLUMNS = (
    "r.key, r.activity, d.id, d.title, d.visibility, d.description, d.published_at"
)
# The run of a drawing, locked while its drawing changes.
RUN_TO_DRAW = (
    "SELECT id, ST_AsGeoJSON(ST_Force2D(track), 15) AS track FROM runs"
    " WHERE user_id = %s AND key = %s FOR UPDATE"
)

Connection = psycopg.Connection[DictRow]


def _line(geojson: str | None) -> list[LatLon]:
    if geojson is None:
        return []
    coordinates: list[list[float]] = json.loads(geojson)["coordinates"]
    return [(lat, lon) for lon, lat in coordinates]


def _line_wkt(points: Sequence[LatLon]) -> str:
    """The line as PostGIS reads it: (lon lat), every digit kept."""
    return "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in points) + ")"


def photo_url(drawing_id: UUID, n: int, updated_at: datetime) -> str:
    """Where a photo is read; a new one in the same place has a new address,
    so a phone never shows the one before from its cache."""
    version = (updated_at - EPOCH) // MICROSECOND
    return f"/drawings/{drawing_id}/photos/{n}?v={version}"


@dataclass(frozen=True)
class Details:
    """The tags and the photos of some drawings, by id."""

    tags: dict[UUID, list[TagBody]]
    photos: dict[UUID, list[PhotoBody]]


def _details(conn: Connection, ids: Sequence[UUID]) -> Details:
    """In two reads for a page, never the bytes of a photo."""
    tags: dict[UUID, list[TagBody]] = defaultdict(list)
    photos: dict[UUID, list[PhotoBody]] = defaultdict(list)
    if ids:
        for row in conn.execute(
            "SELECT t.drawing_id, u.public_id, u.username FROM drawing_tags t"
            " JOIN users u ON u.id = t.user_id WHERE t.drawing_id = ANY(%s)"
            " ORDER BY t.position",
            (list(ids),),
        ):
            tags[row["drawing_id"]].append(
                TagBody(public_id=row["public_id"], username=row["username"])
            )
        for row in conn.execute(
            "SELECT drawing_id, n, width, height, updated_at FROM drawing_photos"
            " WHERE drawing_id = ANY(%s) ORDER BY n",
            (list(ids),),
        ):
            photos[row["drawing_id"]].append(
                PhotoBody(
                    n=row["n"],
                    url=photo_url(row["drawing_id"], row["n"], row["updated_at"]),
                    width=row["width"],
                    height=row["height"],
                )
            )
    return Details(tags, photos)


def _seen(row: DictRow, details: Details) -> dict[str, Any]:
    fidelity = row["fidelity"]
    return {
        "id": row["id"],
        "title": row["title"],
        "started_at": row["started_at"],
        "published_at": row["published_at"],
        "place": row["place"],
        "shape": row["shape"],
        "word": row["word"],
        "style": row["style"],
        "route_title": row["route_title"],
        "distance_m": row["distance_m"],
        "duration_s": row["duration_s"],
        "score": row["score"],
        # A `real` column: without rounding 0.83 comes back as 0.8299999833.
        "fidelity": None if fidelity is None else round(fidelity, 4),
        "visibility": row["visibility"],
        "description": row["description"],
        "activity": row["activity"],
        "tags": details.tags.get(row["id"], []),
        "photos": details.photos.get(row["id"], []),
        # The run's, as My activities answers it (activities._turn).
        "rotation_deg": turn_kept(row["route_rotation_deg"]),
    }


def _cursor(row: DictRow) -> str:
    started_at: datetime = row["started_at"]
    return f"{(started_at - EPOCH) // MICROSECOND}-{row['id'].hex}"


def _after_cursor(cursor: str) -> tuple[datetime, UUID]:
    micros, drawing_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(drawing_id)


def _mine(conn: Connection, rows: Sequence[DictRow]) -> list[MyDrawingBody]:
    details = _details(conn, [row["id"] for row in rows if row["id"] is not None])
    return [
        MyDrawingBody(
            key=row["key"],
            id=row["id"],
            title=row["title"],
            public=row["visibility"] == "everyone",
            published_at=row["published_at"],
            # A run never given a drawing is its owner's only.
            visibility=row["visibility"] or "only_me",
            description=row["description"],
            activity=row["activity"],
            tags=details.tags.get(row["id"], []),
            photos=details.photos.get(row["id"], []),
        )
        for row in rows
    ]


def _mine_of_run(conn: Connection, run_id: int) -> MyDrawingBody:
    row = conn.execute(
        f"SELECT {MINE_COLUMNS} FROM runs r LEFT JOIN drawings d ON d.run_id = r.id"
        " WHERE r.id = %s",
        (run_id,),
    ).fetchone()
    assert row is not None
    (mine,) = _mine(conn, [row])
    return mine


def _tagged(conn: Connection, user_id: int, wanted: Sequence[UUID]) -> list[int]:
    """The users.id of the members tagged, in order; 422 for one twice,
    one who is not a member, or the owner itself."""
    if len(set(wanted)) < len(wanted):
        raise AccountError(422, "invalid_request", TAG_TWICE)
    rows = conn.execute(
        "SELECT id, public_id FROM users WHERE public_id = ANY(%s)", (list(wanted),)
    ).fetchall()
    found: dict[UUID, int] = {row["public_id"]: row["id"] for row in rows}
    if len(found) < len(wanted):
        raise AccountError(422, "invalid_request", TAG_UNKNOWN)
    if user_id in found.values():
        raise AccountError(422, "invalid_request", TAG_YOURSELF)
    return [found[public_id] for public_id in wanted]


def shared_drawing(conn: Connection, user_id: int, key: str) -> UUID | None:
    """The id of the drawing of the run with this key, when others can see
    it; None: no such run. 409 while only its owner sees it, or it has no
    drawing: its photos stay on the phone (the user's choice, ADR-0170).
    The run is locked until `conn` commits, so the drawing cannot become
    its owner's only meanwhile (drawing_photos.py)."""
    run = conn.execute(RUN_TO_DRAW, (user_id, key)).fetchone()
    if run is None:
        return None
    drawing = conn.execute(
        "SELECT id FROM drawings WHERE run_id = %s AND visibility <> 'only_me'",
        (run["id"],),
    ).fetchone()
    if drawing is None:
        raise AccountError(409, "http_error", PHOTOS_ON_THE_PHONE)
    drawing_id: UUID = drawing["id"]
    return drawing_id


def run_of(conn: Connection, user_id: int, key: str) -> int | None:
    """The id of the account's run with this key; None: no such run."""
    row = conn.execute(
        "SELECT id FROM runs WHERE user_id = %s AND key = %s", (user_id, key)
    ).fetchone()
    return None if row is None else int(row["id"])


@dataclass
class Drawings:
    """The drawings in the database."""

    database: Database
    now: Callable[[], datetime]

    def mine(self, user_id: int, key: str) -> MyDrawingBody | None:
        """What the owner chose for its run; None: it has no such run."""
        with self.database.connect() as conn:
            run_id = run_of(conn, user_id, key)
            return None if run_id is None else _mine_of_run(conn, run_id)

    def all_mine(self, user_id: int) -> MyDrawingsBody:
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {MINE_COLUMNS} FROM drawings d"
                " JOIN runs r ON r.id = d.run_id WHERE r.user_id = %s"
                " ORDER BY r.started_at DESC, r.id DESC",
                (user_id,),
            ).fetchall()
            return MyDrawingsBody(drawings=_mine(conn, rows))

    def keep(
        self, user_id: int, key: str, body: DrawingRequestBody
    ) -> MyDrawingBody | None:
        """The run's drawing as `body` wants it; None: no such run. 422 for a
        field refused, or a run too short to publish."""
        title = checked_title(body.title)
        visibility = body.chosen()
        description = checked_description(body.description)
        # An app before TASK-208 sends no description: it stays.
        set_description = (
            ", description = EXCLUDED.description"
            if "description" in body.model_fields_set
            else ""
        )
        now = self.now()
        try:
            with self.database.connect() as conn:
                run = conn.execute(RUN_TO_DRAW, (user_id, key)).fetchone()
                if run is None:
                    return None
                tagged = (
                    None if body.tags is None else _tagged(conn, user_id, body.tags)
                )
                # Cut again on every change, from the run as it is kept: the
                # same run, the same line.
                cut = cut_track(_line(run["track"]))
                if visibility != "only_me" and not cut:
                    raise AccountError(422, "invalid_request", TOO_SHORT)
                before = conn.execute(
                    "SELECT published_at FROM drawings"
                    " WHERE run_id = %s AND visibility <> 'only_me'",
                    (run["id"],),
                ).fetchone()
                # A title changed on a published drawing, or who among the
                # others sees it, does not publish it again.
                published_at = None
                if visibility != "only_me":
                    published_at = now if before is None else before["published_at"]
                drawing = conn.execute(
                    "INSERT INTO drawings (run_id, title, visibility, description,"
                    " track, published_at, updated_at) VALUES (%s, %s, %s, %s,"
                    " ST_GeomFromText(%s, 4326), %s, %s)"
                    " ON CONFLICT (run_id) DO UPDATE SET title = EXCLUDED.title,"
                    " visibility = EXCLUDED.visibility, track = EXCLUDED.track,"
                    " published_at = EXCLUDED.published_at,"
                    f" updated_at = EXCLUDED.updated_at{set_description}"
                    " RETURNING id",
                    (
                        run["id"],
                        title,
                        visibility,
                        description,
                        _line_wkt(cut) if cut else None,
                        published_at,
                        now,
                    ),
                ).fetchone()
                assert drawing is not None
                if visibility == "only_me":
                    # Seen by its owner only, its photos are the phone's.
                    conn.execute(
                        "DELETE FROM drawing_photos WHERE drawing_id = %s",
                        (drawing["id"],),
                    )
                if body.activity is not None:
                    conn.execute(
                        "UPDATE runs SET activity = %s WHERE id = %s",
                        (body.activity, run["id"]),
                    )
                if tagged is not None:
                    conn.execute(
                        "DELETE FROM drawing_tags WHERE drawing_id = %s",
                        (drawing["id"],),
                    )
                if tagged:
                    conn.cursor().executemany(
                        "INSERT INTO drawing_tags (drawing_id, user_id, position)"
                        " VALUES (%s, %s, %s)",
                        [
                            (drawing["id"], tagged_id, position)
                            for position, tagged_id in enumerate(tagged, start=1)
                        ],
                    )
                return _mine_of_run(conn, run["id"])
        except pg_errors.ForeignKeyViolation:
            # A member tagged deleted its account while this was written.
            raise AccountError(422, "invalid_request", TAG_UNKNOWN) from None

    def of_profile(
        self,
        viewer_id: int,
        public_id: str,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> DrawingsBody | None:
        """A page of the drawings of a profile that `viewer_id` sees, the
        latest run first; None: no such profile, or one a block keeps apart
        from `viewer_id` (TASK-121), as its profile."""
        try:
            wanted = UUID(public_id)
        except ValueError:
            return None
        with self.database.connect() as conn:
            user = conn.execute(
                "SELECT u.id FROM users u WHERE u.public_id = %s"
                f" AND NOT {apart_sql('%s', 'u.id')}",
                (wanted, viewer_id),
            ).fetchone()
            if user is None:
                return None
            where = f"r.user_id = %s AND {shown_sql('%s')}"
            values: list[Any] = [user["id"], viewer_id]
            if cursor is not None:
                where += " AND (r.started_at, d.id) < (%s, %s)"
                values += _after_cursor(cursor)
            rows = conn.execute(
                f"SELECT {LISTED_COLUMNS} FROM drawings d"
                f" JOIN runs r ON r.id = d.run_id WHERE {where}"
                " ORDER BY r.started_at DESC, d.id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                f"SELECT {published_count_sql('%s', '%s')} AS n",
                (user["id"], viewer_id),
            ).fetchone()
            page, more = rows[:limit], len(rows) > limit
            details = _details(conn, [row["id"] for row in page])
        assert count is not None
        return DrawingsBody(
            drawings=[
                DrawingBody(
                    **_seen(row, details), track_preview=preview(_line(row["track"]))
                )
                for row in page
            ],
            next=_cursor(page[-1]) if more else None,
            total=count["n"],
        )

    def seen(self, viewer_id: int, drawing_id: str) -> DrawingDetailBody | None:
        """The drawing as `viewer_id` may see it (drawing_seen_sql); None
        otherwise, as for an id that is not there."""
        try:
            wanted = UUID(drawing_id)
        except ValueError:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {SEEN_COLUMNS}, u.public_id, u.username FROM drawings d"
                " JOIN runs r ON r.id = d.run_id JOIN users u ON u.id = r.user_id"
                f" WHERE d.id = %s AND {drawing_seen_sql('%s')}",
                (wanted, viewer_id),
            ).fetchone()
            if row is None:
                return None
            details = _details(conn, [row["id"]])
        return DrawingDetailBody(
            **_seen(row, details),
            author=AuthorBody(public_id=row["public_id"], username=row["username"]),
            public=row["visibility"] == "everyone",
            track=_line(row["track"]),
        )


def drawings_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Drawings:
    """In the database of the accounts, on the same clock."""
    return Drawings(accounts.database, accounts.now)


def drawing_routes() -> APIRouter:
    router = APIRouter(tags=["drawings"], responses=ACCOUNT_ERRORS)

    @router.get("/me/drawings")
    def my_drawings(
        drawings: Annotated[Drawings, Depends(drawings_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> MyDrawingsBody:
        return drawings.all_mine(user.id)

    @router.get("/me/activities/{key}/drawing", responses={404: {"model": ErrorBody}})
    def my_drawing(
        key: Key,
        drawings: Annotated[Drawings, Depends(drawings_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> MyDrawingBody:
        found = drawings.mine(user.id, key)
        if found is None:
            raise HTTPException(404, UNKNOWN_ACTIVITY)
        return found

    # The whole choice every time: the app may send it again after a phone
    # without network, and the second time changes nothing.
    @router.put("/me/activities/{key}/drawing", responses={404: {"model": ErrorBody}})
    def keep_drawing(
        key: Key,
        body: DrawingRequestBody,
        drawings: Annotated[Drawings, Depends(drawings_of)],
        user: Annotated[UserBody, Depends(current_user)],
        request: Request,
    ) -> MyDrawingBody:
        before = tagged_before(request, user.id, key)
        kept = drawings.keep(user.id, key, body)
        if kept is None:
            raise HTTPException(404, UNKNOWN_ACTIVITY)
        pushed_tags(request, user, kept, before)
        return kept

    @router.get("/users/{public_id}/drawings", responses={404: {"model": ErrorBody}})
    def profile_drawings(
        public_id: str,
        drawings: Annotated[Drawings, Depends(drawings_of)],
        user: Annotated[UserBody, Depends(current_user)],
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> DrawingsBody:
        found = drawings.of_profile(user.id, public_id, limit, cursor)
        if found is None:
            raise HTTPException(404, NO_PROFILE)
        return found

    @router.get("/drawings/{drawing_id}", responses={404: {"model": ErrorBody}})
    def drawing(
        drawing_id: str,
        drawings: Annotated[Drawings, Depends(drawings_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> DrawingDetailBody:
        found = drawings.seen(user.id, drawing_id)
        if found is None:
            raise HTTPException(404, NO_DRAWING)
        return found

    return router


def install_drawings(app: FastAPI) -> None:
    """The drawings of the accounts; after install_accounts, which sets the
    database and the errors."""
    app.include_router(drawing_routes())


# --- Push notifications (TASK-262, ADR-0226) ---


def pushed_tags(
    request: Request, user: UserBody, kept: MyDrawingBody, before: frozenset[int]
) -> None:
    """After a drawing is kept: each member tagged in it now, and not before,
    is told (push.py), when they may see it."""
    if kept.id is not None:
        notify_tagged(request, user.id, kept.id, before)
