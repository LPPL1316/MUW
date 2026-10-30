"""The badges of a profile (TASK-341, ADR-0294, docs/API.md, «Profile»):
the first drawing, ten drawings, a drawing of 30 km or more, as a subquery
of GET /users/{public_id} (profiles.py) and GET /me (accounts.py).

The server decides, the app shows. No table: a badge comes and goes with
the drawings. They count the drawings the one who asks sees on the profile
(drawings.shown_sql, the rule of the number of drawings), so a badge never
tells of a drawing it could not see; never one hidden by the moderation,
not even to its owner; and only runs recorded by the app, as the contest
(ADR-0272): an imported file makes no badge. «Winner» stays contest_wins
(accounts.contest_wins_sql).
"""

from __future__ import annotations

from typing import Literal

from shaperoute_api.drawings import shown_sql

Badge = Literal["first_drawing", "ten_drawings", "long_drawing"]

# The drawings for «10 drawings», and the metres of the run for «30 km
# drawing»: runs.distance_m, counted by the API when the run was saved.
TEN_DRAWINGS = 10
LONG_DRAWING_M = 30_000


def badges_sql(user_column: str, viewer: str) -> str:
    """The badges of the account in `user_column` for `viewer`, as a
    subquery: a text array in a fixed order, empty without one. `viewer` is
    a placeholder or a column, read once."""
    return (
        "(SELECT array_remove(ARRAY["
        "CASE WHEN count(*) >= 1 THEN 'first_drawing' END,"
        f" CASE WHEN count(*) >= {TEN_DRAWINGS} THEN 'ten_drawings' END,"
        f" CASE WHEN max(r.distance_m) >= {LONG_DRAWING_M}"
        " THEN 'long_drawing' END]::text[], NULL)"
        " FROM drawings d JOIN runs r ON r.id = d.run_id"
        f" WHERE r.user_id = {user_column} AND r.source = 'muw'"
        f" AND d.hidden_at IS NULL AND {shown_sql(viewer)})"
    )
