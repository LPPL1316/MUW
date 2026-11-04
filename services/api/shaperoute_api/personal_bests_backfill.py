"""The personal bests of the runs saved before them (TASK-368 part A,
ADR-0312, docs/API.md «Profile»).

    python -m shaperoute_api.personal_bests_backfill

Run once on the server after the deploy of part A, with the user's yes. Each
run's bests are counted again from its track and its pauses, as
activities.save counts them, and written over the ones it had: one run at a
time, each in its own short transaction, so the profiles answer meanwhile.
Run twice, the second time changes nothing. Every run counts, private,
imported and of a group run alike (the user's choice 4).
"""

from __future__ import annotations

import sys
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from route_engine.track_score import TrackPoint

from shaperoute_api.db import Database
from shaperoute_api.personal_bests import keep_run_bests, run_bests

# How many runs one question to the database reads.
BATCH = 200


@dataclass(frozen=True)
class KeptPause:
    """A pause as the `pauses` column keeps it: seconds since the first
    point of the track."""

    from_s: float
    to_s: float
    auto: bool


@dataclass(frozen=True)
class Backfilled:
    runs: int
    bests: int


def kept_track(row: dict[str, Any]) -> tuple[list[TrackPoint], list[KeptPause]]:
    """A run of the `runs` table as personal_bests reads it: the track from
    ST_AsText ("LINESTRING M (lon lat m, …)") and the pauses' column."""
    text: str = row["track"]
    inside = text[text.index("(") + 1 : text.rindex(")")]
    track = []
    for point in inside.split(","):
        lon, lat, m = (float(v) for v in point.split())
        track.append(TrackPoint(lat, lon, m))
    pauses = [
        KeptPause(float(p["from_s"]), float(p["to_s"]), bool(p["auto"]))
        for p in row["pauses"]
    ]
    return track, pauses


def backfill(database: Database) -> Backfilled:
    runs = bests = 0
    after = 0
    while True:
        with database.connect() as conn:
            rows = conn.execute(
                "SELECT id, pauses, ST_AsText(track) AS track FROM runs"
                " WHERE id > %s ORDER BY id LIMIT %s",
                (after, BATCH),
            ).fetchall()
        if not rows:
            return Backfilled(runs, bests)
        for row in rows:
            track, pauses = kept_track(row)
            found = run_bests(track, pauses)
            with database.connect() as conn:
                # A run deleted meanwhile has no row left to keep them for.
                if conn.execute(
                    "SELECT 1 FROM runs WHERE id = %s FOR UPDATE", (row["id"],)
                ).fetchone():
                    keep_run_bests(conn, int(row["id"]), found)
                    runs += 1
                    bests += len(found)
        after = int(rows[-1]["id"])


def main(argv: Sequence[str] | None = None) -> int:
    del argv  # no options
    database = Database.from_env()
    if database is None:
        print(
            "personal_bests_backfill: SHAPEROUTE_DATABASE_URL is not set",
            file=sys.stderr,
        )
        return 2
    done = backfill(database)
    print(f"personal_bests_backfill: {done.runs} run(s), {done.bests} best(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
