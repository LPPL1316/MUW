"""Send to Strava: a run done goes to the runner's Strava profile (TASK-187,
ADR-0156, docs/API.md).

An account connects its Strava athlete through the browser and this server
(OAuth, `activity:write` only): the app never sees the Client Secret or a
Strava token. A saved run is then uploaded as an activity: the GPX of its
track with the real times (run_gpx.py), `POST /uploads`. Strava reads the
file in a second or two; the API follows the upload and keeps on the run
what became of it, so a run sent twice is one activity.

Without this server's Strava application (strava_client.py) Strava is off:
GET /me/strava says `available: false` and the app shows nothing of it.

Nothing secret is logged or answered: not the Client Secret, not a token,
not a code, not a state.
"""

from __future__ import annotations

import html
import logging
import re
import secrets
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal, TypeVar

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
    now_utc,
    token_hash,
)
from shaperoute_api.activities import MUW, UNKNOWN_ACTIVITY, Key
from shaperoute_api.db import Database
from shaperoute_api.drawings import MAX_DESCRIPTION_LENGTH
from shaperoute_api.run_gpx import run_gpx
from shaperoute_api.schemas import ErrorBody
from shaperoute_api.strava_client import (
    ACTIVITY_URL,
    CALLBACK_PATH,
    SCOPE,
    Athlete,
    Strava,
    StravaBusyError,
    StravaDownError,
    StravaError,
    StravaFullError,
    StravaRefusedError,
    Tokens,
    Upload,
    outcome,
    retry_after_s,
)

log = logging.getLogger(__name__)

# The line under the name: what Sgrava did with the run (the user's choice,
# 2026-10-02): a route it drew, or only the recording.
DRAWN = "Drawn with MuW"
RECORDED = "Recorded with MuW"
# A name typed in the app longer than this is cut, not refused: the run
# still goes.
MAX_NAME = 100
# What Strava calls each activity of a run (TASK-208); paddling as stand-up
# paddling, the user's choice (2026-10-03); a swim in open water is Strava's
# "Swim" (TASK-323), which has no open-water type of its own.
SPORT_TYPES = {
    "running": "Run",
    "cycling": "Ride",
    "paddling": "StandUpPaddling",
    "swimming": "Swim",
}

STATE_BYTES = 32
STATE_LIFE = timedelta(minutes=10)
MAX_STATE_LENGTH = 200
# A token about to expire is renewed before it is used, not during.
EXPIRY_MARGIN = timedelta(minutes=5)
# Strava reads a file in two seconds on average and asks for a second
# between two looks: after these the app is told to ask again.
POLL_S = 1.0
POLLS = 5

STRAVA_OFF = "Strava is not set up on this server."
NOT_CONNECTED = "Strava is not connected: connect it first."
STRAVA_DOWN = "Strava did not answer: try again in a while."
STRAVA_BUSY = "Strava is taking no more uploads for now: try again later."
RUN_REFUSED = "Strava could not read this run."
NOT_DESCRIBED = (
    "Strava did not let MuW change this activity: change its text on Strava."
)
# A run added from another app's file (TASK-312, ADR-0272): it came from
# there, often from Strava itself.
IMPORTED = "This activity was added from another app: it is not sent to Strava."

T = TypeVar("T")
SendStatus = Literal["not_sent", "processing", "sent"]


# --- What the API answers ---


class StravaStatusBody(BaseModel):
    """GET /me/strava: packages/shared-types/fixtures/strava-status.json."""

    available: bool
    """False when this server has no Strava application: show nothing."""
    connected: bool
    athlete: str | None
    """The athlete's name on Strava, to show "Connected as …"."""


class StravaConnectBody(BaseModel):
    """POST /me/strava/connect: fixtures/strava-connect.json."""

    url: str
    """Strava's page to open in the browser; good for ten minutes."""


class StravaSendBody(BaseModel):
    """POST /me/activities/{key}/strava, optional: fixtures/strava-send.json."""

    name: str | None = None
    """The name typed before «Save»; empty or null: Sgrava's own."""
    description: str | None = None
    """«How did it go?», typed before «Save» (TASK-208); empty or null: the
    drawing's, if the run has one. Above Sgrava's own line."""
    post: str | None = None
    """The text of the run's post (TASK-231): its emoji and results, above
    the runner's words. On a run already on Strava it changes the text
    there."""


class StravaActivityBody(BaseModel):
    """What Strava has of a run: fixtures/strava-activity.json."""

    status: SendStatus
    url: str | None
    """The activity on Strava, once `sent`; null also when Strava had the
    run already and did not say where."""


@dataclass(frozen=True)
class Landing:
    """The page the browser shows after Strava: a status and two lines."""

    status: int
    title: str
    text: str


CONNECTED = Landing(200, "Strava is connected.", "Go back to MuW.")
DENIED = Landing(200, "Strava is not connected.", "Nothing was shared. Go back to MuW.")
NO_PERMISSION = Landing(
    200,
    "Strava is not connected.",
    "MuW needs the permission to upload activities. Go back to MuW and"
    " connect again, leaving it ticked.",
)
EXPIRED = Landing(
    400,
    "This link has expired.",
    "Go back to MuW and tap «Connect with Strava» again.",
)
FULL = Landing(
    403,
    "Strava is not connected.",
    "MuW's Strava app takes only its owner for now. Go back to MuW.",
)
NO_ANSWER = Landing(
    502, "Strava did not answer.", "Go back to MuW and try again in a while."
)
OFF = Landing(503, "Strava is not set up here.", "Go back to MuW.")


def landing_page(landing: Landing) -> HTMLResponse:
    # The browser's own colours, light or dark: none is written here.
    document = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light dark">'
        f"<title>{html.escape(landing.title)}</title>"
        "<style>body{font-family:system-ui,sans-serif;text-align:center;"
        "margin:20vh 24px 0}h1{font-size:1.4rem}</style></head>"
        f"<body><h1>{html.escape(landing.title)}</h1>"
        f"<p>{html.escape(landing.text)}</p></body></html>"
    )
    return HTMLResponse(
        document,
        status_code=landing.status,
        # The address has Strava's code in it: not kept, not passed on.
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


def activity_name(run: Mapping[str, Any]) -> str | None:
    """What was drawn and where: "Heart in Trento", "CIAO in Trento". None
    for a run that drew nothing known."""
    shape, word, title = run["shape"], run["word"], run["title"]
    if word:
        what = str(word)
    elif shape:
        what = str(shape).replace("_", " ").capitalize()
    elif title:
        what = str(title)
    else:
        return None
    return f"{what} in {run['place']}" if run["place"] else what


def typed_name(name: str | None) -> str | None:
    """The name typed in the app on one line, at most MAX_NAME characters;
    None when nothing is left of it."""
    if name is None:
        return None
    line = " ".join(name.split())[:MAX_NAME].strip()
    return line or None


def typed_description(text: str | None) -> str | None:
    """A description typed in the app, its lines kept, at most
    MAX_DESCRIPTION_LENGTH characters: cut, not refused, as a name; None
    when nothing is left of it."""
    if text is None:
        return None
    lines = "\n".join(line.strip() for line in text.splitlines())
    return lines.strip()[:MAX_DESCRIPTION_LENGTH].strip() or None


def strava_description(
    described: str | None, drawn: bool, post: str | None = None
) -> str:
    """What Strava shows under the name: the post's emoji and results
    (TASK-231), the runner's words, then a line on what Sgrava did with the
    run, a route it drew or only the recording."""
    sgrava = DRAWN if drawn else RECORDED
    return "\n\n".join(part for part in (post, described, sgrava) if part is not None)


def _activity(status: str | None, activity_id: int | None) -> StravaActivityBody:
    if status is None:
        return StravaActivityBody(status="not_sent", url=None)
    if status == "processing":
        return StravaActivityBody(status="processing", url=None)
    url = ACTIVITY_URL.format(id=activity_id) if activity_id else None
    return StravaActivityBody(status="sent", url=url)


# --- The athletes and the runs in the database ---


def disconnect(database: Database, strava: Strava | None, user_id: int) -> None:
    """No token of the account stays here, whatever Strava answers; then
    Strava is told. If it does not listen, the tokens are gone all the same
    and the athlete can remove Sgrava from Strava's settings."""
    with database.connect() as conn:
        conn.execute("DELETE FROM strava_states WHERE user_id = %s", (user_id,))
        row = conn.execute(
            "DELETE FROM strava_accounts WHERE user_id = %s RETURNING refresh_token",
            (user_id,),
        ).fetchone()
    if row is None or strava is None:
        return
    try:
        strava.revoke(row["refresh_token"])
    except StravaError:
        log.warning("Strava did not take a revocation: the tokens are deleted here")


RUN_STATE = "id, source, strava_status, strava_upload_id, strava_activity_id"
# The track as (lat, lon, seconds since the first point), in order.
RUN_TO_SEND = (
    f"{RUN_STATE}, started_at, place, shape, word, title, pauses, activity,"
    " route IS NOT NULL AS drawn,"
    # «How did it go?», when the drawing came first (TASK-208).
    " (SELECT d.description FROM drawings d WHERE d.run_id = runs.id)"
    " AS described,"
    " (SELECT array_agg(ARRAY[ST_Y(p.geom), ST_X(p.geom), ST_M(p.geom)]"
    " ORDER BY p.path[1]) FROM ST_DumpPoints(track) AS p) AS fixes"
)


@dataclass
class StravaRuns:
    """An account's athlete and its runs on Strava."""

    strava: Strava
    database: Database
    now: Callable[[], datetime] = now_utc

    @contextmanager
    def _answering(self) -> Iterator[None]:
        """Strava's troubles as answers the app can read."""
        try:
            yield
        except StravaBusyError as busy:
            wait = retry_after_s(self.now(), busy.daily)
            raise AccountError(429, "too_many_requests", STRAVA_BUSY, wait) from None
        except StravaError:
            raise AccountError(502, "http_error", STRAVA_DOWN) from None

    # Connecting

    def connect_url(self, user_id: int, base_url: str) -> str:
        """Strava's page for this account, with a state only it has. The
        state before it, if any, is good no more."""
        state = secrets.token_urlsafe(STATE_BYTES)
        now = self.now()
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM strava_states WHERE created_at <= %s",
                (now - STATE_LIFE,),
            )
            conn.execute(
                "INSERT INTO strava_states (state_hash, user_id, created_at)"
                " VALUES (%s, %s, %s) ON CONFLICT (user_id) DO UPDATE"
                " SET state_hash = EXCLUDED.state_hash,"
                " created_at = EXCLUDED.created_at",
                (token_hash(state), user_id, now),
            )
        return self.strava.authorize_url(state, self.strava.redirect_uri(base_url))

    def _claim(self, state: str | None) -> int | None:
        """The account a state was made for, and the state is spent. None
        for one unknown, used or older than ten minutes."""
        if not state or len(state) > MAX_STATE_LENGTH:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "DELETE FROM strava_states WHERE state_hash = %s"
                " RETURNING user_id, created_at",
                (token_hash(state),),
            ).fetchone()
        if row is None or row["created_at"] <= self.now() - STATE_LIFE:
            return None
        user_id: int = row["user_id"]
        return user_id

    def finish(
        self, state: str | None, code: str | None, scope: str | None, error: str | None
    ) -> Landing:
        """What Strava sent the browser back with: the athlete is connected
        only with a good state, a code, and the permission to upload."""
        user_id = self._claim(state)
        if user_id is None:
            return EXPIRED
        if error or not code:
            return DENIED
        # The athlete may untick what is asked: then there is nothing to
        # keep, and no token is asked for.
        if SCOPE not in re.split(r"[,\s]+", scope or ""):
            return NO_PERMISSION
        try:
            tokens, athlete = self.strava.exchange(code)
        except StravaRefusedError:
            return EXPIRED
        except StravaFullError:
            return FULL
        except StravaError:
            return NO_ANSWER
        try:
            replaced = self._keep(user_id, tokens, athlete)
        except pg_errors.ForeignKeyViolation:
            # The account was deleted while Strava's page was open.
            return EXPIRED
        if replaced is not None:
            try:
                self.strava.revoke(replaced)
            except StravaError:
                log.warning("Strava did not take the revocation of a replaced athlete")
        return CONNECTED

    def _keep(self, user_id: int, tokens: Tokens, athlete: Athlete) -> str | None:
        """Save the athlete of an account. The refresh token of another
        athlete the account had, to revoke; None if it had none."""
        with self.database.connect() as conn:
            before = conn.execute(
                "SELECT athlete_id, refresh_token FROM strava_accounts"
                " WHERE user_id = %s FOR UPDATE",
                (user_id,),
            ).fetchone()
            # An athlete is of one account at a time, the last to connect:
            # Strava has one authorization for it, and so one set of tokens.
            conn.execute(
                "DELETE FROM strava_accounts WHERE athlete_id = %s AND user_id <> %s",
                (athlete.id, user_id),
            )
            conn.execute(
                "INSERT INTO strava_accounts (user_id, athlete_id, athlete_name,"
                " access_token, refresh_token, expires_at, connected_at)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s)"
                " ON CONFLICT (user_id) DO UPDATE SET"
                " athlete_id = EXCLUDED.athlete_id,"
                " athlete_name = EXCLUDED.athlete_name,"
                " access_token = EXCLUDED.access_token,"
                " refresh_token = EXCLUDED.refresh_token,"
                " expires_at = EXCLUDED.expires_at,"
                " connected_at = EXCLUDED.connected_at",
                (
                    user_id,
                    athlete.id,
                    athlete.name,
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_at,
                    self.now(),
                ),
            )
        if before is None or before["athlete_id"] == athlete.id:
            return None
        replaced: str = before["refresh_token"]
        return replaced

    def status(self, user_id: int) -> StravaStatusBody:
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT athlete_name FROM strava_accounts WHERE user_id = %s",
                (user_id,),
            ).fetchone()
        return StravaStatusBody(
            available=True,
            connected=row is not None,
            athlete=None if row is None else row["athlete_name"],
        )

    # The tokens

    def _access_token(self, user_id: int, renew: bool = False) -> str:
        """A token Strava takes now, renewed if it expired. 409 when the
        account has no athlete, or Strava no longer takes its refresh token
        (the athlete removed Sgrava there): then the athlete is forgotten."""
        with self.database.connect() as conn:
            # One renewal at a time: each may change the refresh token.
            row = conn.execute(
                "SELECT access_token, refresh_token, expires_at"
                " FROM strava_accounts WHERE user_id = %s FOR UPDATE",
                (user_id,),
            ).fetchone()
            if row is not None:
                if not renew and row["expires_at"] > self.now() + EXPIRY_MARGIN:
                    token: str = row["access_token"]
                    return token
                try:
                    tokens = self.strava.refresh(row["refresh_token"])
                except StravaRefusedError:
                    conn.execute(
                        "DELETE FROM strava_accounts WHERE user_id = %s", (user_id,)
                    )
                else:
                    conn.execute(
                        "UPDATE strava_accounts SET access_token = %s,"
                        " refresh_token = %s, expires_at = %s WHERE user_id = %s",
                        (
                            tokens.access_token,
                            tokens.refresh_token,
                            tokens.expires_at,
                            user_id,
                        ),
                    )
                    return tokens.access_token
        raise AccountError(409, "http_error", NOT_CONNECTED)

    def _authorized(self, user_id: int, ask: Callable[[str], T]) -> T:
        """`ask` with the account's token. The token is read, and renewed,
        in a block of its own before `ask` runs: `ask` may then open its
        block, never one inside another (TASK-293)."""
        try:
            return ask(self._access_token(user_id))
        except StravaRefusedError:
            pass
        # Good by the clock and refused all the same: a renewal tells
        # whether the athlete took the access away on Strava.
        try:
            return ask(self._access_token(user_id, renew=True))
        except StravaRefusedError:
            # Renewed and still refused: the permission to upload is not
            # there. Connecting again asks for it.
            disconnect(self.database, self.strava, user_id)
            raise AccountError(409, "http_error", NOT_CONNECTED) from None

    # Sending a run

    def _known(self, user_id: int, key: str) -> DictRow:
        """A run's state on Strava, with no lock; 404 for a run the account
        does not have."""
        with self.database.connect() as conn:
            run = conn.execute(
                f"SELECT {RUN_STATE} FROM runs WHERE user_id = %s AND key = %s",
                (user_id, key),
            ).fetchone()
        if run is None:
            raise HTTPException(404, UNKNOWN_ACTIVITY)
        return run

    def sent(self, user_id: int, key: str) -> StravaActivityBody:
        """What is known of a run on Strava; Strava is not asked."""
        run = self._known(user_id, key)
        return _activity(run["strava_status"], run["strava_activity_id"])

    def send(
        self,
        user_id: int,
        key: str,
        name: str | None = None,
        description: str | None = None,
        post: str | None = None,
    ) -> StravaActivityBody:
        """The run on Strava: uploaded if it never was, then followed until
        Strava has read it, for a few seconds. `processing` after that: the
        same call again goes on following, and uploads nothing twice.
        `name` and `description` are the ones typed in the app; they count
        only for the upload. `post`, the text of the run's post (TASK-231),
        goes with the upload, and on a run already sent replaces the text
        under its name on Strava."""
        with self._answering():
            # First with no lock: an unknown run is a 404 before the token
            # is a 409, and a run on Strava with nothing new for it asks
            # Strava nothing. A run sent stays sent. A run of another app is
            # never sent (TASK-312): a 409 of its own, before the token.
            known = self._known(user_id, key)
            if known["source"] != MUW:
                raise AccountError(409, "imported_run", IMPORTED)
            posted = typed_description(post)
            if known["strava_status"] == "sent" and (
                posted is None or not known["strava_activity_id"]
            ):
                return _activity("sent", known["strava_activity_id"])
            # The token in its block, then the run in its own (TASK-293). A
            # token Strava refuses is renewed once the run's block is left,
            # and the sending starts again from the run.
            return self._authorized(
                user_id,
                lambda token: self._send_with(
                    token, user_id, key, name, description, posted
                ),
            )

    def _send_with(
        self,
        token: str,
        user_id: int,
        key: str,
        name: str | None,
        description: str | None,
        posted: str | None,
    ) -> StravaActivityBody:
        """The sending with `token`, the run locked. A refused token comes
        out of the block as StravaRefusedError, with nothing written."""
        first: Upload | None = None
        with self.database.connect() as conn:
            # One sending of a run at a time: a second one waits here, then
            # finds what the first did.
            run = conn.execute(
                f"SELECT {RUN_TO_SEND} FROM runs"
                " WHERE user_id = %s AND key = %s FOR UPDATE",
                (user_id, key),
            ).fetchone()
            if run is None:
                raise HTTPException(404, UNKNOWN_ACTIVITY)
            if run["strava_status"] == "sent":
                if posted is not None and run["strava_activity_id"]:
                    self._describe(token, run, description, posted)
                return _activity("sent", run["strava_activity_id"])
            upload_id: int | None = run["strava_upload_id"]
            if upload_id is None:
                first = self._upload(token, key, run, name, description, posted)
                upload_id = first.id
                if upload_id is not None:
                    conn.execute(
                        "UPDATE runs SET strava_status = 'processing',"
                        " strava_upload_id = %s WHERE id = %s",
                        (upload_id, run["id"]),
                    )
        # The run's block is left: following the upload reads the token
        # again, in a block of its own.
        return self._follow(user_id, run["id"], upload_id, first)

    def _upload(
        self,
        token: str,
        key: str,
        run: DictRow,
        typed: str | None,
        typed_words: str | None,
        posted: str | None,
    ) -> Upload:
        name = typed_name(typed) or activity_name(run)
        gpx = run_gpx(
            [(lat, lon, at_s) for lat, lon, at_s in run["fixes"]],
            [(pause["from_s"], pause["to_s"]) for pause in run["pauses"]],
            run["started_at"],
            name,
        )
        # A run that followed no route drew nothing: it was only recorded.
        description = strava_description(
            typed_description(typed_words) or run["described"], run["drawn"], posted
        )
        sport_type = SPORT_TYPES[run["activity"]]
        return self.strava.upload(token, gpx, key, name, description, sport_type)

    def _describe(
        self, token: str, run: DictRow, typed_words: str | None, posted: str
    ) -> None:
        """The text under the name of a run already on Strava, made again
        with its post on top (TASK-231). 422 when Strava does not let it."""
        description = strava_description(
            typed_description(typed_words) or run["described"], run["drawn"], posted
        )
        if not self.strava.describe(token, run["strava_activity_id"], description):
            raise AccountError(422, "invalid_request", NOT_DESCRIBED)

    def _look(self, user_id: int, upload_id: int) -> Upload | None:
        return self._authorized(
            user_id, lambda token: self.strava.upload_status(token, upload_id)
        )

    def _follow(
        self, user_id: int, run_id: int, upload_id: int | None, upload: Upload | None
    ) -> StravaActivityBody:
        """Look at an upload until Strava has read it, POLLS times at most,
        and keep on the run what became of it."""
        looks = 0
        while upload_id is not None and (
            upload is None or (outcome(upload)[0] == "processing" and looks < POLLS)
        ):
            if upload is not None:
                self.strava.wait(POLL_S)
            upload = self._look(user_id, upload_id)
            looks += 1
            if upload is None:
                # Strava knows no such upload (another athlete, by now):
                # the next call starts over.
                self._start_over(run_id)
                raise StravaDownError()
        assert upload is not None  # with no upload id there is a first answer
        state, activity_id = outcome(upload)
        if state == "processing":
            return _activity("processing", None)
        if state == "sent":
            with self.database.connect() as conn:
                conn.execute(
                    "UPDATE runs SET strava_status = 'sent', strava_upload_id = %s,"
                    " strava_activity_id = %s WHERE id = %s",
                    (upload_id, activity_id or None, run_id),
                )
            return _activity("sent", activity_id)
        self._start_over(run_id)
        # Strava's words about the file: no token and no position in them.
        log.warning("Strava refused a run: %s", (upload.error or upload.status)[:200])
        raise AccountError(422, "invalid_request", RUN_REFUSED)

    def _start_over(self, run_id: int) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE runs SET strava_status = NULL, strava_upload_id = NULL"
                " WHERE id = %s AND strava_status = 'processing'",
                (run_id,),
            )


# --- The endpoints ---


def strava_app_of(request: Request) -> Strava | None:
    strava: Strava | None = request.app.state.strava
    return strava


def strava_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> StravaRuns:
    """In the database of the accounts, on the same clock; 503 when this
    server has no Strava application."""
    strava = strava_app_of(request)
    if strava is None:
        raise AccountError(503, "http_error", STRAVA_OFF)
    return StravaRuns(strava, accounts.database, accounts.now)


def strava_routes() -> APIRouter:
    router = APIRouter(tags=["strava"], responses=ACCOUNT_ERRORS)

    @router.get("/me/strava")
    def strava_status(
        request: Request,
        accounts: Annotated[Accounts, Depends(accounts_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> StravaStatusBody:
        strava = strava_app_of(request)
        if strava is None:
            return StravaStatusBody(available=False, connected=False, athlete=None)
        return StravaRuns(strava, accounts.database, accounts.now).status(user.id)

    # The first step of connecting: the app opens the address in the
    # browser, and Strava sends the browser to the callback below.
    @router.post("/me/strava/connect")
    def connect_strava(
        request: Request,
        runs: Annotated[StravaRuns, Depends(strava_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> StravaConnectBody:
        return StravaConnectBody(url=runs.connect_url(user.id, str(request.base_url)))

    # Opened by the browser, coming from Strava: no API key and no token
    # (access.py lets it through). The state says whose connection it is.
    # Always a page: whoever reads the answer is a person. A plain def: it
    # asks Strava for the tokens.
    @router.get(CALLBACK_PATH, response_class=HTMLResponse)
    def strava_callback(
        request: Request,
        state: str | None = None,
        code: str | None = None,
        scope: str | None = None,
        error: str | None = None,
    ) -> HTMLResponse:
        strava = strava_app_of(request)
        accounts: Accounts | None = request.app.state.accounts
        if strava is None or accounts is None:
            return landing_page(OFF)
        runs = StravaRuns(strava, accounts.database, accounts.now)
        return landing_page(runs.finish(state, code, scope, error))

    # Also with Strava off: a token left from before goes all the same.
    @router.delete("/me/strava", status_code=204)
    def disconnect_strava(
        request: Request,
        accounts: Annotated[Accounts, Depends(accounts_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        disconnect(accounts.database, strava_app_of(request), user.id)
        return Response(status_code=204)

    @router.get("/me/activities/{key}/strava", responses={404: {"model": ErrorBody}})
    def get_strava_activity(
        key: Key,
        runs: Annotated[StravaRuns, Depends(strava_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> StravaActivityBody:
        return runs.sent(user.id, key)

    # 200 once the run is an activity, 202 while Strava is still reading
    # it. A plain def: it waits for Strava.
    @router.post(
        "/me/activities/{key}/strava",
        responses={
            202: {"model": StravaActivityBody},
            404: {"model": ErrorBody},
            502: {"model": ErrorBody},
        },
    )
    def send_to_strava(
        key: Key,
        response: Response,
        runs: Annotated[StravaRuns, Depends(strava_of)],
        user: Annotated[UserBody, Depends(current_user)],
        # No body, as before the name could be typed: Sgrava's own name.
        body: StravaSendBody | None = None,
    ) -> StravaActivityBody:
        activity = (
            runs.send(user.id, key)
            if body is None
            else runs.send(user.id, key, body.name, body.description, body.post)
        )
        if activity.status == "processing":
            response.status_code = 202
        return activity

    return router


def install_strava(app: FastAPI, strava: Strava | None = None) -> None:
    """Strava for the accounts; after install_accounts and
    install_activities. `strava` None: the environment's application, or
    Strava off without one."""
    app.state.strava = strava if strava is not None else Strava.from_env()

    def leave(user_id: int) -> None:
        accounts: Accounts | None = app.state.accounts
        if accounts is not None:
            disconnect(accounts.database, app.state.strava, user_id)

    # DELETE /me takes the access back on Strava too.
    app.state.before_account_delete.append(leave)
    app.include_router(strava_routes())
