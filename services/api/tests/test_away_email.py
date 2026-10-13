"""The email to who has not opened the app for two weeks (TASK-284,
ADR-0244): the words in five languages, the links «Don't send me these
emails», the environment, and in a real PostgreSQL who gets one, when,
with what, and the page that turns it off. Resend is a fake network."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from datetime import time as clock_time
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    KEY,
    OTHER_KEY,
    THIRD_EMAIL,
    WallClock,
    api,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    drawn,
    follows,
    other,
    public_id,
    saved,
    signed_up,
    third,
    wall,  # noqa: F401
)

from shaperoute_api.away_email import (
    AWAY_DAYS,
    DEFAULT_AT,
    MAX_REFUSED,
    OPEN_URL,
    SENDER,
    STOP_PATH,
    AwayConfigError,
    AwayEmails,
    AwaySetup,
    StopLinks,
    due,
    install_away_email,
    main,
    next_round,
)
from shaperoute_api.away_texts import WORDS, News, names_of, write
from shaperoute_api.db import Database
from shaperoute_api.resend_email import Resend
from shaperoute_api.strava_client import Call, Reply

SECRET = b"s" * 32
BASE = "https://api.example.app"
EMAIL = "runner@example.com"
OTHER_EMAIL = "other@example.com"
MINUTE = timedelta(minutes=1)
AWAY = timedelta(days=AWAY_DAYS)
ENV = {
    "RESEND_API_KEY": "re_key",
    "SHAPEROUTE_EMAIL_SECRET": "x" * 32,
    "SHAPEROUTE_DOMAIN": "api.example.app",
}


# --- The words ---


def news(**changes: Any) -> News:
    fields: dict[str, Any] = {"followed": 0, "names": [], "people": 0, "feed": 0}
    return News(**{**fields, **changes})


def test_names_are_three_then_a_number() -> None:
    assert names_of(news(names=["ada"], people=1)) == "ada"
    assert names_of(news(names=["ada", "bea", "cleo"], people=3)) == "ada, bea, cleo"
    assert names_of(news(names=["ada", "bea", "cleo"], people=5)) == (
        "ada, bea, cleo +2"
    )


def test_one_drawing_and_more_have_their_own_sentences() -> None:
    one = write(
        "en", "runner", news(followed=1, names=["ada"], people=1, feed=1), OPEN_URL, "S"
    )
    assert one.subject == "ada posted a new drawing on MuW"
    assert "A new drawing from ada." in one.text
    many = write(
        "en",
        "runner",
        news(followed=4, names=["ada", "bea"], people=2, feed=6),
        OPEN_URL,
        "S",
    )
    assert many.subject == "4 new drawings from people you follow"
    assert "4 new drawings from people you follow: ada, bea." in many.text
    feed = write("en", "runner", news(feed=3), OPEN_URL, "S")
    assert feed.subject == "3 new drawings on MuW"
    assert "3 new drawings in the Feed since your last visit." in feed.text
    assert write("en", "r", news(feed=1), OPEN_URL, "S").subject == (
        "A new drawing on MuW"
    )


def test_an_email_with_nothing_new_is_never_written() -> None:
    with pytest.raises(ValueError):
        write("en", "runner", news(), OPEN_URL, "S")


@pytest.mark.parametrize("language", sorted(WORDS))
def test_every_language_says_it_all(language: str) -> None:
    stop = f"{BASE}{STOP_PATH}?t=abc"
    written = write(
        language,  # type: ignore[arg-type]
        "run.ner",
        news(followed=2, names=["ada"], people=1, feed=2),
        OPEN_URL,
        stop,
    )
    words = WORDS[language]  # type: ignore[index]
    for body in (written.text, written.html):
        assert "run.ner" in body and "ada" in body
        assert OPEN_URL in body and stop in body
        assert words.stop in body or words.stop.replace("'", "&#x27;") in body
    assert "2" in written.subject
    # No sentence is left with a hole to fill.
    assert "{" not in written.text + written.html + written.subject


def test_the_html_escapes_what_it_is_given() -> None:
    written = write("en", "<b>", news(feed=2), OPEN_URL, f"{BASE}{STOP_PATH}?t=a&b")
    assert "<b>" not in written.html and "&lt;b&gt;" in written.html
    assert "t=a&amp;b" in written.html


# --- The links ---


def test_a_link_names_its_account_and_no_other() -> None:
    links = StopLinks(SECRET, BASE)
    mine, theirs = uuid4(), uuid4()
    token = links.token(mine)
    assert links.url(mine) == f"{BASE}{STOP_PATH}?t={token}"
    assert links.public_id_of(token) == mine
    head, _, tag = token.partition(".")
    # Another account's id with my tag, another secret, a bent tag: none.
    assert links.public_id_of(f"{theirs.hex}.{tag}") is None
    assert StopLinks(b"o" * 32, BASE).public_id_of(token) is None
    flipped = tag[:-1] + ("0" if tag[-1] != "0" else "1")
    assert links.public_id_of(f"{head}.{flipped}") is None


@pytest.mark.parametrize(
    "token",
    ["", ".", "abc", "x" * 65, f"{'z' * 32}.{'0' * 32}", f"{'0' * 32}.é{'0' * 31}"],
)
def test_a_token_that_is_not_ours_names_nobody(token: str) -> None:
    assert StopLinks(SECRET, BASE).public_id_of(token) is None


def test_the_same_id_written_otherwise_is_not_a_token() -> None:
    links = StopLinks(SECRET, BASE)
    mine = uuid4()
    head, _, tag = links.token(mine).partition(".")
    assert links.public_id_of(f"{head.upper()}.{tag}") is None


# --- The environment ---


def test_the_emails_are_off_without_all_three() -> None:
    assert AwaySetup.from_env({}) is None
    for name in ENV:
        assert AwaySetup.from_env({k: v for k, v in ENV.items() if k != name}) is None


def test_the_environment_sets_resend_the_links_and_the_hour() -> None:
    setup = AwaySetup.from_env(ENV)
    assert setup is not None
    assert setup.resend.key == "re_key" and setup.resend.sender == SENDER
    assert setup.links.base_url == "https://api.example.app"
    assert setup.at == DEFAULT_AT
    changed = AwaySetup.from_env(
        {
            **ENV,
            "SHAPEROUTE_DOMAIN": "https://api.other.app/",
            "SHAPEROUTE_EMAIL_FROM": "Muw <hi@other.app>",
            "AWAY_EMAIL_AT": "07:30",
        }
    )
    assert changed is not None
    assert changed.links.base_url == "https://api.other.app"
    assert changed.resend.sender == "Muw <hi@other.app>"
    assert changed.at == clock_time(7, 30)
    assert "re_key" not in repr(setup)


@pytest.mark.parametrize(
    "changes",
    [
        {"SHAPEROUTE_EMAIL_SECRET": "short"},
        {"AWAY_EMAIL_AT": "5pm"},
        {"AWAY_EMAIL_AT": "25:00"},
    ],
)
def test_a_variable_that_cannot_be_used_stops_the_start(
    changes: dict[str, str],
) -> None:
    with pytest.raises(AwayConfigError):
        AwaySetup.from_env({**ENV, **changes})


def test_the_round_comes_at_its_hour_each_day() -> None:
    at = clock_time(17, 0)
    morning = datetime(2026, 10, 11, 9, 0, tzinfo=UTC)
    assert next_round(morning, at) == datetime(2026, 10, 11, 17, 0, tzinfo=UTC)
    evening = datetime(2026, 10, 11, 17, 0, tzinfo=UTC)
    assert next_round(evening, at) == datetime(2026, 10, 12, 17, 0, tzinfo=UTC)


# --- In the database ---


class Outbox:
    """Resend's network: the emails it took, by address, as JSON."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.calls: list[Call] = []
        self.refuse = False

    def __call__(self, call: Call) -> Reply:
        self.calls.append(call)
        if self.refuse:
            return Reply(422, {}, b'{"name": "validation_error"}')
        assert call.body is not None
        self.sent.append({**json.loads(call.body), "call": call})
        return Reply(200, {}, b'{"id": "e"}')

    def to(self, address: str) -> list[dict[str, Any]]:
        return [email for email in self.sent if email["to"] == [address]]


@pytest.fixture
def outbox() -> Outbox:
    return Outbox()


@pytest.fixture
def away(
    database: Database, wall: WallClock, outbox: Outbox  # noqa: F811
) -> AwayEmails:
    setup = AwaySetup(Resend("re_key", SENDER, send=outbox), StopLinks(SECRET, BASE))
    return AwayEmails(database, setup, now=wall, sleep=lambda _: None)


def published_by(
    app: TestClient, headers: dict[str, str], key: str = KEY, **fields: Any
) -> None:
    saved(app, headers, key)
    drawn(app, headers, key, **fields)


def test_who_has_been_away_14_days_gets_one_email_with_what_is_new(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    me, friend, stranger = signed_up(client), other(client), third(client)
    follows(client, me, friend)
    wall.t = t0 + MINUTE
    published_by(client, friend, KEY)
    published_by(client, friend, OTHER_KEY)
    wall.t = t0 + 2 * MINUTE
    published_by(client, stranger, KEY)

    # Away for 14 days but a second: nothing yet.
    wall.t = t0 + AWAY - timedelta(seconds=1)
    assert away.round().sent == 0
    assert outbox.sent == []

    wall.t = t0 + AWAY + timedelta(seconds=1)
    report = away.round()
    assert (report.away, report.sent) == (1, 1)
    (email,) = outbox.to(EMAIL)
    assert email["subject"] == "2 new drawings from people you follow"
    assert "2 new drawings from people you follow: other_runner." in email["text"]
    assert email["from"] == SENDER
    token = StopLinks(SECRET, BASE).token(UUID(public_id(client, me)))
    stop = f"{BASE}{STOP_PATH}?t={token}"
    assert stop in email["text"] and OPEN_URL in email["text"]
    assert email["headers"] == {
        "List-Unsubscribe": f"<{stop}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
    assert email["call"].headers["Idempotency-Key"].startswith("away-")

    # The same absence: never a second one.
    assert away.round().sent == 0
    assert len(outbox.to(EMAIL)) == 1


def test_the_feed_counts_when_the_people_followed_published_nothing(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    signed_up(client)
    stranger = other(client)
    third(client)
    wall.t = t0 + MINUTE
    published_by(client, stranger, KEY)
    # The two who follow nobody read the stranger's drawing in the Feed;
    # the stranger has nothing new but its own.
    wall.t = t0 + AWAY + 2 * MINUTE
    report = away.round()
    assert (report.away, report.sent, report.nothing_new) == (3, 2, 1)
    (email,) = outbox.to(EMAIL)
    assert email["subject"] == "A new drawing on MuW"
    assert "A new drawing in the Feed since your last visit." in email["text"]
    assert len(outbox.to(THIRD_EMAIL)) == 1
    assert outbox.to(OTHER_EMAIL) == []


def test_one_who_came_back_and_left_again_gets_another(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    me, friend = signed_up(client), other(client)
    follows(client, me, friend)
    wall.t = t0 + MINUTE
    published_by(client, friend, KEY)
    wall.t = t0 + AWAY + MINUTE
    assert away.round().sent == 1
    # Back in the app, then away again with something new.
    wall.t += timedelta(days=1)
    assert client.get("/me", headers=me).status_code == 200
    back = wall.t
    wall.t = back + MINUTE
    published_by(client, friend, OTHER_KEY)
    wall.t = back + AWAY - MINUTE
    away.round()
    assert len(outbox.to(EMAIL)) == 1
    wall.t = back + AWAY + MINUTE
    away.round()
    assert len(outbox.to(EMAIL)) == 2
    assert outbox.to(EMAIL)[1]["subject"] == "other_runner posted a new drawing on MuW"


def test_the_switch_off_means_no_email(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    ticked = signed_up(client, away_email=False)
    turned_off = other(client)
    author = third(client)
    answer = client.put("/me/notifications", json={"away": False}, headers=turned_off)
    assert answer.status_code == 200
    assert answer.json()["notifications"] == {
        "email": False,
        "push": False,
        "away": False,
    }
    wall.t = t0 + MINUTE
    published_by(client, author, KEY)
    wall.t = t0 + AWAY + 2 * MINUTE
    assert away.round().sent == 0
    assert outbox.sent == []
    # Turned on again, it is read at the next round.
    wall.t = t0
    assert client.put("/me/notifications", json={"away": True}, headers=ticked).json()[
        "notifications"
    ]["away"]
    wall.t = t0 + AWAY + 2 * MINUTE
    assert away.round().sent == 1
    assert len(outbox.to(EMAIL)) == 1


def test_a_sign_up_says_the_box_and_the_language(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
) -> None:
    answer = client.post(
        "/accounts",
        json={
            "email": EMAIL,
            "password": "correct horse battery",
            "username": "Runner_42",
            "at_least_16": True,
            "away_email": False,
            "language": "it",
        },
    )
    assert answer.status_code == 201
    assert answer.json()["user"]["notifications"]["away"] is False
    with database.connect() as conn:
        row = conn.execute("SELECT language FROM users").fetchone()
    assert row is not None and row["language"] == "it"
    for wrong in ({"away_email": "no"}, {"language": "pt"}):
        refused = client.post(
            "/accounts",
            json={
                "email": OTHER_EMAIL,
                "password": "correct horse battery",
                "username": "other_runner",
                "at_least_16": True,
                **wrong,
            },
        )
        assert refused.status_code == 422


def test_never_a_drawing_the_feed_would_not_show(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    me, blocked, private = signed_up(client), other(client), third(client)
    # A block, either way, hides everything; so do «only me» and «followers»
    # of someone not followed.
    assert client.put(
        f"/users/{public_id(client, blocked)}/block", headers=me
    ).status_code in (200, 204)
    wall.t = t0 + MINUTE
    published_by(client, blocked, KEY)
    published_by(client, private, KEY, visibility="only_me")
    published_by(client, private, OTHER_KEY, visibility="followers")
    wall.t = t0 + AWAY + 2 * MINUTE
    report = away.round()
    assert report.sent == 0
    assert outbox.to(EMAIL) == []


def test_the_language_is_the_sign_up_s_then_the_phone_s_then_english(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    me = signed_up(client, language="de")
    phone = other(client)
    plain = third(client)
    token = {
        "token": "ExponentPushToken[yyyyyyyyyyyyyyyyyyyy]",
        "platform": "ios",
        "language": "fr",
    }
    assert client.put("/me/push-token", json=token, headers=phone).status_code in (
        200,
        204,
    )
    author = signed_up(client, email="author@example.com", username="author")
    wall.t = t0 + MINUTE
    published_by(client, author, KEY)
    wall.t = t0 + AWAY + 2 * MINUTE
    assert away.round().sent == 3
    assert outbox.to(EMAIL)[0]["subject"] == WORDS["de"].subject_feed_one
    assert outbox.to(OTHER_EMAIL)[0]["subject"] == WORDS["fr"].subject_feed_one
    assert outbox.to(THIRD_EMAIL)[0]["subject"] == WORDS["en"].subject_feed_one
    del me, plain


def test_signed_out_of_every_phone_there_is_no_last_use(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    me, author = signed_up(client), other(client)
    assert client.delete("/session", headers=me).status_code == 204
    wall.t = t0 + MINUTE
    published_by(client, author, KEY)
    wall.t = t0 + AWAY + 2 * MINUTE
    # Only the author is away, with nothing new but its own.
    report = away.round()
    assert (report.away, report.nothing_new, report.sent) == (1, 1, 0)
    assert outbox.to(EMAIL) == []


def test_an_email_refused_is_tried_again_and_many_stop_the_round(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    readers = [
        signed_up(client, email=f"r{n}@example.com", username=f"reader_{n}")
        for n in range(MAX_REFUSED + 1)
    ]
    author = signed_up(client, email="author@example.com", username="author")
    wall.t = t0 + MINUTE
    published_by(client, author, KEY)
    wall.t = t0 + AWAY + 2 * MINUTE
    outbox.refuse = True
    report = away.round()
    assert (report.sent, report.refused) == (0, MAX_REFUSED)
    assert len(outbox.calls) == MAX_REFUSED
    # Resend takes them again: every reader gets its email, once.
    outbox.refuse = False
    assert away.round().sent == len(readers)
    assert away.round().sent == 0


def test_two_rounds_at_once_never_send_one_absence_twice(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    database: Database,  # noqa: F811
    away: AwayEmails,
    outbox: Outbox,
) -> None:
    t0 = wall.t
    signed_up(client)
    author = other(client)
    wall.t = t0 + MINUTE
    published_by(client, author, KEY)
    wall.t = t0 + AWAY + 2 * MINUTE
    # A second round took the account between this round's read and send.
    with database.connect() as conn:
        (reader,) = [r for r in due(conn, wall.t - AWAY) if r.username == "Runner_42"]
    assert away._take(reader, wall.t)
    assert not away._take(reader, wall.t)
    assert away.round().sent == 0


# --- The page of the link ---


@pytest.fixture
def page(client: TestClient, away: AwayEmails) -> TestClient:  # noqa: F811
    install_away_email(client.app, away)  # type: ignore[arg-type]
    return client


def test_the_link_asks_first_and_only_the_button_stops(
    page: TestClient, wall: WallClock  # noqa: F811
) -> None:
    me = signed_up(page, language="it")
    token = StopLinks(SECRET, BASE).token(UUID(public_id(page, me)))
    asked = page.get(STOP_PATH, params={"t": token})
    assert asked.status_code == 200
    assert asked.headers["cache-control"] == "no-store"
    assert WORDS["it"].ask in asked.text
    assert f'action="{STOP_PATH}?t={token}"' in asked.text
    # Opening the link changed nothing.
    assert page.get("/me", headers=me).json()["notifications"]["away"] is True
    stopped = page.post(STOP_PATH, params={"t": token})
    assert stopped.status_code == 200
    assert WORDS["it"].stopped in stopped.text
    assert page.get("/me", headers=me).json()["notifications"]["away"] is False
    # The mail app's one-click unsubscribe posts its own body: the same.
    again = page.post(
        STOP_PATH,
        params={"t": token},
        content=b"List-Unsubscribe=One-Click",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert again.status_code == 200


def test_a_wrong_link_stops_nothing(page: TestClient) -> None:
    me, theirs = signed_up(page), other(page)
    mine = StopLinks(SECRET, BASE).token(UUID(public_id(page, me)))
    forged = f"{UUID(public_id(page, theirs)).hex}.{mine.partition('.')[2]}"
    for token in ("", "nonsense", forged, StopLinks(b"o" * 32, BASE).token(uuid4())):
        assert page.get(STOP_PATH, params={"t": token}).status_code == 404
        assert page.post(STOP_PATH, params={"t": token}).status_code == 404
    assert page.get("/me", headers=theirs).json()["notifications"]["away"] is True
    # A deleted account's link names nobody any more.
    assert page.delete("/me", headers=me).status_code == 204
    assert page.post(STOP_PATH, params={"t": mine}).status_code == 404


def test_the_page_needs_no_api_key(
    monkeypatch: pytest.MonkeyPatch,
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    away: AwayEmails,
) -> None:
    # Signed up through an API without a key; then the server gets one.
    me = signed_up(client)
    token = StopLinks(SECRET, BASE).token(UUID(public_id(client, me)))
    monkeypatch.setenv("SHAPEROUTE_API_KEY", "k" * 32)
    keyed = api(database, wall)
    install_away_email(keyed.app, away)  # type: ignore[arg-type]
    assert keyed.get("/me", headers=me).status_code == 401
    # A browser has no key, and still has the page and its button.
    assert keyed.get(STOP_PATH, params={"t": token}).status_code == 200
    assert keyed.post(STOP_PATH, params={"t": token}).status_code == 200
    assert client.get("/me", headers=me).json()["notifications"]["away"] is False


# --- By hand ---


def test_by_hand_it_counts_without_sending(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    database: Database,  # noqa: F811
) -> None:
    monkeypatch.setenv("SHAPEROUTE_DATABASE_URL", database.url)
    for name in ENV:
        monkeypatch.delenv(name, raising=False)
    main([])
    assert "0 account(s) away" in capsys.readouterr().out
    with pytest.raises(SystemExit, match="Emails off"):
        main(["--send"])
