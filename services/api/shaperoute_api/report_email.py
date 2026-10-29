"""Each report reaches whoever runs MuW by email, with a link that hides
what was reported (TASK-291, ADR-0251, docs/API.md, «Report emails»).

A new report (moderation.py: not the same member changing its reason) is
sent, outside its request, to SHAPEROUTE_REPORTS_TO: what was reported, the
reason, who reported it, who wrote it, its text, how many reports it has
and whether it is hidden already, and a link «Hide».

The link is signed with SHAPEROUTE_EMAIL_SECRET and says one action (hide
or show), one thing (a drawing, a comment, a member, a private message),
its id, when it expires (LINK_DAYS) and a random nonce. Opening it (GET)
only shows what it will do and a button: a mail reader that opens links
changes nothing.
The button (POST) does it, once: the nonce goes in report_links_used.
After «Hide» the page has «Undo», a new link of the same kind.

Hidden is from the others only: the author still sees it. A hidden drawing
is out of drawings.drawing_seen_sql and shown_sql, a hidden comment out of
comments.NOT_APART, a hidden group run out of group_runs.seen_sql
(TASK-309), a hidden message out of messages.SEEN, and a hidden member is
kept apart from everyone as across a block (follows.apart_sql). Nothing is
deleted. Of a private message (TASK-319) the email holds that message
only, never the rest of its conversation. A message with a photo, a video
or a drawing (TASK-333) says so, and the page of the link shows it: the
file comes from the same address, `?t=…&part=media`, so whoever runs MuW
needs no account; «Hide» hides the attachment with its message.

Off unless the environment has RESEND_API_KEY, SHAPEROUTE_EMAIL_SECRET,
SHAPEROUTE_DOMAIN and SHAPEROUTE_REPORTS_TO (docs/DEPLOY.md, «Email delle
segnalazioni»): then reports are kept as before, and nothing is sent.
Neither the address, the key nor a token is ever in a log.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import math
import os
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from html import escape
from typing import TYPE_CHECKING, Annotated, Literal, get_args
from uuid import UUID, uuid4

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from psycopg import Connection
from psycopg.rows import DictRow

from shaperoute_api.db import Database
from shaperoute_api.send_email import Mailer, send_email

if TYPE_CHECKING:
    from shaperoute_api.message_media import MessageMedia

log = logging.getLogger(__name__)

KEY_VARIABLE = "RESEND_API_KEY"
SECRET_VARIABLE = "SHAPEROUTE_EMAIL_SECRET"
DOMAIN_VARIABLE = "SHAPEROUTE_DOMAIN"
SENDER_VARIABLE = "SHAPEROUTE_EMAIL_FROM"
TO_VARIABLE = "SHAPEROUTE_REPORTS_TO"
SENDER = "MuW <hello@getmuw.app>"
MIN_SECRET_LENGTH = 32

LINK_PATH = "/report-link"
LINK_DAYS = 7
# The HMAC in a link, in hexadecimal digits: 128 bits.
TAG_HEX = 32
MAX_TOKEN_LENGTH = 160
# A page that holds a token: kept by no cache, sent to no other site.
PAGE_HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}

Action = Literal["hide", "show"]
Kind = Literal["drawing", "comment", "user", "group_run", "message"]
ACTIONS: tuple[Action, ...] = get_args(Action)
KINDS: tuple[Kind, ...] = get_args(Kind)
# What a report's kind is called in the email and on the pages.
NOUN: dict[Kind, str] = {
    "drawing": "drawing",
    "comment": "comment",
    "user": "profile",
    "group_run": "group run",
    "message": "message",
}

# The row of each kind, by the id a report keeps (a member: its public_id).
TABLE_OF: dict[Kind, tuple[str, str]] = {
    "drawing": ("drawings", "id"),
    "comment": ("comments", "id"),
    "user": ("users", "public_id"),
    "group_run": ("group_runs", "id"),
    "message": ("messages", "id"),
}


class ReportConfigError(ValueError):
    """A variable of the report emails is set but cannot be used."""


# --- The signed links ---


@dataclass(frozen=True)
class Link:
    """What a link does: one action on one thing, until `expires`."""

    action: Action
    kind: Kind
    target: UUID
    expires: datetime
    nonce: UUID


@dataclass(frozen=True)
class Links:
    """Made and checked with the same secret."""

    secret: bytes = field(repr=False)
    # "https://api.getmuw.app": where the API answers from outside.
    base_url: str

    def _tag(self, payload: str) -> str:
        message = b"report-link:" + payload.encode()
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()[:TAG_HEX]

    def new(self, action: Action, kind: Kind, target: UUID, now: datetime) -> Link:
        expires = now + timedelta(days=LINK_DAYS)
        return Link(action, kind, target, expires.replace(microsecond=0), uuid4())

    def token(self, link: Link) -> str:
        payload = ".".join(
            (
                link.action,
                link.kind,
                link.target.hex,
                str(int(link.expires.timestamp())),
                link.nonce.hex,
            )
        )
        return f"{payload}.{self._tag(payload)}"

    def url(self, link: Link) -> str:
        return f"{self.base_url}{LINK_PATH}?t={self.token(link)}"

    def read(self, token: str) -> Link | None:
        """The link of a token, expired or not; None when not one of ours."""
        if len(token) > MAX_TOKEN_LENGTH:
            return None
        parts = token.split(".")
        if len(parts) != 6:
            return None
        action, kind, target, expires, nonce, tag = parts
        payload = token[: -len(tag) - 1]
        expected = self._tag(payload).encode()
        if len(tag) != TAG_HEX or not hmac.compare_digest(tag.encode(), expected):
            return None
        if action not in ACTIONS or kind not in KINDS or not expires.isdigit():
            return None
        try:
            return Link(
                action,  # type: ignore[arg-type]  (checked just above)
                kind,  # type: ignore[arg-type]
                UUID(hex=target),
                datetime.fromtimestamp(int(expires), UTC),
                UUID(hex=nonce),
            )
        except (ValueError, OverflowError, OSError):
            return None


# --- What the environment says ---


@dataclass(frozen=True)
class ReportSetup:
    """What the emails need: Resend, the address, the links."""

    mailer: Mailer
    to: str = field(repr=False)
    links: Links

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> ReportSetup | None:
        """None, emails off, when one of the four is missing."""
        key = environ.get(KEY_VARIABLE, "").strip()
        secret = environ.get(SECRET_VARIABLE, "").strip()
        domain = environ.get(DOMAIN_VARIABLE, "").strip()
        to = environ.get(TO_VARIABLE, "").strip()
        if not (key and secret and domain and to):
            return None
        if len(secret) < MIN_SECRET_LENGTH:
            raise ReportConfigError(
                f"{SECRET_VARIABLE} is at least {MIN_SECRET_LENGTH} characters:"
                " make one with `openssl rand -hex 32` (docs/DEPLOY.md)"
            )
        if "@" not in to:
            raise ReportConfigError(f"{TO_VARIABLE} is one email address")
        sender = environ.get(SENDER_VARIABLE, "").strip() or SENDER
        base = domain if domain.startswith("https://") else f"https://{domain}"
        return cls(Mailer(key, sender), to, Links(secret.encode(), base.rstrip("/")))


# --- The report, as the email tells it ---


@dataclass(frozen=True)
class Reported:
    """One report and the thing it is about, read from the database."""

    kind: Kind
    target: UUID
    reason: str
    reporter: str
    author: str
    author_id: UUID
    # Title and description, the comment's text, the name and the bio, or a
    # group run's title, «Where exactly», notes and day.
    lines: tuple[str, ...]
    reports: int
    hidden: bool


def _drawing(conn: Connection[DictRow], target: UUID) -> DictRow | None:
    return conn.execute(
        "SELECT d.title, d.description, d.hidden_at, u.username, u.public_id"
        " FROM drawings d JOIN runs r ON r.id = d.run_id"
        " JOIN users u ON u.id = r.user_id WHERE d.id = %s",
        (target,),
    ).fetchone()


def _comment(conn: Connection[DictRow], target: UUID) -> DictRow | None:
    return conn.execute(
        "SELECT c.text, c.drawing_id, c.hidden_at, u.username, u.public_id"
        " FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = %s",
        (target,),
    ).fetchone()


def _message(conn: Connection[DictRow], target: UUID) -> DictRow | None:
    return conn.execute(
        "SELECT m.text, m.hidden_at, m.attachment, m.drawing_card, mm.duration_ms,"
        " mm.stored, u.username, u.public_id FROM messages m"
        " JOIN users u ON u.id = m.sender_id"
        " LEFT JOIN message_media mm ON mm.message_id = m.id WHERE m.id = %s",
        (target,),
    ).fetchone()


def _drawing_name(card: dict[str, object]) -> str:
    named = card.get("title") or card.get("word") or card.get("shape")
    return str(named) if named else "no name"


def attachment_lines(row: DictRow) -> tuple[str, ...]:
    """What a message carries (TASK-333), for the email: the page of the
    link shows it."""
    kind = row["attachment"]
    if kind == "photo":
        return ("With a photo: the link below shows it before hiding.",)
    if kind == "video":
        seconds = round((row["duration_ms"] or 0) / 1000)
        if not row["stored"]:
            return (f"With a video of {seconds} s, expired: no longer kept.",)
        return (f"With a video of {seconds} s: the link below shows it before hiding.",)
    if kind == "drawing":
        card = row["drawing_card"]
        km = card["distance_m"] / 1000
        return (
            f"With a drawing: {_drawing_name(card)}, {km:.1f} km;"
            " the link below shows it before hiding.",
        )
    return ()


def _user(conn: Connection[DictRow], target: UUID) -> DictRow | None:
    return conn.execute(
        "SELECT u.username, u.bio, u.hidden_at, u.public_id FROM users u"
        " WHERE u.public_id = %s",
        (target,),
    ).fetchone()


def _group_run(conn: Connection[DictRow], target: UUID) -> DictRow | None:
    return conn.execute(
        "SELECT g.title, g.meeting_note, g.description, g.starts_at, g.hidden_at,"
        " u.username, u.public_id FROM group_runs g"
        " JOIN users u ON u.id = g.owner_id WHERE g.id = %s",
        (target,),
    ).fetchone()


def reported(conn: Connection[DictRow], report_id: UUID) -> Reported | None:
    """The report and its thing; None when either is gone already."""
    report = conn.execute(
        "SELECT r.kind, r.target_id, r.reason, u.username AS reporter,"
        " (SELECT count(*) FROM reports o WHERE o.kind = r.kind"
        " AND o.target_id = r.target_id) AS reports"
        " FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.id = %s",
        (report_id,),
    ).fetchone()
    if report is None:
        return None
    kind: Kind = report["kind"]
    target: UUID = report["target_id"]
    lines: tuple[str, ...]
    if kind == "drawing":
        row = _drawing(conn, target)
        if row is not None:
            lines = (
                f"Title: {row['title'] or '(none)'}",
                f"Description: {row['description'] or '(none)'}",
            )
    elif kind == "comment":
        row = _comment(conn, target)
        if row is not None:
            lines = (
                f"Comment: {row['text']}",
                f"Under the drawing {row['drawing_id']}",
            )
    elif kind == "group_run":
        row = _group_run(conn, target)
        if row is not None:
            starts_at: datetime = row["starts_at"]
            lines = (
                f"Title: {row['title']}",
                f"Where exactly: {row['meeting_note'] or '(none)'}",
                f"Notes: {row['description'] or '(none)'}",
                f"Starts: {starts_at.astimezone(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
            )
    elif kind == "message":
        row = _message(conn, target)
        if row is not None:
            lines = (
                f"Message: {row['text'] or '(no text)'}",
                *attachment_lines(row),
                "A private message to who reported it: only this one is here.",
            )
    else:
        row = _user(conn, target)
        if row is not None:
            lines = (f"Name: {row['username']}", f"Bio: {row['bio'] or '(none)'}")
    if row is None:
        return None
    return Reported(
        kind=kind,
        target=target,
        reason=report["reason"],
        reporter=report["reporter"],
        author=row["username"],
        author_id=row["public_id"],
        lines=lines,
        reports=report["reports"],
        hidden=row["hidden_at"] is not None,
    )


@dataclass(frozen=True)
class Email:
    subject: str
    text: str
    html: str


def email_of(report: Reported, hide_url: str, expires: datetime) -> Email:
    """The email to whoever runs MuW, in English."""
    noun = NOUN[report.kind]
    subject = f"MuW report: {noun}, {report.reason}"
    head = f"{report.reporter} reported a {noun} by {report.author} as {report.reason}."
    facts = (
        *report.lines,
        f"Reports on this {noun}: {report.reports}",
        f"Hidden already: {'yes' if report.hidden else 'no'}",
    )
    until = expires.strftime("%Y-%m-%d %H:%M UTC")
    how = (
        f"The link asks before it hides, works once and expires on {until}."
        " Nothing is deleted: the author still sees it, and the page after"
        " hiding can undo it."
    )
    ids = f"{noun.capitalize()} id: {report.target} · author id: {report.author_id}"
    text = "\n".join(
        (head, "", *facts, "", f"Hide it from everyone else: {hide_url}", how, "", ids)
    )
    html = (
        f"<p>{escape(head)}</p>"
        + "".join(f"<p>{escape(line)}</p>" for line in facts)
        + f'<p><a href="{escape(hide_url)}">Hide it from everyone else</a></p>'
        + f"<p>{escape(how)}</p><p><small>{escape(ids)}</small></p>"
    )
    return Email(subject, text, html)


# --- Hiding and showing ---

Outcome = Literal["done", "used", "gone"]


def apply(conn: Connection[DictRow], link: Link, now: datetime) -> Outcome:
    """The link's action, once: "used" when its nonce was, "gone" when the
    thing is no longer there. In the caller's transaction."""
    used = conn.execute(
        "INSERT INTO report_links_used (nonce, used_at) VALUES (%s, %s)"
        " ON CONFLICT (nonce) DO NOTHING RETURNING nonce",
        (link.nonce, now),
    ).fetchone()
    if used is None:
        return "used"
    table, column = TABLE_OF[link.kind]
    hidden_at = now if link.action == "hide" else None
    row = conn.execute(
        f"UPDATE {table} SET hidden_at = %s WHERE {column} = %s RETURNING 1",
        (hidden_at, link.target),
    ).fetchone()
    return "done" if row is not None else "gone"


# --- The emails, outside the requests ---

Run = Callable[[Callable[[], None]], object]


@dataclass
class ReportEmails:
    """Sends the email of each new report; hides and shows from its link."""

    database: Database
    setup: ReportSetup
    now: Callable[[], datetime] = field(default=lambda: datetime.now(UTC))
    # Where the email is sent from: one thread; the tests run it at once.
    run: Run | None = None

    def __post_init__(self) -> None:
        if self.run is None:
            pool = ThreadPoolExecutor(1, thread_name_prefix="report-email")
            self.run = pool.submit

    def notify(self, report_id: UUID) -> None:
        """Called after a new report is written. Never raises."""
        try:
            assert self.run is not None
            self.run(lambda: self.send(report_id))
        except Exception:
            log.exception("report email: not sent")

    def send(self, report_id: UUID) -> bool:
        """The email of the report; False when it was not sent."""
        try:
            with self.database.connect() as conn:
                report = reported(conn, report_id)
            if report is None:
                return False
            link = self.setup.links.new("hide", report.kind, report.target, self.now())
            email = email_of(report, self.setup.links.url(link), link.expires)
            return send_email(
                self.setup.mailer, self.setup.to, email.subject, email.text, email.html
            )
        except Exception:
            log.exception("report email: not sent")
            return False

    def act(self, link: Link) -> Outcome:
        with self.database.connect() as conn:
            return apply(conn, link, self.now())


# --- The pages of the link ---


def _page(title: str, body: str) -> str:
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="robots" content="noindex">'
        f"<title>{escape(title)}</title>"
        "<style>body{font-family:-apple-system,system-ui,sans-serif;"
        "max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5}"
        "button{font:inherit;padding:.6rem 1.2rem}</style></head>"
        f"<body><h1>{escape(title)}</h1>{body}</body></html>"
    )


def _button(url: str, label: str) -> str:
    return (
        f'<form method="post" action="{escape(url)}">'
        f'<button type="submit">{escape(label)}</button></form>'
    )


def _what(link: Link) -> str:
    return f"the {NOUN[link.kind]} {link.target}"


def ask_page(link: Link, url: str, shown: str = "") -> str:
    """`shown`: the attachment of a message, as shown_html makes it."""
    if link.action == "hide":
        return _page(
            "Hide it?",
            f"<p>{escape(_what(link))} will be hidden from everyone but its"
            " author. Nothing is deleted.</p>" + shown + _button(url, "Hide"),
        )
    return _page(
        "Show it again?",
        f"<p>{escape(_what(link))} will be seen again as before.</p>"
        + shown
        + _button(url, "Show again"),
    )


# The drawing of a message on the page: a line in a square this wide.
DRAWING_SIDE = 240


def drawing_svg(points: list[list[float]]) -> str:
    """The points of a drawing's card as a line, north up, without a map."""
    if len(points) < 2:
        return ""
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    middle = math.cos(math.radians((min(lats) + max(lats)) / 2))
    width = max((max(lons) - min(lons)) * middle, 1e-9)
    height = max(max(lats) - min(lats), 1e-9)
    scale = (DRAWING_SIDE - 20) / max(width, height)
    line = " ".join(
        f"{10 + (lon - min(lons)) * middle * scale:.1f},"
        f"{10 + (max(lats) - lat) * scale:.1f}"
        for lat, lon in zip(lats, lons, strict=True)
    )
    return (
        f'<svg width="{DRAWING_SIDE}" height="{DRAWING_SIDE}"'
        f' viewBox="0 0 {DRAWING_SIDE} {DRAWING_SIDE}" role="img"'
        ' aria-label="The drawing">'
        f'<polyline points="{line}" fill="none" stroke="#000" stroke-width="3"'
        ' stroke-linejoin="round" stroke-linecap="round"/></svg>'
    )


def shown_html(row: DictRow | None, token: str) -> str:
    """The attachment of a reported message on the page of its link: the
    photo, the video, or the drawing's line; empty without one."""
    if row is None or row["attachment"] is None:
        return ""
    source = escape(f"{LINK_PATH}?t={token}&part=media")
    if row["attachment"] == "photo":
        return (
            f'<p><img src="{source}" alt="The photo of the message"'
            ' style="max-width:100%;height:auto"></p>'
        )
    if row["attachment"] == "video":
        if not row["stored"]:
            return "<p>The video of the message has expired.</p>"
        return (
            f'<p><video src="{source}" controls playsinline preload="metadata"'
            ' style="max-width:100%"></video></p>'
        )
    card = row["drawing_card"]
    return (
        f"<p>{escape(_drawing_name(card))},"
        f" {card['distance_m'] / 1000:.1f} km</p>"
        f"<p>{drawing_svg(card['preview'])}</p>"
    )


def done_page(link: Link, undo_url: str) -> str:
    if link.action == "hide":
        return _page(
            "Hidden",
            f"<p>{escape(_what(link))} is hidden from everyone but its author."
            f" The undo below works once, for {LINK_DAYS} days.</p>"
            + _button(undo_url, "Undo"),
        )
    return _page(
        "Shown again",
        f"<p>{escape(_what(link))} is seen again as before.</p>"
        + _button(undo_url, "Hide again"),
    )


def wrong_page(why: str) -> str:
    return _page("This link does nothing", f"<p>{escape(why)}</p>")


WRONG = "It is not a link of a MuW report email."
EXPIRED = f"It is more than {LINK_DAYS} days old. A new report sends a new one."
USED = "It was used already: each link works once."
GONE = "It is no longer there: it was deleted."


# The token of a link, in the address: ?t=…
Token = Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)]
# &part=media: the photo or the video of a reported message (TASK-333).
Part = Annotated[Literal["media"] | None, Query()]
NO_FILE = "The message has no photo or video kept."


def attached(request: Request, link: Link) -> Response:
    """The photo or video of the message of a link, for its page."""
    media: MessageMedia | None = getattr(request.app.state, "message_media", None)
    stored = (
        None
        if media is None or link.kind != "message"
        else media.of_message(link.target)
    )
    if stored is None:
        return HTMLResponse(wrong_page(NO_FILE), 404, PAGE_HEADERS)
    return FileResponse(stored.path, media_type=stored.media_type, headers=PAGE_HEADERS)


def report_link_routes() -> APIRouter:
    router = APIRouter(tags=["moderation"], include_in_schema=False)

    def checked(request: Request, t: str) -> tuple[ReportEmails, Link] | str:
        emails: ReportEmails | None = getattr(request.app.state, "report_emails", None)
        link = None if emails is None else emails.setup.links.read(t)
        if emails is None or link is None:
            return WRONG
        if link.expires <= emails.now():
            return EXPIRED
        return emails, link

    @router.get(LINK_PATH, response_class=HTMLResponse)
    def ask(request: Request, t: Token, part: Part = None) -> Response:
        found = checked(request, t)
        if isinstance(found, str):
            return HTMLResponse(wrong_page(found), 404, PAGE_HEADERS)
        emails, link = found
        if part is not None:
            return attached(request, link)
        shown = ""
        if link.kind == "message":
            with emails.database.connect() as conn:
                shown = shown_html(_message(conn, link.target), t)
        url = emails.setup.links.url(link)
        return HTMLResponse(ask_page(link, url, shown), 200, PAGE_HEADERS)

    # The button of the page: the token in the address is enough.
    @router.post(LINK_PATH, response_class=HTMLResponse)
    def act(request: Request, t: Token) -> HTMLResponse:
        found = checked(request, t)
        if isinstance(found, str):
            return HTMLResponse(wrong_page(found), 404, PAGE_HEADERS)
        emails, link = found
        outcome = emails.act(link)
        if outcome == "used":
            return HTMLResponse(wrong_page(USED), 410, PAGE_HEADERS)
        if outcome == "gone":
            return HTMLResponse(wrong_page(GONE), 404, PAGE_HEADERS)
        other: Action = "show" if link.action == "hide" else "hide"
        undo = emails.setup.links.new(other, link.kind, link.target, emails.now())
        page = done_page(link, emails.setup.links.url(undo))
        return HTMLResponse(page, 200, PAGE_HEADERS)

    return router


def install_report_email(app: FastAPI, emails: ReportEmails | None) -> None:
    """The emails of the reports and the pages of their links. Without an
    email setup (or a database) the reports are kept, nothing is sent, and
    the pages say the link does nothing."""
    app.state.report_emails = emails
    app.include_router(report_link_routes())


def notify_report(request: Request, report_id: UUID) -> None:
    """For moderation.py, after a new report is written; never raises."""
    emails: ReportEmails | None = getattr(request.app.state, "report_emails", None)
    if emails is not None:
        emails.notify(report_id)
