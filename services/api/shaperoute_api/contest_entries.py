"""The monthly challenges' own parts: the entries, the gallery, the archive
(TASK-343, ADR-0296, docs/CONCORSI.md §15, docs/API.md «Contest»).

In a contest with a theme only the drawings their owners entered take part
(contests.ENTERED_SQL). An owner enters a drawing, or takes it back, while
the contest is open and before its end; the drawing must take part as in
a contest without a theme (contests.PARTICIPATES_SQL: for everyone,
published in the period, of a run recorded by the app, not hidden). Any
number of drawings per account: the user's choice of 2026-10-30. A drawing
that stops taking part (made private, hidden) leaves the standings by
itself, its entry kept: every reading asks the query again.

The gallery is the whole standings of a contest, by place or the latest
published first, a page at a time; the archive the contests closed, the
latest first, with their winner and their first three. Both are readings of
contests.RANKED_SQL, the one rule for who leads; with a token the posts
across a block with who asks are left out, keeping their places. So are
the posts of an activity the app does not read (reads.py, TASK-387).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from psycopg import Connection
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
from shaperoute_api.contests import (
    CONTEST_COLUMNS,
    PARTICIPATES_SQL,
    RANKED_SQL,
    Contest,
    ContestEntryBody,
    ContestWinnerBody,
    ThemeBody,
    _contest,
    _post,
    entrants_of,
    leaders,
    viewer_of,
)
from shaperoute_api.db import Database
from shaperoute_api.drawings import _details
from shaperoute_api.follows import apart_sql
from shaperoute_api.reads import EVERYTHING, Reads, Shown
from shaperoute_api.schemas import ErrorBody

GALLERY_PAGE = 30
ARCHIVE_PAGE = 10
# Where a page ended. The gallery by place: the last place; the latest
# first, and the archive: the moment (of publication, of the close) in
# microseconds and the id, which is random.
MOMENT_CURSOR = r"\d{1,17}-[0-9a-f]{32}"
PLACE_CURSOR = r"\d{1,9}"
GALLERY_CURSOR = rf"^({PLACE_CURSOR}|{MOMENT_CURSOR})$"
ARCHIVE_CURSOR = rf"^{MOMENT_CURSOR}$"

NO_SUCH_CONTEST = "There is no such contest."
NO_ENTRIES = "This contest takes no entries now."
NOT_ENTRANT = (
    "This drawing cannot take part: it must be yours, for everyone, recorded"
    " with MuW and published during the challenge."
)
OTHER_ORDER = "This cursor is of the other order."

Order = Literal["top", "new"]


class ContestEntriesBody(BaseModel):
    """GET /contests/{id}/entries: a page of the gallery,
    packages/shared-types/fixtures/contest-entries.json."""

    entries: list[ContestEntryBody] = Field(
        description="By place (`top`) or the latest published first (`new`);"
        " `rank` is the place in the whole standings."
    )
    next: str | None
    """The `cursor` of the next page; null on the last one."""


class PastContestBody(BaseModel):
    """A contest closed, in the archive."""

    id: UUID
    starts_at: datetime
    ends_at: datetime
    closed_at: datetime
    theme: ThemeBody | None = Field(description="Null for a contest without one.")
    entrants: int = Field(description="The accounts that took part.")
    top: list[ContestEntryBody] = Field(description="Its first three, as in Contest.")
    winner: ContestWinnerBody


class PastContestsBody(BaseModel):
    """GET /contests?state=closed: a page of the archive, the latest closed
    first; inside packages/shared-types/fixtures/contest-entries.json."""

    contests: list[PastContestBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""


def _moment_cursor(moment: datetime, row_id: UUID) -> str:
    return f"{(moment - EPOCH) // MICROSECOND}-{row_id.hex}"


def _after_moment(cursor: str) -> tuple[datetime, UUID]:
    micros, row_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(row_id)


def _found(conn: Connection[DictRow], contest_id: UUID, lock: str = "") -> Contest:
    row = conn.execute(
        f"SELECT {CONTEST_COLUMNS} FROM contests WHERE id = %s{lock}", (contest_id,)
    ).fetchone()
    if row is None:
        raise AccountError(404, "no_contest", NO_SUCH_CONTEST)
    return _contest(row)


@dataclass
class ContestEntries:
    """The entries, the gallery and the archive in the database."""

    database: Database
    now: Callable[[], datetime]

    def _open_to_entries(self, conn: Connection[DictRow], contest_id: UUID) -> Contest:
        """The contest, locked against `close` until the entry is written;
        409 contest_closed unless it has a theme and is still running."""
        contest = _found(conn, contest_id, " FOR SHARE")
        if (
            contest.theme is None
            or contest.closed_at is not None
            or self.now() >= contest.ends_at
        ):
            raise AccountError(409, "contest_closed", NO_ENTRIES)
        return contest

    def enter(self, user_id: int, contest_id: UUID, drawing_id: UUID) -> None:
        """The drawing entered; again, nothing changes. 409 not_entrant
        when it is not the account's or does not take part."""
        with self.database.connect() as conn:
            contest = self._open_to_entries(conn, contest_id)
            takes_part = conn.execute(
                "SELECT 1 FROM drawings d JOIN runs r ON r.id = d.run_id"
                " JOIN users u ON u.id = r.user_id"
                " WHERE d.id = %(drawing)s AND r.user_id = %(user)s"
                f" AND {PARTICIPATES_SQL}",
                {**contest.ranked_values(), "drawing": drawing_id, "user": user_id},
            ).fetchone()
            if takes_part is None:
                raise AccountError(409, "not_entrant", NOT_ENTRANT)
            conn.execute(
                "INSERT INTO contest_entries (contest_id, drawing_id, user_id,"
                " created_at) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
                (contest.id, drawing_id, user_id, self.now()),
            )

    def withdraw(self, user_id: int, contest_id: UUID, drawing_id: UUID) -> None:
        """The drawing taken back; one not entered, or another's, is left
        as it is."""
        with self.database.connect() as conn:
            contest = self._open_to_entries(conn, contest_id)
            conn.execute(
                "DELETE FROM contest_entries WHERE contest_id = %s"
                " AND drawing_id = %s AND user_id = %s",
                (contest.id, drawing_id, user_id),
            )

    def gallery(
        self,
        viewer_id: int | None,
        contest_id: UUID,
        order: Order = "top",
        cursor: str | None = None,
        limit: int = GALLERY_PAGE,
        reads: Reads = EVERYTHING,
    ) -> ContestEntriesBody:
        """A page of the standings of any contest, as `viewer_id` sees it,
        of the posts `reads` shows."""
        values: dict[str, Any] = {"viewer": viewer_id, "limit": limit + 1}
        where = (
            "TRUE"
            if viewer_id is None
            else f"NOT {apart_sql('%(viewer)s', 'ranked.user_id')}"
        )
        where += f" AND {reads.sql('ranked.activity', 'ranked.tracked')}"
        by_place = re.fullmatch(PLACE_CURSOR, cursor or "") is not None
        if cursor is not None and by_place != (order == "top"):
            raise AccountError(422, "invalid_request", OTHER_ORDER)
        if order == "top":
            ordered = "standing"
            if cursor is not None:
                values["after"] = int(cursor)
                where += " AND standing > %(after)s"
        else:
            ordered = "published_at DESC, id DESC"
            if cursor is not None:
                values["at"], values["last"] = _after_moment(cursor)
                where += " AND (published_at, id) < (%(at)s, %(last)s)"
        with self.database.connect() as conn:
            contest = _found(conn, contest_id)
            rows = conn.execute(
                f"{RANKED_SQL} SELECT * FROM ranked WHERE {where}"
                f" ORDER BY {ordered} LIMIT %(limit)s",
                {**contest.ranked_values(), **values},
            ).fetchall()
            page, more = rows[:limit], len(rows) > limit
            details = _details(conn, [row["id"] for row in page])
        following: str | None = None
        if more:
            last = page[-1]
            following = (
                str(last["standing"])
                if order == "top"
                else _moment_cursor(last["published_at"], last["id"])
            )
        return ContestEntriesBody(
            entries=[
                ContestEntryBody(
                    rank=row["standing"],
                    reactions=row["reactions"],
                    drawing=_post(row, details),
                )
                for row in page
            ],
            next=following,
        )

    def archive(
        self,
        viewer_id: int | None,
        cursor: str | None = None,
        limit: int = ARCHIVE_PAGE,
        reads: Reads = EVERYTHING,
    ) -> PastContestsBody:
        """A page of the contests closed, the latest first, with the posts
        `reads` shows."""
        values: dict[str, Any] = {"limit": limit + 1}
        where = "closed_at IS NOT NULL"
        if cursor is not None:
            values["at"], values["last"] = _after_moment(cursor)
            where += " AND (closed_at, id) < (%(at)s, %(last)s)"
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {CONTEST_COLUMNS} FROM contests WHERE {where}"
                " ORDER BY closed_at DESC, id DESC LIMIT %(limit)s",
                values,
            ).fetchall()
            page, more = [_contest(row) for row in rows[:limit]], len(rows) > limit
            past: list[PastContestBody] = []
            for contest in page:
                ranked, fields = leaders(conn, contest, viewer_id, reads)
                assert contest.closed_at is not None
                past.append(
                    PastContestBody(
                        id=contest.id,
                        starts_at=contest.starts_at,
                        ends_at=contest.ends_at,
                        closed_at=contest.closed_at,
                        theme=contest.theme,
                        entrants=entrants_of(ranked),
                        **fields,
                    )
                )
        following = None
        if more:
            assert page[-1].closed_at is not None
            following = _moment_cursor(page[-1].closed_at, page[-1].id)
        return PastContestsBody(contests=past, next=following)


# --- The endpoints ---


def contest_entries_of(
    accounts: Annotated[Accounts, Depends(accounts_of)],
) -> ContestEntries:
    """In the database of the accounts, on the same clock."""
    return ContestEntries(accounts.database, accounts.now)


Them = Annotated[ContestEntries, Depends(contest_entries_of)]
Viewer = Annotated[UserBody | None, Depends(viewer_of)]
Me = Annotated[UserBody, Depends(current_user)]
REFUSED: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorBody},
    409: {"model": ErrorBody},
}


def entry_routes() -> APIRouter:
    router = APIRouter(tags=["contest"], responses=ACCOUNT_ERRORS)

    @router.put(
        "/contests/{contest_id}/entries/{drawing_id}",
        status_code=204,
        responses=REFUSED,
    )
    def enter(contest_id: UUID, drawing_id: UUID, entries: Them, user: Me) -> Response:
        entries.enter(user.id, contest_id, drawing_id)
        return Response(status_code=204)

    @router.delete(
        "/contests/{contest_id}/entries/{drawing_id}",
        status_code=204,
        responses=REFUSED,
    )
    def withdraw(
        contest_id: UUID, drawing_id: UUID, entries: Them, user: Me
    ) -> Response:
        entries.withdraw(user.id, contest_id, drawing_id)
        return Response(status_code=204)

    @router.get("/contests/{contest_id}/entries", responses={404: {"model": ErrorBody}})
    def gallery(
        contest_id: UUID,
        entries: Them,
        viewer: Viewer,
        reads: Shown,
        order: Order = "top",
        cursor: Annotated[str | None, Query(pattern=GALLERY_CURSOR)] = None,
    ) -> ContestEntriesBody:
        return entries.gallery(
            None if viewer is None else viewer.id,
            contest_id,
            order,
            cursor,
            reads=reads,
        )

    @router.get("/contests")
    def archive(
        entries: Them,
        viewer: Viewer,
        reads: Shown,
        state: Literal["closed"],
        cursor: Annotated[str | None, Query(pattern=ARCHIVE_CURSOR)] = None,
    ) -> PastContestsBody:
        return entries.archive(
            None if viewer is None else viewer.id, cursor, reads=reads
        )

    return router
