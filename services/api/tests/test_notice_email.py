"""The daily email of the notices (TASK-262 part B, ADR-0226): the words in
five languages, push.py's listeners, the environment, and in a real
PostgreSQL what is kept, who gets one, when, with what, and the page that
turns it off. Resend is a fake network."""

from __future__ import annotations

import threading
from datetime import time as clock_time
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_away_email import ENV, SECRET, Outbox
from test_drawings import (
    FAST_HASHER,
    KEY,
    OTHER_EMAIL,
    OTHER_KEY,
    THIRD_EMAIL,
    WallClock,
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
from test_push import FakeExpo, put_token

from shaperoute_api.access import OPEN_PATHS
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.away_email import (
    OPEN_URL,
    SENDER,
    AwayConfigError,
    StopLinks,
)
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.notice_email import (
    DEFAULT_AT,
    KEPT_DAYS,
    PURPOSE,
    STOP_PATH,
    DailyRound,
    NoticeEmails,
    NoticeSetup,
    install_notice_email,
)
from shaperoute_api.notice_texts import MAX_LINES, WORDS, write
from shaperoute_api.push import Pusher, PushEvent
from shaperoute_api.resend_email import Resend

BASE = "https://api.example.app"
EMAIL = "runner@example.com"
DAY = timedelta(days=1)
LINKS = StopLinks(SECRET, BASE, PURPOSE, STOP_PATH)


# --- The words ---


def test_every_language_says_it_all() -> None:
    for language, words in WORDS.items():
        written = write(language, "ada", ["one", "two"], OPEN_URL, f"{BASE}/x")
        assert words.title in written.text and words.why in written.text
        assert words.switch in written.text, language
        assert "{" not in written.text + written.html, language


def test_one_line_is_the_subject_and_more_are_a_count() -> None:
    one = write("en", "ada", ["bob asked to follow you."], OPEN_URL, BASE)
    assert one.subject == "bob asked to follow you."
    many = write("en", "ada", [f"line {n}" for n in range(12)], OPEN_URL, BASE)
    assert many.subject == "12 new notifications on MuW"
    assert f"line {MAX_LINES - 1}" in many.text and f"line {MAX_LINES}" not in many.text
    assert "…and 2 more in the app." in many.text
    with pytest.raises(ValueError):
        write("en", "ada", [], OPEN_URL, BASE)


def test_the_html_escapes_what_it_is_given() -> None:
    written = write("en", "<b>", ["<script>x</script>"], OPEN_URL, BASE)
    assert "<script>" not in written.html and "&lt;script&gt;" in written.html
    assert "<b>" not in written.html


def test_a_link_of_one_email_never_stops_the_other() -> None:
    away = StopLinks(SECRET, BASE)
    someone = UUID(int=7)
    assert LINKS.token(someone) != away.token(someone)
    assert away.public_id_of(LINKS.token(someone)) is None
    assert LINKS.public_id_of(away.token(someone)) is None
    assert LINKS.public_id_of(LINKS.token(someone)) == someone
    assert LINKS.url(someone).startswith(f"{BASE}{STOP_PATH}?t=")


# --- What the environment says ---


def test_the_emails_are_off_with_the_away_email_off() -> None:
    assert NoticeSetup.from_env({}) is None
    assert NoticeSetup.from_env({**ENV, "SHAPEROUTE_DOMAIN": ""}) is None


def test_the_environment_sets_the_links_and_the_hour() -> None:
    setup = NoticeSetup.from_env(ENV)
    assert setup is not None and setup.at == DEFAULT_AT
    assert setup.links.path == STOP_PATH and setup.links.purpose == PURPOSE
    later = NoticeSetup.from_env({**ENV, "NOTICE_EMAIL_AT": "06:30"})
    assert later is not None and later.at == clock_time(6, 30)
    with pytest.raises(AwayConfigError, match="NOTICE_EMAIL_AT"):
        NoticeSetup.from_env({**ENV, "NOTICE_EMAIL_AT": "soon"})


def test_the_page_of_the_link_needs_no_api_key() -> None:
    assert STOP_PATH in OPEN_PATHS


# --- push.py's listeners ---


def event(kind: str = "comment", actor: int = 1, recipient: int = 2) -> PushEvent:
    return PushEvent(kind, actor, recipient, key="k")  # type: ignore[arg-type]


def test_a_listener_hears_what_push_lets_through_and_push_goes_on(
    database: Database,  # noqa: F811
) -> None:
    heard: list[PushEvent] = []

    def broken(_: PushEvent) -> None:
        raise RuntimeError("a listener that fails")

    pusher = Pusher(
        database, Expo(send=FakeExpo()), run=lambda task: task(), later=lambda *_: None
    )
    pusher.listeners.extend([broken, heard.append])
    pusher.notify(event())
    # The same event the same day, and one's own: neither push nor listener.
    pusher.notify(event())
    pusher.notify(event(actor=2))
    # The game's own kinds are let through too: the listener picks its own.
    pusher.notify(event("shape_unlocked", actor=2))
    assert [e.kind for e in heard] == ["comment", "shape_unlocked"]


def test_without_listeners_push_is_as_before(
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    expo = FakeExpo()
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
    )
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    test = TestClient(app)
    ada, bob = signed_up(test), other(test)
    put_token(test, ada, "ExponentPushToken[phone-of-ada]")
    assert test.put(
        "/me/notifications", json={"push": True}, headers=ada
    ).status_code in (200, 204)
    test.post(f"/users/{public_id(test, ada)}/follow", headers=bob)
    assert [m["body"] for m in expo.sent] == ["other_runner asked to follow you."]


# --- In the database ---


@pytest.fixture
def outbox() -> Outbox:
    return Outbox()


@pytest.fixture
def notices(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    outbox: Outbox,
) -> NoticeEmails:
    setup = NoticeSetup(Resend("re_key", SENDER, send=outbox), LINKS)
    emails = NoticeEmails(database, setup, now=wall, wait=lambda _: False)
    install_notice_email(client.app, emails)  # type: ignore[arg-type]
    return emails


def email_on(app: TestClient, headers: dict[str, str], on: bool = True) -> None:
    answer = app.put("/me/notifications", json={"email": on}, headers=headers)
    assert answer.status_code in (200, 204), answer.text


def kept(database: Database) -> int:  # noqa: F811
    with database.connect() as conn:
        row = conn.execute("SELECT count(*) AS n FROM email_notices").fetchone()
    assert row is not None
    return int(row["n"])


def posted(
    app: TestClient, headers: dict[str, str], key: str = KEY, **fields: Any
) -> str:
    """A drawing for everyone, its id."""
    saved(app, headers, key)
    return str(drawn(app, headers, key, **fields)["id"])


def test_the_five_events_are_one_email_the_next_round(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
    email_on(client, me)
    mine = posted(client, me)
    # bob asks to follow me; cleo accepts my request.
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    follows(client, me, cleo)
    client.put(f"/drawings/{mine}/reaction", json={"kind": "fire"}, headers=bob)
    client.post(f"/drawings/{mine}/comments", json={"text": "Great run"}, headers=bob)
    wall.t += timedelta(minutes=1)
    posted(client, cleo, OTHER_KEY, tags=[public_id(client, me)])
    assert kept(database) == 5

    report = notices.round()
    assert (report.due, report.sent) == (1, 1)
    (email,) = outbox.to(EMAIL)
    assert email["subject"] == "5 new notifications on MuW"
    lines = [line[2:] for line in email["text"].split("\n") if line.startswith("• ")]
    assert lines == [
        "third_runner tagged you in a post.",
        "other_runner commented on your post: Great run",
        "other_runner reacted 🔥 to your post.",
        "third_runner accepted your follow request.",
        "other_runner asked to follow you.",
    ]
    assert email["from"] == SENDER
    stop = LINKS.url(UUID(public_id(client, me)))
    assert stop in email["text"] and OPEN_URL in email["text"]
    assert email["headers"]["List-Unsubscribe"] == f"<{stop}>"
    assert email["call"].headers["Idempotency-Key"] == (
        f"notices-{notices_id(database, EMAIL)}-{wall.t:%Y%m%d}"
    )
    # Taken: the rows are gone, and nobody else had any.
    assert kept(database) == 0
    assert outbox.to(OTHER_EMAIL) == [] and outbox.to(THIRD_EMAIL) == []


def notices_id(database: Database, email: str) -> int:  # noqa: F811
    with database.connect() as conn:
        row = conn.execute("SELECT id FROM users WHERE email = %s", (email,)).fetchone()
    assert row is not None
    return int(row["id"])


def test_with_the_switch_off_nothing_is_kept(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client), other(client)
    mine = posted(client, me)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    client.post(f"/drawings/{mine}/comments", json={"text": "Hi"}, headers=bob)
    assert kept(database) == 0
    assert notices.round().sent == 0 and outbox.sent == []


def test_what_is_not_true_any_more_is_left_out(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
    email_on(client, me)
    mine = posted(client, me)
    # A request withdrawn, a reaction taken back, a comment deleted.
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    client.delete(f"/users/{public_id(client, me)}/follow", headers=bob)
    client.put(f"/drawings/{mine}/reaction", json={"kind": "wow"}, headers=bob)
    client.delete(f"/drawings/{mine}/reaction", headers=bob)
    said = client.post(f"/drawings/{mine}/comments", json={"text": "x"}, headers=bob)
    client.delete(f"/comments/{said.json()['id']}", headers=bob)
    # cleo comments, then I block cleo.
    client.post(f"/drawings/{mine}/comments", json={"text": "Hey"}, headers=cleo)
    blocked = client.put(f"/users/{public_id(client, cleo)}/block", headers=me)
    assert blocked.status_code in (200, 204)
    assert kept(database) >= 3

    report = notices.round()
    assert (report.sent, report.nothing_left) == (0, 1)
    assert outbox.sent == [] and kept(database) == 0


def test_a_tag_in_a_drawing_no_longer_seen_is_left_out(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, cleo = signed_up(client), third(client)
    email_on(client, me)
    posted(client, cleo, tags=[public_id(client, me)])
    drawn(client, cleo, visibility="followers", tags=[public_id(client, me)])
    assert notices.round().sent == 0 and outbox.sent == []


def test_a_super_like_says_its_words(
    client: TestClient,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client), other(client)
    email_on(client, me)
    mine = posted(client, me)
    body = {"kind": "super_like", "comment": "What a heart"}
    assert client.put(
        f"/drawings/{mine}/reaction", json=body, headers=bob
    ).status_code in (200, 201)
    notices.round()
    (email,) = outbox.to(EMAIL)
    assert email["subject"] == "other_runner gave your post a MuW heart: What a heart"


def test_one_email_a_day_even_with_two_rounds_at_once_or_a_restart(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client), other(client)
    email_on(client, me)
    mine = posted(client, me)
    client.post(f"/drawings/{mine}/comments", json={"text": "One"}, headers=bob)
    start = threading.Barrier(2)

    def a_round() -> None:
        start.wait()
        notices.round()

    rounds = [threading.Thread(target=a_round) for _ in range(2)]
    for each in rounds:
        each.start()
    for each in rounds:
        each.join()
    assert len(outbox.to(EMAIL)) == 1

    # Something new the same day, and the API restarted: tomorrow.
    wall.t += timedelta(minutes=5)
    client.post(f"/drawings/{mine}/comments", json={"text": "Two"}, headers=bob)
    again = NoticeEmails(database, notices.setup, now=wall, wait=lambda _: False)
    assert again.round().sent == 0
    wall.t += DAY
    assert again.round().sent == 1
    assert outbox.to(EMAIL)[1]["subject"] == "other_runner commented on your post: Two"


def test_an_email_refused_is_tried_again_the_next_round(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client), other(client)
    email_on(client, me)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    outbox.refuse = True
    report = notices.round()
    assert (report.sent, report.refused) == (0, 1)
    assert kept(database) == 1
    outbox.refuse = False
    assert notices.round().sent == 1
    assert kept(database) == 0


def test_old_rows_go_after_some_days(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client), other(client)
    email_on(client, me)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    outbox.refuse = True
    wall.t += timedelta(days=KEPT_DAYS, minutes=1)
    notices.round()
    assert kept(database) == 0


def test_a_round_stops_between_two_emails_when_told(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
    for who in (me, bob):
        email_on(client, who)
    client.post(f"/users/{public_id(client, me)}/follow", headers=cleo)
    client.post(f"/users/{public_id(client, bob)}/follow", headers=cleo)
    notices.wait = lambda _: True
    assert notices.round().sent == 1
    assert kept(database) == 1


def test_the_language_is_the_accounts(
    client: TestClient,  # noqa: F811
    notices: NoticeEmails,
    outbox: Outbox,
) -> None:
    me, bob = signed_up(client, language="it"), other(client)
    email_on(client, me)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    notices.round()
    (email,) = outbox.to(EMAIL)
    assert email["subject"] == "other_runner ha chiesto di seguirti."
    assert WORDS["it"].why in email["text"]


def test_the_link_asks_first_and_only_the_button_stops(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    notices: NoticeEmails,
) -> None:
    me, bob = signed_up(client), other(client)
    email_on(client, me)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    token = LINKS.token(UUID(public_id(client, me)))
    page = client.get(f"{STOP_PATH}?t={token}")
    assert page.status_code == 200 and "<form" in page.text
    assert client.get("/me", headers=me).json()["notifications"]["email"] is True
    done = client.post(f"{STOP_PATH}?t={token}")
    assert done.status_code == 200
    assert client.get("/me", headers=me).json()["notifications"]["email"] is False
    assert kept(database) == 0


def test_a_wrong_link_stops_nothing(
    client: TestClient,  # noqa: F811
    notices: NoticeEmails,
) -> None:
    me = signed_up(client)
    email_on(client, me)
    away = StopLinks(SECRET, BASE).token(UUID(public_id(client, me)))
    for token in ("", "nope", away):
        assert client.post(f"{STOP_PATH}?t={token}").status_code == 404
    assert client.get("/me", headers=me).json()["notifications"]["email"] is True


# --- With the app's life ---


def test_the_round_stops_before_the_pool_closes(
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    alive_at_close: list[bool] = []
    close = Database.close

    def spy(self: Database) -> None:
        names = {thread.name for thread in threading.enumerate()}
        alive_at_close.append("notice-email" in names)
        close(self)

    monkeypatch.setattr(Database, "close", spy)
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
    )
    setup = NoticeSetup(Resend("re_key", SENDER, send=Outbox()), LINKS)
    install_notice_email(app, NoticeEmails(database, setup, now=wall))
    with TestClient(app):
        names = {thread.name for thread in threading.enumerate()}
        assert "notice-email" in names
    assert alive_at_close == [False]


def test_stop_ends_the_wait_for_the_next_round(
    database: Database,  # noqa: F811
) -> None:
    setup = NoticeSetup(Resend("re_key", SENDER, send=Outbox()), LINKS)
    daily = DailyRound(NoticeEmails(database, setup))
    thread = daily.start()
    daily.stop()
    assert not thread.is_alive()
