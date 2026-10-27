"""Blocking and reporting in a real PostgreSQL (TASK-121, ADR-0228): a block
keeps two members apart both ways, in the feed, the comments, the
reactions, the search, the follows and the profile; it ends every follow
between them; done twice or undone when not there it changes nothing. A
report is kept once for each reporter and thing. Deleting an account takes
its blocks and its reports."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, get_args
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_drawings import (
    FIXTURES,
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    code,
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

from shaperoute_api.app import create_app
from shaperoute_api.db import Database, migrations
from shaperoute_api.follows import NO_PROFILE, PeoplePageBody
from shaperoute_api.moderation import (
    NOT_YOURSELF_BLOCK,
    NOT_YOURSELF_REPORT,
    NOTHING_TO_REPORT,
    REPORT_KINDS,
    REPORT_REASONS,
    ReportReason,
    ReportRequestBody,
)

# The migration of blocks and reports, whatever its number when merged.
(MODERATION,) = [p for p in migrations() if p.name.endswith("_moderation.sql")]
# The private messages add their kind to the list (TASK-311).
(MESSAGES,) = [p for p in migrations() if p.name.endswith("_messages.sql")]
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def block(app: TestClient, who: Headers, whom: Headers, status: int = 204) -> None:
    answer = app.put(f"/users/{public_id(app, whom)}/block", headers=who)
    assert answer.status_code == status, answer.text


def unblock(app: TestClient, who: Headers, whom: Headers) -> None:
    answer = app.delete(f"/users/{public_id(app, whom)}/block", headers=who)
    assert answer.status_code == 204, answer.text


def post_of(app: TestClient, headers: Headers, title: str = "Sunday star") -> str:
    """A drawing published for everyone; its id."""
    saved(app, headers)
    return str(drawn(app, headers, title=title)["id"])


def feed_titles(app: TestClient, headers: Headers) -> list[str]:
    answer = app.get("/feed", headers=headers)
    assert answer.status_code == 200, answer.text
    return [post["title"] for post in answer.json()["posts"]]


def comment(app: TestClient, headers: Headers, drawing_id: str, text: str) -> int:
    return app.post(
        f"/drawings/{drawing_id}/comments", json={"text": text}, headers=headers
    ).status_code


def comment_texts(app: TestClient, headers: Headers, drawing_id: str) -> Any:
    answer = app.get(f"/drawings/{drawing_id}/comments", headers=headers)
    assert answer.status_code == 200, answer.text
    body = answer.json()
    # Sorted: the test clock writes them all at the same moment.
    return sorted(c["text"] for c in body["comments"]), body["total"]


def react(app: TestClient, headers: Headers, drawing_id: str, kind: str) -> int:
    return app.put(
        f"/drawings/{drawing_id}/reaction", json={"kind": kind}, headers=headers
    ).status_code


def found(app: TestClient, headers: Headers, q: str) -> list[str]:
    answer = app.get("/users", params={"q": q}, headers=headers)
    assert answer.status_code == 200, answer.text
    return [person["username"] for person in answer.json()["people"]]


def report(
    app: TestClient, headers: Headers, kind: str, target: str, reason: str = "spam"
) -> Any:
    return app.post(
        "/reports",
        json={"kind": kind, "id": target, "reason": reason},
        headers=headers,
    )


def rows(db: Database, query: str, *values: Any) -> list[dict[str, Any]]:
    with db.connect() as conn:
        return [dict(row) for row in conn.execute(query, values).fetchall()]


# --- The contract ---


def test_the_example_is_the_body() -> None:
    body = _load("report-request.json")
    assert set(body) == set(ReportRequestBody.model_fields)
    ReportRequestBody.model_validate(body)


def test_the_migration_holds_the_same_lists() -> None:
    sql = MODERATION.read_text(encoding="utf-8")
    kinds = MESSAGES.read_text(encoding="utf-8")
    for kind in REPORT_KINDS:
        assert f"'{kind}'" in kinds
    for reason in REPORT_REASONS:
        assert f"'{reason}'" in sql
    assert REPORT_REASONS == get_args(ReportReason)


def test_a_reason_off_the_list_is_refused(client: TestClient) -> None:  # noqa: F811
    me = signed_up(client)
    you = other(client)
    answer = report(client, me, "user", public_id(client, you), "boring")
    assert answer.status_code == 422


def test_every_endpoint_wants_a_token(client: TestClient) -> None:  # noqa: F811
    me = signed_up(client)
    target = public_id(client, me)
    for answer in (
        client.put(f"/users/{target}/block"),
        client.delete(f"/users/{target}/block"),
        client.get("/me/blocked"),
        client.post("/reports", json=_load("report-request.json")),
    ):
        assert answer.status_code == 401
        assert code(answer) == "not_signed_in"


def test_without_a_database_they_are_unavailable() -> None:
    app = TestClient(create_app(FileSource(Path("unused.graphml"))))
    token = {"Authorization": "Bearer x"}
    for answer in (
        app.put(f"/users/{uuid4()}/block", headers=token),
        app.get("/me/blocked", headers=token),
        app.post("/reports", json=_load("report-request.json"), headers=token),
    ):
        assert answer.status_code == 503
        assert code(answer) == "accounts_unavailable"


# --- A block keeps two apart, both ways ---


@pytest.mark.parametrize("blocker", ["me", "you"])
def test_the_feed_hides_either_side(
    client: TestClient, blocker: str  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    post_of(client, me, "Mine")
    post_of(client, you, "Yours")
    assert feed_titles(client, me) == ["Mine", "Yours"]
    who, whom = (me, you) if blocker == "me" else (you, me)
    block(client, who, whom)
    assert feed_titles(client, me) == ["Mine"]
    assert feed_titles(client, you) == ["Yours"]
    unblock(client, who, whom)
    assert feed_titles(client, me) == ["Mine", "Yours"]


@pytest.mark.parametrize("blocker", ["owner", "reader"])
def test_comments_hide_either_side(
    client: TestClient, blocker: str  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    friend = third(client)
    drawing_id = post_of(client, owner)
    assert comment(client, reader, drawing_id, "From the reader") == 201
    assert comment(client, friend, drawing_id, "From a friend") == 201
    who, whom = (owner, reader) if blocker == "owner" else (reader, owner)
    block(client, who, whom)
    # The owner no longer reads the reader's comment, nor counts it.
    assert comment_texts(client, owner, drawing_id) == (["From a friend"], 1)
    # The reader no longer opens the owner's drawing, nor writes under it.
    answer = client.get(f"/drawings/{drawing_id}/comments", headers=reader)
    assert answer.status_code == 404
    assert comment(client, reader, drawing_id, "Still here?") == 404
    # Somebody else still sees both.
    assert comment_texts(client, friend, drawing_id) == (
        ["From a friend", "From the reader"],
        2,
    )


def test_a_block_between_two_readers_hides_their_comments(
    client: TestClient,  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    friend = third(client)
    drawing_id = post_of(client, owner)
    assert comment(client, reader, drawing_id, "From the reader") == 201
    assert comment(client, friend, drawing_id, "From a friend") == 201
    block(client, friend, reader)
    assert comment_texts(client, friend, drawing_id) == (["From a friend"], 1)
    assert comment_texts(client, reader, drawing_id) == (["From the reader"], 1)
    assert comment_texts(client, owner, drawing_id)[1] == 2


def test_reactions_hide_either_side(client: TestClient) -> None:  # noqa: F811
    owner = signed_up(client)
    reader = other(client)
    friend = third(client)
    drawing_id = post_of(client, owner)
    assert react(client, reader, drawing_id, "fire") == 200
    assert react(client, friend, drawing_id, "clap") == 200
    block(client, friend, reader)
    seen = client.get(f"/drawings/{drawing_id}/reactions", headers=friend).json()
    assert seen["total"] == 1
    assert seen["counts"]["fire"] == 0
    assert seen["counts"]["clap"] == 1
    # The owner, outside the block, counts both.
    seen = client.get(f"/drawings/{drawing_id}/reactions", headers=owner).json()
    assert seen["total"] == 2
    # Blocked by the owner, the reader neither reads nor leaves any.
    block(client, owner, reader)
    answer = client.get(f"/drawings/{drawing_id}/reactions", headers=reader)
    assert answer.status_code == 404
    assert react(client, reader, drawing_id, "wow") == 404
    seen = client.get(f"/drawings/{drawing_id}/reactions", headers=owner).json()
    assert seen["total"] == 1


@pytest.mark.parametrize("blocker", ["me", "you"])
def test_the_search_hides_either_side(
    client: TestClient, blocker: str  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    third(client)
    assert found(client, me, "runner") == ["other_runner", "third_runner"]
    who, whom = (me, you) if blocker == "me" else (you, me)
    block(client, who, whom)
    assert found(client, me, "runner") == ["third_runner"]
    assert "Runner_42" not in found(client, you, "runner")
    unblock(client, who, whom)
    assert found(client, me, "runner") == ["other_runner", "third_runner"]


@pytest.mark.parametrize("blocker", ["me", "you"])
def test_the_profile_is_not_there_either_side(
    client: TestClient, blocker: str  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    who, whom = (me, you) if blocker == "me" else (you, me)
    block(client, who, whom)
    for headers, wanted in ((me, you), (you, me)):
        answer = client.get(f"/users/{public_id(client, wanted)}", headers=headers)
        assert answer.status_code == 404
    unblock(client, who, whom)
    answer = client.get(f"/users/{public_id(client, you)}", headers=me)
    assert answer.status_code == 200


@pytest.mark.parametrize("blocker", ["owner", "reader"])
def test_the_drawing_and_the_profiles_drawings_are_not_there_either_side(
    client: TestClient, blocker: str  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    drawing_id = post_of(client, owner)
    owner_id = public_id(client, owner)
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 200
    page = client.get(f"/users/{owner_id}/drawings", headers=reader).json()
    assert page["total"] == 1
    who, whom = (owner, reader) if blocker == "owner" else (reader, owner)
    block(client, who, whom)
    # As for an id that is not there, whoever made the block.
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 404
    answer = client.get(f"/users/{owner_id}/drawings", headers=reader)
    assert answer.status_code == 404
    # The owner keeps its own, and its profile lists it.
    assert client.get(f"/drawings/{drawing_id}", headers=owner).status_code == 200
    page = client.get(f"/users/{owner_id}/drawings", headers=owner).json()
    assert page["total"] == 1
    # The reader's own profile is not there for the owner either.
    reader_id = public_id(client, reader)
    answer = client.get(f"/users/{reader_id}/drawings", headers=owner)
    assert answer.status_code == 404
    unblock(client, who, whom)
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 200
    page = client.get(f"/users/{owner_id}/drawings", headers=reader).json()
    assert page["total"] == 1


def test_a_block_ends_every_follow_both_ways(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    follows(client, me, you)
    follows(client, you, me, accepted=False)
    block(client, me, you)
    for headers in (me, you):
        for which in ("followers", "following", "follow-requests"):
            page = client.get(f"/me/{which}", headers=headers).json()
            assert page == {"people": [], "next": None, "total": 0}, which
    # Neither asks to follow across the block: the other is not there.
    for who, whom in ((me, you), (you, me)):
        answer = client.post(f"/users/{public_id(client, whom)}/follow", headers=who)
        assert answer.status_code == 404
        assert answer.json()["error"]["message"] == NO_PROFILE
    # Unblocked, nothing comes back by itself, and asking works again.
    unblock(client, me, you)
    assert client.get("/me/following", headers=me).json()["total"] == 0
    follows(client, me, you)


# --- Done twice, undone when not there ---


def test_a_second_block_and_an_unblock_of_nobody_change_nothing(
    client: TestClient, wall: WallClock  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    unblock(client, me, you)
    assert client.get("/me/blocked", headers=me).json()["total"] == 0
    block(client, me, you)
    block(client, me, you)
    page = client.get("/me/blocked", headers=me).json()
    assert page["total"] == 1
    assert [p["username"] for p in page["people"]] == ["other_runner"]
    unblock(client, me, you)
    unblock(client, me, you)
    assert client.get("/me/blocked", headers=me).json()["total"] == 0


def test_an_unblock_leaves_the_others_block(
    client: TestClient,  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    block(client, me, you)
    block(client, you, me)
    unblock(client, me, you)
    # Still apart: the other's block stands.
    assert found(client, me, "other") == []
    assert client.get("/me/blocked", headers=me).json()["total"] == 0
    assert client.get("/me/blocked", headers=you).json()["total"] == 1


def test_nobody_blocks_itself_or_nobody(client: TestClient) -> None:  # noqa: F811
    me = signed_up(client)
    answer = client.put(f"/users/{public_id(client, me)}/block", headers=me)
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == NOT_YOURSELF_BLOCK
    for target in (str(uuid4()), "not-an-id"):
        assert client.put(f"/users/{target}/block", headers=me).status_code == 404
        assert client.delete(f"/users/{target}/block", headers=me).status_code == 404


def test_the_blocked_list_pages_the_last_first(
    client: TestClient, wall: WallClock  # noqa: F811
) -> None:
    me = signed_up(client)
    names = [f"blocked_{n}" for n in range(5)]
    for name in names:
        wall.t = wall.t.replace(minute=wall.t.minute + 1)
        block(client, me, signed_up(client, email=f"{name}@example.com", username=name))
    seen: list[str] = []
    cursor: str | None = None
    while True:
        query: dict[str, Any] = {"limit": 2}
        if cursor is not None:
            query["cursor"] = cursor
        page = PeoplePageBody.model_validate(
            client.get("/me/blocked", params=query, headers=me).json()
        )
        assert page.total == len(names)
        seen += [person.username for person in page.people]
        cursor = page.next
        if cursor is None:
            break
        assert re.match(r"^\d{1,17}-[0-9a-f]{32}$", cursor)
    assert seen == list(reversed(names))


# --- Reports ---


def test_each_kind_is_reported_once_for_each_reporter(
    client: TestClient, database: Database, wall: WallClock  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    friend = third(client)
    drawing_id = post_of(client, owner)
    assert comment(client, owner, drawing_id, "Thanks for looking") == 201
    (comment_id,) = [
        str(row["id"])
        for row in rows(database, "SELECT id FROM comments WHERE drawing_id = %s",
                        drawing_id)  # fmt: skip
    ]
    targets = {
        "drawing": drawing_id,
        "comment": comment_id,
        "user": public_id(client, owner),
    }
    for kind, target in targets.items():
        assert report(client, reader, kind, target).status_code == 204
        wall.t = wall.t.replace(minute=wall.t.minute + 1)
        assert report(client, reader, kind, target, "offensive").status_code == 204
        assert report(client, friend, kind, target, "other").status_code == 204
    kept = rows(
        database,
        "SELECT u.username, kind, target_id::text AS target, reason FROM reports"
        " JOIN users u ON u.id = reporter_id ORDER BY u.username, kind",
    )
    assert kept == [
        {"username": who, "kind": kind, "target": targets[kind], "reason": reason}
        for who, reason in (("other_runner", "offensive"), ("third_runner", "other"))
        for kind in sorted(targets)
    ]


def test_a_report_of_nothing_or_of_ones_own(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    drawing_id = post_of(client, me)
    for kind in REPORT_KINDS:
        answer = report(client, me, kind, str(uuid4()))
        assert answer.status_code == 404
        assert answer.json()["error"]["message"] == NOTHING_TO_REPORT
    for kind, target in (("drawing", drawing_id), ("user", public_id(client, me))):
        answer = report(client, me, kind, target)
        assert answer.status_code == 422
        assert answer.json()["error"]["message"] == NOT_YOURSELF_REPORT
    assert report(client, me, "user", "not-an-id").status_code == 422
    assert rows(database, "SELECT * FROM reports") == []


def test_a_blocked_member_is_still_reported(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    block(client, me, you)
    assert report(client, me, "user", public_id(client, you)).status_code == 204
    assert len(rows(database, "SELECT * FROM reports")) == 1


# --- Deleting an account ---


def test_a_deleted_account_takes_its_blocks_and_reports(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me = signed_up(client)
    you = other(client)
    friend = third(client)
    block(client, me, you)
    block(client, friend, me)
    assert report(client, me, "user", public_id(client, you)).status_code == 204
    assert report(client, you, "user", public_id(client, friend)).status_code == 204
    my_id = client.get("/me", headers=me).json()["id"]
    assert client.delete("/me", headers=me).status_code == 204
    mine = rows(
        database,
        "SELECT 1 FROM blocks WHERE blocker_id = %s OR blocked_id = %s",
        my_id,
        my_id,
    )
    assert mine == []
    assert rows(database, "SELECT 1 FROM reports WHERE reporter_id = %s", my_id) == []
    # The others' reports stay.
    assert len(rows(database, "SELECT * FROM reports")) == 1


def test_the_app_knows_the_same_lists() -> None:
    """packages/shared-types holds the kinds and the reasons in the same
    order: the app shows the reasons in it."""
    source = (FIXTURES.parent / "src" / "index.ts").read_text(encoding="utf-8")
    for name, values in (
        ("REPORT_KINDS", REPORT_KINDS),
        ("REPORT_REASONS", REPORT_REASONS),
    ):
        match = re.search(rf"export const {name} = \[([^\]]*)\]", source)
        assert match is not None, name
        assert tuple(re.findall(r'"([a-z_]+)"', match.group(1))) == values
