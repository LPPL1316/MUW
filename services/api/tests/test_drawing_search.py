"""The search of the drawings in a real PostgreSQL (TASK-344, ADR-0297): the
words in every field, without capitals or accents; the shapes the app
names; the filters; never a private run nor one across a block; pages that
neither repeat nor skip, in each order."""

from __future__ import annotations

import re
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.geo import local_to_latlon
from test_drawings import (
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    code,
    database,  # noqa: F401
    drawn,
    follows,
    other,
    public_id,
    run,
    saved,
    signed_up,
    third,
    wall,  # noqa: F401
)
from test_feed import MINUTE

from shaperoute_api.db import Database
from shaperoute_api.drawing_search import (
    CURSOR_PATTERN,
    DISTANCE_UPSIDE_DOWN,
    MAX_QUERY_LENGTH,
    NOT_A_SHAPE,
    SORT_MISMATCH,
    complexity_of,
    folded,
    pattern_of,
    words_of,
)

# Trento, where the example run starts.
TRENTO = (46.0671, 11.1214)


def search(app: TestClient, headers: dict[str, str], **query: Any) -> dict[str, Any]:
    answer = app.get("/search/drawings", params=query, headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def titles(page: dict[str, Any]) -> list[str | None]:
    return [post["title"] for post in page["posts"]]


def found(app: TestClient, headers: dict[str, str], **query: Any) -> set[str]:
    return {str(title) for title in titles(search(app, headers, **query))}


def published(
    app: TestClient,
    headers: dict[str, str],
    key: str,
    title: str,
    **changes: Any,
) -> str:
    """A run saved with `changes` and published for everyone with `title`:
    the id of its drawing."""
    saved(app, headers, key, **changes)
    return str(drawn(app, headers, key, title=title)["id"])


def set_run(db: Database, key: str, **columns: Any) -> None:
    """Writes columns of the runs with `key` straight in the database: the
    place, which needs a geocoding key, and the distance."""
    names = ", ".join(f"{name} = %({name})s" for name in columns)
    with db.connect() as conn:
        conn.execute(
            f"UPDATE runs SET {names} WHERE key = %(key)s", {**columns, "key": key}
        )


def zigzag(strokes: int, width_m: float = 1000.0) -> dict[str, Any]:
    """A run that goes up and down `strokes` times in a square of
    `width_m`: a long line in a small rectangle."""
    points: list[tuple[float, float]] = []
    for i in range(strokes + 1):
        x_m = width_m * i / strokes
        points += [
            local_to_latlon(TRENTO, x_m, 0.0),
            local_to_latlon(TRENTO, x_m, width_m),
        ]
    body = run()
    start = body["track"][0]["time_ms"]
    body["track"] = [
        {"point": list(point), "time_ms": start + i * 300_000, "accuracy_m": 5.0}
        for i, point in enumerate(points)
    ]
    body["pauses"] = []
    body["points"] = [list(point) for point in points]
    return body


# --- The words ---


def test_the_folding_and_the_patterns() -> None:
    # Each letter with its accents; anything else only itself.
    assert pattern_of("ca") == "[cçćč][aàáâãäåāăą]"
    assert pattern_of("#1%") == "\\#1\\%"
    assert pattern_of("ж") == "ж"
    assert folded("Città ÀNCORA Señora Łódź") == "citta ancora senora lodz"


def test_the_words_of_a_query() -> None:
    assert words_of("  Cane   Trento ") == ["cane", "trento"]
    assert words_of("") == []
    assert words_of("x" * (MAX_QUERY_LENGTH + 1)) is None


def test_complexity_from_length_and_diagonal() -> None:
    assert complexity_of(3000, 1000) == "simple"
    assert complexity_of(4000, 1000) == "medium"
    assert complexity_of(5000, 1000) == "complex"
    assert complexity_of(100, 0) == "simple"


def test_the_search_wants_a_token(client: TestClient) -> None:  # noqa: F811
    assert client.get("/search/drawings").status_code == 401


def test_every_field_is_searched_without_capitals_or_accents(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    published(client, author, "searchk01", "Sunday star")
    saved(client, author, "searchk02", shape=None, word="CIAO")
    drawn(client, author, "searchk02", title="A word", description="Il mio #cuore")
    # The planned route's title, `title` in the run's body.
    saved(client, author, "searchk03", shape=None, title="Torre di Città")
    drawn(client, author, "searchk03", title="Morning")
    published(client, author, "searchk04", "Dog head", shape="dog_head")
    set_run(database, "searchk01", place="Città di Castello")
    assert found(client, me, q="sunday") == {"Sunday star"}
    assert found(client, me, q="ciao") == {"A word"}
    assert found(client, me, q="#Cuore") == {"A word"}
    assert found(client, me, q="torre citta") == {"Morning"}
    # The shape's words, apart: «dog_head» is found by «dog» and by «head».
    assert found(client, me, q="dog") == {"Dog head"}
    assert found(client, me, q="castello") == {"Sunday star"}
    # The author's name finds each of its drawings.
    assert found(client, me, q="OTHER_RUN") == {
        "Sunday star",
        "A word",
        "Morning",
        "Dog head",
    }
    # A `%` or a `_` is only itself.
    assert found(client, me, q="%") == set()
    # Nor a dot, in the pattern.
    assert found(client, me, q=".") == set()


def test_every_word_must_be_there(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    published(client, author, "searchk01", "Dog", shape="dog_head")
    published(client, author, "searchk02", "Another dog", shape="dog_head")
    set_run(database, "searchk01", place="Trento")
    set_run(database, "searchk02", place="Bari")
    assert found(client, me, q="dog trento") == {"Dog"}
    assert found(client, me, q="dog") == {"Dog", "Another dog"}


def test_the_shapes_the_app_names_are_found_too(
    client: TestClient,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    published(client, author, "searchk01", "Amore", shape="heart")
    published(client, author, "searchk02", "Stella", shape="star")
    # «cuore» is in no field: the app sends the shape it names.
    assert found(client, me, q="cuore") == set()
    assert found(client, me, q="cuore", named=["heart"]) == {"Amore"}
    # Without words, `named` asks nothing.
    assert found(client, me, named=["heart"]) == {"Amore", "Stella"}


def test_a_query_too_long_finds_nothing(client: TestClient) -> None:  # noqa: F811
    me, author = signed_up(client), other(client)
    published(client, author, "searchk01", "Star")
    assert found(client, me, q="s" * (MAX_QUERY_LENGTH + 1)) == set()


# --- The filters ---


def test_each_filter_leaves_out_what_is_not_its_own(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    published(client, author, "searchk01", "Heart run", shape="heart")
    published(
        client, author, "searchk02", "Star ride", shape="star", activity="cycling"
    )
    published(
        client, author, "searchk03", "Star paddle", shape="star", activity="paddling"
    )
    set_run(database, "searchk01", distance_m=5_000, place="Trento")
    set_run(database, "searchk02", distance_m=25_000, place="Levico Terme")
    set_run(database, "searchk03", distance_m=60_000, place="Riva del Garda")
    assert found(client, me, shape=["heart"]) == {"Heart run"}
    assert found(client, me, shape=["heart", "star"]) == {
        "Heart run",
        "Star ride",
        "Star paddle",
    }
    assert found(client, me, activity=["cycling", "paddling"]) == {
        "Star ride",
        "Star paddle",
    }
    assert found(client, me, min_m=10_000, max_m=30_000) == {"Star ride"}
    assert found(client, me, min_m=50_000) == {"Star paddle"}
    assert found(client, me, place="LEVICO") == {"Star ride"}
    # Filters all hold, with the words too.
    assert found(client, me, q="star", activity=["cycling"], max_m=30_000) == {
        "Star ride"
    }


def test_the_complexity_is_read_from_the_line(
    client: TestClient,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    # The square of the example: four sides over a diagonal, below 3.
    published(client, author, "searchk01", "Square")
    saved(client, author, "searchk02", **zigzag(12))
    drawn(client, author, "searchk02", title="Zigzag")
    assert found(client, me, complexity=["simple"]) == {"Square"}
    assert found(client, me, complexity=["complex"]) == {"Zigzag"}
    assert found(client, me, complexity=["medium"]) == set()


def test_wrong_filters_are_refused(client: TestClient) -> None:  # noqa: F811
    me = signed_up(client)
    for query, text in [
        ({"min_m": 5000, "max_m": 1000}, DISTANCE_UPSIDE_DOWN),
        ({"shape": ["Heart!"]}, NOT_A_SHAPE),
        ({"named": ["a b"]}, NOT_A_SHAPE),
    ]:
        answer = client.get("/search/drawings", params=query, headers=me)
        assert answer.status_code == 422, query
        assert code(answer) == "invalid_request"
        assert answer.json()["error"]["message"] == text
    for query in [
        {"activity": ["walking"]},
        {"complexity": ["hard"]},
        {"sort": "oldest"},
        {"min_m": -1},
        {"limit": 51},
        {"shape": ["star"] * 51},
    ]:
        answer = client.get("/search/drawings", params=query, headers=me)
        assert answer.status_code == 422, query


# --- Who sees what ---


def test_never_a_private_run_not_even_by_its_author_s_name(
    client: TestClient,  # noqa: F811
) -> None:
    me, author = signed_up(client), other(client)
    saved(client, me, "searchk01")
    drawn(client, me, "searchk01", title="Star mine private", visibility="only_me")
    saved(client, author, "searchk02")
    drawn(
        client, author, "searchk02", title="Star for followers", visibility="followers"
    )
    saved(client, author, "searchk03")
    drawn(client, author, "searchk03", title="Star private", visibility="only_me")
    published(client, author, "searchk04", "Star for everyone")
    # Not even its owner finds a private run, by its words or by its name.
    assert found(client, me, q="star") == {"Star for everyone"}
    assert found(client, me, q="runner_42") == set()
    assert found(client, author, q="other_runner") == {
        "Star for everyone",
        "Star for followers",
    }
    # Without words either.
    assert "Star private" not in found(client, me)
    # The followers' one, once the request is accepted.
    follows(client, me, author)
    assert found(client, me, q="other_runner") == {
        "Star for everyone",
        "Star for followers",
    }


def test_never_a_drawing_across_a_block_either_way(
    client: TestClient,  # noqa: F811
) -> None:
    me, author, blocked = signed_up(client), other(client), third(client)
    published(client, me, "searchk01", "Star mine")
    published(client, blocked, "searchk02", "Star of the blocked")
    published(client, author, "searchk03", "Star for everyone")
    assert found(client, me, q="star") == {
        "Star mine",
        "Star of the blocked",
        "Star for everyone",
    }
    answer = client.put(f"/users/{public_id(client, blocked)}/block", headers=me)
    assert answer.status_code == 204
    # Neither by its words nor by its name.
    assert found(client, me, q="star") == {"Star mine", "Star for everyone"}
    assert found(client, me, q="third_runner") == set()
    # The one blocked does not find the one who blocked.
    assert found(client, blocked, q="star") == {
        "Star of the blocked",
        "Star for everyone",
    }
    assert found(client, blocked, q="Star mine") == set()


# --- The orders and the pages ---


def every_page(
    app: TestClient, headers: dict[str, str], limit: int, **query: Any
) -> list[str]:
    """The titles of every page, read one after the other."""
    titles_found: list[str] = []
    cursor: str | None = None
    while True:
        page = search(
            app,
            headers,
            limit=limit,
            **query,
            **({} if cursor is None else {"cursor": cursor}),
        )
        titles_found += [str(title) for title in titles(page)]
        cursor = page["next"]
        if cursor is None:
            return titles_found
        assert re.match(CURSOR_PATTERN, cursor)


@pytest.fixture
def five(
    client: TestClient, database: Database, wall: WallClock  # noqa: F811
) -> dict[str, str]:
    """Five drawings published a minute apart: the distances and the
    reactions in another order. The reader's headers."""
    me, author = signed_up(client), other(client)
    distances = [8_000, 2_000, 10_000, 4_000, 6_000]
    reactions = [1, 0, 0, 2, 0]
    ids: list[str] = []
    for i, distance_m in enumerate(distances):
        key = f"searchk{i:02d}"
        ids.append(published(client, author, key, f"Star {i}"))
        set_run(database, key, distance_m=distance_m)
        wall.t += MINUTE
    readers = [me, third(client)]
    for drawing_id, count in zip(ids, reactions, strict=True):
        for reader in readers[:count]:
            answer = client.put(
                f"/drawings/{drawing_id}/reaction",
                json={"kind": "fire"},
                headers=reader,
            )
            assert answer.status_code == 200, answer.text
    return me


def test_the_three_orders(
    client: TestClient, five: dict[str, str]  # noqa: F811
) -> None:
    assert titles(search(client, five)) == [f"Star {i}" for i in (4, 3, 2, 1, 0)]
    assert titles(search(client, five, sort="longest")) == [
        f"Star {i}" for i in (2, 0, 4, 3, 1)
    ]
    popular = titles(search(client, five, sort="popular"))
    assert popular[:2] == ["Star 3", "Star 0"]
    assert sorted(popular[2:]) == ["Star 1", "Star 2", "Star 4"]


@pytest.mark.parametrize("sort", ["recent", "longest", "popular"])
def test_the_pages_neither_repeat_nor_skip(
    client: TestClient, five: dict[str, str], sort: str  # noqa: F811
) -> None:
    whole = titles(search(client, five, sort=sort))
    for limit in (1, 2, 3):
        assert every_page(client, five, limit, sort=sort) == whole


def test_a_cursor_of_another_order_is_refused(
    client: TestClient, five: dict[str, str]  # noqa: F811
) -> None:
    cursor = search(client, five, limit=2)["next"]
    answer = client.get(
        "/search/drawings",
        params={"limit": 2, "sort": "longest", "cursor": cursor},
        headers=five,
    )
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == SORT_MISMATCH


def test_a_post_is_the_feed_s(
    client: TestClient, five: dict[str, str]  # noqa: F811
) -> None:
    post = search(client, five, limit=1)["posts"][0]
    assert post["author"]["username"] == "other_runner"
    assert 2 <= len(post["track_preview"]) <= 64
    assert "track" not in post
