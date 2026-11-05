"""The VO₂ max on the profile (TASK-397, ADR-0332, docs/API.md, «VO₂
max»).

Nobody sees it until its owner says yes to «Show your VO₂ max?»: PUT
/me/vo2max {"show": true}. Then everyone who can open the profile sees it
(profiles.py), across a block nobody, as the rest of the profile. What
shows is, in this order:

1. the last value of Apple Health or Health Connect, which the phone sends
   only after the yes (PUT /me/vo2max/reading), if it was measured in the
   last 365 days: the number and its day, never the hour, one row a person;
2. otherwise the estimate from the running bests (vo2max_estimate.py);
3. otherwise nothing.

Turning it off, DELETE /me/vo2max/reading or deleting the account takes the
value of Health away. GET /me/vo2max is what the owner sees in Settings and
on their own profile: the switch, and what the others see or would see.
Never given for ads, lists or searches: only on the profile (point 7).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
    now_utc,
)
from shaperoute_api.db import Database
from shaperoute_api.schemas import ErrorBody
from shaperoute_api.vo2max_estimate import (
    DAYS,
    RecentBest,
    estimate,
    recent_bests_sql,
    rounded,
)

HealthSource = Literal["apple_health", "health_connect"]
Vo2MaxSource = Literal["apple_health", "health_connect", "estimate"]

LOWEST = 10
HIGHEST = 90
TURNED_OFF = "Turn on «Show VO₂ max on my profile» first."
IN_THE_FUTURE = "A VO₂ max cannot be measured after today."


class Vo2MaxBody(BaseModel):
    """packages/shared-types/fixtures/public-profile.json, `vo2max`."""

    value: int = Field(description="Millilitres of oxygen per kg per minute.")
    source: Vo2MaxSource
    measured_on: date = Field(
        description="The day it was measured; for the estimate, of the run."
    )
    from_distance: str | None = Field(
        description="The best the estimate comes from (5k … marathon);"
        " null for a value of Health."
    )


class Vo2MaxSettingsBody(BaseModel):
    """GET and PUT /me/vo2max: fixtures/vo2max-settings.json."""

    show: bool = Field(description="The owner's yes; off until given.")
    vo2max: Vo2MaxBody | None = Field(
        description="What the others see with the yes; null when there is none."
    )


class Vo2MaxSettingsRequestBody(BaseModel):
    """PUT /me/vo2max."""

    model_config = ConfigDict(extra="forbid")

    show: bool


class Vo2MaxReadingRequestBody(BaseModel):
    """PUT /me/vo2max/reading: fixtures/vo2max-reading-request.json."""

    model_config = ConfigDict(extra="forbid")

    value: float = Field(ge=LOWEST, le=HIGHEST)
    measured_on: date
    source: HealthSource


def vo2max_sql(user_column: str, since: str) -> str:
    """What a profile needs of the VO₂ max of the account in `user_column`,
    as a subquery: a JSON object with the yes, the value of Health and the
    running bests of the runs begun from `since` (one placeholder or
    column); for shown()."""
    return (
        "(SELECT json_build_object('show', COALESCE(v.show, false),"
        " 'value', v.value, 'source', v.source, 'measured_on', v.measured_on,"
        f" 'bests', {recent_bests_sql(user_column, since)})"
        " FROM (VALUES (1)) AS one (n)"
        f" LEFT JOIN vo2max v ON v.user_id = {user_column})"
    )


def since_of(now: datetime) -> datetime:
    """From when the runs count for the estimate."""
    return now - timedelta(days=DAYS)


def shown(row: dict[str, Any], today: date) -> Vo2MaxBody | None:
    """What vo2max_sql found, as the profile shows it with the yes: the
    value of Health of the last DAYS days, else the estimate, else None."""
    if row["value"] is not None:
        measured_on = date.fromisoformat(str(row["measured_on"]))
        if measured_on >= today - timedelta(days=DAYS):
            return Vo2MaxBody(
                value=rounded(float(row["value"])),
                source=row["source"],
                measured_on=measured_on,
                from_distance=None,
            )
    found = estimate(
        RecentBest(b["distance"], int(b["seconds"]), date.fromisoformat(b["run_on"]))
        for b in row["bests"]
    )
    if found is None:
        return None
    return Vo2MaxBody(
        value=found.value,
        source="estimate",
        measured_on=found.run_on,
        from_distance=found.distance,
    )


@dataclass
class Vo2Max:
    """The VO₂ max of the accounts in the database."""

    database: Database
    now: Callable[[], datetime] = now_utc

    def settings(self, user_id: int) -> Vo2MaxSettingsBody:
        now = self.now()
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {vo2max_sql('%s', '%s')} AS vo2max",
                (user_id, since_of(now), user_id),
            ).fetchone()
        assert row is not None
        found = row["vo2max"]
        return Vo2MaxSettingsBody(show=found["show"], vo2max=shown(found, now.date()))

    def set_show(self, user_id: int, show: bool) -> Vo2MaxSettingsBody:
        """The yes, or its end: off, the value of Health goes."""
        with self.database.connect() as conn:
            conn.execute(
                "INSERT INTO vo2max (user_id, show) VALUES (%s, %s)"
                " ON CONFLICT (user_id) DO UPDATE SET show = EXCLUDED.show,"
                " value = CASE WHEN EXCLUDED.show THEN vo2max.value END,"
                " source = CASE WHEN EXCLUDED.show THEN vo2max.source END,"
                " measured_on = CASE WHEN EXCLUDED.show THEN vo2max.measured_on END",
                (user_id, show),
            )
        return self.settings(user_id)

    def keep_reading(
        self, user_id: int, body: Vo2MaxReadingRequestBody
    ) -> Vo2MaxSettingsBody:
        """The last value of Health, over the one before; 409 without the
        yes, 422 for a day after today (a day of margin for the time zones)."""
        if body.measured_on > self.now().date() + timedelta(days=1):
            raise AccountError(422, "invalid_request", IN_THE_FUTURE)
        with self.database.connect() as conn:
            row = conn.execute(
                "UPDATE vo2max SET value = %s, source = %s, measured_on = %s"
                " WHERE user_id = %s AND show RETURNING user_id",
                (body.value, body.source, body.measured_on, user_id),
            ).fetchone()
        if row is None:
            raise HTTPException(409, TURNED_OFF)
        return self.settings(user_id)

    def forget_reading(self, user_id: int) -> None:
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE vo2max SET value = NULL, source = NULL, measured_on = NULL"
                " WHERE user_id = %s",
                (user_id,),
            )


def vo2max_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Vo2Max:
    """In the database of the accounts, on their clock."""
    return Vo2Max(accounts.database, accounts.now)


def vo2max_routes() -> APIRouter:
    router = APIRouter(tags=["profile"], responses=ACCOUNT_ERRORS)

    @router.get("/me/vo2max")
    def read_vo2max(
        vo2max: Annotated[Vo2Max, Depends(vo2max_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Vo2MaxSettingsBody:
        return vo2max.settings(user.id)

    @router.put("/me/vo2max")
    def change_vo2max(
        body: Vo2MaxSettingsRequestBody,
        vo2max: Annotated[Vo2Max, Depends(vo2max_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Vo2MaxSettingsBody:
        return vo2max.set_show(user.id, body.show)

    @router.put("/me/vo2max/reading", responses={409: {"model": ErrorBody}})
    def keep_vo2max_reading(
        body: Vo2MaxReadingRequestBody,
        vo2max: Annotated[Vo2Max, Depends(vo2max_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Vo2MaxSettingsBody:
        return vo2max.keep_reading(user.id, body)

    @router.delete("/me/vo2max/reading", status_code=204)
    def forget_vo2max_reading(
        vo2max: Annotated[Vo2Max, Depends(vo2max_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        vo2max.forget_reading(user.id)
        return Response(status_code=204)

    return router


def install_vo2max(app: FastAPI) -> None:
    """GET, PUT /me/vo2max and PUT, DELETE /me/vo2max/reading; after
    install_accounts, which sets the database and the errors."""
    app.include_router(vo2max_routes())
