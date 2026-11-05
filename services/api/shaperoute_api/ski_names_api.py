"""GET /drawings/{id}/ski-names: the lifts and pistes of a day of skiing
(TASK-375 part D2, ADR-0319).

The names are found once, when the day is saved (activities.py, migration
0048), from the ski tiles of the cache (ski_extract.py). They are on the
post, for whoever can see it (the user's choice, 2026-11-05): who cannot
open the drawing, or an app that does not read skiing (X-MuW-Reads,
TASK-387), finds nothing, as for an id that is not there. A drawing of
another sport, or a day saved without the tiles, has no names: two empty
lists, and the app shows nothing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.drawings import NO_DRAWING, drawing_seen_sql
from shaperoute_api.reads import Shown
from shaperoute_api.schemas import ErrorBody


class SkiUseBody(BaseModel):
    """A lift taken or a piste skied: packages/shared-types/fixtures/ski-names.json."""

    name: str
    type: str = Field(
        description="The lift's aerialway, or the piste's difficulty; empty"
        " when OpenStreetMap has none."
    )
    times: int = Field(ge=1)


class SkiNamesBody(BaseModel):
    """The day's lifts and pistes, each once, in the order of the day."""

    lifts: list[SkiUseBody]
    pistes: list[SkiUseBody]


NO_NAMES = SkiNamesBody(lifts=[], pistes=[])


def ski_names_routes() -> APIRouter:
    router = APIRouter(tags=["drawings"], responses=ACCOUNT_ERRORS)

    @router.get(
        "/drawings/{drawing_id}/ski-names", responses={404: {"model": ErrorBody}}
    )
    def ski_names(
        drawing_id: str,
        accounts: Annotated[Accounts, Depends(accounts_of)],
        user: Annotated[UserBody, Depends(current_user)],
        reads: Shown,
    ) -> SkiNamesBody:
        try:
            wanted = UUID(drawing_id)
        except ValueError:
            raise HTTPException(404, NO_DRAWING) from None
        with accounts.database.connect() as conn:
            row = conn.execute(
                "SELECT r.ski_names FROM drawings d JOIN runs r ON r.id = d.run_id"
                f" WHERE d.id = %s AND {drawing_seen_sql('%s')}"
                f" AND {reads.sql('r.activity', 'r.track IS NOT NULL')}",
                (wanted, user.id),
            ).fetchone()
        if row is None:
            raise HTTPException(404, NO_DRAWING)
        names = row["ski_names"]
        return NO_NAMES if names is None else SkiNamesBody.model_validate(names)

    return router


def install_ski_names(app: FastAPI, cache_dir: Path) -> None:
    """The names of the days of skiing, from the ski tiles of `cache_dir`
    (activities_of reads `app.state.ski_dir`); after install_accounts, which
    sets the database and the errors. Without it, as in most tests, a day
    of skiing is saved without names."""
    app.state.ski_dir = cache_dir
    app.include_router(ski_names_routes())
