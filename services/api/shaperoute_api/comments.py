"""Comments: what the members write under a drawing (TASK-120, docs/API.md,
«Comments»).

Whoever can see a drawing (drawings.drawing_seen_sql) reads its comments
and writes one: its owner always, the others as its visibility says
(TASK-208). A drawing seen by fewer keeps them, unseen by the others, until
they see it again. A comment is deleted by who wrote it, or by the owner of
the drawing; deleting the drawing (with its run), or the account that wrote
it, deletes it too (ON DELETE CASCADE).

A comment is plain text: the API keeps it as written, the app shows it as
text, never as a link or as HTML (docs/UI.md). A negative one is never kept:
comment_filter.py says which (TASK-213, ADR-0176).

A block keeps two members apart (TASK-121, moderation.py): neither reads,
writes or counts the comments of the other, nor opens the other's drawing.
"""

from __future__ import annotations

import math
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
)
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.access import RateLimiter
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
from shaperoute_api.db import Database
from shaperoute_api.drawings import (
    CURSOR_PATTERN,
    MAX_PAGE_SIZE,
    NO_DRAWING,
    PAGE_SIZE,
    AuthorBody,
    drawing_seen_sql,
)
from shaperoute_api.follows import apart_sql
from shaperoute_api.push import notify_owner
from shaperoute_api.schemas import ErrorBody, ErrorDetail

MAX_COMMENT_LENGTH = 500
# A person writes a few in a minute; more is a script.
MAX_COMMENTS_PER_MINUTE = 10

COMMENT_EMPTY = "A comment needs some words."
COMMENT_TOO_LONG = f"A comment is at most {MAX_COMMENT_LENGTH} characters."
COMMENT_NOT_TEXT = (
    "A comment is words and new lines: it cannot hold control characters."
)
TOO_MANY_COMMENTS = "Too many comments in a minute: wait a moment and try again."
NO_COMMENT = "No comment with this id."
NOT_YOUR_COMMENT = "Only who wrote a comment, or the owner of the drawing, deletes it."
# The user's words (ADR-0176), which the app shows in an alert.
NEGATIVE_COMMENT = "You can't write negative comments in this app. Try another app."


def checked_text(value: str) -> str:
    """The comment as kept: without spaces at either end; or 422 saying what
    is wrong with it. New lines stay, as in a bio."""
    text = value.strip()
    if not text:
        raise AccountError(422, "invalid_request", COMMENT_EMPTY)
    if len(text) > MAX_COMMENT_LENGTH:
        raise AccountError(422, "invalid_request", COMMENT_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" and c != "\n" for c in text):
        raise AccountError(422, "invalid_request", COMMENT_NOT_TEXT)
    return text


class CommentRejected(Exception):
    """A comment the filter refuses: 422 comment_rejected, with `reason`."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def rejected_answer(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, CommentRejected)
    # Validated: a reason the filter gives and the contract does not know
    # fails here, not on the phone.
    detail = ErrorDetail.model_validate(
        {"code": "comment_rejected", "message": NEGATIVE_COMMENT, "reason": exc.reason}
    )
    return JSONResponse(status_code=422, content=ErrorBody(error=detail).model_dump())


# --- The bodies ---


class CommentRequestBody(BaseModel):
    """POST /drawings/{id}/comments:
    packages/shared-types/fixtures/comment-request.json."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        description=(
            f"1 to {MAX_COMMENT_LENGTH} characters once the spaces at either end"
            " are gone; new lines are kept."
        ),
    )


class CommentBody(BaseModel):
    """One comment, as who asks sees it:
    packages/shared-types/fixtures/comment.json."""

    id: UUID
    author: AuthorBody
    text: str
    created_at: datetime
    deletable: bool
    """True when who asks may delete it: its author, or the drawing's
    owner."""


class CommentsBody(BaseModel):
    """GET /drawings/{id}/comments: a page, the oldest first:
    packages/shared-types/fixtures/comments.json."""

    comments: list[CommentBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""
    total: int
    """How many comments the drawing has, on every page."""


# --- The comments in the database ---

# A drawing `viewer` may see, as drawings.py asks it (TASK-208): never one
# whose owner a block keeps apart from `viewer` (TASK-121).
SEEN_BY = f"d.id = %s AND {drawing_seen_sql('%s')}"
# The comments `viewer` reads: none of a member a block keeps apart, nor of
# one hidden; one hidden from a report's email only by its author (TASK-291,
# ADR-0251). One placeholder: `viewer`.
NOT_APART = (
    "EXISTS (SELECT 1 FROM (SELECT %s::bigint AS id) reader"
    f" WHERE NOT {apart_sql('reader.id', 'c.user_id')}"
    " AND (c.hidden_at IS NULL OR c.user_id = reader.id))"
)


def _cursor(row: DictRow) -> str:
    created_at: datetime = row["created_at"]
    return f"{(created_at - EPOCH) // MICROSECOND}-{row['id'].hex}"


def _after_cursor(cursor: str) -> tuple[datetime, UUID]:
    micros, comment_id = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(comment_id)


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


Deleted = Literal["deleted", "not_yours"]


@dataclass
class Comments:
    """The comments in the database."""

    database: Database
    now: Callable[[], datetime]

    def page(
        self,
        viewer_id: int,
        drawing_id: str,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> CommentsBody | None:
        """A page of the drawing's comments, the oldest first; None when
        `viewer_id` may not see the drawing, as for an id that is not there."""
        wanted = _uuid(drawing_id)
        if wanted is None:
            return None
        with self.database.connect() as conn:
            drawing = conn.execute(
                "SELECT r.user_id AS owner FROM drawings d"
                f" JOIN runs r ON r.id = d.run_id WHERE {SEEN_BY}",
                (wanted, viewer_id),
            ).fetchone()
            if drawing is None:
                return None
            where = f"c.drawing_id = %s AND {NOT_APART}"
            values: list[Any] = [wanted, viewer_id]
            if cursor is not None:
                where += " AND (c.created_at, c.id) > (%s, %s)"
                values += _after_cursor(cursor)
            rows = conn.execute(
                "SELECT c.id, c.text, c.created_at, c.user_id, u.public_id,"
                " u.username FROM comments c JOIN users u ON u.id = c.user_id"
                f" WHERE {where} ORDER BY c.created_at, c.id LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                f"SELECT count(*) AS n FROM comments c WHERE c.drawing_id = %s"
                f" AND {NOT_APART}",
                (wanted, viewer_id),
            ).fetchone()
        assert count is not None
        page, more = rows[:limit], len(rows) > limit
        return CommentsBody(
            comments=[
                CommentBody(
                    id=row["id"],
                    author=AuthorBody(
                        public_id=row["public_id"], username=row["username"]
                    ),
                    text=row["text"],
                    created_at=row["created_at"],
                    deletable=viewer_id in (row["user_id"], drawing["owner"]),
                )
                for row in page
            ],
            next=_cursor(page[-1]) if more else None,
            total=count["n"],
        )

    def add(self, user: UserBody, drawing_id: str, text: str) -> CommentBody | None:
        """`text` under the drawing, by `user`; None when `user` may not see
        the drawing. 422 for a text refused, or a negative one."""
        kept = checked_text(text)
        reason = check_comment(kept)
        if reason is not None:
            raise CommentRejected(reason)
        wanted = _uuid(drawing_id)
        if wanted is None:
            return None
        try:
            with self.database.connect() as conn:
                row = conn.execute(
                    "INSERT INTO comments (drawing_id, user_id, text, created_at)"
                    " SELECT d.id, %s, %s, %s FROM drawings d"
                    f" JOIN runs r ON r.id = d.run_id WHERE {SEEN_BY}"
                    " RETURNING id, created_at",
                    (user.id, kept, self.now(), wanted, user.id),
                ).fetchone()
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while it was writing.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN) from None
        if row is None:
            return None
        return CommentBody(
            id=row["id"],
            author=AuthorBody(public_id=user.public_id, username=user.username),
            text=kept,
            created_at=row["created_at"],
            deletable=True,
        )

    def delete(self, viewer_id: int, comment_id: str) -> Deleted | None:
        """Deletes the comment when `viewer_id` wrote it or owns its drawing;
        "not_yours" when it only sees it; None when it does not, as for an id
        that is not there."""
        wanted = _uuid(comment_id)
        if wanted is None:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT c.user_id AS author, r.user_id AS owner,"
                f" {drawing_seen_sql('%s')} AS seen"
                " FROM comments c JOIN drawings d ON d.id = c.drawing_id"
                " JOIN runs r ON r.id = d.run_id WHERE c.id = %s",
                (viewer_id, wanted),
            ).fetchone()
            if row is None:
                return None
            # Who wrote it deletes it even under a drawing made private since.
            if viewer_id in (row["author"], row["owner"]):
                conn.execute("DELETE FROM comments WHERE id = %s", (wanted,))
                return "deleted"
        return "not_yours" if row["seen"] else None


def comments_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Comments:
    """In the database of the accounts, on the same clock."""
    return Comments(accounts.database, accounts.now)


def comment_routes() -> APIRouter:
    router = APIRouter(tags=["comments"], responses=ACCOUNT_ERRORS)
    # Per account, as the profile pictures: one person, one limit.
    written = RateLimiter(MAX_COMMENTS_PER_MINUTE)

    @router.get(
        "/drawings/{drawing_id}/comments", responses={404: {"model": ErrorBody}}
    )
    def drawing_comments(
        drawing_id: str,
        comments: Annotated[Comments, Depends(comments_of)],
        user: Annotated[UserBody, Depends(current_user)],
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> CommentsBody:
        found = comments.page(user.id, drawing_id, limit, cursor)
        if found is None:
            raise HTTPException(404, NO_DRAWING)
        return found

    @router.post(
        "/drawings/{drawing_id}/comments",
        status_code=201,
        responses={404: {"model": ErrorBody}},
    )
    def add_comment(
        drawing_id: str,
        body: CommentRequestBody,
        comments: Annotated[Comments, Depends(comments_of)],
        user: Annotated[UserBody, Depends(current_user)],
        request: Request,
    ) -> CommentBody:
        wait = written.wait_s(str(user.id))
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_COMMENTS, math.ceil(wait)
            )
        added = comments.add(user, drawing_id, body.text)
        if added is None:
            raise HTTPException(404, NO_DRAWING)
        pushed_comment(request, user, drawing_id, added)
        return added

    @router.delete(
        "/comments/{comment_id}",
        status_code=204,
        responses={403: {"model": ErrorBody}, 404: {"model": ErrorBody}},
    )
    def delete_comment(
        comment_id: str,
        comments: Annotated[Comments, Depends(comments_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        deleted = comments.delete(user.id, comment_id)
        if deleted is None:
            raise HTTPException(404, NO_COMMENT)
        if deleted == "not_yours":
            raise HTTPException(403, NOT_YOUR_COMMENT)
        return Response(status_code=204)

    return router


def install_comments(app: FastAPI) -> None:
    """The comments under the drawings; after install_accounts, which sets
    the database and the errors."""
    app.add_exception_handler(CommentRejected, rejected_answer)
    app.include_router(comment_routes())


# --- Push notifications (TASK-262, ADR-0226) ---


def pushed_comment(
    request: Request, user: UserBody, drawing_id: str, added: CommentBody
) -> None:
    """After a comment is kept: the drawing's owner is told (push.py), with
    its beginning. Each comment is news of its own."""
    notify_owner(
        request, "comment", user.id, drawing_id, text=added.text, key=str(added.id)
    )
