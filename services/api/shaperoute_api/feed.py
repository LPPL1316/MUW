"""The feed: the drawings the members publish, read by whoever is signed in
(TASK-118, ADR-0227, docs/API.md, «Feed»).

A page of GET /feed holds the drawings the reader may see, in three
groups: its own first, then those of the people it follows, then the
others', which are the nearby ones when the phone says where it is
(within NEAR_M of the point) and all of them when it does not. Inside
each group the one published last comes first. No filter, no ranking
beyond this: the user's choice («ok va bene questo semplice»).

Who may see a drawing is the question of the profiles (drawings.shown_sql):
every member sees one for `everyone`, the followers with the request
accepted (follows.py) and the owner see one for `followers`, nobody
reads one for `only_me`, not even its owner: the feed holds what was
published, never a private run, and never a track that is not cut. Nor
the drawings of a member the reader blocked or that blocked the reader
(TASK-121): shown_sql leaves them out.

The pages follow a cursor made of the group, the moment of publication
and the random id of the last drawing of the page: a drawing published
between two pages goes to the top of its group, above the cursor, and
the next page neither repeats nor skips one. Every post is a Drawing as
the profile lists it (drawings.DrawingBody) with its author: the app
opens it whole with GET /drawings/{id}, with its reactions and comments.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query
from psycopg.rows import DictRow
from pydantic import BaseModel

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
from shaperoute_api.drawings import (
    LISTED_COLUMNS,
    AuthorBody,
    DrawingBody,
    _details,
    _line,
    _seen,
    shown_sql,
)
from shaperoute_api.follows import follows_sql
from shaperoute_api.recommended import preview

PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
# How far from the phone a drawing of someone the reader does not follow
# is still "nearby": the radius of the far towns of «Near me»
# (nearby_cities.FAR_RADIUS_M), a region, not a town.
NEAR_M = 50_000.0
# The three groups, in the order they are read.
OWN, FOLLOWED, OTHERS = 0, 1, 2
# Where a page ended: the group, the moment of publication in microseconds
# and the id of the last drawing, which is random, so a cursor says nothing
# about the others.
CURSOR_PATTERN = r"^[0-2]-\d{1,17}-[0-9a-f]{32}$"

HALF_A_POINT = "Say where the phone is with both lat and lon, or with neither."

LatLon = tuple[float, float]


class FeedPostBody(DrawingBody):
    """A drawing in the feed: as the profile lists it, with who published
    it. packages/shared-types/fixtures/feed.json."""

    author: AuthorBody


class FeedBody(BaseModel):
    """GET /feed: a page of the drawings the reader may see."""

    posts: list[FeedPostBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""


def _cursor(row: DictRow) -> str:
    published_at: datetime = row["published_at"]
    return f"{row['tier']}-{(published_at - EPOCH) // MICROSECOND}-{row['id'].hex}"


def _after_cursor(cursor: str) -> tuple[int, datetime, UUID]:
    tier, micros, drawing_id = cursor.split("-")
    return int(tier), EPOCH + int(micros) * MICROSECOND, UUID(drawing_id)


def near_sql(point: LatLon | None) -> str:
    """An SQL condition: the preview of the cut track of the drawing `d`
    passes within NEAR_M of `point`; always true without one. The preview's
    64 points cost a fraction of the whole track's thousands, and they are
    as near, give or take the few hundred metres between two of them
    (TASK-288). The point is read from the placeholders `lat`, `lon` and
    `near_m`."""
    if point is None:
        return "TRUE"
    return (
        "ST_DWithin(d.preview::geography,"
        " ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, %(near_m)s)"
    )


def tier_sql(viewer: str) -> str:
    """The group of the drawing `d` of the run `r` for the account
    `viewer`: OWN for its own, FOLLOWED for one of a member it follows,
    OTHERS for the rest."""
    return (
        f"CASE WHEN r.user_id = {viewer}::bigint THEN {OWN}"
        f" WHEN {follows_sql(viewer, 'r.user_id')} THEN {FOLLOWED}"
        f" ELSE {OTHERS} END"
    )


@dataclass
class Feed:
    """The feed in the database."""

    database: Database
    now: Callable[[], datetime]

    def page(
        self,
        viewer_id: int,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
        point: LatLon | None = None,
    ) -> FeedBody:
        """A page of the drawings `viewer_id` may see, its own first, then
        those of the members it follows, then the others' near `point`
        (all of them without one); the last published first in each."""
        values: dict[str, Any] = {"viewer": viewer_id, "limit": limit + 1}
        if point is not None:
            values.update(lat=point[0], lon=point[1], near_m=NEAR_M)
        where = f"(tier < {OTHERS} OR nearby)"
        if cursor is not None:
            values.update(
                zip(("tier", "at", "last"), _after_cursor(cursor), strict=True)
            )
            where += (
                " AND (tier > %(tier)s OR (tier = %(tier)s"
                " AND (published_at, id) < (%(at)s, %(last)s)))"
            )
        with self.database.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM ("
                f"SELECT {LISTED_COLUMNS}, u.public_id, u.username,"
                f" {tier_sql('%(viewer)s')} AS tier, {near_sql(point)} AS nearby"
                " FROM drawings d JOIN runs r ON r.id = d.run_id"
                " JOIN users u ON u.id = r.user_id"
                # Implied by shown_sql, and said for the index of the
                # published drawings (migration 0022).
                " WHERE d.visibility <> 'only_me'"
                f" AND {shown_sql('%(viewer)s')}) feed"
                f" WHERE {where}"
                " ORDER BY tier, published_at DESC, id DESC LIMIT %(limit)s",
                values,
            ).fetchall()
            page, more = rows[:limit], len(rows) > limit
            details = _details(conn, [row["id"] for row in page])
        return FeedBody(
            posts=[
                FeedPostBody(
                    **_seen(row, details),
                    track_preview=preview(_line(row["track"])),
                    author=AuthorBody(
                        public_id=row["public_id"], username=row["username"]
                    ),
                )
                for row in page
            ],
            next=_cursor(page[-1]) if more else None,
        )


def feed_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Feed:
    """In the database of the accounts, on the same clock."""
    return Feed(accounts.database, accounts.now)


def feed_routes() -> APIRouter:
    router = APIRouter(tags=["feed"], responses=ACCOUNT_ERRORS)

    @router.get("/feed")
    def feed(
        feeds: Annotated[Feed, Depends(feed_of)],
        user: Annotated[UserBody, Depends(current_user)],
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
        lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
        lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    ) -> FeedBody:
        if (lat is None) != (lon is None):
            raise AccountError(422, "invalid_request", HALF_A_POINT)
        point = None if lat is None or lon is None else (lat, lon)
        return feeds.page(user.id, limit, cursor, point)

    return router


def install_feed(app: FastAPI) -> None:
    """The feed of the drawings; after install_accounts, which sets the
    database and the errors, and install_drawings, whose bodies it reads."""
    app.include_router(feed_routes())
