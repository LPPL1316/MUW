"""The profile of an account (TASK-116, ADR-0128, docs/API.md, «Profile»).

PATCH /me changes the username and the bio of who sends it: the same rule
for the username as when signing up, unique whatever the case; a bio of at
most MAX_BIO_LENGTH characters. A value refused is told in words, for the
app to show as it is.

GET /users/{public_id} is the profile as every member sees it: username,
bio, picture (profile_photos.py), number of drawings published
(drawings.py), how many it follows and how many follow it, and where the one
who asks stands towards it (follows.py); since TASK-324 its totals: metres,
climb and reactions received (profile_totals.py). Never the email, the role, the
internal id or when the account was made. It needs the token of an account:
what members share is for members, as the feed (ADR-0114, point 4). The id
is the random `public_id` of the account, not `id`: a sequence would let
anyone walk every profile and count the accounts. Between two members a
block keeps apart (TASK-121, moderation.py) it is 404, as for nobody.
"""

from __future__ import annotations

import base64
import re
import unicodedata
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from psycopg import errors as pg_errors
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    NOT_SIGNED_IN,
    USER_COLUMNS,
    USERNAME_PATTERN,
    USERNAME_TAKEN,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    contest_wins_sql,
    current_user,
)
from shaperoute_api.badges import Badge, badges_sql
from shaperoute_api.db import Database
from shaperoute_api.drawings import published_count_sql
from shaperoute_api.follows import (
    FollowState,
    apart_sql,
    follow_state_sql,
    followers_count_sql,
    following_count_sql,
)
from shaperoute_api.profile_totals import (
    climb_total_sql,
    distance_total_sql,
    reactions_received_sql,
)
from shaperoute_api.schemas import ErrorBody

MAX_BIO_LENGTH = 160

USERNAME_RULE = "A username is 3 to 20 letters, digits, _ or . (no spaces)."
BIO_TOO_LONG = f"A bio is at most {MAX_BIO_LENGTH} characters."
BIO_NOT_TEXT = "A bio is words and new lines: it cannot hold control characters."
NO_PROFILE = "No profile with this id."


class EditProfileRequestBody(BaseModel):
    """PATCH /me: only what changes. A field left out, or null, stays as it
    is; an empty bio takes the bio away."""

    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(
        default=None,
        description="3 to 20 letters, digits, _ or .; unique whatever the case.",
    )
    bio: str | None = Field(
        default=None, description=f"At most {MAX_BIO_LENGTH} characters."
    )


class PublicProfileBody(BaseModel):
    """What every member sees of an account:
    packages/shared-types/fixtures/public-profile.json. Never the email."""

    public_id: UUID
    username: str
    bio: str
    photo: str | None = Field(
        description="The square JPEG of the picture in base64; null without one."
    )
    drawings: int = Field(description="The drawings it published.")
    # Only the requests accepted count (TASK-211, ADR-0173).
    followers: int = Field(description="How many follow it.")
    following: int = Field(description="How many it follows.")
    follow: FollowState = Field(
        description="Where the one who asks stands towards it; none on its own."
    )
    contest_wins: int = Field(
        description="The contests it won (TASK-299): the «Winner» badge."
    )
    # The totals (TASK-324, ADR-0284): of every run, private ones too, the
    # user's choice; only the sums, never a run.
    distance_m: int = Field(description="The metres of all its runs.")
    climb_m: int = Field(description="The metres climbed in all its runs that know it.")
    reactions: int = Field(
        description="The reactions others left on its drawings the one who asks sees."
    )
    # The badges (TASK-341, ADR-0294): decided here, of the drawings the one
    # who asks sees; «Winner» is contest_wins.
    badges: list[Badge] = Field(
        description="The badges it earned, in a fixed order; [] without one."
    )


def checked_username(value: str) -> str:
    """The username as kept, or 422 saying the rule."""
    username = value.strip()
    if re.fullmatch(USERNAME_PATTERN, username) is None:
        raise AccountError(422, "invalid_request", USERNAME_RULE)
    return username


def checked_bio(value: str) -> str:
    """The bio as kept: without spaces at either end, with "\\n" for every
    way of ending a line; or 422 saying what is wrong with it."""
    bio = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(bio) > MAX_BIO_LENGTH:
        raise AccountError(422, "invalid_request", BIO_TOO_LONG)
    if any(unicodedata.category(c) == "Cc" and c != "\n" for c in bio):
        raise AccountError(422, "invalid_request", BIO_NOT_TEXT)
    return bio


@dataclass
class Profiles:
    """The profiles of the accounts in the database."""

    database: Database

    def edit(self, user_id: int, body: EditProfileRequestBody) -> UserBody:
        """The account with what `body` changes; 409 for a username taken."""
        username = None if body.username is None else checked_username(body.username)
        bio = None if body.bio is None else checked_bio(body.bio)
        try:
            with self.database.connect() as conn:
                row = conn.execute(
                    "UPDATE users SET username = COALESCE(%s, username),"
                    " bio = COALESCE(%s, bio)"
                    f" WHERE id = %s RETURNING {USER_COLUMNS}",
                    (username, bio, user_id),
                ).fetchone()
        except pg_errors.UniqueViolation:
            # Only the username can clash: another account has it, in any case.
            raise AccountError(409, "username_taken", USERNAME_TAKEN) from None
        if row is None:
            # The account was deleted between its token and this change.
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)
        return UserBody.model_validate(row)

    def public(self, viewer_id: int, public_id: str) -> PublicProfileBody | None:
        """The profile with this id as `viewer_id` sees it, or None: unknown,
        or not an id at all."""
        try:
            wanted = UUID(public_id)
        except ValueError:
            return None
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT u.public_id, u.username, u.bio, p.jpeg,"
                # Only the runs published, and those the viewer may see
                # (TASK-117, TASK-208, ADR-0114 point 4).
                f" {published_count_sql('u.id', '%s')} AS drawings,"
                f" {followers_count_sql('u.id')} AS followers,"
                f" {following_count_sql('u.id')} AS following,"
                f" {follow_state_sql('%s', 'u.id')} AS follow,"
                f" {contest_wins_sql('u.id')} AS contest_wins,"
                f" {distance_total_sql('u.id')} AS distance_m,"
                f" {climb_total_sql('u.id')} AS climb_m,"
                f" {reactions_received_sql('u.id', '%s')} AS reactions,"
                f" {badges_sql('u.id', '%s')} AS badges"
                " FROM users u LEFT JOIN profile_photos p ON p.user_id = u.id"
                " WHERE u.public_id = %s"
                # Across a block the profile is not there (TASK-121).
                f" AND NOT {apart_sql('%s', 'u.id')}",
                (viewer_id,) * 5 + (wanted, viewer_id),
            ).fetchone()
        if row is None:
            return None
        jpeg = row["jpeg"]
        return PublicProfileBody(
            public_id=row["public_id"],
            username=row["username"],
            bio=row["bio"],
            photo=None if jpeg is None else base64.b64encode(jpeg).decode("ascii"),
            drawings=row["drawings"],
            followers=row["followers"],
            following=row["following"],
            follow=row["follow"],
            contest_wins=row["contest_wins"],
            distance_m=row["distance_m"],
            climb_m=row["climb_m"],
            reactions=row["reactions"],
            badges=row["badges"],
        )


def profiles_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Profiles:
    """In the database of the accounts."""
    return Profiles(accounts.database)


def profile_routes() -> APIRouter:
    router = APIRouter(tags=["profile"], responses=ACCOUNT_ERRORS)

    @router.patch("/me")
    def edit_me(
        body: EditProfileRequestBody,
        profiles: Annotated[Profiles, Depends(profiles_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> UserBody:
        return profiles.edit(user.id, body)

    @router.get("/users/{public_id}", responses={404: {"model": ErrorBody}})
    def profile(
        public_id: str,
        profiles: Annotated[Profiles, Depends(profiles_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> PublicProfileBody:
        found = profiles.public(user.id, public_id)
        if found is None:
            raise HTTPException(404, NO_PROFILE)
        return found

    return router


def install_profiles(app: FastAPI) -> None:
    """The profiles of the accounts; after install_accounts, which sets the
    database and the errors."""
    app.include_router(profile_routes())
