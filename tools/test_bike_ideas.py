"""Deterministic tests for tools/bike_ideas.py: no network, made-up drafts, and
the file the app reads."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bike_ideas import (
    CHOSEN,
    DEFAULT_OUT,
    PREVIEW_POINTS,
    Chosen,
    entry,
    fewer_points,
    length_m,
    metres,
    preview_of,
    read_draft,
)

LINE = [(45.0, 7.0 + i * 0.0001) for i in range(300)]
REPO = Path(__file__).resolve().parent.parent


def test_metres_of_a_degree_of_latitude() -> None:
    assert metres((45.0, 7.0), (46.0, 7.0)) == pytest.approx(111_195, abs=5)


def test_fewer_points_keeps_the_ends_and_the_corners() -> None:
    corner = [(45.0, 7.0), (45.0, 7.001), (45.0, 7.002), (45.001, 7.002)]
    assert fewer_points(corner, 2.0) == [corner[0], corner[2], corner[3]]
    assert fewer_points(LINE, 2.0) == [LINE[0], LINE[-1]]


def test_preview_is_short_and_keeps_the_ends() -> None:
    preview = preview_of(LINE)
    assert len(preview) == PREVIEW_POINTS
    assert preview[0] == LINE[0] and preview[-1] == LINE[-1]


def test_an_entry_is_a_bike_route_with_its_true_distance_and_no_times() -> None:
    item = entry(Chosen("x", "Turin", shape="ghost"), {"similarity": 0.9}, LINE, None)
    assert item["activity"] == "cycling"
    assert item["route_m"] == round(length_m(LINE))
    assert not {"minutes", "duration_s", "calories", "speed"} & item.keys()
    assert "outline" not in item


def test_read_draft_refuses_what_is_not_a_bike_route(tmp_path: Path) -> None:
    post = tmp_path / "posts" / "x"
    post.mkdir(parents=True)
    (post / "meta.json").write_text(
        json.dumps({"activity": "running", "similarity": 1})
    )
    with pytest.raises(ValueError):
        read_draft(tmp_path, Chosen("x", "Turin", shape="ghost"))


def test_the_file_of_the_app_has_the_chosen_routes() -> None:
    items = json.loads((REPO / DEFAULT_OUT).read_text())["ideas"]
    assert [item["id"] for item in items] == [f"bike-{c.draft}" for c in CHOSEN]
    for item in items:
        assert item["activity"] == "cycling"
        assert 20_000 <= item["route_m"] <= 30_000
        assert len(item["preview"]) <= PREVIEW_POINTS
        assert (item["shape"] is None) != (item["word"] is None)
    assert not {"bike-mushroom", "bike-go"} & {item["id"] for item in items}
