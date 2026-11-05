"""Every list an app reads leaves out what its header X-MuW-Reads does not
say (TASK-387, ADR-0328), in a real PostgreSQL: a request without the header
is an app of before, which reads running, cycling and paddling only."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_drawing_photos import SMALL, sent
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

from shaperoute_api.contests import Contests
from shaperoute_api.db import Database
from shaperoute_api.reads import EVERYTHING, OLD_APP, READS_HEADER, reads_from

FIXTURES = (
    Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "fixtures"
)
THIS_APP = json.loads((FIXTURES / "reads.json").read_text(encoding="utf-8"))["this_app"]
SNOW_KEY = "a1b2c3d4e5f60718"
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def reading(headers: Headers, kinds: str = THIS_APP) -> Headers:
    """The same account, from an app that says `kinds`."""
    return {**headers, READS_HEADER: kinds}


def posted(app: TestClient, headers: Headers, key: str, activity: str) -> str:
    """A run of `activity` published for everyone, its drawing's id."""
    saved(app, headers, key, activity=activity)
    return str(drawn(app, headers, key)["id"])


def three_posts(app: TestClient, headers: Headers) -> dict[str, str]:
    """A run, a walk and a day on the snow, published by `headers`: the
    activity of each drawing id."""
    return {
        posted(app, headers, KEY, "running"): "running",
        posted(app, headers, OTHER_KEY, "walking"): "walking",
        posted(app, headers, SNOW_KEY, "skiing"): "skiing",
    }


def activities_of(posts: list[dict[str, Any]]) -> list[str]:
    return sorted(post["activity"] for post in posts)


# --- The SQL on a real database ---


def test_what_has_no_track_is_read_only_by_who_says_trackless(
    database: Database,  # noqa: F811
) -> None:
    # No run is without a track yet (TASK-385 will allow it): the condition
    # is tried on rows of its own.
    rows = (
        "(VALUES ('running', ST_GeomFromText('POINT(11 46)', 4326)),"
        " ('running', NULL::geometry), ('walking', NULL::geometry),"
        " ('skiing', ST_GeomFromText('POINT(11 46)', 4326))) AS r(activity, track)"
    )

    def kept(kinds: list[str]) -> list[tuple[str, bool]]:
        where = reads_from(kinds).sql("r.activity", "r.track IS NOT NULL")
        with database.connect() as conn:
            return [
                (row["activity"], row["tracked"])
                for row in conn.execute(
                    f"SELECT r.activity, r.track IS NOT NULL AS tracked FROM {rows}"
                    f" WHERE {where} ORDER BY 1, 2"
                )
            ]

    assert kept([]) == [("running", True)]
    assert kept(["walking"]) == [("running", True)]
    assert kept(["trackless"]) == [("running", False), ("running", True)]
    assert kept(["walking,skiing,trackless"]) == [
        ("running", False),
        ("running", True),
        ("skiing", True),
        ("walking", False),
    ]


# --- The feed and the search ---


@pytest.mark.parametrize("tab", [None, "all", "following"])
def test_the_feed_holds_only_the_activities_the_app_reads(
    client: TestClient, tab: str | None  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    follows(client, reader, me)
    three_posts(client, me)
    query = {} if tab is None else {"filter": tab}

    def feed(headers: Headers) -> list[str]:
        answer = client.get("/feed", params=query, headers=headers)
        assert answer.status_code == 200, answer.text
        return activities_of(answer.json()["posts"])

    assert feed(reader) == ["running"]
    assert feed(reading(reader, "walking")) == ["running", "walking"]
    assert feed(reading(reader)) == ["running", "skiing", "walking"]
    # Its owner too, from an older app on another phone.
    assert feed(me) == ["running"]


def test_a_page_of_the_feed_stays_full_without_what_the_app_does_not_read(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    three_posts(client, me)
    answer = client.get("/feed", params={"limit": 1}, headers=reader)
    assert activities_of(answer.json()["posts"]) == ["running"]
    assert answer.json()["next"] is None


def test_the_search_finds_only_the_activities_the_app_reads(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    three_posts(client, me)

    def found(headers: Headers, **query: Any) -> list[str]:
        answer = client.get("/search/drawings", params=query, headers=headers)
        assert answer.status_code == 200, answer.text
        return activities_of(answer.json()["posts"])

    assert found(reader) == ["running"]
    # Asking for a sport the app does not read finds nothing.
    assert found(reader, activity="skiing") == []
    assert found(reading(reader, "SKIING")) == ["running", "skiing"]
    assert found(reading(reader)) == ["running", "skiing", "walking"]


# --- Contests ---


def test_a_contest_shows_only_the_posts_the_app_reads_keeping_their_places(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    contest = Contests(database, wall).open(wall.t, wall.t + timedelta(days=7))
    me, reader, fan = signed_up(client), other(client), third(client)
    wall.t += timedelta(minutes=1)
    walk = posted(client, me, OTHER_KEY, "walking")
    wall.t += timedelta(minutes=1)
    run = posted(client, me, KEY, "running")
    # The walk leads: one reaction more.
    client.put(f"/drawings/{walk}/reaction", json={"kind": "fire"}, headers=fan)

    def top(headers: Headers) -> list[tuple[int, str]]:
        answer = client.get("/contests/current", headers=headers)
        assert answer.status_code == 200, answer.text
        return [(e["rank"], e["drawing"]["id"]) for e in answer.json()["top"]]

    def gallery(headers: Headers) -> list[tuple[int, str]]:
        answer = client.get(f"/contests/{contest.id}/entries", headers=headers)
        assert answer.status_code == 200, answer.text
        return [(e["rank"], e["drawing"]["id"]) for e in answer.json()["entries"]]

    assert top(reader) == [(2, run)]
    assert top(reading(reader)) == [(1, walk), (2, run)]
    assert gallery(reader) == [(2, run)]
    assert gallery(reading(reader, "walking")) == [(1, walk), (2, run)]

    wall.t += timedelta(days=8)
    Contests(database, wall).close()

    def winner(headers: Headers, path: str) -> Any:
        answer = client.get(path, params={"state": "closed"}, headers=headers)
        assert answer.status_code == 200, answer.text
        body = answer.json()
        return (body if "winner" in body else body["contests"][0])["winner"]

    for path in ("/contests/current", "/contests"):
        assert winner(reader, path)["drawing"] is None
        assert winner(reader, path)["reactions"] == 1
        assert winner(reading(reader), path)["drawing"]["id"] == walk


# --- Group runs ---


def group_run(
    app: TestClient, headers: Headers, clock: WallClock, **changes: Any
) -> str:
    answer = app.post(
        "/group-runs",
        json={
            **_load("group-run-request.json"),
            "starts_at": (clock.t + timedelta(days=1)).isoformat(),
            **changes,
        },
        headers=headers,
    )
    assert answer.status_code == 201, answer.text
    return str(answer.json()["id"])


def test_a_group_run_of_an_activity_the_app_does_not_read_is_not_there(
    client: TestClient, wall: WallClock  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    group_run(client, me, wall, title="Run")
    walk = group_run(client, me, wall, title="Walk", activity="walking")
    group_run(client, me, wall, title="Swim", activity="swimming")

    def row(headers: Headers) -> list[str]:
        answer = client.get("/group-runs", headers=headers)
        assert answer.status_code == 200, answer.text
        return sorted(g["title"] for g in answer.json()["group_runs"])

    def of_profile(headers: Headers) -> list[str]:
        answer = client.get(
            f"/users/{public_id(client, me)}/group-runs", headers=headers
        )
        assert answer.status_code == 200, answer.text
        return sorted(g["title"] for g in answer.json()["upcoming"])

    for listed in (row, of_profile):
        assert listed(reader) == ["Run"]
        assert listed(reading(reader, "swimming")) == ["Run", "Swim"]
        assert listed(reading(reader)) == ["Run", "Swim", "Walk"]
    for path in (f"/group-runs/{walk}", f"/group-runs/{walk}/going"):
        assert client.get(path, headers=reader).status_code == 404
        assert client.get(path, headers=reading(reader, "swimming")).status_code == 404
        assert client.get(path, headers=reading(reader)).status_code == 200


# --- Messages ---


def test_a_drawing_in_a_message_the_app_does_not_read_is_its_label(
    client: TestClient, wall: WallClock  # noqa: F811
) -> None:
    ada, bob = signed_up(client), other(client)
    to_bob = f"/conversations/{public_id(client, bob)}/messages"
    assert client.post(to_bob, json={"text": "Hi"}, headers=ada).is_success
    accepted = client.put(
        f"/conversations/{public_id(client, ada)}/accept", headers=bob
    )
    assert accepted.is_success
    wall.t += timedelta(minutes=1)
    walk = {**_load("favorite-request.json"), "activity": "walking"}
    answer = client.post(
        to_bob,
        params={"with": "attachments"},
        json={"text": "Try it", "attachment": {"drawing": walk}},
        headers=ada,
    )
    assert answer.status_code == 201, answer.text
    message_id = answer.json()["id"]
    with_ = {"with": "attachments"}

    def last(headers: Headers) -> tuple[str, Any]:
        page = client.get(
            f"/conversations/{public_id(client, ada)}/messages",
            params=with_,
            headers=headers,
        ).json()
        first = page["messages"][0]
        listed = client.get("/me/conversations", params=with_, headers=headers)
        assert listed.json()["conversations"][0]["last"] == first
        attachment = first["attachment"]
        return first["text"], None if attachment is None else attachment["kind"]

    assert last(bob) == ("[Drawing] Try it", None)
    assert last(reading(bob, "skiing")) == ("[Drawing] Try it", None)
    assert last(reading(bob)) == ("Try it", "drawing")
    whole = f"/messages/{message_id}/drawing"
    assert client.get(whole, headers=bob).status_code == 404
    assert client.get(whole, headers=reading(bob)).json()["activity"] == "walking"


# --- The owner's lists, from an older app on another phone ---


def test_the_favorites_hold_only_the_activities_the_app_reads(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    request = _load("favorite-request.json")
    for key, activity in ((KEY, "running"), (OTHER_KEY, "swimming")):
        moved = [[lat + 0.001, lon] for lat, lon in request["points"]]
        points = request["points"] if activity == "running" else moved
        answer = client.put(
            f"/me/favorites/{key}",
            json={**request, "points": points, "activity": activity},
            headers=me,
        )
        assert answer.status_code == 201, answer.text

    def kept(headers: Headers) -> list[str]:
        answer = client.get("/me/favorites", headers=headers)
        assert answer.status_code == 200, answer.text
        return sorted(f["activity"] for f in answer.json()["favorites"])

    assert kept(me) == ["running"]
    assert kept(reading(me, "walking")) == ["running"]
    assert kept(reading(me)) == ["running", "swimming"]


def test_my_activities_hold_only_the_activities_the_app_reads(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    three_posts(client, me)

    def mine(headers: Headers) -> tuple[list[str], int]:
        answer = client.get("/me/activities", headers=headers)
        assert answer.status_code == 200, answer.text
        body = answer.json()
        return activities_of(body["activities"]), body["total"]

    assert mine(me) == (["running"], 3)
    assert mine(reading(me, "xc_skiing,skiing")) == (["running", "skiing"], 3)
    assert mine(reading(me)) == (["running", "skiing", "walking"], 3)


# --- What opens a drawing: the photos of a profile, the bell ---


def test_the_photos_of_a_profile_are_of_the_drawings_the_app_reads(
    client: TestClient,  # noqa: F811
) -> None:
    me, reader = signed_up(client), other(client)
    posts = three_posts(client, me)
    for key in (KEY, OTHER_KEY, SNOW_KEY):
        answer = client.put(
            f"/me/activities/{key}/drawing/photos/1", json=sent(SMALL), headers=me
        )
        assert answer.status_code == 200, answer.text

    def photos(headers: Headers) -> list[str]:
        answer = client.get(f"/users/{public_id(client, me)}/photos", headers=headers)
        assert answer.status_code == 200, answer.text
        return sorted(posts[p["drawing_id"]] for p in answer.json()["photos"])

    assert photos(reader) == ["running"]
    assert photos(reading(reader, "skiing,xc_skiing")) == ["running", "skiing"]
    assert photos(reading(reader)) == ["running", "skiing", "walking"]


def test_the_bell_leaves_out_what_opens_a_drawing_the_app_does_not_read(
    client: TestClient,  # noqa: F811
) -> None:
    me, fan = signed_up(client), other(client)
    posts = three_posts(client, me)
    for drawing in posts:
        answer = client.put(
            f"/drawings/{drawing}/reaction", json={"kind": "fire"}, headers=fan
        )
        assert answer.is_success, answer.text
    client.post(f"/users/{public_id(client, me)}/follow", headers=fan)

    def bell(headers: Headers) -> tuple[list[str], int]:
        answer = client.get("/notifications", headers=headers)
        assert answer.status_code == 200, answer.text
        body = answer.json()
        opened = sorted(
            posts[line["opens"]["drawing_id"]]
            for line in body["notifications"]
            if "drawing_id" in line["opens"]
        )
        return opened, body["unread"]

    # The follow request has no drawing: every app reads it.
    assert bell(me) == (["running"], 2)
    assert bell(reading(me, "walking")) == (["running", "walking"], 3)
    assert bell(reading(me)) == (["running", "skiing", "walking"], 4)


def test_the_api_itself_sees_everything() -> None:
    assert OLD_APP.activities == EVERYTHING.activities[:3]
    assert EVERYTHING.trackless
