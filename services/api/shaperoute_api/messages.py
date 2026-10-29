"""Private messages between two members, with message requests (TASK-319,
ADR-0279, docs/API.md, «Messages»).

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

A message of a conversation `open` to its writer may carry one attachment
(TASK-333, ADR-0289): a photo or a video uploaded first (message_media.py,
files on disk), or a drawing, a copy of the route as a favorite keeps it.
With one the text may be empty. A request is text only (409). An app that
does not ask `?with=attachments` reads «[Photo]», «[Video]» or «[Drawing]»
before the text instead.
"""

from __future__ import annotations

import math
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Annotated, Any, Literal
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
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, model_validator

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
from shaperoute_api.favorites import FavoriteRequestBody
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
from shaperoute_api.recommended import preview
from shaperoute_api.schemas import MAX_IMAGE_BYTES, ErrorBody, ErrorDetail

if TYPE_CHECKING:
    # Not at run time: message_media.py reads SEEN here.
    from shaperoute_api.message_media import MessageMedia

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

# The attachments (TASK-333, ADR-0289): the user's limits of 2026-10-29.
AttachmentKind = Literal["photo", "video", "drawing"]
VIDEO_MAX_S = 60
VIDEO_MAX_BYTES = 40_000_000
# A photo before the API makes it smaller: as the photos of the drawings.
PHOTO_MAX_BYTES = MAX_IMAGE_BYTES
# A video is kept this long after its message, then «This video has expired».
VIDEO_DAYS = 30
# What an app that does not ask ?with=attachments reads before the text.
OLD_APP_LABELS: dict[str, str] = {
    "photo": "[Photo]",
    "video": "[Video]",
    "drawing": "[Drawing]",
}
WITH_ATTACHMENTS = "attachments"

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
ATTACHMENT_IN_REQUEST = (
    "Photos, videos and drawings can be sent once they accept your message."
)
NO_UPLOAD = "No photo or video with this id to send: upload it again."
NO_DRAWING = "No drawing in a message with this id."


def checked_text(value: str, attached: bool = False) -> str:
    """The message as kept: without spaces at either end; or 422 saying
    what is wrong with it. New lines stay. Empty only with an attachment."""
    text = value.strip()
    if not text and not attached:
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


class MessageAttachmentRequestBody(BaseModel):
    """What a message carries: a photo or a video uploaded with POST
    /me/message-media, or a drawing; one of the two."""

    model_config = ConfigDict(extra="forbid")

    media_id: UUID | None = None
    drawing: FavoriteRequestBody | None = None
    """The route as PUT /me/favorites/{key} takes it."""

    @model_validator(mode="after")
    def one_of_the_two(self) -> MessageAttachmentRequestBody:
        if (self.media_id is None) == (self.drawing is None):
            raise ValueError("attachment: a media_id or a drawing, one of the two")
        return self


class MessageRequestBody(BaseModel):
    """POST /conversations/{public_id}/messages:
    packages/shared-types/fixtures/message-request.json, and with an
    attachment message-attachment-request.json."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        default="",
        description=(
            f"1 to {MAX_MESSAGE_LENGTH} characters once the spaces at either end"
            " are gone; new lines are kept. May be empty with an attachment."
        ),
    )
    attachment: MessageAttachmentRequestBody | None = None


LatLon = tuple[float, float]


class DrawingCardBody(BaseModel):
    """A drawing as the conversation shows it; GET /messages/{id}/drawing
    has it whole."""

    title: str | None
    shape: str | None
    word: str | None
    style: Literal["round", "block"] | None
    distance_m: int
    route_m: int
    activity: str
    rotation_deg: float | None
    preview: list[LatLon]
    """At most 64 points of its line."""


class AttachmentBody(BaseModel):
    """What a message carries besides its text."""

    kind: AttachmentKind
    media_id: UUID | None
    """A photo's or a video's: GET /message-media/{media_id}. Null for a
    drawing and for a video expired."""
    width: int | None
    height: int | None
    duration_ms: int | None
    """A video's length."""
    poster: bool
    """A video's first picture: GET /message-media/{media_id}/poster."""
    expired: bool
    """A video VIDEO_DAYS after its message: gone from the server."""
    drawing: DrawingCardBody | None


class MessageBody(BaseModel):
    """One message, as who asks sees it:
    packages/shared-types/fixtures/message.json."""

    id: UUID
    text: str
    created_at: datetime
    mine: bool
    """Who asks wrote it, and may delete it."""
    attachment: AttachmentBody | None
    """Null for text only (TASK-333)."""


class AttachmentsAllowedBody(BaseModel):
    """What who asks may attach in this conversation now."""

    kinds: list[AttachmentKind]
    """"video" leaves while the server is full of them."""
    video_max_s: int
    video_max_bytes: int
    photo_max_bytes: int


class MessagesBody(BaseModel):
    """GET /conversations/{public_id}/messages: a page, the latest first:
    packages/shared-types/fixtures/messages.json."""

    person: PersonBody
    state: State
    messages: list[MessageBody]
    next: str | None
    """The `cursor` of the page of older ones; null on the oldest."""
    attachments: AttachmentsAllowedBody | None
    """Null outside an `open` conversation: a request is text only. An API
    before TASK-333 has no field, and the app shows no «+»."""


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
# A message with its attachment (TASK-333): `m` with `mm`, its photo or
# video if it has one.
MESSAGE_COLUMNS = (
    "m.id, m.text, m.created_at, m.sender_id, m.attachment, m.drawing_card,"
    " mm.id AS media_id, mm.width, mm.height, mm.duration_ms, mm.poster_bytes,"
    " mm.stored"
)
WITH_MEDIA = "LEFT JOIN message_media mm ON mm.message_id = m.id"
LAST = (
    f"JOIN LATERAL (SELECT {MESSAGE_COLUMNS} FROM messages m {WITH_MEDIA}"
    " WHERE m.conversation_id = cm.conversation_id"
    f" AND {SEEN} ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last ON true"
)
LAST_COLUMNS = (
    "last.id, last.text, last.created_at, last.sender_id, last.attachment,"
    " last.drawing_card, last.media_id, last.width, last.height,"
    " last.duration_ms, last.poster_bytes, last.stored"
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


def expired(created_at: datetime, now: datetime) -> bool:
    """A video's message older than VIDEO_DAYS: its file is gone, or goes
    at the next round."""
    return created_at <= now - timedelta(days=VIDEO_DAYS)


def _attachment(row: DictRow, now: datetime) -> AttachmentBody | None:
    kind: AttachmentKind | None = row["attachment"]
    if kind is None:
        return None
    if kind == "drawing":
        return AttachmentBody(
            kind=kind,
            media_id=None,
            width=None,
            height=None,
            duration_ms=None,
            poster=False,
            expired=False,
            drawing=DrawingCardBody.model_validate(row["drawing_card"]),
        )
    gone = kind == "video" and (not row["stored"] or expired(row["created_at"], now))
    return AttachmentBody(
        kind=kind,
        media_id=None if gone else row["media_id"],
        width=row["width"],
        height=row["height"],
        duration_ms=row["duration_ms"],
        poster=not gone and row["poster_bytes"] is not None,
        expired=gone,
        drawing=None,
    )


def _message(
    row: DictRow, user_id: int, now: datetime, with_attachments: bool = True
) -> MessageBody:
    text: str = row["text"]
    kind = row["attachment"]
    if kind is not None and not with_attachments:
        # An app of before reads its text only.
        text = f"{OLD_APP_LABELS[kind]} {text}".rstrip()
    return MessageBody(
        id=row["id"],
        text=text,
        created_at=row["created_at"],
        mine=row["sender_id"] == user_id,
        attachment=_attachment(row, now),
    )


def drawing_card(drawing: FavoriteRequestBody) -> DrawingCardBody:
    """The drawing as the conversation shows it."""
    return DrawingCardBody(
        title=drawing.title,
        shape=drawing.shape,
        word=drawing.word,
        style=drawing.style,
        distance_m=drawing.distance_m,
        route_m=drawing.route_m,
        activity=drawing.activity,
        rotation_deg=drawing.rotation_deg,
        preview=preview(drawing.points),
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
    attachment: AttachmentKind | None = None
    text: str = ""
    """As written, for the push: without what an app of before reads."""


@dataclass
class Messages:
    """The conversations and their messages, in the database of the
    accounts."""

    database: Database
    now: Callable[[], datetime]
    # The photos and videos (message_media.py, TASK-333): None on a server
    # without their folder, where only drawings are attached.
    media: MessageMedia | None = None

    def conversations(
        self,
        user_id: int,
        box: Box = "inbox",
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
        with_attachments: bool = True,
    ) -> ConversationsBody:
        """A page of the box's conversations, the latest message first."""
        where = _box(box)
        values: list[Any] = [user_id]
        paged = where
        if cursor is not None:
            paged += " AND (last.created_at, cm.conversation_id) < (%s, %s)"
            values += _after_cursor(cursor)
        now = self.now()
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT cm.conversation_id, {PERSON_COLUMNS}, {LAST_COLUMNS},"
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
                    last=_message(row, user_id, now, with_attachments),
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

    def allowed(self, state: State) -> AttachmentsAllowedBody | None:
        """What may be attached now: nothing outside an `open`
        conversation; a drawing always; a photo and a video with the
        folder, a video while the server has room for it."""
        if state != "open":
            return None
        kinds: list[AttachmentKind] = (
            [] if self.media is None else self.media.kinds()
        ) + ["drawing"]
        return AttachmentsAllowedBody(
            kinds=kinds,
            video_max_s=VIDEO_MAX_S,
            video_max_bytes=VIDEO_MAX_BYTES,
            photo_max_bytes=PHOTO_MAX_BYTES,
        )

    def page(
        self,
        user_id: int,
        public_id: str,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
        with_attachments: bool = True,
    ) -> MessagesBody:
        """A page of the messages with `public_id`, the latest first; none
        before the first one is written."""
        now = self.now()
        with self.database.connect() as conn:
            other = _other(conn, user_id, public_id)
            person = _person_of(conn, other)
            state = _state(conn, user_id, other)
            mine = _member(conn, user_id, other)
            if mine is None:
                return MessagesBody(
                    person=person,
                    state=state,
                    messages=[],
                    next=None,
                    attachments=self.allowed(state),
                )
            where = f"m.conversation_id = %s AND {SEEN}"
            values: list[Any] = [user_id, mine["conversation_id"]]
            if cursor is not None:
                where += " AND (m.created_at, m.id) < (%s, %s)"
                values += _after_cursor(cursor)
            rows = conn.execute(
                f"SELECT {MESSAGE_COLUMNS} FROM messages m {WITH_MEDIA}"
                " JOIN conversation_members cm"
                " ON cm.conversation_id = m.conversation_id AND cm.user_id = %s"
                f" WHERE {where} ORDER BY m.created_at DESC, m.id DESC LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
        page, more = rows[:limit], len(rows) > limit
        return MessagesBody(
            person=person,
            state=state,
            messages=[_message(row, user_id, now, with_attachments) for row in page],
            next=_cursor(page[-1]["created_at"], page[-1]["id"]) if more else None,
            attachments=self.allowed(state),
        )

    def send(
        self,
        user: UserBody,
        public_id: str,
        text: str,
        attachment: MessageAttachmentRequestBody | None = None,
        with_attachments: bool = True,
    ) -> Sent:
        """`text` from `user` to `public_id`: the comment of State says when.
        409 while a request waits, or for an attachment outside an `open`
        conversation; 404 for a photo or video not uploaded by `user`, or
        sent already; 422 for a text refused, or a request's negative one."""
        kept = checked_text(text, attached=attachment is not None)
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
                if attachment is not None and state != "open":
                    raise AccountError(409, "http_error", ATTACHMENT_IN_REQUEST)
                if state == "first":
                    reason = check_comment(kept)
                    if reason is not None:
                        raise MessageRejected(reason)
                kind: AttachmentKind | None = None
                drawing = None if attachment is None else attachment.drawing
                if attachment is not None and attachment.media_id is not None:
                    upload = conn.execute(
                        "SELECT kind FROM message_media WHERE id = %s"
                        " AND owner_id = %s AND message_id IS NULL AND stored"
                        " FOR UPDATE",
                        (attachment.media_id, user.id),
                    ).fetchone()
                    if upload is None:
                        raise AccountError(404, "http_error", NO_UPLOAD)
                    kind = upload["kind"]
                elif drawing is not None:
                    kind = "drawing"
                inserted = conn.execute(
                    "INSERT INTO messages (conversation_id, sender_id, text,"
                    " created_at, attachment, drawing, drawing_card)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                    (
                        conversation_id,
                        user.id,
                        kept,
                        now,
                        kind,
                        (
                            None
                            if drawing is None
                            else Jsonb(drawing.model_dump(mode="json"))
                        ),
                        (
                            None
                            if drawing is None
                            else Jsonb(drawing_card(drawing).model_dump(mode="json"))
                        ),
                    ),
                ).fetchone()
                assert inserted is not None
                if attachment is not None and attachment.media_id is not None:
                    conn.execute(
                        "UPDATE message_media SET message_id = %s WHERE id = %s",
                        (inserted["id"], attachment.media_id),
                    )
                kept_row = conn.execute(
                    f"SELECT {MESSAGE_COLUMNS} FROM messages m {WITH_MEDIA}"
                    " WHERE m.id = %s",
                    (inserted["id"],),
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
        return Sent(
            _message(kept_row, user.id, now, with_attachments),
            other,
            state == "first",
            kind,
            kept,
        )

    def drawing(self, user_id: int, message_id: str) -> FavoriteRequestBody | None:
        """The drawing of a message whole, for a member who sees the
        message; None otherwise, as for an id that is not there."""
        wanted = _uuid(message_id)
        if wanted is None:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT m.drawing FROM messages m JOIN conversation_members cm"
                " ON cm.conversation_id = m.conversation_id AND cm.user_id = %s"
                f" WHERE m.id = %s AND m.drawing IS NOT NULL AND {SEEN}"
                f" AND NOT {apart_sql('cm.user_id', 'cm.other_id')}",
                (user_id, wanted),
            ).fetchone()
        return (
            None if row is None else FavoriteRequestBody.model_validate(row["drawing"])
        )

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


def messages_of(
    accounts: Annotated[Accounts, Depends(accounts_of)], request: Request
) -> Messages:
    """In the database of the accounts, on the same clock, with the photos
    and videos when the server has their folder."""
    media: MessageMedia | None = getattr(request.app.state, "message_media", None)
    return Messages(accounts.database, accounts.now, media)


Them = Annotated[Messages, Depends(messages_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}
# ?with=attachments: an app that shows them (TASK-333); without, the text
# of a message says «[Photo]» and the like before it.
With = Annotated[str | None, Query(alias="with", pattern=f"^{WITH_ATTACHMENTS}$")]


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
        with_: With = None,
    ) -> ConversationsBody:
        return messages.conversations(user.id, box, limit, cursor, with_ is not None)

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
        with_: With = None,
    ) -> MessagesBody:
        return messages.page(user.id, public_id, limit, cursor, with_ is not None)

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
        with_: With = None,
    ) -> MessageBody:
        wait = written.wait_s(str(user.id))
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_MESSAGES, math.ceil(wait)
            )
        sent = messages.send(
            user, public_id, body.text, body.attachment, with_ is not None
        )
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

    @router.get("/messages/{message_id}/drawing", responses=NOT_FOUND)
    def message_drawing(
        message_id: str, messages: Them, user: Me
    ) -> FavoriteRequestBody:
        drawing = messages.drawing(user.id, message_id)
        if drawing is None:
            raise HTTPException(404, NO_DRAWING)
        return drawing

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
    with its beginning and what it carries; a request without its text,
    once a day."""
    if sent.request:
        notify(request, PushEvent("message_request", user.id, sent.recipient_id))
    else:
        notify(
            request,
            PushEvent(
                "message",
                user.id,
                sent.recipient_id,
                text=sent.text,
                key=str(sent.message.id),
                attachment=sent.attachment,
            ),
        )
