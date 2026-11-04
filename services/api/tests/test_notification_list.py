"""The bell's list (TASK-367 part C, ADR-0311): push.py's events kept for
the app, in a real PostgreSQL; what is shown, in which language, what is
left out, what the app opens, the pages, the reading and how long a row is
kept."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient
from test_drawings import (
    KEY,
    OTHER_KEY,
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

from shaperoute_api.db import Database
from shaperoute_api.notification_list import (
    BELL_KINDS,
    KEPT_DAYS,
    PAGE_SIZE,
    NotificationList,
    NotificationsBody,
    same_of,
)
from shaperoute_api.push import PushEvent

FIXTURES = (
    Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "fixtures"
)
CONTEST = UUID("6f2d0c4e-8a1b-4c3d-9e5f-0a1b2c3d4e5f")


def bell(app: TestClient, headers: dict[str, str], **query: Any) -> dict[str, Any]:
    answer = app.get("/notifications", params=query, headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def texts(app: TestClient, headers: dict[str, str]) -> list[str]:
    return [line["text"] for line in bell(app, headers)["notifications"]]


def posted(
    app: TestClient, headers: dict[str, str], key: str = KEY, **fields: Any
) -> str:
    """A drawing for everyone, its id."""
    saved(app, headers, key)
    return str(drawn(app, headers, key, **fields)["id"])


def user_id(database: Database, username: str) -> int:  # noqa: F811
    with database.connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE username = %s", (username,)
        ).fetchone()
    assert row is not None
    return int(row["id"])


def kept(database: Database) -> int:  # noqa: F811
    with database.connect() as conn:
        row = conn.execute("SELECT count(*) AS n FROM notifications").fetchone()
    assert row is not None
    return int(row["n"])


def test_the_kinds_are_the_push_s_but_the_messages() -> None:
    assert {
        "reaction",
        "comment",
        "tag",
        "contest_open",
        "group_run_soon",
    } <= BELL_KINDS
    assert not {"message", "message_request"} & BELL_KINDS


def test_the_events_of_the_people_are_the_list_newest_first(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
    mine = posted(client, me)
    # Push is off for everyone: the list is kept all the same.
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    wall.t += timedelta(minutes=1)
    follows(client, me, cleo)
    client.put(f"/drawings/{mine}/reaction", json={"kind": "fire"}, headers=bob)
    client.post(f"/drawings/{mine}/comments", json={"text": "Great run"}, headers=bob)
    posted(client, cleo, OTHER_KEY, tags=[public_id(client, me)])

    seen = bell(client, me)
    assert [line["text"] for line in seen["notifications"]] == [
        "third_runner tagged you in a post.",
        "other_runner commented on your post: Great run",
        "other_runner reacted 🔥 to your post.",
        "third_runner accepted your follow request.",
        "other_runner asked to follow you.",
    ]
    assert seen["unread"] == 5 and seen["before"] is None
    comment, follow = seen["notifications"][1], seen["notifications"][4]
    assert comment["kind"] == "comment" and comment["read"] is False
    assert comment["actor"]["username"] == "other_runner"
    assert comment["opens"] == {"kind": "comment", "drawing_id": mine}
    assert follow["opens"] == {
        "kind": "follow_request",
        "public_id": public_id(client, bob),
        "username": "other_runner",
    }
    # Nobody else was told anything; the one who acted neither.
    assert bell(client, bob)["notifications"] == []


def test_the_text_is_in_the_language_of_the_account(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client, language="it")
    bob = other(client)
    client.post(f"/users/{public_id(client, me)}/follow", headers=bob)
    assert texts(client, me) == ["other_runner ha chiesto di seguirti."]


def test_what_is_not_true_any_more_is_left_out(
    client: TestClient,  # noqa: F811
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
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
    assert len(texts(client, me)) == 1
    blocked = client.put(f"/users/{public_id(client, cleo)}/block", headers=me)
    assert blocked.status_code in (200, 204)
    assert bell(client, me) == {"notifications": [], "unread": 0, "before": None}


def test_a_tag_in_a_drawing_no_longer_seen_is_left_out(
    client: TestClient,  # noqa: F811
) -> None:
    me, cleo = signed_up(client), third(client)
    posted(client, cleo, tags=[public_id(client, me)])
    assert texts(client, me) == ["third_runner tagged you in a post."]
    drawn(client, cleo, visibility="followers", tags=[public_id(client, me)])
    assert texts(client, me) == []


def test_reading_marks_up_to_the_line_shown(
    client: TestClient,  # noqa: F811
) -> None:
    me, bob, cleo = signed_up(client), other(client), third(client)
    mine = posted(client, me)
    client.post(f"/drawings/{mine}/comments", json={"text": "One"}, headers=bob)
    shown = bell(client, me)["notifications"][0]["id"]
    # One more comes before the app says it read the list.
    client.post(f"/drawings/{mine}/comments", json={"text": "Two"}, headers=cleo)
    answer = client.post("/notifications/read", json={"up_to": shown}, headers=me)
    assert answer.status_code == 204
    seen = bell(client, me)
    assert [line["read"] for line in seen["notifications"]] == [False, True]
    assert seen["unread"] == 1
    # Nobody marks someone else's lines.
    client.post("/notifications/read", json={"up_to": 10**9}, headers=bob)
    assert bell(client, me)["unread"] == 1


def test_the_list_needs_an_account_and_a_good_body(
    client: TestClient,  # noqa: F811
) -> None:
    assert client.get("/notifications").status_code == 401
    me = signed_up(client)
    assert (
        client.get("/notifications", params={"before": 0}, headers=me).status_code
        == 422
    )
    for body in ({}, {"up_to": 0}, {"up_to": 1, "all": True}):
        answer = client.post("/notifications/read", json=body, headers=me)
        assert answer.status_code == 422, body


# --- Straight to the list, as push.py hands it the events ---


def test_the_same_event_again_takes_the_place_of_the_one_before(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, bob = signed_up(client), other(client)
    mine = UUID(posted(client, me))
    client.put(f"/drawings/{mine}/reaction", json={"kind": "fire"}, headers=bob)
    first = bell(client, me)["notifications"][0]["id"]
    client.post("/notifications/read", json={"up_to": first}, headers=me)

    # The next day the reaction changes: push.py tells it again.
    wall.t += timedelta(days=1)
    client.put(f"/drawings/{mine}/reaction", json={"kind": "clap"}, headers=bob)
    rows = NotificationList(database, wall)
    me_id, bob_id = user_id(database, "Runner_42"), user_id(database, "other_runner")
    rows.record(PushEvent("reaction", bob_id, me_id, mine, "clap"))
    seen = bell(client, me)
    assert [line["text"] for line in seen["notifications"]] == [
        "other_runner reacted 👏 to your post."
    ]
    assert seen["notifications"][0]["id"] > first and seen["unread"] == 1
    assert kept(database) == 1


def test_an_own_event_says_its_words_and_opens_its_page(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me = signed_up(client, language="it")
    me_id = user_id(database, "Runner_42")
    names = {"en": "Animals", "it": "Animali"}
    NotificationList(database, wall).record(
        PushEvent("contest_open", me_id, me_id, names=names, contest_id=CONTEST)
    )
    (line,) = bell(client, me)["notifications"]
    assert "Animali" in line["text"]
    assert line["opens"] == {"kind": "contest_open", "contest_id": str(CONTEST)}
    assert line["actor"]["username"] == "Runner_42"


def test_the_messages_are_not_kept(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    signed_up(client), other(client)
    me_id, bob_id = user_id(database, "Runner_42"), user_id(database, "other_runner")
    rows = NotificationList(database, wall)
    rows.record(PushEvent("message", bob_id, me_id, text="Hi"))
    rows.record(PushEvent("message_request", bob_id, me_id))
    assert kept(database) == 0


def test_the_pages_go_back_with_before(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me = signed_up(client)
    me_id = user_id(database, "Runner_42")
    rows = NotificationList(database, wall)
    for n in range(PAGE_SIZE + 2):
        rows.record(PushEvent("piece_done", me_id, me_id, number=n + 1))
    first = bell(client, me)
    assert len(first["notifications"]) == PAGE_SIZE and first["unread"] == PAGE_SIZE + 2
    second = bell(client, me, before=first["before"])
    assert len(second["notifications"]) == 2 and second["before"] is None
    ids = [line["id"] for line in first["notifications"] + second["notifications"]]
    assert ids == sorted(ids, reverse=True) and len(set(ids)) == PAGE_SIZE + 2


def test_a_row_is_kept_kept_days(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me = signed_up(client)
    me_id = user_id(database, "Runner_42")
    rows = NotificationList(database, wall)
    rows.record(PushEvent("piece_done", me_id, me_id, number=1))
    wall.t += timedelta(days=KEPT_DAYS)
    # Not shown any more, and gone with the next row written.
    assert bell(client, me)["notifications"] == []
    rows.record(PushEvent("piece_done", me_id, me_id, number=2))
    assert kept(database) == 1


def test_two_events_of_a_kind_are_told_apart() -> None:
    a = PushEvent("piece_done", 1, 1, number=1)
    b = PushEvent("piece_done", 1, 1, number=2)
    assert same_of(a) != same_of(b)
    assert same_of(PushEvent("comment", 1, 2, key="c1")) != same_of(
        PushEvent("comment", 1, 2, key="c2")
    )


def test_the_fixture_is_an_answer() -> None:
    fixture = json.loads((FIXTURES / "notifications.json").read_text(encoding="utf-8"))
    NotificationsBody.model_validate(fixture)
