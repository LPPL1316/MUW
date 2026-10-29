"""Deterministic tests for tools/themed_ideas.py: no network, no API; made-up
results, and the file the app reads."""

from __future__ import annotations

import json
from typing import Any

from themed_ideas import (
    API_ITEMS,
    COORD_DECIMALS,
    DEFAULT_OUT,
    IDEAS,
    PREVIEW_POINTS,
    Idea,
    entry,
    ideas_file,
    items_file,
    read_kept,
    with_items,
)

# The four categories the user chose for the ideas (2026-10-29), in the words
# of apps/mobile/src/explore/presets.ts.
CHOSEN = {"Famous Places", "Best Views", "Hidden Gems", "Photography"}
# The simple shapes the API reads in words (themes.SHAPE_WORDS).
SIMPLE = {"heart", "star", "circle", "moon"}


def result(shape: str = "star") -> dict[str, Any]:
    return {
        "points": [
            [41.8902123, 12.4922345],
            [41.891, 12.493],
            [41.8902123, 12.4922345],
        ],
        "distance_m": 8123.456,
        "similarity": 0.91234,
        "shape": shape,
        "theme": "famous",
        "theme_label": "famous places",
        "target_m": 8000,
        "city": "Rome, Lazio, Italy",
        "centre": [41.8933203, 12.4829321],
        "stops": [
            {
                "name": "Colosseum",
                "point": [41.8902123, 12.4922345],
                "passed": True,
                "wikidata": "Q10285",
                "photo": {"url": "/city-photos/Q10285.jpg", "credit": "© A · CC0"},
            },
            {
                "name": "Pantheon",
                "point": [41.8986108, 12.4768729],
                "passed": False,
                "wikidata": None,
                "photo": None,
            },
        ],
        "license": "Places and roads © OpenStreetMap contributors",
    }


def test_an_idea_is_the_words_the_app_sends() -> None:
    idea = Idea("Rome", "Famous Places", "star", 8)
    assert idea.id == "rome-famous-places-star"
    assert idea.text == "Famous Places star 8 km"


def test_the_ideas_the_user_chose() -> None:
    ids = [idea.id for idea in IDEAS]
    assert len(ids) == len(set(ids))
    assert {idea.category for idea in IDEAS} == CHOSEN
    assert {idea.shape for idea in IDEAS} <= SIMPLE
    assert all(3 <= idea.km <= 21 for idea in IDEAS)


def test_an_entry_keeps_the_result_rounded_with_the_city_as_named() -> None:
    idea = Idea("Rome", "Famous Places", "star", 8)
    kept = entry(idea, result())
    assert kept["id"] == idea.id
    assert kept["text"] == "Famous Places star 8 km"
    body = kept["result"]
    assert body["city"] == "Rome"
    assert body["points"][0] == [41.89021, 12.49223]
    assert body["centre"] == [41.89332, 12.48293]
    assert body["stops"][1]["point"] == [41.89861, 12.47687]
    assert body["distance_m"] == 8123
    assert body["similarity"] == 0.912
    assert kept["preview"] == body["points"]
    assert entry(idea, body) == kept


def test_a_place_keeps_its_item_never_its_photo() -> None:
    kept = entry(Idea("Rome", "Famous Places", "star", 8), result())
    assert [s["wikidata"] for s in kept["result"]["stops"]] == ["Q10285", None]
    assert all("photo" not in s for s in kept["result"]["stops"])
    # A file written before the items: none.
    old = result()
    for stop in old["stops"]:
        del stop["wikidata"], stop["photo"]
    kept = entry(Idea("Rome", "Famous Places", "star", 8), old)
    assert [s["wikidata"] for s in kept["result"]["stops"]] == [None, None]


def test_the_items_found_again_by_name() -> None:
    kept = entry(Idea("Rome", "Famous Places", "star", 8), result())
    said: list[str] = []
    again = with_items(kept, {"Colosseum": "Q10", "Trevi": "Q186579"}, said.append)
    stops = again["result"]["stops"]
    assert [s["wikidata"] for s in stops] == ["Q10", None]
    assert said == ["rome-famous-places-star: 'Pantheon' not found again"]
    # Nothing else moves.
    assert {**again, "result": {**again["result"], "stops": []}} == {
        **kept,
        "result": {**kept["result"], "stops": []},
    }


def test_the_apis_list_has_the_items_of_the_places_passed_by() -> None:
    first = entry(Idea("Rome", "Famous Places", "star", 8), result())
    other = with_items(first, {"Colosseum": "Q10285", "Pantheon": "Q99309"}, print)
    body = {"ideas": [first, other]}
    assert items_file(body) == {"items": ["Q10285"]}


def test_the_apis_list_is_that_of_the_apps_file() -> None:
    body = json.loads(DEFAULT_OUT.read_text(encoding="utf-8"))
    listed = json.loads(API_ITEMS.read_text(encoding="utf-8"))
    assert listed == items_file(body)
    assert listed["items"]


def test_a_long_line_has_a_short_preview_with_its_ends() -> None:
    long = result()
    long["points"] = [[41.89 + i * 1e-4, 12.49 + (i % 7) * 1e-4] for i in range(500)]
    kept = entry(Idea("Rome", "Famous Places", "star", 8), long)
    assert len(kept["preview"]) <= PREVIEW_POINTS
    assert kept["preview"][0] == kept["result"]["points"][0]
    assert kept["preview"][-1] == kept["result"]["points"][-1]


def test_only_some_planned_again_the_others_kept_a_failure_left_out() -> None:
    ideas = (
        Idea("Rome", "Famous Places", "star", 8),
        Idea("Paris", "Best Views", "heart", 8),
        Idea("Lisbon", "Best Views", "circle", 6),
    )
    kept = {ideas[0].id: entry(ideas[0], result("circle"))}
    planned: list[str] = []

    def plan(idea: Idea) -> dict[str, Any]:
        planned.append(idea.id)
        if idea.city == "Lisbon":
            raise RuntimeError("no places")
        return result(idea.shape)

    said: list[str] = []
    body = ideas_file(ideas, plan, kept, only={ideas[1].id}, log=said.append)
    assert planned == [ideas[1].id, ideas[2].id]
    assert [i["id"] for i in body["ideas"]] == [ideas[0].id, ideas[1].id]
    assert body["ideas"][0] == entry(ideas[0], result("circle"))
    assert any("failed" in line for line in said)


def test_the_apps_file_has_every_idea_in_order_each_a_route_through_places() -> None:
    body = json.loads(DEFAULT_OUT.read_text(encoding="utf-8"))
    assert [i["id"] for i in body["ideas"]] == [idea.id for idea in IDEAS]
    for idea, kept in zip(IDEAS, body["ideas"], strict=True):
        assert kept["text"] == idea.text
        assert kept["city"] == idea.city
        route = kept["result"]
        assert route["shape"] == idea.shape
        assert route["city"] == idea.city
        assert len(route["points"]) >= 2
        assert route["points"][0] == route["points"][-1]
        for point in route["points"] + [route["centre"]]:
            assert all(round(v, COORD_DECIMALS) == v for v in point)
        assert sum(1 for s in route["stops"] if s["passed"]) >= 2
        assert 2 <= len(kept["preview"]) <= PREVIEW_POINTS


def test_reading_a_file_that_is_not_there_keeps_nothing(tmp_path: Any) -> None:
    assert read_kept(tmp_path / "none.json") == {}
