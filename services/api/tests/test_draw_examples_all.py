"""draw_examples --all and --around (TASK-316, ADR-0276): every example the
app asks a city for, and the towns a phone near a city prepares."""

from __future__ import annotations

import json
import urllib.parse
from pathlib import Path
from typing import Any

import pytest

from shaperoute_api import draw_examples
from shaperoute_api.city_examples import requests
from shaperoute_api.draw_examples import Call, draw_city, draw_town, towns_around

REPO = Path(__file__).resolve().parents[3]
EXAMPLES = REPO / "packages" / "shared-types" / "fixtures" / "city-examples.json"

TRENTO = [46.0679, 11.1211]
# GET /nearby-cities from each point: Trento's ring, then the rings of its
# towns, which hold Trento's again and each other.
NEAR = {
    (46.0679, 11.1211): [("Pergine Valsugana", [46.0605, 11.2407])],
    (46.0605, 11.2407): [
        ("Trento", [46.0679, 11.1211]),
        ("Levico Terme", [46.0091, 11.3018]),
        ("Caldonazzo", [46.0036, 11.2647]),
    ],
    (46.0091, 11.3018): [
        ("Caldonazzo", [46.0036, 11.2647]),
        ("Borgo Valsugana", [46.0533, 11.4566]),
    ],
    (46.0036, 11.2647): [("Tenna", [46.0186, 11.2647])],
}


def fake_api(asked: list[dict[str, Any]]) -> Call:
    """The city search, the towns near a point, and route jobs kept at once."""

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        url = urllib.parse.urlparse(path)
        query = urllib.parse.parse_qs(url.query)
        if url.path == "/cities":
            return 200, {"places": [{"label": "Trento, Italy", "point": TRENTO}]}
        if url.path == "/nearby-cities":
            point = (float(query["lat"][0]), float(query["lon"][0]))
            towns = NEAR.get(point, [])
            return 200, {
                "places": [
                    {"label": label, "point": p, "away_m": 1000} for label, p in towns
                ]
            }
        assert method == "POST" and path == "/route-jobs" and body is not None
        asked.append(body)
        return 202, {"job_id": "j", "status": "done", "result": {}, "error": None}

    return call


def test_the_examples_are_those_the_app_asks() -> None:
    # The app's test reads the same file (cityExamplesFixture.test.ts).
    fixture = json.loads(EXAMPLES.read_text())
    assert requests(fixture["start"]) == fixture["requests"]
    names = [r.get("shape") or r["word"] for r in fixture["requests"]]
    assert names[:3] == ["circle", "heart", "star"]
    assert len(names) == 14
    # A word is written with the pen up, 3 km a letter, the longest first.
    assert fixture["requests"][8] == {
        "word": "AMORE",
        "style": "round",
        "pen_up": True,
        "distance_m": 15_000,
        "start": fixture["start"],
        "activity": "running",
    }


def test_all_asks_every_example_of_a_city() -> None:
    asked: list[dict[str, Any]] = []
    drawn = draw_city("Trento", fake_api(asked), every=True)
    assert asked == requests(TRENTO)
    assert drawn.ready
    assert list(drawn.shapes)[-1] == "MUW"


def test_without_all_only_the_first_three() -> None:
    asked: list[dict[str, Any]] = []
    draw_city("Trento", fake_api(asked))
    assert [body["shape"] for body in asked] == ["circle", "heart", "star"]


def test_a_town_is_drawn_from_its_own_point() -> None:
    asked: list[dict[str, Any]] = []
    tenna = [46.0186, 11.2647]
    drawn = draw_town("Tenna", tenna, fake_api(asked), every=True)
    assert {tuple(body["start"]) for body in asked} == {tuple(tenna)}
    assert drawn.line().startswith("Tenna: circle kept")


def test_the_towns_around_go_ring_by_ring_once_each() -> None:
    towns = towns_around("Trento", fake_api([]), most=20)
    assert towns is not None
    # Trento itself is drawn by name; each town once, the nearest ring first.
    assert [label for label, _ in towns] == [
        "Pergine Valsugana",
        "Levico Terme",
        "Caldonazzo",
        "Borgo Valsugana",
        "Tenna",
    ]
    few = towns_around("Trento", fake_api([]), most=2)
    assert few is not None and [label for label, _ in few] == [
        "Pergine Valsugana",
        "Levico Terme",
    ]


def test_a_city_not_found_has_no_towns_around() -> None:
    def nothing(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        return 200, {"places": []}

    assert towns_around("Nowhere", nothing) is None


def test_the_command_draws_the_towns_around(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    asked: list[dict[str, Any]] = []
    monkeypatch.setattr(draw_examples, "http_call", lambda api, key: fake_api(asked))
    argv = ["--api", "http://api", "--all", "--around", "Trento", "--towns", "3"]
    assert draw_examples.main(argv) == 0
    out = capsys.readouterr().out
    assert "3 of 3 cities have their examples" in out
    assert len(asked) == 3 * 14
    assert {tuple(body["start"]) for body in asked} == {
        (46.0605, 11.2407),
        (46.0091, 11.3018),
        (46.0036, 11.2647),
    }
