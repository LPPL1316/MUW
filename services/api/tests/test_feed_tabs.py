"""The tabs of «Feed» in a real PostgreSQL (TASK-362, ADR-0308): `filter=all`
and `filter=following`, the last published first, on the server."""

from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient
from test_drawings import (
    FIXTURES,
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
from test_feed import MINUTE, TRENTO, feed, fourth, keys, titles

from shaperoute_api.feed import FollowingFeedBody


def published(
    app: TestClient,
    clock: WallClock,
    who: dict[str, str],
    key: str,
    title: str,
    **fields: Any,
) -> None:
    """A drawing of `who`, a minute after the last."""
    saved(app, who, key)
    drawn(app, who, key, title=title, **fields)
    clock.t += MINUTE


def test_the_example_is_the_body() -> None:
    page = json.loads((FIXTURES / "feed-following.json").read_text(encoding="utf-8"))
    assert set(page) == set(FollowingFeedBody.model_fields)
    FollowingFeedBody.model_validate(page)


def test_an_unknown_filter_is_refused(client: TestClient) -> None:  # noqa: F811
    answer = client.get("/feed", params={"filter": "mine"}, headers=signed_up(client))
    assert answer.status_code == 422


def test_all_is_what_everyone_may_see_the_last_published_first(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend, stranger = signed_up(client), other(client), third(client)
    follows(client, me, friend)
    published(client, wall, stranger, KEY, "Stranger old")
    published(client, wall, me, KEY, "Mine")
    published(client, wall, friend, KEY, "Friend")
    published(client, wall, stranger, OTHER_KEY, "Stranger new")
    # Neither for the followers, not even to a follower, nor private.
    published(client, wall, friend, OTHER_KEY, "Followers", visibility="followers")
    published(client, wall, me, OTHER_KEY, "Private", visibility="only_me")
    page = feed(client, me, filter="all")
    assert titles(page) == ["Stranger new", "Friend", "Mine", "Stranger old"]
    assert "follows_anyone" not in page


def test_all_does_not_care_where_the_phone_is(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, stranger = signed_up(client), other(client)
    published(client, wall, stranger, KEY, "Anywhere")
    far = (TRENTO[0] + 5.0, TRENTO[1])
    # Without the tab a drawing this far is out; with it, it is there.
    assert titles(feed(client, me, lat=far[0], lon=far[1])) == []
    assert titles(feed(client, me, filter="all", lat=far[0], lon=far[1])) == [
        "Anywhere"
    ]


def test_following_with_follows_is_theirs_and_the_readers_own(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend, stranger = signed_up(client), other(client), third(client)
    follows(client, me, friend)
    published(client, wall, friend, KEY, "Friend old")
    published(client, wall, stranger, KEY, "Stranger")
    published(client, wall, me, KEY, "Mine")
    published(client, wall, friend, OTHER_KEY, "For followers", visibility="followers")
    published(client, wall, me, OTHER_KEY, "Private", visibility="only_me")
    page = feed(client, me, filter="following")
    assert titles(page) == ["For followers", "Mine", "Friend old"]
    assert page["follows_anyone"] is True


def test_following_without_follows_is_only_the_readers_own(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, stranger = signed_up(client), other(client)
    published(client, wall, stranger, KEY, "Stranger")
    page = feed(client, me, filter="following")
    assert titles(page) == []
    assert page["follows_anyone"] is False
    published(client, wall, me, KEY, "Mine")
    page = feed(client, me, filter="following")
    assert titles(page) == ["Mine"]
    assert page["follows_anyone"] is False


def test_a_request_still_pending_is_not_following(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, asked = signed_up(client), other(client)
    follows(client, me, asked, accepted=False)
    published(client, wall, asked, KEY, "Theirs")
    page = feed(client, me, filter="following")
    assert titles(page) == []
    assert page["follows_anyone"] is False


def test_follows_without_posts_says_so(client: TestClient) -> None:  # noqa: F811
    me, friend = signed_up(client), other(client)
    follows(client, me, friend)
    page = feed(client, me, filter="following")
    assert titles(page) == []
    assert page["follows_anyone"] is True


def test_who_stops_following_stops_reading_at_once(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend = signed_up(client), other(client)
    follows(client, me, friend)
    published(client, wall, friend, KEY, "Friend")
    assert titles(feed(client, me, filter="following")) == ["Friend"]
    gone = client.delete(f"/users/{public_id(client, friend)}/follow", headers=me)
    assert gone.status_code == 204
    page = feed(client, me, filter="following")
    assert titles(page) == []
    assert page["follows_anyone"] is False


def test_a_block_takes_the_drawings_out_of_both_tabs(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend = signed_up(client), other(client)
    follows(client, me, friend)
    published(client, wall, friend, KEY, "Friend")
    blocked = client.put(f"/users/{public_id(client, friend)}/block", headers=me)
    assert blocked.status_code == 204, blocked.text
    assert titles(feed(client, me, filter="following")) == []
    assert titles(feed(client, me, filter="all")) == []


def test_the_pages_are_filled_on_the_server_and_neither_repeat_nor_skip(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend, stranger = signed_up(client), other(client), fourth(client)
    follows(client, me, friend)
    # The friend's are the oldest: a filter on the phone would give empty pages.
    names = keys(6)
    for number, key in enumerate(names[:3]):
        published(client, wall, friend, key, f"Friend {number}")
    for number, key in enumerate(names[3:]):
        published(client, wall, stranger, key, f"Stranger {number}")
    first = feed(client, me, filter="following", limit=2)
    assert titles(first) == ["Friend 2", "Friend 1"]
    assert first["next"] is not None
    # Published between two pages: above the cursor, not repeated.
    published(client, wall, friend, "feedrun9999", "Friend late")
    second = feed(client, me, filter="following", limit=2, cursor=first["next"])
    assert titles(second) == ["Friend 0"]
    assert second["next"] is None
    assert titles(feed(client, me, filter="all", limit=4)) == [
        "Friend late",
        "Stranger 2",
        "Stranger 1",
        "Stranger 0",
    ]
