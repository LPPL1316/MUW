"""Private messages in a real PostgreSQL (TASK-319, ADR-0279): a message to
someone who follows the writer lands in its «Messages», to anyone else as a
request of one message until it is accepted, answered or deleted; the
request's message passes the comments' filter; a block deletes the
conversation; who wrote a message deletes it; only the other reports it;
each message is told by push, a request once a day. The bodies are the
examples of packages/shared-types/fixtures."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_push import FakeExpo, push_on, put_token

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.follows import NO_PROFILE
from shaperoute_api.messages import (
    MAX_MESSAGE_LENGTH,
    MAX_MESSAGES_PER_MINUTE,
    MESSAGE_EMPTY,
    MESSAGE_NOT_TEXT,
    MESSAGE_TOO_LONG,
    NEGATIVE_MESSAGE,
    NO_CONVERSATION,
    NO_MESSAGE,
    NOT_YOUR_MESSAGE,
    NOT_YOURSELF,
    TOO_MANY_MESSAGES,
    UNREAD_COUNT_MAX,
    WAITING,
    ConversationsBody,
    MessageBody,
    MessageRequestBody,
    MessagesBody,
    UnreadBody,
    checked_text,
)
from shaperoute_api.push import Pusher
from shaperoute_api.report_email import reported

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
ADA_PHONE = "ExponentPushToken[phone-of-ada]"
BOB_PHONE = "ExponentPushToken[phone-of-bob]"

Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """A clock the test moves by hand; each message one second later."""

    def __init__(self) -> None:
        self.t = datetime(2026, 10, 26, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t

    def later(self, seconds: float = 1) -> None:
        self.t += timedelta(seconds=seconds)


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def client(database: Database, wall: WallClock, expo: FakeExpo) -> TestClient:
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
        run_places=PlaceNames(None),
    )
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


def signed_up(client: TestClient, name: str) -> Headers:
    body = {
        **_load("sign-up-request.json"),
        "email": f"{name}@example.com",
        "username": name,
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201, answer.text
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def pid(client: TestClient, headers: Headers) -> str:
    return str(client.get("/me", headers=headers).json()["public_id"])


def send(client: TestClient, who: Headers, to: Headers, text: str) -> Any:
    answer = client.post(
        f"/conversations/{pid(client, to)}/messages",
        json={"text": text},
        headers=who,
    )
    client.app.state.accounts.now.later()  # type: ignore[attr-defined]
    return answer


def cleared(client: TestClient, who: Headers, other: Headers) -> None:
    """The conversation with `other` out of `who`'s view, a second ago."""
    answer = client.delete(f"/conversations/{pid(client, other)}", headers=who)
    assert answer.status_code == 204, answer.text
    client.app.state.accounts.now.later()  # type: ignore[attr-defined]


def sent(client: TestClient, who: Headers, to: Headers, text: str) -> Any:
    answer = send(client, who, to, text)
    assert answer.status_code == 201, answer.text
    return answer.json()


def page(client: TestClient, who: Headers, other: Headers, **query: Any) -> Any:
    answer = client.get(
        f"/conversations/{pid(client, other)}/messages", params=query, headers=who
    )
    assert answer.status_code == 200, answer.text
    return answer.json()


def texts(client: TestClient, who: Headers, other: Headers) -> list[str]:
    """The conversation as `who` sees it, the oldest first."""
    return [m["text"] for m in reversed(page(client, who, other)["messages"])]


def box(client: TestClient, who: Headers, which: str = "inbox", **query: Any) -> Any:
    answer = client.get(
        "/me/conversations", params={"box": which, **query}, headers=who
    )
    assert answer.status_code == 200, answer.text
    return answer.json()


def names(client: TestClient, who: Headers, which: str = "inbox") -> list[str]:
    return [c["person"]["username"] for c in box(client, who, which)["conversations"]]


def unread(client: TestClient, who: Headers) -> Any:
    answer = client.get("/me/conversations/unread", headers=who)
    assert answer.status_code == 200, answer.text
    return answer.json()


def follow(client: TestClient, follower: Headers, followed: Headers) -> None:
    """`follower` follows `followed`, the request accepted."""
    asked = client.post(f"/users/{pid(client, followed)}/follow", headers=follower)
    assert asked.is_success, asked.text
    accept = f"/me/follow-requests/{pid(client, follower)}/accept"
    assert client.post(accept, headers=followed).status_code == 204


def rows(database: Database, sql: str, *values: Any) -> list[dict[str, Any]]:
    with database.connect() as conn:
        return [dict(row) for row in conn.execute(sql, values).fetchall()]


def report(client: TestClient, who: Headers, message_id: str) -> Any:
    body = {"kind": "message", "id": message_id, "reason": "harassment"}
    return client.post("/reports", json=body, headers=who)


# --- The contract ---


def test_the_examples_are_the_bodies() -> None:
    for name, model in (
        ("message.json", MessageBody),
        ("messages.json", MessagesBody),
        ("message-attachments.json", MessagesBody),
        ("conversations.json", ConversationsBody),
        ("conversations-unread.json", UnreadBody),
    ):
        body = _load(name)
        assert set(body) == set(model.model_fields), name
        model.model_validate(body)
    # What the app sends: the attachment only when there is one (TASK-333).
    for name in ("message-request.json", "message-attachment-request.json"):
        body = _load(name)
        assert set(body) <= set(MessageRequestBody.model_fields), name
        MessageRequestBody.model_validate(body)


def test_a_text_refused_says_why() -> None:
    assert checked_text("  Hi!\nSee you\t ") == "Hi!\nSee you"
    for text, why in (
        (" \n ", MESSAGE_EMPTY),
        ("x" * (MAX_MESSAGE_LENGTH + 1), MESSAGE_TOO_LONG),
        ("a\tb", MESSAGE_NOT_TEXT),
        ("a\x00b", MESSAGE_NOT_TEXT),
    ):
        with pytest.raises(Exception) as refused:
            checked_text(text)
        assert getattr(refused.value, "message", None) == why
    assert checked_text("x" * MAX_MESSAGE_LENGTH) == "x" * MAX_MESSAGE_LENGTH


# --- Where a message lands ---


def test_to_someone_who_follows_the_writer_it_lands_in_messages(
    client: TestClient,
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    assert page(client, ada, bob)["state"] == "open"
    sent(client, ada, bob, "Hi Bob!")
    assert names(client, bob) == ["ada"]
    assert names(client, bob, "requests") == []
    assert page(client, bob, ada)["state"] == "open"
    # Both write freely.
    sent(client, ada, bob, "Shall we run the heart on Sunday?")
    sent(client, bob, ada, "Yes!")
    assert texts(client, bob, ada) == [
        "Hi Bob!",
        "Shall we run the heart on Sunday?",
        "Yes!",
    ]
    assert names(client, ada) == ["bob"]


def test_to_anyone_else_it_is_a_request_of_one_message(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    # Ada follows Bob: that does not let her write freely to him.
    follow(client, ada, bob)
    assert page(client, ada, bob)["state"] == "first"
    sent(client, ada, bob, "Hi, I loved your star!")
    assert names(client, bob) == []
    assert names(client, bob, "requests") == ["ada"]
    assert unread(client, bob) == {"unread": 0, "requests": 1}
    assert page(client, bob, ada)["state"] == "request"
    # Ada has it in her own «Messages», and waits.
    assert names(client, ada) == ["bob"]
    assert page(client, ada, bob)["state"] == "waiting"
    second = send(client, ada, bob, "Hello?")
    assert second.status_code == 409
    assert second.json()["error"]["message"] == WAITING
    assert texts(client, bob, ada) == ["Hi, I loved your star!"]
    assert len(rows(database, "SELECT 1 FROM messages")) == 1


def test_accepting_a_request_lets_both_write(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    sent(client, ada, bob, "Hi!")
    accept = f"/conversations/{pid(client, ada)}/accept"
    assert client.put(accept, headers=bob).status_code == 204
    # Accepted again: done already.
    assert client.put(accept, headers=bob).status_code == 204
    assert names(client, bob) == ["ada"]
    assert names(client, bob, "requests") == []
    assert page(client, bob, ada)["state"] == "open"
    assert page(client, ada, bob)["state"] == "open"
    sent(client, ada, bob, "Thanks for accepting.")
    assert texts(client, bob, ada) == ["Hi!", "Thanks for accepting."]


def test_accepting_without_a_conversation_is_404(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    answer = client.put(f"/conversations/{pid(client, ada)}/accept", headers=bob)
    assert answer.status_code == 404
    assert answer.json()["error"]["message"] == NO_CONVERSATION


def test_replying_accepts_the_request(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    sent(client, ada, bob, "Hi!")
    sent(client, bob, ada, "Hi Ada")
    assert names(client, bob) == ["ada"]
    assert page(client, ada, bob)["state"] == "open"
    sent(client, ada, bob, "How far do you run?")
    assert texts(client, ada, bob) == ["Hi!", "Hi Ada", "How far do you run?"]


def test_deleting_a_request_and_the_writer_may_write_once_more(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    sent(client, ada, bob, "Buy my shoes!")
    cleared(client, bob, ada)
    assert names(client, bob, "requests") == []
    assert unread(client, bob) == {"unread": 0, "requests": 0}
    assert page(client, bob, ada)["messages"] == []
    # Nothing tells Ada: she still sees what she wrote; she may write again.
    assert texts(client, ada, bob) == ["Buy my shoes!"]
    assert page(client, ada, bob)["state"] == "first"
    sent(client, ada, bob, "Sorry. Nice heart, though.")
    assert texts(client, bob, ada) == ["Sorry. Nice heart, though."]
    assert page(client, bob, ada)["state"] == "request"
    assert send(client, ada, bob, "Hello?").status_code == 409
    # Deleted again, done already; then by Ada too: nobody sees the two.
    cleared(client, bob, ada)
    cleared(client, ada, bob)
    assert rows(database, "SELECT 1 FROM messages") == []


def test_deleting_a_conversation_keeps_who_may_write(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    sent(client, ada, bob, "Hi!")
    sent(client, bob, ada, "Hi!")
    cleared(client, bob, ada)
    assert names(client, bob) == []
    assert texts(client, ada, bob) == ["Hi!", "Hi!"]
    sent(client, ada, bob, "Still there?")
    assert names(client, bob) == ["ada"]
    assert texts(client, bob, ada) == ["Still there?"]


def test_the_message_of_a_request_passes_the_comments_filter(
    client: TestClient, database: Database
) -> None:
    ada, bob, cy = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    # The filter is comment_filter.py's (TASK-213): here only that it is asked.
    answer = send(client, ada, bob, "What an ugly route")
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert (error["code"], error["message"]) == ("comment_rejected", NEGATIVE_MESSAGE)
    assert error["reason"] == "negative"
    assert rows(database, "SELECT 1 FROM messages") == []
    assert page(client, bob, ada)["messages"] == []
    assert page(client, ada, bob)["state"] == "first"
    # Between two who write freely, the same words are kept.
    follow(client, cy, ada)
    assert sent(client, ada, cy, "What an ugly route")["text"] == "What an ugly route"


def test_a_message_is_kept_as_written(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    text = '<a href="https://example.com">look</a> & <script>x</script>\nok'
    assert sent(client, ada, bob, f"  {text} ")["text"] == text
    assert texts(client, bob, ada) == [text]


# --- Who may write to whom ---


def test_writing_to_oneself_or_to_nobody(client: TestClient) -> None:
    ada = signed_up(client, "ada")
    answer = send(client, ada, ada, "Hi me")
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == NOT_YOURSELF
    for nobody in (str(uuid4()), "not-an-id"):
        answer = client.post(
            f"/conversations/{nobody}/messages", json={"text": "Hi"}, headers=ada
        )
        assert answer.status_code == 404
        assert answer.json()["error"]["message"] == NO_PROFILE
        got = client.get(f"/conversations/{nobody}/messages", headers=ada)
        assert got.status_code == 404


def test_a_block_deletes_the_conversation_and_keeps_the_two_apart(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    sent(client, ada, bob, "Hi!")
    sent(client, bob, ada, "Hi!")
    assert client.put(f"/users/{pid(client, ada)}/block", headers=bob).is_success
    assert rows(database, "SELECT 1 FROM conversations") == []
    assert rows(database, "SELECT 1 FROM messages") == []
    assert names(client, ada) == [] and names(client, bob) == []
    # As for nobody, both ways.
    for who, whom in ((ada, bob), (bob, ada)):
        answer = send(client, who, whom, "Hello?")
        assert answer.status_code == 404
        assert answer.json()["error"]["message"] == NO_PROFILE
        got = client.get(f"/conversations/{pid(client, whom)}/messages", headers=who)
        assert got.status_code == 404
    # Unblocked, nothing comes back, and Bob no longer follows Ada: a request.
    assert client.delete(f"/users/{pid(client, ada)}/block", headers=bob).is_success
    assert page(client, ada, bob)["messages"] == []
    assert page(client, ada, bob)["state"] == "first"
    sent(client, ada, bob, "Sorry about that.")
    assert names(client, bob, "requests") == ["ada"]


def test_a_hidden_member_writes_to_nobody_who_sees_it(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    sent(client, ada, bob, "Hi!")
    with database.connect() as conn:
        conn.execute("UPDATE users SET hidden_at = now() WHERE username = 'ada'")
    assert names(client, bob, "requests") == []
    assert unread(client, bob) == {"unread": 0, "requests": 0}
    assert (
        client.get(
            f"/conversations/{pid(client, ada)}/messages", headers=bob
        ).status_code
        == 404
    )
    # She sees everyone as before, and what she wrote.
    assert texts(client, ada, bob) == ["Hi!"]


# --- Deleting a message ---


def test_who_wrote_a_message_deletes_it_for_both(
    client: TestClient, database: Database
) -> None:
    ada, bob, cy = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    follow(client, bob, ada)
    first = sent(client, ada, bob, "Hi!")
    answer = sent(client, bob, ada, "Hello")
    assert client.delete(f"/messages/{first['id']}", headers=bob).status_code == 403
    not_yours = client.delete(f"/messages/{answer['id']}", headers=ada)
    assert not_yours.json()["error"]["message"] == NOT_YOUR_MESSAGE
    for nobody in (str(uuid4()), "not-an-id"):
        gone = client.delete(f"/messages/{nobody}", headers=ada)
        assert gone.status_code == 404
        assert gone.json()["error"]["message"] == NO_MESSAGE
    # A third does not even learn it is there.
    assert client.delete(f"/messages/{first['id']}", headers=cy).status_code == 404
    assert client.delete(f"/messages/{first['id']}", headers=ada).status_code == 204
    assert texts(client, bob, ada) == ["Hello"]
    assert texts(client, ada, bob) == ["Hello"]
    assert client.delete(f"/messages/{first['id']}", headers=ada).status_code == 404
    assert len(rows(database, "SELECT 1 FROM messages")) == 1


# --- Reporting ---


def test_a_message_is_reported_only_by_the_other(
    client: TestClient, database: Database
) -> None:
    ada, bob, cy = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    message = sent(client, ada, bob, "Send me your address")
    assert report(client, ada, message["id"]).status_code == 422
    assert report(client, cy, message["id"]).status_code == 404
    assert report(client, bob, str(uuid4())).status_code == 404
    assert report(client, bob, message["id"]).status_code == 204
    kept = rows(database, "SELECT id, kind, target_id, reason FROM reports")
    assert [(r["kind"], str(r["target_id"]), r["reason"]) for r in kept] == [
        ("message", message["id"], "harassment")
    ]
    # The report's email holds that message, and nothing else of the two.
    with database.connect() as conn:
        found = reported(conn, kept[0]["id"])
    assert found is not None
    assert (found.kind, found.author, found.reporter) == ("message", "ada", "bob")
    assert found.lines[0] == "Message: Send me your address"
    assert not found.hidden


def test_a_hidden_message_is_seen_only_by_who_wrote_it(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    sent(client, ada, bob, "Hi!")
    bad = sent(client, ada, bob, "Something awful")
    with database.connect() as conn:
        conn.execute(
            "UPDATE messages SET hidden_at = now() WHERE id = %s", (UUID(bad["id"]),)
        )
    assert texts(client, bob, ada) == ["Hi!"]
    assert box(client, bob)["conversations"][0]["last"]["text"] == "Hi!"
    assert texts(client, ada, bob) == ["Hi!", "Something awful"]


# --- Read and unread ---


def test_the_list_counts_what_was_not_read(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    sent(client, ada, bob, "One")
    sent(client, ada, bob, "Two")
    conversation = box(client, bob)["conversations"][0]
    assert (conversation["unread"], conversation["unread_count"]) == (True, 2)
    # One's own do not count.
    mine = box(client, ada)["conversations"][0]
    assert (mine["unread"], mine["unread_count"]) == (False, 0)
    read = client.put(f"/conversations/{pid(client, ada)}/read", headers=bob)
    assert read.status_code == 204
    client.app.state.accounts.now.later()  # type: ignore[attr-defined]
    conversation = box(client, bob)["conversations"][0]
    assert (conversation["unread"], conversation["unread_count"]) == (False, 0)
    sent(client, ada, bob, "Three")
    assert box(client, bob)["conversations"][0]["unread_count"] == 1
    # The number of «Messages» still counts conversations, not messages.
    assert unread(client, bob)["unread"] == 1


def test_the_count_stops_at_its_most(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    for number in range(UNREAD_COUNT_MAX + 2):
        sent(client, ada, bob, f"Message {number}")
    conversation = box(client, bob)["conversations"][0]
    assert conversation["unread_count"] == UNREAD_COUNT_MAX


def test_reading_takes_the_dot_away(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    sent(client, ada, bob, "Hi!")
    assert unread(client, bob) == {"unread": 1, "requests": 0}
    assert box(client, bob)["conversations"][0]["unread"] is True
    # Who writes has read: no dot for Ada.
    assert box(client, ada)["conversations"][0]["unread"] is False
    read = client.put(f"/conversations/{pid(client, ada)}/read", headers=bob)
    assert read.status_code == 204
    client.app.state.accounts.now.later()  # type: ignore[attr-defined]
    assert unread(client, bob) == {"unread": 0, "requests": 0}
    assert box(client, bob)["conversations"][0]["unread"] is False
    sent(client, ada, bob, "Are you there?")
    assert unread(client, bob)["unread"] == 1
    # Reading before any message changes nothing.
    cy = signed_up(client, "cleo")
    assert client.put(f"/conversations/{pid(client, cy)}/read", headers=bob).is_success
    # Nothing tells Ada whether Bob read it.
    assert set(page(client, ada, bob)["messages"][0]) == {
        "id",
        "text",
        "created_at",
        "mine",
        "attachment",
    }


# --- Pages ---


def test_the_messages_come_a_page_at_a_time_the_latest_first(
    client: TestClient,
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    for n in range(5):
        sent(client, ada, bob, f"Message {n}")
    first = page(client, bob, ada, limit=2)
    assert [m["text"] for m in first["messages"]] == ["Message 4", "Message 3"]
    assert first["messages"][0]["mine"] is False
    second = page(client, bob, ada, limit=2, cursor=first["next"])
    assert [m["text"] for m in second["messages"]] == ["Message 2", "Message 1"]
    last = page(client, bob, ada, limit=2, cursor=second["next"])
    assert [m["text"] for m in last["messages"]] == ["Message 0"]
    assert last["next"] is None
    assert page(client, bob, ada)["person"]["username"] == "ada"


def test_the_conversations_come_the_latest_message_first(
    client: TestClient,
) -> None:
    me = signed_up(client, "mia")
    others = [signed_up(client, n) for n in ("ada", "bob", "cleo")]
    for other in others:
        follow(client, me, other)
        sent(client, other, me, "Hi!")
    sent(client, others[0], me, "Again")
    first = box(client, me, limit=2)
    assert [c["person"]["username"] for c in first["conversations"]] == ["ada", "cleo"]
    assert first["total"] == 3
    assert first["conversations"][0]["last"]["text"] == "Again"
    second = box(client, me, limit=2, cursor=first["next"])
    assert [c["person"]["username"] for c in second["conversations"]] == ["bob"]
    assert second["next"] is None and second["total"] == 3
    assert "email" not in json.dumps(first)


# --- Limits, tokens, accounts ---


def test_too_many_messages_in_a_minute(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    follow(client, bob, ada)
    for n in range(MAX_MESSAGES_PER_MINUTE):
        sent(client, ada, bob, f"{n}")
    answer = send(client, ada, bob, "One more")
    assert answer.status_code == 429
    assert answer.json()["error"]["message"] == TOO_MANY_MESSAGES
    assert int(answer.headers["Retry-After"]) > 0
    # Bob has a limit of his own.
    sent(client, bob, ada, "Slow down!")


def test_every_endpoint_wants_a_token(client: TestClient) -> None:
    someone = str(uuid4())
    for method, path in (
        ("GET", "/me/conversations"),
        ("GET", "/me/conversations/unread"),
        ("GET", f"/conversations/{someone}/messages"),
        ("POST", f"/conversations/{someone}/messages"),
        ("PUT", f"/conversations/{someone}/accept"),
        ("PUT", f"/conversations/{someone}/read"),
        ("DELETE", f"/conversations/{someone}"),
        ("DELETE", f"/messages/{someone}"),
    ):
        answer = client.request(method, path, json={"text": "Hi"})
        assert answer.status_code == 401, (method, path)


def test_a_deleted_account_takes_its_conversations(
    client: TestClient, database: Database
) -> None:
    ada, bob, cy = (signed_up(client, n) for n in ("ada", "bob", "cleo"))
    sent(client, ada, bob, "Hi Bob")
    sent(client, bob, ada, "Hi Ada")
    sent(client, bob, cy, "Hi Cleo")
    assert client.delete("/me", headers=ada).status_code == 204
    assert names(client, bob) == ["cleo"]
    assert [r["text"] for r in rows(database, "SELECT text FROM messages")] == [
        "Hi Cleo"
    ]
    assert len(rows(database, "SELECT 1 FROM conversation_members")) == 2


# --- Push notifications ---


def test_each_message_is_told_and_a_request_once_a_day(
    client: TestClient, expo: FakeExpo
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    for headers, phone in ((ada, ADA_PHONE), (bob, BOB_PHONE)):
        assert put_token(client, headers, phone).status_code == 204
        push_on(client, headers)
    sent(client, ada, bob, "Hi! I loved your star.")
    assert [(m["to"], m["body"]) for m in expo.sent] == [
        (BOB_PHONE, "ada wants to send you a message.")
    ]
    assert expo.sent[0]["data"] == {
        "kind": "message_request",
        "public_id": pid(client, ada),
        "username": "ada",
    }
    # Deleted and written again the same day: not told again.
    cleared(client, bob, ada)
    sent(client, ada, bob, "Sorry, once more.")
    assert len(expo.sent) == 1
    # A reply is a message: told with its beginning, each one.
    sent(client, bob, ada, "Thanks! It was hard on the hill.")
    sent(client, bob, ada, "x" * 150)
    assert [(m["to"], m["body"]) for m in expo.sent[1:]] == [
        (ADA_PHONE, "bob: Thanks! It was hard on the hill."),
        (ADA_PHONE, "bob: " + "x" * 99 + "…"),
    ]
    assert expo.sent[1]["data"]["kind"] == "message"
