"""«Send feedback» in «Settings» (TASK-308, ADR-0268, docs/API.md,
«Feedback»).

POST /feedback keeps what a member writes to whoever runs MuW: ideas,
problems, anything. The text, with the app's version and the phone's
system when the app says them. No endpoint reads it: each message is
emailed, outside its request, to SHAPEROUTE_FEEDBACK_TO, or to
SHAPEROUTE_REPORTS_TO when that is not set, with the member's username and
address. The address is also the Reply-To: answering the email answers the
member. Without RESEND_API_KEY and an address the message is kept and
nothing is sent.

At most MAX_PER_DAY messages for each account in any 24 hours, counted in
the database, and MAX_PER_ADDRESS_PER_DAY from one network address, counted
in memory (a club on one Wi-Fi): the next one gets 429 with the seconds to
wait.

GET /feedback answers 204 on a server that takes feedback: the app shows
«Send feedback» only after it, so an app newer than its server never lets
someone write a message nobody takes (an older API answers 404).

Deleting the account deletes its messages (ON DELETE CASCADE). Neither the
key, the address nor the text is ever in a log.
"""

from __future__ import annotations

import logging
import math
import os
import unicodedata
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from html import escape
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from psycopg import errors as pg_errors
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
from shaperoute_api.db import Database
from shaperoute_api.report_email import KEY_VARIABLE, SENDER, SENDER_VARIABLE
from shaperoute_api.report_email import TO_VARIABLE as REPORTS_TO_VARIABLE
from shaperoute_api.resend_email import Email, Resend

log = logging.getLogger(__name__)

TO_VARIABLE = "SHAPEROUTE_FEEDBACK_TO"

MAX_FEEDBACK_LENGTH = 2000
MAX_PER_DAY = 5
MAX_PER_ADDRESS_PER_DAY = 20
WINDOW = timedelta(days=1)
# «1.0.0 (7)», as the app writes its version and build.
MAX_VERSION_LENGTH = 40
VERSION_PATTERN = r"^[0-9A-Za-z.()+ -]+$"

Platform = Literal["ios", "android"]
PLATFORM_NAME: dict[Platform, str] = {"ios": "iOS", "android": "Android"}

FEEDBACK_EMPTY = "Write something first."
FEEDBACK_TOO_LONG = f"Feedback is at most {MAX_FEEDBACK_LENGTH} characters."
FEEDBACK_NOT_TEXT = (
    "Feedback is words and new lines: it cannot hold control characters."
)
TOO_MUCH_FEEDBACK = "You sent a lot of feedback today: try again tomorrow."


class FeedbackConfigError(ValueError):
    """The address of the feedback is set but is not one."""


def checked_text(value: str) -> str:
    """The message as kept: without spaces at either end; or 422 saying
    what is wrong with it. New lines and tabs stay."""
    text = value.strip()
    if not text:
        raise AccountError(422, "invalid_request", FEEDBACK_EMPTY)
    if len(text) > MAX_FEEDBACK_LENGTH:
        raise AccountError(422, "invalid_request", FEEDBACK_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" and c not in "\n\t" for c in text):
        raise AccountError(422, "invalid_request", FEEDBACK_NOT_TEXT)
    return text


class FeedbackRequestBody(BaseModel):
    """POST /feedback: packages/shared-types/fixtures/feedback-request.json."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        description=(
            f"1 to {MAX_FEEDBACK_LENGTH} characters once the spaces at either"
            " end are gone; new lines are kept."
        ),
    )
    app_version: str | None = Field(
        default=None,
        max_length=MAX_VERSION_LENGTH,
        pattern=VERSION_PATTERN,
        description="The app's version and build, like «1.0.0 (7)».",
    )
    platform: Platform | None = None


# --- In the database ---


@dataclass(frozen=True)
class Kept:
    """One message, as the database has it."""

    id: UUID
    text: str = field(repr=False)
    at: datetime


@dataclass
class Feedback:
    """The messages of the members, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def keep(self, user_id: int, body: FeedbackRequestBody) -> Kept:
        """The message kept; 422 for one that is not, 429 past MAX_PER_DAY
        in the last day, with the seconds until the oldest of them is a day
        old."""
        text = checked_text(body.text)
        now = self.now()
        try:
            with self.database.connect() as conn:
                recent = conn.execute(
                    "SELECT created_at FROM feedback WHERE user_id = %s"
                    " AND created_at > %s ORDER BY created_at LIMIT %s",
                    (user_id, now - WINDOW, MAX_PER_DAY),
                ).fetchall()
                if len(recent) >= MAX_PER_DAY:
                    wait = recent[0]["created_at"] + WINDOW - now
                    raise AccountError(
                        429,
                        "too_many_requests",
                        TOO_MUCH_FEEDBACK,
                        max(1, math.ceil(wait.total_seconds())),
                    )
                row = conn.execute(
                    "INSERT INTO feedback (user_id, text, app_version, platform,"
                    " created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (user_id, text, body.app_version, body.platform, now),
                ).fetchone()
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while it was writing.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN) from None
        assert row is not None
        return Kept(row["id"], text, now)


def feedback_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Feedback:
    """In the database of the accounts, on the same clock."""
    return Feedback(accounts.database, accounts.now)


# --- What the environment says ---


@dataclass(frozen=True)
class FeedbackSetup:
    """What the emails need: Resend and the address they go to."""

    mailer: Resend
    to: str = field(repr=False)

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> FeedbackSetup | None:
        """None, emails off, without the key or an address."""
        key = environ.get(KEY_VARIABLE, "").strip()
        variable = TO_VARIABLE if environ.get(TO_VARIABLE, "").strip() else None
        variable = variable or REPORTS_TO_VARIABLE
        to = environ.get(variable, "").strip()
        if not (key and to):
            return None
        if "@" not in to:
            raise FeedbackConfigError(f"{variable} is one email address")
        sender = environ.get(SENDER_VARIABLE, "").strip() or SENDER
        return cls(Resend(key, sender), to)


# --- The email, outside the request ---


def email_of(to: str, user: UserBody, body: FeedbackRequestBody, kept: Kept) -> Email:
    """The email to whoever runs MuW, in English; an answer goes to the
    member."""
    platform = PLATFORM_NAME[body.platform] if body.platform else "?"
    facts = (
        f"From: {user.username} <{user.email}>",
        f"App: {body.app_version or '?'} on {platform}",
        f"Sent: {kept.at.astimezone(UTC):%Y-%m-%d %H:%M} UTC",
    )
    how = "Reply to this email to answer them: the answer goes to their address."
    ids = f"Member id: {user.public_id} · feedback id: {kept.id}"
    text = "\n".join((kept.text, "", "--", *facts, "", how, "", ids))
    lines = "<br>".join(escape(line) for line in kept.text.split("\n"))
    html = (
        f"<p>{lines}</p><hr>"
        + "".join(f"<p>{escape(fact)}</p>" for fact in facts)
        + f"<p>{escape(how)}</p><p><small>{escape(ids)}</small></p>"
    )
    return Email(
        to=to,
        subject=f"MuW feedback from {user.username}",
        text=text,
        html=html,
        # The same message asked twice is one email.
        idempotency_key=f"feedback-{kept.id}",
        reply_to=user.email,
    )


Run = Callable[[Callable[[], None]], object]


@dataclass
class FeedbackEmails:
    """Sends the email of each message kept."""

    setup: FeedbackSetup
    # Where the email is sent from: one thread; the tests run it at once.
    run: Run | None = None

    def __post_init__(self) -> None:
        if self.run is None:
            pool = ThreadPoolExecutor(1, thread_name_prefix="feedback-email")
            self.run = pool.submit

    def notify(self, user: UserBody, body: FeedbackRequestBody, kept: Kept) -> None:
        """Called after a message is written. Never raises."""
        try:
            email = email_of(self.setup.to, user, body, kept)
            assert self.run is not None
            self.run(lambda: self.send(email))
        except Exception:
            log.exception("feedback email: not sent")

    def send(self, email: Email) -> bool:
        """Whether Resend took the email; never raises, never retries."""
        try:
            return self.setup.mailer.deliver(email) is not None
        except Exception:
            log.exception("feedback email: not sent")
            return False


# --- The endpoint ---


def feedback_routes() -> APIRouter:
    router = APIRouter(tags=["feedback"], responses=ACCOUNT_ERRORS)
    # Per network address, as the comments per account: in memory.
    by_address = RateLimiter(MAX_PER_ADDRESS_PER_DAY, WINDOW.total_seconds())

    # The probe of the app: 204 here, 404 on an older API, 503 without the
    # database of the accounts.
    @router.get("/feedback", status_code=204)
    def takes_feedback(_: Annotated[Accounts, Depends(accounts_of)]) -> Response:
        return Response(status_code=204)

    @router.post("/feedback", status_code=204)
    def send_feedback(
        body: FeedbackRequestBody,
        feedback: Annotated[Feedback, Depends(feedback_of)],
        user: Annotated[UserBody, Depends(current_user)],
        request: Request,
    ) -> Response:
        address = request.client.host if request.client else "unknown"
        wait = by_address.wait_s(address)
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MUCH_FEEDBACK, math.ceil(wait)
            )
        kept = feedback.keep(user.id, body)
        emails: FeedbackEmails | None = request.app.state.feedback_emails
        if emails is not None:
            # After the write, outside the request; never fails it.
            emails.notify(user, body, kept)
        return Response(status_code=204)

    return router


def install_feedback(app: FastAPI) -> None:
    """«Send feedback»; after install_accounts, which sets the database and
    the errors. Kept and not emailed until install_feedback_email."""
    app.state.feedback_emails = None
    app.include_router(feedback_routes())


def install_feedback_email(app: FastAPI, emails: FeedbackEmails | None) -> None:
    """Each message emailed, or none without an email setup."""
    app.state.feedback_emails = emails
