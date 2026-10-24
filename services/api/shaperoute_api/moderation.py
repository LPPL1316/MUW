"""Blocking and reporting (TASK-121, ADR-0228, docs/API.md, «Block and
report»).

PUT /users/{public_id}/block keeps two members apart, both ways: neither
sees the other's drawings in the feed, comments, reactions, profile or name
in a search (follows.apart_sql, read by each of those modules). Blocking
also ends any follow and any request between the two, in both directions,
and a new request across the block is answered as for nobody. DELETE
unblocks; neither side is told. Both change nothing done again: a second
block keeps one, unblocking someone not blocked is done already.
GET /me/blocked lists the members blocked, the last first, to unblock them.

POST /reports keeps what a member reports, a drawing, a comment or a
member, with a reason from a short list: one row for each reporter and
thing, the latest reason kept. The reports stay in the table for whoever
runs the app; no endpoint reads them (no admin panel yet, ADR-0228).

Deleting an account deletes its blocks, both ways, and its reports
(ON DELETE CASCADE).
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal, get_args
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict

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
from shaperoute_api.db import Database
from shaperoute_api.follows import (
    CURSOR_PATTERN,
    MAX_PAGE_SIZE,
    NO_PROFILE,
    PAGE_SIZE,
    PERSON_COLUMNS,
    PeoplePageBody,
    _account,
    _person,
)
from shaperoute_api.schemas import ErrorBody

ReportKind = Literal["drawing", "comment", "user"]
"""What is reported: a drawing (a post of the feed), a comment, a member."""
ReportReason = Literal["spam", "offensive", "harassment", "sexual", "other"]
"""The short list the app shows, in this order. Codes, never the words: the
app says them in its language. The migration's CHECK holds the same list."""
REPORT_KINDS: tuple[ReportKind, ...] = get_args(ReportKind)
REPORT_REASONS: tuple[ReportReason, ...] = get_args(ReportReason)

log = logging.getLogger(__name__)

# After a block is written, in its transaction: the shape game takes one of
# the two out of a team they share (TASK-296 C, game_teams.on_block). A hook
# that fails is rolled back alone, and logged: the block stays.
BlockHook = Callable[[Connection[DictRow], int, int], None]

NOT_YOURSELF_BLOCK = "You cannot block yourself."
NOT_YOURSELF_REPORT = "You cannot report yourself or what you wrote."
NOTHING_TO_REPORT = "Nothing to report with this id."

# The table of each kind, and the column of the account that owns a row.
OWNER_OF: dict[ReportKind, str] = {
    "drawing": (
        "SELECT r.user_id AS owner FROM drawings d JOIN runs r ON r.id = d.run_id"
        " WHERE d.id = %s"
    ),
    "comment": "SELECT user_id AS owner FROM comments WHERE id = %s",
    "user": "SELECT id AS owner FROM users WHERE public_id = %s",
}


# --- The bodies ---


class ReportRequestBody(BaseModel):
    """POST /reports: packages/shared-types/fixtures/report-request.json."""

    model_config = ConfigDict(extra="forbid")

    kind: ReportKind
    id: UUID
    """The drawing's id, the comment's id or the member's public_id."""
    reason: ReportReason


# --- In the database ---


def _cursor(at: datetime, public_id: UUID) -> str:
    return f"{(at - EPOCH) // MICROSECOND}-{public_id.hex}"


def _after_cursor(cursor: str) -> tuple[datetime, UUID]:
    micros, public_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(public_id)


@dataclass
class Moderation:
    """Blocks and reports, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]
    on_block: Sequence[BlockHook] = ()

    def block(self, user_id: int, public_id: str) -> None:
        """`public_id` blocked by `user_id`, and every follow between the
        two gone; blocked already, it stays so."""
        try:
            with self.database.connect() as conn:
                other = _account(conn, public_id)
                if other == user_id:
                    raise AccountError(422, "invalid_request", NOT_YOURSELF_BLOCK)
                conn.execute(
                    "INSERT INTO blocks (blocker_id, blocked_id, created_at)"
                    " VALUES (%s, %s, %s)"
                    # Blocked again: the row stays as it is, date and all.
                    " ON CONFLICT (blocker_id, blocked_id) DO NOTHING",
                    (user_id, other, self.now()),
                )
                conn.execute(
                    "DELETE FROM follows WHERE (follower_id = %s AND followed_id = %s)"
                    " OR (follower_id = %s AND followed_id = %s)",
                    (user_id, other, other, user_id),
                )
                for hook in self.on_block:
                    try:
                        with conn.transaction():
                            hook(conn, user_id, other)
                    except Exception:
                        log.exception("moderation: a hook of the block failed")
        except pg_errors.ForeignKeyViolation:
            # One of the two accounts was deleted while this was written.
            raise AccountError(404, "http_error", NO_PROFILE) from None

    def unblock(self, user_id: int, public_id: str) -> None:
        """`public_id` no longer blocked by `user_id`; a block the other made
        stays."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            conn.execute(
                "DELETE FROM blocks WHERE blocker_id = %s AND blocked_id = %s",
                (user_id, other),
            )

    def blocked(
        self, user_id: int, limit: int = PAGE_SIZE, cursor: str | None = None
    ) -> PeoplePageBody:
        """A page of the members `user_id` blocked, the last first."""
        where = "b.blocker_id = %s"
        values: list[Any] = [user_id]
        if cursor is not None:
            where += " AND (b.created_at, u.public_id) < (%s, %s)"
            values += _after_cursor(cursor)
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {PERSON_COLUMNS}, b.created_at AS at FROM blocks b"
                " JOIN users u ON u.id = b.blocked_id"
                " LEFT JOIN profile_photos p ON p.user_id = u.id"
                f" WHERE {where} ORDER BY b.created_at DESC, u.public_id DESC"
                " LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                "SELECT count(*) AS n FROM blocks WHERE blocker_id = %s", (user_id,)
            ).fetchone()
        assert count is not None
        page, more = rows[:limit], len(rows) > limit
        return PeoplePageBody(
            people=[_person(row) for row in page],
            next=_cursor(page[-1]["at"], page[-1]["public_id"]) if more else None,
            total=count["n"],
        )

    def report(self, user_id: int, body: ReportRequestBody) -> None:
        """The report kept, one for each reporter and thing; 404 for nothing
        with this id, 422 for oneself or one's own."""
        try:
            with self.database.connect() as conn:
                row = conn.execute(OWNER_OF[body.kind], (body.id,)).fetchone()
                if row is None:
                    raise AccountError(404, "http_error", NOTHING_TO_REPORT)
                if row["owner"] == user_id:
                    raise AccountError(422, "invalid_request", NOT_YOURSELF_REPORT)
                conn.execute(
                    "INSERT INTO reports (reporter_id, kind, target_id, reason,"
                    " created_at) VALUES (%s, %s, %s, %s, %s)"
                    " ON CONFLICT (reporter_id, kind, target_id)"
                    " DO UPDATE SET reason = EXCLUDED.reason,"
                    " created_at = EXCLUDED.created_at",
                    (user_id, body.kind, body.id, body.reason, self.now()),
                )
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while it was reporting.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN) from None


def moderation_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> Moderation:
    """In the database of the accounts, on the same clock, with the hooks
    the other modules put in app.state.on_block."""
    return Moderation(accounts.database, accounts.now, request.app.state.on_block)


Them = Annotated[Moderation, Depends(moderation_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}


def moderation_routes() -> APIRouter:
    router = APIRouter(tags=["moderation"], responses=ACCOUNT_ERRORS)

    @router.put("/users/{public_id}/block", status_code=204, responses=NOT_FOUND)
    def block(public_id: str, moderation: Them, user: Me) -> Response:
        moderation.block(user.id, public_id)
        return Response(status_code=204)

    @router.delete("/users/{public_id}/block", status_code=204, responses=NOT_FOUND)
    def unblock(public_id: str, moderation: Them, user: Me) -> Response:
        moderation.unblock(user.id, public_id)
        return Response(status_code=204)

    @router.get("/me/blocked")
    def blocked(
        moderation: Them,
        user: Me,
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> PeoplePageBody:
        return moderation.blocked(user.id, limit, cursor)

    @router.post("/reports", status_code=204, responses=NOT_FOUND)
    def report(body: ReportRequestBody, moderation: Them, user: Me) -> Response:
        moderation.report(user.id, body)
        return Response(status_code=204)

    return router


def install_moderation(app: FastAPI) -> None:
    """Blocking and reporting; after install_accounts, which sets the
    database and the errors. The modules installed after add to
    app.state.on_block what they do when a block is written."""
    app.state.on_block = []
    app.include_router(moderation_routes())
