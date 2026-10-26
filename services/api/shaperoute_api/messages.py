"""Private messages between two members, with message requests (TASK-310,
ADR-0270, docs/API.md, «Messages»).

A member writes to any other one it is not kept apart from (a block, a
member hidden: follows.apart_sql). One conversation for each pair, read and
written by the other's public_id. Where a message lands:

- with someone who follows the writer, or who accepted, replied or wrote
  first: in its «Messages», and the two write freely;
- with anyone else: in its «Requests», one message at most until it
  accepts («Accept»), replies, or deletes the request («Delete»: out of its
  view; nothing says so, and the writer may write one message again, as
  after a follow request declined, ADR-0173). The message of a request
  passes the filter of the comments (comment_filter.py); the others do not.

A message is plain text, 1 to MAX_MESSAGE_LENGTH characters, deleted for
both by who wrote it. Nobody is told a message was read: `read_at` only
says which conversations have news, to their own member. Deleting a
conversation takes its messages out of one's own view; a message neither
member sees any more is deleted. A block deletes the conversation of the
two (on_block), as it ends their follows; deleting either account deletes
it too (ON DELETE CASCADE). A message is reported (moderation.py, kind
"message") only by the other member of its conversation; hidden from the
report's email, who wrote it still sees it.

Each message is told by push to the other (push.py, "message", with its
beginning); a request once a day for each writer ("message_request",
without its text). Never by email.
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
from psycopg import Connection
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
from shaperoute_api.follows import (
    CURSOR_PATTERN,
    MAX_PAGE_SIZE,
    NO_PROFILE,
    PAGE_SIZE,
    PERSON_COLUMNS,
    PersonBody,
    _account,
    _apart,
    _person,
    apart_sql,
    follows_sql,
)
from shaperoute_api.push import PushEvent, notify
from shaperoute_api.schemas import ErrorBody, ErrorDetail

MAX_MESSAGE_LENGTH = 1000
# A chat goes faster than comments; more is a script.
MAX_MESSAGES_PER_MINUTE = 20

# Where who asks stands in a conversation:
# - "open": it writes freely;
# - "first": it writes one message, a request for the other;
# - "waiting": it wrote that one, and writes again once the other accepts;
# - "request": the other wrote it a request: «Accept», «Delete», «Block».
State = Literal["open", "first", "waiting", "request"]
Box = Literal["inbox", "requests"]

MESSAGE_EMPTY = "A message needs some words."
MESSAGE_TOO_LONG = f"A message is at most {MAX_MESSAGE_LENGTH} characters."
MESSAGE_NOT_TEXT = (
    "A message is words and new lines: it cannot hold control characters."
)
NOT_YOURSELF = "You cannot write to yourself."
TOO_MANY_MESSAGES = "Too many messages in a minute: wait a moment and try again."
WAITING = "Your message request is waiting: write again once it is accepted."
NO_CONVERSATION = "No conversation with this member."
NO_MESSAGE = "No message with this id."
NOT_YOUR_MESSAGE = "Only who wrote a message deletes it."
NEGATIVE_MESSAGE = "You can't send negative messages in this app."


def checked_text(value: str) -> str:
    """The message as kept: without spaces at either end; or 422 saying
    what is wrong with it. New lines stay."""
    text = value.strip()
    if not text:
        raise AccountError(422, "invalid_request", MESSAGE_EMPTY)
    if len(text) > MAX_MESSAGE_LENGTH:
        raise AccountError(422, "invalid_request", MESSAGE_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" and c != "\n" for c in text):
        raise AccountError(422, "invalid_request", MESSAGE_NOT_TEXT)
    return text


class MessageRejected(Exception):
    """The message of a request the filter refuses: 422 comment_rejected,
    with `reason`, as a comment (the app says it in its words)."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def rejected_answer(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, MessageRejected)
    detail = ErrorDetail.model_validate(
        {"code": "comment_rejected", "message": NEGATIVE_MESSAGE, "reason": exc.reason}
    )
    return JSONResponse(status_code=422, content=ErrorBody(error=detail).model_dump())


# --- The bodies ---


class MessageRequestBody(BaseModel):
    """POST /conversations/{public_id}/messages:
    packages/shared-types/fixtures/message-request.json."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        description=(
            f"1 to {MAX_MESSAGE_LENGTH} characters once the spaces at either end"
            " are gone; new lines are kept."
        ),
    )


class MessageBody(BaseModel):
    """One message, as who asks sees it:
    packages/shared-types/fixtures/message.json."""

    id: UUID
    text: str
    created_at: datetime
    mine: bool
    """Who asks wrote it, and may delete it."""


class MessagesBody(BaseModel):
    """GET /conversations/{public_id}/messages: a page, the latest first:
    packages/shared-types/fixtures/messages.json."""

    person: PersonBody
    state: State
    messages: list[MessageBody]
    next: str | None
    """The `cursor` of the page of older ones; null on the oldest."""


class ConversationBody(BaseModel):
    """One conversation in a list: who with, and its latest message."""

    person: PersonBody
    last: MessageBody
    unread: bool
    """The other wrote since who asks last read it."""


class ConversationsBody(BaseModel):
    """GET /me/conversations: a page, the latest message first:
    packages/shared-types/fixtures/conversations.json."""

    conversations: list[ConversationBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""
    total: int
    """How many conversations the box has, on every page."""


class UnreadBody(BaseModel):
    """GET /me/conversations/unread: what the dot of «Messages» counts:
    packages/shared-types/fixtures/conversations-unread.json."""

    unread: int
    """Conversations of «Messages» with a message not read yet."""
    requests: int
    """Message requests waiting for an answer."""


# --- In the database ---

# The messages the member of `cm` sees: not before it cleared them, and not
# one hidden from a report's email unless it wrote it.
SEEN = (
    "(cm.cleared_at IS NULL OR m.created_at > cm.cleared_at)"
    " AND (m.hidden_at IS NULL OR m.sender_id = cm.user_id)"
)
# What the member of `cm` has not read: a message of the other since.
UNREAD = (
    "EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = cm.conversation_id"
    f" AND m.sender_id = cm.other_id AND {SEEN}"
    " AND (cm.read_at IS NULL OR m.created_at > cm.read_at))"
)
# The conversations of a box, as the member of `cm` sees them: one
# placeholder, its users.id, then the box's condition.
BOX_OF: dict[Box, str] = {
    "inbox": "cm.accepted_at IS NOT NULL",
    "requests": "cm.accepted_at IS NULL",
}
LAST = (
    "JOIN LATERAL (SELECT m.id, m.text, m.created_at, m.sender_id"
    " FROM messages m WHERE m.conversation_id = cm.conversation_id"
    f" AND {SEEN} ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last ON true"
)


def _box(box: Box) -> str:
    return (
        "conversation_members cm"
        " JOIN users u ON u.id = cm.other_id"
        " LEFT JOIN profile_photos p ON p.user_id = u.id"
        f" {LAST}"
        f" WHERE cm.user_id = %s AND {BOX_OF[box]}"
        f" AND NOT {apart_sql('cm.user_id', 'cm.other_id')}"
    )


def _cursor(at: datetime, key: UUID) -> str:
    return f"{(at - EPOCH) // MICROSECOND}-{key.hex}"


def _after_cursor(cursor: str) -> tuple[datetime, UUID]:
    micros, key = cursor.split("-")
    return EPOCH + int(micros) * MICROSECOND, UUID(key)


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


def _pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def _member(conn: Connection[DictRow], user_id: int, other: int) -> DictRow | None:
    """The row of `user_id` in its conversation with `other`; None without
    one."""
    return conn.execute(
        "SELECT conversation_id, accepted_at, cleared_at, read_at"
        " FROM conversation_members WHERE user_id = %s AND other_id = %s",
        (user_id, other),
    ).fetchone()


def _state(conn: Connection[DictRow], user_id: int, other: int) -> State:
    """Where `user_id` stands towards `other`: the comment of State."""
    mine, theirs = _member(conn, user_id, other), _member(conn, other, user_id)
    if mine is not None and mine["accepted_at"] is None:
        asked = conn.execute(
            "SELECT 1 FROM messages m JOIN conversation_members cm"
            " ON cm.conversation_id = m.conversation_id AND cm.user_id = %s"
            f" WHERE m.conversation_id = %s AND m.sender_id = %s AND {SEEN}",
            (user_id, mine["conversation_id"], other),
        ).fetchone()
        if asked is not None:
            return "request"
    if theirs is not None and theirs["accepted_at"] is not None:
        return "open"
    followed = conn.execute(
        f"SELECT {follows_sql('%s', '%s')} AS yes", (other, user_id)
    ).fetchone()
    if followed is not None and followed["yes"]:
        return "open"
    if theirs is not None:
        # The one message of a request, still in the other's view.
        pending = conn.execute(
            "SELECT 1 FROM messages WHERE conversation_id = %s AND sender_id = %s"
            " AND (%s::timestamptz IS NULL OR created_at > %s)",
            (
                theirs["conversation_id"],
                user_id,
                theirs["cleared_at"],
                theirs["cleared_at"],
            ),
        ).fetchone()
        if pending is not None:
            return "waiting"
    return "first"


def _other(conn: Connection[DictRow], user_id: int, public_id: str) -> int:
    """The users.id of the member `user_id` writes to: 404 for nobody, or
    one kept apart; 422 for itself."""
    other = _account(conn, public_id)
    if other == user_id:
        raise AccountError(422, "invalid_request", NOT_YOURSELF)
    if _apart(conn, user_id, other):
        raise AccountError(404, "http_error", NO_PROFILE)
    return other


def _person_of(conn: Connection[DictRow], user_id: int) -> PersonBody:
    row = conn.execute(
        f"SELECT {PERSON_COLUMNS} FROM users u"
        " LEFT JOIN profile_photos p ON p.user_id = u.id WHERE u.id = %s",
        (user_id,),
    ).fetchone()
    assert row is not None
    return _person(row)


def _message(row: DictRow, user_id: int) -> MessageBody:
    return MessageBody(
        id=row["id"],
        text=row["text"],
        created_at=row["created_at"],
        mine=row["sender_id"] == user_id,
    )


def _forget_unseen(conn: Connection[DictRow], conversation_id: UUID) -> None:
    """Deletes the messages neither member sees any more: both cleared
    them."""
    conn.execute(
        "DELETE FROM messages m USING (SELECT min(cleared_at) AS until,"
        " count(cleared_at) AS cleared FROM conversation_members"
        " WHERE conversation_id = %s) both_members"
        " WHERE m.conversation_id = %s AND both_members.cleared = 2"
        " AND m.created_at <= both_members.until",
        (conversation_id, conversation_id),
    )


@dataclass(frozen=True)
class Sent:
    """A message kept, and whether it landed as a request."""

    message: MessageBody
    recipient_id: int
    request: bool


@dataclass
class Messages:
    """The conversations and their messages, in the database of the
    accounts."""

    database: Database
    now: Callable[[], datetime]

    def conversations(
        self,
        user_id: int,
        box: Box = "inbox",
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> ConversationsBody:
        """A page of the box's conversations, the latest message first."""
        where = _box(box)
        values: list[Any] = [user_id]
        paged = where
        if cursor is not None:
            paged += " AND (last.created_at, cm.conversation_id) < (%s, %s)"
            values += _after_cursor(cursor)
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT cm.conversation_id, {PERSON_COLUMNS}, last.id,"
                " last.text, last.created_at, last.sender_id,"
                f" {UNREAD} AS unread FROM {paged}"
                " ORDER BY last.created_at DESC, cm.conversation_id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
            count = conn.execute(
                f"SELECT count(*) AS n FROM {where}", (user_id,)
            ).fetchone()
        assert count is not None
        page, more = rows[:limit], len(rows) > limit
        return ConversationsBody(
            conversations=[
                ConversationBody(
                    person=_person(row),
                    last=_message(row, user_id),
                    unread=row["unread"],
                )
                for row in page
            ],
            next=(
                _cursor(page[-1]["created_at"], page[-1]["conversation_id"])
                if more
                else None
            ),
            total=count["n"],
        )

    def unread(self, user_id: int) -> UnreadBody:
        """How many conversations have news, and how many requests wait."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT count(*) FILTER (WHERE cm.accepted_at IS NOT NULL"
                f" AND {UNREAD}) AS unread,"
                " count(*) FILTER (WHERE cm.accepted_at IS NULL) AS requests"
                " FROM conversation_members cm"
                " WHERE cm.user_id = %s"
                f" AND NOT {apart_sql('cm.user_id', 'cm.other_id')}"
                " AND EXISTS (SELECT 1 FROM messages m"
                f" WHERE m.conversation_id = cm.conversation_id AND {SEEN})",
                (user_id,),
            ).fetchone()
        assert row is not None
        return UnreadBody(unread=row["unread"], requests=row["requests"])

    def page(
        self,
        user_id: int,
        public_id: str,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> MessagesBody:
        """A page of the messages with `public_id`, the latest first; none
        before the first one is written."""
        with self.database.connect() as conn:
            other = _other(conn, user_id, public_id)
            person = _person_of(conn, other)
            state = _state(conn, user_id, other)
            mine = _member(conn, user_id, other)
            if mine is None:
                return MessagesBody(person=person, state=state, messages=[], next=None)
            where = f"m.conversation_id = %s AND {SEEN}"
            values: list[Any] = [user_id, mine["conversation_id"]]
            if cursor is not None:
                where += " AND (m.created_at, m.id) < (%s, %s)"
                values += _after_cursor(cursor)
            rows = conn.execute(
                "SELECT m.id, m.text, m.created_at, m.sender_id FROM messages m"
                " JOIN conversation_members cm"
                " ON cm.conversation_id = m.conversation_id AND cm.user_id = %s"
                f" WHERE {where} ORDER BY m.created_at DESC, m.id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
        page, more = rows[:limit], len(rows) > limit
        return MessagesBody(
            person=person,
            state=state,
            messages=[_message(row, user_id) for row in page],
            next=_cursor(page[-1]["created_at"], page[-1]["id"]) if more else None,
        )

    def send(self, user: UserBody, public_id: str, text: str) -> Sent:
        """`text` from `user` to `public_id`: the comment of State says when.
        409 while a request waits; 422 for a text refused, or a request's
        negative one."""
        kept = checked_text(text)
        now = self.now()
        try:
            with self.database.connect() as conn:
                other = _other(conn, user.id, public_id)
                low, high = _pair(user.id, other)
                conn.execute(
                    "INSERT INTO conversations (low_id, high_id, created_at)"
                    " VALUES (%s, %s, %s) ON CONFLICT (low_id, high_id) DO NOTHING",
                    (low, high, now),
                )
                # One writer at a time in a conversation: two requests sent
                # together are still one.
                row = conn.execute(
                    "SELECT id FROM conversations WHERE low_id = %s AND high_id = %s"
                    " FOR UPDATE",
                    (low, high),
                ).fetchone()
                assert row is not None
                conversation_id: UUID = row["id"]
                conn.execute(
                    "INSERT INTO conversation_members"
                    " (conversation_id, user_id, other_id)"
                    " VALUES (%s, %s, %s), (%s, %s, %s) ON CONFLICT DO NOTHING",
                    (conversation_id, user.id, other, conversation_id, other, user.id),
                )
                state = _state(conn, user.id, other)
                if state == "waiting":
                    raise AccountError(409, "http_error", WAITING)
                if state == "first":
                    reason = check_comment(kept)
                    if reason is not None:
                        raise MessageRejected(reason)
                kept_row = conn.execute(
                    "INSERT INTO messages"
                    " (conversation_id, sender_id, text, created_at)"
                    " VALUES (%s, %s, %s, %s)"
                    " RETURNING id, text, created_at, sender_id",
                    (conversation_id, user.id, kept, now),
                ).fetchone()
                assert kept_row is not None
                # Writing accepts: a reply to a request, or the first message.
                conn.execute(
                    "UPDATE conversation_members SET read_at = %s,"
                    " accepted_at = COALESCE(accepted_at, %s)"
                    " WHERE conversation_id = %s AND user_id = %s",
                    (now, now, conversation_id, user.id),
                )
                if state == "open":
                    # Who follows the writer has it in «Messages» from now on.
                    conn.execute(
                        "UPDATE conversation_members SET accepted_at = %s"
                        " WHERE conversation_id = %s AND user_id = %s"
                        " AND accepted_at IS NULL",
                        (now, conversation_id, other),
                    )
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while it was writing.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN) from None
        return Sent(_message(kept_row, user.id), other, state == "first")

    def accept(self, user_id: int, public_id: str) -> bool:
        """The other's request accepted: the two write freely. False when
        there is no conversation to accept."""
        with self.database.connect() as conn:
            other = _other(conn, user_id, public_id)
            row = conn.execute(
                "UPDATE conversation_members"
                " SET accepted_at = COALESCE(accepted_at, %s)"
                " WHERE user_id = %s AND other_id = %s RETURNING 1",
                (self.now(), user_id, other),
            ).fetchone()
        return row is not None

    def read(self, user_id: int, public_id: str) -> None:
        """The conversation read up to now; nothing without one."""
        with self.database.connect() as conn:
            other = _other(conn, user_id, public_id)
            conn.execute(
                "UPDATE conversation_members SET read_at = %s"
                " WHERE user_id = %s AND other_id = %s",
                (self.now(), user_id, other),
            )

    def clear(self, user_id: int, public_id: str) -> None:
        """The conversation out of `user_id`'s view, up to now: a request
        deleted, or a conversation. Whether the other may write freely does
        not change; the messages neither sees any more are deleted."""
        with self.database.connect() as conn:
            other = _account(conn, public_id)
            row = conn.execute(
                "UPDATE conversation_members SET cleared_at = %s, read_at = %s"
                " WHERE user_id = %s AND other_id = %s RETURNING conversation_id",
                (self.now(), self.now(), user_id, other),
            ).fetchone()
            if row is not None:
                _forget_unseen(conn, row["conversation_id"])

    def delete(
        self, user_id: int, message_id: str
    ) -> Literal["deleted", "not_yours"] | None:
        """Deletes the message when `user_id` wrote it; "not_yours" when it
        only sees it; None when it does not, as for an id that is not
        there."""
        wanted = _uuid(message_id)
        if wanted is None:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT m.sender_id, cm.user_id AS reader FROM messages m"
                " JOIN conversation_members cm"
                " ON cm.conversation_id = m.conversation_id AND cm.user_id = %s"
                f" WHERE m.id = %s AND {SEEN}"
                f" AND NOT {apart_sql('cm.user_id', 'cm.other_id')}",
                (user_id, wanted),
            ).fetchone()
            if row is None:
                return None
            if row["sender_id"] != user_id:
                return "not_yours"
            conn.execute("DELETE FROM messages WHERE id = %s", (wanted,))
        return "deleted"

    def on_block(self, conn: Connection[DictRow], blocker: int, blocked: int) -> None:
        """A block deletes the conversation of the two, as it ends their
        follows (moderation.py): unblocking brings nothing back."""
        low, high = _pair(blocker, blocked)
        conn.execute(
            "DELETE FROM conversations WHERE low_id = %s AND high_id = %s",
            (low, high),
        )


def messages_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Messages:
    """In the database of the accounts, on the same clock."""
    return Messages(accounts.database, accounts.now)


Them = Annotated[Messages, Depends(messages_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}


def message_routes() -> APIRouter:
    router = APIRouter(tags=["messages"], responses=ACCOUNT_ERRORS)
    # Per account, as the comments: one person, one limit.
    written = RateLimiter(MAX_MESSAGES_PER_MINUTE)

    @router.get("/me/conversations")
    def conversations(
        messages: Them,
        user: Me,
        box: Box = "inbox",
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> ConversationsBody:
        return messages.conversations(user.id, box, limit, cursor)

    @router.get("/me/conversations/unread")
    def unread(messages: Them, user: Me) -> UnreadBody:
        return messages.unread(user.id)

    @router.get("/conversations/{public_id}/messages", responses=NOT_FOUND)
    def conversation(
        public_id: str,
        messages: Them,
        user: Me,
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> MessagesBody:
        return messages.page(user.id, public_id, limit, cursor)

    @router.post(
        "/conversations/{public_id}/messages",
        status_code=201,
        responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}},
    )
    def send(
        public_id: str,
        body: MessageRequestBody,
        messages: Them,
        user: Me,
        request: Request,
    ) -> MessageBody:
        wait = written.wait_s(str(user.id))
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_MESSAGES, math.ceil(wait)
            )
        sent = messages.send(user, public_id, body.text)
        pushed_message(request, user, sent)
        return sent.message

    @router.put(
        "/conversations/{public_id}/accept", status_code=204, responses=NOT_FOUND
    )
    def accept(public_id: str, messages: Them, user: Me) -> Response:
        if not messages.accept(user.id, public_id):
            raise HTTPException(404, NO_CONVERSATION)
        return Response(status_code=204)

    @router.put("/conversations/{public_id}/read", status_code=204, responses=NOT_FOUND)
    def read(public_id: str, messages: Them, user: Me) -> Response:
        messages.read(user.id, public_id)
        return Response(status_code=204)

    @router.delete("/conversations/{public_id}", status_code=204, responses=NOT_FOUND)
    def clear(public_id: str, messages: Them, user: Me) -> Response:
        messages.clear(user.id, public_id)
        return Response(status_code=204)

    @router.delete(
        "/messages/{message_id}",
        status_code=204,
        responses={403: {"model": ErrorBody}, 404: {"model": ErrorBody}},
    )
    def delete_message(message_id: str, messages: Them, user: Me) -> Response:
        deleted = messages.delete(user.id, message_id)
        if deleted is None:
            raise HTTPException(404, NO_MESSAGE)
        if deleted == "not_yours":
            raise HTTPException(403, NOT_YOUR_MESSAGE)
        return Response(status_code=204)

    return router


def install_messages(app: FastAPI) -> None:
    """The private messages; after install_accounts, which sets the database
    and the errors, and install_moderation, whose blocks delete a
    conversation."""
    accounts: Accounts | None = app.state.accounts
    if accounts is not None:
        on_block: list[Any] | None = getattr(app.state, "on_block", None)
        if on_block is not None:
            on_block.append(Messages(accounts.database, accounts.now).on_block)
    app.add_exception_handler(MessageRejected, rejected_answer)
    app.include_router(message_routes())


# --- Push notifications (TASK-262, ADR-0226) ---


def pushed_message(request: Request, user: UserBody, sent: Sent) -> None:
    """After a message is kept: the other is told (push.py). Each message
    with its beginning; a request without its text, once a day."""
    if sent.request:
        notify(request, PushEvent("message_request", user.id, sent.recipient_id))
    else:
        notify(
            request,
            PushEvent(
                "message",
                user.id,
                sent.recipient_id,
                text=sent.message.text,
                key=str(sent.message.id),
            ),
        )
