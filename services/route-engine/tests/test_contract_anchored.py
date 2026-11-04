"""The contract of TASK-347 part A (ADR-0300) in packages/shared-types:
the fixtures of the anchored placement and of the strokes fit the engine's
own data, and the engine's request knows nothing of the fields the API
adds (test_anchored.py)."""

from __future__ import annotations

import json
from dataclasses import fields
from pathlib import Path
from typing import Any

from route_engine.anchored import PLACEMENTS, check_placement
from route_engine.models import RouteRequest, RouteResult
from route_engine.stroke_match import StrokeMatch, check_fit

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"

# The fields the API adds to the engine's request and result (TASK-347): an
# older app sends neither, an older API answers without.
PLACEMENT = {"placement", "fit"}
PLACED = {"placed_outline"}


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _names(model: type) -> set[str]:
    return {f.name for f in fields(model)}


def test_an_anchored_request_is_the_engines_request_with_the_placement() -> None:
    data = _load("route-request-anchored.json")
    assert set(data) == _names(RouteRequest) | PLACEMENT
    assert data["placement"] in PLACEMENTS
    check_placement(data["placement"], data["fit"], data["activity"])
    request = RouteRequest(
        **{k: v for k, v in data.items() if k not in PLACEMENT | {"start"}},
        start=tuple(data["start"]),
    )
    assert request.name == "heart"


def test_an_anchored_result_has_the_result_fields_and_the_placed_outline() -> None:
    data = _load("route-result-anchored.json")
    assert set(data) == _names(RouteResult) | PLACED
    points = [tuple(p) for p in data["points"]]
    result = RouteResult(
        **{k: v for k, v in data.items() if k not in PLACED | {"points"}}, points=points
    )
    assert result.shape is None and result.word is None  # an image's drawing
    assert any("not rescaled" in warning for warning in result.warnings)
    (line,) = data["placed_outline"]
    assert line[0] == line[-1] == data["points"][0]  # closed, where it starts


def test_a_stroke_match_has_the_engines_fields() -> None:
    data = _load("stroke-match.json")
    assert set(data) == _names(StrokeMatch) - {"nodes"}  # the nodes stay inside
    match = StrokeMatch(
        points=[tuple(p) for p in data["points"]],
        **{k: v for k, v in data.items() if k != "points"},
    )
    request = _load("stroke-match-request.json")
    assert set(request) == {"activity", "fit", "line", "from"}
    assert len(match.away_m) == len(request["line"])
    check_fit(request["fit"])
    assert len(request["line"]) >= 2 and len(request["from"]) == 2


def test_an_anchored_image_request_has_the_image_fields_and_the_placement() -> None:
    data = _load("image-route-request-anchored.json")
    plain = _load("image-route-request.json")
    assert set(data) == set(plain) | {"strokes", "pen_up"} | PLACEMENT
    assert data["placement"] == "anchored" and 0.0 <= data["fit"] <= 1.0
