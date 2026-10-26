"""The email of each report and the link that hides (TASK-291, ADR-0251).

Without a database: the signed links, the setup from the environment, the
email's words and the call to Resend. In a real PostgreSQL: a new report
sends one email and the same one again none; the link asks on GET, acts
once on POST and undoes; a hidden drawing, comment or member is gone for
the others and still there for its author."""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    OTHER_KEY,
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    drawn,
    other,
    public_id,
    saved,
    signed_up,
    third,
    wall,  # noqa: F401
)
from test_moderation import comment, comment_texts, feed_titles, found, report

from shaperoute_api.access import OPEN_PATHS
from shaperoute_api.db import Database, migrations
from shaperoute_api.report_email import (
    EXPIRED,
    GONE,
    LINK_DAYS,
    LINK_PATH,
    USED,
    WRONG,
    Links,
    ReportConfigError,
    Reported,
    ReportEmails,
    ReportSetup,
    email_of,
    install_report_email,
)
from shaperoute_api.send_email import SEND_URL, Mailer, send_email
from shaperoute_api.strava_client import Call, Reply

SECRET = "s" * 40
KEY = "re_test_key_never_logged"
TO = "moderator@example.com"
BASE = "https://api.example.com"
NOW = datetime(2026, 10, 17, 9, 0, tzinfo=UTC)
Headers = dict[str, str]

# The migration of hidden content, whatever its number when merged.
(HIDDEN_MIGRATION,) = [
    p for p in migrations() if p.name.endswith("_hidden_content.sql")
]


def env(**changes: str) -> dict[str, str]:
    base = {
        "RESEND_API_KEY": KEY,
        "SHAPEROUTE_EMAIL_SECRET": SECRET,
        "SHAPEROUTE_DOMAIN": "api.example.com",
        "SHAPEROUTE_REPORTS_TO": TO,
    }
    return {**base, **changes}


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


def setup_with(resend: FakeResend) -> ReportSetup:
    setup = ReportSetup.from_env(env())
    assert setup is not None
    mailer = Mailer(KEY, setup.mailer.sender, send=resend)
    return ReportSetup(mailer, setup.to, setup.links)


def token_of(url: str) -> str:
    match = re.search(r"[?&]t=([^&\"']+)", url)
    assert match is not None, url
    return match.group(1)


# --- The links ---


def links() -> Links:
    return Links(SECRET.encode(), BASE)


def test_a_link_reads_back_as_it_was_made() -> None:
    made = links().new("hide", "comment", uuid4(), NOW)
    assert made.expires == NOW + timedelta(days=LINK_DAYS)
    assert links().read(links().token(made)) == made
    assert links().url(made).startswith(f"{BASE}{LINK_PATH}?t=")


@pytest.mark.parametrize(
    "change",
    [
        lambda t: t.replace("hide", "show", 1),
        lambda t: t.replace("drawing", "user", 1),
        lambda t: t[:-1] + ("0" if t[-1] != "0" else "1"),
        lambda t: t + "0",
        lambda t: t.rsplit(".", 1)[0],
        lambda t: "",
        lambda t: "x" * 400,
    ],
)
def test_a_link_changed_in_any_way_is_not_ours(change: Any) -> None:
    made = links().new("hide", "drawing", uuid4(), NOW)
    assert links().read(change(links().token(made))) is None


def test_a_link_of_another_secret_is_not_ours() -> None:
    made = links().new("hide", "drawing", uuid4(), NOW)
    stranger = Links(b"t" * 40, BASE)
    assert stranger.read(links().token(made)) is None


# --- The setup ---


@pytest.mark.parametrize(
    "missing",
    [
        "RESEND_API_KEY",
        "SHAPEROUTE_EMAIL_SECRET",
        "SHAPEROUTE_DOMAIN",
        "SHAPEROUTE_REPORTS_TO",
    ],
)
def test_without_any_of_the_four_the_emails_are_off(missing: str) -> None:
    assert ReportSetup.from_env(env(**{missing: " "})) is None


def test_a_short_secret_or_a_wrong_address_stops_the_api() -> None:
    with pytest.raises(ReportConfigError):
        ReportSetup.from_env(env(SHAPEROUTE_EMAIL_SECRET="short"))
    with pytest.raises(ReportConfigError):
        ReportSetup.from_env(env(SHAPEROUTE_REPORTS_TO="nobody"))


def test_the_setup_keeps_secrets_out_of_its_repr() -> None:
    setup = ReportSetup.from_env(env())
    assert setup is not None
    assert setup.links.base_url == BASE
    shown = repr(setup)
    assert KEY not in shown and TO not in shown and SECRET not in shown


# --- The email ---


def reported_one(**changes: Any) -> Reported:
    base: dict[str, Any] = {
        "kind": "comment",
        "target": uuid4(),
        "reason": "offensive",
        "reporter": "other_runner",
        "author": "<b>runner</b>",
        "author_id": uuid4(),
        "lines": ("Comment: you are <slow>",),
        "reports": 2,
        "hidden": False,
    }
    return Reported(**{**base, **changes})


def test_the_email_says_what_why_who_and_how_to_hide() -> None:
    url = f"{BASE}{LINK_PATH}?t=abc"
    email = email_of(reported_one(), url, NOW)
    assert email.subject == "MuW report: comment, offensive"
    for words in (
        "other_runner reported a comment by <b>runner</b> as offensive.",
        "Comment: you are <slow>",
        "Reports on this comment: 2",
        "Hidden already: no",
        url,
        "2026-10-17 09:00 UTC",
    ):
        assert words in email.text
    # The HTML escapes what members wrote.
    assert "<slow>" not in email.html and "&lt;slow&gt;" in email.html
    assert "<b>runner</b>" not in email.html


def test_a_profile_is_called_a_profile() -> None:
    email = email_of(reported_one(kind="user"), "u", NOW)
    assert email.subject == "MuW report: profile, offensive"


# --- Resend ---


def test_resend_takes_the_email() -> None:
    resend = FakeResend()
    assert send_email(Mailer(KEY, "MuW <a@b.c>", resend), TO, "S", "T", "<p>H</p>")
    (call,) = resend.calls
    assert call.url == SEND_URL and call.method == "POST"
    assert call.headers["Authorization"] == f"Bearer {KEY}"
    body = json.loads(call.body or b"")
    assert body == {
        "from": "MuW <a@b.c>",
        "to": [TO],
        "subject": "S",
        "text": "T",
        "html": "<p>H</p>",
    }


def test_a_refusal_or_no_answer_is_logged_without_key_or_address(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    assert not send_email(Mailer(KEY, "s", FakeResend(422)), TO, "S", "T", "H")

    def down(call: Call) -> Reply:
        raise OSError(f"no network for {TO} with {KEY}")

    assert not send_email(Mailer(KEY, "s", down), TO, "S", "T", "H")
    assert KEY not in caplog.text and TO not in caplog.text
    assert "422" in caplog.text


def test_the_page_of_the_link_needs_no_api_key() -> None:
    assert LINK_PATH in OPEN_PATHS


# --- In the database ---


@pytest.fixture
def resend() -> FakeResend:
    return FakeResend()


@pytest.fixture
def emails(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    resend: FakeResend,
) -> ReportEmails:
    sent = ReportEmails(database, setup_with(resend), now=wall, run=lambda job: job())
    install_report_email(client.app, sent)  # type: ignore[arg-type]
    return sent


def post_of(app: TestClient, headers: Headers, title: str = "Sunday star") -> str:
    saved(app, headers)
    return str(drawn(app, headers, title=title)["id"])


def hide_url(resend: FakeResend) -> str:
    """The link of the last email."""
    text = resend.emails()[-1]["text"]
    match = re.search(rf"https://\S+{LINK_PATH}\?t=\S+", text)
    assert match is not None, text
    return match.group(0)


def press(app: TestClient, url: str, status: int = 200) -> str:
    """The button of the page: the POST of the link; the page it answers."""
    answer = app.post(f"{LINK_PATH}?t={token_of(url)}")
    assert answer.status_code == status, answer.text
    assert answer.headers["cache-control"] == "no-store"
    return answer.text


def undo_url(page: str) -> str:
    match = re.search(r'action="([^"]+)"', page)
    assert match is not None, page
    return match.group(1).replace("&amp;", "&")


def test_the_migration_adds_the_columns_and_the_used_links() -> None:
    sql = HIDDEN_MIGRATION.read_text(encoding="utf-8")
    for table in ("drawings", "comments", "users"):
        assert f"ALTER TABLE {table} ADD COLUMN hidden_at timestamptz;" in sql
    assert "CREATE TABLE report_links_used" in sql


def test_a_new_report_is_emailed_once(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    drawing = post_of(client, me, "Rude star")
    assert report(client, you, "drawing", drawing, "offensive").status_code == 204
    (email,) = resend.emails()
    assert email["to"] == [TO]
    assert email["subject"] == "MuW report: drawing, offensive"
    assert "other_runner reported a drawing by" in email["text"]
    assert "Title: Rude star" in email["text"]
    assert "Reports on this drawing: 1" in email["text"]
    # The same member again, even with another reason: no second email.
    assert report(client, you, "drawing", drawing, "spam").status_code == 204
    assert len(resend.emails()) == 1
    # Another member: a second email, counting both.
    assert report(client, third(client), "drawing", drawing).status_code == 204
    assert len(resend.emails()) == 2
    assert "Reports on this drawing: 2" in resend.emails()[-1]["text"]


def test_without_the_emails_a_report_is_kept_as_before(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    # As the API starts without the four variables.
    install_report_email(client.app, None)  # type: ignore[arg-type]
    me = signed_up(client)
    drawing = post_of(client, me)
    assert report(client, other(client), "drawing", drawing).status_code == 204
    with database.connect() as conn:
        (row,) = conn.execute("SELECT count(*) AS n FROM reports").fetchall()
    assert row["n"] == 1
    # And a link has nothing to answer with.
    answer = client.get(f"{LINK_PATH}?t=hide.drawing.x.1.y.z")
    assert answer.status_code == 404 and WRONG in answer.text


def test_a_failing_resend_never_fails_the_report(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    resend.status = 500
    me = signed_up(client)
    drawing = post_of(client, me)
    assert report(client, other(client), "drawing", drawing).status_code == 204


def test_a_hidden_drawing_is_gone_for_the_others_only(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    drawing = post_of(client, me, "Rude star")
    assert comment(client, you, drawing, "Nice one") == 201
    report(client, you, "drawing", drawing)
    url = hide_url(resend)
    # Opening the link only asks.
    asked = client.get(f"{LINK_PATH}?t={token_of(url)}")
    assert asked.status_code == 200 and "Hide it?" in asked.text
    assert feed_titles(client, you) == ["Rude star"]
    page = press(client, url)
    assert "Hidden" in page
    # Gone for the others: feed, the drawing, its comments, its reactions,
    # its owner's profile.
    assert feed_titles(client, you) == []
    assert client.get(f"/drawings/{drawing}", headers=you).status_code == 404
    assert client.get(f"/drawings/{drawing}/comments", headers=you).status_code == 404
    profile = client.get(f"/users/{public_id(client, me)}", headers=you).json()
    assert profile["drawings"] == 0
    # Its owner still sees it, with its comment.
    assert client.get(f"/drawings/{drawing}", headers=me).status_code == 200
    assert comment_texts(client, me, drawing) == (["Nice one"], 1)
    # The link works once.
    assert USED in press(client, url, 410)
    # Undo shows it again, and its own link works once too.
    back = undo_url(page)
    assert "Shown again" in press(client, back)
    assert feed_titles(client, you) == ["Rude star"]
    assert USED in press(client, back, 410)


def test_a_hidden_comment_is_read_by_its_author_only(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    drawing = post_of(client, me)
    added = client.post(
        f"/drawings/{drawing}/comments", json={"text": "Slow run"}, headers=you
    )
    assert added.status_code in (200, 201), added.text
    assert comment(client, me, drawing, "Thanks") == 201
    report(client, me, "comment", added.json()["id"], "harassment")
    press(client, hide_url(resend))
    assert comment_texts(client, me, drawing) == (["Thanks"], 1)
    assert comment_texts(client, third(client), drawing) == (["Thanks"], 1)
    assert comment_texts(client, you, drawing) == (["Slow run", "Thanks"], 2)


def test_a_hidden_member_is_gone_for_everyone_but_itself(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    mine = post_of(client, me, "My star")
    assert comment(client, you, mine, "Hello there") == 201
    yours = client.get("/me", headers=you).json()["public_id"]
    saved(client, you, key=OTHER_KEY)
    drawn(client, you, key=OTHER_KEY, title="Your star")
    report(client, me, "user", yours, "harassment")
    press(client, hide_url(resend))
    # The others: no profile, no name in a search, no drawing, no comment.
    assert client.get(f"/users/{yours}", headers=me).status_code == 404
    assert found(client, me, "other") == []
    assert feed_titles(client, me) == ["My star"]
    assert comment_texts(client, me, mine) == ([], 0)
    # Itself: everything as before.
    assert client.get(f"/users/{public_id(client, me)}", headers=you).status_code == 200
    assert sorted(feed_titles(client, you)) == ["My star", "Your star"]
    assert comment_texts(client, you, mine) == (["Hello there"], 1)


def test_an_old_link_does_nothing(
    client: TestClient,  # noqa: F811
    emails: ReportEmails,
    resend: FakeResend,
    wall: WallClock,  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    drawing = post_of(client, me, "Rude star")
    report(client, you, "drawing", drawing)
    wall.t += timedelta(days=LINK_DAYS, seconds=1)
    assert EXPIRED in press(client, hide_url(resend), 404)
    assert feed_titles(client, you) == ["Rude star"]


def test_a_changed_link_does_nothing(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    drawing = post_of(client, me, "Rude star")
    report(client, you, "drawing", drawing)
    token = token_of(hide_url(resend))
    # Another drawing's id in the same link.
    changed = token.replace(UUID(drawing).hex, uuid4().hex)
    assert WRONG in press(client, f"?t={changed}", 404)
    assert feed_titles(client, you) == ["Rude star"]


def test_a_link_of_something_deleted_says_so(
    client: TestClient, emails: ReportEmails, resend: FakeResend  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    added = client.post(
        f"/drawings/{post_of(client, me)}/comments", json={"text": "Bye"}, headers=you
    )
    comment_id = added.json()["id"]
    report(client, me, "comment", comment_id)
    url = hide_url(resend)
    assert client.delete(f"/comments/{comment_id}", headers=you).status_code == 204
    assert GONE in press(client, url, 404)
