"""Favorites: the routes an account keeps (TASK-171, ADR-0139,
docs/DATABASE.md).

A favorite is a copy of a route, whole: its line, what it draws, how long it
is. The app names it with a key made from the line, so the same route is one
favorite however it was reached, and keeping it twice changes nothing.

Every endpoint needs the token of an account (accounts.py): a favorite is
seen, kept and removed only by its owner. Deleting the account deletes its
favorites (ON DELETE CASCADE).

A favorite remembers the activity it was drawn for (TASK-200): a bike route
reopens as one. Those kept before are runs. A bike route also keeps where it
is walked with the bike on foot (TASK-206). A route whose shape the engine
turned keeps the turn (TASK-232, ADR-0195): its card and the map show it
turned back, so the drawing reads upright.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Response
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from route_engine.models import InvalidRequestError
from route_engine.pen_up import walks_problem

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
    now_utc,
)
from shaperoute_api.activity_graphs import check_supported
from shaperoute_api.best_routes import line_key
from shaperoute_api.db import Database
from shaperoute_api.recommended import preview
from shaperoute_api.route_archive import count_favorite
from shaperoute_api.schemas import (
    ACTIVITY_DESCRIPTION,
    MAX_ON_FOOT,
    MAX_WALKS,
    ErrorBody,
    Stretch,
    Walk,
)

# A phone's list stays light, and one account cannot fill the database.
MAX_FAVORITES = 200
# A 50 km route has a few thousand points: this is far above any of them.
MAX_POINTS = 20_000
MAX_ROUTE_M = 100_000
KEY_PATTERN = r"^[a-z0-9]{8,40}$"

FAVORITES_FULL = f"You have {MAX_FAVORITES} favorites: remove one to keep another."
UNKNOWN_FAVORITE = "No favorite with this key."

LatLon = tuple[float, float]
Key = Annotated[str, Path(pattern=KEY_PATTERN)]


class FavoriteRequestBody(BaseModel):
    """PUT /me/favorites/{key}: the route to keep, as the app shows it."""

    model_config = ConfigDict(extra="forbid")

    city: str = Field(default="", max_length=80)
    shape: str | None = Field(default=None, max_length=40)
    word: str | None = Field(default=None, max_length=40)
    style: Literal["round", "block"] | None = None
    title: str | None = Field(default=None, max_length=60)
    distance_m: int = Field(gt=0, le=MAX_ROUTE_M)
    route_m: int = Field(gt=0, le=MAX_ROUTE_M)
    similarity: float = Field(ge=0, le=1)
    points: list[LatLon] = Field(min_length=2, max_length=MAX_POINTS)
    walks: list[Walk] = Field(default_factory=list, max_length=MAX_WALKS)
    """RouteResult.walks, for a word with the pen up (TASK-199); missing
    from an older app."""
    on_foot: list[Stretch] = Field(default_factory=list, max_length=MAX_ON_FOOT)
    """RouteResult.on_foot, for a bike route walked in part (TASK-206);
    missing from an older app."""
    activity: str = Field(default="running", description=ACTIVITY_DESCRIPTION)
    """RouteRequest.activity of the route (TASK-200); the app sends it only
    when it is not running, so an older API never sees it for a run."""
    rotation_deg: float | None = Field(
        default=None, ge=-180, le=180, allow_inf_nan=False
    )
    """RouteResult.rotation_deg (TASK-232, ADR-0195): how far the shape is
    turned; the app shows the route turned back. Sent only when the route is
    turned: an older app, and a route north up, send nothing."""

    @field_validator("activity")
    @classmethod
    def offered(cls, activity: str) -> str:
        # The words of POST /routes for an activity the API does not offer.
        try:
            check_supported(activity)
        except InvalidRequestError as exc:
            raise ValueError(str(exc)) from None
        return activity

    @field_validator("points")
    @classmethod
    def on_earth(cls, points: list[LatLon]) -> list[LatLon]:
        for lat, lon in points:
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError("a point is (lat, lon) in degrees, WGS84")
        return points

    @model_validator(mode="after")
    def walks_within_points(self) -> FavoriteRequestBody:
        # As POST /track-scores checks them (schemas.py).
        problem = walks_problem(self.walks, len(self.points)) or walks_problem(
            self.on_foot, len(self.points), "stretch on foot"
        )
        if problem is not None:
            raise ValueError(problem)
        return self


class FavoriteBody(BaseModel):
    """One favorite of the list, with a light preview of its line:
    packages/shared-types/fixtures/favorites.json."""

    id: str
    """The key the app gave it."""
    city: str
    shape: str | None
    word: str | None
    style: str | None
    title: str | None
    distance_m: int
    route_m: int
    similarity: float
    start: LatLon
    preview: list[LatLon]
    created_at: datetime
    activity: str
    """What the route was drawn for (TASK-200): `running` for those kept
    before."""
    rotation_deg: float | None = None
    """How far its shape is turned (TASK-232, ADR-0195): the card and the
    map show it turned back. Null for a route north up and for every
    favorite kept before. Always answered; the default is for the examples
    written before."""


class FavoritesBody(BaseModel):
    favorites: list[FavoriteBody]


class FavoriteDetailBody(BaseModel):
    """GET /me/favorites/{key}: the route whole, to show on the map."""

    id: str
    city: str
    shape: str | None
    word: str | None
    style: str | None
    title: str | None
    distance_m: int
    route_m: int
    similarity: float
    points: list[LatLon]
    created_at: datetime
    walks: list[Walk]
    """For a word with the pen up (TASK-199): [from, to] indices into
    `points`; empty for any other route, and for the favorites kept
    before."""
    on_foot: list[Stretch]
    """For a bike route (TASK-206): [from, to] indices into `points` of the
    stretches walked with the bike on foot; empty for any other route, and
    for the favorites kept before."""
    activity: str
    """What the route was drawn for (TASK-200): `running` for those kept
    before."""
    rotation_deg: float | None = None
    """As in the list: how far its shape is turned, or null."""


COLUMNS = (
    "key, city, shape, word, style, title, distance_m, route_m, similarity,"
    " created_at, walks, activity, on_foot, rotation_deg,"
    " ST_AsGeoJSON(line, 15) AS line"
)


def _wkt(points: list[LatLon]) -> str:
    """The line as PostGIS reads it: (lon lat), every digit kept."""
    return "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in points) + ")"


def _points(row: DictRow) -> list[LatLon]:
    coordinates: list[list[float]] = json.loads(row["line"])["coordinates"]
    return [(lat, lon) for lon, lat in coordinates]


def _fields(row: DictRow) -> dict[str, Any]:
    rotation = row["rotation_deg"]
    return {
        "id": row["key"],
        "city": row["city"],
        "shape": row["shape"],
        "word": row["word"],
        "style": row["style"],
        "title": row["title"],
        "distance_m": row["distance_m"],
        "route_m": row["route_m"],
        # A `real` column: without rounding 0.83 comes back as 0.8299999833.
        "similarity": round(row["similarity"], 4),
        "created_at": row["created_at"],
        "activity": row["activity"],
        # A `real` column too, as the app sent it: whole degrees mostly.
        "rotation_deg": None if rotation is None else round(rotation, 2),
    }


def _listed(row: DictRow) -> FavoriteBody:
    points = _points(row)
    return FavoriteBody(**_fields(row), start=points[0], preview=preview(points))


@dataclass
class Favorites:
    """The favorites in the database."""

    database: Database
    now: Callable[[], datetime] = now_utc

    def listing(self, user_id: int) -> FavoritesBody:
        """The newest first."""
        with self.database.connect() as conn:
            rows = conn.execute(
                f"SELECT {COLUMNS} FROM favorites WHERE user_id = %s"
                " ORDER BY created_at DESC, id DESC",
                (user_id,),
            ).fetchall()
        return FavoritesBody(favorites=[_listed(row) for row in rows])

    def get(self, user_id: int, key: str) -> FavoriteDetailBody | None:
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {COLUMNS} FROM favorites WHERE user_id = %s AND key = %s",
                (user_id, key),
            ).fetchone()
        if row is None:
            return None
        return FavoriteDetailBody(
            **_fields(row),
            points=_points(row),
            walks=[(start, end) for start, end in row["walks"]],
            on_foot=[(start, end) for start, end in row["on_foot"]],
        )

    def keep(
        self, user_id: int, key: str, body: FavoriteRequestBody
    ) -> tuple[FavoriteBody, bool]:
        """The favorite, and whether it is new: one already kept stays as it
        was."""
        with self.database.connect() as conn:
            # One account's favorites change one at a time: the count below
            # is the count when the row goes in.
            conn.execute(
                "SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user_id,)
            ).fetchone()
            kept = conn.execute(
                f"SELECT {COLUMNS} FROM favorites WHERE user_id = %s AND key = %s",
                (user_id, key),
            ).fetchone()
            if kept is not None:
                return _listed(kept), False
            count = conn.execute(
                "SELECT count(*) AS n FROM favorites WHERE user_id = %s", (user_id,)
            ).fetchone()
            assert count is not None
            if count["n"] >= MAX_FAVORITES:
                raise AccountError(422, "invalid_request", FAVORITES_FULL)
            row = conn.execute(
                "INSERT INTO favorites (user_id, key, city, shape, word, style,"
                " title, distance_m, route_m, similarity, line, created_at, walks,"
                " activity, on_foot, rotation_deg) VALUES (%s, %s, %s, %s, %s, %s,"
                " %s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s)"
                f" RETURNING {COLUMNS}",
                (
                    user_id,
                    key,
                    body.city,
                    body.shape,
                    body.word,
                    body.style,
                    body.title,
                    body.distance_m,
                    body.route_m,
                    body.similarity,
                    _wkt(body.points),
                    self.now(),
                    Jsonb([list(walk) for walk in body.walks]),
                    body.activity,
                    Jsonb([list(stretch) for stretch in body.on_foot]),
                    body.rotation_deg,
                ),
            ).fetchone()
            assert row is not None
            # One more favorite of this line, for whoever asks it next
            # (ADR-0256): the line's name only, never whose.
            count_favorite(conn, line_key(body.points), 1)
            return _listed(row), True

    def remove(self, user_id: int, key: str) -> None:
        """Gone, or never there: the same."""
        with self.database.connect() as conn:
            gone = conn.execute(
                "DELETE FROM favorites WHERE user_id = %s AND key = %s"
                " RETURNING ST_AsGeoJSON(line, 15) AS line",
                (user_id, key),
            ).fetchone()
            if gone is not None:
                count_favorite(conn, line_key(_points(gone)), -1)


def favorites_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Favorites:
    """In the database of the accounts, on the same clock."""
    return Favorites(accounts.database, accounts.now)


def favorite_routes() -> APIRouter:
    router = APIRouter(tags=["favorites"], responses=ACCOUNT_ERRORS)

    @router.get("/me/favorites")
    def list_favorites(
        favorites: Annotated[Favorites, Depends(favorites_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> FavoritesBody:
        return favorites.listing(user.id)

    @router.get("/me/favorites/{key}", responses={404: {"model": ErrorBody}})
    def get_favorite(
        key: Key,
        favorites: Annotated[Favorites, Depends(favorites_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> FavoriteDetailBody:
        favorite = favorites.get(user.id, key)
        if favorite is None:
            raise HTTPException(404, UNKNOWN_FAVORITE)
        return favorite

    # Keeping a route twice is keeping it once: 201 the first time, then 200.
    @router.put("/me/favorites/{key}", responses={201: {"model": FavoriteBody}})
    def keep_favorite(
        key: Key,
        body: FavoriteRequestBody,
        response: Response,
        favorites: Annotated[Favorites, Depends(favorites_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> FavoriteBody:
        favorite, created = favorites.keep(user.id, key, body)
        if created:
            response.status_code = 201
        return favorite

    @router.delete("/me/favorites/{key}", status_code=204)
    def remove_favorite(
        key: Key,
        favorites: Annotated[Favorites, Depends(favorites_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> Response:
        favorites.remove(user.id, key)
        return Response(status_code=204)

    return router


def install_favorites(app: FastAPI) -> None:
    """The favorites of the accounts; after install_accounts, which sets the
    database and the errors."""
    app.include_router(favorite_routes())
