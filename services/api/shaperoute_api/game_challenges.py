"""The challenges of the shape game's teams (TASK-296 part C, ADR-0255,
docs/GIOCO.md §6.2–§6.4).

A team draws a shape of the catalog together: its outline cut into N pieces
of equal length (game_rules.pieces_of), each asking so many metres, or a
distance in one run under a pace. A member holds a piece, one at a time in
each challenge, and the runs that count (game.py) started after the hold
and before the deadline fill it, in the transaction that saves the run
(game.after_run_saved calls fill). The metres left over from a finished
piece move to the next free distance piece, which becomes the runner's;
with none left, they are lost. A piece left goes back free with its metres.
When every piece is done the challenge is complete and each contributor
gets the shape's team edition (game_unlocks). A run started before the
deadline still counts if saved within GRACE after it; then the challenge is
over, complete or not, and the team may start another.

The teammates never see where or when anyone ran: a challenge shows who
holds which piece, how many metres each gave, and what is left.

The pushes (push.py), after the transaction: piece_done to the teammates of
who finished a piece, challenge_done to every member of a completed
challenge, and challenge_ending a day before the deadline, found by
ChallengeClock, a timer of the API's process started and stopped with the
app (install_game_challenges).
"""

from __future__ import annotations

import logging
import threading
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Path, Request
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, model_validator

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.db import Database
from shaperoute_api.game_catalog import BY_ID
from shaperoute_api.game_rules import pieces_of
from shaperoute_api.push import Kind, Pusher, PushEvent
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

# How many pieces a shape is cut into.
MIN_PIECES, MAX_PIECES = 2, 12
# What a distance piece asks, in metres.
MIN_PIECE_M, MAX_PIECE_M = 1_000, 50_000
# A fast piece: one of these distances, in one run, under a pace between
# these, in seconds a kilometre (2:30 and 15:00).
FAST_DISTANCES_M: tuple[int, ...] = (1_000, 5_000)
MIN_PACE_S, MAX_PACE_S = 150, 900
# How long a challenge lasts, in days.
MIN_DAYS, MAX_DAYS, DEFAULT_DAYS = 1, 14, 7
# A run started before the deadline counts if saved within this after it:
# the runs still queued on a phone. Then the challenge is over.
GRACE = timedelta(hours=3)
# The members are told «1 day left» this long before the deadline, once,
# for a challenge that lasted more than that.
ENDING_BEFORE = timedelta(days=1)
# How often the API looks for them.
CHECK_EVERY_S = 15 * 60.0

NO_TEAM = "No team with this id."
NO_CHALLENGE = "No challenge with this id."
NO_SHAPE = "No shape with this id in the catalog."
HAS_CHALLENGE = "The team has a challenge going already: wait for it to end."
CHALLENGE_OVER = "This challenge is over."
NO_PIECE = "No piece with this number."
PIECE_DONE = "This piece is done already."
PIECE_TAKEN = "Someone holds this piece already."
HOLDING_ALREADY = "You hold a piece of this challenge already: leave it first."
NOT_YOUR_PIECE = "You don't hold this piece."

Status = Literal["active", "completed", "expired"]


# --- The bodies ---


class PieceGoalBody(BaseModel):
    """What each piece asks: `total_m` metres, or `distance_m` in one run at
    `pace_s` a kilometre or better; the words of the catalog's goals."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["distance", "pace"]
    total_m: int | None = Field(default=None, ge=MIN_PIECE_M, le=MAX_PIECE_M)
    distance_m: int | None = None
    pace_s: int | None = Field(default=None, ge=MIN_PACE_S, le=MAX_PACE_S)

    @model_validator(mode="after")
    def _whole(self) -> PieceGoalBody:
        if self.kind == "distance":
            if self.total_m is None or self.distance_m is not None or self.pace_s:
                raise ValueError("a distance piece has total_m and nothing else")
        else:
            if self.total_m is not None or self.distance_m is None or not self.pace_s:
                raise ValueError("a pace piece has distance_m and pace_s")
            if self.distance_m not in FAST_DISTANCES_M:
                raise ValueError(f"distance_m is one of {list(FAST_DISTANCES_M)}")
        return self


class ChallengeRequestBody(BaseModel):
    """POST /game/teams/{id}/challenges: a shape of the catalog in `pieces`
    pieces, each asking `piece`, for `days` days."""

    model_config = ConfigDict(extra="forbid")

    shape_id: str = Field(min_length=1, max_length=40)
    pieces: int = Field(ge=MIN_PIECES, le=MAX_PIECES)
    piece: PieceGoalBody
    days: int = Field(default=DEFAULT_DAYS, ge=MIN_DAYS, le=MAX_DAYS)


class HolderBody(BaseModel):
    public_id: UUID
    username: str


class PieceBody(BaseModel):
    idx: int
    goal: PieceGoalBody
    holder: HolderBody | None
    done_m: int
    done: bool
    outline: list[tuple[float, float]] = Field(
        description="This piece of the shape's outline, from 0 to 1 (pieces_of)."
    )


class ContributionBody(BaseModel):
    """The metres a member gave to a piece, all its runs together."""

    public_id: UUID
    username: str
    idx: int
    metres: int


class ChallengeBody(BaseModel):
    id: UUID
    team_id: UUID
    shape_id: str
    status: Status
    starts_at: datetime
    ends_at: datetime
    completed_at: datetime | None
    seconds_left: int = Field(description="To the deadline; 0 once past.")
    pieces: list[PieceBody]
    contributions: list[ContributionBody]


class PieceDoneBody(BaseModel):
    """A piece a run finished (GET /game/runs/{key})."""

    challenge_id: UUID
    team_id: UUID
    team_name: str
    shape_id: str
    idx: int
    pieces: int
    challenge_completed: bool


# --- Reading ---

CHALLENGE_COLUMNS = (
    "c.id, c.team_id, c.shape_id, c.starts_at, c.ends_at, c.completed_at"
)


def member_of_team(conn: Connection[DictRow], team_id: UUID, user_id: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM game_team_members WHERE team_id = %s AND user_id = %s",
        (team_id, user_id),
    ).fetchone()
    return row is not None


def status_of(row: Mapping[str, Any], now: datetime) -> Status:
    if row["completed_at"] is not None:
        return "completed"
    return "active" if now < row["ends_at"] + GRACE else "expired"


def active_of_team(conn: Connection[DictRow], team_id: UUID, now: datetime) -> bool:
    """Whether the team has a challenge going: not complete, and not past
    its deadline and GRACE."""
    row = conn.execute(
        "SELECT 1 FROM game_challenges WHERE team_id = %s AND completed_at IS NULL"
        " AND ends_at + %s > %s LIMIT 1",
        (team_id, GRACE, now),
    ).fetchone()
    return row is not None


def latest_of_team(
    conn: Connection[DictRow], team_id: UUID, now: datetime
) -> ChallengeBody | None:
    """The team's newest challenge, whatever its status; None before the
    first."""
    row = conn.execute(
        f"SELECT {CHALLENGE_COLUMNS} FROM game_challenges c WHERE c.team_id = %s"
        " ORDER BY c.starts_at DESC, c.id DESC LIMIT 1",
        (team_id,),
    ).fetchone()
    return None if row is None else challenge_body(conn, row, now)


def _goal(piece: Mapping[str, Any]) -> PieceGoalBody:
    if piece["required_m"] is not None:
        return PieceGoalBody(kind="distance", total_m=piece["required_m"])
    return PieceGoalBody(
        kind="pace", distance_m=piece["fast_distance_m"], pace_s=piece["max_pace_s"]
    )


def challenge_body(
    conn: Connection[DictRow], row: Mapping[str, Any], now: datetime
) -> ChallengeBody:
    """The challenge as its team sees it: no time or place of any run."""
    pieces = conn.execute(
        "SELECT p.idx, p.required_m, p.fast_distance_m, p.max_pace_s, p.done_m,"
        " p.done_at, u.public_id, u.username FROM game_pieces p"
        " LEFT JOIN users u ON u.id = p.holder_id"
        " WHERE p.challenge_id = %s ORDER BY p.idx",
        (row["id"],),
    ).fetchall()
    gave = conn.execute(
        "SELECT u.public_id, u.username, k.piece_idx AS idx,"
        " sum(k.metres)::integer AS metres FROM game_contributions k"
        " JOIN users u ON u.id = k.user_id WHERE k.challenge_id = %s"
        " GROUP BY u.public_id, u.username, k.piece_idx"
        " ORDER BY k.piece_idx, lower(u.username), u.public_id",
        (row["id"],),
    ).fetchall()
    shape = BY_ID.get(row["shape_id"])
    outlines: list[list[tuple[float, float]]] = (
        pieces_of(shape.outline, len(pieces))
        if shape is not None and pieces
        else [[] for _ in pieces]
    )
    return ChallengeBody(
        id=row["id"],
        team_id=row["team_id"],
        shape_id=row["shape_id"],
        status=status_of(row, now),
        starts_at=row["starts_at"],
        ends_at=row["ends_at"],
        completed_at=row["completed_at"],
        seconds_left=max(0, int((row["ends_at"] - now).total_seconds())),
        pieces=[
            PieceBody(
                idx=piece["idx"],
                goal=_goal(piece),
                holder=(
                    None
                    if piece["public_id"] is None
                    else HolderBody(
                        public_id=piece["public_id"], username=piece["username"]
                    )
                ),
                done_m=piece["done_m"],
                done=piece["done_at"] is not None,
                outline=outlines[piece["idx"]] if piece["idx"] < len(outlines) else [],
            )
            for piece in pieces
        ],
        contributions=[
            ContributionBody(
                public_id=g["public_id"],
                username=g["username"],
                idx=g["idx"],
                metres=g["metres"],
            )
            for g in gave
        ],
    )


# --- A run that counts fills the pieces its runner holds ---


def fill(
    conn: Connection[DictRow],
    user_id: int,
    run_id: int,
    started_at: datetime,
    counted_m: int,
    best_s: Mapping[int, float],
    now: datetime,
) -> None:
    """In the transaction of a run that counts, after its game_runs row
    (game.after_run_saved): the piece the runner holds in each challenge
    still going takes the run, when it started after the hold and before
    the deadline. Each challenge is locked while it changes."""
    going = conn.execute(
        "SELECT c.id FROM game_challenges c"
        " WHERE c.completed_at IS NULL AND %s < c.ends_at AND %s <= c.ends_at + %s"
        " AND EXISTS (SELECT 1 FROM game_pieces p WHERE p.challenge_id = c.id"
        " AND p.holder_id = %s AND p.done_at IS NULL AND p.held_at < %s)"
        " ORDER BY c.id FOR UPDATE",
        (started_at, now, GRACE, user_id, started_at),
    ).fetchall()
    for row in going:
        _fill_challenge(
            conn, row["id"], user_id, run_id, started_at, counted_m, best_s, now
        )


def _fill_challenge(
    conn: Connection[DictRow],
    challenge_id: UUID,
    user_id: int,
    run_id: int,
    started_at: datetime,
    counted_m: int,
    best_s: Mapping[int, float],
    now: datetime,
) -> None:
    # Read again under the challenge's lock: a hold may have changed.
    piece = conn.execute(
        "SELECT idx, required_m, fast_distance_m, max_pace_s, done_m FROM game_pieces"
        " WHERE challenge_id = %s AND holder_id = %s AND done_at IS NULL"
        " AND held_at < %s ORDER BY idx LIMIT 1",
        (challenge_id, user_id, started_at),
    ).fetchone()
    if piece is None:
        return
    if piece["required_m"] is not None:
        _fill_distance(conn, challenge_id, user_id, run_id, piece, counted_m, now)
    else:
        _fill_fast(conn, challenge_id, user_id, run_id, piece, best_s, now)
    _complete_if_done(conn, challenge_id, now)


def _fill_distance(
    conn: Connection[DictRow],
    challenge_id: UUID,
    user_id: int,
    run_id: int,
    piece: Mapping[str, Any],
    metres: int,
    now: datetime,
) -> None:
    """The run's metres into the piece; the metres left over from a piece
    now done into the next free distance piece, which becomes the runner's,
    and so on while there are metres and free pieces."""
    left = metres
    idx, required, done_m = piece["idx"], piece["required_m"], piece["done_m"]
    while left > 0:
        give = min(required - done_m, left)
        done_m += give
        left -= give
        conn.execute(
            "UPDATE game_pieces SET done_m = %s, done_at = %s"
            " WHERE challenge_id = %s AND idx = %s",
            (done_m, now if done_m >= required else None, challenge_id, idx),
        )
        _contribute(conn, challenge_id, idx, user_id, run_id, give, now)
        if done_m < required or left <= 0:
            break
        following = conn.execute(
            "SELECT idx, required_m, done_m FROM game_pieces WHERE challenge_id = %s"
            " AND holder_id IS NULL AND done_at IS NULL AND required_m IS NOT NULL"
            " ORDER BY idx LIMIT 1",
            (challenge_id,),
        ).fetchone()
        if following is None:
            break
        idx, required, done_m = (
            following["idx"],
            following["required_m"],
            following["done_m"],
        )
        conn.execute(
            "UPDATE game_pieces SET holder_id = %s, held_at = %s"
            " WHERE challenge_id = %s AND idx = %s",
            (user_id, now, challenge_id, idx),
        )


def _fill_fast(
    conn: Connection[DictRow],
    challenge_id: UUID,
    user_id: int,
    run_id: int,
    piece: Mapping[str, Any],
    best_s: Mapping[int, float],
    now: datetime,
) -> None:
    """A fast piece is done by a run with the best time it asks."""
    distance_m: int = piece["fast_distance_m"]
    target_s = piece["max_pace_s"] * distance_m / 1000
    best = best_s.get(distance_m)
    if best is None or best > target_s:
        return
    conn.execute(
        "UPDATE game_pieces SET done_m = %s, done_at = %s"
        " WHERE challenge_id = %s AND idx = %s",
        (distance_m, now, challenge_id, piece["idx"]),
    )
    _contribute(conn, challenge_id, piece["idx"], user_id, run_id, distance_m, now)


def _contribute(
    conn: Connection[DictRow],
    challenge_id: UUID,
    idx: int,
    user_id: int,
    run_id: int,
    metres: int,
    now: datetime,
) -> None:
    conn.execute(
        "INSERT INTO game_contributions (challenge_id, piece_idx, user_id, run_id,"
        " metres, at) VALUES (%s, %s, %s, %s, %s, %s)",
        (challenge_id, idx, user_id, run_id, metres, now),
    )


def _complete_if_done(
    conn: Connection[DictRow], challenge_id: UUID, now: datetime
) -> None:
    """Every piece done: the challenge is complete, and each contributor has
    the shape's team edition, kept whatever happens to the challenge."""
    left = conn.execute(
        "SELECT 1 FROM game_pieces WHERE challenge_id = %s AND done_at IS NULL LIMIT 1",
        (challenge_id,),
    ).fetchone()
    if left is not None:
        return
    row = conn.execute(
        "UPDATE game_challenges SET completed_at = %s"
        " WHERE id = %s AND completed_at IS NULL RETURNING shape_id",
        (now, challenge_id),
    ).fetchone()
    if row is None:
        return
    conn.execute(
        "INSERT INTO game_unlocks (user_id, shape_id, edition, unlocked_at, run_id,"
        " challenge_id)"
        " SELECT DISTINCT user_id, %s, 'team', %s, NULL::bigint, %s"
        " FROM game_contributions"
        " WHERE challenge_id = %s ON CONFLICT DO NOTHING",
        (row["shape_id"], now, challenge_id, challenge_id),
    )


def pieces_done_by(
    conn: Connection[DictRow], user_id: int, run_id: int
) -> list[DictRow]:
    """The pieces the run finished: one row each, with its challenge, its
    team, and whether the challenge is complete (`challenge_completed`) and
    was completed by this very run (`completed_now`)."""
    return conn.execute(
        "SELECT c.id AS challenge_id, c.team_id, t.name AS team_name, c.shape_id,"
        " p.idx, (SELECT count(*) FROM game_pieces q WHERE q.challenge_id = c.id)"
        " AS pieces, c.completed_at IS NOT NULL AS challenge_completed,"
        " c.completed_at = k.at AS completed_now"
        " FROM game_contributions k"
        " JOIN game_pieces p ON p.challenge_id = k.challenge_id AND p.idx = k.piece_idx"
        " JOIN game_challenges c ON c.id = k.challenge_id"
        " JOIN game_teams t ON t.id = c.team_id"
        " WHERE k.run_id = %s AND k.user_id = %s AND p.done_at = k.at"
        " ORDER BY c.starts_at, c.id, p.idx",
        (run_id, user_id),
    ).fetchall()


def pieces_done_bodies(rows: list[DictRow]) -> list[PieceDoneBody]:
    return [
        PieceDoneBody(
            challenge_id=row["challenge_id"],
            team_id=row["team_id"],
            team_name=row["team_name"],
            shape_id=row["shape_id"],
            idx=row["idx"],
            pieces=int(row["pieces"]),
            challenge_completed=bool(row["challenge_completed"]),
        )
        for row in rows
    ]


# --- The pushes ---


def _members(conn: Connection[DictRow], team_id: UUID) -> list[int]:
    rows = conn.execute(
        "SELECT user_id FROM game_team_members WHERE team_id = %s ORDER BY user_id",
        (team_id,),
    ).fetchall()
    return [int(row["user_id"]) for row in rows]


def challenge_event(
    kind: Kind,
    actor_id: int,
    recipient_id: int,
    challenge_id: UUID,
    shape_id: str,
    number: int | None = None,
    key: str = "",
) -> PushEvent:
    """An event of a challenge: `data` opens the challenge; the text names
    the shape in the phone's language and, for a piece or the pieces
    missing, their number."""
    shape = BY_ID.get(shape_id)
    return PushEvent(
        kind,
        actor_id,
        recipient_id,
        key=key or str(challenge_id),
        challenge_id=challenge_id,
        number=number,
        names=None if shape is None else shape.names,
    )


def notify_pieces(request: Request, user_id: int, key: str) -> None:
    """After a new run is saved, outside its transaction (game.py): the
    teammates are told of each piece it finished, and every member of a
    challenge it completed. Never raises."""
    pusher: Pusher | None = getattr(request.app.state, "pusher", None)
    accounts: Accounts | None = getattr(request.app.state, "accounts", None)
    if pusher is None or accounts is None:
        return
    try:
        with accounts.database.connect() as conn:
            run = conn.execute(
                "SELECT id FROM runs WHERE user_id = %s AND key = %s", (user_id, key)
            ).fetchone()
            done = [] if run is None else pieces_done_by(conn, user_id, run["id"])
            members = {row["team_id"]: _members(conn, row["team_id"]) for row in done}
    except Exception:
        log.exception("game: the pieces of a run were not read")
        return
    completed: set[UUID] = set()
    for row in done:
        for member in members[row["team_id"]]:
            pusher.notify(
                challenge_event(
                    "piece_done",
                    user_id,
                    member,
                    row["challenge_id"],
                    row["shape_id"],
                    number=row["idx"] + 1,
                    key=f"{row['challenge_id']}:{row['idx']}",
                )
            )
        if row["completed_now"] and row["challenge_id"] not in completed:
            completed.add(row["challenge_id"])
            for member in members[row["team_id"]]:
                pusher.notify(
                    challenge_event(
                        "challenge_done",
                        user_id,
                        member,
                        row["challenge_id"],
                        row["shape_id"],
                    )
                )


Later = Callable[[float, Callable[[], None]], Any]


def _later(delay_s: float, task: Callable[[], None]) -> Any:
    timer = threading.Timer(delay_s, task)
    timer.daemon = True
    timer.start()
    return timer


@dataclass
class ChallengeClock:
    """Looks, every `every_s`, for the challenges within ENDING_BEFORE of
    their deadline, and tells their members once (push challenge_ending).
    Started and stopped with the app; the tests call check()."""

    database: Database
    now: Callable[[], datetime]
    # Read when needed: the pusher may be set after this is made.
    pusher_of: Callable[[], Pusher | None]
    later: Later = _later
    every_s: float = CHECK_EVERY_S

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._ticking = threading.Lock()
        self._timer: Any = None
        self._running = False

    def start(self) -> None:
        with self._lock:
            if self._running:
                return
            self._running = True
            self._timer = self.later(self.every_s, self._tick)

    def stop(self) -> None:
        """No more checks; a check under way ends before this returns, so
        the app may close its database right after (app.py's lifespan)."""
        with self._lock:
            self._running = False
            timer, self._timer = self._timer, None
        if timer is not None and hasattr(timer, "cancel"):
            timer.cancel()
        with self._ticking:
            pass

    def _tick(self) -> None:
        with self._ticking:
            with self._lock:
                running = self._running
            if not running:
                return
            try:
                self.check()
            except Exception:
                log.exception("game: the ending challenges were not checked")
        with self._lock:
            if self._running:
                self._timer = self.later(self.every_s, self._tick)

    def check(self) -> list[UUID]:
        """The challenges told now: not complete, a day or less to their
        deadline, longer than a day in all, and not told before."""
        now = self.now()
        with self.database.connect() as conn:
            rows = conn.execute(
                "UPDATE game_challenges SET ending_told_at = %s"
                " WHERE completed_at IS NULL AND ending_told_at IS NULL"
                " AND starts_at < ends_at - %s AND ends_at - %s <= %s AND %s < ends_at"
                " RETURNING id, team_id, shape_id",
                (now, ENDING_BEFORE, ENDING_BEFORE, now, now),
            ).fetchall()
            told = [
                (
                    row,
                    _members(conn, row["team_id"]),
                    _missing(conn, row["id"]),
                )
                for row in rows
            ]
        pusher = self.pusher_of()
        for row, members, missing in told:
            for member in members:
                if pusher is not None:
                    pusher.notify(
                        challenge_event(
                            "challenge_ending",
                            member,
                            member,
                            row["id"],
                            row["shape_id"],
                            number=missing,
                        )
                    )
        return [row["id"] for row, _, _ in told]


def _missing(conn: Connection[DictRow], challenge_id: UUID) -> int:
    row = conn.execute(
        "SELECT count(*) AS n FROM game_pieces WHERE challenge_id = %s"
        " AND done_at IS NULL",
        (challenge_id,),
    ).fetchone()
    assert row is not None
    return int(row["n"])


# --- In the database ---


@dataclass
class Challenges:
    """The challenges of the teams, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def create(
        self, user_id: int, team_id: UUID, body: ChallengeRequestBody
    ) -> ChallengeBody:
        """A new challenge of the team, when none is going: the team is
        locked while it is checked and written."""
        shape = BY_ID.get(body.shape_id)
        if shape is None:
            raise AccountError(422, "invalid_request", NO_SHAPE)
        with self.database.connect() as conn:
            team = conn.execute(
                "SELECT 1 FROM game_teams WHERE id = %s FOR UPDATE", (team_id,)
            ).fetchone()
            if team is None or not member_of_team(conn, team_id, user_id):
                raise AccountError(404, "http_error", NO_TEAM)
            now = self.now()
            if active_of_team(conn, team_id, now):
                raise AccountError(409, "http_error", HAS_CHALLENGE)
            row = conn.execute(
                "INSERT INTO game_challenges (team_id, shape_id, created_by,"
                " starts_at, ends_at) VALUES (%s, %s, %s, %s, %s)"
                " RETURNING id, team_id, shape_id, starts_at, ends_at, completed_at",
                (team_id, shape.id, user_id, now, now + timedelta(days=body.days)),
            ).fetchone()
            assert row is not None
            goal = body.piece
            for idx in range(body.pieces):
                conn.execute(
                    "INSERT INTO game_pieces (challenge_id, idx, required_m,"
                    " fast_distance_m, max_pace_s) VALUES (%s, %s, %s, %s, %s)",
                    (row["id"], idx, goal.total_m, goal.distance_m, goal.pace_s),
                )
            return challenge_body(conn, row, now)

    def read(self, user_id: int, challenge_id: UUID) -> ChallengeBody:
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {CHALLENGE_COLUMNS} FROM game_challenges c WHERE c.id = %s",
                (challenge_id,),
            ).fetchone()
            if row is None or not member_of_team(conn, row["team_id"], user_id):
                raise AccountError(404, "http_error", NO_CHALLENGE)
            return challenge_body(conn, row, self.now())

    def hold(self, user_id: int, challenge_id: UUID, idx: int) -> ChallengeBody:
        """The free piece `idx` is the member's: one in progress at a time
        in a challenge. Held already by the member: nothing changes."""
        with self.database.connect() as conn:
            row = self._locked(conn, user_id, challenge_id)
            now = self.now()
            if status_of(row, now) != "active":
                raise AccountError(409, "http_error", CHALLENGE_OVER)
            piece = _piece(conn, challenge_id, idx)
            if piece["done_at"] is not None:
                raise AccountError(409, "http_error", PIECE_DONE)
            if piece["holder_id"] == user_id:
                return challenge_body(conn, row, now)
            if piece["holder_id"] is not None:
                raise AccountError(409, "http_error", PIECE_TAKEN)
            holding = conn.execute(
                "SELECT 1 FROM game_pieces WHERE challenge_id = %s AND holder_id = %s"
                " AND done_at IS NULL",
                (challenge_id, user_id),
            ).fetchone()
            if holding is not None:
                raise AccountError(409, "http_error", HOLDING_ALREADY)
            conn.execute(
                "UPDATE game_pieces SET holder_id = %s, held_at = %s"
                " WHERE challenge_id = %s AND idx = %s",
                (user_id, now, challenge_id, idx),
            )
            return challenge_body(conn, row, now)

    def release(self, user_id: int, challenge_id: UUID, idx: int) -> ChallengeBody:
        """The piece goes back free, its metres kept."""
        with self.database.connect() as conn:
            row = self._locked(conn, user_id, challenge_id)
            piece = _piece(conn, challenge_id, idx)
            if piece["done_at"] is not None:
                raise AccountError(409, "http_error", PIECE_DONE)
            if piece["holder_id"] != user_id:
                raise AccountError(409, "http_error", NOT_YOUR_PIECE)
            conn.execute(
                "UPDATE game_pieces SET holder_id = NULL, held_at = NULL"
                " WHERE challenge_id = %s AND idx = %s",
                (challenge_id, idx),
            )
            return challenge_body(conn, row, self.now())

    def _locked(
        self, conn: Connection[DictRow], user_id: int, challenge_id: UUID
    ) -> DictRow:
        """The challenge, locked, for one of its team; 404 for the others."""
        row = conn.execute(
            f"SELECT {CHALLENGE_COLUMNS} FROM game_challenges c WHERE c.id = %s"
            " FOR UPDATE",
            (challenge_id,),
        ).fetchone()
        if row is None or not member_of_team(conn, row["team_id"], user_id):
            raise AccountError(404, "http_error", NO_CHALLENGE)
        return row


def _piece(conn: Connection[DictRow], challenge_id: UUID, idx: int) -> DictRow:
    row = conn.execute(
        "SELECT holder_id, done_at FROM game_pieces WHERE challenge_id = %s"
        " AND idx = %s",
        (challenge_id, idx),
    ).fetchone()
    if row is None:
        raise AccountError(404, "http_error", NO_PIECE)
    return row


# --- The endpoints ---


def challenges_of(
    accounts: Annotated[Accounts, Depends(accounts_of)],
) -> Challenges:
    """In the database of the accounts, on the same clock."""
    return Challenges(accounts.database, accounts.now)


Them = Annotated[Challenges, Depends(challenges_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}
REFUSED: dict[int | str, dict[str, Any]] = {**NOT_FOUND, 409: {"model": ErrorBody}}
Idx = Annotated[int, Path(ge=0, lt=MAX_PIECES)]


def challenge_routes() -> APIRouter:
    router = APIRouter(tags=["game"], responses=ACCOUNT_ERRORS)

    @router.post("/game/teams/{team_id}/challenges", status_code=201, responses=REFUSED)
    def create_challenge(
        team_id: UUID, body: ChallengeRequestBody, challenges: Them, user: Me
    ) -> ChallengeBody:
        return challenges.create(user.id, team_id, body)

    @router.get("/game/challenges/{challenge_id}", responses=NOT_FOUND)
    def challenge(challenge_id: UUID, challenges: Them, user: Me) -> ChallengeBody:
        return challenges.read(user.id, challenge_id)

    @router.post("/game/challenges/{challenge_id}/pieces/{idx}/hold", responses=REFUSED)
    def hold_piece(
        challenge_id: UUID, idx: Idx, challenges: Them, user: Me
    ) -> ChallengeBody:
        return challenges.hold(user.id, challenge_id, idx)

    @router.delete(
        "/game/challenges/{challenge_id}/pieces/{idx}/hold", responses=REFUSED
    )
    def leave_piece(
        challenge_id: UUID, idx: Idx, challenges: Them, user: Me
    ) -> ChallengeBody:
        return challenges.release(user.id, challenge_id, idx)

    return router


def install_game_challenges(app: FastAPI) -> None:
    """The challenges and their clock; after install_accounts and
    install_push (game.install_game calls it). The clock runs only while
    the app does: it is started and stopped around the app's lifespan,
    which install_game_challenges wraps. Without a database there is no
    clock, and the endpoints answer 503."""
    accounts: Accounts | None = app.state.accounts
    if accounts is not None:
        clock = ChallengeClock(
            accounts.database,
            accounts.now,
            lambda: getattr(app.state, "pusher", None),
        )
        app.state.game_clock = clock
        _around_lifespan(app, clock)
    app.include_router(challenge_routes())


def _around_lifespan(app: FastAPI, clock: ChallengeClock) -> None:
    inner = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app_: FastAPI) -> AsyncIterator[Any]:
        async with inner(app_) as state:
            clock.start()
            try:
                yield state
            finally:
                clock.stop()

    app.router.lifespan_context = lifespan
