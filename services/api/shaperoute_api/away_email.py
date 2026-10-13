"""The email to who has not opened the app for two weeks (TASK-284,
ADR-0244, docs/API.md, «Email when I'm away»).

Once a day, at AWAY_EMAIL_AT (UTC), a round looks for the accounts:

- with «Email when I'm away» on (users.notify_away): on until its owner
  turns it off in «Settings», at sign-up or with the link of the email;
- not using the app for AWAY_DAYS: the last use is the latest
  sessions.last_used_at. An account signed out of every phone has no last
  use, and gets nothing;
- not emailed since that last use: one email for one absence.

It writes to each, in its language, how many drawings are new since then
from the people it follows, with up to three names, or else in the Feed:
those the Feed would show it (drawings.shown_sql), its own left out, never
across a block. With nothing new there is no email: the next round asks
again.

An account is taken before its email is sent (an UPDATE that holds only if
nothing changed since it was read), so two rounds at once never send it
twice, and given back when Resend refuses it: the next round tries again.
At most MAX_PER_ROUND emails a round, SEND_GAP_S apart (Resend takes two a
second); after MAX_REFUSED refusals in a row the round stops, since the key
or the domain is wrong, and the next day says it again.

The link «Don't send me these emails» opens GET STOP_PATH?t=…: a page with
a button that posts to the same address, which turns the switch off. The
token is an HMAC of the account's public id with SHAPEROUTE_EMAIL_SECRET:
nothing is kept for it, and nobody can make one for another account. The
page needs no API key (access.py): a browser has none. The emails also
carry List-Unsubscribe and List-Unsubscribe-Post (RFC 8058), so the
«unsubscribe» of a mail app posts there too.

Off unless the environment has RESEND_API_KEY, SHAPEROUTE_EMAIL_SECRET and
SHAPEROUTE_DOMAIN (docs/DEPLOY.md, «Email di ritorno»): then nothing is
sent and the page is not there.

    python -m shaperoute_api.away_email          # how many would get one now
    python -m shaperoute_api.away_email --send   # one round, now
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import logging
import os
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from datetime import time as clock_time
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.responses import HTMLResponse
from psycopg import Connection
from psycopg.rows import DictRow

from shaperoute_api.accounts import Language, now_utc
from shaperoute_api.away_texts import (
    MAX_NAMES,
    News,
    ask_page,
    stopped_page,
    write,
    wrong_link_page,
)
from shaperoute_api.db import DATABASE_VARIABLE, Database
from shaperoute_api.drawings import shown_sql
from shaperoute_api.follows import follows_sql
from shaperoute_api.resend_email import Email, Resend

log = logging.getLogger(__name__)

AWAY_DAYS = 14
MAX_PER_ROUND = 500
SEND_GAP_S = 0.5
MAX_REFUSED = 3
# 17:00 UTC: evening in Europe, the middle of the day in America.
DEFAULT_AT = clock_time(17, 0)
STOP_PATH = "/away-email/stop"
# «Open MuW»: the app's page on the App Store, which says «Open» on an
# iPhone that has the app. The app has no universal link yet.
OPEN_URL = "https://apps.apple.com/app/id6820961883"
SENDER = "MuW <hello@getmuw.app>"
KEY_VARIABLE = "RESEND_API_KEY"
SECRET_VARIABLE = "SHAPEROUTE_EMAIL_SECRET"
DOMAIN_VARIABLE = "SHAPEROUTE_DOMAIN"
SENDER_VARIABLE = "SHAPEROUTE_EMAIL_FROM"
AT_VARIABLE = "AWAY_EMAIL_AT"
MIN_SECRET_LENGTH = 32
# The HMAC in a link, in hexadecimal digits: 128 bits.
TAG_HEX = 32
MAX_TOKEN_LENGTH = 100
# A page that holds a token: kept by no cache, sent to no other site.
PAGE_HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


class AwayConfigError(ValueError):
    """An email variable is set but cannot be used."""


# --- The links «Don't send me these emails» ---


@dataclass(frozen=True)
class StopLinks:
    """One link per account, made and checked with the same secret."""

    secret: bytes = field(repr=False)
    # "https://api.getmuw.app": where the API answers from outside.
    base_url: str

    def _tag(self, public_id: UUID) -> str:
        message = b"away-email-stop:" + public_id.bytes
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()[:TAG_HEX]

    def token(self, public_id: UUID) -> str:
        return f"{public_id.hex}.{self._tag(public_id)}"

    def url(self, public_id: UUID) -> str:
        return f"{self.base_url}{STOP_PATH}?t={self.token(public_id)}"

    def public_id_of(self, token: str) -> UUID | None:
        """The account of a token, or None when it is not one of ours."""
        head, dot, tag = token.partition(".")
        if not dot or len(head) != len(UUID(int=0).hex) or len(tag) != TAG_HEX:
            return None
        try:
            public_id = UUID(hex=head)
        except ValueError:
            return None
        if public_id.hex != head:
            return None
        expected = self._tag(public_id).encode()
        return public_id if hmac.compare_digest(tag.encode(), expected) else None


# --- What the environment says ---


def _at(text: str) -> clock_time:
    """ "17:00" as a time of day; DEFAULT_AT when empty."""
    if not text:
        return DEFAULT_AT
    hours, colon, minutes = text.partition(":")
    try:
        if not colon:
            raise ValueError(text)
        return clock_time(int(hours), int(minutes))
    except ValueError:
        raise AwayConfigError(
            f"{AT_VARIABLE} is a time of day in UTC, such as 17:00"
        ) from None


@dataclass(frozen=True)
class AwaySetup:
    """What the emails need: Resend, the links and the time of the round."""

    resend: Resend
    links: StopLinks
    at: clock_time = DEFAULT_AT

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> AwaySetup | None:
        """None, emails off, when one of the three is missing."""
        key = environ.get(KEY_VARIABLE, "").strip()
        secret = environ.get(SECRET_VARIABLE, "").strip()
        domain = environ.get(DOMAIN_VARIABLE, "").strip()
        if not (key and secret and domain):
            return None
        if len(secret) < MIN_SECRET_LENGTH:
            raise AwayConfigError(
                f"{SECRET_VARIABLE} is at least {MIN_SECRET_LENGTH} characters:"
                " make one with `openssl rand -hex 32` (docs/DEPLOY.md)"
            )
        sender = environ.get(SENDER_VARIABLE, "").strip() or SENDER
        base = domain if domain.startswith("https://") else f"https://{domain}"
        return cls(
            Resend(key, sender),
            StopLinks(secret.encode(), base.rstrip("/")),
            _at(environ.get(AT_VARIABLE, "").strip()),
        )


# --- Who is away, and what is new for them ---


def language_sql(account: str) -> str:
    """The language of the account `account` (a users row's alias): the
    app's at sign-up, else that of its phone with push on, else English."""
    return (
        f"COALESCE({account}.language, (SELECT t.language FROM push_tokens t"
        f" WHERE t.user_id = {account}.id AND t.language IS NOT NULL"
        " ORDER BY t.updated_at DESC LIMIT 1), 'en')"
    )


# The accounts with the switch on that have not used the app since
# %(before)s and were not emailed since their last use; the most recently
# gone first.
DUE_SQL = (
    "SELECT * FROM (SELECT u.id, u.email, u.username, u.public_id,"
    f" {language_sql('u')} AS language, u.away_emailed_at AS emailed_at,"
    " (SELECT max(s.last_used_at) FROM sessions s WHERE s.user_id = u.id)"
    " AS seen_at FROM users u WHERE u.notify_away) reader"
    " WHERE seen_at < %(before)s"
    " AND (emailed_at IS NULL OR emailed_at < seen_at)"
    " ORDER BY seen_at DESC, id"
)

# The drawings published since %(since)s that the Feed would show
# %(reader)s, its own left out.
NEW_SQL = (
    " FROM drawings d JOIN runs r ON r.id = d.run_id"
    " WHERE d.published_at > %(since)s AND r.user_id <> %(reader)s"
    f" AND {shown_sql('%(reader)s')}"
)
FOLLOWED = follows_sql("%(reader)s", "r.user_id")
COUNT_SQL = (
    "SELECT count(*) AS feed,"
    f" count(*) FILTER (WHERE {FOLLOWED}) AS followed,"
    f" count(DISTINCT r.user_id) FILTER (WHERE {FOLLOWED}) AS people{NEW_SQL}"
)
NAMES_SQL = (
    "SELECT a.username FROM (SELECT r.user_id, max(d.published_at) AS last"
    f"{NEW_SQL} AND {FOLLOWED} GROUP BY r.user_id) people"
    " JOIN users a ON a.id = people.user_id"
    " ORDER BY people.last DESC, a.id LIMIT %(names)s"
)


@dataclass(frozen=True)
class Reader:
    """An account that may get the email now."""

    id: int
    email: str = field(repr=False)
    username: str
    public_id: UUID
    language: Language
    # Its last use of the app, and its last email of this kind.
    seen_at: datetime
    emailed_at: datetime | None


def due(conn: Connection[DictRow], before: datetime) -> list[Reader]:
    rows = conn.execute(DUE_SQL, {"before": before}).fetchall()
    return [Reader(**row) for row in rows]


def news_for(conn: Connection[DictRow], reader: Reader) -> News:
    values: dict[str, Any] = {
        "reader": reader.id,
        "since": reader.seen_at,
        "names": MAX_NAMES,
    }
    counts = conn.execute(COUNT_SQL, values).fetchone()
    assert counts is not None
    names: Sequence[str] = []
    if counts["followed"]:
        names = [row["username"] for row in conn.execute(NAMES_SQL, values)]
    return News(
        followed=counts["followed"],
        names=names,
        people=counts["people"],
        feed=counts["feed"],
    )


# --- The round ---


@dataclass(frozen=True)
class RoundReport:
    """How a round went: accounts away, emails sent, accounts with nothing
    new, emails Resend refused."""

    away: int
    sent: int
    nothing_new: int
    refused: int


@dataclass
class AwayEmails:
    """The emails, the round and the switch, in the database."""

    database: Database
    setup: AwaySetup
    now: Callable[[], datetime] = now_utc
    sleep: Callable[[float], None] = time.sleep

    def email_of(self, reader: Reader, news: News) -> Email:
        stop = self.setup.links.url(reader.public_id)
        written = write(reader.language, reader.username, news, OPEN_URL, stop)
        return Email(
            to=reader.email,
            subject=written.subject,
            text=written.text,
            html=written.html,
            headers={
                "List-Unsubscribe": f"<{stop}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            # One absence, one email, even if Resend is asked twice.
            idempotency_key=f"away-{reader.id}-{reader.seen_at.timestamp():.0f}",
        )

    def _take(self, reader: Reader, at: datetime) -> bool:
        """The account is this round's, unless something changed since it
        was read: another round took it, or its owner turned it off."""
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE users SET away_emailed_at = %s WHERE id = %s"
                " AND notify_away AND away_emailed_at IS NOT DISTINCT FROM %s"
                " RETURNING id",
                (at, reader.id, reader.emailed_at),
            ).fetchone()
        return row is not None

    def _give_back(self, reader: Reader, at: datetime) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE users SET away_emailed_at = %s"
                " WHERE id = %s AND away_emailed_at = %s",
                (reader.emailed_at, reader.id, at),
            )

    def round(self) -> RoundReport:
        """One email to each account away with something new, up to
        MAX_PER_ROUND."""
        with self.database.connect() as conn:
            readers = due(conn, self.now() - timedelta(days=AWAY_DAYS))
        sent = nothing_new = refused = in_a_row = 0
        for reader in readers:
            if sent >= MAX_PER_ROUND or in_a_row >= MAX_REFUSED:
                break
            with self.database.connect() as conn:
                news = news_for(conn, reader)
            if not news.any:
                nothing_new += 1
                continue
            at = self.now()
            if not self._take(reader, at):
                continue
            if sent or refused:
                self.sleep(SEND_GAP_S)
            if self.setup.resend.deliver(self.email_of(reader, news)) is None:
                self._give_back(reader, at)
                refused += 1
                in_a_row += 1
            else:
                sent += 1
                in_a_row = 0
        if in_a_row >= MAX_REFUSED:
            log.warning("away email: %d refused in a row, round stopped", in_a_row)
        report = RoundReport(len(readers), sent, nothing_new, refused)
        log.info(
            "away email: %d away, %d sent, %d with nothing new, %d refused",
            report.away,
            report.sent,
            report.nothing_new,
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
        """«Email when I'm away» off; the account's language, None when no
        account has this id any more (deleted)."""
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE users u SET notify_away = false WHERE u.public_id = %s"
                f" RETURNING {language_sql('u')} AS language",
                (public_id,),
            ).fetchone()
        return None if row is None else row["language"]


def next_round(moment: datetime, at: clock_time) -> datetime:
    """The first `at` (UTC) after `moment`, an aware datetime."""
    today = moment.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    return today if today > moment else today + timedelta(days=1)


@dataclass
class DailyRound:
    """A round every day at `setup.at`, in a thread of the API: a round
    that fails is logged and the next day comes all the same."""

    away: AwayEmails
    stopped: threading.Event = field(default_factory=threading.Event)

    def run(self) -> None:
        while True:
            now = self.away.now()
            wait = (next_round(now, self.away.setup.at) - now).total_seconds()
            if self.stopped.wait(wait):
                return
            try:
                self.away.round()
            except Exception:
                log.exception("away email: the round failed")

    def start(self) -> threading.Thread:
        thread = threading.Thread(target=self.run, name="away-email", daemon=True)
        thread.start()
        return thread


# --- The page of the link ---


def away_routes() -> APIRouter:
    # No JSON, no app: a page for a browser, out of the API's docs.
    router = APIRouter(include_in_schema=False)

    def account(request: Request, t: str) -> tuple[AwayEmails, UUID | None]:
        away: AwayEmails = request.app.state.away_emails
        return away, away.setup.links.public_id_of(t)

    @router.get(STOP_PATH, response_class=HTMLResponse)
    def ask(
        request: Request, t: Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)] = ""
    ) -> HTMLResponse:
        away, public_id = account(request, t)
        language = None if public_id is None else away.language_of(public_id)
        if public_id is None or language is None:
            return HTMLResponse(wrong_link_page(), 404, PAGE_HEADERS)
        action = f"{STOP_PATH}?t={away.setup.links.token(public_id)}"
        return HTMLResponse(ask_page(language, action), 200, PAGE_HEADERS)

    # The button of the page, and the mail app's one-click unsubscribe:
    # whatever the body says, the token is enough.
    @router.post(STOP_PATH, response_class=HTMLResponse)
    def stop(
        request: Request, t: Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)] = ""
    ) -> HTMLResponse:
        away, public_id = account(request, t)
        language = None if public_id is None else away.stop(public_id)
        if language is None:
            return HTMLResponse(wrong_link_page(), 404, PAGE_HEADERS)
        return HTMLResponse(stopped_page(language), 200, PAGE_HEADERS)

    return router


def install_away_email(app: FastAPI, away: AwayEmails | None) -> None:
    """The page of the link; nothing when the emails are off."""
    if away is None:
        return
    app.state.away_emails = away
    app.include_router(away_routes())


# --- By hand ---


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.away_email",
        description="The email to who has not opened the app for two weeks.",
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
        setup = AwaySetup.from_env()
    except AwayConfigError as exc:
        raise SystemExit(str(exc)) from None
    if args.send:
        if setup is None:
            raise SystemExit(
                f"Emails off: set {KEY_VARIABLE}, {SECRET_VARIABLE}"
                f" and {DOMAIN_VARIABLE} (docs/DEPLOY.md)"
            )
        AwayEmails(database, setup).round()
        return
    with database.connect() as conn:
        readers = due(conn, now_utc() - timedelta(days=AWAY_DAYS))
        with_news = sum(1 for reader in readers if news_for(conn, reader).any)
    print(
        f"{len(readers)} account(s) away for {AWAY_DAYS} days with the switch on;"
        f" {with_news} with something new would get an email now"
        + ("" if setup is not None else " (emails off: no Resend key)")
    )


if __name__ == "__main__":
    main()
