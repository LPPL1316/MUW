"""The email and the phone number of an account, changed by their owner
(TASK-183, ADR-0150, docs/API.md, «Email and phone number»).

PUT /me/email takes the new address and the password of the account: a token
alone, on a phone left unlocked, does not move the account to another
address. A wrong password counts with the wrong passwords of signing in, for
the address the account has now. When this server sends email (TASK-300,
account_email.py) the new address waits in pending_email for its link, and
the old one is told; the account signs in with the old one until then.
Without email it holds at once, as before (ADR-0150), not confirmed.

PUT /me/phone keeps a phone number, or takes it away with null. It is written
with its country code and kept in E.164; nobody proved it belongs to the
account, so it is not unique. Only its owner reads it, in GET /me: never a
profile, a search or a list.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Annotated, Any, Protocol

from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, FastAPI, Request
from psycopg import Connection
from psycopg import errors as pg_errors
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, field_validator

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    EMAIL_PATTERN,
    MAX_EMAIL_LENGTH,
    MAX_PASSWORD_LENGTH,
    NOT_SIGNED_IN,
    TOO_MANY_TRIES,
    USER_COLUMNS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.schemas import ErrorBody

# E.164: "+", the country code, the number; 8 to 15 digits in all.
PHONE_PATTERN = r"^\+[1-9][0-9]{7,14}$"
# What people put between the digits: taken away before the rule is read.
PHONE_SEPARATORS = re.compile(r"[\s\-.()/]")
# Far above any way of writing 15 digits: a longer text is not read at all.
MAX_PHONE_TEXT = 40

WRONG_PASSWORD = "Wrong password."
EMAIL_IN_USE = "Another account has this email."
PHONE_RULE = "Write the number with its country code, like +39 333 123 4567."


class ChangeEmailRequestBody(BaseModel):
    """PUT /me/email: the new address, and the password of the account."""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(max_length=MAX_EMAIL_LENGTH, pattern=EMAIL_PATTERN)
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email", mode="before")
    @classmethod
    def plain_email(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class ChangePhoneRequestBody(BaseModel):
    """PUT /me/phone: the number with its country code; null, or nothing
    written, takes it away."""

    model_config = ConfigDict(extra="forbid")

    phone: str | None = Field(
        max_length=MAX_PHONE_TEXT,
        description="With its country code, like +39 333 123 4567; null: none.",
    )


def checked_phone(value: str | None) -> str | None:
    """The number as kept, in E.164; None for none; or 422 saying the rule.
    Spaces, dashes, dots, slashes and brackets are let go, and "00" in front
    is the "+" it stands for."""
    if value is None or value.strip() == "":
        return None
    phone = PHONE_SEPARATORS.sub("", value)
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if re.fullmatch(PHONE_PATTERN, phone) is None:
        raise AccountError(422, "invalid_request", PHONE_RULE)
    return phone


class ChangeConfirmation(Protocol):
    """The emails of a change of address (account_email.py, TASK-300)."""

    def may_ask(self, user: UserBody) -> None:
        """Nothing, or 429 when the account asked for too many emails."""

    def changing(self, user: UserBody, new_email: str) -> None:
        """The link to the new address and the notice to the old one."""


@dataclass
class Contact:
    """How an account is reached: its email and its phone number."""

    accounts: Accounts

    def change_email(
        self,
        user: UserBody,
        body: ChangeEmailRequestBody,
        confirmation: ChangeConfirmation | None = None,
    ) -> UserBody:
        """The account at its new address, or waiting for it with
        `confirmation`; 403 for a wrong password, 409 for the address of
        another account."""
        accounts = self.accounts
        # The same count as signing in: guessing here is guessing there.
        wait = accounts.failed.wait_s(user.email)
        if wait > 0:
            raise AccountError(
                429, "too_many_requests", TOO_MANY_TRIES, math.ceil(wait)
            )
        with accounts.database.connect() as conn:
            row = conn.execute(
                "SELECT password_hash FROM users WHERE id = %s", (user.id,)
            ).fetchone()
            if row is None:
                # The account was deleted between its token and this change.
                raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)
            try:
                accounts.hasher.verify(row["password_hash"], body.password)
            except (VerificationError, InvalidHashError):
                accounts.failed.failed(user.email)
                raise AccountError(403, "wrong_credentials", WRONG_PASSWORD) from None
            accounts.failed.succeeded(user.email)
            if confirmation is not None:
                return self._wait_for(conn, user, body.email, confirmation)
            try:
                # A new address is not confirmed; the same one stays as it is.
                changed = conn.execute(
                    "UPDATE users SET email = %(email)s, pending_email = NULL,"
                    " email_confirmed = email_confirmed AND email = %(email)s"
                    f" WHERE id = %(id)s RETURNING {USER_COLUMNS}",
                    {"email": body.email, "id": user.id},
                ).fetchone()
            except pg_errors.UniqueViolation:
                # Only the email can clash: another account has it.
                raise AccountError(409, "email_taken", EMAIL_IN_USE) from None
        assert changed is not None
        return UserBody.model_validate(changed)

    def _wait_for(
        self,
        conn: Connection[DictRow],
        user: UserBody,
        email: str,
        confirmation: ChangeConfirmation,
    ) -> UserBody:
        """`email` waiting for its link; the address of now again: nothing
        waits any more."""
        if email == user.email:
            row = conn.execute(
                "UPDATE users SET pending_email = NULL WHERE id = %s"
                f" RETURNING {USER_COLUMNS}",
                (user.id,),
            ).fetchone()
            assert row is not None
            return UserBody.model_validate(row)
        taken = conn.execute(
            "SELECT 1 FROM users WHERE email = %s AND id <> %s", (email, user.id)
        ).fetchone()
        if taken is not None:
            raise AccountError(409, "email_taken", EMAIL_IN_USE)
        confirmation.may_ask(user)
        row = conn.execute(
            "UPDATE users SET pending_email = %s WHERE id = %s"
            f" RETURNING {USER_COLUMNS}",
            (email, user.id),
        ).fetchone()
        assert row is not None
        waiting = UserBody.model_validate(row)
        confirmation.changing(waiting, email)
        return waiting

    def change_phone(self, user_id: int, body: ChangePhoneRequestBody) -> UserBody:
        """The account with the number of `body`, or without one."""
        phone = checked_phone(body.phone)
        with self.accounts.database.connect() as conn:
            row = conn.execute(
                f"UPDATE users SET phone = %s WHERE id = %s RETURNING {USER_COLUMNS}",
                (phone, user_id),
            ).fetchone()
        if row is None:
            raise AccountError(401, "not_signed_in", NOT_SIGNED_IN)
        return UserBody.model_validate(row)


def contact_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> Contact:
    """In the database of the accounts, with their count of wrong passwords."""
    return Contact(accounts)


def contact_routes() -> APIRouter:
    router = APIRouter(tags=["accounts"], responses=ACCOUNT_ERRORS)

    @router.put("/me/email", responses={403: {"model": ErrorBody}})
    def change_email(
        request: Request,
        body: ChangeEmailRequestBody,
        contact: Annotated[Contact, Depends(contact_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> UserBody:
        confirmation: ChangeConfirmation | None = request.app.state.email_change
        return contact.change_email(user, body, confirmation)

    @router.put("/me/phone")
    def change_phone(
        body: ChangePhoneRequestBody,
        contact: Annotated[Contact, Depends(contact_of)],
        user: Annotated[UserBody, Depends(current_user)],
    ) -> UserBody:
        return contact.change_phone(user.id, body)

    return router


def install_contact(app: FastAPI) -> None:
    """The email and the phone number of the accounts; after
    install_accounts, which sets the database and the errors. A change of
    address holds at once until account_email.py sets its emails."""
    app.state.email_change = None
    app.include_router(contact_routes())
