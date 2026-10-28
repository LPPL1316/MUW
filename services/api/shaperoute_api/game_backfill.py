"""The game of the runs saved before it, or before its rules changed
(TASK-296 part A, ADR-0255, docs/GIOCO.md §7).

    python -m shaperoute_api.game_backfill

Run once on the server after the deploy of part A, and again after any
change of game_rules.RULES_VERSION. For each account with a run whose game
is missing or of older rules, every run of the account is computed again,
in the order they were saved, in one transaction under the account's lock
(as activities.save takes it): the overlaps and the day's cap come out as
if each run had just been saved. The shapes reached are unlocked at the
end of the run that reached them. No push is sent. Run twice, the second
time changes nothing. Only the runs recorded by the app (`source` `muw`):
a run added from another app's file has no game (TASK-312, ADR-0272).
"""

from __future__ import annotations

import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

from shaperoute_api.db import Database
from shaperoute_api.game import kept_run, record
from shaperoute_api.game_rules import RULES_VERSION, evaluate


@dataclass(frozen=True)
class Backfilled:
    accounts: int
    runs: int
    unlocked: int


def backfill(database: Database) -> Backfilled:
    with database.connect() as conn:
        users = [
            int(row["user_id"])
            for row in conn.execute(
                "SELECT DISTINCT r.user_id FROM runs r"
                " LEFT JOIN game_runs g ON g.run_id = r.id"
                " WHERE r.source = 'muw'"
                " AND (g.run_id IS NULL OR g.rules_version < %s)"
                " ORDER BY r.user_id",
                (RULES_VERSION,),
            ).fetchall()
        ]
    runs = unlocked = 0
    for user_id in users:
        done, shapes = _account(database, user_id)
        runs += done
        unlocked += shapes
    return Backfilled(len(users), runs, unlocked)


def _account(database: Database, user_id: int) -> tuple[int, int]:
    """Every run of one account computed again: how many, and the shapes
    unlocked."""
    with database.connect() as conn:
        conn.execute("SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,))
        conn.execute("DELETE FROM game_runs WHERE user_id = %s", (user_id,))
        ids = [
            int(row["id"])
            for row in conn.execute(
                "SELECT id FROM runs WHERE user_id = %s AND source = 'muw'"
                " ORDER BY id",
                (user_id,),
            ).fetchall()
        ]
        unlocked = 0
        for run_id in ids:
            row = conn.execute(
                "SELECT started_at, activity, pauses, ST_AsText(track) AS track"
                " FROM runs WHERE id = %s",
                (run_id,),
            ).fetchone()
            assert row is not None
            fixes, pauses = kept_run(row)
            game = evaluate(fixes, pauses, row["activity"])
            ended_at = row["started_at"] + timedelta(seconds=game.elapsed_s)
            unlocked += len(
                record(conn, user_id, run_id, row["started_at"], game, ended_at)
            )
    return len(ids), unlocked


def main(argv: Sequence[str] | None = None) -> int:
    del argv  # no options
    database = Database.from_env()
    if database is None:
        print("game_backfill: SHAPEROUTE_DATABASE_URL is not set", file=sys.stderr)
        return 2
    done = backfill(database)
    print(
        f"game_backfill: rules {RULES_VERSION}, {done.accounts} account(s),"
        f" {done.runs} run(s), {done.unlocked} shape(s) unlocked"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
