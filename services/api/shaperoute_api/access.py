"""Who may use the API, and how often (TASK-081, ADR-0076).

At home the API answers anyone on the Wi-Fi, as before. Reached from outside
(Tailscale, a Cloudflare Tunnel, a server) it can ask for a key: when
SHAPEROUTE_API_KEY is set, every request but /health (and the pages a browser
opens: back from Strava, and the link of an email) must carry it in the
X-API-Key header, or gets
401 unauthorized. A simple limit in memory keeps
a leaked key, or an app stuck in a loop, from filling the PC: each client
gets at most SHAPEROUTE_RATE_LIMIT POSTs a minute (the requests that make
the API work: routes, outlines, readings, GPX), then 429 too_many_requests.
Polling a route job is a GET and is never limited.
"""

from __future__ import annotations

import hmac
import math
import os
import threading
import time
from collections import deque
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from shaperoute_api.schemas import ErrorBody, ErrorCode

KEY_VARIABLE = "SHAPEROUTE_API_KEY"
LIMIT_VARIABLE = "SHAPEROUTE_RATE_LIMIT"
KEY_HEADER = "X-API-Key"
# A key typed by hand is easy to guess; DEPLOY.md shows how to make one.
MIN_KEY_LENGTH = 16
# A route takes 5-50 s: 30 a minute is far more than a person asks for.
DEFAULT_POSTS_PER_MINUTE = 30
WINDOW_S = 60.0
# /health stays open: a check that the API is up needs no key. So does the
# page Strava sends the browser back to (strava.py, TASK-187): a browser has
# no key, and the page does nothing without the state the API gave the app.
# So does the page of the link «Don't send me these emails» (away_email.py,
# TASK-284): it does nothing without the token of the email.
OPEN_PATHS = frozenset({"/health", "/strava/callback", "/away-email/stop"})
LIMITED_METHODS = frozenset({"POST"})

WRONG_KEY = f"Missing or wrong API key: send it in the {KEY_HEADER} header."
TOO_MANY = "Too many requests in a minute: wait a moment and try again."


class AccessConfigError(ValueError):
    """SHAPEROUTE_API_KEY or SHAPEROUTE_RATE_LIMIT cannot be used."""


@dataclass(frozen=True)
class Access:
    """No key: open, as at home. `posts_per_minute` 0: no limit."""

    key: str | None = None
    posts_per_minute: int = DEFAULT_POSTS_PER_MINUTE

    def __post_init__(self) -> None:
        if self.key is not None and len(self.key) < MIN_KEY_LENGTH:
            raise AccessConfigError(
                f"{KEY_VARIABLE} is too short: use at least {MIN_KEY_LENGTH} "
                "characters (docs/DEPLOY.md shows how to make one)."
            )
        if self.posts_per_minute < 0:
            raise AccessConfigError(f"{LIMIT_VARIABLE} cannot be negative.")

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> Access:
        key = environ.get(KEY_VARIABLE, "").strip() or None
        limit = environ.get(LIMIT_VARIABLE, "").strip()
        if not limit:
            return cls(key=key)
        try:
            posts = int(limit)
        except ValueError:
            raise AccessConfigError(
                f"{LIMIT_VARIABLE} must be a whole number, got {limit!r}."
            ) from None
        return cls(key=key, posts_per_minute=posts)

    def allows(self, sent: str | None) -> bool:
        if self.key is None:
            return True
        # Same time whatever the key sent: nothing to learn from the timing.
        return sent is not None and hmac.compare_digest(
            sent.encode(), self.key.encode()
        )


class RateLimiter:
    """At most `limit` hits for each client in any `window_s` seconds."""

    def __init__(
        self,
        limit: int,
        window_s: float = WINDOW_S,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window_s = window_s
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def wait_s(self, client: str) -> float:
        """0 and the hit is counted, or the seconds before the next one fits."""
        if self._limit == 0:
            return 0.0
        now = self._clock()
        with self._lock:
            # Forget clients with no recent hits, so the dict does not grow.
            for other in [
                c for c, h in self._hits.items() if h[-1] <= now - self._window_s
            ]:
                del self._hits[other]
            hits = self._hits.setdefault(client, deque())
            while hits and hits[0] <= now - self._window_s:
                hits.popleft()
            if len(hits) >= self._limit:
                return hits[0] + self._window_s - now
            hits.append(now)
            return 0.0


def refuse(status: int, code: ErrorCode, message: str, **headers: str) -> JSONResponse:
    body = ErrorBody.model_validate({"error": {"code": code, "message": message}})
    return JSONResponse(status_code=status, content=body.model_dump(), headers=headers)


def protect(
    app: FastAPI,
    access: Access | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> None:
    """Checks key and limit before any route; `access` defaults to the
    environment's."""
    rules = access if access is not None else Access.from_env()
    limiter = RateLimiter(rules.posts_per_minute, clock=clock)

    @app.middleware("http")
    async def check_access(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path in OPEN_PATHS:
            return await call_next(request)
        if not rules.allows(request.headers.get(KEY_HEADER)):
            return refuse(401, "unauthorized", WRONG_KEY)
        if request.method in LIMITED_METHODS:
            client = request.client.host if request.client else "unknown"
            wait = limiter.wait_s(client)
            if wait > 0:
                return refuse(
                    429,
                    "too_many_requests",
                    TOO_MANY,
                    **{"Retry-After": str(math.ceil(wait))},
                )
        return await call_next(request)
