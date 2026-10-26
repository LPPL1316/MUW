"""The first contest: for a period the posts for everyone race, and the one
with the most reactions wins (TASK-299, ADR-0260, docs/CONCORSI.md,
docs/API.md, «Contest»).

The server decides, the app shows. Who takes part, what counts, who leads
and who won come from one query (RANKED_SQL), read by GET /contests/current
and by the commands alike: two readings give the same order.

A drawing takes part when it is for everyone, published between starts_at
and ends_at, not hidden (TASK-291) nor of a hidden account, and not left
out at the close (--exclude). A reaction counts when it is another
account's (one each: the table keeps one per account and drawing, whatever
its kind), not kept apart from the author by a block (follows.apart_sql,
as in the feed: a hidden account's does not count either), and left by
ends_at (created_at <= ends_at: changed after the end, it counts no more).
Ties: more MuW hearts (super_like), then the post published first, then
the id.

The prize has no money value: the badge (contest_wins in the profiles,
accounts.contest_wins_sql), the winner's post at the top of the feed for
SHOWN_AFTER_CLOSE, one push contest_won to the winner. A person proclaims,
with the commands of docs/CONCORSI.md §11:

    python -m shaperoute_api.contests open --from 2026-11-02T00:00+01:00 \\
        --to 2026-11-15T23:59:59+01:00
    python -m shaperoute_api.contests standings
    python -m shaperoute_api.contests close [--exclude <drawing_id> …] [--dry-run]

`close` writes the winner once (the row locked, then UPDATE … WHERE
closed_at IS NULL): run twice, the second time changes nothing and says
so; before ends_at it refuses. The push leaves after the commit, with
push.py's Pusher and its switches.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, TextIO
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    Credentials,
    UserBody,
    accounts_of,
)
from shaperoute_api.db import Database
from shaperoute_api.drawings import LISTED_COLUMNS, AuthorBody, _details, _line, _seen
from shaperoute_api.feed import FeedPostBody
from shaperoute_api.follows import apart_sql
from shaperoute_api.push import Pusher, PushEvent
from shaperoute_api.recommended import preview
from shaperoute_api.schemas import ErrorBody

# After closed_at the contest is still answered for this long: the week of
# the winner's post at the top of the feed (CONCORSI.md §6).
SHOWN_AFTER_CLOSE = timedelta(days=7)
# How many posts the card shows, and how many `standings` prints.
TOP = 3
STANDINGS = 10

NO_CONTEST = "There is no contest right now."
NOT_A_PERIOD = "the contest must end after it starts"
ONE_OPEN = "a contest is open already: close it first"
NO_OPEN = "no contest is open"
NO_OFFSET = "give the moment with its offset, like 2026-11-02T00:00+01:00"


# --- The bodies ---


class ContestEntryBody(BaseModel):
    """One of the first posts of the contest."""

    rank: int = Field(
        description="Its place in the whole standings: a post left out of"
        " `top` across a block with who asks keeps its number."
    )
    reactions: int = Field(description="The reactions that count.")
    drawing: FeedPostBody


class ContestMineBody(BaseModel):
    """The best post of who asks, when it has one that takes part."""

    drawing_id: UUID
    rank: int
    reactions: int


class ContestWinnerBody(BaseModel):
    """The winner, once the contest is closed."""

    reactions: int
    drawing: FeedPostBody | None = Field(
        description="Null when its run was deleted since."
    )


class ContestBody(BaseModel):
    """GET /contests/current: the contest open, or closed less than a week
    ago: packages/shared-types/fixtures/contest.json and contest-closed.json."""

    id: UUID
    starts_at: datetime
    ends_at: datetime
    closed_at: datetime | None = Field(
        description="When the winner was proclaimed; null while open."
    )
    top: list[ContestEntryBody] = Field(
        description=f"At most {TOP}, in the order of docs/CONCORSI.md §4."
    )
    mine: ContestMineBody | None = Field(
        default=None,
        description="Only with a token: who asks' best post, or null without"
        " one that takes part. Absent without a token.",
    )
    winner: ContestWinnerBody | None = Field(
        description="After the close; null while open."
    )


# --- Who takes part and what counts, in SQL ---


def counted_sql(narrowed: str = "") -> str:
    """How many reactions of the drawing `d` of the run `r` count
    (docs/CONCORSI.md §3), as a subquery: another account's, not kept apart
    from the author (follows.apart_sql), left by the placeholder `ends_at`;
    `narrowed` adds a condition on the reaction `x` or its account `xu`."""
    return (
        "(SELECT count(*) FROM reactions x JOIN users xu ON xu.id = x.user_id"
        " WHERE x.drawing_id = d.id AND x.user_id <> r.user_id"
        " AND x.created_at <= %(ends_at)s"
        f" AND NOT {apart_sql('r.user_id', 'x.user_id')}{narrowed})"
    )


# The MuW hearts, the first key of a tie.
HEARTS = " AND x.kind = 'super_like'"
# From accounts made after the contest started (CONCORSI.md §5): `standings`
# prints them for whoever closes the contest to see a trick.
YOUNG = " AND xu.created_at >= %(starts_at)s"

# The drawing `d` of the run `r` of the account `u` takes part: for everyone,
# published in the period, not hidden nor of a hidden account (TASK-291),
# not left out (the placeholder `excluded`, the ids of `close --exclude`).
PARTICIPATES_SQL = (
    "d.visibility = 'everyone'"
    " AND d.published_at >= %(starts_at)s AND d.published_at <= %(ends_at)s"
    " AND d.hidden_at IS NULL AND u.hidden_at IS NULL"
    " AND NOT (d.id = ANY(%(excluded)s::uuid[]))"
)

# The standings: every drawing that takes part, as the feed lists it, with
# what counts and its place. The one query of the endpoint and the commands
# (ADR-0260, point 1). Placeholders: starts_at, ends_at, excluded.
RANKED_SQL = (
    "WITH entries AS ("
    f"SELECT {LISTED_COLUMNS}, r.user_id, u.public_id, u.username,"
    f" {counted_sql()} AS reactions, {counted_sql(HEARTS)} AS hearts,"
    f" {counted_sql(YOUNG)} AS young"
    " FROM drawings d JOIN runs r ON r.id = d.run_id"
    " JOIN users u ON u.id = r.user_id"
    f" WHERE {PARTICIPATES_SQL}),"
    " ranked AS (SELECT entries.*, row_number() OVER"
    # `standing`, not `place`: `place` is the run's town (LISTED_COLUMNS).
    " (ORDER BY reactions DESC, hearts DESC, published_at, id) AS standing"
    " FROM entries)"
)

CONTEST_COLUMNS = "id, starts_at, ends_at, winner_drawing_id, winner_user_id, closed_at"


@dataclass(frozen=True)
class Contest:
    """A row of `contests`."""

    id: UUID
    starts_at: datetime
    ends_at: datetime
    winner_drawing_id: UUID | None
    winner_user_id: int | None
    closed_at: datetime | None


@dataclass(frozen=True)
class Standing:
    """A post in the standings, as `standings` prints it."""

    place: int
    drawing_id: UUID
    user_id: int
    username: str
    title: str | None
    reactions: int
    young: int
    hearts: int


@dataclass(frozen=True)
class Closing:
    """What `close` did, or would do with --dry-run."""

    contest: Contest | None
    """None: no contest is open."""
    winner: Standing | None
    """None: nobody took part."""
    written: bool


def _contest(row: DictRow) -> Contest:
    return Contest(
        row["id"],
        row["starts_at"],
        row["ends_at"],
        row["winner_drawing_id"],
        row["winner_user_id"],
        row["closed_at"],
    )


def _standing(row: DictRow) -> Standing:
    return Standing(
        int(row["standing"]),
        row["id"],
        int(row["user_id"]),
        row["username"],
        row["title"],
        int(row["reactions"]),
        int(row["young"]),
        int(row["hearts"]),
    )


def _ranked(
    conn: Connection[DictRow],
    contest: Contest,
    *,
    top: int = TOP,
    viewer_id: int | None = None,
    winner_id: UUID | None = None,
    excluded: Sequence[UUID] = (),
) -> list[DictRow]:
    """The first `top` of the standings, who asks' posts and the winner's,
    by place. `in_top` says whether a row is one of the first `top` that
    `viewer_id` may see: across a block the post is left out, and the
    places keep their numbers."""
    apart = "FALSE" if viewer_id is None else apart_sql("%(viewer)s", "ranked.user_id")
    return conn.execute(
        f"{RANKED_SQL} SELECT ranked.*,"
        f" (standing <= %(top)s AND NOT {apart}) AS in_top,"
        " (user_id = %(viewer)s::bigint) AS is_mine,"
        " (id = %(winner)s::uuid) AS is_winner"
        " FROM ranked WHERE standing <= %(top)s OR user_id = %(viewer)s::bigint"
        " OR id = %(winner)s::uuid ORDER BY standing",
        {
            "starts_at": contest.starts_at,
            "ends_at": contest.ends_at,
            "excluded": list(excluded),
            "top": top,
            "viewer": viewer_id,
            "winner": winner_id,
        },
    ).fetchall()


def _post(row: DictRow, details: Any) -> FeedPostBody:
    """A drawing of the standings as the feed lists it, with its author."""
    return FeedPostBody(
        **_seen(row, details),
        track_preview=preview(_line(row["track"])),
        author=AuthorBody(public_id=row["public_id"], username=row["username"]),
    )


@dataclass
class Contests:
    """The contests in the database."""

    database: Database
    now: Callable[[], datetime]

    def current(self, viewer_id: int | None = None) -> ContestBody | None:
        """The contest open, or closed less than SHOWN_AFTER_CLOSE ago, as
        `viewer_id` sees it; without an account, without `mine`. None
        when there is none."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {CONTEST_COLUMNS} FROM contests"
                " WHERE closed_at IS NULL OR closed_at > %s"
                " ORDER BY closed_at IS NULL DESC, closed_at DESC LIMIT 1",
                (self.now() - SHOWN_AFTER_CLOSE,),
            ).fetchone()
            if row is None:
                return None
            contest = _contest(row)
            rows = _ranked(
                conn, contest, viewer_id=viewer_id, winner_id=contest.winner_drawing_id
            )
            details = _details(conn, [r["id"] for r in rows])
        fields: dict[str, Any] = {
            "id": contest.id,
            "starts_at": contest.starts_at,
            "ends_at": contest.ends_at,
            "closed_at": contest.closed_at,
            "top": [
                ContestEntryBody(
                    rank=r["standing"],
                    reactions=r["reactions"],
                    drawing=_post(r, details),
                )
                for r in rows
                if r["in_top"]
            ],
            "winner": None,
        }
        if contest.closed_at is not None:
            won = next((r for r in rows if r["is_winner"]), None)
            fields["winner"] = ContestWinnerBody(
                reactions=0 if won is None else won["reactions"],
                drawing=None if won is None else _post(won, details),
            )
        if viewer_id is not None:
            mine = next((r for r in rows if r["is_mine"]), None)
            fields["mine"] = (
                None
                if mine is None
                else ContestMineBody(
                    drawing_id=mine["id"],
                    rank=mine["standing"],
                    reactions=mine["reactions"],
                )
            )
        return ContestBody(**fields)

    def open(self, starts_at: datetime, ends_at: datetime) -> Contest:
        """A contest opened for the period; ValueError when another is open
        or `ends_at` is not after `starts_at`."""
        if ends_at <= starts_at:
            raise ValueError(NOT_A_PERIOD)
        try:
            with self.database.connect() as conn:
                row = conn.execute(
                    "INSERT INTO contests (starts_at, ends_at, created_at)"
                    f" VALUES (%s, %s, %s) RETURNING {CONTEST_COLUMNS}",
                    (starts_at, ends_at, self.now()),
                ).fetchone()
        except pg_errors.UniqueViolation:
            raise ValueError(ONE_OPEN) from None
        assert row is not None
        return _contest(row)

    def standings(self, limit: int = STANDINGS) -> list[Standing] | None:
        """The first `limit` of the open contest; None without one."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {CONTEST_COLUMNS} FROM contests WHERE closed_at IS NULL"
            ).fetchone()
            if row is None:
                return None
            rows = _ranked(conn, _contest(row), top=limit)
        return [_standing(r) for r in rows]

    def close(
        self,
        exclude: Sequence[UUID] = (),
        dry_run: bool = False,
        pusher: Pusher | None = None,
    ) -> Closing:
        """The open contest closed with its winner, the first of the
        standings without the posts in `exclude`; nobody when nobody took
        part. Once: the row is locked and written only while closed_at is
        null. With `dry_run` nothing is written. Then, after the commit,
        the push to the winner. ValueError before ends_at."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {CONTEST_COLUMNS} FROM contests WHERE closed_at IS NULL"
                " FOR UPDATE"
            ).fetchone()
            if row is None:
                return Closing(None, None, False)
            contest = _contest(row)
            now = self.now()
            if now < contest.ends_at:
                raise ValueError(
                    f"the contest ends at {contest.ends_at.isoformat()}: close it after"
                )
            rows = _ranked(conn, contest, top=1, excluded=exclude)
            won = _standing(rows[0]) if rows else None
            if dry_run:
                return Closing(contest, won, False)
            updated = conn.execute(
                "UPDATE contests SET winner_drawing_id = %s, winner_user_id = %s,"
                " closed_at = %s WHERE id = %s AND closed_at IS NULL RETURNING id",
                (
                    None if won is None else won.drawing_id,
                    None if won is None else won.user_id,
                    now,
                    contest.id,
                ),
            ).fetchone()
            assert updated is not None, "the row was locked"
        closed = replace(
            contest,
            winner_drawing_id=None if won is None else won.drawing_id,
            winner_user_id=None if won is None else won.user_id,
            closed_at=now,
        )
        if won is not None and pusher is not None:
            pusher.notify(
                PushEvent("contest_won", won.user_id, won.user_id, won.drawing_id)
            )
        return Closing(closed, won, True)


# --- The commands ---


def _moment(text: str) -> datetime:
    """An ISO 8601 moment with its offset, for --from and --to."""
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a moment: {text!r}") from None
    if moment.tzinfo is None:
        raise argparse.ArgumentTypeError(NO_OFFSET)
    return moment


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.contests",
        description="The contests of MuW: open one, read its standings, close"
        " it (docs/CONCORSI.md §11).",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    opening = commands.add_parser("open", help="open a contest; one at a time")
    opening.add_argument(
        "--from",
        dest="starts_at",
        required=True,
        type=_moment,
        metavar="MOMENT",
        help="when it starts, with the offset: 2026-11-02T00:00+01:00",
    )
    opening.add_argument(
        "--to",
        dest="ends_at",
        required=True,
        type=_moment,
        metavar="MOMENT",
        help="when it ends, after --from: 2026-11-15T23:59:59+01:00",
    )
    commands.add_parser("standings", help=f"the first {STANDINGS} of the open contest")
    closing = commands.add_parser(
        "close", help="proclaim the winner of the open contest, once"
    )
    closing.add_argument(
        "--exclude",
        action="append",
        default=[],
        type=UUID,
        metavar="DRAWING_ID",
        help="a post left out, for a trick seen in the standings; repeatable",
    )
    closing.add_argument(
        "--dry-run", action="store_true", help="say who would win; write nothing"
    )
    return parser


def _line_of(standing: Standing) -> str:
    title = "(no title)" if standing.title is None else f"«{standing.title}»"
    return (
        f"{standing.place:2d}. {standing.username}  {title}"
        f"  {standing.reactions} reaction(s), {standing.young} from accounts"
        f" younger than the contest, {standing.hearts} MuW heart(s)"
        f"  {standing.drawing_id}"
    )


def _run(
    contests: Contests, args: argparse.Namespace, pusher: Pusher, out: TextIO
) -> int:
    if args.command == "open":
        contest = contests.open(args.starts_at, args.ends_at)
        print(
            f"contests: opened {contest.id}, from {contest.starts_at.isoformat()}"
            f" to {contest.ends_at.isoformat()}",
            file=out,
        )
        return 0
    if args.command == "standings":
        standings = contests.standings()
        if standings is None:
            print(f"contests: {NO_OPEN}", file=out)
            return 1
        print(f"contests: the first {STANDINGS}", file=out)
        for standing in standings:
            print(_line_of(standing), file=out)
        if not standings:
            print("(nobody took part yet)", file=out)
        return 0
    closing = contests.close(args.exclude, args.dry_run, pusher)
    if closing.contest is None:
        print(f"contests: {NO_OPEN}: nothing to close", file=out)
        return 1
    verb = "would close" if args.dry_run else "closed"
    if closing.winner is None:
        print(f"contests: {verb} {closing.contest.id} without a winner", file=out)
    else:
        told = "" if args.dry_run else "; the winner is told with a push"
        print(
            f"contests: {verb} {closing.contest.id}; the winner is"
            f" {closing.winner.username} with {closing.winner.reactions}"
            f" reaction(s), drawing {closing.winner.drawing_id}{told}",
            file=out,
        )
    return 0


def main(
    argv: Sequence[str] | None = None,
    *,
    database: Database | None = None,
    pusher: Pusher | None = None,
    now: Callable[[], datetime] | None = None,
    out: TextIO | None = None,
) -> int:
    """The commands; the keyword arguments are for the tests. 0 when done,
    1 when there was nothing to do, 2 for a refusal."""
    args = _parser().parse_args(argv)
    out = sys.stdout if out is None else out
    if database is None:
        database = Database.from_env()
        if database is None:
            print("contests: SHAPEROUTE_DATABASE_URL is not set", file=sys.stderr)
            return 2
    contests = Contests(database, now or (lambda: datetime.now(UTC)))
    if pusher is None:
        # The one push, sent before the command returns; the receipts are
        # left to the API's next sends.
        pusher = Pusher(database, run=lambda task: task(), later=lambda *_: None)
    try:
        return _run(contests, args, pusher, out)
    except ValueError as error:
        print(f"contests: {error}", file=sys.stderr)
        return 2


# --- The endpoint ---


def contests_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Contests:
    """In the database of the accounts, on the same clock."""
    return Contests(accounts.database, accounts.now)


def viewer_of(
    accounts: Annotated[Accounts, Depends(accounts_of)], credentials: Credentials
) -> UserBody | None:
    """The account of the token when the request carries one: the contest
    is answered without one too. A token that is no session's is 401, as
    everywhere."""
    return None if credentials is None else accounts.user_of(credentials.credentials)


def contest_routes() -> APIRouter:
    router = APIRouter(tags=["contest"], responses=ACCOUNT_ERRORS)

    # `mine` is left out without a token: exclude_unset.
    @router.get(
        "/contests/current",
        responses={404: {"model": ErrorBody}},
        response_model_exclude_unset=True,
    )
    def current_contest(
        contests: Annotated[Contests, Depends(contests_of)],
        viewer: Annotated[UserBody | None, Depends(viewer_of)],
    ) -> ContestBody:
        found = contests.current(None if viewer is None else viewer.id)
        if found is None:
            raise AccountError(404, "no_contest", NO_CONTEST)
        return found

    return router


def install_contests(app: FastAPI) -> None:
    """The contest for anyone with the API's key, `mine` with a token; after
    install_accounts, which sets the database and the errors, and
    install_drawings, whose bodies it reads."""
    app.include_router(contest_routes())


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
