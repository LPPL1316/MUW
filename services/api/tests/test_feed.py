"""The feed in a real PostgreSQL (TASK-118, ADR-0227): the drawings the
reader may see, its own first, then those of the people it follows, then
the others' nearby, the last published first; never a private run; pages
that neither repeat nor skip a drawing published in between; a page of
twenty that stays light."""

from __future__ import annotations

import json
import re
from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient
from route_engine.geo import latlon_to_local, local_to_latlon
from test_drawings import (
    FIXTURES,
    KEY,
    OTHER_KEY,
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    code,
    database,  # noqa: F401
    drawn,
    follows,
    message,
    other,
    public_id,
    run,
    saved,
    signed_up,
    third,
    wall,  # noqa: F401
)

from shaperoute_api.activities import EPOCH, MICROSECOND
from shaperoute_api.drawings import AuthorBody, DrawingBody
from shaperoute_api.feed import (
    CURSOR_PATTERN,
    FOLLOWED,
    HALF_A_POINT,
    NEAR_M,
    OTHERS,
    OWN,
    PAGE_SIZE,
    FeedBody,
    FeedPostBody,
    _after_cursor,
)

# Trento, where the example run starts.
TRENTO = (46.0671, 11.1214)
# Past NEAR_M from it.
FAR_EAST_M = NEAR_M + 10_000
# What a page of twenty drawings may weigh (the acceptance of the task).
MAX_WEIGHT = 200_000
FULL_DESCRIPTION = "x" * 500
MINUTE = timedelta(minutes=1)


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def feed(app: TestClient, headers: dict[str, str], **query: Any) -> dict[str, Any]:
    answer = app.get("/feed", params=query, headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def titles(page: dict[str, Any]) -> list[str | None]:
    return [post["title"] for post in page["posts"]]


def moved(east_m: float) -> dict[str, Any]:
    """The example run moved `east_m` metres east on the plane around its
    start: its track and its planned route."""
    body = run()
    origin = tuple(body["track"][0]["point"])
    for fix in body["track"]:
        x_m, y_m = latlon_to_local(origin, tuple(fix["point"]))
        fix["point"] = list(local_to_latlon(origin, x_m + east_m, y_m))
    body["points"] = [fix["point"] for fix in body["track"]]
    return body


def fourth(app: TestClient) -> dict[str, str]:
    return signed_up(app, email="fourth@example.com", username="fourth_runner")


def keys(n: int) -> list[str]:
    return [f"feedrun{i:04d}" for i in range(n)]


def every_page(app: TestClient, headers: dict[str, str], limit: int) -> list[str]:
    """The titles of every page, read one after the other."""
    found: list[str] = []
    cursor: str | None = None
    while True:
        query = (
            {"limit": limit} if cursor is None else {"limit": limit, "cursor": cursor}
        )
        page = feed(app, headers, **query)
        found += [str(title) for title in titles(page)]
        cursor = page["next"]
        if cursor is None:
            return found


# --- The contract ---


def test_the_example_is_the_body() -> None:
    page = _load("feed.json")
    assert set(page) == set(FeedBody.model_fields)
    body = FeedBody.model_validate(page)
    assert len(body.posts) == 2
    # A post is a drawing of a profile's list, with its author.
    assert set(FeedPostBody.model_fields) == set(DrawingBody.model_fields) | {"author"}
    post = page["posts"][0]
    # Written before TASK-312: a post of a run of the app
    # (feed-imported.json, test_imported_runs.py).
    assert set(post) == set(FeedPostBody.model_fields) - {"source"}
    assert set(post["author"]) == set(AuthorBody.model_fields)
    assert post["author"] == _load("drawing-details.json")["author"]
    assert re.match(CURSOR_PATTERN, page["next"])
    tier, at, last = _after_cursor(page["next"])
    assert tier in (OWN, FOLLOWED, OTHERS)
    assert f"{tier}-{(at - EPOCH) // MICROSECOND}-{last.hex}" == page["next"]


# --- Who sees what, in which order ---


def test_the_feed_wants_a_token(client: TestClient) -> None:  # noqa: F811
    assert client.get("/feed").status_code == 401


def test_own_first_then_followed_then_the_others_each_newest_first(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend, stranger = signed_up(client), other(client), third(client)
    follows(client, me, friend)
    # Published in this order, a minute apart.
    for who, key, title in [
        (stranger, KEY, "Stranger one"),
        (me, KEY, "Mine, older"),
        (friend, KEY, "Friend one"),
        (stranger, OTHER_KEY, "Stranger two"),
        (me, OTHER_KEY, "Mine, newer"),
        (friend, OTHER_KEY, "Friend two"),
    ]:
        saved(client, who, key)
        drawn(client, who, key, title=title)
        wall.t += MINUTE
    page = feed(client, me)
    assert titles(page) == [
        "Mine, newer",
        "Mine, older",
        "Friend two",
        "Friend one",
        "Stranger two",
        "Stranger one",
    ]
    assert page["next"] is None
    # Each post is the drawing as the profile lists it, with its author.
    mine = page["posts"][0]
    assert mine["author"] == {
        "public_id": public_id(client, me),
        "username": _load("sign-up-request.json")["username"],
    }
    assert mine["visibility"] == "everyone"
    assert mine["published_at"] is not None
    assert 2 <= len(mine["track_preview"]) <= 64
    assert "track" not in mine
    # The stranger, who follows nobody, reads its own, then the others' as
    # they were published.
    assert titles(feed(client, stranger)) == [
        "Stranger two",
        "Stranger one",
        "Friend two",
        "Mine, newer",
        "Friend one",
        "Mine, older",
    ]


def test_never_a_private_drawing_nor_one_for_followers_the_reader_is_not(
    client: TestClient,  # noqa: F811
) -> None:
    me, author, asking = signed_up(client), other(client), third(client)
    saved(client, author, KEY)
    drawn(client, author, KEY, title="For my followers", visibility="followers")
    saved(client, author, OTHER_KEY)
    drawn(client, author, OTHER_KEY, title="Only me", visibility="only_me")
    # A run never given a drawing is private too.
    saved(client, me, KEY)
    # A request still pending gives nothing.
    follows(client, asking, author, accepted=False)
    assert titles(feed(client, me)) == []
    assert titles(feed(client, asking)) == []
    # Its owner reads what it published, never its private runs.
    assert titles(feed(client, author)) == ["For my followers"]
    # A follower, once accepted, reads what is for the followers.
    follows(client, me, author)
    assert titles(feed(client, me)) == ["For my followers"]
    # Unfollowed, it goes at once.
    gone = client.delete(f"/users/{public_id(client, author)}/follow", headers=me)
    assert gone.status_code == 204
    assert titles(feed(client, me)) == []


def test_a_run_made_private_again_leaves_the_feed(
    client: TestClient,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    saved(client, author, KEY)
    drawn(client, author, KEY, title="Here today")
    assert titles(feed(client, me)) == ["Here today"]
    drawn(client, author, KEY, title="Here today", visibility="only_me")
    assert titles(feed(client, me)) == []


# --- Nearby ---


def test_with_the_phone_s_point_the_others_drawings_are_the_nearby_ones(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, friend, stranger = signed_up(client), other(client), third(client)
    follows(client, me, friend)
    # Published in this order, a minute apart.
    for who, key, title, east_m in [
        (stranger, KEY, "Stranger near", 0.0),
        (stranger, OTHER_KEY, "Stranger far", FAR_EAST_M),
        (friend, KEY, "Friend far", FAR_EAST_M),
        (me, KEY, "Mine far", FAR_EAST_M),
    ]:
        saved(client, who, key, **moved(east_m))
        drawn(client, who, key, title=title)
        wall.t += MINUTE
    # From Trento: mine and my friend's wherever they are, the stranger's
    # only nearby.
    near = feed(client, me, lat=TRENTO[0], lon=TRENTO[1])
    assert titles(near) == ["Mine far", "Friend far", "Stranger near"]
    # From where the far runs are, the other way round.
    there = moved(FAR_EAST_M)["track"][0]["point"]
    assert titles(feed(client, me, lat=there[0], lon=there[1])) == [
        "Mine far",
        "Friend far",
        "Stranger far",
    ]
    # Without a point, nothing is far.
    assert titles(feed(client, me)) == [
        "Mine far",
        "Friend far",
        "Stranger far",
        "Stranger near",
    ]
    # Half a point is refused, as one off the earth.
    answer = client.get("/feed", params={"lat": TRENTO[0]}, headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert message(answer) == HALF_A_POINT
    off = client.get("/feed", params={"lat": 91, "lon": 0}, headers=me)
    assert off.status_code == 422


# --- The pages ---


def test_two_pages_neither_repeat_nor_skip_a_drawing_published_in_between(
    client: TestClient,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    for i, key in enumerate(keys(5)):
        saved(client, author, key)
        drawn(client, author, key, title=f"Post {i}")
        wall.t += MINUTE
    first = feed(client, me, limit=2)
    assert titles(first) == ["Post 4", "Post 3"]
    assert re.match(CURSOR_PATTERN, first["next"])
    # Two more arrive between the pages: the author's, the newest, and one
    # of mine, in the group above.
    saved(client, author, "feedrunnew")
    drawn(client, author, "feedrunnew", title="Post 5")
    saved(client, me, KEY)
    drawn(client, me, KEY, title="Mine")
    wall.t += MINUTE
    second = feed(client, me, limit=2, cursor=first["next"])
    assert titles(second) == ["Post 2", "Post 1"]
    last = feed(client, me, limit=2, cursor=second["next"])
    assert titles(last) == ["Post 0"]
    assert last["next"] is None
    # Read again from the top, the new ones are at the top of their groups.
    assert every_page(client, me, limit=20) == [
        "Mine",
        "Post 5",
        "Post 4",
        "Post 3",
        "Post 2",
        "Post 1",
        "Post 0",
    ]
    # The cursor goes on across the groups too.
    friend = third(client)
    follows(client, me, friend)
    saved(client, friend, KEY)
    drawn(client, friend, KEY, title="Friend")
    assert every_page(client, me, limit=3) == [
        "Mine",
        "Friend",
        "Post 5",
        "Post 4",
        "Post 3",
        "Post 2",
        "Post 1",
        "Post 0",
    ]


def test_the_limit_and_the_cursor_are_checked(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    for query in [
        {"limit": 0},
        {"limit": 51},
        {"cursor": "3-1-" + "0" * 32},
        {"cursor": "1-1-abc"},
    ]:
        assert client.get("/feed", params=query, headers=me).status_code == 422
    assert PAGE_SIZE == 20


def long_run(
    n: int, length_m: float = 21_000.0, step_m: float = 100.0
) -> dict[str, Any]:
    """A run of `length_m` north from Trento, a fix every `step_m` at a
    steady pace, the `n`th a little east so the runs differ."""
    count = round(length_m / step_m)
    points = [local_to_latlon(TRENTO, n * 10.0, i * step_m) for i in range(count + 1)]
    return {
        "track": [
            {
                "point": list(point),
                "time_ms": 1_790_000_000_000 + i * 30_000,
                "accuracy_m": 6.0,
            }
            for i, point in enumerate(points)
        ],
        "pauses": [],
        "points": None,
        "similarity": None,
        "shape": None,
        "word": None,
        "style": None,
        "title": "Twenty-one kilometres",
    }


def test_a_page_of_twenty_drawings_of_21_km_weighs_under_200_kb(
    client: TestClient,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    tagged = [public_id(client, third(client)), public_id(client, fourth(client))]
    for i, key in enumerate(keys(PAGE_SIZE + 1)):
        answer = client.put(f"/me/activities/{key}", json=long_run(i), headers=author)
        assert answer.status_code == 201, answer.text
        assert answer.json()["distance_m"] >= 20_900
        drawn(
            client,
            author,
            key,
            title="T" * 60,
            description=FULL_DESCRIPTION,
            tags=tagged,
        )
    answer = client.get("/feed", headers=me)
    assert answer.status_code == 200
    page = answer.json()
    assert len(page["posts"]) == PAGE_SIZE
    assert page["next"] is not None
    assert all(len(post["track_preview"]) <= 64 for post in page["posts"])
    assert len(answer.content) < MAX_WEIGHT, len(answer.content)
