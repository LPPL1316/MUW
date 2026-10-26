"""«Send feedback» (TASK-308, ADR-0268).

Without a database: the text as kept, the body of the shared fixture, the
setup from the environment and the email's words. In a real PostgreSQL: a
message is kept and emailed once, with the member's address as Reply-To;
five in a day, then 429 until the oldest is a day old; nothing sent
without an email setup or when Resend fails, and the message kept either
way; deleting the account deletes its messages."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_drawings import (
    FIXTURES,
    OTHER_EMAIL,
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    code,
    database,  # noqa: F401
    message,
    other,
    public_id,
    signed_up,
    wall,  # noqa: F401
)

from shaperoute_api.accounts import AccountError, UserBody
from shaperoute_api.db import Database, migrations
from shaperoute_api.feedback import (
    FEEDBACK_EMPTY,
    FEEDBACK_NOT_TEXT,
    FEEDBACK_TOO_LONG,
    MAX_FEEDBACK_LENGTH,
    MAX_PER_DAY,
    TOO_MUCH_FEEDBACK,
    FeedbackConfigError,
    FeedbackEmails,
    FeedbackRequestBody,
    FeedbackSetup,
    Kept,
    checked_text,
    email_of,
    install_feedback_email,
)
from shaperoute_api.resend_email import Resend
from shaperoute_api.strava_client import Call, Reply

KEY = "re_test_key_never_logged"
TO = "team@example.com"
MEMBER = "runner@example.com"
Headers = dict[str, str]

# The migration of the feedback, whatever its number when merged.
(FEEDBACK_MIGRATION,) = [p for p in migrations() if p.name.endswith("_feedback.sql")]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeResend:
    """Resend as the tests see it: the calls kept, an answer chosen."""

    def __init__(self, status: int = 200) -> None:
        self.calls: list[Call] = []
        self.status = status

    def __call__(self, call: Call) -> Reply:
        self.calls.append(call)
        return Reply(self.status, {}, b'{"id": "e-1"}')

    def emails(self) -> list[dict[str, Any]]:
        return [json.loads(call.body or b"{}") for call in self.calls]


# --- Without a database ---


def test_the_text_is_kept_without_spaces_at_either_end() -> None:
    assert checked_text("  Love it!\nMore hearts  ") == "Love it!\nMore hearts"
    assert checked_text("a\tb") == "a\tb"
    assert checked_text("x" * MAX_FEEDBACK_LENGTH) == "x" * MAX_FEEDBACK_LENGTH


@pytest.mark.parametrize(
    ("text", "why"),
    [
        ("   \n ", FEEDBACK_EMPTY),
        ("x" * (MAX_FEEDBACK_LENGTH + 1), FEEDBACK_TOO_LONG),
        ("bell\x07", FEEDBACK_NOT_TEXT),
    ],
)
def test_a_text_that_is_not_one_is_refused(text: str, why: str) -> None:
    with pytest.raises(AccountError) as refused:
        checked_text(text)
    assert (refused.value.status, str(refused.value)) == (422, why)


def test_the_shared_fixture_is_a_request() -> None:
    body = FeedbackRequestBody.model_validate(_load("feedback-request.json"))
    assert (body.app_version, body.platform) == ("1.0.0 (7)", "ios")
    # The app's version and system may be missing.
    assert FeedbackRequestBody(text="Hi").platform is None


@pytest.mark.parametrize(
    "changes",
    [
        {"platform": "windows"},
        {"app_version": "1.0<script>"},
        {"app_version": "1" * 41},
        {"user": "someone else"},
    ],
)
def test_a_body_out_of_the_contract_is_refused(changes: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        FeedbackRequestBody.model_validate({"text": "Hi", **changes})


def test_without_the_key_or_an_address_nothing_is_emailed() -> None:
    assert FeedbackSetup.from_env({}) is None
    assert FeedbackSetup.from_env({"RESEND_API_KEY": KEY}) is None
    assert FeedbackSetup.from_env({"SHAPEROUTE_FEEDBACK_TO": TO}) is None


def test_its_own_address_first_then_the_reports_one() -> None:
    both = {
        "RESEND_API_KEY": KEY,
        "SHAPEROUTE_FEEDBACK_TO": TO,
        "SHAPEROUTE_REPORTS_TO": "moderator@example.com",
    }
    setup = FeedbackSetup.from_env(both)
    assert setup is not None and setup.to == TO
    reports_only = {**both, "SHAPEROUTE_FEEDBACK_TO": " "}
    setup = FeedbackSetup.from_env(reports_only)
    assert setup is not None and setup.to == "moderator@example.com"
    assert setup.mailer.sender == "MuW <hello@getmuw.app>"
    # Neither the key nor the address in a repr.
    assert KEY not in repr(setup) and "moderator@" not in repr(setup)


def test_an_address_that_is_not_one_stops_the_api() -> None:
    with pytest.raises(FeedbackConfigError, match="SHAPEROUTE_FEEDBACK_TO"):
        FeedbackSetup.from_env({"RESEND_API_KEY": KEY, "SHAPEROUTE_FEEDBACK_TO": "x"})


def member() -> UserBody:
    return UserBody.model_validate(
        {
            "id": 7,
            "email": MEMBER,
            "username": "Runner_42",
            "role": "user",
            "created_at": datetime(2026, 10, 1, tzinfo=UTC),
            "bio": "",
            "public_id": uuid4(),
            "phone": None,
            "email_confirmed": True,
            "pending_email": None,
            "notifications": {"email": False, "push": False, "away": True},
        }
    )


def test_the_email_says_who_wrote_what_from_which_app() -> None:
    who = member()
    body = FeedbackRequestBody(text="x", app_version="1.0.0 (7)", platform="android")
    kept = Kept(
        uuid4(),
        "Love it!\n<b>More</b> hearts",
        datetime(2026, 10, 26, 9, 5, tzinfo=UTC),
    )
    email = email_of(TO, who, body, kept)
    assert (email.to, email.reply_to) == (TO, MEMBER)
    assert email.subject == "MuW feedback from Runner_42"
    assert email.idempotency_key == f"feedback-{kept.id}"
    assert email.text.startswith("Love it!\n<b>More</b> hearts\n")
    for line in (
        f"From: Runner_42 <{MEMBER}>",
        "App: 1.0.0 (7) on Android",
        "Sent: 2026-10-26 09:05 UTC",
        f"Member id: {who.public_id}",
    ):
        assert line in email.text
    # The member's words are text in the HTML, never markup.
    assert "Love it!<br>&lt;b&gt;More&lt;/b&gt; hearts" in email.html
    assert "<b>" not in email.html


def test_an_app_that_does_not_say_its_version_is_a_question_mark() -> None:
    kept = Kept(uuid4(), "Hi", datetime(2026, 10, 26, tzinfo=UTC))
    email = email_of(TO, member(), FeedbackRequestBody(text="Hi"), kept)
    assert "App: ? on ?" in email.text


# --- In a real PostgreSQL ---


@pytest.fixture
def resend() -> FakeResend:
    return FakeResend()


@pytest.fixture
def emails(client: TestClient, resend: FakeResend) -> FeedbackEmails:  # noqa: F811
    setup = FeedbackSetup(Resend(KEY, "MuW <hello@getmuw.app>", send=resend), TO)
    sent = FeedbackEmails(setup, run=lambda job: job())
    install_feedback_email(client.app, sent)  # type: ignore[arg-type]
    return sent


def send(app: TestClient, headers: Headers, text: str = "More hearts, please") -> Any:
    body = {**_load("feedback-request.json"), "text": text}
    return app.post("/feedback", json=body, headers=headers)


def kept_rows(database: Database) -> list[dict[str, Any]]:  # noqa: F811
    with database.connect() as conn:
        return [
            dict(row)
            for row in conn.execute(
                "SELECT user_id, text, app_version, platform, created_at"
                " FROM feedback ORDER BY created_at"
            ).fetchall()
        ]


def test_a_message_is_kept_and_emailed_once(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    emails: FeedbackEmails,
    resend: FakeResend,
) -> None:
    me = signed_up(client)
    answer = send(client, me, "  Love the hearts!  ")
    assert answer.status_code == 204, answer.text
    (row,) = kept_rows(database)
    assert (row["text"], row["app_version"], row["platform"]) == (
        "Love the hearts!",
        "1.0.0 (7)",
        "ios",
    )
    (email,) = resend.emails()
    assert email["to"] == [TO] and email["reply_to"] == [MEMBER]
    assert email["subject"] == "MuW feedback from Runner_42"
    assert email["text"].startswith("Love the hearts!\n")
    assert f"Member id: {public_id(client, me)}" in email["text"]


def test_five_a_day_then_wait_until_the_oldest_is_a_day_old(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    emails: FeedbackEmails,
    resend: FakeResend,
) -> None:
    me = signed_up(client)
    for n in range(MAX_PER_DAY):
        assert send(client, me, f"Idea {n}").status_code == 204
        wall.t += timedelta(hours=1)
    refused = send(client, me, "One more")
    assert refused.status_code == 429
    assert code(refused) == "too_many_requests"
    assert message(refused) == TOO_MUCH_FEEDBACK
    # The first was 5 hours ago: 19 hours to wait.
    assert refused.headers["retry-after"] == str(19 * 3600)
    assert len(resend.emails()) == MAX_PER_DAY
    # Another member is not counted with this one.
    assert send(client, other(client), "Mine").status_code == 204
    wall.t += timedelta(hours=19)
    assert send(client, me, "One more").status_code == 204


@pytest.mark.parametrize("text", ["   ", "x" * (MAX_FEEDBACK_LENGTH + 1)])
def test_a_text_refused_is_neither_kept_nor_emailed(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    emails: FeedbackEmails,
    resend: FakeResend,
    text: str,
) -> None:
    answer = send(client, signed_up(client), text)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert kept_rows(database) == [] and resend.emails() == []


def test_only_a_member_sends_feedback(
    client: TestClient, emails: FeedbackEmails, resend: FakeResend  # noqa: F811
) -> None:
    assert send(client, {}).status_code == 401
    assert send(client, {"Authorization": "Bearer nobody"}).status_code == 401
    assert resend.emails() == []


def test_without_an_email_setup_the_message_is_kept(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    assert send(client, signed_up(client)).status_code == 204
    assert len(kept_rows(database)) == 1


def test_a_failing_resend_never_fails_the_message(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    emails: FeedbackEmails,
    resend: FakeResend,
    caplog: pytest.LogCaptureFixture,
) -> None:
    resend.status = 500
    caplog.set_level(logging.INFO)
    assert send(client, signed_up(client), "A secret idea").status_code == 204
    assert len(kept_rows(database)) == 1 and len(resend.emails()) == 1
    # Neither the key, the address nor the words in the log.
    assert KEY not in caplog.text and MEMBER not in caplog.text
    assert "A secret idea" not in caplog.text


def test_deleting_the_account_deletes_its_messages(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    assert send(client, me).status_code == 204
    assert send(client, other(client)).status_code == 204
    assert client.delete("/me", headers=me).status_code == 204
    (left,) = kept_rows(database)
    with database.connect() as conn:
        found = conn.execute(
            "SELECT id FROM users WHERE email = %s", (OTHER_EMAIL,)
        ).fetchone()
    assert found is not None and left["user_id"] == found["id"]


def test_the_migration_holds_only_the_two_systems() -> None:
    sql = FEEDBACK_MIGRATION.read_text(encoding="utf-8")
    assert "ON DELETE CASCADE" in sql
    assert "CHECK (platform IN ('ios', 'android'))" in sql
