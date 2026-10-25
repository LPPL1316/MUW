"""The members found from the phone's contacts (TASK-262 C, ADR-0226,
docs/API.md, «People from the contacts»).

POST /people/from-contacts takes the SHA-256 of the phone numbers of the
contacts, each written in E.164 by the app, and answers the members who
saved one of those numbers (TASK-183, users.phone, E.164 as well), with
where the one who asks stands towards each of them.

**Nothing received is kept.** The hashes are compared in one query and
forgotten: no table holds them, no log line, no error message. This is the
real protection, not the hash: a phone number has at most 15 digits, so a
SHA-256 of one can be reversed by trying every number. Whoever reads the
hashes on their way could learn the numbers; the server never writes them.

The limits slow down whoever would try every number of a country to learn
who has an account: MAX_HASHES a request, MAX_CALLS_PER_HOUR requests an
hour for each account. They do not make it impossible: the answer is only
a username, already public in the search by name (GET /users?q=).

Never the one who asks, nor anybody between whom and it there is a block,
in either direction (TASK-121). A number is not unique (TASK-183: nobody
proved it is its owner's): every account that saved it is found.
"""

from __future__ import annotations

import math
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from shaperoute_api.access import RateLimiter
from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    UserBody,
    current_user,
)
from shaperoute_api.db import Database
from shaperoute_api.follows import (
    PERSON_COLUMNS,
    Follows,
    FollowState,
    PersonBody,
    apart_sql,
    follow_state_sql,
    follows_of,
    small_photo,
)

# packages/shared-types: CONTACT_HASHES_MAX.
MAX_HASHES = 500
# Ten looks of the app at most (CONTACT_BATCHES_MAX), three times an hour.
MAX_CALLS_PER_HOUR = 30
HOUR_S = 3600.0
# SHA-256 in lower-case hex, as the app and PostgreSQL write it.
HASH_PATTERN = r"^[0-9a-f]{64}$"

TOO_MANY_LOOKS = "Too many looks in the contacts. Try again later."

Hash = Annotated[str, StringConstraints(pattern=HASH_PATTERN)]


class ContactsPeopleRequestBody(BaseModel):
    """POST /people/from-contacts:
    packages/shared-types/fixtures/contacts-people-request.json."""

    model_config = ConfigDict(extra="forbid")

    hashes: list[Hash] = Field(
        min_length=1,
        max_length=MAX_HASHES,
        description=(
            "The SHA-256 of phone numbers in E.164, in lower-case hex. Compared"
            " and forgotten: never kept, never logged."
        ),
    )


class ContactPersonBody(PersonBody):
    """A member found from the contacts, and where the one who asks stands."""

    follow: FollowState


class ContactsPeopleBody(BaseModel):
    """The members who saved one of the numbers, by name:
    packages/shared-types/fixtures/contacts-people.json."""

    people: list[ContactPersonBody]


def find(database: Database, user_id: int, hashes: list[str]) -> ContactsPeopleBody:
    """The members whose number has one of `hashes`, without the one who
    asks and those apart from it. The hashes are only a parameter of the
    query: nothing writes them."""
    with database.connect() as conn:
        rows = conn.execute(
            f"SELECT {PERSON_COLUMNS}, {follow_state_sql('%s', 'u.id')} AS follow"
            " FROM users u"
            " LEFT JOIN profile_photos p ON p.user_id = u.id"
            " WHERE u.phone IS NOT NULL AND u.id <> %s"
            " AND encode(sha256(convert_to(u.phone, 'UTF8')), 'hex') = ANY(%s)"
            f" AND NOT {apart_sql('%s', 'u.id')}"
            # Usernames are unique in lower case: always the same order.
            " ORDER BY lower(u.username)",
            (user_id, user_id, sorted(set(hashes)), user_id),
        ).fetchall()
    return ContactsPeopleBody(
        people=[
            ContactPersonBody(
                public_id=row["public_id"],
                username=row["username"],
                photo=None if row["jpeg"] is None else small_photo(row["jpeg"]),
                follow=row["follow"],
            )
            for row in rows
        ]
    )


def contact_people_routes() -> APIRouter:
    router = APIRouter(tags=["follow"], responses=ACCOUNT_ERRORS)
    # Per account: one person, one limit, whatever phone it uses.
    looks = RateLimiter(MAX_CALLS_PER_HOUR, window_s=HOUR_S)

    @router.post("/people/from-contacts")
    def from_contacts(
        body: ContactsPeopleRequestBody,
        follows: Annotated[Follows, Depends(follows_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> ContactsPeopleBody:
        wait = looks.wait_s(str(user.id))
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_LOOKS, math.ceil(wait)
            )
        return find(follows.database, user.id, body.hashes)

    return router


def install_contact_people(app: FastAPI) -> None:
    """The search from the phone's contacts; after install_accounts, which
    sets the database and the errors."""
    app.include_router(contact_people_routes())
