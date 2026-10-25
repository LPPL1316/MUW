"""The teams of the shape game (TASK-296 part C, ADR-0255, docs/GIOCO.md
§6.1).

A team has a name, checked by the word filter of TASK-213 like a comment,
and an invite code of six characters: the only way in, since a team is
never in a search. Up to MAX_MEMBERS members; an account is in at most
MAX_TEAMS teams. Whoever created the team removes members; anyone leaves.
When the owner leaves or deletes the account, the team goes to its oldest
member; a team left without members is deleted.

Blocks (TASK-121): someone who blocked a member, or is blocked by one,
cannot join, and is told «You can't join this team.» like someone who finds
the team full or is in too many teams already: no one learns why. A block
born between two members of one team makes one of them leave (on_block, the
user's rule in tasks/TASK-296.md).

What a member sees of the others: username, picture, the pieces they hold
and the metres they gave (game_challenges.py, which knows the teams' tables
too and is imported here, never the other way round). Never a track, a
time or a place.
"""

from __future__ import annotations

import logging
import re
import secrets
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Response
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.comment_filter import check_comment
from shaperoute_api.comments import CommentRejected
from shaperoute_api.db import Database
from shaperoute_api.follows import (
    PERSON_COLUMNS,
    PersonBody,
    _account,
    _person,
    apart_sql,
)
from shaperoute_api.game_challenges import (
    NO_TEAM,
    ChallengeBody,
    latest_of_team,
    member_of_team,
)
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

MAX_NAME_LENGTH = 40
MAX_MEMBERS = 20
MAX_TEAMS = 10
# The invite code: six of these, without I, O, 0 and 1, which look alike.
CODE_LENGTH = 6
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_PATTERN = re.compile(r"^[A-HJ-NP-Z2-9]{6}$")
# A code drawn is free almost always (32⁶ of them): this many draws before
# giving up.
CODE_TRIES = 20

NAME_EMPTY = "A team needs a name."
NAME_TOO_LONG = f"A team's name is at most {MAX_NAME_LENGTH} characters."
NAME_NOT_TEXT = "A team's name is words: it cannot hold control characters."
TOO_MANY_TEAMS = f"You are in {MAX_TEAMS} teams already: leave one first."
NO_TEAM_CODE = "No team with this code."
# The same words whatever the reason (GIOCO.md §6.1).
CANT_JOIN = "You can't join this team."
ONLY_OWNER = "Only who created the team removes a member."
NOT_IN_TEAM = "No member with this id in this team."


# --- The bodies ---


class TeamRequestBody(BaseModel):
    """POST /game/teams: the name."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        max_length=200,
        description=f"1 to {MAX_NAME_LENGTH} characters on one line, once the"
        " spaces around and between are single.",
    )


class JoinRequestBody(BaseModel):
    """POST /game/teams/join: the invite code, in any case."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=40)


class TeamBody(BaseModel):
    """A team as its members see it: everyone has the code to share."""

    id: UUID
    name: str
    code: str
    owner: UUID | None = Field(description="The public_id of who removes members.")
    members: list[PersonBody] = Field(description="In the order they joined.")
    challenge: ChallengeBody | None = Field(
        description="The newest challenge, whatever its status; null before one."
    )


class TeamsBody(BaseModel):
    teams: list[TeamBody]


# --- The name and the code ---


def checked_name(value: str) -> str:
    """The name as kept: on one line with single spaces; or 422 saying what
    is wrong with it. A negative one is refused like a comment (TASK-213)."""
    name = " ".join(value.split())
    if not name:
        raise AccountError(422, "invalid_request", NAME_EMPTY)
    if len(name) > MAX_NAME_LENGTH:
        raise AccountError(422, "invalid_request", NAME_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" for c in name):
        raise AccountError(422, "invalid_request", NAME_NOT_TEXT)
    reason = check_comment(name)
    if reason is not None:
        raise CommentRejected(reason)
    return name


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalized_code(value: str) -> str | None:
    """The code as typed, in capitals without spaces; None for a text no
    team can have."""
    code = "".join(value.split()).upper()
    return code if CODE_PATTERN.match(code) else None


# --- In the database ---


def remove_member(conn: Connection[DictRow], team_id: UUID, user_id: int) -> None:
    """The member out of the team, whichever way: the pieces held in its
    challenges go back free with their metres, the team goes to its oldest
    member left when the owner leaves, and without members it is gone."""
    conn.execute("SELECT 1 FROM game_teams WHERE id = %s FOR UPDATE", (team_id,))
    conn.execute(
        "UPDATE game_pieces p SET holder_id = NULL, held_at = NULL"
        " FROM game_challenges c WHERE c.id = p.challenge_id AND c.team_id = %s"
        " AND p.holder_id = %s AND p.done_at IS NULL",
        (team_id, user_id),
    )
    conn.execute(
        "DELETE FROM game_team_members WHERE team_id = %s AND user_id = %s",
        (team_id, user_id),
    )
    oldest = conn.execute(
        "SELECT user_id FROM game_team_members WHERE team_id = %s"
        " ORDER BY joined_at, user_id LIMIT 1",
        (team_id,),
    ).fetchone()
    if oldest is None:
        conn.execute("DELETE FROM game_teams WHERE id = %s", (team_id,))
        return
    conn.execute(
        "UPDATE game_teams SET owner_id = %s WHERE id = %s"
        " AND (owner_id IS NULL OR owner_id = %s)",
        (oldest["user_id"], team_id, user_id),
    )


def _owner_of(conn: Connection[DictRow], team_id: UUID) -> int | None:
    """The owner; with none written (the hand-over failed), the oldest
    member."""
    row = conn.execute(
        "SELECT coalesce(t.owner_id, (SELECT m.user_id FROM game_team_members m"
        " WHERE m.team_id = t.id ORDER BY m.joined_at, m.user_id LIMIT 1)) AS owner"
        " FROM game_teams t WHERE t.id = %s",
        (team_id,),
    ).fetchone()
    return None if row is None or row["owner"] is None else int(row["owner"])


def _teams_count(conn: Connection[DictRow], user_id: int) -> int:
    row = conn.execute(
        "SELECT count(*) AS n FROM game_team_members WHERE user_id = %s", (user_id,)
    ).fetchone()
    assert row is not None
    return int(row["n"])


def _members_count(conn: Connection[DictRow], team_id: UUID) -> int:
    row = conn.execute(
        "SELECT count(*) AS n FROM game_team_members WHERE team_id = %s", (team_id,)
    ).fetchone()
    assert row is not None
    return int(row["n"])


def _apart_from_a_member(
    conn: Connection[DictRow], team_id: UUID, user_id: int
) -> bool:
    """Whether a block stands between the account and a member, made by
    either (TASK-121)."""
    row = conn.execute(
        "SELECT 1 FROM game_team_members m JOIN users u ON u.id = m.user_id"
        f" WHERE m.team_id = %s AND {apart_sql('%s', 'u.id')} LIMIT 1",
        (team_id, user_id),
    ).fetchone()
    return row is not None


@dataclass
class Teams:
    """The teams, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]
    # How an invite code is drawn; the tests draw known ones.
    codes: Callable[[], str] | None = None

    def create(self, user_id: int, body: TeamRequestBody) -> TeamBody:
        name = checked_name(body.name)
        with self.database.connect() as conn:
            # The account's teams change one at a time: the count below is
            # the count when the row goes in.
            conn.execute("SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,))
            if _teams_count(conn, user_id) >= MAX_TEAMS:
                raise AccountError(422, "invalid_request", TOO_MANY_TEAMS)
            now = self.now()
            team_id = self._insert(conn, name, user_id, now)
            conn.execute(
                "INSERT INTO game_team_members (team_id, user_id, joined_at)"
                " VALUES (%s, %s, %s)",
                (team_id, user_id, now),
            )
            return self._team(conn, team_id, now)

    def _insert(
        self, conn: Connection[DictRow], name: str, owner_id: int, now: datetime
    ) -> UUID:
        """The team's row, with a code no team has: a code taken meanwhile
        is drawn again, inside a savepoint."""
        draw = self.codes or new_code
        for _ in range(CODE_TRIES):
            code = draw()
            try:
                with conn.transaction():
                    row = conn.execute(
                        "INSERT INTO game_teams (name, invite_code, owner_id,"
                        " created_at) VALUES (%s, %s, %s, %s) RETURNING id",
                        (name, code, owner_id, now),
                    ).fetchone()
            except pg_errors.UniqueViolation:
                continue
            assert row is not None
            return row["id"]
        raise RuntimeError(f"game: no free invite code in {CODE_TRIES} draws")

    def join(self, user_id: int, body: JoinRequestBody) -> TeamBody:
        """In, with the code; a member already stays as it is. Full, too
        many teams, or a block with a member: refused without the reason."""
        code = normalized_code(body.code)
        if code is None:
            raise AccountError(404, "http_error", NO_TEAM_CODE)
        with self.database.connect() as conn:
            # The team's members change one at a time: the counts below are
            # the counts when the row goes in.
            team = conn.execute(
                "SELECT id FROM game_teams WHERE invite_code = %s FOR UPDATE", (code,)
            ).fetchone()
            if team is None:
                raise AccountError(404, "http_error", NO_TEAM_CODE)
            team_id: UUID = team["id"]
            now = self.now()
            if member_of_team(conn, team_id, user_id):
                return self._team(conn, team_id, now)
            conn.execute("SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,))
            if (
                _members_count(conn, team_id) >= MAX_MEMBERS
                or _teams_count(conn, user_id) >= MAX_TEAMS
                or _apart_from_a_member(conn, team_id, user_id)
            ):
                raise AccountError(403, "http_error", CANT_JOIN)
            conn.execute(
                "INSERT INTO game_team_members (team_id, user_id, joined_at)"
                " VALUES (%s, %s, %s)",
                (team_id, user_id, now),
            )
            return self._team(conn, team_id, now)

    def mine(self, user_id: int) -> TeamsBody:
        """The account's teams, the first joined first, each with its newest
        challenge."""
        with self.database.connect() as conn:
            rows = conn.execute(
                "SELECT team_id FROM game_team_members WHERE user_id = %s"
                " ORDER BY joined_at, team_id",
                (user_id,),
            ).fetchall()
            now = self.now()
            return TeamsBody(
                teams=[self._team(conn, row["team_id"], now) for row in rows]
            )

    def remove(self, user_id: int, team_id: UUID, public_id: str) -> None:
        """The account out of the team (its own public_id), or, for the
        owner, another member out."""
        with self.database.connect() as conn:
            team = conn.execute(
                "SELECT 1 FROM game_teams WHERE id = %s FOR UPDATE", (team_id,)
            ).fetchone()
            if team is None or not member_of_team(conn, team_id, user_id):
                raise AccountError(404, "http_error", NO_TEAM)
            other = _account(conn, public_id)
            if other != user_id:
                if _owner_of(conn, team_id) != user_id:
                    raise AccountError(422, "invalid_request", ONLY_OWNER)
                if not member_of_team(conn, team_id, other):
                    raise AccountError(404, "http_error", NOT_IN_TEAM)
            remove_member(conn, team_id, other)

    def _team(
        self, conn: Connection[DictRow], team_id: UUID, now: datetime
    ) -> TeamBody:
        row = conn.execute(
            "SELECT t.id, t.name, t.invite_code, o.public_id AS owner FROM game_teams t"
            " LEFT JOIN users o ON o.id = coalesce(t.owner_id, (SELECT m.user_id"
            " FROM game_team_members m WHERE m.team_id = t.id"
            " ORDER BY m.joined_at, m.user_id LIMIT 1))"
            " WHERE t.id = %s",
            (team_id,),
        ).fetchone()
        assert row is not None
        members = conn.execute(
            f"SELECT {PERSON_COLUMNS} FROM game_team_members m"
            " JOIN users u ON u.id = m.user_id"
            " LEFT JOIN profile_photos p ON p.user_id = u.id"
            " WHERE m.team_id = %s ORDER BY m.joined_at, u.id",
            (team_id,),
        ).fetchall()
        return TeamBody(
            id=row["id"],
            name=row["name"],
            code=row["invite_code"],
            owner=row["owner"],
            members=[_person(member) for member in members],
            challenge=latest_of_team(conn, team_id, now),
        )

    # --- The hooks ---

    def before_account_delete(self, user_id: int) -> None:
        """Before DELETE /me (accounts.py): the account out of every team,
        so each goes to its oldest member or is deleted, and its pieces go
        free. Never raises: the account is deleted whatever happens here,
        and _owner_of reads the oldest member for a team left without an
        owner."""
        try:
            with self.database.connect() as conn:
                rows = conn.execute(
                    "SELECT team_id FROM game_team_members WHERE user_id = %s"
                    " ORDER BY team_id",
                    (user_id,),
                ).fetchall()
                for row in rows:
                    remove_member(conn, row["team_id"], user_id)
        except Exception:
            log.exception("game: the teams of a deleted account were not handed over")

    def on_block(
        self, conn: Connection[DictRow], blocker_id: int, blocked_id: int
    ) -> None:
        """In the transaction that writes a block (moderation.py): in each
        team both are in, one leaves. The user's rule (tasks/TASK-296.md,
        part C): who blocks leaves, unless the team is theirs; then the
        blocked member leaves, so nobody pushes the owner out by blocking
        them."""
        rows = conn.execute(
            "SELECT a.team_id, t.owner_id FROM game_team_members a"
            " JOIN game_team_members b ON b.team_id = a.team_id"
            " JOIN game_teams t ON t.id = a.team_id"
            " WHERE a.user_id = %s AND b.user_id = %s ORDER BY a.team_id",
            (blocker_id, blocked_id),
        ).fetchall()
        for row in rows:
            leaving = blocked_id if row["owner_id"] == blocker_id else blocker_id
            remove_member(conn, row["team_id"], leaving)


# --- The endpoints ---


def teams_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Teams:
    """In the database of the accounts, on the same clock."""
    return Teams(accounts.database, accounts.now)


Them = Annotated[Teams, Depends(teams_of)]
Me = Annotated[UserBody, Depends(current_user)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorBody}}
REFUSED: dict[int | str, dict[str, Any]] = {**NOT_FOUND, 403: {"model": ErrorBody}}


def team_routes() -> APIRouter:
    router = APIRouter(tags=["game"], responses=ACCOUNT_ERRORS)

    @router.post("/game/teams", status_code=201)
    def create_team(body: TeamRequestBody, teams: Them, user: Me) -> TeamBody:
        return teams.create(user.id, body)

    @router.post("/game/teams/join", responses=REFUSED)
    def join_team(body: JoinRequestBody, teams: Them, user: Me) -> TeamBody:
        return teams.join(user.id, body)

    @router.get("/game/teams")
    def my_teams(teams: Them, user: Me) -> TeamsBody:
        return teams.mine(user.id)

    @router.delete(
        "/game/teams/{team_id}/members/{public_id}",
        status_code=204,
        responses=NOT_FOUND,
    )
    def remove_team_member(
        team_id: UUID, public_id: str, teams: Them, user: Me
    ) -> Response:
        teams.remove(user.id, team_id, public_id)
        return Response(status_code=204)

    return router


def install_game_teams(app: FastAPI) -> None:
    """The teams, and what they do when an account is deleted or blocks
    another; after install_accounts and install_moderation (game.install_game
    calls it). Without a database the endpoints answer 503."""
    accounts: Accounts | None = app.state.accounts
    if accounts is not None:
        teams = Teams(accounts.database, accounts.now)
        app.state.before_account_delete.append(teams.before_account_delete)
        on_block: list[Any] | None = getattr(app.state, "on_block", None)
        if on_block is not None:
            on_block.append(teams.on_block)
    app.include_router(team_routes())
