"""The bell's list: what push.py told an account, kept for it to read in
the app (TASK-367 part C, ADR-0311, docs/API.md, «The bell»).

push.py hands each event it lets through (not one's own but for its own
kinds, the first of the day) to `record`: a row in notifications, whatever
the switches of «Settings» say, since the list is read in the app and not
sent. The private messages are not kept: they have their own tab. The same
event again (a reaction changed, a group run changed twice) takes the place
of the one before, unread and on top.

GET /notifications reads the account's rows, the newest first, PAGE_SIZE at
a time, with how many are unread. Each has the push's text in the account's
language (the sign-up's, then the phone's, then English), who acted, and
what the app opens when it is touched: push.py's data_of, the same as the
push's. What is no longer true is left out, as in the email of the notices:
a request withdrawn, a follow ended, a reaction taken back, a comment
deleted or hidden, a tag removed, a drawing no longer seen, and anything
across a block or from an account hidden from a report.

POST /notifications/read marks read every row up to the newest the app
showed: one that came after stays unread. A row goes KEPT_DAYS after its
event, with its account, with the account who acted, with the drawing or
the comment.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Any, get_args
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query, Response
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    Accounts,
    Language,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.away_email import language_sql
from shaperoute_api.db import Database
from shaperoute_api.drawings import drawing_seen_sql
from shaperoute_api.follows import PERSON_COLUMNS, PersonBody, _person, apart_sql
from shaperoute_api.push import Kind, PushEvent, data_of, text_of

log = logging.getLogger(__name__)

# Every kind push.py tells but the private messages'.
BELL_KINDS: frozenset[str] = frozenset(get_args(Kind)) - {"message", "message_request"}
KEPT_DAYS = 90
PAGE_SIZE = 30


# --- What is kept ---


def same_of(event: PushEvent) -> str:
    """What tells this event from another of its kind between the same two
    accounts: the same again replaces it."""
    parts = (
        event.drawing_id,
        event.key,
        event.challenge_id,
        event.group_run_id,
        event.contest_id,
        event.number,
    )
    return "|".join("" if part is None else str(part) for part in parts)


def extra_of(event: PushEvent) -> dict[str, Any]:
    """The rest of the event, as JSON: what its text and its data need that
    the row's columns do not hold."""
    extra: dict[str, Any] = {}
    if event.text is not None and event.kind != "comment":
        extra["text"] = event.text
    if event.number is not None:
        extra["number"] = event.number
    if event.names is not None:
        extra["names"] = dict(event.names)
    for name in ("challenge_id", "group_run_id", "contest_id"):
        value = getattr(event, name)
        if value is not None:
            extra[name] = str(value)
    return extra


def _uuid(value: object) -> UUID | None:
    try:
        return None if value is None else UUID(str(value))
    except ValueError:
        return None


RECORD_SQL = (
    "INSERT INTO notifications"
    " (recipient_id, actor_id, kind, drawing_id, comment_id, same, extra, at)"
    " VALUES (%(recipient)s, %(actor)s, %(kind)s, %(drawing)s, %(comment)s,"
    " %(same)s, %(extra)s, %(at)s)"
    " ON CONFLICT DO NOTHING"
)

# The events of %(reader)s since %(since)s that are still true, with who
# acted, for a reaction its kind now, for a comment its text now.
SHOWN_SQL = (
    "SELECT n.id, n.kind, n.drawing_id, n.extra, n.at, n.read_at,"
    f" {PERSON_COLUMNS}, re.kind AS reaction,"
    " COALESCE(c.text, heart.text) AS comment_text"
    " FROM notifications n JOIN users u ON u.id = n.actor_id"
    " LEFT JOIN profile_photos p ON p.user_id = u.id"
    " LEFT JOIN reactions re ON n.kind = 'reaction'"
    " AND re.drawing_id = n.drawing_id AND re.user_id = n.actor_id"
    " LEFT JOIN comments c ON c.id = n.comment_id"
    # A super like's words: the comment written with it (reactions.py).
    " LEFT JOIN LATERAL (SELECT h.text FROM comments h"
    " WHERE re.kind = 'super_like' AND h.drawing_id = re.drawing_id"
    " AND h.user_id = re.user_id AND h.created_at = re.created_at"
    " AND h.hidden_at IS NULL"
    " LIMIT 1) heart ON true"
    " WHERE n.recipient_id = %(reader)s AND n.at > %(since)s"
    f" AND NOT {apart_sql('%(reader)s', 'n.actor_id')}"
    " AND CASE n.kind"
    " WHEN 'follow_request' THEN EXISTS (SELECT 1 FROM follows f"
    " WHERE f.follower_id = n.actor_id AND f.followed_id = n.recipient_id"
    " AND f.status = 'pending')"
    " WHEN 'follow_accepted' THEN EXISTS (SELECT 1 FROM follows f"
    " WHERE f.follower_id = n.recipient_id AND f.followed_id = n.actor_id"
    " AND f.status = 'accepted')"
    " WHEN 'reaction' THEN re.user_id IS NOT NULL"
    " WHEN 'comment' THEN c.id IS NOT NULL AND c.hidden_at IS NULL"
    " WHEN 'tag' THEN EXISTS (SELECT 1 FROM drawing_tags t"
    " WHERE t.drawing_id = n.drawing_id AND t.user_id = n.recipient_id)"
    " ELSE true END"
    " AND (n.drawing_id IS NULL OR EXISTS (SELECT 1 FROM drawings d"
    " JOIN runs r ON r.id = d.run_id WHERE d.id = n.drawing_id"
    f" AND {drawing_seen_sql('%(reader)s')}))"
)

PAGE_SQL = (
    f"SELECT * FROM ({SHOWN_SQL}) shown"
    " WHERE %(before)s::bigint IS NULL OR shown.id < %(before)s"
    " ORDER BY shown.id DESC LIMIT %(limit)s"
)

UNREAD_SQL = (
    f"SELECT count(*) AS n FROM ({SHOWN_SQL}) shown WHERE shown.read_at IS NULL"
)


# --- The answers ---


class NotificationBody(BaseModel):
    """One line of the bell: packages/shared-types/fixtures/notifications.json."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(description="Ascending: a newer line has a larger id.")
    kind: str = Field(description="push.py's kind: reaction, comment, tag, …")
    text: str = Field(description="The push's text, in the account's language.")
    at: datetime
    read: bool
    actor: PersonBody = Field(
        description="Who acted; the account itself for its own kinds."
    )
    opens: dict[str, str] = Field(
        description="What the app opens when it is touched: the push's data."
    )


class NotificationsBody(BaseModel):
    """GET /notifications: the newest first, with how many are unread."""

    model_config = ConfigDict(extra="forbid")

    notifications: list[NotificationBody]
    unread: int = Field(ge=0)
    before: int | None = Field(
        description="Ask with ?before= for the next page; null at the end."
    )


class ReadRequestBody(BaseModel):
    """POST /notifications/read: the newest line the app showed."""

    model_config = ConfigDict(extra="forbid")

    up_to: int = Field(ge=1)


def line_text(event: PushEvent, name: str, language: Language) -> str:
    """The push of the event, in `language`."""
    line = text_of(event, name, language)
    if event.text or not line.rstrip().endswith(":"):
        return line
    # A super like whose words are gone: the heart alone (notice_email.py).
    return line.rstrip().rstrip(":").rstrip() + "."


def notification_of(row: Mapping[str, Any], language: Language) -> NotificationBody:
    extra: Mapping[str, Any] = row["extra"] or {}
    text = row["comment_text"] if row["kind"] in ("comment", "reaction") else None
    event = PushEvent(
        row["kind"],
        0,
        0,
        drawing_id=row["drawing_id"],
        reaction=row["reaction"],
        text=text if text is not None else extra.get("text"),
        challenge_id=_uuid(extra.get("challenge_id")),
        number=extra.get("number"),
        names=extra.get("names"),
        group_run_id=_uuid(extra.get("group_run_id")),
        contest_id=_uuid(extra.get("contest_id")),
    )
    actor = _person(row)  # type: ignore[arg-type]
    return NotificationBody(
        id=row["id"],
        kind=row["kind"],
        text=line_text(event, actor.username, language),
        at=row["at"],
        read=row["read_at"] is not None,
        actor=actor,
        opens=data_of(event, actor.public_id, actor.username),
    )


# --- In the database ---


@dataclass
class NotificationList:
    """The bell's rows, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def record(self, event: PushEvent) -> None:
        """One event push.py lets through; the rows too old go with it."""
        if event.kind not in BELL_KINDS:
            return
        at = self.now()
        values = {
            "recipient": event.recipient_id,
            "actor": event.actor_id,
            "kind": event.kind,
            "drawing": event.drawing_id,
            "comment": _uuid(event.key) if event.kind == "comment" else None,
            "same": same_of(event),
            "extra": Jsonb(extra_of(event)),
            "at": at,
        }
        with self.database.connect() as conn, conn.transaction():
            conn.execute(
                "DELETE FROM notifications WHERE at <= %s",
                (at - timedelta(days=KEPT_DAYS),),
            )
            conn.execute(
                "DELETE FROM notifications WHERE recipient_id = %(recipient)s"
                " AND actor_id = %(actor)s AND kind = %(kind)s AND same = %(same)s",
                values,
            )
            conn.execute(RECORD_SQL, values)

    def page(self, reader_id: int, before: int | None) -> NotificationsBody:
        params = {
            "reader": reader_id,
            "since": self.now() - timedelta(days=KEPT_DAYS),
            "before": before,
            "limit": PAGE_SIZE + 1,
        }
        with self.database.connect() as conn:
            language = conn.execute(
                f"SELECT {language_sql('u')} AS language FROM users u WHERE u.id = %s",
                (reader_id,),
            ).fetchone()
            rows: list[DictRow] = conn.execute(PAGE_SQL, params).fetchall()
            unread = conn.execute(UNREAD_SQL, params).fetchone()
        said: Language = "en" if language is None else language["language"]
        shown = rows[:PAGE_SIZE]
        return NotificationsBody(
            notifications=[notification_of(row, said) for row in shown],
            unread=0 if unread is None else int(unread["n"]),
            before=shown[-1]["id"] if len(rows) > PAGE_SIZE else None,
        )

    def read(self, reader_id: int, up_to: int) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE notifications SET read_at = %s"
                " WHERE recipient_id = %s AND id <= %s AND read_at IS NULL",
                (self.now(), reader_id, up_to),
            )


# --- The endpoints ---


def notification_list_of(
    accounts: Annotated[Accounts, Depends(accounts_of)],
) -> NotificationList:
    """In the database of the accounts, on the same clock."""
    return NotificationList(accounts.database, accounts.now)


Bell = Annotated[NotificationList, Depends(notification_list_of)]
Me = Annotated[UserBody, Depends(current_user)]


def notification_list_routes() -> APIRouter:
    router = APIRouter(tags=["notifications"], responses=ACCOUNT_ERRORS)

    @router.get("/notifications")
    def notifications(
        bell: Bell,
        user: Me,
        before: Annotated[int | None, Query(ge=1)] = None,
    ) -> NotificationsBody:
        return bell.page(user.id, before)

    @router.post("/notifications/read", status_code=204)
    def read_notifications(body: ReadRequestBody, bell: Bell, user: Me) -> Response:
        bell.read(user.id, body.up_to)
        return Response(status_code=204)

    return router


def install_notification_list(app: FastAPI) -> None:
    """After install_push: push.py hands its events to the list, and the
    list is read here. Without a database, nothing is kept: the endpoints
    answer 503 as the others of the accounts."""
    accounts: Accounts | None = app.state.accounts
    pusher = getattr(app.state, "pusher", None)
    if accounts is not None and pusher is not None:
        bell = NotificationList(accounts.database, accounts.now)
        pusher.listeners.append(bell.record)
    app.include_router(notification_list_routes())
