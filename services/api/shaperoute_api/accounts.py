"""Accounts: sign up, sign in, who am I, sign out, delete (TASK-114,
ADR-0114, ADR-0115, docs/DATABASE.md).

Email and password. The password is kept only as an Argon2id hash and never
logged. Signing in gives the app a random 32-byte token, sent back as
"Authorization: Bearer <token>"; the database keeps only its SHA-256, so a
copy of it lets nobody in. A session ends 90 days after its last use, or when
the person signs out. Deleting the account deletes everything tied to it, at
once (ON DELETE CASCADE).

Routes, readings and the rest stay open: drawing needs no account. Without a
database (SHAPEROUTE_DATABASE_URL not set) the account endpoints answer 503
accounts_unavailable and nothing else changes.

Wrong passwords are limited per email address, in memory: after
MAX_FAILED_SIGN_INS in FAILED_WINDOW_S the next try gets 429 until the
oldest one is out of the window. The limit of the API on POSTs (access.py)
still applies on top.
"""

from __future__ import annotations

import hashlib
import math
import secrets
import threading
import time
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

import psycopg
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    field_validator,
    model_validator,
)

from shaperoute_api.db import Database
from shaperoute_api.schemas import ErrorBody, ErrorCode, ErrorDetail

SESSION_DAYS = 90
TOKEN_BYTES = 32
MIN_PASSWORD_LENGTH = 8
# Argon2 reads it all: a cap keeps a megabyte "password" from costing time.
MAX_PASSWORD_LENGTH = 128
MAX_EMAIL_LENGTH = 254
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
USERNAME_PATTERN = r"^[A-Za-z0-9_.]{3,20}$"
MAX_FAILED_SIGN_INS = 5
FAILED_WINDOW_S = 15 * 60

Role = Literal["user", "admin"]
# The languages of the app (TASK-210), for the texts of the emails (TASK-284).
Language = Literal["en", "de", "it", "es", "fr"]

NO_DATABASE = "Accounts are not set up on this server."
EMAIL_TAKEN = "An account with this email already exists: sign in instead."
USERNAME_TAKEN = "This username is taken: choose another one."
WRONG_CREDENTIALS = "Wrong email or password."
NOT_SIGNED_IN = "Sign in first: send the token in the Authorization header."
SESSION_EXPIRED = "The session has expired: sign in again."
TOO_YOUNG = "You must be at least 16 to sign up."
TOO_MANY_TRIES = "Too many wrong passwords: wait a few minutes and try again."


class AccountError(Exception):
    """An answer of the account endpoints other than success."""

    def __init__(
        self, status: int, code: ErrorCode, message: str, retry_after_s: int = 0
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after_s = retry_after_s


class SignUpRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(max_length=MAX_EMAIL_LENGTH, pattern=EMAIL_PATTERN)
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH
    )
    username: str = Field(pattern=USERNAME_PATTERN)
    # The "I am at least 16" box (ADR-0114, point 6): false is refused.
    at_least_16: bool
    # The box «Don't send me these emails» (TASK-284): false when it is
    # ticked; without it, «Email when I'm away» is on.
    away_email: StrictBool = True
    # The app's language, for the texts of the emails; English without it.
    language: Language | None = None

    @field_validator("email", mode="before")
    @classmethod
    def plain_email(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class SignInRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(max_length=MAX_EMAIL_LENGTH)
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email", mode="before")
    @classmethod
    def plain_email(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


# What the API reads of an account for its owner, in the order of UserBody.
USER_COLUMNS = (
    "id, email, username, role, created_at, bio, public_id, phone,"
    " notify_email, notify_push, notify_away"
)


class NotificationsBody(BaseModel):
    """The notification switches of «Settings»: «Email notifications» and
    «Push notifications» (TASK-185), off until their owner turns them on,
    and «Email when I'm away» (TASK-284), on until their owner turns it off
    (notifications.py)."""

    email: bool
    push: bool
    away: bool


class UserBody(BaseModel):
    """What the API tells an account about itself: never the password or a
    token. The others see only its profile (profiles.py)."""

    id: int
    email: str
    username: str
    role: Role
    created_at: datetime
    # The profile (TASK-116): the bio, empty without one, and the id the
    # others open the profile with (GET /users/{public_id}).
    bio: str
    public_id: UUID
    # The phone number (TASK-183), in E.164, or None without one: told to its
    # owner only, never part of a profile (contact.py).
    phone: str | None
    # The notification switches (TASK-185): told to their owner only.
    notifications: NotificationsBody

    @model_validator(mode="before")
    @classmethod
    def switches_of_a_row(cls, value: Any) -> Any:
        """A row of `users` keeps the switches in three columns
        (USER_COLUMNS): here they become the object the app reads."""
        if isinstance(value, Mapping) and "notify_email" in value:
            row = dict(value)
            row["notifications"] = {
                "email": row.pop("notify_email"),
                "push": row.pop("notify_push"),
                "away": row.pop("notify_away"),
            }
            return row
        return value


class SessionBody(BaseModel):
    """The only answer that carries a token: the app keeps it in
    expo-secure-store and sends it back as a Bearer token."""

    token: str
    user: UserBody


def token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def now_utc() -> datetime:
    return datetime.now(UTC)


class FailedSignIns:
    """Wrong passwords per email address in the last `window_s` seconds."""

    def __init__(
        self,
        limit: int = MAX_FAILED_SIGN_INS,
        window_s: float = FAILED_WINDOW_S,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window_s = window_s
        self._clock = clock
        self._fails: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def wait_s(self, email: str) -> float:
        """0 if the email may try, or the seconds before it may."""
        now = self._clock()
        with self._lock:
            # Forget addresses with no recent failure, so the dict does not grow.
            for other in [
                e for e, f in self._fails.items() if f[-1] <= now - self._window_s
            ]:
                del self._fails[other]
            fails = self._fails.get(email)
            if fails is None:
                return 0.0
            while fails and fails[0] <= now - self._window_s:
                fails.popleft()
            if len(fails) < self._limit:
                return 0.0
            return fails[0] + self._window_s - now

    def failed(self, email: str) -> None:
        with self._lock:
            self._fails.setdefault(email, deque()).append(self._clock())

    def succeeded(self, email: str) -> None:
        with self._lock:
            self._fails.pop(email, None)


@dataclass
class Accounts:
    """The accounts in the database."""

    database: Database
    now: Callable[[], datetime] = now_utc
    # Argon2id with the library's defaults (RFC 9106's second choice).
    hasher: PasswordHasher = field(default_factory=PasswordHasher)
    failed: FailedSignIns = field(default_factory=FailedSignIns)

    def __post_init__(self) -> None:
        # Checked against when the email is unknown: the answer takes as long
        # as for a wrong password, and says nothing of who has an account.
        self._decoy = self.hasher.hash(secrets.token_urlsafe(16))

    def migrate(self) -> list[str]:
        return self.database.migrate()

    def sign_up(self, body: SignUpRequestBody) -> SessionBody:
        if not body.at_least_16:
            raise AccountError(422, "invalid_request", TOO_YOUNG)
        password_hash = self.hasher.hash(body.password)
        now = self.now()
        with self.database.connect() as conn:
            try:
                row = conn.execute(
                    "INSERT INTO users"
                    " (email, password_hash, username, confirmed_16_at, created_at,"
                    " notify_away, language)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s)"
                    f" RETURNING {USER_COLUMNS}",
                    (
                        body.email,
                        password_hash,
                        body.username,
                        now,
                        now,
                        body.away_email,
                        body.language,
                    ),
                ).fetchone()
            except pg_errors.UniqueViolation as exc:
                if exc.diag.constraint_name == "users_email_key":
                    raise AccountError(409, "email_taken", EMAIL_TAKEN) from None
                raise AccountError(409, "username_taken", USERNAME_TAKEN) from None
            assert row is not None
            token = self._open_session(conn, row["id"], now)
        return SessionBody(token=token, user=UserBody.model_validate(row))

    def sign_in(self, body: SignInRequestBody) -> SessionBody:
        wait = self.failed.wait_s(body.email)
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_TRIES, math.ceil(wait)
            )
        now = self.now()
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE email = %s",
                (body.email,),
            ).fetchone()
            if not self._matches(row, body.password):
                self.failed.failed(body.email)
                raise AccountError(401, "wrong_credentials", WRONG_CREDENTIALS)
            assert row is not None
            self.failed.succeeded(body.email)
            if self.hasher.check_needs_rehash(row["password_hash"]):
                conn.execute(
                    "UPDATE users SET password_hash = %s WHERE id = %s",
                    (self.hasher.hash(body.password), row["id"]),
                )
            token = self._open_session(conn, row["id"], now)
        return SessionBody(token=token, user=UserBody.model_validate(row))

    def user_of(self, token: str) -> UserBody:
        """The account of a token, and its session used now; 401 if none."""
        now = self.now()
        with self.database.connect() as conn:
            row = conn.execute(
                "WITH used AS ("
                " UPDATE sessions SET last_used_at = %s"
                " WHERE token_hash = %s AND last_used_at > %s"
                " RETURNING user_id)"
                f" SELECT {USER_COLUMNS}"
                " FROM users JOIN used ON users.id = used.user_id",
                (now, token_hash(token), now - timedelta(days=SESSION_DAYS)),
            ).fetchone()
            if row is not None:
                return UserBody.model_validate(row)
            # Gone or expired: an expired session is deleted, and said so.
            expired = conn.execute(
                "DELETE FROM sessions WHERE token_hash = %s RETURNING 1",
                (token_hash(token),),
            ).fetchone()
        if expired is not None:
            raise AccountError(401, "session_expired", SESSION_EXPIRED)
        raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)

    def sign_out(self, token: str) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM sessions WHERE token_hash = %s", (token_hash(token),)
            )

    def delete(self, user_id: int) -> None:
        """The account and everything tied to it (ADR-0114, point 7)."""
        with self.database.connect() as conn:
            conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

    def _matches(self, row: DictRow | None, password: str) -> bool:
        stored = self._decoy if row is None else row["password_hash"]
        try:
            self.hasher.verify(stored, password)
        except (VerificationError, InvalidHashError):
            return False
        return row is not None

    def _open_session(
        self, conn: psycopg.Connection[DictRow], user_id: int, now: datetime
    ) -> str:
        token = secrets.token_urlsafe(TOKEN_BYTES)
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, last_used_at)"
            " VALUES (%s, %s, %s, %s)",
            (token_hash(token), user_id, now, now),
        )
        return token


bearer = HTTPBearer(auto_error=False, description="The token of POST /session.")
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def accounts_of(request: Request) -> Accounts:
    accounts: Accounts | None = request.app.state.accounts
    if accounts is None:
        raise AccountError(503, "accounts_unavailable", NO_DATABASE)
    return accounts


def token_of(credentials: Credentials) -> str:
    if credentials is None:
        raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)
    return credentials.credentials


def current_user(
    accounts: Annotated[Accounts, Depends(accounts_of)],
    token: Annotated[str, Depends(token_of)],
) -> UserBody:
    """For the endpoints that need an account: `user = Depends(current_user)`."""
    return accounts.user_of(token)


ACCOUNT_ERRORS: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorBody} for status in (401, 409, 422, 429, 503)
}


def account_routes() -> APIRouter:
    router = APIRouter(tags=["accounts"], responses=ACCOUNT_ERRORS)

    # Signing up signs in: the answer is the same as POST /session.
    @router.post("/accounts", status_code=201)
    def sign_up(
        body: SignUpRequestBody,
        accounts: Annotated[Accounts, Depends(accounts_of)],
    ) -> SessionBody:
        return accounts.sign_up(body)

    @router.post("/session")
    def sign_in(
        body: SignInRequestBody,
        accounts: Annotated[Accounts, Depends(accounts_of)],
    ) -> SessionBody:
        return accounts.sign_in(body)

    # Only this phone's session: the others stay signed in.
    @router.delete("/session", status_code=204)
    def sign_out(
        accounts: Annotated[Accounts, Depends(accounts_of)],
        token: Annotated[str, Depends(token_of)],
    ) -> Response:
        accounts.user_of(token)
        accounts.sign_out(token)
        return Response(status_code=204)

    @router.get("/me")
    def me(user: Annotated[UserBody, Depends(current_user)]) -> UserBody:
        return user

    @router.delete("/me", status_code=204)
    def delete_me(
        request: Request,
        accounts: Annotated[Accounts, Depends(accounts_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        # What the account has outside this database goes first: the access
        # an athlete gave on Strava (strava.py). Each sees to its own
        # failures: none of them keeps the account from being deleted.
        leaving: list[Callable[[int], None]] = request.app.state.before_account_delete
        for leave in leaving:
            leave(user.id)
        accounts.delete(user.id)
        return Response(status_code=204)

    return router


def account_answer(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AccountError)
    detail = ErrorDetail(code=exc.code, message=exc.message)
    headers = {"Retry-After": str(exc.retry_after_s)} if exc.retry_after_s else None
    return JSONResponse(
        status_code=exc.status,
        content=ErrorBody(error=detail).model_dump(),
        headers=headers,
    )


def install_accounts(app: FastAPI, accounts: Accounts | None) -> None:
    """The account endpoints and their errors; `accounts` None: 503."""
    app.state.accounts = accounts
    app.state.before_account_delete = []
    app.add_exception_handler(AccountError, account_answer)
    app.include_router(account_routes())
