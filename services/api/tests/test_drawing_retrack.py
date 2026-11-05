"""Drawing again, whole, the drawings kept with the 200 m cut (TASK-390,
ADR-0330).

In a real PostgreSQL: a drawing kept cut, as PUT kept them before ADR-0330,
is only counted without --apply and drawn whole with it, as PUT draws it
now; who sees it and when it was published stay; a second run changes
nothing; the tool without the database's address stops."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    KEY,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    drawn,
    other,
    saved,
    signed_up,
    wall,  # noqa: F401
)

from shaperoute_api.db import Database
from shaperoute_api.drawing_retrack import Retracked, main, retrack
from shaperoute_api.drawings import _line_wkt


def kept_cut(db: Database, drawing_id: str, whole: list[Any]) -> None:
    """The drawing as it was kept before ADR-0330: without its ends."""
    with db.connect() as conn:
        conn.execute(
            "UPDATE drawings SET track = ST_GeomFromText(%s, 4326) WHERE id = %s::uuid",
            (_line_wkt([tuple(point) for point in whole[1:-1]]), drawing_id),
        )


def test_a_cut_drawing_is_drawn_whole_again(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    saved(client, owner)
    drawing_id = drawn(client, owner, visibility="followers")["id"]
    drawn(client, owner, visibility="everyone")
    whole = client.get(f"/me/activities/{KEY}", headers=owner).json()["track"]
    before = client.get(f"/drawings/{drawing_id}", headers=reader).json()
    kept_cut(database, drawing_id, whole)
    cut = client.get(f"/drawings/{drawing_id}", headers=reader).json()["track"]
    assert len(cut) == len(whole) - 2

    # Without --apply: counted, nothing written.
    assert retrack(database, apply=False) == Retracked(drawings=1, changed=1)
    still = client.get(f"/drawings/{drawing_id}", headers=reader).json()["track"]
    assert still == cut

    assert retrack(database, apply=True) == Retracked(drawings=1, changed=1)
    after = client.get(f"/drawings/{drawing_id}", headers=reader).json()
    assert len(after["track"]) == len(before["track"])
    for point, was in zip(after["track"], before["track"], strict=True):
        assert point == pytest.approx(was)
    assert after["track"][0] == pytest.approx(whole[0])
    assert after["track"][-1] == pytest.approx(whole[-1])
    assert after["visibility"] == "everyone"
    assert after["published_at"] == before["published_at"]

    # Whole already: a second run changes nothing.
    assert retrack(database, apply=True) == Retracked(drawings=1, changed=0)


def test_a_drawing_published_now_is_left_as_it_is(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    owner = signed_up(client)
    saved(client, owner)
    drawn(client, owner)
    assert retrack(database, apply=True) == Retracked(drawings=1, changed=0)


def test_without_the_database_address_it_stops(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("SHAPEROUTE_DATABASE_URL", raising=False)
    assert main([]) == 2
    assert "SHAPEROUTE_DATABASE_URL" in capsys.readouterr().err
