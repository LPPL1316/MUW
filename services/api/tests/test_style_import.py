"""Loading a MuW Style post (TASK-384, ADR-0326).

Without a database: the file of tests/fixtures/style reads; a field more or
less, a title without one of the five languages, a time without its zone, a
page of another site, too many dots or a photo that is not a JPEG are
refused. In a real PostgreSQL: a post loaded once, never overwritten, its
photo in place; hidden, not deleted; the tool without the database's
address stops."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from test_drawings import database  # noqa: F401  (the fixture of the drawings' tests)

from shaperoute_api.db import Database
from shaperoute_api.style_import import (
    JPEG_START,
    MAX_IMAGE_BYTES,
    MAX_TAGS,
    StyleImportError,
    checked_image,
    hide,
    load,
    main,
    parse_post,
)

SAMPLE = Path(__file__).parent / "fixtures" / "style" / "MS-001.json"
PHOTO = JPEG_START + b"\xe0" + b"0" * 64


def post_file() -> dict[str, Any]:
    body: dict[str, Any] = json.loads(SAMPLE.read_text(encoding="utf-8"))
    return body


def test_the_sample_reads() -> None:
    post = parse_post(post_file())
    assert (post.id, post.theme, post.gender, len(post.tags)) == (
        "MS-001",
        "running",
        "men",
        2,
    )


def _tag(**change: Any) -> dict[str, Any]:
    tags = post_file()["tags"]
    return {"tags": [{**tags[0], **change}]}


@pytest.mark.parametrize(
    "change",
    [
        {"likes": 12},
        {"author": "Giulia"},
        {"id": "001"},
        {"theme": "swimming"},
        {"gender": "kids"},
        {"title": {"en": "Rainy 10K"}},
        {"title": {**post_file()["title"], "pt": "10 km"}},
        {"title": {**post_file()["title"], "it": ""}},
        {"title": {**post_file()["title"], "it": "x" * 81}},
        {"publish_at": "2026-11-20T08:00:00"},
        {"tags": []},
        {"tags": post_file()["tags"] * (MAX_TAGS // 2 + 1)},
        _tag(url="https://www.amazon.it/x"),
        _tag(url="http://www.zalando.it/x.html"),
        _tag(retailer="shein"),
        _tag(x=1.2),
        _tag(price_eur=0),
        _tag(price_seen_at="2026-11-18T20:00:00"),
        _tag(photo="https://img01.ztat.net/x.jpg"),
    ],
)
def test_a_file_that_is_wrong_is_refused(change: dict[str, Any]) -> None:
    with pytest.raises(StyleImportError):
        parse_post({**post_file(), **change})


def test_the_photo_is_a_jpeg_of_a_few_megabytes() -> None:
    assert checked_image(PHOTO) == PHOTO
    with pytest.raises(StyleImportError):
        checked_image(b"\x89PNG\r\n\x1a\n")
    with pytest.raises(StyleImportError):
        checked_image(JPEG_START + b"0" * MAX_IMAGE_BYTES)


def test_without_the_database_the_tool_stops(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SHAPEROUTE_DATABASE_URL", raising=False)
    assert main([str(SAMPLE), "photo.jpg"]) == 2


def test_a_post_is_loaded_once_with_its_photo(
    database: Database,  # noqa: F811
    tmp_path: Path,
) -> None:
    post = parse_post(post_file())
    path = load(database, post, PHOTO, tmp_path)
    assert path == tmp_path / "MS-001.jpg" and path.read_bytes() == PHOTO
    with database.connect() as conn:
        tags = conn.execute(
            "SELECT item, retailer, active FROM post_product_tags"
            " WHERE post_id = 'MS-001' ORDER BY id"
        ).fetchall()
    assert [(t["item"], t["retailer"], t["active"]) for t in tags] == [
        ("jacket", "zalando", True),
        ("shoes", "zalando", True),
    ]
    with pytest.raises(StyleImportError):
        load(database, post, b"\xff\xd8\xff other", tmp_path)
    assert path.read_bytes() == PHOTO
    assert sorted(p.name for p in tmp_path.iterdir()) == ["MS-001.jpg"]


def test_a_post_already_in_the_database_leaves_no_photo(
    database: Database,  # noqa: F811
    tmp_path: Path,
) -> None:
    post = parse_post(post_file())
    load(database, post, PHOTO, tmp_path / "first")
    with pytest.raises(StyleImportError):
        load(database, post, PHOTO, tmp_path / "second")
    assert list((tmp_path / "second").iterdir()) == []


def test_a_post_is_hidden_not_deleted(
    database: Database,  # noqa: F811
    tmp_path: Path,
) -> None:
    load(database, parse_post(post_file()), PHOTO, tmp_path)
    now = datetime(2026, 11, 25, tzinfo=UTC)
    assert hide(database, "MS-001", now) is True
    assert hide(database, "MS-001", now) is False
    assert hide(database, "MS-999", now) is False
    with database.connect() as conn:
        row = conn.execute("SELECT hidden_at FROM style_posts").fetchone()
    assert row is not None and row["hidden_at"] == now
