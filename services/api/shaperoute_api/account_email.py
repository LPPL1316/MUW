"""The emails of an account (TASK-300, ADR-0261, docs/API.md, «Confirmed
email and forgotten password»): the link that confirms its address, at
sign-up and when «Settings» changes it, the notice to the old address, and
the link that chooses a new password.

Each link opens a page of this API, as the link of the email to who is away
(away_email.py): the app has no universal links without a native build.
GET shows the page; only its button, a POST, changes something, since mail
filters open links to check them. The pages need no API key (access.py).

A token is public_id.expiry.tag, the tag an HMAC with
SHAPEROUTE_EMAIL_SECRET of what the link is for, the account, the expiry
and the state the link changes, read again from the database when it is
opened: the address to confirm; the address and the password's hash for a
new password. So a link works once (then the address is confirmed, or the
password is another one), dies when the address changes in between, and
nothing is kept for it.

POST /password-reset answers 202 whoever has the address: the account is
looked for, and its email sent, after the answer, by the thread that sends
them all, so not even the time says who is a member. A new password closes
every session of the account and drops the change of address it waits for.

Limits, in memory as the wrong passwords: RESETS_PER_HOUR asks for a new
password per address, an account's or not; ASKS_PER_HOUR emails asked by
an account (sent again, or a change of address); EMAILS_PER_HOUR in all,
beyond which nothing goes out (logged). The POSTs of access.py count too.

On with the variables of the email to who is away (away_email.AwaySetup):
without them none of these paths is there, and a change of address holds
at once, as before.

Addresses, tokens and the key are never logged.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import math
import queue
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal
from urllib.parse import parse_qs
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response
from fastapi.responses import HTMLResponse
from psycopg import errors as pg_errors
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from shaperoute_api.access import RateLimiter
from shaperoute_api.account_email_texts import (
    PASSWORD_FIELD,
    REPEAT_FIELD,
    Written,
    confirm_email,
    confirm_page,
    confirmed_page,
    notice_email,
    password_problem,
    reset_done_page,
    reset_email,
    reset_page,
    taken_page,
    wrong_link_page,
)
from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    MAX_EMAIL_LENGTH,
    MAX_PASSWORD_LENGTH,
    NOT_SIGNED_IN,
    USER_COLUMNS,
    AccountError,
    Accounts,
    Language,
    UserBody,
    current_user,
    now_utc,
)
from shaperoute_api.away_email import (
    MAX_TOKEN_LENGTH,
    PAGE_HEADERS,
    SEND_GAP_S,
    TAG_HEX,
    language_sql,
)
from shaperoute_api.resend_email import Email, Resend

log = logging.getLogger(__name__)

STATUS_PATH = "/account-email"
RESET_ASK_PATH = "/password-reset"
CONFIRM_PATH = "/email/confirm"
RESET_PATH = "/password/reset"
CONFIRM_FOR = timedelta(days=7)
RESET_FOR = timedelta(hours=1)
HOUR_S = 3600.0
RESETS_PER_HOUR = 3
ASKS_PER_HOUR = 3
EMAILS_PER_HOUR = 300
# Two passwords of MAX_PASSWORD_LENGTH, form-encoded, are far less.
MAX_FORM_BYTES = 16 * 1024
# A page with a token or a password field: in no frame, posting only here.
LINK_HEADERS = {
    **PAGE_HEADERS,
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": (
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self';"
        " frame-ancestors 'none'"
    ),
}

TOO_MANY_EMAILS = "Too many emails asked: wait a few minutes and try again."

Purpose = Literal["confirm", "reset"]
# What opening a confirmation link did.
Confirmed = Literal["confirmed", "taken", "gone"]
PATHS: dict[Purpose, str] = {"confirm": CONFIRM_PATH, "reset": RESET_PATH}


# --- The links ---


@dataclass(frozen=True)
class Token:
    """A token read, not yet checked against the account."""

    public_id: UUID
    expires_s: int
    tag: str


def read_token(text: str) -> Token | None:
    """The parts of a token, or None when it cannot be one of ours."""
    head, expires, tag = (text.split(".") + ["", ""])[:3]
    if text.count(".") != 2 or len(head) != len(UUID(int=0).hex):
        return None
    if not (expires.isdigit() and len(expires) <= 12 and len(tag) == TAG_HEX):
        return None
    try:
        public_id = UUID(hex=head)
    except ValueError:
        return None
    if public_id.hex != head or not all(c in "0123456789abcdef" for c in tag):
        return None
    return Token(public_id, int(expires), tag)


@dataclass(frozen=True)
class AccountLinks:
    """The links of the emails, made and checked with the same secret as
    the link «Don't send me these emails», each use with a prefix of its own."""

    secret: bytes = field(repr=False)
    # "https://api.getmuw.app": where the API answers from outside.
    base_url: str

    def _tag(
        self, purpose: Purpose, public_id: UUID, expires_s: int, state: bytes
    ) -> str:
        message = b"".join(
            [
                f"account-email-{purpose}:".encode(),
                public_id.bytes,
                expires_s.to_bytes(8, "big"),
                state,
            ]
        )
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()[:TAG_HEX]

    def token(
        self, purpose: Purpose, public_id: UUID, expires: datetime, state: bytes
    ) -> str:
        expires_s = int(expires.timestamp())
        tag = self._tag(purpose, public_id, expires_s, state)
        return f"{public_id.hex}.{expires_s}.{tag}"

    def url(
        self, purpose: Purpose, public_id: UUID, expires: datetime, state: bytes
    ) -> str:
        token = self.token(purpose, public_id, expires, state)
        return f"{self.base_url}{PATHS[purpose]}?t={token}"

    def holds(self, purpose: Purpose, token: Token, state: bytes) -> bool:
        """Whether `token` was made for `state`; its expiry is not looked at."""
        expected = self._tag(purpose, token.public_id, token.expires_s, state)
        return hmac.compare_digest(token.tag.encode(), expected.encode())


def confirm_state(address: str) -> bytes:
    return address.encode()


def reset_state(email: str, password_hash: str) -> bytes:
    return email.encode() + b"\0" + password_hash.encode()


# --- Sending, one at a time, after the answer ---

Job = Callable[[], None]


@dataclass
class Outbox:
    """The jobs that send emails, in one thread of the API, SEND_GAP_S
    apart (Resend takes two a second). A job that fails is logged."""

    sleep: Callable[[float], None] = time.sleep
    _jobs: queue.SimpleQueue[Job] = field(default_factory=queue.SimpleQueue)
    _thread: threading.Thread | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def __call__(self, job: Job) -> None:
        with self._lock:
            if self._thread is None:
                self._thread = threading.Thread(
                    target=self._run, name="account-email", daemon=True
                )
                self._thread.start()
        self._jobs.put(job)

    def _run(self) -> None:
        while True:
            job = self._jobs.get()
            try:
                job()
            except Exception:
                log.exception("account email: a job failed")
            self.sleep(SEND_GAP_S)


# --- The emails of the accounts ---


class PasswordResetRequestBody(BaseModel):
    """POST /password-reset: the address of the account, and the app's
    language for the email."""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(max_length=MAX_EMAIL_LENGTH)
    language: Language | None = None

    @field_validator("email", mode="before")
    @classmethod
    def plain_email(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class EmailServiceBody(BaseModel):
    """GET /account-email: this server sends the emails of the accounts."""

    on: Literal[True] = True


# What a link needs of its account, by public_id.
ACCOUNT_SQL = (
    "SELECT u.id, u.email, u.username, u.pending_email, u.password_hash,"
    f" u.email_confirmed, {language_sql('u')} AS language"
    " FROM users u WHERE u.public_id = %s"
)


@dataclass
class AccountEmails:
    """The links, the emails and their limits, in the database of the
    accounts. `later` runs the jobs that send: the Outbox's thread, or at
    once in the tests."""

    accounts: Accounts
    resend: Resend
    links: AccountLinks
    later: Callable[[Job], None] = field(default_factory=Outbox)
    now: Callable[[], datetime] = now_utc
    clock: Callable[[], float] = time.monotonic

    def __post_init__(self) -> None:
        self.resets = RateLimiter(RESETS_PER_HOUR, HOUR_S, self.clock)
        self.asks = RateLimiter(ASKS_PER_HOUR, HOUR_S, self.clock)
        self.all = RateLimiter(EMAILS_PER_HOUR, HOUR_S, self.clock)

    def _deliver(self, to: str, written: Written) -> None:
        if self.all.wait_s("all") > 0:
            log.warning("account email: %d in an hour, not sent", EMAILS_PER_HOUR)
            return
        self.resend.deliver(Email(to, written.subject, written.text, written.html))

    def _confirm_url(self, public_id: UUID, address: str) -> str:
        expires = self.now() + CONFIRM_FOR
        return self.links.url("confirm", public_id, expires, confirm_state(address))

    def _language(self, user_id: int) -> Language:
        with self.accounts.database.connect() as conn:
            row = conn.execute(
                f"SELECT {language_sql('u')} AS language FROM users u WHERE u.id = %s",
                (user_id,),
            ).fetchone()
        return "en" if row is None else row["language"]

    # --- From the app ---

    def welcome(self, user: UserBody, language: Language | None) -> None:
        """The link to the address of a new account, in the app's language."""
        url = self._confirm_url(user.public_id, user.email)
        written = confirm_email(language or "en", user.username, url, changing=False)
        self.later(lambda: self._deliver(user.email, written))

    def may_ask(self, user: UserBody) -> None:
        wait = self.asks.wait_s(str(user.id))
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_EMAILS, math.ceil(wait)
            )

    def changing(self, user: UserBody, new_email: str) -> None:
        """The link to `new_email`, the notice to the address of now."""
        url = self._confirm_url(user.public_id, new_email)

        def send() -> None:
            language = self._language(user.id)
            self._deliver(
                new_email, confirm_email(language, user.username, url, changing=True)
            )
            self._deliver(user.email, notice_email(language, user.username, new_email))

        self.later(send)

    def send_again(self, user: UserBody) -> bool:
        """The link again, to the address that waits or to the one of now;
        False when there is nothing to confirm."""
        if user.pending_email is None and user.email_confirmed:
            return False
        self.may_ask(user)
        address = user.pending_email or user.email
        url = self._confirm_url(user.public_id, address)
        changing = user.pending_email is not None

        def send() -> None:
            language = self._language(user.id)
            self._deliver(
                address, confirm_email(language, user.username, url, changing)
            )

        self.later(send)
        return True

    def cancel_change(self, user: UserBody) -> UserBody:
        with self.accounts.database.connect() as conn:
            row = conn.execute(
                "UPDATE users SET pending_email = NULL WHERE id = %s"
                f" RETURNING {USER_COLUMNS}",
                (user.id,),
            ).fetchone()
        if row is None:
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)
        return UserBody.model_validate(row)

    def ask_reset(self, body: PasswordResetRequestBody) -> None:
        """429 after RESETS_PER_HOUR for the address, whoever has it; else
        the email goes later, when an account has the address."""
        wait = self.resets.wait_s(body.email)
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_EMAILS, math.ceil(wait)
            )
        self.later(lambda: self._send_reset(body.email, body.language))

    def _send_reset(self, email: str, asked: Language | None) -> None:
        with self.accounts.database.connect() as conn:
            row = conn.execute(
                "SELECT u.public_id, u.username, u.password_hash,"
                f" {language_sql('u')} AS language FROM users u WHERE u.email = %s",
                (email,),
            ).fetchone()
        if row is None:
            return
        expires = self.now() + RESET_FOR
        state = reset_state(email, row["password_hash"])
        url = self.links.url("reset", row["public_id"], expires, state)
        language: Language = asked or row["language"]
        self._deliver(email, reset_email(language, row["username"], url))

    # --- From the links ---

    def account_of(self, text: str) -> dict[str, Any] | None:
        """The account of a token that has not expired; None otherwise."""
        token = read_token(text)
        if token is None or token.expires_s <= self.now().timestamp():
            return None
        with self.accounts.database.connect() as conn:
            row = conn.execute(ACCOUNT_SQL, (token.public_id,)).fetchone()
        if row is None:
            return None
        return {**row, "token": token}

    def language_of(self, text: str) -> Language:
        """The language of a page whose link does not work: the account's
        when the token says which one, else English."""
        token = read_token(text)
        if token is None:
            return "en"
        with self.accounts.database.connect() as conn:
            row = conn.execute(ACCOUNT_SQL, (token.public_id,)).fetchone()
        return "en" if row is None else row["language"]

    def address_of(self, account: dict[str, Any]) -> str | None:
        """The address a confirmation token was made for: the one waiting,
        or the one of now; None when it is neither."""
        token: Token = account["token"]
        for address in (account["pending_email"], account["email"]):
            if address is not None and self.links.holds(
                "confirm", token, confirm_state(address)
            ):
                return address
        return None

    def confirm(self, account: dict[str, Any], address: str) -> Confirmed:
        """`address` the account's, confirmed; "taken" when another account
        has it now, "gone" when the account asked for another one since it
        was read."""
        with self.accounts.database.connect() as conn:
            try:
                row = conn.execute(
                    "UPDATE users SET email = %(address)s, email_confirmed = true,"
                    " pending_email = CASE WHEN pending_email = %(address)s"
                    " THEN NULL ELSE pending_email END"
                    " WHERE id = %(id)s AND (email = %(address)s"
                    " OR pending_email = %(address)s) RETURNING id",
                    {"address": address, "id": account["id"]},
                ).fetchone()
            except pg_errors.UniqueViolation:
                return "taken"
        return "gone" if row is None else "confirmed"

    def reset_holds(self, account: dict[str, Any]) -> bool:
        state = reset_state(account["email"], account["password_hash"])
        return self.links.holds("reset", account["token"], state)

    def reset(self, account: dict[str, Any], password: str) -> bool:
        """The new password, every session closed, the change waiting
        dropped, the address confirmed; False when the password changed
        since the account was read (the link was used)."""
        accounts = self.accounts
        password_hash = accounts.hasher.hash(password)
        with accounts.database.connect() as conn:
            row = conn.execute(
                "UPDATE users SET password_hash = %s, pending_email = NULL,"
                " email_confirmed = true"
                " WHERE id = %s AND password_hash = %s RETURNING id",
                (password_hash, account["id"], account["password_hash"]),
            ).fetchone()
            if row is None:
                return False
            conn.execute("DELETE FROM sessions WHERE user_id = %s", (account["id"],))
        accounts.failed.succeeded(account["email"])
        return True


# --- The routes ---


def account_emails_of(request: Request) -> AccountEmails:
    emails: AccountEmails = request.app.state.account_emails
    return emails


Emails = Annotated[AccountEmails, Depends(account_emails_of)]


def account_email_routes() -> APIRouter:
    router = APIRouter(tags=["accounts"], responses=ACCOUNT_ERRORS)

    # The app asks this before it shows «Forgot password?» and «Email not
    # confirmed»: 404 from a server without these emails.
    @router.get(STATUS_PATH)
    def status(_: Emails) -> EmailServiceBody:
        return EmailServiceBody()

    # The same answer whoever has the address.
    @router.post(RESET_ASK_PATH, status_code=202)
    def ask_reset(body: PasswordResetRequestBody, emails: Emails) -> Response:
        emails.ask_reset(body)
        return Response(status_code=202)

    # 202: on its way; 204: nothing to confirm.
    @router.post("/me/email/confirmation", status_code=202)
    def send_again(
        emails: Emails, user: Annotated[UserBody, Depends(current_user)]
    ) -> Response:
        return Response(status_code=202 if emails.send_again(user) else 204)

    @router.delete("/me/email/pending")
    def cancel_change(
        emails: Emails, user: Annotated[UserBody, Depends(current_user)]
    ) -> UserBody:
        return emails.cancel_change(user)

    return router


def page(html: str, status: int = 200) -> HTMLResponse:
    return HTMLResponse(html, status, LINK_HEADERS)


TokenQuery = Annotated[str, Query(max_length=MAX_TOKEN_LENGTH)]


def link_routes() -> APIRouter:
    # No JSON, no app: pages for a browser, out of the API's docs.
    router = APIRouter(include_in_schema=False)

    def wrong(emails: AccountEmails, t: str) -> HTMLResponse:
        return page(wrong_link_page(emails.language_of(t)), 404)

    @router.get(CONFIRM_PATH, response_class=HTMLResponse)
    def ask_confirm(emails: Emails, t: TokenQuery = "") -> HTMLResponse:
        account = emails.account_of(t)
        address = None if account is None else emails.address_of(account)
        if account is None or address is None:
            return wrong(emails, t)
        if address == account["email"] and account["email_confirmed"]:
            return page(confirmed_page(account["language"], address))
        action = f"{CONFIRM_PATH}?t={t}"
        return page(confirm_page(account["language"], address, action))

    @router.post(CONFIRM_PATH, response_class=HTMLResponse)
    def confirm(emails: Emails, t: TokenQuery = "") -> HTMLResponse:
        account = emails.account_of(t)
        address = None if account is None else emails.address_of(account)
        if account is None or address is None:
            return wrong(emails, t)
        done = emails.confirm(account, address)
        if done == "gone":
            return wrong(emails, t)
        if done == "taken":
            return page(taken_page(account["language"]), 409)
        return page(confirmed_page(account["language"], address))

    @router.get(RESET_PATH, response_class=HTMLResponse)
    def ask_password(emails: Emails, t: TokenQuery = "") -> HTMLResponse:
        account = emails.account_of(t)
        if account is None or not emails.reset_holds(account):
            return wrong(emails, t)
        action = f"{RESET_PATH}?t={t}"
        return page(reset_page(account["language"], account["username"], action))

    @router.post(RESET_PATH, response_class=HTMLResponse)
    async def reset(
        request: Request, emails: Emails, t: TokenQuery = ""
    ) -> HTMLResponse:
        body = await request.body()
        # Far longer than two passwords: never read, said too long.
        form = (
            {}
            if len(body) > MAX_FORM_BYTES
            else parse_qs(body.decode(errors="replace"))
        )
        password = form.get(PASSWORD_FIELD, [""])[0]
        repeat = form.get(REPEAT_FIELD, [""])[0]
        if len(body) > MAX_FORM_BYTES:
            password = repeat = "?" * (MAX_PASSWORD_LENGTH + 1)
        # The database and Argon2 take time: out of the event loop.
        return await run_in_threadpool(save_password, emails, t, password, repeat)

    def save_password(
        emails: AccountEmails, t: str, password: str, repeat: str
    ) -> HTMLResponse:
        account = emails.account_of(t)
        if account is None or not emails.reset_holds(account):
            return wrong(emails, t)
        language: Language = account["language"]
        problem = password_problem(language, password, repeat)
        if problem is not None:
            action = f"{RESET_PATH}?t={t}"
            username = account["username"]
            return page(reset_page(language, username, action, problem), 422)
        if not emails.reset(account, password):
            return wrong(emails, t)
        return page(reset_done_page(language))

    return router


def install_account_email(app: FastAPI, emails: AccountEmails | None) -> None:
    """The emails of the accounts, after install_accounts and
    install_contact; nothing when the emails are off."""
    if emails is None:
        return
    app.state.account_emails = emails
    app.state.after_sign_up.append(emails.welcome)
    app.state.email_change = emails
    app.include_router(account_email_routes())
    app.include_router(link_routes())
