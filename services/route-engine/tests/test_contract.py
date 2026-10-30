"""The TypeScript contract in packages/shared-types mirrors models.py by hand
(ADR-0028): its fixtures must fit the dataclasses, field for field."""

import json
from dataclasses import fields
from pathlib import Path
from typing import Any

from route_engine.alternatives import MAX_ALTERNATIVES
from route_engine.models import (
    DISTANCE_LIMITS_M,
    MAX_DISTANCE_M,
    MIN_DISTANCE_M,
    SUPPORTED_ACTIVITIES,
    RouteRequest,
    RouteResult,
)
from route_engine.pen_up import drawn_pieces, walks_problem
from route_engine.shapes import SUPPORTED_SHAPES, in_pieces
from route_engine.words import ALPHABET, LETTER_DISTANCE_M, MAX_WORD_LETTERS, STYLES

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _names(model: type) -> set[str]:
    return {f.name for f in fields(model)}


# Added by TASK-197 (ADR-0157), both optional: the fixtures written before
# are what an older app sends and an older API answers.
PEN_UP = {"pen_up"}
WALKS = {"walks"}
# Added by TASK-206 part B (ADR-0167), optional too: the fixtures written
# before are what an older API answers.
ON_FOOT = {"on_foot"}
# Added by TASK-234 (ADR-0197), optional too: the fixtures written before
# are what an older API answers.
BETTER = {"better_distance_m"}
# Added by TASK-238 (ADR-0202), both optional: the fixtures written before
# are what an older app sends and an older API answers.
NEAR = {"near"}
CENTRE = {"centre"}
# Added by TASK-232 (ADR-0195), optional too: the fixtures written before
# are what an older API answers and an older app sends back.
ROTATION = {"rotation_deg"}
# Added by TASK-323 part B (ADR-0283), optional too: the laps a swim asks
# for, and the laps and turns it answers.
LAPS = {"laps"}
SWIM = {"laps", "turns"}


def test_request_fixtures_are_valid_requests() -> None:
    # A shape or a word, the other null (TASK-056).
    for name, drawn in (
        ("route-request.json", "heart"),
        ("route-request-word.json", "CIAO"),
    ):
        data = _load(name)
        assert set(data) == _names(RouteRequest) - LAPS - PEN_UP - NEAR
        request = RouteRequest(**{**data, "start": tuple(data["start"])})
        assert request.start == (46.0671, 11.1214)
        assert request.name == drawn
        assert not request.pen_up


def test_result_fixtures_have_the_result_fields() -> None:
    for name in ("route-result.json", "route-result-word.json"):
        data = _load(name)
        assert (
            set(data)
            == _names(RouteResult) - SWIM - WALKS - ON_FOOT - BETTER - CENTRE - ROTATION
        )
        points = [tuple(p) for p in data["points"]]
        result = RouteResult(**{**data, "points": points})
        assert result.points[0] == result.points[-1]
        assert (result.shape is None) != (result.word is None)
        assert result.walks == []  # an older API: no walks, one line
        assert result.on_foot == []  # and nothing walked with the bike


def test_a_word_with_the_pen_up_and_its_walks_are_in_the_contract() -> None:
    data = _load("route-request-pen-up.json")
    assert set(data) == _names(RouteRequest) - LAPS - NEAR
    request = RouteRequest(**{**data, "start": tuple(data["start"])})
    assert request.pen_up and request.name == "IO"
    # A shape in pieces with the pen up too (TASK-223).
    data = _load("route-request-pen-up-shape.json")
    assert set(data) == _names(RouteRequest) - LAPS - NEAR
    request = RouteRequest(**{**data, "start": tuple(data["start"])})
    assert request.pen_up and request.shape == "smiley"
    data = _load("route-result-pen-up.json")
    assert (
        set(data) == _names(RouteResult) - SWIM - ON_FOOT - BETTER - CENTRE - ROTATION
    )
    points = [tuple(p) for p in data["points"]]
    walks = [tuple(w) for w in data["walks"]]
    result = RouteResult(**{**data, "points": points, "walks": walks})
    # One walk fewer than the letters, within the points, in order; the
    # route is open, from the first letter to the last.
    assert result.word is not None and len(result.walks) == len(result.word) - 1
    assert walks_problem(result.walks, len(result.points)) is None
    assert len(drawn_pieces(result.points, result.walks)) == len(result.word)
    assert result.points[0] != result.points[-1]


def test_shapes_activities_and_limits_match() -> None:
    contract = _load("contract.json")
    assert contract == {
        "shapes": list(SUPPORTED_SHAPES),
        # The shapes that may be asked with the pen up (TASK-223).
        "pen_up_shapes": [name for name in SUPPORTED_SHAPES if in_pieces(name)],
        "activities": list(SUPPORTED_ACTIVITIES),
        "min_distance_m": MIN_DISTANCE_M,
        "max_distance_m": MAX_DISTANCE_M,
        # Those of each activity of the contract (TASK-190).
        "distance_limits_m": {
            activity: list(DISTANCE_LIMITS_M[activity])
            for activity in SUPPORTED_ACTIVITIES
        },
        "letters": sorted(ALPHABET),
        "max_word_letters": MAX_WORD_LETTERS,
        "letter_distance_m": LETTER_DISTANCE_M,
        "styles": list(STYLES),
    }


def test_a_cycling_request_is_a_request_with_the_bike_limits() -> None:
    # TASK-190: the same fields, another activity, within its own limits.
    data = _load("route-request-cycling.json")
    assert set(data) == _names(RouteRequest) - LAPS - PEN_UP - NEAR
    request = RouteRequest(**{**data, "start": tuple(data["start"])})
    assert request.activity == "cycling"
    low, high = DISTANCE_LIMITS_M["cycling"]
    assert low <= request.distance_m <= high


def test_alternatives_have_the_engine_limit_and_the_result_fields() -> None:
    assert _load("route-alternatives.json") == {"max_alternatives": MAX_ALTERNATIVES}
    for other in _load("route-result.json")["alternatives"]:
        assert (
            set(other)
            == _names(RouteResult) - SWIM - WALKS - ON_FOOT - BETTER - CENTRE - ROTATION
        )
        assert other["alternatives"] == []


def _result(data: dict[str, Any]) -> RouteResult:
    return RouteResult(
        **{
            **data,
            "points": [tuple(p) for p in data["points"]],
            "walks": [tuple(w) for w in data["walks"]],
            "on_foot": [tuple(s) for s in data["on_foot"]],
            "alternatives": [_result(other) for other in data["alternatives"]],
        }
    )


def test_a_bike_route_and_where_it_is_walked_are_in_the_contract() -> None:
    # TASK-206: the stretches with the bike on foot, as indices into the
    # points like the walks, in the alternatives too.
    data = _load("route-result-cycling.json")
    for fields_of in (data, *data["alternatives"]):
        assert set(fields_of) == _names(RouteResult) - SWIM - BETTER - CENTRE - ROTATION
    result = _result(data)
    for each in (result, *result.alternatives):
        assert each.on_foot and each.walks == []
        assert walks_problem(each.on_foot, len(each.points)) is None
        assert each.points[0] == each.points[-1]
        assert any("with the bike on foot" in w for w in each.warnings)


def test_a_moved_shape_and_its_centre_are_in_the_contract() -> None:
    # TASK-238: on the water, a request may say near where the shape is
    # wanted, and the result says where its centre is.
    data = _load("route-request-paddling-near.json")
    assert set(data) == _names(RouteRequest) - LAPS
    request = RouteRequest(
        **{**data, "start": tuple(data["start"]), "near": tuple(data["near"])}
    )
    assert request.activity == "paddling" and request.near is not None
    result = _load("route-result-paddling.json")
    assert set(result) == _names(RouteResult) - SWIM - ROTATION  # of its day
    lat, lon = result["centre"]
    lats = [p[0] for p in result["points"]]
    lons = [p[1] for p in result["points"]]
    assert min(lats) < lat < max(lats) and min(lons) < lon < max(lons)
    # Only that fixture has a centre: the others are routes on the roads,
    # or of an API of before.
    assert _load("route-result-better-distance.json")["centre"] is None
