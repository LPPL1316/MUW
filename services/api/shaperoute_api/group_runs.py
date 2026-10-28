"""Group runs: a member publishes a route with a day, a time and where
exactly to meet at its start; the others say «I'm going» and run the shape
together, as in a run club (TASK-309, ADR-0269, docs/EVENTI.md, docs/API.md
«Group runs»).

The route is a favorite's (favorites.FavoriteRequestBody), copied whole:
it never changes after the creation, and its first point is the meeting
point. The organiser changes the title, the time, «Where exactly» and the
notes, or cancels, until the start; «I'm going» and «Not going» hold until
the group run is over, OVER_AFTER the start. The organiser goes always and
has no row in group_run_going.

Who sees a group run (seen_sql): its organiser always; the others when it
is not hidden (from a report's email, TASK-291), no block stands between
them and the organiser (follows.apart_sql, both ways, a hidden member
included) and it is for everyone, or they follow the organiser with the
request accepted. Who does not see it gets 404, as for an id that is not
there. Who goes counts for who asks (counted_sql) while it still sees the
group run and is not kept apart from who asks: a block, in either way,
takes a member out of the list and the number, and out of the pushes.

Three pushes (push.py): the reminder an hour before, once, found by
GroupRunClock every CHECK_EVERY_S with an UPDATE on reminded_at IS NULL,
so two processes never send it twice; a change of time or place, which
also opens the reminder again; the cancellation, and the deletion of the
organiser's account before the start. Nobody is told when someone says
«I'm going»: the organiser sees it on the page (EVENTI.md §6.4). None of
them goes to the daily email (notice_email.EMAIL_KINDS).

Deleting an account deletes its group runs and its answers (ON DELETE
CASCADE).
"""

from __future__ import annotations

import logging
import threading
import unicodedata
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    NOT_SIGNED_IN,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import EPOCH, MICROSECOND
from shaperoute_api.comment_filter import check_comment
from shaperoute_api.comments import CommentRejected
from shaperoute_api.db import Database
from shaperoute_api.favorites import FavoriteRequestBody, _points, _wkt
from shaperoute_api.feed import HALF_A_POINT, NEAR_M
from shaperoute_api.follows import (
    MAX_PAGE_SIZE,
    NO_PROFILE,
    PAGE_SIZE,
    PERSON_COLUMNS,
    PeoplePageBody,
    PersonBody,
    _account,
    _apart,
    _person,
    apart_sql,
    follows_sql,
)
from shaperoute_api.push import Kind, Pusher, PushEvent
from shaperoute_api.recommended import preview
from shaperoute_api.schemas import ErrorBody, Stretch, Walk

log = logging.getLogger(__name__)

MAX_TITLE = 60
MAX_MEETING_NOTE = 80
MAX_DESCRIPTION = 500
# When a group run may start, from the moment it is created or moved.
EARLIEST = timedelta(minutes=30)
LATEST = timedelta(days=60)
# Over this long after its start: out of the Feed's row, no «I'm going».
OVER_AFTER = timedelta(hours=3)
# Not over and not cancelled, per account: against spam.
MAX_UPCOMING = 10
# The Feed's row, and the past group runs of a profile.
ROW_SIZE = 20
PAST_SIZE = 20
# Who goes: the first ones on a card, and on the page.
FACES = 3
FIRST_PEOPLE = PAGE_SIZE
# The reminder: this long before the start, looked for this often.
REMIND_BEFORE = timedelta(hours=1)
CHECK_EVERY_S = 5 * 60
# Where a page of who goes ended: 0 for the organiser, 1 for the others,
# when they said «I'm going» in microseconds, and the member's public id.
CURSOR_PATTERN = r"^[01]-\d{1,17}-[0-9a-f]{32}$"

Visibility = Literal["everyone", "followers"]
Status = Literal["upcoming", "started", "over", "cancelled"]
LatLon = tuple[float, float]

NO_GROUP_RUN = "No group run with this id."
TITLE_WRONG = f"A title is 1 to {MAX_TITLE} characters, on one line."
NOTE_WRONG = f"«Where exactly» is one line of {MAX_MEETING_NOTE} characters at most."
DESCRIPTION_WRONG = f"The notes are {MAX_DESCRIPTION} characters at most."
WHEN_WRONG = "A group run starts from 30 minutes to 60 days from now."
TOO_MANY = f"You can have {MAX_UPCOMING} upcoming group runs at most."
STARTED = "The group run has started: it cannot change any more."
OVER = "The group run is over."
CANCELLED = "The group run was cancelled."
ORGANISER_GOES = "The organiser always goes."


# --- In the SQL ---


def seen_sql(viewer: str) -> str:
    """An SQL condition: the account `viewer` sees the group run `g`.
    `viewer` is a column or a placeholder holding a users.id."""
    return (
        f"(g.owner_id = {viewer}::bigint OR (g.hidden_at IS NULL"
        f" AND NOT {apart_sql(viewer, 'g.owner_id')}"
        f" AND (g.visibility = 'everyone' OR {follows_sql(viewer, 'g.owner_id')})))"
    )


def counted_sql(viewer: str) -> str:
    """An SQL condition: the answer `gg` of the group run `g` counts for
    `viewer`: its member still sees the group run and is not kept apart
    from `viewer`."""
    return f"({seen_sql('gg.user_id')} AND NOT {apart_sql(viewer, 'gg.user_id')})"


# Who goes, as `viewer` sees them: the organiser first (rank 0), then the
# others in the order they said «I'm going».
PEOPLE_SQL = (
    "SELECT 0 AS rank, g.id AS group_run_id, g.created_at AS at,"
    f" {PERSON_COLUMNS} FROM group_runs g JOIN users u ON u.id = g.owner_id"
    " LEFT JOIN profile_photos p ON p.user_id = u.id"
    " WHERE g.id = ANY(%(ids)s)"
    " UNION ALL"
    " SELECT 1, g.id, gg.created_at, u.public_id, u.username, p.jpeg"
    " FROM group_run_going gg JOIN group_runs g ON g.id = gg.group_run_id"
    " JOIN users u ON u.id = gg.user_id"
    " LEFT JOIN profile_photos p ON p.user_id = u.id"
    " WHERE g.id = ANY(%(ids)s) AND gg.user_id <> g.owner_id"
    f" AND {counted_sql('%(viewer)s')}"
)

COLUMNS = (
    "g.id, g.owner_id, g.title, g.starts_at, g.meeting_note, g.description,"
    " g.visibility, g.activity, g.city, g.shape, g.word, g.style, g.distance_m,"
    " g.route_m, g.similarity, g.walks, g.on_foot, g.rotation_deg, g.created_at,"
    " g.cancelled_at, ST_AsGeoJSON(g.line, 15) AS line,"
    " (g.owner_id = %(viewer)s OR EXISTS (SELECT 1 FROM group_run_going mine"
    " WHERE mine.group_run_id = g.id AND mine.user_id = %(viewer)s)) AS i_am_going"
)


# --- The bodies ---


class GroupRunRequestBody(FavoriteRequestBody):
    """POST /group-runs: the route as a favorite keeps it, and when and
    where to meet: packages/shared-types/fixtures/group-run-request.json."""

    model_config = ConfigDict(extra="forbid")

    # A favorite's title is optional; a group run's is not.
    title: str = Field(description=f"1 to {MAX_TITLE} characters, on one line.")
    starts_at: AwareDatetime = Field(
        description="From 30 minutes to 60 days from now, with its offset."
    )
    meeting_note: str | None = Field(
        default=None,
        description=f"«Where exactly», one line of {MAX_MEETING_NOTE} at most.",
    )
    description: str | None = Field(
        default=None, description=f"{MAX_DESCRIPTION} characters at most."
    )
    visibility: Visibility


class GroupRunChangeBody(BaseModel):
    """PUT /group-runs/{id}: what the organiser may change, all of it, before
    the start: packages/shared-types/fixtures/group-run-change.json. A note
    or a description left out is taken away."""

    model_config = ConfigDict(extra="forbid")

    title: str
    starts_at: AwareDatetime = Field(
        description="When changed, from 30 minutes to 60 days from now."
    )
    meeting_note: str | None = None
    description: str | None = None


class GroupRunBody(BaseModel):
    """A group run on a card: the Feed's row, a profile:
    packages/shared-types/fixtures/group-runs.json."""

    id: UUID
    title: str
    starts_at: datetime
    meeting_note: str | None
    visibility: Visibility
    status: Status
    """`upcoming` until the start, `started` for the next three hours,
    then `over`; `cancelled` whenever the organiser cancelled it."""
    organiser: PersonBody
    going: int
    """How many go, the organiser included, as who asks sees them."""
    faces: list[PersonBody]
    """The first FACES of them, the organiser first."""
    i_am_going: bool
    """Whether who asks goes; always for the organiser."""
    activity: str
    city: str
    shape: str | None
    word: str | None
    style: str | None
    distance_m: int
    route_m: int
    similarity: float
    start: LatLon
    """The meeting point: the first point of the route."""
    preview: list[LatLon]
    rotation_deg: float | None
    created_at: datetime


class GroupRunDetailBody(GroupRunBody):
    """GET /group-runs/{id}: the group run whole, with the route to show on
    the map and the first who go: fixtures/group-run.json."""

    description: str | None
    points: list[LatLon]
    walks: list[Walk]
    on_foot: list[Stretch]
    people: list[PersonBody]
    """The first FIRST_PEOPLE who go, the organiser first."""
    next: str | None
    """The `cursor` of GET /group-runs/{id}/going for the others; null when
    `people` holds them all."""


class GroupRunsBody(BaseModel):
    """GET /group-runs: the Feed's row, the nearest in time first."""

    group_runs: list[GroupRunBody]


class ProfileGroupRunsBody(BaseModel):
    """GET /users/{public_id}/group-runs: fixtures/profile-group-runs.json."""

    upcoming: list[GroupRunBody]
    """Not over and not cancelled, the nearest in time first."""
    past: list[GroupRunBody]
    """The last PAST_SIZE over, the latest first."""


# --- Without the database ---


def _text(
    value: str | None, most: int, wrong: str, *, needed: bool, lines: bool = False
) -> str | None:
    """A text as kept: without spaces at either end, None when empty; or
    422 with `wrong`, and comment_rejected when the filter of TASK-213
    refuses it."""
    text = (value or "").strip()
    if not text:
        if needed:
            raise AccountError(422, "invalid_request", wrong)
        return None
    allowed = "\n" if lines else ""
    if len(text) > most or any(
        unicodedata.category(c) == "Cc" and c not in allowed for c in text
    ):
        raise AccountError(422, "invalid_request", wrong)
    return text


@dataclass(frozen=True)
class Texts:
    title: str
    meeting_note: str | None
    description: str | None


def checked_texts(
    title: str, meeting_note: str | None, description: str | None
) -> Texts:
    """The three texts as kept, each within its limits (EVENTI.md §3) and
    passed by the filter of the negative comments."""
    texts = Texts(
        title=_text(title, MAX_TITLE, TITLE_WRONG, needed=True) or "",
        meeting_note=_text(meeting_note, MAX_MEETING_NOTE, NOTE_WRONG, needed=False),
        description=_text(
            description, MAX_DESCRIPTION, DESCRIPTION_WRONG, needed=False, lines=True
        ),
    )
    for text in (texts.title, texts.meeting_note, texts.description):
        reason = None if text is None else check_comment(text)
        if reason is not None:
            raise CommentRejected(reason)
    return texts


def check_when(starts_at: datetime, now: datetime) -> None:
    if not now + EARLIEST <= starts_at <= now + LATEST:
        raise AccountError(422, "invalid_request", WHEN_WRONG)


def status_of(row: DictRow, now: datetime) -> Status:
    starts_at: datetime = row["starts_at"]
    if row["cancelled_at"] is not None:
        return "cancelled"
    if now >= starts_at + OVER_AFTER:
        return "over"
    if now >= starts_at:
        return "started"
    return "upcoming"


def _cursor(row: DictRow) -> str:
    at: datetime = row["at"]
    public_id: UUID = row["public_id"]
    return f"{row['rank']}-{(at - EPOCH) // MICROSECOND}-{public_id.hex}"


def _after_cursor(cursor: str) -> tuple[int, datetime, UUID]:
    rank, micros, public_id = cursor.split("-")
    return int(rank), EPOCH + int(micros) * MICROSECOND, UUID(public_id)


# --- In the database ---


@dataclass(frozen=True)
class _Told:
    """A push to be sent once the transaction is over."""

    kind: Kind
    actor_id: int
    recipients: tuple[int, ...]
    group_run_id: UUID
    title: str
    key: str


def _goers(conn: Connection[DictRow], group_run_id: UUID) -> tuple[int, ...]:
    """Who goes and still sees the group run, the organiser left out."""
    rows = conn.execute(
        "SELECT gg.user_id FROM group_run_going gg"
        " JOIN group_runs g ON g.id = gg.group_run_id"
        " WHERE g.id = %(id)s AND gg.user_id <> g.owner_id"
        f" AND {seen_sql('gg.user_id')} ORDER BY gg.created_at, gg.user_id",
        {"id": group_run_id},
    ).fetchall()
    return tuple(int(row["user_id"]) for row in rows)


PusherOf = Callable[[], Pusher | None]


def _tell(pusher_of: PusherOf, told: Sequence[_Told]) -> None:
    """The pushes, after the write; never raises."""
    pusher = pusher_of()
    if pusher is None:
        return
    for one in told:
        for recipient in one.recipients:
            pusher.notify(
                PushEvent(
                    one.kind,
                    one.actor_id,
                    recipient,
                    text=one.title,
                    key=one.key,
                    group_run_id=one.group_run_id,
                )
            )


@dataclass
class GroupRuns:
    """The group runs and who goes, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]
    pusher_of: PusherOf = field(default=lambda: None)

    # --- Reading ---

    def _bodies(
        self, conn: Connection[DictRow], viewer_id: int, rows: Sequence[DictRow]
    ) -> list[GroupRunBody]:
        """The cards of `rows`, with who goes as `viewer_id` sees them."""
        if not rows:
            return []
        people = conn.execute(
            "SELECT * FROM (SELECT people.*,"
            " row_number() OVER (PARTITION BY group_run_id"
            " ORDER BY rank, at, public_id) AS n,"
            " count(*) OVER (PARTITION BY group_run_id) AS total"
            f" FROM ({PEOPLE_SQL}) people) numbered WHERE n <= %(faces)s"
            " ORDER BY group_run_id, n",
            {"ids": [row["id"] for row in rows], "viewer": viewer_id, "faces": FACES},
        ).fetchall()
        faces: dict[UUID, list[DictRow]] = {}
        for person in people:
            faces.setdefault(person["group_run_id"], []).append(person)
        now = self.now()
        return [self._body(row, faces[row["id"]], now) for row in rows]

    @staticmethod
    def _fields(row: DictRow, faces: list[DictRow], now: datetime) -> dict[str, Any]:
        points = _points(row)
        rotation = row["rotation_deg"]
        return {
            "id": row["id"],
            "title": row["title"],
            "starts_at": row["starts_at"],
            "meeting_note": row["meeting_note"],
            "visibility": row["visibility"],
            "status": status_of(row, now),
            "organiser": _person(faces[0]),
            "going": faces[0]["total"],
            "faces": [_person(face) for face in faces],
            "i_am_going": row["i_am_going"],
            "activity": row["activity"],
            "city": row["city"],
            "shape": row["shape"],
            "word": row["word"],
            "style": row["style"],
            "distance_m": row["distance_m"],
            "route_m": row["route_m"],
            # `real` columns: rounded as favorites.py does.
            "similarity": round(row["similarity"], 4),
            "start": points[0],
            "preview": preview(points),
            "rotation_deg": None if rotation is None else round(rotation, 2),
            "created_at": row["created_at"],
        }

    def _body(self, row: DictRow, faces: list[DictRow], now: datetime) -> GroupRunBody:
        return GroupRunBody(**self._fields(row, faces, now))

    def _seen_row(
        self, conn: Connection[DictRow], viewer_id: int, group_run_id: UUID
    ) -> DictRow:
        row = conn.execute(
            f"SELECT {COLUMNS} FROM group_runs g"
            f" WHERE g.id = %(id)s AND {seen_sql('%(viewer)s')}",
            {"id": group_run_id, "viewer": viewer_id},
        ).fetchone()
        if row is None:
            raise AccountError(404, "http_error", NO_GROUP_RUN)
        return row

    def _people(
        self,
        conn: Connection[DictRow],
        viewer_id: int,
        group_run_id: UUID,
        limit: int,
        cursor: str | None,
    ) -> PeoplePageBody:
        values: dict[str, Any] = {
            "ids": [group_run_id],
            "viewer": viewer_id,
            "limit": limit + 1,
        }
        where = "TRUE"
        if cursor is not None:
            values.update(
                zip(("rank", "at", "last"), _after_cursor(cursor), strict=True)
            )
            where = "(rank, at, public_id) > (%(rank)s, %(at)s, %(last)s)"
        rows = conn.execute(
            f"SELECT * FROM ({PEOPLE_SQL}) people WHERE {where}"
            " ORDER BY rank, at, public_id LIMIT %(limit)s",
            values,
        ).fetchall()
        total = conn.execute(
            f"SELECT count(*) AS n FROM ({PEOPLE_SQL}) people", values
        ).fetchone()
        assert total is not None
        page, more = rows[:limit], len(rows) > limit
        return PeoplePageBody(
            people=[_person(row) for row in page],
            next=_cursor(page[-1]) if more else None,
            total=total["n"],
        )

    def _detail(
        self, conn: Connection[DictRow], viewer_id: int, row: DictRow
    ) -> GroupRunDetailBody:
        people = self._people(conn, viewer_id, row["id"], FIRST_PEOPLE, None)
        faces = conn.execute(
            f"SELECT people.*, %(total)s AS total FROM ({PEOPLE_SQL}) people"
            " ORDER BY rank, at, public_id LIMIT %(faces)s",
            {
                "ids": [row["id"]],
                "viewer": viewer_id,
                "faces": FACES,
                "total": people.total,
            },
        ).fetchall()
        return GroupRunDetailBody(
            **self._fields(row, faces, self.now()),
            description=row["description"],
            points=_points(row),
            walks=[(start, end) for start, end in row["walks"]],
            on_foot=[(start, end) for start, end in row["on_foot"]],
            people=people.people,
            next=people.next,
        )

    def get(self, viewer_id: int, group_run_id: UUID) -> GroupRunDetailBody:
        with self.database.connect() as conn:
            return self._detail(
                conn, viewer_id, self._seen_row(conn, viewer_id, group_run_id)
            )

    def going(
        self,
        viewer_id: int,
        group_run_id: UUID,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> PeoplePageBody:
        with self.database.connect() as conn:
            self._seen_row(conn, viewer_id, group_run_id)
            return self._people(conn, viewer_id, group_run_id, limit, cursor)

    def row(self, viewer_id: int, point: LatLon | None = None) -> GroupRunsBody:
        """The Feed's row (EVENTI.md §5): not over, not cancelled, seen; one's
        own, of who one follows and those one goes to anywhere, the others'
        within NEAR_M of `point` (all of them without one)."""
        values: dict[str, Any] = {
            "viewer": viewer_id,
            "over_before": self.now() - OVER_AFTER,
            "limit": ROW_SIZE,
        }
        near = "TRUE"
        if point is not None:
            values.update(lat=point[0], lon=point[1], near_m=NEAR_M)
            near = (
                "ST_DWithin(g.start,"
                " ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography,"
                " %(near_m)s)"
            )
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {COLUMNS} FROM group_runs g"
                " WHERE g.cancelled_at IS NULL AND g.starts_at > %(over_before)s"
                f" AND {seen_sql('%(viewer)s')}"
                " AND (g.owner_id = %(viewer)s"
                f" OR {follows_sql('%(viewer)s', 'g.owner_id')}"
                " OR EXISTS (SELECT 1 FROM group_run_going mine"
                " WHERE mine.group_run_id = g.id AND mine.user_id = %(viewer)s)"
                f" OR {near})"
                " ORDER BY g.starts_at, g.id LIMIT %(limit)s",
                values,
            ).fetchall()
            return GroupRunsBody(group_runs=self._bodies(conn, viewer_id, rows))

    def of_profile(self, viewer_id: int, public_id: str) -> ProfileGroupRunsBody:
        """The group runs of a profile that `viewer_id` sees: 404 as for the
        profile itself, across a block or for none."""
        with self.database.connect() as conn:
            owner = _account(conn, public_id)
            if owner != viewer_id and _apart(conn, viewer_id, owner):
                raise AccountError(404, "http_error", NO_PROFILE)
            values = {
                "viewer": viewer_id,
                "owner": owner,
                "over_before": self.now() - OVER_AFTER,
                "past": PAST_SIZE,
            }
            mine = (
                f"SELECT {COLUMNS} FROM group_runs g WHERE g.owner_id = %(owner)s"
                f" AND g.cancelled_at IS NULL AND {seen_sql('%(viewer)s')}"
            )
            upcoming = conn.execute(
                f"{mine} AND g.starts_at > %(over_before)s ORDER BY g.starts_at, g.id",
                values,
            ).fetchall()
            past = conn.execute(
                f"{mine} AND g.starts_at <= %(over_before)s"
                " ORDER BY g.starts_at DESC, g.id DESC LIMIT %(past)s",
                values,
            ).fetchall()
            return ProfileGroupRunsBody(
                upcoming=self._bodies(conn, viewer_id, upcoming),
                past=self._bodies(conn, viewer_id, past),
            )

    # --- Writing ---

    def create(self, user_id: int, body: GroupRunRequestBody) -> GroupRunDetailBody:
        texts = checked_texts(body.title, body.meeting_note, body.description)
        now = self.now()
        check_when(body.starts_at, now)
        try:
            with self.database.connect() as conn:
                # One account's group runs are created one at a time: the
                # count below is the count when the row goes in.
                conn.execute(
                    "SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,)
                ).fetchone()
                count = conn.execute(
                    "SELECT count(*) AS n FROM group_runs WHERE owner_id = %s"
                    " AND cancelled_at IS NULL AND starts_at > %s",
                    (user_id, now - OVER_AFTER),
                ).fetchone()
                assert count is not None
                if count["n"] >= MAX_UPCOMING:
                    raise AccountError(422, "invalid_request", TOO_MANY)
                first_lat, first_lon = body.points[0]
                made = conn.execute(
                    "INSERT INTO group_runs (owner_id, title, starts_at, meeting_note,"
                    " description, visibility, activity, city, shape, word, style,"
                    " distance_m, route_m, similarity, line, walks, on_foot,"
                    " rotation_deg, start, created_at, updated_at) VALUES (%s, %s, %s,"
                    " %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,"
                    " ST_GeomFromText(%s, 4326), %s, %s, %s,"
                    " ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s, %s)"
                    " RETURNING id",
                    (
                        user_id,
                        texts.title,
                        body.starts_at,
                        texts.meeting_note,
                        texts.description,
                        body.visibility,
                        body.activity,
                        body.city,
                        body.shape,
                        body.word,
                        body.style,
                        body.distance_m,
                        body.route_m,
                        body.similarity,
                        _wkt(body.points),
                        Jsonb([list(walk) for walk in body.walks]),
                        Jsonb([list(stretch) for stretch in body.on_foot]),
                        body.rotation_deg,
                        first_lon,
                        first_lat,
                        now,
                        now,
                    ),
                ).fetchone()
                assert made is not None
                row = self._seen_row(conn, user_id, made["id"])
                return self._detail(conn, user_id, row)
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while it was creating.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN) from None

    def _own_before_start(
        self, conn: Connection[DictRow], user_id: int, group_run_id: UUID
    ) -> DictRow | None:
        """The organiser's group run, locked; None once cancelled. 404 for
        none of `user_id`'s, 422 once started."""
        row = conn.execute(
            "SELECT id, title, starts_at, meeting_note, cancelled_at FROM group_runs"
            " WHERE id = %s AND owner_id = %s FOR UPDATE",
            (group_run_id, user_id),
        ).fetchone()
        if row is None:
            raise AccountError(404, "http_error", NO_GROUP_RUN)
        if row["cancelled_at"] is not None:
            return None
        if self.now() >= row["starts_at"]:
            raise AccountError(422, "invalid_request", STARTED)
        return row

    def change(
        self, user_id: int, group_run_id: UUID, body: GroupRunChangeBody
    ) -> GroupRunDetailBody:
        """Title, time, «Where exactly» and notes, before the start. A new
        time or place tells who goes, and the reminder is sent again."""
        texts = checked_texts(body.title, body.meeting_note, body.description)
        told: list[_Told] = []
        with self.database.connect() as conn:
            before = self._own_before_start(conn, user_id, group_run_id)
            if before is None:
                raise AccountError(422, "invalid_request", CANCELLED)
            now = self.now()
            moved_time = body.starts_at != before["starts_at"]
            if moved_time:
                check_when(body.starts_at, now)
            moved = moved_time or texts.meeting_note != before["meeting_note"]
            conn.execute(
                "UPDATE group_runs SET title = %s, starts_at = %s, meeting_note = %s,"
                " description = %s, updated_at = %s,"
                " reminded_at = CASE WHEN %s THEN NULL ELSE reminded_at END"
                " WHERE id = %s",
                (
                    texts.title,
                    body.starts_at,
                    texts.meeting_note,
                    texts.description,
                    now,
                    moved,
                    group_run_id,
                ),
            )
            if moved:
                told.append(
                    _Told(
                        "group_run_changed",
                        user_id,
                        _goers(conn, group_run_id),
                        group_run_id,
                        texts.title,
                        f"{group_run_id}@{now.isoformat()}",
                    )
                )
            detail = self._detail(
                conn, user_id, self._seen_row(conn, user_id, group_run_id)
            )
        _tell(self.pusher_of, told)
        return detail

    def cancel(self, user_id: int, group_run_id: UUID) -> None:
        """Cancelled before the start, and who goes told; cancelled already,
        it stays so and nobody is told again."""
        told: list[_Told] = []
        with self.database.connect() as conn:
            row = self._own_before_start(conn, user_id, group_run_id)
            if row is None:
                return
            conn.execute(
                "UPDATE group_runs SET cancelled_at = %s WHERE id = %s",
                (self.now(), group_run_id),
            )
            told.append(
                _Told(
                    "group_run_cancelled",
                    user_id,
                    _goers(conn, group_run_id),
                    group_run_id,
                    row["title"],
                    str(group_run_id),
                )
            )
        _tell(self.pusher_of, told)

    def _open_to_answer(
        self, conn: Connection[DictRow], user_id: int, group_run_id: UUID
    ) -> DictRow:
        row = self._seen_row(conn, user_id, group_run_id)
        status = status_of(row, self.now())
        if status == "cancelled":
            raise AccountError(422, "invalid_request", CANCELLED)
        if status == "over":
            raise AccountError(422, "invalid_request", OVER)
        return row

    def go(self, user_id: int, group_run_id: UUID) -> None:
        """«I'm going»: twice is once. Nobody is told (EVENTI.md §6.4)."""
        try:
            with self.database.connect() as conn:
                row = self._open_to_answer(conn, user_id, group_run_id)
                if row["owner_id"] == user_id:
                    return
                conn.execute(
                    "INSERT INTO group_run_going (group_run_id, user_id, created_at)"
                    " VALUES (%s, %s, %s)"
                    " ON CONFLICT (group_run_id, user_id) DO NOTHING",
                    (group_run_id, user_id, self.now()),
                )
        except pg_errors.ForeignKeyViolation:
            # The group run, or the account, was deleted meanwhile.
            raise AccountError(404, "http_error", NO_GROUP_RUN) from None

    def not_go(self, user_id: int, group_run_id: UUID) -> None:
        """«Not going»: not going already is done already."""
        with self.database.connect() as conn:
            row = self._open_to_answer(conn, user_id, group_run_id)
            if row["owner_id"] == user_id:
                raise AccountError(422, "invalid_request", ORGANISER_GOES)
            conn.execute(
                "DELETE FROM group_run_going WHERE group_run_id = %s AND user_id = %s",
                (group_run_id, user_id),
            )

    def before_account_delete(self, user_id: int) -> None:
        """Who goes to a group run of the account not started yet is told it
        is cancelled, before the rows go with the account. Never raises: the
        account is deleted all the same."""
        try:
            with self.database.connect() as conn:
                rows = conn.execute(
                    "SELECT id, title FROM group_runs WHERE owner_id = %s"
                    " AND cancelled_at IS NULL AND starts_at > %s"
                    " ORDER BY starts_at, id",
                    (user_id, self.now()),
                ).fetchall()
                told = [
                    _Told(
                        "group_run_cancelled",
                        user_id,
                        _goers(conn, row["id"]),
                        row["id"],
                        row["title"],
                        str(row["id"]),
                    )
                    for row in rows
                ]
            _tell(self.pusher_of, told)
        except Exception:
            log.exception("group runs: who goes was not told of an account deleted")


# --- The reminder ---

Later = Callable[[float, Callable[[], None]], Any]


def _later(delay_s: float, task: Callable[[], None]) -> Any:
    timer = threading.Timer(delay_s, task)
    timer.daemon = True
    timer.start()
    return timer


@dataclass
class GroupRunClock:
    """Looks, every `every_s`, for the group runs starting within
    REMIND_BEFORE, not cancelled and not reminded, and tells who goes once
    (push group_run_soon), the organiser too. Started and stopped with the
    app; the tests call check()."""

    database: Database
    now: Callable[[], datetime]
    # Read when needed: the pusher may be set after this is made.
    pusher_of: PusherOf
    later: Later = _later
    every_s: float = CHECK_EVERY_S

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._ticking = threading.Lock()
        self._timer: Any = None
        self._running = False

    def start(self) -> None:
        with self._lock:
            if self._running:
                return
            self._running = True
            self._timer = self.later(self.every_s, self._tick)

    def stop(self) -> None:
        """No more checks; a check under way ends before this returns, so
        the app may close its database right after."""
        with self._lock:
            self._running = False
            timer, self._timer = self._timer, None
        if timer is not None and hasattr(timer, "cancel"):
            timer.cancel()
        with self._ticking:
            pass

    def _tick(self) -> None:
        with self._ticking:
            with self._lock:
                running = self._running
            if not running:
                return
            try:
                self.check()
            except Exception:
                log.exception("group runs: the reminders were not checked")
        with self._lock:
            if self._running:
                self._timer = self.later(self.every_s, self._tick)

    def check(self) -> list[UUID]:
        """The group runs reminded now. The UPDATE marks each before anyone
        is told: another process finds it marked, and tells nobody."""
        now = self.now()
        with self.database.connect() as conn:
            rows = conn.execute(
                "UPDATE group_runs SET reminded_at = %s"
                " WHERE reminded_at IS NULL AND cancelled_at IS NULL"
                " AND starts_at > %s AND starts_at <= %s"
                " RETURNING id, owner_id, title, starts_at",
                (now, now, now + REMIND_BEFORE),
            ).fetchall()
            told = [
                _Told(
                    "group_run_soon",
                    row["owner_id"],
                    (row["owner_id"], *_goers(conn, row["id"])),
                    row["id"],
                    row["title"],
                    f"{row['id']}@{row['starts_at'].isoformat()}",
                )
                for row in rows
            ]
        _tell(self.pusher_of, told)
        return [one.group_run_id for one in told]


# --- The endpoints ---


def group_runs_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> GroupRuns:
    """In the database of the accounts, on the same clock, with the app's
    pusher."""
    return GroupRuns(
        accounts.database,
        accounts.now,
        lambda: getattr(request.app.state, "pusher", None),
    )


Them = Annotated[GroupRuns, Depends(group_runs_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}


def group_run_routes() -> APIRouter:
    router = APIRouter(tags=["group runs"], responses=ACCOUNT_ERRORS)

    @router.post("/group-runs", status_code=201)
    def create(body: GroupRunRequestBody, runs: Them, user: Me) -> GroupRunDetailBody:
        return runs.create(user.id, body)

    @router.get("/group-runs")
    def row(
        runs: Them,
        user: Me,
        lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
        lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    ) -> GroupRunsBody:
        if (lat is None) != (lon is None):
            raise AccountError(422, "invalid_request", HALF_A_POINT)
        point = None if lat is None or lon is None else (lat, lon)
        return runs.row(user.id, point)

    @router.get("/group-runs/{group_run_id}", responses=NOT_FOUND)
    def get(group_run_id: UUID, runs: Them, user: Me) -> GroupRunDetailBody:
        return runs.get(user.id, group_run_id)

    @router.put("/group-runs/{group_run_id}", responses=NOT_FOUND)
    def change(
        group_run_id: UUID, body: GroupRunChangeBody, runs: Them, user: Me
    ) -> GroupRunDetailBody:
        return runs.change(user.id, group_run_id, body)

    @router.delete("/group-runs/{group_run_id}", status_code=204, responses=NOT_FOUND)
    def cancel(group_run_id: UUID, runs: Them, user: Me) -> Response:
        runs.cancel(user.id, group_run_id)
        return Response(status_code=204)

    @router.put(
        "/group-runs/{group_run_id}/going", status_code=204, responses=NOT_FOUND
    )
    def go(group_run_id: UUID, runs: Them, user: Me) -> Response:
        runs.go(user.id, group_run_id)
        return Response(status_code=204)

    @router.delete(
        "/group-runs/{group_run_id}/going", status_code=204, responses=NOT_FOUND
    )
    def not_go(group_run_id: UUID, runs: Them, user: Me) -> Response:
        runs.not_go(user.id, group_run_id)
        return Response(status_code=204)

    @router.get("/group-runs/{group_run_id}/going", responses=NOT_FOUND)
    def going(
        group_run_id: UUID,
        runs: Them,
        user: Me,
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> PeoplePageBody:
        return runs.going(user.id, group_run_id, limit, cursor)

    @router.get("/users/{public_id}/group-runs", responses=NOT_FOUND)
    def of_profile(public_id: str, runs: Them, user: Me) -> ProfileGroupRunsBody:
        return runs.of_profile(user.id, public_id)

    return router


def install_group_runs(app: FastAPI) -> None:
    """The group runs, their clock and what they do when an account is
    deleted; after install_accounts and install_push. The clock runs only
    while the app does: install_group_runs wraps the app's lifespan. Without
    a database there is no clock, and the endpoints answer 503."""
    accounts: Accounts | None = app.state.accounts
    if accounts is not None:

        def pusher() -> Pusher | None:
            found: Pusher | None = getattr(app.state, "pusher", None)
            return found

        clock = GroupRunClock(accounts.database, accounts.now, pusher)
        app.state.group_run_clock = clock
        runs = GroupRuns(accounts.database, accounts.now, pusher)
        app.state.before_account_delete.append(runs.before_account_delete)
        _around_lifespan(app, clock)
    app.include_router(group_run_routes())


def _around_lifespan(app: FastAPI, clock: GroupRunClock) -> None:
    inner = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app_: FastAPI) -> AsyncIterator[Any]:
        async with inner(app_) as state:
            clock.start()
            try:
                yield state
            finally:
                clock.stop()

    app.router.lifespan_context = lifespan
