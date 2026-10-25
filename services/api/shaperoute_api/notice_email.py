"""The email of the notices: once a day, what happened to an account with
«Email notifications» on (TASK-262 part B, ADR-0226, docs/API.md, «Notice
emails»).

The five events of the people are push.py's: a follow request, a request
accepted, a reaction, a comment, a tag. push.py hands each one it lets
through (not one's own, the first of the day) to `record`: a row in
email_notices, only for an account with «Email notifications» on
(users.notify_email). Nothing is kept for the others.

Once a day, at NOTICE_EMAIL_AT (UTC), a round writes to each account with
rows one email: the events still true when it is written (a request still
waiting, a follow still there, the reaction, comment or tag still there),
never across a block, a drawing only if the account still sees it. The
lines are the push's, in the account's language as for the away email
(the sign-up's, then the phone's, then English), the newest first.

One email a day at most per account: it is taken first, with an UPDATE of
users.notices_emailed_at that holds only if nothing changed since it was
read and it was not taken today (UTC). Two rounds at once, or a round
after a restart, never send it twice. Resend refusing gives the day back
with the rows: the next round tries again. The rows go once the email is
sent, after KEPT_DAYS anyway, and when the switch is off.

The link «Don't send me these emails» turns «Email notifications» off: a
page like the away email's (away_email.StopLinks with its own purpose, so
neither link stops the other email), open without the API key (access.py).

On with the away email: RESEND_API_KEY, SHAPEROUTE_EMAIL_SECRET and
SHAPEROUTE_DOMAIN (docs/DEPLOY.md, «Email delle notifiche»). The round
starts with the app and stops before the app's end closes the database's
pool (TASK-288 B).

    python -m shaperoute_api.notice_email          # how many would get one now
    python -m shaperoute_api.notice_email --send   # one round, now
"""

from __future__ import annotations

import argparse
import logging
import os
import threading
import time
from collections.abc import AsyncIterator, Callable, Mapping, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from datetime import time as clock_time
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.responses import HTMLResponse
from psycopg import Connection
from psycopg.rows import DictRow

from shaperoute_api.accounts import Language, now_utc
from shaperoute_api.away_email import (
    DOMAIN_VARIABLE,
    KEY_VARIABLE,
    MAX_PER_ROUND,
    MAX_REFUSED,
    MAX_TOKEN_LENGTH,
    OPEN_URL,
    PAGE_HEADERS,
    SECRET_VARIABLE,
    SEND_GAP_S,
    AwayConfigError,
    AwaySetup,
    StopLinks,
    language_sql,
    next_round,
    time_of_day,
)
from shaperoute_api.db import DATABASE_VARIABLE, Database
from shaperoute_api.drawings import drawing_seen_sql
from shaperoute_api.follows import apart_sql
from shaperoute_api.notice_texts import (
    ask_page,
    stopped_page,
    write,
    wrong_link_page,
)
from shaperoute_api.push import PushEvent, text_of
from shaperoute_api.resend_email import Email, Resend

log = logging.getLogger(__name__)

EMAIL_KINDS = frozenset(
    {"follow_request", "follow_accepted", "reaction", "comment", "tag"}
)
STOP_PATH = "/notice-email/stop"
PURPOSE = b"notice-email-stop"
AT_VARIABLE = "NOTICE_EMAIL_AT"
# An hour after the away email's round: Resend takes two emails a second.
DEFAULT_AT = clock_time(18, 0)
KEPT_DAYS = 7
# How long the app's end waits for a round to stop between two emails.
STOP_WAIT_S = 10.0


# --- What the environment says ---


@dataclass(frozen=True)
class NoticeSetup:
    """What the emails need: the away email's Resend and secret, links of
    their own, and the time of the round."""

    resend: Resend
    links: StopLinks
    at: clock_time = DEFAULT_AT

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> NoticeSetup | None:
        """None, emails off, when the away email is off."""
        away = AwaySetup.from_env(environ)
        if away is None:
            return None
        return cls(
            away.resend,
            replace(away.links, purpose=PURPOSE, path=STOP_PATH),
            time_of_day(environ.get(AT_VARIABLE, "").strip(), AT_VARIABLE, DEFAULT_AT),
        )


# --- The events kept, and what is still true of them ---

RECORD_SQL = (
    "INSERT INTO email_notices"
    " (recipient_id, actor_id, kind, drawing_id, comment_id, at)"
    " SELECT u.id, %(actor)s, %(kind)s, %(drawing)s, %(comment)s, %(at)s"
    " FROM users u WHERE u.id = %(recipient)s AND u.notify_email"
    " ON CONFLICT DO NOTHING"
)

# The accounts with the switch on, rows waiting, and no email today.
DUE_SQL = (
    "SELECT u.id, u.email, u.username, u.public_id,"
    f" {language_sql('u')} AS language, u.notices_emailed_at AS emailed_at"
    " FROM users u WHERE u.notify_email"
    " AND EXISTS (SELECT 1 FROM email_notices n WHERE n.recipient_id = u.id)"
    " AND (u.notices_emailed_at IS NULL OR u.notices_emailed_at < %(today)s)"
    " ORDER BY u.id"
)

# The events of %(reader)s kept until %(until)s that are still true, the
# newest first, with who acted and, for a reaction, its kind now.
LINES_SQL = (
    "SELECT n.kind, a.username AS name, re.kind AS reaction,"
    " COALESCE(c.text, heart.text) AS text"
    " FROM email_notices n JOIN users a ON a.id = n.actor_id"
    " LEFT JOIN reactions re ON n.kind = 'reaction'"
    " AND re.drawing_id = n.drawing_id AND re.user_id = n.actor_id"
    " LEFT JOIN comments c ON c.id = n.comment_id"
    # A super like's words: the comment written with it (reactions.py).
    " LEFT JOIN LATERAL (SELECT h.text FROM comments h"
    " WHERE re.kind = 'super_like' AND h.drawing_id = re.drawing_id"
    " AND h.user_id = re.user_id AND h.created_at = re.created_at"
    " LIMIT 1) heart ON true"
    " WHERE n.recipient_id = %(reader)s AND n.at <= %(until)s"
    f" AND NOT {apart_sql('%(reader)s', 'n.actor_id')}"
    " AND CASE n.kind"
    " WHEN 'follow_request' THEN EXISTS (SELECT 1 FROM follows f"
    " WHERE f.follower_id = n.actor_id AND f.followed_id = n.recipient_id"
    " AND f.status = 'pending')"
    " WHEN 'follow_accepted' THEN EXISTS (SELECT 1 FROM follows f"
    " WHERE f.follower_id = n.recipient_id AND f.followed_id = n.actor_id"
    " AND f.status = 'accepted')"
    " WHEN 'reaction' THEN re.user_id IS NOT NULL"
    " WHEN 'comment' THEN c.id IS NOT NULL"
    " ELSE EXISTS (SELECT 1 FROM drawing_tags t"
    " WHERE t.drawing_id = n.drawing_id AND t.user_id = n.recipient_id)"
    " END"
    " AND (n.drawing_id IS NULL OR EXISTS (SELECT 1 FROM drawings d"
    " JOIN runs r ON r.id = d.run_id WHERE d.id = n.drawing_id"
    f" AND {drawing_seen_sql('%(reader)s')}))"
    " ORDER BY n.at DESC, n.id DESC"
)


@dataclass(frozen=True)
class Reader:
    """An account that may get the email now."""

    id: int
    email: str = field(repr=False)
    username: str
    public_id: UUID
    language: Language
    # Its last email of the notices.
    emailed_at: datetime | None


def due(conn: Connection[DictRow], today: datetime) -> list[Reader]:
    rows = conn.execute(DUE_SQL, {"today": today}).fetchall()
    return [Reader(**row) for row in rows]


def line_of(row: Mapping[str, Any], language: Language) -> str:
    """The push of the event, in `language`."""
    event = PushEvent(row["kind"], 0, 0, reaction=row["reaction"], text=row["text"])
    line = text_of(event, row["name"], language)
    if row["text"] or not line.rstrip().endswith(":"):
        return line
    # A super like whose words are gone: the heart alone.
    return line.rstrip().rstrip(":").rstrip() + "."


def lines_for(conn: Connection[DictRow], reader: Reader, until: datetime) -> list[str]:
    rows = conn.execute(LINES_SQL, {"reader": reader.id, "until": until}).fetchall()
    return [line_of(row, reader.language) for row in rows]


def start_of_day(moment: datetime) -> datetime:
    """Midnight UTC of the day of `moment`."""
    return moment.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


# --- The round ---


def pause(seconds: float) -> bool:
    """The wait between two emails of a round by hand: never stops it."""
    time.sleep(seconds)
    return False


@dataclass(frozen=True)
class RoundReport:
    """How a round went: accounts with rows, emails sent, accounts whose
    events are all gone, emails Resend refused."""

    due: int
    sent: int
    nothing_left: int
    refused: int


@dataclass
class NoticeEmails:
    """The events, the round and the switch, in the database."""

    database: Database
    setup: NoticeSetup
    now: Callable[[], datetime] = now_utc
    # The wait between two emails; True when the round must stop. The daily
    # round's thread puts its own, which the app's end cuts short.
    wait: Callable[[float], bool] = pause

    def record(self, event: PushEvent) -> None:
        """One of the five events of the people, for the day's email; push.py
        calls it for each event it lets through."""
        if event.kind not in EMAIL_KINDS or event.actor_id == event.recipient_id:
            return
        comment = UUID(event.key) if event.kind == "comment" else None
        with self.database.connect() as conn:
            conn.execute(
                RECORD_SQL,
                {
                    "recipient": event.recipient_id,
                    "actor": event.actor_id,
                    "kind": event.kind,
                    "drawing": event.drawing_id,
                    "comment": comment,
                    "at": self.now(),
                },
            )

    def email_of(self, reader: Reader, lines: Sequence[str], day: datetime) -> Email:
        stop = self.setup.links.url(reader.public_id)
        written = write(reader.language, reader.username, lines, OPEN_URL, stop)
        return Email(
            to=reader.email,
            subject=written.subject,
            text=written.text,
            html=written.html,
            headers={
                "List-Unsubscribe": f"<{stop}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            # One day, one email, even if Resend is asked twice.
            idempotency_key=f"notices-{reader.id}-{day:%Y%m%d}",
        )

    def _take(self, reader: Reader, at: datetime) -> bool:
        """The account is this round's, unless something changed since it
        was read: another round took it, or its owner turned it off."""
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE users SET notices_emailed_at = %s WHERE id = %s"
                " AND notify_email AND notices_emailed_at IS NOT DISTINCT FROM %s"
                " RETURNING id",
                (at, reader.id, reader.emailed_at),
            ).fetchone()
        return row is not None

    def _give_back(self, reader: Reader, at: datetime) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE users SET notices_emailed_at = %s"
                " WHERE id = %s AND notices_emailed_at = %s",
                (reader.emailed_at, reader.id, at),
            )

    def _forget(self, reader: Reader, until: datetime) -> None:
        """The rows the email took, or that are not true any more."""
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM email_notices WHERE recipient_id = %s AND at <= %s",
                (reader.id, until),
            )

    def _clean(self, now: datetime) -> None:
        """Rows too old, and those of accounts with the switch off."""
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM email_notices n USING users u"
                " WHERE u.id = n.recipient_id"
                " AND (n.at < %s OR NOT u.notify_email)",
                (now - timedelta(days=KEPT_DAYS),),
            )

    def round(self) -> RoundReport:
        """One email to each account with events still true, up to
        MAX_PER_ROUND; it stops early when `wait` says so."""
        now = self.now()
        self._clean(now)
        with self.database.connect() as conn:
            readers = due(conn, start_of_day(now))
        sent = nothing_left = refused = in_a_row = 0
        for reader in readers:
            if sent >= MAX_PER_ROUND or in_a_row >= MAX_REFUSED:
                break
            if (sent or refused) and self.wait(SEND_GAP_S):
                break
            at = self.now()
            if not self._take(reader, at):
                continue
            with self.database.connect() as conn:
                lines = lines_for(conn, reader, at)
            if not lines:
                self._give_back(reader, at)
                self._forget(reader, at)
                nothing_left += 1
                continue
            email = self.email_of(reader, lines, start_of_day(at))
            if self.setup.resend.deliver(email) is None:
                self._give_back(reader, at)
                refused += 1
                in_a_row += 1
            else:
                self._forget(reader, at)
                sent += 1
                in_a_row = 0
        if in_a_row >= MAX_REFUSED:
            log.warning("notice email: %d refused in a row, round stopped", in_a_row)
        report = RoundReport(len(readers), sent, nothing_left, refused)
        log.info(
            "notice email: %d due, %d sent, %d with nothing left, %d refused",
            report.due,
            report.sent,
            report.nothing_left,
            report.refused,
        )
        return report

    def language_of(self, public_id: UUID) -> Language | None:
        """The language of the page for an account; None without it."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {language_sql('u')} AS language FROM users u"
                " WHERE u.public_id = %s",
                (public_id,),
            ).fetchone()
        return None if row is None else row["language"]

    def stop(self, public_id: UUID) -> Language | None:
        """«Email notifications» off, and its rows gone; the account's
        language, None when no account has this id any more (deleted)."""
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE users u SET notify_email = false WHERE u.public_id = %s"
                f" RETURNING u.id, {language_sql('u')} AS language",
                (public_id,),
            ).fetchone()
            if row is None:
                return None
            conn.execute(
                "DELETE FROM email_notices WHERE recipient_id = %s", (row["id"],)
            )
        language: Language = row["language"]
        return language


@dataclass
class DailyRound:
    """A round every day at `setup.at`, in a thread of the API: a round
    that fails is logged and the next day comes all the same. stop() ends
    it, a round too between two emails, and waits for the thread."""

    notices: NoticeEmails
    stopped: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None

    def run(self) -> None:
        self.notices.wait = self.stopped.wait
        while True:
            now = self.notices.now()
            wait = (next_round(now, self.notices.setup.at) - now).total_seconds()
            if self.stopped.wait(wait):
                return
            try:
                self.notices.round()
            except Exception:
                log.exception("notice email: the round failed")

    def start(self) -> threading.Thread:
        self.thread = threading.Thread(
            target=self.run, name="notice-email", daemon=True
        )
        self.thread.start()
        return self.thread

    def stop(self, timeout_s: float = STOP_WAIT_S) -> None:
        self.stopped.set()
        if self.thread is not None:
            self.thread.join(timeout_s)


# --- The page of the link ---


def notice_routes() -> APIRouter:
    # No JSON, no app: a page for a browser, out of the API's docs.
    router = APIRouter(include_in_schema=False)

    def account(request: Request, t: str) -> tuple[NoticeEmails, UUID | None]:
        notices: NoticeEmails = request.app.state.notice_emails
        return notices, notices.setup.links.public_id_of(t)

    @router.get(STOP_PATH, response_class=HTMLResponse)
    def ask(
        request: Request, t: Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)] = ""
    ) -> HTMLResponse:
        notices, public_id = account(request, t)
        language = None if public_id is None else notices.language_of(public_id)
        if public_id is None or language is None:
            return HTMLResponse(wrong_link_page(), 404, PAGE_HEADERS)
        action = f"{STOP_PATH}?t={notices.setup.links.token(public_id)}"
        return HTMLResponse(ask_page(language, action), 200, PAGE_HEADERS)

    # The button of the page, and the mail app's one-click unsubscribe:
    # whatever the body says, the token is enough.
    @router.post(STOP_PATH, response_class=HTMLResponse)
    def stop(
        request: Request, t: Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)] = ""
    ) -> HTMLResponse:
        notices, public_id = account(request, t)
        language = None if public_id is None else notices.stop(public_id)
        if language is None:
            return HTMLResponse(wrong_link_page(), 404, PAGE_HEADERS)
        return HTMLResponse(stopped_page(language), 200, PAGE_HEADERS)

    return router


def install_notice_email(app: FastAPI, notices: NoticeEmails | None) -> None:
    """After create_app: push.py hands the events to `notices`, the page of
    the link is there, and the daily round lives with the app, started when
    it starts and stopped before its end closes the database's pool.
    Nothing when the emails are off."""
    if notices is None:
        return
    pusher = getattr(app.state, "pusher", None)
    if pusher is not None:
        pusher.listeners.append(notices.record)
    app.state.notice_emails = notices
    app.include_router(notice_routes())
    inner = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(the_app: FastAPI) -> AsyncIterator[Any]:
        async with inner(the_app) as state:
            daily = DailyRound(notices)
            daily.start()
            try:
                yield state
            finally:
                daily.stop()

    app.router.lifespan_context = lifespan


# --- By hand ---


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.notice_email",
        description="The daily email of the notices.",
    )
    parser.add_argument(
        "--send", action="store_true", help="send one round now (else: count only)"
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")
    database = Database.from_env()
    if database is None:
        raise SystemExit(f"{DATABASE_VARIABLE} is not set")
    try:
        setup = NoticeSetup.from_env()
    except AwayConfigError as exc:
        raise SystemExit(str(exc)) from None
    if args.send:
        if setup is None:
            raise SystemExit(
                f"Emails off: set {KEY_VARIABLE}, {SECRET_VARIABLE}"
                f" and {DOMAIN_VARIABLE} (docs/DEPLOY.md)"
            )
        NoticeEmails(database, setup).round()
        return
    now = now_utc()
    with database.connect() as conn:
        readers = due(conn, start_of_day(now))
        with_lines = sum(1 for reader in readers if lines_for(conn, reader, now))
    print(
        f"{len(readers)} account(s) with notices waiting and the switch on;"
        f" {with_lines} would get an email now"
        + ("" if setup is not None else " (emails off: no Resend key)")
    )


if __name__ == "__main__":
    main()
