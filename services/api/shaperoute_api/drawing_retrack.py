"""Draws again, whole, the drawings kept with the 200 m cut (TASK-390,
ADR-0330).

    python -m shaperoute_api.drawing_retrack           # counts, writes nothing
    python -m shaperoute_api.drawing_retrack --apply   # writes

Until ADR-0330 a drawing kept its run's track without the first and the last
200 m (ADR-0114). Since then PUT /me/activities/{key}/drawing keeps it
whole, and this takes every drawing already there to the same line, from
the run as it is kept: the line PUT would give it now. A drawing already
whole is left as it is, so a second run changes nothing. Neither who sees
it nor its `updated_at` change: its photos keep their addresses.

The user runs it on the server, with a yes, only once the new «Privacy» is
on the site (the Coordinatore's order, TASK-390). The address of the
database comes only from SHAPEROUTE_DATABASE_URL.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass

from shaperoute_api.db import Database
from shaperoute_api.drawings import LatLon, _line, _line_wkt, shown_track

# Two points this close, in degrees, are the same one read back.
SAME_DEGREES = 1e-9

DRAWINGS_AND_RUNS = (
    "SELECT d.id, ST_AsGeoJSON(d.track, 15) AS shown,"
    " ST_AsGeoJSON(ST_Force2D(r.track), 15) AS track"
    " FROM drawings d JOIN runs r ON r.id = d.run_id"
    " ORDER BY d.id FOR UPDATE OF d"
)


@dataclass(frozen=True)
class Retracked:
    """How many drawings there are, and how many were (or would be) drawn
    again."""

    drawings: int
    changed: int


def _same(a: Sequence[LatLon], b: Sequence[LatLon]) -> bool:
    return len(a) == len(b) and all(
        abs(p[0] - q[0]) < SAME_DEGREES and abs(p[1] - q[1]) < SAME_DEGREES
        for p, q in zip(a, b, strict=True)
    )


def retrack(database: Database, *, apply: bool) -> Retracked:
    """Every drawing with the line its run gives now; without `apply`, only
    counted, in a transaction that writes nothing."""
    drawings = changed = 0
    with database.connect() as conn:
        for row in conn.execute(DRAWINGS_AND_RUNS).fetchall():
            drawings += 1
            whole = shown_track(_line(row["track"]))
            if _same(whole, _line(row["shown"])):
                continue
            changed += 1
            if apply:
                conn.execute(
                    "UPDATE drawings SET track = ST_GeomFromText(%s, 4326)"
                    " WHERE id = %s",
                    (_line_wkt(whole) if whole else None, row["id"]),
                )
        if not apply:
            conn.rollback()
    return Retracked(drawings=drawings, changed=changed)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.drawing_retrack",
        description="Draw again, whole, the drawings kept without their ends.",
    )
    parser.add_argument(
        "--apply", action="store_true", help="write; without it, only count"
    )
    args = parser.parse_args(argv)
    database = Database.from_env(os.environ)
    if database is None:
        print("SHAPEROUTE_DATABASE_URL is not set", file=sys.stderr)
        return 2
    done = retrack(database, apply=args.apply)
    verb = "drawn again" if args.apply else "to draw again (run with --apply)"
    print(f"{done.drawings} drawings, {done.changed} {verb}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
