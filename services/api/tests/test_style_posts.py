"""MuW Style in the API (TASK-384, ADR-0326, docs/API.md, «Style»).

In a real PostgreSQL: a post is shown from its publish_at, with the body of
the shared fixtures, its photo and its dots; an old price is not said;
hidden, or with no product still sold, it is gone; theme, gender and pages;
opening a product and «Shop» count one more for the day, «Shop» answers the
shop's page or Awin's link; past the hourly cap a touch is answered and not
counted; **nothing personal is kept**: the counts have no account, no
address, no phone. Without the database, 503."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_drawings import (
    FIXTURES,
    WallClock,
    api,
    database,  # noqa: F401  (the fixtures of the drawings' tests)
    wall,  # noqa: F401
)
from test_style_import import PHOTO, post_file

from shaperoute_api import style_posts
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.style_import import load, parse_post
from shaperoute_api.style_links import StyleLinks

# After the post is out (2026-11-20 08:00 CET); the jacket's price was read
# three days before, the shoes' twenty.
OUT = datetime(2026, 11, 21, 10, 0, tzinfo=UTC)
JACKET, SHOES = 1, 2
PERSONAL = ("user", "account", "ip", "address", "phone", "device", "agent", "email")


def _load_fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _post(**change: Any) -> dict[str, Any]:
    return {**post_file(), **change}


@pytest.fixture
def style(
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    tmp_path: Path,
) -> TestClient:
    """The API with MS-001 loaded, its photo under tmp_path, and the clock
    after the post is out."""
    load(database, parse_post(post_file()), PHOTO, tmp_path)
    wall.t = OUT
    client = api(database, wall)
    client.app.state.style_images = tmp_path  # type: ignore[attr-defined]
    client.app.state.style_links = StyleLinks()  # type: ignore[attr-defined]
    return client


def test_a_post_is_the_shared_fixture(style: TestClient) -> None:
    answer = style.get("/style")
    assert answer.status_code == 200
    assert answer.json() == _load_fixture("style-page.json")
    one = style.get("/style/MS-001")
    assert one.status_code == 200
    assert one.json() == _load_fixture("style-post.json")


def test_a_price_read_long_ago_is_not_said(style: TestClient) -> None:
    jacket, shoes = style.get("/style/MS-001").json()["tags"]
    assert (jacket["price_eur"], jacket["price_seen_on"]) == (84.99, "2026-11-18")
    assert (shoes["price_eur"], shoes["price_seen_on"]) == (None, None)


def test_the_photo_is_a_jpeg(style: TestClient) -> None:
    answer = style.get("/style/MS-001/image")
    assert answer.status_code == 200
    assert answer.headers["content-type"] == "image/jpeg"
    assert answer.headers["cache-control"] == style_posts.CACHE_CONTROL
    assert answer.content == PHOTO


def test_before_its_time_nothing_is_shown(
    style: TestClient,
    wall: WallClock,  # noqa: F811
) -> None:
    wall.t = datetime(2026, 11, 20, 6, 59, tzinfo=UTC)
    assert style.get("/style").json() == {"posts": [], "before": None}
    assert style.get("/style/MS-001").status_code == 404
    assert style.get("/style/MS-001/image").status_code == 404
    assert style.post(f"/style/tags/{JACKET}/open").status_code == 404
    assert style.post(f"/style/tags/{JACKET}/shop").status_code == 404


def test_a_hidden_post_is_gone(
    style: TestClient,
    database: Database,  # noqa: F811
) -> None:
    with database.connect() as conn:
        conn.execute("UPDATE style_posts SET hidden_at = %s", (OUT,))
    assert style.get("/style").json()["posts"] == []
    assert style.get("/style/MS-001").status_code == 404
    assert style.post(f"/style/tags/{JACKET}/shop").status_code == 404


def test_a_sold_out_product_has_no_dot(
    style: TestClient,
    database: Database,  # noqa: F811
) -> None:
    with database.connect() as conn:
        conn.execute(
            "UPDATE post_product_tags SET active = false WHERE id = %s", (SHOES,)
        )
    assert [t["id"] for t in style.get("/style/MS-001").json()["tags"]] == [JACKET]
    assert style.post(f"/style/tags/{SHOES}/open").status_code == 404
    with database.connect() as conn:
        conn.execute("UPDATE post_product_tags SET active = false")
    # A post with no product left is not shown at all.
    assert style.get("/style").json()["posts"] == []


def test_theme_gender_and_pages(
    style: TestClient,
    database: Database,  # noqa: F811
    tmp_path: Path,
) -> None:
    for n, (theme, gender) in enumerate(
        [("trail", "women"), ("running", "women"), ("bike", "men")], start=2
    ):
        body = _post(
            id=f"MS-00{n}",
            theme=theme,
            gender=gender,
            publish_at=f"2026-11-20T{8 + n:02d}:00:00+01:00",
        )
        load(database, parse_post(body), PHOTO, tmp_path)
    ids = [p["id"] for p in style.get("/style").json()["posts"]]
    assert ids == ["MS-004", "MS-003", "MS-002", "MS-001"]
    running = style.get("/style", params={"theme": "running"}).json()["posts"]
    assert [p["id"] for p in running] == ["MS-003", "MS-001"]
    women = style.get("/style", params={"gender": "women"}).json()["posts"]
    assert [p["id"] for p in women] == ["MS-003", "MS-002"]
    first = style.get("/style", params={"limit": 3}).json()
    assert [p["id"] for p in first["posts"]] == ids[:3]
    assert first["before"] == "MS-002"
    rest = style.get("/style", params={"limit": 3, "before": "MS-002"}).json()
    assert ([p["id"] for p in rest["posts"]], rest["before"]) == (["MS-001"], None)


@pytest.mark.parametrize(
    "params",
    [
        {"before": "MS-999"},
        {"before": "drop table"},
        {"theme": "swimming"},
        {"gender": "kids"},
        {"limit": 0},
        {"limit": 51},
    ],
)
def test_a_wrong_question_is_refused(style: TestClient, params: dict[str, Any]) -> None:
    assert style.get("/style", params=params).status_code == 422


def _clicks(database: Database) -> list[dict[str, Any]]:  # noqa: F811
    with database.connect() as conn:
        return conn.execute(
            "SELECT tag_id, day, opens, shops FROM product_tag_clicks"
            " ORDER BY tag_id, day"
        ).fetchall()


def test_opening_and_shop_count_one_more_for_the_day(
    style: TestClient,
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    assert style.post(f"/style/tags/{JACKET}/open").status_code == 204
    assert style.post(f"/style/tags/{JACKET}/open").status_code == 204
    shop = style.post(f"/style/tags/{JACKET}/shop")
    assert shop.status_code == 200
    assert shop.json() == {"url": post_file()["tags"][0]["url"]}
    wall.t = OUT + timedelta(days=1)
    assert style.post(f"/style/tags/{SHOES}/open").status_code == 204
    assert _clicks(database) == [
        {"tag_id": JACKET, "day": date(2026, 11, 21), "opens": 2, "shops": 1},
        {"tag_id": SHOES, "day": date(2026, 11, 22), "opens": 1, "shops": 0},
    ]


def test_shop_answers_awins_link_when_the_server_has_the_ids(style: TestClient) -> None:
    style.app.state.style_links = StyleLinks("123", {"zalando": "456"})  # type: ignore[attr-defined]
    url = style.post(f"/style/tags/{JACKET}/shop").json()["url"]
    assert urlsplit(url).hostname == "www.awin1.com"


def test_a_tag_that_is_not_there_is_404(
    style: TestClient,
    database: Database,  # noqa: F811
) -> None:
    assert style.post("/style/tags/999/open").status_code == 404
    assert style.post("/style/tags/999/shop").status_code == 404
    assert _clicks(database) == []


def test_past_the_hourly_cap_a_touch_is_answered_and_not_counted(
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(style_posts, "MAX_COUNTS_PER_HOUR", 2)
    load(database, parse_post(post_file()), PHOTO, tmp_path)
    wall.t = OUT
    client = api(database, wall)
    client.app.state.style_links = StyleLinks()  # type: ignore[attr-defined]
    for _ in range(3):
        assert client.post(f"/style/tags/{JACKET}/open").status_code == 204
    assert client.post(f"/style/tags/{JACKET}/shop").status_code == 200
    assert [(c["opens"], c["shops"]) for c in _clicks(database)] == [(2, 0)]


def test_nothing_personal_is_kept(
    style: TestClient,
    database: Database,  # noqa: F811
) -> None:
    """ADR-0326 point 3: a touch is a number for the dot and the day. No
    account, no network address, no phone, no browser in any Style table."""
    style.post(f"/style/tags/{JACKET}/open", headers={"User-Agent": "MuW/1.0"})
    style.post(f"/style/tags/{JACKET}/shop", headers={"Authorization": "Bearer x"})
    with database.connect() as conn:
        columns = conn.execute(
            "SELECT table_name, column_name FROM information_schema.columns"
            " WHERE table_name IN ('style_posts', 'post_product_tags',"
            " 'product_tag_clicks')"
        ).fetchall()
        references = conn.execute(
            "SELECT DISTINCT ccu.table_name"
            " FROM information_schema.table_constraints tc"
            " JOIN information_schema.constraint_column_usage ccu"
            " USING (constraint_name, table_schema)"
            " WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN"
            " ('style_posts', 'post_product_tags', 'product_tag_clicks')"
        ).fetchall()
    clicks = {
        c["column_name"] for c in columns if c["table_name"] == "product_tag_clicks"
    }
    assert clicks == {"tag_id", "day", "opens", "shops"}
    for column in columns:
        assert not any(word in column["column_name"] for word in PERSONAL), column
    assert {r["table_name"] for r in references} == {"style_posts", "post_product_tags"}
    assert [(c["opens"], c["shops"]) for c in _clicks(database)] == [(1, 1)]


def test_without_the_database_it_is_503() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    assert client.get("/style").status_code == 503
    assert client.post("/style/tags/1/open").status_code == 503
