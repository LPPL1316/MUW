"""The photos of a profile (TASK-305, ADR-0265, docs/API.md, «Profile»).

GET /users/{public_id}/photos: the photos of the drawings of an account
that the one who asks sees on its profile (drawings.shown_sql), the latest
run first and, within a drawing, in their places, a page at a time. Only
where to read each one (drawings.photo_url) and the drawing it belongs to,
which the app opens with a tap: never the bytes, which GET
/drawings/{id}/photos/{n} gives to whoever sees the drawing. As the
drawings of a profile, 404 for no such profile, or one a block keeps apart
(TASK-121).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import EPOCH, MICROSECOND
from shaperoute_api.db import Database
from shaperoute_api.drawings import NO_PROFILE, photo_url, shown_sql
from shaperoute_api.follows import apart_sql
from shaperoute_api.schemas import ErrorBody

# Three a row in the app: a page fills ten rows.
PAGE_SIZE = 30
MAX_PAGE_SIZE = 60
# Where a page ended: the start of its run in microseconds, the drawing,
# the place of the photo.
CURSOR_PATTERN = r"^\d{1,17}-[0-9a-f]{32}-[1-9]$"


class UserPhotoBody(BaseModel):
    """A photo of a drawing of the profile, as GET /drawings/{id}/photos/{n}
    reads it: packages/shared-types/fixtures/user-photos.json."""

    drawing_id: UUID
    """The drawing it belongs to: GET /drawings/{id} opens it."""
    n: int
    url: str
    width: int
    height: int
    title: str | None
    """The drawing's; null: none, the app names it by its day."""
    started_at: datetime
    """When the drawing's run began."""


class UserPhotosBody(BaseModel):
    """A page of a profile's photos, the latest run first."""

    photos: list[UserPhotoBody]
    next: str | None
    """The `cursor` of the next page; null on the last one."""


def _cursor(row: Any) -> str:
    started_at: datetime = row["started_at"]
    micros = (started_at - EPOCH) // MICROSECOND
    return f"{micros}-{row['drawing_id'].hex}-{row['n']}"


@dataclass
class UserPhotos:
    """The photos of the profiles in the database."""

    database: Database

    def of_profile(
        self,
        viewer_id: int,
        public_id: str,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> UserPhotosBody | None:
        """A page of the photos `viewer_id` sees on the profile; None: no
        such profile, or one a block keeps apart from `viewer_id`."""
        try:
            wanted = UUID(public_id)
        except ValueError:
            return None
        with self.database.connect() as conn:
            user = conn.execute(
                "SELECT u.id FROM users u WHERE u.public_id = %s"
                f" AND NOT {apart_sql('%s', 'u.id')}",
                (wanted, viewer_id),
            ).fetchone()
            if user is None:
                return None
            where = f"r.user_id = %s AND {shown_sql('%s')}"
            values: list[Any] = [user["id"], viewer_id]
            if cursor is not None:
                micros, drawing_hex, n = cursor.split("-")
                started_at = EPOCH + int(micros) * MICROSECOND
                drawing_id = UUID(drawing_hex)
                # The runs in the order of the drawings, the places upwards.
                where += (
                    " AND ((r.started_at, d.id) < (%s, %s)"
                    " OR ((r.started_at, d.id) = (%s, %s) AND p.n > %s))"
                )
                values += [started_at, drawing_id, started_at, drawing_id, int(n)]
            rows = conn.execute(
                "SELECT p.drawing_id, p.n, p.width, p.height, p.updated_at,"
                " d.title, r.started_at FROM drawing_photos p"
                " JOIN drawings d ON d.id = p.drawing_id"
                f" JOIN runs r ON r.id = d.run_id WHERE {where}"
                " ORDER BY r.started_at DESC, d.id DESC, p.n LIMIT %s",
                (*values, limit + 1),
            ).fetchall()
        page, more = rows[:limit], len(rows) > limit
        return UserPhotosBody(
            photos=[
                UserPhotoBody(
                    drawing_id=row["drawing_id"],
                    n=row["n"],
                    url=photo_url(row["drawing_id"], row["n"], row["updated_at"]),
                    width=row["width"],
                    height=row["height"],
                    title=row["title"],
                    started_at=row["started_at"],
                )
                for row in page
            ],
            next=_cursor(page[-1]) if more else None,
        )


def user_photos_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> UserPhotos:
    """In the database of the accounts."""
    return UserPhotos(accounts.database)


def user_photo_routes() -> APIRouter:
    router = APIRouter(tags=["profile"], responses=ACCOUNT_ERRORS)

    @router.get("/users/{public_id}/photos", responses={404: {"model": ErrorBody}})
    def profile_photos(
        public_id: str,
        photos: Annotated[UserPhotos, Depends(user_photos_of)],
        user: Annotated[UserBody, Depends(current_user)],
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> UserPhotosBody:
        found = photos.of_profile(user.id, public_id, limit, cursor)
        if found is None:
            raise HTTPException(404, NO_PROFILE)
        return found

    return router


def install_user_photos(app: FastAPI) -> None:
    """The photos of the profiles; after install_accounts, which sets the
    database and the errors."""
    app.include_router(user_photo_routes())
