"""What «Start» and «Export GPX» on a drawing take (TASK-307, ADR-0267).

The app runs and writes as GPX the track of GET /drawings/{id}, nothing
else: these are the four rules that make that safe, one test each, on that
request. Only a drawing the reader may already see; never across a block;
never a hidden one (TASK-121, TASK-291); always the cut track, without its
first and last CUT_M metres and without times.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from route_engine.geo import haversine_m, path_length_m
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
from test_moderation import block

from shaperoute_api.db import Database
from shaperoute_api.drawings import CUT_M


def test_only_a_drawing_the_reader_may_see_gives_its_track(
    client: TestClient,  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    saved(client, owner)
    drawing_id = drawn(client, owner, visibility="followers")["id"]
    # Not a follower: as if it were not there.
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 404
    drawn(client, owner, visibility="everyone")
    seen = client.get(f"/drawings/{drawing_id}", headers=reader)
    assert seen.status_code == 200
    assert len(seen.json()["track"]) >= 2


def test_never_across_a_block(client: TestClient) -> None:  # noqa: F811
    owner = signed_up(client)
    reader = other(client)
    saved(client, owner)
    drawing_id = drawn(client, owner)["id"]
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 200
    block(client, owner, reader)
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 404


def test_never_a_hidden_drawing(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    saved(client, owner)
    drawing_id = drawn(client, owner)["id"]
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 200
    # As the link of a report hides it (TASK-291).
    with database.connect() as conn:
        conn.execute(
            "UPDATE drawings SET hidden_at = now() WHERE id = %s::uuid", (drawing_id,)
        )
    assert client.get(f"/drawings/{drawing_id}", headers=reader).status_code == 404


def test_always_the_cut_track_without_times(
    client: TestClient,  # noqa: F811
) -> None:
    owner = signed_up(client)
    reader = other(client)
    saved(client, owner)
    drawing_id = drawn(client, owner)["id"]
    whole = client.get(f"/me/activities/{KEY}", headers=owner).json()["track"]
    line = [tuple(point) for point in whole]
    body = client.get(f"/drawings/{drawing_id}", headers=reader).json()
    # Two numbers a point: no time, no accuracy, no pauses beside them.
    assert all(len(point) == 2 for point in body["track"])
    assert "pauses" not in body
    track = [tuple(point) for point in body["track"]]
    assert path_length_m(track) <= path_length_m(line) - 2 * CUT_M + 1
    # The run starts and ends at the door: never within CUT_M of it.
    for point in track:
        assert haversine_m(line[0], point) >= CUT_M - 1
        assert haversine_m(line[-1], point) >= CUT_M - 1
