"""The totals of a profile (TASK-324, ADR-0284, docs/API.md, «Profile»):
how far an account went, how much it climbed and how many reactions its
drawings received, as subqueries of GET /users/{public_id} (profiles.py).

Metres and climb are of every run the account saved, private ones too: the
user's choice (2026-10-26). Only the sums leave the database, never a run,
a place or a day. The reactions are those the one who asks would count
under each drawing of the profile it sees (drawings.shown_sql,
reactions.py): left by other accounts, never by the owner, never by a
member a block keeps apart from who asks.
"""

from __future__ import annotations

from shaperoute_api.drawings import shown_sql
from shaperoute_api.follows import apart_sql


def distance_total_sql(user_column: str) -> str:
    """The metres of every run of the account in `user_column`."""
    return (
        "(SELECT COALESCE(sum(t.distance_m), 0) FROM runs t"
        f" WHERE t.user_id = {user_column})"
    )


def climb_total_sql(user_column: str) -> str:
    """The metres climbed in every run of the account in `user_column` that
    knows its climb (migration 0031): the runs saved before count nothing."""
    return (
        "(SELECT COALESCE(sum(t.climb_m), 0) FROM runs t"
        f" WHERE t.user_id = {user_column})"
    )


def reactions_received_sql(user_column: str, viewer: str) -> str:
    """How many reactions the drawings of the account in `user_column` that
    `viewer` sees on its profile received from others. `viewer` is a
    placeholder or a column, read twice: two values for two `%s`."""
    return (
        "(SELECT count(*) FROM reactions x JOIN drawings d ON d.id = x.drawing_id"
        f" JOIN runs r ON r.id = d.run_id WHERE r.user_id = {user_column}"
        f" AND x.user_id <> r.user_id AND {shown_sql(viewer)}"
        f" AND NOT {apart_sql(viewer, 'x.user_id')})"
    )
