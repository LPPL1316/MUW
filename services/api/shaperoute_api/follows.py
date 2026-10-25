"""Following, with a request the other accepts (TASK-211, ADR-0173,
docs/API.md, «Follow»).

A member finds another by name (GET /users?q=) and asks to follow; the
other accepts or declines. Only an accepted request counts: in the numbers
of a profile (profiles.py), in the lists, and for who may see a drawing
meant for the followers (follows_sql, TASK-208). Declining deletes the
request: the one who asked sees what it saw before asking, and nothing
says it was declined.

Every action leads to a state and changes nothing done again: asking twice
keeps one request, withdrawing what is not there is done already. Only
accepting with no request at all is 404.

Who follows whom is read only by its own account (GET /me/followers,
/me/following, /me/follow-requests): the others see the two numbers of a
profile. A list or a search gives the name, the public id and a small
picture of each member, never the email. Deleting an account deletes its
rows (ON DELETE CASCADE): it leaves every list and every number.

A block (TASK-121, moderation.py) ends every follow between the two and
keeps them apart: the search does not find the other, and asking to follow
across it is 404, as for nobody.
"""

from __future__ import annotations

import base64
import hashlib
import io
import threading
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response
from PIL import Image
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import EPOCH, MICROSECOND
from shaperoute_api.db import Database
from shaperoute_api.profile_photos import JPEG_QUALITY, PHOTO_SIDE
from shaperoute_api.push import notify_account
from shaperoute_api.schemas import ErrorBody

MIN_QUERY_LENGTH = 2
MAX_FOUND = 20
# The longest username: a longer query finds nobody.
MAX_QUERY_LENGTH = 20
# A list shows the picture small: half the side of the profile's, a quarter
# of its bytes (ADR-0173, point 7).
SMALL_PHOTO_SIDE = PHOTO_SIDE // 2
# The small pictures made, kept: a search shows the same faces letter after
# letter (TASK-288). A few KB each in base64.
SMALL_PHOTOS_KEPT = 2000
PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
# Where a page ended: when its last follow began, in microseconds, and the
# public id of that member, as the cursor of a profile's drawings.
CURSOR_PATTERN = r"^\d{1,17}-[0-9a-f]{32}$"

# Where the one who asks stands towards a profile. Own profile: none.
FollowState = Literal["none", "requested", "following"]
Which = Literal["followers", "following", "requests"]

QUERY_TOO_SHORT = f"Type at least {MIN_QUERY_LENGTH} characters of a name."
NOT_YOURSELF = "You cannot follow yourself."
# As profiles.py says it: follows.py does not import it, so drawings.py
# can import this module (TASK-208).
NO_PROFILE = "No profile with this id."
NO_REQUEST = "No follow request from this account."


# --- In the SQL of the other modules ---


def follows_sql(follower: str, followed: str) -> str:
    """An SQL condition: `follower` follows `followed`, the request
    accepted. Each is a column or a placeholder holding a users.id. Who
    may see a drawing meant for the followers (TASK-208)."""
    return (
        "EXISTS (SELECT 1 FROM follows follow_row"
        f" WHERE follow_row.follower_id = {follower}"
        f" AND follow_row.followed_id = {followed}"
        " AND follow_row.status = 'accepted')"
    )


def apart_sql(viewer: str, other: str) -> str:
    """An SQL condition: `viewer` and `other` are kept apart. A block stands
    between them, made by either (TASK-121, ADR-0228): then neither sees the
    other. Or `other` was hidden by whoever runs MuW, from a report's email
    (TASK-291, ADR-0251): then nobody but `other` itself sees it, and it
    sees everyone as before. `viewer` is a column or a placeholder holding a
    users.id, read once; `other` is a column."""
    return (
        "EXISTS (SELECT 1 FROM (SELECT "
        f"{viewer}::bigint AS id) apart_viewer"
        " WHERE EXISTS (SELECT 1 FROM blocks block_row"
        " WHERE (block_row.blocker_id = apart_viewer.id"
        f" AND block_row.blocked_id = {other})"
        f" OR (block_row.blocker_id = {other}"
        " AND block_row.blocked_id = apart_viewer.id))"
        " OR EXISTS (SELECT 1 FROM users hidden_row"
        f" WHERE hidden_row.id = {other} AND hidden_row.hidden_at IS NOT NULL"
        " AND hidden_row.id <> apart_viewer.id))"
    )


def followers_count_sql(user_column: str) -> str:
    """How many follow the account in `user_column`, as a subquery."""
    return (
        "(SELECT count(*) FROM follows follow_row"
        f" WHERE follow_row.followed_id = {user_column}"
        " AND follow_row.status = 'accepted')"
    )


def following_count_sql(user_column: str) -> str:
    """How many the account in `user_column` follows, as a subquery."""
    return (
        "(SELECT count(*) FROM follows follow_row"
        f" WHERE follow_row.follower_id = {user_column}"
        " AND follow_row.status = 'accepted')"
    )


def follow_state_sql(viewer: str, user_column: str) -> str:
    """Where `viewer` stands towards the account in `user_column`, as a
    FollowState: a subquery."""
    return (
        "COALESCE((SELECT CASE follow_row.status"
        " WHEN 'accepted' THEN 'following' ELSE 'requested' END"
        " FROM follows follow_row"
        f" WHERE follow_row.follower_id = {viewer}"
        f" AND follow_row.followed_id = {user_column}), 'none')"
    )


# --- The bodies ---


class PersonBody(BaseModel):
    """A member in a list: found by name, a follower, one followed, one who
    asks. Never the email: packages/shared-types/fixtures/people.json."""

    public_id: UUID
    username: str
    photo: str | None = Field(
        description=(
            f"A square JPEG, {SMALL_PHOTO_SIDE} px a side, in base64; null"
            " without a picture."
        )
    )


class PeopleBody(BaseModel):
    """GET /users?q=: at most MAX_FOUND members whose name holds the query;
    first the names that begin with it, then the shortest."""

    people: list[PersonBody]


class PeoplePageBody(BaseModel):
    """A page of one's followers, followed or requests, the latest first:
    packages/shared-types/fixtures/people-page.json."""

    people: list[PersonBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""
    total: int
    """How many there are, on every page."""


class FollowBody(BaseModel):
    """POST /users/{public_id}/follow: where the one who asked stands now:
    packages/shared-types/fixtures/follow.json."""

    follow: Literal["requested", "following"]


# --- Without the database ---


def small_photo(jpeg: bytes) -> str:
    """A profile picture as a list shows it, in base64: SMALL_PHOTO_SIDE px
    a side, read at that size from the JPEG kept (profile_photos.py)."""
    side = (SMALL_PHOTO_SIDE, SMALL_PHOTO_SIDE)
    with Image.open(io.BytesIO(jpeg)) as picture:
        # Decodes at half the size at once, never the picture whole.
        picture.draft("RGB", side)
        small = picture.convert("RGB")
    if small.size != side:
        small = small.resize(side, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    small.save(out, "JPEG", quality=JPEG_QUALITY)
    return base64.b64encode(out.getvalue()).decode("ascii")


class SmallPhotos:
    """The small pictures made, the latest used kept, each by a digest of
    the picture it was made from: a new picture is a new digest, so the one
    before is never shown. The digest of 20 KB costs microseconds, the
    picture milliseconds."""

    def __init__(self, size: int = SMALL_PHOTOS_KEPT) -> None:
        self.size = size
        self._kept: OrderedDict[bytes, str] = OrderedDict()
        self._lock = threading.Lock()

    def of(self, jpeg: bytes) -> str:
        """small_photo(jpeg), made once."""
        key = hashlib.blake2b(jpeg, digest_size=16).digest()
        with self._lock:
            kept = self._kept.get(key)
            if kept is not None:
                self._kept.move_to_end(key)
                return kept
        small = small_photo(jpeg)
        with self._lock:
            self._kept[key] = small
            while len(self._kept) > self.size:
                self._kept.popitem(last=False)
        return small


SMALL_PHOTOS = SmallPhotos()


def checked_query(q: str) -> str | None:
    """The part of a name to look for, in lower case; None when no name can
    hold it. 422 for less than MIN_QUERY_LENGTH characters."""
    query = q.strip()
    if len(query) < MIN_QUERY_LENGTH:
        raise AccountError(422, "invalid_request", QUERY_TOO_SHORT)
    if len(query) > MAX_QUERY_LENGTH:
        return None
    return query.lower()


def like_itself(text: str) -> str:
    """`text` in a LIKE pattern, matching only itself: a username may hold
    `_`, which LIKE would read as any character. Backslash is the escape
    LIKE uses by default."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _person(row: DictRow) -> PersonBody:
    """A member of a list, from the PERSON_COLUMNS of its row."""
    jpeg = row["jpeg"]
    return PersonBody(
        public_id=row["public_id"],
        username=row["username"],
        photo=None if jpeg is None else SMALL_PHOTOS.of(bytes(jpeg)),
    )


def _cursor(row: DictRow) -> str:
    at: datetime = row["at"]
    public_id: UUID = row["public_id"]
    return f"{(at - EPOCH) // MICROSECOND}-{public_id.hex}"


def _after_cursor(cursor: str) -> tuple[datetime, UUID]:
    micros, public_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(public_id)


# For each list of an account: which rows, who is the other in them, and
# the moment they are in order of.
LISTS: dict[Which, tuple[str, str, str]] = {
    "followers": (
        "f.followed_id = %s AND f.status = 'accepted'",
        "f.follower_id",
        "f.accepted_at",
    ),
    "following": (
        "f.follower_id = %s AND f.status = 'accepted'",
        "f.followed_id",
        "f.accepted_at",
    ),
    "requests": (
        "f.followed_id = %s AND f.status = 'pending'",
        "f.follower_id",
        "f.asked_at",
    ),
}

PERSON_COLUMNS = "u.public_id, u.username, p.jpeg"


# --- In the database ---


@dataclass
class Follows:
    """Who follows whom, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def follows(self, follower_id: int, followed_id: int) -> bool:
        """Whether the first account follows the second, the request
        accepted (TASK-208)."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {follows_sql('%s', '%s')} AS yes",
                (follower_id, followed_id),
            ).fetchone()
        assert row is not None
        return bool(row["yes"])

    def search(self, user_id: int, q: str) -> PeopleBody:
        """The members whose name holds `q`, without the one who asks."""
        query = checked_query(q)
        if query is None:
            return PeopleBody(people=[])
        holds, begins = f"%{like_itself(query)}%", f"{like_itself(query)}%"
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {PERSON_COLUMNS} FROM users u"
                " LEFT JOIN profile_photos p ON p.user_id = u.id"
                " WHERE u.id <> %s AND lower(u.username) LIKE %s"
                # Nobody on either side of a block (TASK-121).
                f" AND NOT {apart_sql('%s', 'u.id')}"
                # Usernames are unique in lower case: always the same order.
                " ORDER BY lower(u.username) LIKE %s DESC, length(u.username),"
                " lower(u.username) LIMIT %s",
                (user_id, holds, user_id, begins, MAX_FOUND),
            ).fetchall()
        return PeopleBody(people=[_person(row) for row in rows])

    def ask(self, user_id: int, public_id: str) -> FollowBody:
        """Asks to follow; an account asked already or followed stays so."""
        try:
            with self.database.connect() as conn:
                other = _account(conn, public_id)
                if other == user_id:
                    raise AccountError(422, "invalid_request", NOT_YOURSELF)
                if _apart(conn, user_id, other):
                    # Across a block the other is not there (TASK-121).
                    raise AccountError(404, "http_error", NO_PROFILE)
                row = conn.execute(
                    "INSERT INTO follows (follower_id, followed_id, status, asked_at)"
                    " VALUES (%s, %s, 'pending', %s)"
                    # Asked again: the row stays as it is, date and all.
                    " ON CONFLICT (follower_id, followed_id)"
                    " DO UPDATE SET status = follows.status RETURNING status",
                    (user_id, other, self.now()),
                ).fetchone()
        except pg_errors.ForeignKeyViolation:
            # The other account was deleted between finding it and asking.
            raise AccountError(404, "http_error", NO_PROFILE) from None
        assert row is not None
        return FollowBody(
            follow="following" if row["status"] == "accepted" else "requested"
        )

    def stop(self, user_id: int, public_id: str) -> None:
        """Withdraws the request, or stops following."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            conn.execute(
                "DELETE FROM follows WHERE follower_id = %s AND followed_id = %s",
                (user_id, other),
            )

    def accept(self, user_id: int, public_id: str) -> None:
        """The request of `public_id` accepted; 404 when it asked nothing."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            row = conn.execute(
                "UPDATE follows SET status = 'accepted',"
                # Accepted again: when it was, stays.
                " accepted_at = COALESCE(accepted_at, %s)"
                " WHERE follower_id = %s AND followed_id = %s RETURNING 1",
                (self.now(), other, user_id),
            ).fetchone()
        if row is None:
            raise AccountError(404, "http_error", NO_REQUEST)

    def decline(self, user_id: int, public_id: str) -> None:
        """The request of `public_id` deleted; a follower stays one."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            conn.execute(
                "DELETE FROM follows WHERE follower_id = %s AND followed_id = %s"
                " AND status = 'pending'",
                (other, user_id),
            )

    def remove(self, user_id: int, public_id: str) -> None:
        """`public_id` neither follows nor asks any more."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            conn.execute(
                "DELETE FROM follows WHERE follower_id = %s AND followed_id = %s",
                (other, user_id),
            )

    def page(
        self,
        user_id: int,
        which: Which,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> PeoplePageBody:
        """A page of the account's followers, followed or requests, the
        latest first."""
        rows_of, other, at = LISTS[which]
        where = rows_of
        values: list[Any] = [user_id]
        if cursor is not None:
            where += f" AND ({at}, u.public_id) < (%s, %s)"
            values += _after_cursor(cursor)
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {PERSON_COLUMNS}, {at} AS at FROM follows f"
                f" JOIN users u ON u.id = {other}"
                " LEFT JOIN profile_photos p ON p.user_id = u.id"
                f" WHERE {where} ORDER BY {at} DESC, u.public_id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                f"SELECT count(*) AS n FROM follows f WHERE {rows_of}", (user_id,)
            ).fetchone()
        assert count is not None
        page, more = rows[:limit], len(rows) > limit
        return PeoplePageBody(
            people=[_person(row) for row in page],
            next=_cursor(page[-1]) if more else None,
            total=count["n"],
        )


def _account(conn: psycopg.Connection[DictRow], public_id: str) -> int:
    """The users.id of a profile; 404 for none, or not an id at all."""
    try:
        wanted = UUID(public_id)
    except ValueError:
        raise AccountError(404, "http_error", NO_PROFILE) from None
    row = conn.execute(
        "SELECT id FROM users WHERE public_id = %s", (wanted,)
    ).fetchone()
    if row is None:
        raise AccountError(404, "http_error", NO_PROFILE)
    user_id: int = row["id"]
    return user_id


def _apart(conn: psycopg.Connection[DictRow], user_id: int, other: int) -> bool:
    """Whether a block stands between the two accounts, made by either."""
    row = conn.execute(
        f"SELECT {apart_sql('%s', 'other_row.id')} AS apart"
        " FROM (SELECT %s::bigint AS id) other_row",
        (user_id, other),
    ).fetchone()
    assert row is not None
    return bool(row["apart"])


def follows_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Follows:
    """In the database of the accounts, on the same clock."""
    return Follows(accounts.database, accounts.now)


Them = Annotated[Follows, Depends(follows_of)]
Me = Annotated[UserBody, Depends(current_user)]
Limit = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)]
Cursor = Annotated[str | None, Query(pattern=CURSOR_PATTERN)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}


def follow_routes() -> APIRouter:
    router = APIRouter(tags=["follow"], responses=ACCOUNT_ERRORS)

    @router.get("/users")
    def search(follows: Them, user: Me, q: str = "") -> PeopleBody:
        return follows.search(user.id, q)

    @router.post("/users/{public_id}/follow", responses=NOT_FOUND)
    def ask(public_id: str, follows: Them, user: Me, request: Request) -> FollowBody:
        asked = follows.ask(user.id, public_id)
        pushed_follow_request(request, user, public_id, asked)
        return asked

    # Withdraws a request or stops following: the same for the one who asks.
    @router.delete("/users/{public_id}/follow", status_code=204, responses=NOT_FOUND)
    def stop(public_id: str, follows: Them, user: Me) -> Response:
        follows.stop(user.id, public_id)
        return Response(status_code=204)

    @router.get("/me/follow-requests")
    def requests(
        follows: Them, user: Me, limit: Limit = PAGE_SIZE, cursor: Cursor = None
    ) -> PeoplePageBody:
        return follows.page(user.id, "requests", limit, cursor)

    @router.post(
        "/me/follow-requests/{public_id}/accept", status_code=204, responses=NOT_FOUND
    )
    def accept(public_id: str, follows: Them, user: Me, request: Request) -> Response:
        follows.accept(user.id, public_id)
        pushed_follow_accepted(request, user, public_id)
        return Response(status_code=204)

    @router.post(
        "/me/follow-requests/{public_id}/decline", status_code=204, responses=NOT_FOUND
    )
    def decline(public_id: str, follows: Them, user: Me) -> Response:
        follows.decline(user.id, public_id)
        return Response(status_code=204)

    @router.get("/me/followers")
    def followers(
        follows: Them, user: Me, limit: Limit = PAGE_SIZE, cursor: Cursor = None
    ) -> PeoplePageBody:
        return follows.page(user.id, "followers", limit, cursor)

    @router.delete("/me/followers/{public_id}", status_code=204, responses=NOT_FOUND)
    def remove(public_id: str, follows: Them, user: Me) -> Response:
        follows.remove(user.id, public_id)
        return Response(status_code=204)

    @router.get("/me/following")
    def following(
        follows: Them, user: Me, limit: Limit = PAGE_SIZE, cursor: Cursor = None
    ) -> PeoplePageBody:
        return follows.page(user.id, "following", limit, cursor)

    return router


def install_follows(app: FastAPI) -> None:
    """Following and the search of the members; after install_accounts,
    which sets the database and the errors."""
    app.include_router(follow_routes())


# --- Push notifications (TASK-262, ADR-0226) ---


def pushed_follow_request(
    request: Request, user: UserBody, public_id: str, asked: FollowBody
) -> None:
    """After a request is kept: the one asked is told (push.py), not when
    the answer is «following» already."""
    if asked.follow == "requested":
        notify_account(request, "follow_request", user.id, public_id)


def pushed_follow_accepted(request: Request, user: UserBody, public_id: str) -> None:
    """After a request is accepted: the one who asked is told (push.py), the
    «new follower» of the user's list."""
    notify_account(request, "follow_accepted", user.id, public_id)
