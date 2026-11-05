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

The monthly challenges (TASK-343, ADR-0296, CONCORSI.md §15): a contest
opened with `open --theme FILE.json` has a theme, its title and
description in the five languages. Then only the drawings their owners
entered take part (contest_entries.py: PUT and DELETE
/contests/{id}/entries/{drawing_id}, any number per account), with every
rule above; GET /contests/current says the theme, how many accounts take
part and, with a token, the drawings of who asks entered. Three pushes: a
new challenge, to whoever has the pushes on, when `open` opens it; its last
days (contest_clock.py); its results at the close, to who took part. A
contest without a theme is the one of ADR-0260, untouched.

An app reads only the posts of the activities its header X-MuW-Reads says
(reads.py, TASK-387): the others are left out of `top`, keeping their
places, and a winner's post it does not read is `null`, as for none.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any, TextIO
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, ValidationError

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
from shaperoute_api.push import Kind, Pusher, PushEvent
from shaperoute_api.reads import EVERYTHING, Reads, Shown
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
# The languages a theme is written in by `open --theme`: the app's.
THEME_LANGUAGES = ("en", "de", "it", "es", "fr")
MAX_THEME_TITLE = 60
MAX_THEME_DESCRIPTION = 500


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


class ThemeTextBody(BaseModel):
    """A theme in one language."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=MAX_THEME_TITLE)
    description: str = Field(min_length=1, max_length=MAX_THEME_DESCRIPTION)


class ThemeBody(BaseModel):
    """The theme of a monthly challenge, by language: the app shows its
    own, English when it is missing. `open --theme` asks for all five."""

    model_config = ConfigDict(extra="forbid")

    en: ThemeTextBody
    de: ThemeTextBody | None = None
    it: ThemeTextBody | None = None
    es: ThemeTextBody | None = None
    fr: ThemeTextBody | None = None


class ContestBody(BaseModel):
    """GET /contests/current: the contest open, or closed less than a week
    ago: packages/shared-types/fixtures/contest.json and contest-closed.json.
    A contest with a theme is a ThemedContestBody."""

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


class ThemedContestBody(ContestBody):
    """GET /contests/current for a monthly challenge (TASK-343): the
    contest with its theme, packages/shared-types/fixtures/contest-themed.json.
    Only the drawings entered take part, so `top`, `mine` and `winner` are
    of those."""

    theme: ThemeBody
    entrants: int = Field(
        description="The accounts with at least one drawing that takes part."
    )
    entered: list[UUID] | None = Field(
        default=None,
        description="Only with a token: the drawings of who asks entered,"
        " the first entered first, whether they still take part or not."
        " Absent without a token.",
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

# The drawing `d` of the run `r` of the account `u` takes part: of a run
# recorded by the app, not added from a file (TASK-312, ADR-0272), for
# everyone, published in the period, not hidden nor of a hidden account
# (TASK-291), not left out (the placeholder `excluded`, the ids of
# `close --exclude`).
PARTICIPATES_SQL = (
    "r.source = 'muw' AND d.visibility = 'everyone'"
    " AND d.published_at >= %(starts_at)s AND d.published_at <= %(ends_at)s"
    " AND d.hidden_at IS NULL AND u.hidden_at IS NULL"
    " AND NOT (d.id = ANY(%(excluded)s::uuid[]))"
)

# In a contest with a theme only the drawings entered take part (TASK-343):
# the placeholder `entered_in` is its id; NULL for a contest without one.
ENTERED_SQL = (
    "(%(entered_in)s::uuid IS NULL OR EXISTS (SELECT 1 FROM contest_entries ce"
    " WHERE ce.contest_id = %(entered_in)s::uuid AND ce.drawing_id = d.id))"
)

# The standings: every drawing that takes part, as the feed lists it, with
# what counts and its place. The one query of the endpoint and the commands
# (ADR-0260, point 1), of the gallery and the archive too (ADR-0296, point
# 4). Placeholders: starts_at, ends_at, excluded, entered_in.
RANKED_SQL = (
    "WITH entries AS ("
    f"SELECT {LISTED_COLUMNS}, r.user_id, u.public_id, u.username,"
    f" {counted_sql()} AS reactions, {counted_sql(HEARTS)} AS hearts,"
    f" {counted_sql(YOUNG)} AS young, r.track IS NOT NULL AS tracked"
    " FROM drawings d JOIN runs r ON r.id = d.run_id"
    " JOIN users u ON u.id = r.user_id"
    f" WHERE {PARTICIPATES_SQL} AND {ENTERED_SQL}),"
    " ranked AS (SELECT entries.*, row_number() OVER"
    # `standing`, not `place`: `place` is the run's town (LISTED_COLUMNS).
    " (ORDER BY reactions DESC, hearts DESC, published_at, id) AS standing"
    " FROM entries)"
)

CONTEST_COLUMNS = (
    "id, starts_at, ends_at, winner_drawing_id, winner_user_id, closed_at, theme"
)


@dataclass(frozen=True)
class Contest:
    """A row of `contests`."""

    id: UUID
    starts_at: datetime
    ends_at: datetime
    winner_drawing_id: UUID | None
    winner_user_id: int | None
    closed_at: datetime | None
    theme: dict[str, Any] | None = None
    """The theme as the table keeps it (ThemeBody); None: no theme."""

    def ranked_values(self, excluded: Sequence[UUID] = ()) -> dict[str, Any]:
        """The placeholders of RANKED_SQL for this contest."""
        return {
            "starts_at": self.starts_at,
            "ends_at": self.ends_at,
            "excluded": list(excluded),
            "entered_in": None if self.theme is None else self.id,
        }

    def titles(self) -> dict[str, str]:
        """The theme's title by language, for the pushes; empty without."""
        return {
            language: text["title"]
            for language, text in (self.theme or {}).items()
            if text is not None
        }


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
        row["theme"],
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
    places keep their numbers. `entrants` is how many accounts take part."""
    apart = "FALSE" if viewer_id is None else apart_sql("%(viewer)s", "ranked.user_id")
    return conn.execute(
        f"{RANKED_SQL} SELECT ranked.*,"
        f" (standing <= %(top)s AND NOT {apart}) AS in_top,"
        " (user_id = %(viewer)s::bigint) AS is_mine,"
        " (id = %(winner)s::uuid) AS is_winner,"
        " (SELECT count(DISTINCT everyone.user_id) FROM ranked everyone)"
        " AS entrants"
        " FROM ranked WHERE standing <= %(top)s OR user_id = %(viewer)s::bigint"
        " OR id = %(winner)s::uuid ORDER BY standing",
        {
            **contest.ranked_values(excluded),
            "top": top,
            "viewer": viewer_id,
            "winner": winner_id,
        },
    ).fetchall()


def entrants_of(rows: Sequence[DictRow]) -> int:
    """How many accounts take part, from rows of _ranked: when anyone takes
    part, the first place is among them."""
    return int(rows[0]["entrants"]) if rows else 0


def leaders(
    conn: Connection[DictRow],
    contest: Contest,
    viewer_id: int | None,
    reads: Reads = EVERYTHING,
) -> tuple[list[DictRow], dict[str, Any]]:
    """The rows of _ranked for `viewer_id`, and the fields `top` and
    `winner` of the contest's bodies (the winner only once closed), with
    the posts `reads` shows."""
    rows = _ranked(
        conn, contest, viewer_id=viewer_id, winner_id=contest.winner_drawing_id
    )
    details = _details(conn, [r["id"] for r in rows])
    fields: dict[str, Any] = {
        "top": [
            ContestEntryBody(
                rank=r["standing"],
                reactions=r["reactions"],
                drawing=_post(r, details),
            )
            for r in rows
            if r["in_top"] and reads.shows(r["activity"], r["tracked"])
        ],
        "winner": None,
    }
    if contest.closed_at is not None:
        won = next((r for r in rows if r["is_winner"]), None)
        shown = won is not None and reads.shows(won["activity"], won["tracked"])
        fields["winner"] = ContestWinnerBody(
            reactions=0 if won is None else won["reactions"],
            drawing=_post(won, details) if won is not None and shown else None,
        )
    return rows, fields


def told_everyone(
    pusher: Pusher | None,
    kind: Kind,
    contest: Contest,
    recipients: Sequence[int],
) -> None:
    """One push of a monthly challenge to each of `recipients`; each is its
    own "actor" (push.OWN_KINDS). Never raises (Pusher.notify)."""
    if pusher is None:
        return
    titles = contest.titles()
    for recipient in recipients:
        pusher.notify(
            PushEvent(
                kind,
                recipient,
                recipient,
                key=str(contest.id),
                contest_id=contest.id,
                names=titles,
            )
        )


# Who may be told of a monthly challenge: the pushes on, a phone, not
# hidden (TASK-291). The column is `u.id`.
PUSHABLE_SQL = (
    "u.notify_push AND u.hidden_at IS NULL"
    " AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = u.id)"
)


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

    def current(
        self, viewer_id: int | None = None, reads: Reads = EVERYTHING
    ) -> ContestBody | None:
        """The contest open, or closed less than SHOWN_AFTER_CLOSE ago, as
        `viewer_id` sees it with the posts `reads` shows; without an
        account, without `mine`. None when there is none."""
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
            rows, fields = leaders(conn, contest, viewer_id, reads)
            entered: list[UUID] = []
            if contest.theme is not None and viewer_id is not None:
                entered = [
                    e["drawing_id"]
                    for e in conn.execute(
                        "SELECT drawing_id FROM contest_entries"
                        " WHERE contest_id = %s AND user_id = %s"
                        " ORDER BY created_at, drawing_id",
                        (contest.id, viewer_id),
                    )
                ]
        fields.update(
            id=contest.id,
            starts_at=contest.starts_at,
            ends_at=contest.ends_at,
            closed_at=contest.closed_at,
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
        if contest.theme is None:
            return ContestBody(**fields)
        fields.update(theme=contest.theme, entrants=entrants_of(rows))
        if viewer_id is not None:
            fields["entered"] = entered
        return ThemedContestBody(**fields)

    def open(
        self, starts_at: datetime, ends_at: datetime, theme: ThemeBody | None = None
    ) -> Contest:
        """A contest opened for the period, with `theme` a monthly
        challenge; ValueError when another is open or `ends_at` is not
        after `starts_at`."""
        if ends_at <= starts_at:
            raise ValueError(NOT_A_PERIOD)
        kept = None if theme is None else Jsonb(theme.model_dump(exclude_none=True))
        try:
            with self.database.connect() as conn:
                row = conn.execute(
                    "INSERT INTO contests (starts_at, ends_at, created_at, theme)"
                    f" VALUES (%s, %s, %s, %s) RETURNING {CONTEST_COLUMNS}",
                    (starts_at, ends_at, self.now(), kept),
                ).fetchone()
        except pg_errors.UniqueViolation:
            raise ValueError(ONE_OPEN) from None
        assert row is not None
        return _contest(row)

    def announce(self, contest: Contest, pusher: Pusher | None) -> int:
        """The push of a new monthly challenge (contest_open) to every
        account that may be told (PUSHABLE_SQL); how many. Nobody for a
        contest without a theme."""
        if contest.theme is None:
            return 0
        with self.database.connect() as conn:
            recipients = [
                int(r["id"])
                for r in conn.execute(
                    f"SELECT u.id FROM users u WHERE {PUSHABLE_SQL} ORDER BY u.id"
                )
            ]
        told_everyone(pusher, "contest_open", contest, recipients)
        return len(recipients)

    def theme_line(self) -> str | None:
        """For `standings`: the theme of the open contest and its entries;
        None without a theme, or without an open contest."""
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT c.theme, count(e.drawing_id) AS entries,"
                " count(DISTINCT e.user_id) AS accounts FROM contests c"
                " LEFT JOIN contest_entries e ON e.contest_id = c.id"
                " WHERE c.closed_at IS NULL GROUP BY c.id"
            ).fetchone()
        if row is None or row["theme"] is None:
            return None
        return (
            f"contests: the theme is «{row['theme']['en']['title']}»;"
            f" {row['entries']} drawing(s) entered by {row['accounts']} account(s)"
        )

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
            # The results of a monthly challenge: to who took part, the
            # posts left out with --exclude too; the winner hears
            # contest_won.
            took_part: list[int] = []
            if contest.theme is not None:
                took_part = [
                    int(r["user_id"])
                    for r in conn.execute(
                        f"{RANKED_SQL} SELECT DISTINCT user_id FROM ranked"
                        " ORDER BY user_id",
                        contest.ranked_values(),
                    )
                    if won is None or int(r["user_id"]) != won.user_id
                ]
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
        told_everyone(pusher, "contest_results", closed, took_part)
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


def theme_of(path: Path) -> ThemeBody:
    """The theme of `open --theme`: a JSON file with the title and the
    description in each of THEME_LANGUAGES. ValueError says what is wrong,
    before anything is opened."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError(f"the theme {path} is not a JSON file: {error}") from None
    try:
        theme = ThemeBody.model_validate(data)
    except ValidationError as error:
        problems = "; ".join(
            f"{'.'.join(str(part) for part in e['loc'])}: {e['msg']}"
            for e in error.errors()
        )
        raise ValueError(f"the theme {path} is not one: {problems}") from None
    missing = [
        language for language in THEME_LANGUAGES if getattr(theme, language) is None
    ]
    if missing:
        raise ValueError(f"the theme {path} has no {', '.join(missing)}")
    return theme


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
    opening.add_argument(
        "--theme",
        type=Path,
        metavar="FILE.json",
        help="a monthly challenge: its title and description in en, de, it,"
        ' es and fr, {"en": {"title": …, "description": …}, …}; only the'
        " drawings entered take part, and whoever has the pushes on is told",
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
        theme = None if args.theme is None else theme_of(args.theme)
        contest = contests.open(args.starts_at, args.ends_at, theme)
        told = contests.announce(contest, pusher)
        print(
            f"contests: opened {contest.id}, from {contest.starts_at.isoformat()}"
            f" to {contest.ends_at.isoformat()}",
            file=out,
        )
        if theme is not None:
            print(
                f"contests: the theme is «{theme.en.title}»; {told} account(s)"
                " told with a push",
                file=out,
            )
        return 0
    if args.command == "standings":
        standings = contests.standings()
        if standings is None:
            print(f"contests: {NO_OPEN}", file=out)
            return 1
        theme_line = contests.theme_line()
        if theme_line is not None:
            print(theme_line, file=out)
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

    # `mine` and `entered` are left out without a token: exclude_unset. A
    # monthly challenge has its theme (TASK-343); a contest without one is
    # answered as before it.
    @router.get(
        "/contests/current",
        responses={404: {"model": ErrorBody}},
        response_model=ThemedContestBody | ContestBody,
        response_model_exclude_unset=True,
    )
    def current_contest(
        contests: Annotated[Contests, Depends(contests_of)],
        viewer: Annotated[UserBody | None, Depends(viewer_of)],
        reads: Shown,
    ) -> ContestBody:
        found = contests.current(None if viewer is None else viewer.id, reads)
        if found is None:
            raise AccountError(404, "no_contest", NO_CONTEST)
        return found

    return router


def install_contests(app: FastAPI) -> None:
    """The contest for anyone with the API's key, `mine` with a token; the
    entries, the gallery and the archive of the monthly challenges
    (contest_entries.py); the clock of their last days (contest_clock.py),
    which runs only while the app does. After install_accounts, which sets
    the database and the errors, install_push, whose pusher the clock reads,
    and install_drawings, whose bodies it reads."""
    # Here, not at the top: they read this module.
    from shaperoute_api.contest_clock import install_contest_clock
    from shaperoute_api.contest_entries import entry_routes

    app.include_router(contest_routes())
    app.include_router(entry_routes())
    install_contest_clock(app)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
