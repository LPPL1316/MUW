"""The searches in a real PostgreSQL, made faster (TASK-288, ADR-0249):
«Find friends» from an index of the names' trigrams, the small pictures
made once, the drawings' preview kept by PostgreSQL as recommended.preview
makes it, and a session's use written once an hour."""

from __future__ import annotations

import base64
import random
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    WallClock,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    drawn,
    saved,
    signed_up,
    wall,  # noqa: F401
)
from test_follows import Member, a_photo

from shaperoute_api import follows as follows_module
from shaperoute_api.accounts import SESSION_DAYS, USE_WRITTEN_EVERY
from shaperoute_api.db import Database
from shaperoute_api.drawings import _line
from shaperoute_api.follows import SmallPhotos, small_photo
from shaperoute_api.recommended import PREVIEW_POINTS, preview

Point = tuple[float, float]


def plan_of(db: Database, query: str, *values: Any) -> str:
    """The plan of `query`, the tables read whole only when nothing else
    can: a table of a test is so small that reading it whole is cheaper."""
    with db.connect() as conn:
        conn.execute("SET enable_seqscan = off")
        rows = conn.execute(f"EXPLAIN {query}", values).fetchall()
    return "\n".join(row["QUERY PLAN"] for row in rows)


def line_wkt(points: list[Point]) -> str:
    return "LINESTRING(" + ",".join(f"{lon!r} {lat!r}" for lat, lon in points) + ")"


# --- «Find friends» ---


def test_a_part_of_a_name_is_found_from_the_index_of_trigrams(
    database: Database,  # noqa: F811
) -> None:
    # The search's own condition (follows.py).
    plan = plan_of(
        database,
        "SELECT u.id FROM users u WHERE lower(u.username) LIKE %s",
        "%ner_1%",
    )
    assert "users_username_trgm_idx" in plan


def test_the_search_finds_the_same_with_the_index(
    client: TestClient,  # noqa: F811
) -> None:
    ada = Member(client, "Ada_runs")
    for name in ("bea.trento", "Mara_runs", "runs_far", "zed"):
        Member(client, name)
    answer = client.get("/users", params={"q": "RUNS"}, headers=ada.headers)
    assert answer.status_code == 200
    # Those that begin with it first, then the shortest; never oneself.
    assert [p["username"] for p in answer.json()["people"]] == [
        "runs_far",
        "Mara_runs",
    ]


def test_a_small_picture_is_made_once_and_anew_for_a_new_picture(
    client: TestClient,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    made: list[int] = []

    def counted(jpeg: bytes) -> str:
        made.append(len(jpeg))
        return small_photo(jpeg)

    monkeypatch.setattr(follows_module, "SMALL_PHOTOS", SmallPhotos())
    monkeypatch.setattr(follows_module, "small_photo", counted)
    ada, bea = Member(client, "Ada_runs"), Member(client, "bea.trento")
    client.put("/me/photo", json={"image": a_photo()}, headers=bea.headers)

    def photo() -> str:
        answer = client.get("/users", params={"q": "bea"}, headers=ada.headers)
        return str(answer.json()["people"][0]["photo"])

    first = photo()
    # Letter after letter, the same face: made once.
    assert [photo() for _ in range(3)] == [first] * 3
    assert len(made) == 1
    # A new picture is a new small one, never the one before.
    client.put("/me/photo", json={"image": a_photo((200, 40, 40))}, headers=bea.headers)
    assert photo() != first
    assert len(made) == 2


def test_the_small_pictures_kept_are_the_latest_used() -> None:
    kept = SmallPhotos(size=2)
    # PNGs are pictures too: small_photo reads any.
    pictures = [base64.b64decode(a_photo((n * 60, 90, 90))) for n in range(3)]
    first = kept.of(pictures[0])
    kept.of(pictures[1])
    assert kept.of(pictures[0]) == first
    kept.of(pictures[2])
    # The second, used the longest ago, is the one let go.
    assert len(kept._kept) == 2
    assert kept.of(pictures[0]) == first


# --- The drawings' preview ---


def test_the_preview_kept_is_the_preview_of_the_whole_track(
    database: Database,  # noqa: F811
) -> None:
    """recommended.preview and drawing_preview choose the same points: if
    one changes, so must the other (a new migration)."""
    for points in (2, 63, PREVIEW_POINTS, 65, 100, 127, 128, 189, 1000, 2001, 3333):
        rng = random.Random(points)
        line = [
            (46.0 + rng.uniform(-0.05, 0.05), 11.1 + rng.uniform(-0.05, 0.05))
            for _ in range(points)
        ]
        with database.connect() as conn:
            row = conn.execute(
                "SELECT ST_AsGeoJSON(track, 15) AS whole,"
                " ST_AsGeoJSON(drawing_preview(track), 15) AS kept"
                " FROM (SELECT ST_GeomFromText(%s, 4326) AS track) t",
                (line_wkt(line),),
            ).fetchone()
        assert row is not None
        kept = _line(row["kept"])
        assert len(kept) == min(points, PREVIEW_POINTS), points
        # What the feed showed, from the whole track, and what it shows now.
        assert preview(kept) == preview(_line(row["whole"])), points


def test_a_drawing_without_a_track_has_no_preview(
    database: Database,  # noqa: F811
) -> None:
    with database.connect() as conn:
        row = conn.execute("SELECT drawing_preview(NULL) IS NULL AS none").fetchone()
    assert row is not None and row["none"]


def test_the_feed_and_the_profile_show_the_preview_of_the_track(
    client: TestClient,  # noqa: F811
) -> None:
    headers = signed_up(client)
    saved(client, headers)
    drawing = drawn(client, headers)
    whole = client.get(f"/drawings/{drawing['id']}", headers=headers).json()["track"]
    expected = [list(p) for p in preview([tuple(p) for p in whole])]
    [post] = client.get("/feed", headers=headers).json()["posts"]
    assert post["track_preview"] == expected
    me = client.get("/me", headers=headers).json()["public_id"]
    [listed] = client.get(f"/users/{me}/drawings", headers=headers).json()["drawings"]
    assert listed["track_preview"] == expected


def test_the_feed_reads_the_index_of_the_published_drawings(
    database: Database,  # noqa: F811
) -> None:
    plan = plan_of(
        database,
        "SELECT d.id FROM drawings d WHERE d.visibility <> 'only_me'"
        " ORDER BY d.published_at DESC, d.id DESC LIMIT 20",
    )
    assert "drawings_published_idx" in plan


# --- A session's use ---


def last_used(db: Database) -> Any:
    with db.connect() as conn:
        row = conn.execute("SELECT last_used_at FROM sessions").fetchone()
    assert row is not None
    return row["last_used_at"]


def test_a_use_is_written_once_an_hour(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    headers = signed_up(client)
    signed = last_used(database)
    wall.t += USE_WRITTEN_EVERY - timedelta(minutes=1)
    assert client.get("/me", headers=headers).status_code == 200
    # Read, not written: nothing waited for the disk.
    assert last_used(database) == signed
    wall.t += timedelta(minutes=2)
    assert client.get("/me", headers=headers).status_code == 200
    assert last_used(database) == wall.t


def test_a_session_lasts_90_days_after_a_use_not_written(
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
) -> None:
    headers = signed_up(client)
    signed = last_used(database)
    # Used half an hour later: not written.
    wall.t += timedelta(minutes=30)
    assert client.get("/me", headers=headers).status_code == 200
    assert last_used(database) == signed
    # A second short of 90 days after that use: still signed in.
    wall.t += timedelta(days=SESSION_DAYS) - timedelta(seconds=1)
    assert client.get("/me", headers=headers).status_code == 200
    # This use was written; 90 days and the hour after it, the session ends.
    wall.t += timedelta(days=SESSION_DAYS) + USE_WRITTEN_EVERY + timedelta(seconds=1)
    expired = client.get("/me", headers=headers)
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "session_expired"
