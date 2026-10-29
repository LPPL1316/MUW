"""Signing in and up with Apple and with Google (TASK-322, ADR-0282,
docs/API.md).

The app gets an id_token from Apple's or Google's own sheet and sends it to
POST /session/{provider}. The token is read here, with the provider's public
keys kept in memory as long as their Cache-Control says: its signature, its
issuer, its audience (this app), its expiry, a verified email, and for Apple
the nonce the app made. Nothing is asked of the provider at each sign-in.

A known identity opens its account. An email that already has an account
links the identity to it (the user's choice 4); if that account never
confirmed its email (TASK-300), its password of before and its sessions
end: Apple or Google just proved the address belongs to who signs in now.
Otherwise 404 new_account with the email, and the app sends the same
request again with a username: 201, an account with a random password
nobody knows (Accounts.unusable_password_hash).

Apple: the code of the sign-in becomes a refresh token, kept only to revoke
the access when the account is deleted (App Review 5.1.1(v)); a revocation
that fails does not stop the deletion. Google: no token is kept.

A provider is off without its keys in the environment: 503
provider_unavailable, and GET /session/providers leaves it out. Nothing
secret is logged: not a token, not a code, not the key.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import os
import re
import threading
import time
import urllib.parse
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Any, Literal

import jwt
import psycopg
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    EMAIL_PATTERN,
    MAX_EMAIL_LENGTH,
    TOO_YOUNG,
    USER_COLUMNS,
    USERNAME_PATTERN,
    AccountError,
    Accounts,
    Language,
    SessionBody,
    UserBody,
    accounts_of,
    now_utc,
    open_session,
)
from shaperoute_api.schemas import ErrorDetail
from shaperoute_api.strava_client import Call, Reply, Send, send_over_network

log = logging.getLogger(__name__)

Provider = Literal["apple", "google"]
PROVIDERS: tuple[Provider, ...] = ("apple", "google")
NAMES: dict[Provider, str] = {"apple": "Apple", "google": "Google"}

APPLE_TEAM_VARIABLE = "SHAPEROUTE_APPLE_TEAM_ID"
APPLE_KEY_ID_VARIABLE = "SHAPEROUTE_APPLE_KEY_ID"
# The .p8 of the key «Sign in with Apple», its lines joined with "\n".
APPLE_KEY_VARIABLE = "SHAPEROUTE_APPLE_KEY_P8"
# The OAuth clients whose tokens are this app's, comma-separated: the iOS
# one and the web one (the `webClientId` that gives Android its id_token).
GOOGLE_CLIENTS_VARIABLE = "SHAPEROUTE_GOOGLE_CLIENT_IDS"

# The app's bundle (apps/mobile/app.json): the audience of Apple's tokens,
# and the client of the calls to Apple.
APPLE_BUNDLE_ID = "com.lppl1316.sgrava"
APPLE_ISSUER = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
GOOGLE_ISSUERS = frozenset({"https://accounts.google.com", "accounts.google.com"})
GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs"

# Both providers sign their id_tokens with it; Apple wants its client
# secret signed with the .p8, an ES256 key.
TOKEN_ALGORITHM = "RS256"
SECRET_ALGORITHM = "ES256"
# A token a little late or early on this server's clock still holds.
LEEWAY_S = 60
# The keys are kept as long as their Cache-Control says, within these
# bounds; a token signed with a key not among them asks for them again, at
# most once every REFETCH_S (the providers rotate them).
DEFAULT_KEYS_S = 3600
MIN_KEYS_S = 60
MAX_KEYS_S = 24 * 3600
REFETCH_S = 60
MAX_AGE = re.compile(r"max-age=(\d+)")
# Apple's client secret is made for each call, and lasts this long.
CLIENT_SECRET_S = 300

# Google's id_tokens are about 1.2 kB, Apple's less.
MAX_ID_TOKEN_LENGTH = 8192
MAX_CODE_LENGTH = 1024
MAX_NONCE_LENGTH = 256

PROVIDER_OFF = "Signing in with {name} is not set up on this server."
PROVIDER_DOWN = "{name} does not answer: try again in a moment."
WRONG_TOKEN = "The sign-in with {name} could not be checked: try again."
NEW_ACCOUNT = "No account yet: choose a username to make one."


class ProviderSignInRequestBody(BaseModel):
    """POST /session/{provider}. The first time, without `username`: 404
    new_account. Then the same again with the username and the box."""

    model_config = ConfigDict(extra="forbid")

    id_token: str = Field(min_length=1, max_length=MAX_ID_TOKEN_LENGTH)
    # Apple only: the code of the same sign-in, for the refresh token that
    # revokes the access when the account is deleted.
    authorization_code: str | None = Field(default=None, max_length=MAX_CODE_LENGTH)
    # Apple only: the string the app made; Apple got its SHA-256, in hex.
    nonce: str | None = Field(default=None, max_length=MAX_NONCE_LENGTH)
    # A new account only, as in POST /accounts: ignored once the identity
    # or its email has an account.
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    at_least_16: bool = False
    away_email: StrictBool = True
    language: Language | None = None


class SignInProvidersBody(BaseModel):
    """GET /session/providers: the ones this server has the keys of; the
    app shows only their buttons."""

    providers: list[Provider]


class NewAccountDetail(ErrorDetail):
    # The address Apple or Google gave, shown above the username.
    email: str


class NewAccountBody(BaseModel):
    """404 new_account: the error of every answer, with the email."""

    error: NewAccountDetail


class NewAccount(Exception):
    """No account for this identity nor its email, and no username."""

    def __init__(self, email: str) -> None:
        super().__init__(NEW_ACCOUNT)
        self.email = email


@dataclass(frozen=True)
class Identity:
    """Who Apple or Google says signs in: their id, and a verified email."""

    provider: Provider
    subject: str
    email: str


@dataclass(frozen=True)
class AppleSetup:
    """This server's key «Sign in with Apple», for the calls to Apple."""

    team_id: str
    key_id: str
    private_key: str = field(repr=False)
    bundle_id: str = APPLE_BUNDLE_ID


@dataclass(frozen=True)
class GoogleSetup:
    """The OAuth clients whose id_tokens are this app's."""

    client_ids: tuple[str, ...]


def keys_lifetime_s(cache_control: str | None) -> float:
    found = MAX_AGE.search(cache_control or "")
    seconds = int(found.group(1)) if found else DEFAULT_KEYS_S
    return min(max(seconds, MIN_KEYS_S), MAX_KEYS_S)


class KeySet:
    """A provider's public keys (its JWKS), kept in memory."""

    def __init__(
        self, url: str, send: Send, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._url = url
        self._send = send
        self._clock = clock
        self._keys: dict[str, jwt.PyJWK] = {}
        self._until = -math.inf
        self._asked = -math.inf
        self._lock = threading.Lock()

    def key(self, kid: str) -> jwt.PyJWK | None:
        """The key `kid`, None when the provider has no such key. Raises
        OSError when there are no keys at all to read it with."""
        with self._lock:
            now = self._clock()
            unknown = kid not in self._keys and now - self._asked >= REFETCH_S
            if now >= self._until or unknown:
                self._fetch(now)
            return self._keys.get(kid)

    def _fetch(self, now: float) -> None:
        self._asked = now
        try:
            reply = self._send(Call("GET", self._url, {"Accept": "application/json"}))
            if reply.status != 200:
                raise OSError(f"HTTP {reply.status}")
            found = jwt.PyJWKSet.from_dict(json.loads(reply.body)).keys
        except (OSError, ValueError, jwt.PyJWTError) as exc:
            log.warning("Keys of %s not read: %s", self._url, exc)
            if not self._keys:
                raise OSError(f"no keys from {self._url}") from None
            # The ones of before, for one more minute.
            self._until = now + MIN_KEYS_S
            return
        self._keys = {key.key_id: key for key in found if key.key_id}
        self._until = now + keys_lifetime_s(reply.headers.get("cache-control"))


def nonce_holds(nonce: str | None, claimed: Any) -> bool:
    """Apple's token carries the SHA-256 of the app's nonce, in hex."""
    if nonce is None or not isinstance(claimed, str):
        return False
    return hmac.compare_digest(hashlib.sha256(nonce.encode()).hexdigest(), claimed)


class SignInProviders:
    """Apple and Google as this server checks their tokens, and the calls
    to Apple for its refresh tokens."""

    def __init__(
        self,
        apple: AppleSetup | None = None,
        google: GoogleSetup | None = None,
        send: Send = send_over_network,
        now: Callable[[], datetime] = now_utc,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.apple = apple
        self.google = google
        self._send = send
        self._now = now
        self._keys = {
            "apple": KeySet(APPLE_KEYS_URL, send, clock),
            "google": KeySet(GOOGLE_KEYS_URL, send, clock),
        }

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> SignInProviders:
        """Apple with its three variables, Google with its clients; each
        off without them."""
        team = environ.get(APPLE_TEAM_VARIABLE, "").strip()
        key_id = environ.get(APPLE_KEY_ID_VARIABLE, "").strip()
        p8 = environ.get(APPLE_KEY_VARIABLE, "").replace("\\n", "\n").strip()
        apple = AppleSetup(team, key_id, p8) if team and key_id and p8 else None
        if apple is not None and not secret_signs(apple):
            log.error("Apple off: %s is not the .p8 of a key", APPLE_KEY_VARIABLE)
            apple = None
        clients = environ.get(GOOGLE_CLIENTS_VARIABLE, "")
        ids = tuple(part.strip() for part in clients.split(",") if part.strip())
        return cls(apple, GoogleSetup(ids) if ids else None)

    @property
    def names(self) -> list[Provider]:
        on = {"apple": self.apple is not None, "google": self.google is not None}
        return [provider for provider in PROVIDERS if on[provider]]

    def identity(
        self, provider: Provider, id_token: str, nonce: str | None
    ) -> Identity:
        """Who the token says signs in; 401 wrong_credentials for a token
        that does not hold, 503 provider_unavailable for a provider off or
        whose keys cannot be read."""
        name = NAMES[provider]
        if provider == "apple" and self.apple is not None:
            audiences: tuple[str, ...] = (self.apple.bundle_id,)
            issuers = frozenset({APPLE_ISSUER})
        elif provider == "google" and self.google is not None:
            audiences, issuers = self.google.client_ids, GOOGLE_ISSUERS
        else:
            raise AccountError(
                503, "provider_unavailable", PROVIDER_OFF.format(name=name)
            )
        wrong = AccountError(401, "wrong_credentials", WRONG_TOKEN.format(name=name))
        try:
            header = jwt.get_unverified_header(id_token)
        except jwt.PyJWTError:
            raise wrong from None
        kid = header.get("kid")
        if header.get("alg") != TOKEN_ALGORITHM or not isinstance(kid, str):
            raise wrong
        try:
            key = self._keys[provider].key(kid)
        except OSError:
            raise AccountError(
                503, "provider_unavailable", PROVIDER_DOWN.format(name=name)
            ) from None
        if key is None:
            raise wrong
        try:
            # The times against this server's clock, below: the tests set it.
            claims = jwt.decode(
                id_token,
                key,
                algorithms=[TOKEN_ALGORITHM],
                audience=audiences,
                issuer=issuers,
                options={
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_nbf": False,
                    "require": ["iss", "aud", "sub", "exp", "iat"],
                },
            )
        except jwt.PyJWTError:
            raise wrong from None
        now = self._now().timestamp()
        expires, issued = claims["exp"], claims["iat"]
        if not isinstance(expires, int | float) or expires + LEEWAY_S < now:
            raise wrong
        if not isinstance(issued, int | float) or issued - LEEWAY_S > now:
            raise wrong
        if provider == "apple" and not nonce_holds(nonce, claims.get("nonce")):
            raise wrong
        subject, email = claims["sub"], claims.get("email")
        # Apple says it as a string, Google as a boolean.
        verified = claims.get("email_verified") in (True, "true")
        if not isinstance(subject, str) or not subject or not verified:
            raise wrong
        if not isinstance(email, str):
            raise wrong
        email = email.strip().lower()
        # The limits of POST /accounts, which the users table checks too.
        if len(email) > MAX_EMAIL_LENGTH or not re.match(EMAIL_PATTERN, email):
            raise wrong
        return Identity(provider, subject, email)

    def apple_refresh_token(self, code: str) -> str | None:
        """The refresh token of Apple's code; None when Apple does not give
        it: the sign-in goes on, and the next one tries again."""
        reply = self._call_apple(
            APPLE_TOKEN_URL, {"code": code, "grant_type": "authorization_code"}
        )
        if reply is None or reply.status != 200:
            log.warning("Apple's code not exchanged: HTTP %s", reply and reply.status)
            return None
        try:
            token = json.loads(reply.body).get("refresh_token")
        except (ValueError, AttributeError):
            token = None
        return token if isinstance(token, str) and token else None

    def revoke_apple(self, refresh_token: str) -> bool:
        """Tells Apple that the account is gone; False, and a line in the
        log, when Apple does not take it."""
        reply = self._call_apple(
            APPLE_REVOKE_URL,
            {"token": refresh_token, "token_type_hint": "refresh_token"},
        )
        if reply is None or reply.status != 200:
            log.warning("An Apple access not revoked: HTTP %s", reply and reply.status)
            return False
        return True

    def _call_apple(self, url: str, fields: dict[str, str]) -> Reply | None:
        if self.apple is None:
            return None
        form = {
            "client_id": self.apple.bundle_id,
            "client_secret": client_secret(self.apple, self._now()),
            **fields,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        body = urllib.parse.urlencode(form).encode()
        try:
            return self._send(Call("POST", url, headers, body))
        except OSError as exc:
            log.warning("No answer from Apple: %s", type(exc).__name__)
            return None


def client_secret(apple: AppleSetup, now: datetime) -> str:
    """The client secret of a call to Apple: a JWT signed with the .p8."""
    issued = int(now.timestamp())
    claims = {
        "iss": apple.team_id,
        "iat": issued,
        "exp": issued + CLIENT_SECRET_S,
        "aud": APPLE_ISSUER,
        "sub": apple.bundle_id,
    }
    return jwt.encode(
        claims,
        apple.private_key,
        algorithm=SECRET_ALGORITHM,
        headers={"kid": apple.key_id},
    )


def secret_signs(apple: AppleSetup) -> bool:
    try:
        client_secret(apple, now_utc())
    except (ValueError, TypeError, jwt.PyJWTError):
        return False
    return True


@dataclass
class ProviderAccounts:
    """The accounts the identities open, link or make."""

    accounts: Accounts
    providers: SignInProviders

    def sign_in(
        self, provider: Provider, body: ProviderSignInRequestBody
    ) -> tuple[SessionBody, bool]:
        """The session, and whether the account is new (201)."""
        identity = self.providers.identity(provider, body.id_token, body.nonce)
        database = self.accounts.database
        # What is known decides, before anything slow: 404, or the box.
        with database.connect() as conn:
            known = conn.execute(
                "SELECT apple_refresh_token IS NOT NULL AS revocable"
                " FROM user_identities WHERE provider = %s AND subject = %s",
                (provider, identity.subject),
            ).fetchone()
            owned = known is not None or (
                conn.execute(
                    "SELECT 1 FROM users WHERE email = %s", (identity.email,)
                ).fetchone()
                is not None
            )
        if not owned:
            if body.username is None:
                raise NewAccount(identity.email)
            if not body.at_least_16:
                raise AccountError(422, "invalid_request", TOO_YOUNG)
        refresh_token = None
        code = body.authorization_code
        if provider == "apple" and code and (known is None or not known["revocable"]):
            refresh_token = self.providers.apple_refresh_token(code)
        # Argon2 outside the transaction, as for POST /accounts.
        spare = None if known is not None else self.accounts.unusable_password_hash()
        now = self.accounts.now()
        with database.connect() as conn:
            user_id, created = self._settle(
                conn, identity, body, refresh_token, spare, now
            )
            token = open_session(conn, user_id, now)
            row = conn.execute(
                f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,)
            ).fetchone()
        assert row is not None
        return SessionBody(token=token, user=UserBody.model_validate(row)), created

    def _settle(
        self,
        conn: psycopg.Connection[DictRow],
        identity: Identity,
        body: ProviderSignInRequestBody,
        refresh_token: str | None,
        spare: str | None,
        now: datetime,
    ) -> tuple[int, bool]:
        known = conn.execute(
            "UPDATE user_identities SET email = %s,"
            " apple_refresh_token = coalesce(%s, apple_refresh_token)"
            " WHERE provider = %s AND subject = %s RETURNING user_id",
            (identity.email, refresh_token, identity.provider, identity.subject),
        ).fetchone()
        if known is not None:
            return int(known["user_id"]), False
        password_hash = spare or self.accounts.unusable_password_hash()
        owner = conn.execute(
            "SELECT id, email_confirmed FROM users WHERE email = %s FOR UPDATE",
            (identity.email,),
        ).fetchone()
        created = owner is None
        if owner is None:
            if body.username is None:
                raise NewAccount(identity.email)
            # The provider verified the address: nothing to confirm, and no
            # email for it (the hooks of POST /accounts do not run).
            row = self.accounts.insert_user(
                conn,
                email=identity.email,
                password_hash=password_hash,
                username=body.username,
                now=now,
                away_email=body.away_email,
                language=body.language,
                email_confirmed=True,
            )
            user_id = int(row["id"])
        else:
            user_id = int(owner["id"])
            if not owner["email_confirmed"]:
                # Who wrote this address never proved it theirs; Apple or
                # Google just did (ADR-0282): the password and the sessions
                # of before end, and the address is confirmed.
                conn.execute(
                    "UPDATE users SET password_hash = %s, email_confirmed = true"
                    " WHERE id = %s",
                    (password_hash, user_id),
                )
                conn.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        conn.execute(
            "INSERT INTO user_identities"
            " (provider, subject, user_id, email, apple_refresh_token, created_at)"
            " VALUES (%s, %s, %s, %s, %s, %s)"
            " ON CONFLICT (provider, subject) DO NOTHING",
            (
                identity.provider,
                identity.subject,
                user_id,
                identity.email,
                refresh_token,
                now,
            ),
        )
        return user_id, created

    def revoke(self, user_id: int) -> None:
        """Apple's accesses of an account, revoked before it is deleted."""
        with self.accounts.database.connect() as conn:
            tokens = [
                row["apple_refresh_token"]
                for row in conn.execute(
                    "SELECT apple_refresh_token FROM user_identities"
                    " WHERE user_id = %s AND provider = 'apple'"
                    " AND apple_refresh_token IS NOT NULL",
                    (user_id,),
                ).fetchall()
            ]
        for token in tokens:
            self.providers.revoke_apple(token)


def providers_of(request: Request) -> SignInProviders:
    providers: SignInProviders = request.app.state.sign_in_providers
    return providers


def sign_in_routes() -> APIRouter:
    router = APIRouter(tags=["accounts"], responses=ACCOUNT_ERRORS)

    @router.get("/session/providers")
    def providers(
        request: Request,
        providers: Annotated[SignInProviders, Depends(providers_of)],
    ) -> SignInProvidersBody:
        # Without accounts, no button: there would be nothing to sign in to.
        on = request.app.state.accounts is not None
        return SignInProvidersBody(providers=providers.names if on else [])

    # 200 for an account that was there, 201 for a new one; 404 new_account
    # the first time, without a username.
    @router.post("/session/{provider}", responses={404: {"model": NewAccountBody}})
    def sign_in(
        provider: Provider,
        body: ProviderSignInRequestBody,
        response: Response,
        accounts: Annotated[Accounts, Depends(accounts_of)],
        providers: Annotated[SignInProviders, Depends(providers_of)],
    ) -> SessionBody:
        session, created = ProviderAccounts(accounts, providers).sign_in(provider, body)
        response.status_code = 201 if created else 200
        return session

    return router


def new_account_answer(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NewAccount)
    detail = NewAccountDetail(code="new_account", message=NEW_ACCOUNT, email=exc.email)
    return JSONResponse(
        status_code=404, content=NewAccountBody(error=detail).model_dump()
    )


def install_sign_in_providers(
    app: FastAPI, providers: SignInProviders | None = None
) -> None:
    """Apple and Google for the accounts; after install_accounts.
    `providers` None: the environment's keys, each provider off without."""
    app.state.sign_in_providers = (
        providers if providers is not None else SignInProviders.from_env()
    )

    def leave(user_id: int) -> None:
        accounts: Accounts | None = app.state.accounts
        if accounts is not None:
            ProviderAccounts(accounts, app.state.sign_in_providers).revoke(user_id)

    # DELETE /me takes the access back on Apple too.
    app.state.before_account_delete.append(leave)
    app.add_exception_handler(NewAccount, new_account_answer)
    app.include_router(sign_in_routes())
