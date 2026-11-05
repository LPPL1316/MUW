"""A workout at the gym (TASK-385, ADR-0327, docs/API.md, «Gym»): a run of
the activity `gym` saved without a track, and its sets.

PUT /me/gym-sessions/{key} saves what the phone recorded: when the workout
began and ended, its pauses, its rests summed and its sets, each of a kind
of gym_catalog.py with the fields of that kind only. The API counts the
seconds itself, the time between start and end without the pauses; the
rests are inside it. Sent twice, it is saved once, as a run is (201, then
200). The run is in «My activities» for an app that reads what has no track
(reads.py) and is published as any other (drawings.py), without a line.

GET /me/gym-sessions/{key} gives the workout back to its owner, and PUT
/me/gym-sessions/{key}/show-exercises says whether its post shows the
exercises. GET /drawings/{id}/exercises gives them to whoever sees the
drawing (drawings.drawing_seen_sql), from an app that reads a workout at the
gym, when its owner shows them; otherwise 404, as for a drawing that is not
there. Deleting the run, or the account, deletes its sets.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Response
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import (
    ACTIVITIES_FULL,
    BAD_CLOCK,
    CLOCK_AHEAD,
    EARLIEST_RUN,
    MAX_ACTIVITIES,
    MAX_PAUSES,
    Key,
)
from shaperoute_api.db import Database
from shaperoute_api.drawings import drawing_seen_sql
from shaperoute_api.gym_catalog import EXERCISES_BY_KEY, CardioField, SetKind
from shaperoute_api.reads import EVERYTHING, Reads, Shown
from shaperoute_api.schemas import ErrorBody

GYM = "gym"
# A long day at the gym, with every set of it.
MAX_WORKOUT = timedelta(hours=24)
MAX_SETS = 500
MAX_RESTS = 1_000
MAX_NAME_LENGTH = 40
EXERCISE_PATTERN = r"^[a-z0-9_]{1,40}$"

UNKNOWN_WORKOUT = "No workout at the gym with this key."
NO_EXERCISES = "No exercises to show for this drawing."
NOT_A_WORKOUT = "This key is of a run, not of a workout at the gym."

# What a set of each kind has, besides its time and whether it was live:
# the fields it needs, and those it may have.
NEEDED: dict[SetKind, frozenset[str]] = {
    "load": frozenset({"reps", "load_kg"}),
    "bodyweight": frozenset({"reps"}),
    "timed": frozenset({"duration_s"}),
    "cardio": frozenset({"duration_s"}),
}
CARDIO_FIELDS: frozenset[CardioField] = frozenset(
    {"duration_s", "distance_m", "speed_kmh", "incline_pct", "level", "floors"}
)
ALLOWED: dict[SetKind, frozenset[str]] = {
    "load": frozenset({"reps", "load_kg"}),
    # The weight added to the body, if any.
    "bodyweight": frozenset({"reps", "load_kg"}),
    "timed": frozenset({"duration_s"}),
    "cardio": frozenset(CARDIO_FIELDS),
}
VALUE_FIELDS = (
    "reps",
    "load_kg",
    "duration_s",
    "distance_m",
    "speed_kmh",
    "incline_pct",
    "level",
    "floors",
)


class GymSetBody(BaseModel):
    """One set, or one block on a cardio machine:
    packages/shared-types/fixtures/gym-session.json, `sets`."""

    model_config = ConfigDict(extra="forbid")

    exercise: str | None = Field(default=None, pattern=EXERCISE_PATTERN)
    """Its key in the catalog (gym_catalog.py); null for one the runner
    named."""
    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    """What the runner called an exercise the catalog lacks; null for one of
    the catalog."""
    kind: SetKind
    reps: int | None = Field(default=None, ge=1, le=10_000)
    load_kg: float | None = Field(default=None, ge=0, le=2_000, allow_inf_nan=False)
    """Per hand for a dumbbell; for a set of the body, the weight added."""
    duration_s: int | None = Field(default=None, ge=1, le=86_400)
    distance_m: int | None = Field(default=None, ge=0, le=1_000_000)
    speed_kmh: float | None = Field(default=None, ge=0, le=60, allow_inf_nan=False)
    incline_pct: float | None = Field(default=None, ge=-10, le=40, allow_inf_nan=False)
    level: int | None = Field(default=None, ge=1, le=100)
    floors: int | None = Field(default=None, ge=0, le=10_000)
    at_s: int = Field(ge=0, le=86_400)
    """When it was logged, in seconds since the workout began."""
    live: bool
    """Logged during the workout; false for one added after it ended. Only
    the live ones will count for the monthly leaderboard (ADR-0327)."""

    @model_validator(mode="after")
    def the_fields_of_its_kind(self) -> GymSetBody:
        if (self.exercise is None) == (self.name is None):
            raise ValueError("a set is of an exercise of the catalog, or a named one")
        given = {field for field in VALUE_FIELDS if getattr(self, field) is not None}
        allowed = ALLOWED[self.kind]
        if self.exercise is not None:
            exercise = EXERCISES_BY_KEY.get(self.exercise)
            if exercise is None:
                raise ValueError(f"no exercise {self.exercise} in the catalog")
            if exercise.kind != self.kind:
                raise ValueError(f"{self.exercise} is of the kind {exercise.kind}")
            if self.kind == "cardio":
                allowed = frozenset({"duration_s", *exercise.fields})
        missing = NEEDED[self.kind] - given
        if missing:
            raise ValueError(f"a {self.kind} set needs {', '.join(sorted(missing))}")
        extra = given - allowed
        if extra:
            raise ValueError(f"a {self.kind} set has no {', '.join(sorted(extra))}")
        return self


class GymPauseBody(BaseModel):
    """A pause («Pause»), in seconds since the workout began: out of its
    time. A rest between two sets is no pause."""

    model_config = ConfigDict(extra="forbid")

    from_s: float = Field(ge=0, allow_inf_nan=False)
    to_s: float = Field(ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def in_order(self) -> GymPauseBody:
        if self.to_s < self.from_s:
            raise ValueError("a pause ends after it begins")
        return self


class GymSessionRequestBody(BaseModel):
    """PUT /me/gym-sessions/{key}: the workout as the phone recorded it:
    packages/shared-types/fixtures/gym-session.json."""

    model_config = ConfigDict(extra="forbid")

    started_at: AwareDatetime
    ended_at: AwareDatetime
    pauses: list[GymPauseBody] = Field(default_factory=list, max_length=MAX_PAUSES)
    rests: int = Field(default=0, ge=0, le=MAX_RESTS)
    """How many rests the timer counted; each one stays on the phone."""
    rest_s: int = Field(default=0, ge=0, le=86_400)
    """Their seconds summed."""
    show_exercises: bool = True
    """Whether its post shows the exercises («Show exercises»)."""
    sets: list[GymSetBody] = Field(default_factory=list, max_length=MAX_SETS)

    @model_validator(mode="after")
    def within_the_workout(self) -> GymSessionRequestBody:
        length = self.ended_at - self.started_at
        if not timedelta(0) < length <= MAX_WORKOUT:
            raise ValueError("a workout ends after it begins, within a day")
        length_s = length.total_seconds()
        if any(pause.to_s > length_s for pause in self.pauses):
            raise ValueError("a pause is inside the workout")
        if any(item.at_s > length_s for item in self.sets):
            raise ValueError("a set is logged inside the workout")
        return self

    def duration_s(self) -> int:
        """The seconds of the workout without its pauses, overlapping or
        not: the rests are in it."""
        length_s = (self.ended_at - self.started_at).total_seconds()
        spans = sorted((pause.from_s, pause.to_s) for pause in self.pauses)
        paused, reached = 0.0, 0.0
        for start, end in spans:
            start = max(start, reached)
            if end > start:
                paused += end - start
            reached = max(reached, end)
        return max(0, round(length_s - paused))


class GymSessionBody(BaseModel):
    """A workout at the gym as saved: packages/shared-types src/gym.ts."""

    id: str
    """The key the app gave it."""
    started_at: datetime
    duration_s: int
    rests: int
    rest_s: int
    show_exercises: bool
    sets: list[GymSetBody]


class GymExercisesBody(BaseModel):
    """GET /drawings/{id}/exercises: what the post of a workout shows."""

    rests: int
    rest_s: int
    sets: list[GymSetBody]


class ShowExercisesRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    show: bool


# --- The workouts in the database ---

SET_COLUMNS = (
    "exercise, name, kind, reps, load_kg::float8 AS load_kg, duration_s,"
    " distance_m, speed_kmh::float8 AS speed_kmh,"
    " incline_pct::float8 AS incline_pct, level, floors, at_s, live"
)


def _set(row: DictRow) -> GymSetBody:
    return GymSetBody.model_validate(
        {field: value for field, value in row.items() if value is not None}
    )


def _sets(conn: Any, run_id: int) -> list[GymSetBody]:
    rows = conn.execute(
        f"SELECT {SET_COLUMNS} FROM gym_sets WHERE run_id = %s ORDER BY n",
        (run_id,),
    ).fetchall()
    return [_set(row) for row in rows]


def _set_values(run_id: int, n: int, item: GymSetBody) -> tuple[Any, ...]:
    return (
        run_id,
        n,
        item.exercise,
        item.name,
        item.kind,
        *(getattr(item, field) for field in VALUE_FIELDS),
        item.at_s,
        item.live,
    )


def _kept_pauses(pauses: Sequence[GymPauseBody]) -> list[dict[str, Any]]:
    """As the `pauses` column keeps a run's (activities._pause): asked for,
    not taken by the app on its own."""
    return [
        {"from_s": round(p.from_s, 3), "to_s": round(p.to_s, 3), "auto": False}
        for p in pauses
    ]


WORKOUT_SQL = (
    "SELECT r.id, r.key, r.started_at, r.duration_s, g.rests, g.rest_s,"
    " g.show_exercises FROM runs r JOIN gym_sessions g ON g.run_id = r.id"
    " WHERE r.user_id = %s AND r.key = %s"
)


@dataclass
class GymSessions:
    """The workouts at the gym, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def _body(self, conn: Any, row: DictRow) -> GymSessionBody:
        return GymSessionBody(
            id=row["key"],
            started_at=row["started_at"],
            duration_s=row["duration_s"],
            rests=row["rests"],
            rest_s=row["rest_s"],
            show_exercises=row["show_exercises"],
            sets=_sets(conn, row["id"]),
        )

    def get(self, user_id: int, key: str) -> GymSessionBody | None:
        with self.database.connect() as conn:
            row = conn.execute(WORKOUT_SQL, (user_id, key)).fetchone()
            return None if row is None else self._body(conn, row)

    def save(
        self, user_id: int, key: str, body: GymSessionRequestBody
    ) -> tuple[GymSessionBody, bool]:
        """The workout, and whether it is new: one already saved stays as it
        was. 409 for a run of the key that is no workout at the gym."""
        now = self.now()
        if not EARLIEST_RUN <= body.started_at <= now + CLOCK_AHEAD:
            raise AccountError(422, "invalid_request", BAD_CLOCK)
        with self.database.connect() as conn:
            # One account's runs change one at a time, as activities.py
            # saves them: the count below is the count when the row goes in.
            conn.execute("SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,))
            saved = conn.execute(WORKOUT_SQL, (user_id, key)).fetchone()
            if saved is not None:
                return self._body(conn, saved), False
            other = conn.execute(
                "SELECT 1 FROM runs WHERE user_id = %s AND key = %s", (user_id, key)
            ).fetchone()
            if other is not None:
                raise AccountError(409, "http_error", NOT_A_WORKOUT)
            count = conn.execute(
                "SELECT count(*) AS n FROM runs WHERE user_id = %s", (user_id,)
            ).fetchone()
            assert count is not None
            if count["n"] >= MAX_ACTIVITIES:
                raise AccountError(422, "invalid_request", ACTIVITIES_FULL)
            run = conn.execute(
                "INSERT INTO runs (user_id, key, track, pauses, started_at,"
                " distance_m, duration_s, created_at, activity)"
                " VALUES (%s, %s, NULL, %s, %s, 0, %s, %s, %s) RETURNING id",
                (
                    user_id,
                    key,
                    Jsonb(_kept_pauses(body.pauses)),
                    body.started_at,
                    body.duration_s(),
                    now,
                    GYM,
                ),
            ).fetchone()
            assert run is not None
            conn.execute(
                "INSERT INTO gym_sessions (run_id, show_exercises, rests, rest_s)"
                " VALUES (%s, %s, %s, %s)",
                (run["id"], body.show_exercises, body.rests, body.rest_s),
            )
            if body.sets:
                with conn.cursor() as cursor:
                    cursor.executemany(
                        "INSERT INTO gym_sets (run_id, n, exercise, name, kind,"
                        f" {', '.join(VALUE_FIELDS)}, at_s, live) VALUES"
                        f" ({', '.join(['%s'] * (7 + len(VALUE_FIELDS)))})",
                        [
                            _set_values(run["id"], n, item)
                            for n, item in enumerate(body.sets, start=1)
                        ],
                    )
            row = conn.execute(WORKOUT_SQL, (user_id, key)).fetchone()
            assert row is not None
            return self._body(conn, row), True

    def show_exercises(self, user_id: int, key: str, show: bool) -> bool:
        """False: the account has no such workout."""
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE gym_sessions g SET show_exercises = %s FROM runs r"
                " WHERE r.id = g.run_id AND r.user_id = %s AND r.key = %s"
                " RETURNING g.run_id",
                (show, user_id, key),
            ).fetchone()
        return row is not None

    def of_drawing(
        self, viewer_id: int, drawing_id: str, reads: Reads = EVERYTHING
    ) -> GymExercisesBody | None:
        """The exercises of a drawing `viewer_id` sees, of an activity
        `reads` shows, when its owner shows them; None otherwise."""
        try:
            wanted = UUID(drawing_id)
        except ValueError:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT r.id, g.rests, g.rest_s FROM drawings d"
                " JOIN runs r ON r.id = d.run_id"
                " JOIN gym_sessions g ON g.run_id = r.id"
                f" WHERE d.id = %s AND {drawing_seen_sql('%s')}"
                f" AND {reads.sql('r.activity', 'r.track IS NOT NULL')}"
                " AND (g.show_exercises OR r.user_id = %s)",
                (wanted, viewer_id, viewer_id),
            ).fetchone()
            if row is None:
                return None
            return GymExercisesBody(
                rests=row["rests"], rest_s=row["rest_s"], sets=_sets(conn, row["id"])
            )


# --- The endpoints ---


def gym_sessions_of(
    accounts: Annotated[Accounts, Depends(accounts_of)],
) -> GymSessions:
    """In the database of the accounts, on the same clock."""
    return GymSessions(accounts.database, accounts.now)


Gym = Annotated[GymSessions, Depends(gym_sessions_of)]
Me = Annotated[UserBody, Depends(current_user)]


def gym_session_routes() -> APIRouter:
    router = APIRouter(tags=["gym"], responses=ACCOUNT_ERRORS)

    # A set has the fields of its kind only: the others are left out, not
    # null (packages/shared-types src/gym.ts).
    @router.get(
        "/me/gym-sessions/{key}",
        responses={404: {"model": ErrorBody}},
        response_model_exclude_none=True,
    )
    def get_gym_session(key: Key, gym: Gym, user: Me) -> GymSessionBody:
        workout = gym.get(user.id, key)
        if workout is None:
            raise HTTPException(404, UNKNOWN_WORKOUT)
        return workout

    # Sending a workout twice saves it once: 201 the first time, then 200.
    @router.put(
        "/me/gym-sessions/{key}",
        responses={201: {"model": GymSessionBody}},
        response_model_exclude_none=True,
    )
    def save_gym_session(
        key: Key,
        body: GymSessionRequestBody,
        response: Response,
        gym: Gym,
        user: Me,
    ) -> GymSessionBody:
        workout, created = gym.save(user.id, key, body)
        if created:
            response.status_code = 201
        return workout

    @router.put(
        "/me/gym-sessions/{key}/show-exercises",
        status_code=204,
        responses={404: {"model": ErrorBody}},
    )
    def show_exercises(
        key: Key, body: ShowExercisesRequestBody, gym: Gym, user: Me
    ) -> Response:
        if not gym.show_exercises(user.id, key, body.show):
            raise HTTPException(404, UNKNOWN_WORKOUT)
        return Response(status_code=204)

    @router.get(
        "/drawings/{drawing_id}/exercises",
        responses={404: {"model": ErrorBody}},
        response_model_exclude_none=True,
    )
    def drawing_exercises(
        drawing_id: str, gym: Gym, user: Me, reads: Shown
    ) -> GymExercisesBody:
        exercises = gym.of_drawing(user.id, drawing_id, reads)
        if exercises is None:
            raise HTTPException(404, NO_EXERCISES)
        return exercises

    return router


def install_gym_sessions(app: FastAPI) -> None:
    """Without a database the endpoints answer 503, as the others of the
    accounts."""
    app.include_router(gym_session_routes())
