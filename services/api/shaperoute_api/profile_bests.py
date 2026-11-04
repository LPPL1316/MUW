"""The personal bests on a profile (TASK-368, ADR-0312, docs/API.md,
«Profile»), as a subquery of GET /users/{public_id} (profiles.py): the best
of each distance among the runs the account saved (personal_bests.py),
private ones too, the user's choice (2026-11-02).

Everyone who sees the profile sees the time and the day of each best; the
drawing of the run it was made in only who may see that drawing
(drawings.shown_sql), the run itself only its owner (the user's choice 7).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from shaperoute_api.drawings import shown_sql
from shaperoute_api.personal_bests import SPORTS, Sport

# The order of the profile: the sport, then the distance.
_ORDER = [
    (sport, d.name, d.metres)
    for sport, rules in SPORTS.items()
    for d in rules.distances
]
_ORDER_SQL = (
    "(VALUES "
    + ", ".join(
        f"('{sport}', '{name}', {metres}::double precision, {i})"
        for i, (sport, name, metres) in enumerate(_ORDER)
    )
    + ") AS o (sport, distance, distance_m, n)"
)


class PersonalBestBody(BaseModel):
    """packages/shared-types/fixtures/public-profile.json, `personal_bests`."""

    sport: Sport
    distance: str = Field(
        description="5k, 10k, 15k, half, 30k, marathon, 60k on foot;"
        " 10k, 20k, 40k, 50k, 100k, 160k by bike."
    )
    distance_m: float
    seconds: int = Field(description="Moving seconds over the distance.")
    started_at: datetime = Field(description="When the run it was made in began.")
    drawing: UUID | None = Field(
        description="The drawing of that run, for who may see it; null otherwise."
    )
    key: str | None = Field(
        description="The run's key, for its owner only: My activities opens it."
    )


def personal_bests_sql(user_column: str, viewer: str) -> str:
    """The bests of the account in `user_column` as `viewer` sees them, as a
    subquery: a JSON array in the order of the profile, empty without one.
    The best of each distance among the runs of its sport now; between two
    equal times the first made. `viewer` is a placeholder or a column, read
    twice: two values for two `%s`."""
    return (
        "(SELECT COALESCE(json_agg(json_build_object('sport', o.sport,"
        " 'distance', o.distance, 'distance_m', o.distance_m,"
        " 'seconds', best.seconds, 'started_at', best.started_at,"
        " 'drawing', best.drawing, 'key', best.key) ORDER BY o.n), '[]'::json)"
        " FROM (SELECT DISTINCT ON (b.sport, b.distance) b.sport, b.distance,"
        " b.seconds, r.started_at,"
        f" CASE WHEN d.id IS NOT NULL AND {shown_sql(viewer)} THEN d.id END"
        " AS drawing,"
        f" CASE WHEN r.user_id = {viewer} THEN r.key END AS key"
        " FROM run_bests b JOIN runs r ON r.id = b.run_id AND r.activity = b.sport"
        " LEFT JOIN drawings d ON d.run_id = r.id"
        f" WHERE r.user_id = {user_column}"
        " ORDER BY b.sport, b.distance, b.seconds, r.started_at, r.id) best"
        f" JOIN {_ORDER_SQL} ON o.sport = best.sport AND o.distance = best.distance)"
    )
