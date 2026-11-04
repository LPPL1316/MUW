"""The API bodies mirror the shared-types contract (ADR-0028, ADR-0030).

The same JSON examples in packages/shared-types/fixtures are read by tsc,
by the engine's test_contract.py and here: if one side changes, a test fails.
"""

from __future__ import annotations

import inspect
import json
import re
from dataclasses import fields
from pathlib import Path
from typing import Any, get_args

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError
from route_engine import image_outline, outline_edits
from route_engine.directions import Direction
from route_engine.image_outline import MAX_POINTS
from route_engine.models import RouteRequest, RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan
from route_engine.outline_edits import MAX_DETAIL_POINTS, MAX_DRAWN_POINTS
from route_engine.water import FileWaterSource
from shaperoute_ai.reading import MAX_TEXT_LENGTH

from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app
from shaperoute_api.schemas import (
    MAX_IMAGE_BYTES,
    DirectionBody,
    EditReason,
    ErrorBody,
    ErrorCode,
    ErrorDetail,
    GpxRequestBody,
    ImageOutlineBody,
    ImageOutlineEditRequestBody,
    ImageOutlineRequestBody,
    ImageReason,
    ImageRouteRequestBody,
    JobStatus,
    RouteJobBody,
    RouteRequestBody,
    RouteResultBody,
    ShapeReadingBody,
    ShapeReadingRequestBody,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
WATER_FIXTURE = REPO / "services/route-engine/tests/fixtures/water_coast.json"


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _names(model: type[BaseModel]) -> set[str]:
    return set(model.model_fields)


# Added by TASK-197 (ADR-0157), both optional: the fixtures written before
# are what an older app sends and an older API answers.
PEN_UP = {"pen_up"}
WALKS = {"walks"}
# Added by TASK-206 part B (ADR-0167), optional too: the fixtures written
# before are what an older API answers and an older app sends back.
ON_FOOT = {"on_foot"}
# Added by TASK-234 (ADR-0197), optional too: the fixtures written before
# are what an older API answers and an older app sends back.
BETTER = {"better_distance_m"}
# Added by TASK-238 (ADR-0202), both optional: the fixtures written before
# are what an older app sends and an older API answers.
NEAR = {"near"}
CENTRE = {"centre"}
# Added by TASK-232 (ADR-0195), optional too: the fixtures written before
# are what an older API answers and an older app sends back.
ROTATION = {"rotation_deg"}
# Added by TASK-347 part A (ADR-0300), all optional: the fixtures written
# before are what an older app sends and an older API answers.
PLACEMENT = {"placement", "fit"}
PLACED = {"placed_outline"}


def _with_no_walks(result: dict[str, Any]) -> dict[str, Any]:
    """An older API's result as this one answers it: `walks` and `on_foot`
    empty, no better distance, no centre and upright, nothing placed
    (TASK-347), in the alternatives too."""
    others = [_with_no_walks(other) for other in result.get("alternatives", [])]
    return {
        **result,
        "alternatives": others,
        "walks": [],
        "on_foot": [],
        "better_distance_m": None,
        "centre": None,
        "rotation_deg": 0.0,
        "placed_outline": [],
    }


def _with_no_better(result: dict[str, Any]) -> dict[str, Any]:
    """A result of before TASK-234 as this API answers it: no better
    distance, no centre and upright (TASK-232), in the alternatives too."""
    others = [_with_no_better(other) for other in result.get("alternatives", [])]
    return {
        **result,
        "alternatives": others,
        "better_distance_m": None,
        "centre": None,
        "rotation_deg": 0.0,
        "placed_outline": [],
    }


def test_bodies_have_the_fields_of_the_dataclasses() -> None:
    # The placement and its magnet, and where the drawing was placed, are
    # the API's own fields (TASK-347, ADR-0300): the engine's request and
    # result know nothing of them, so its fingerprint stays (ANCHORED_ONLY).
    assert (
        _names(RouteRequestBody) == {f.name for f in fields(RouteRequest)} | PLACEMENT
    )
    assert _names(RouteResultBody) == {f.name for f in fields(RouteResult)} | PLACED
    assert _names(DirectionBody) == {f.name for f in fields(Direction)}


def test_request_fixture_is_a_valid_body() -> None:
    data = _load("route-request.json")
    assert set(data) == _names(RouteRequestBody) - PEN_UP - NEAR - PLACEMENT
    body = RouteRequestBody.model_validate(data)
    assert body.start == (46.0671, 11.1214)
    assert not body.pen_up


def test_result_fixture_is_a_valid_body() -> None:
    data = _load("route-result.json")
    assert (
        set(data)
        == _names(RouteResultBody)
        - WALKS
        - ON_FOOT
        - BETTER
        - CENTRE
        - ROTATION
        - PLACED
    )
    body = RouteResultBody.model_validate(data)
    assert body.points[0] == body.points[-1]
    assert body.walks == []  # an older API: one line, no walks
    assert body.on_foot == []  # and nothing walked with the bike


def test_pen_up_fixtures_are_valid_bodies() -> None:
    # TASK-197: a word with the pen up, and its route with the walks.
    request = _load("route-request-pen-up.json")
    assert set(request) == _names(RouteRequestBody) - NEAR - PLACEMENT
    assert RouteRequestBody.model_validate(request).pen_up
    # TASK-223: a shape in pieces with the pen up.
    request = _load("route-request-pen-up-shape.json")
    assert set(request) == _names(RouteRequestBody) - NEAR - PLACEMENT
    assert RouteRequestBody.model_validate(request).pen_up
    result = _load("route-result-pen-up.json")
    assert (
        set(result)
        == _names(RouteResultBody) - ON_FOOT - BETTER - CENTRE - ROTATION - PLACED
    )
    body = RouteResultBody.model_validate(result)
    assert body.word is not None and len(body.walks) == len(body.word) - 1
    assert body.points[0] != body.points[-1]


def test_the_api_answers_the_result_fixture_unchanged() -> None:
    data = _load("route-result.json")

    def result_of(fields: dict[str, Any]) -> RouteResult:
        points = [tuple(p) for p in fields["points"]]
        return RouteResult(**{**fields, "points": points, "alternatives": []})

    others = [Plan(result_of(other), None) for other in data["alternatives"]]

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        return Plan(result=result_of(data), search=None, alternatives=others)

    app = create_app(FileSource(FIXTURES / "unused.graphml"), planner=planner)
    response = TestClient(app).post("/routes", json=_load("route-request.json"))
    assert response.status_code == 200
    assert response.json() == _with_no_walks(data)


def test_error_fixture_is_a_valid_error_body() -> None:
    data = _load("api-error.json")
    assert set(data) == _names(ErrorBody)
    assert set(data["error"]) == _names(ErrorDetail)
    assert ErrorBody.model_validate(data).error.code == "shape_not_drawable"


def test_error_codes_match_shared_types() -> None:
    assert list(get_args(ErrorCode)) == _load("api-error-codes.json")


def test_route_job_fixtures_are_valid_bodies() -> None:
    for name in (
        "route-job-running.json",
        "route-job-done.json",
        "route-job-failed.json",
    ):
        data = _load(name)
        assert set(data) == _names(RouteJobBody), name
        RouteJobBody.model_validate(data)
    assert RouteJobBody.model_validate(_load("route-job-done.json")).result is not None
    assert RouteJobBody.model_validate(_load("route-job-failed.json")).error is not None


def test_job_statuses_match_shared_types() -> None:
    assert list(get_args(JobStatus)) == _load("route-job-statuses.json")


def test_gpx_request_fixture_is_a_valid_body() -> None:
    data = _load("gpx-request.json")
    assert set(data) == _names(GpxRequestBody)
    assert set(data["request"]) == _names(RouteRequestBody) - PEN_UP - NEAR - PLACEMENT
    older = (
        _names(RouteResultBody) - WALKS - ON_FOOT - BETTER - CENTRE - ROTATION - PLACED
    )
    assert set(data["result"]) == older
    GpxRequestBody.model_validate(data)


def test_shape_reading_fixtures_are_valid_bodies() -> None:
    request = _load("shape-reading-request.json")
    assert set(request) == _names(ShapeReadingRequestBody)
    ShapeReadingRequestBody.model_validate(request)
    for name in ("shape-reading.json", "shape-reading-none.json"):
        data = _load(name)
        assert set(data) == _names(ShapeReadingBody), name
        ShapeReadingBody.model_validate(data)


def test_shape_text_limit_matches_shared_types() -> None:
    assert _load("shape-reading-limits.json") == {"max_text_length": MAX_TEXT_LENGTH}


def test_word_fixtures_are_valid_bodies() -> None:
    # A word instead of a shape, the other null (TASK-056).
    request = _load("route-request-word.json")
    assert set(request) == _names(RouteRequestBody) - PEN_UP - NEAR - PLACEMENT
    assert RouteRequestBody.model_validate(request).word == "ciao"
    result = _load("route-result-word.json")
    assert (
        set(result)
        == _names(RouteResultBody)
        - WALKS
        - ON_FOOT
        - BETTER
        - CENTRE
        - ROTATION
        - PLACED
    )
    body = RouteResultBody.model_validate(result)
    assert body.shape is None
    assert body.word == "CIAO"


def test_the_api_passes_the_word_on_and_answers_its_result_unchanged() -> None:
    data = _load("route-result-word.json")
    result = RouteResult(**{**data, "points": [tuple(p) for p in data["points"]]})
    asked: list[RouteRequest] = []

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=result, search=None)

    app = create_app(FileSource(FIXTURES / "unused.graphml"), planner=planner)
    response = TestClient(app).post("/routes", json=_load("route-request-word.json"))
    assert response.status_code == 200
    assert response.json() == _with_no_walks(data)
    assert asked[0].word == "ciao"
    assert asked[0].style == "block"  # TASK-080
    assert not asked[0].pen_up  # TASK-197


def test_the_api_passes_the_pen_up_on_and_answers_its_walks() -> None:
    # TASK-197: the request's pen_up reaches the engine, the walks come back.
    data = _load("route-result-pen-up.json")
    points = [tuple(p) for p in data["points"]]
    walks = [tuple(w) for w in data["walks"]]
    result = RouteResult(**{**data, "points": points, "walks": walks})
    asked: list[RouteRequest] = []

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=result, search=None)

    app = create_app(FileSource(FIXTURES / "unused.graphml"), planner=planner)
    response = TestClient(app).post("/routes", json=_load("route-request-pen-up.json"))
    assert response.status_code == 200
    assert response.json() == {
        **data,
        "on_foot": [],
        "better_distance_m": None,
        "centre": None,
        "rotation_deg": 0.0,
        "placed_outline": [],
    }
    assert asked[0].pen_up and asked[0].word == "io"


def test_the_api_passes_a_cycling_request_on_to_the_engine() -> None:
    # TASK-190: the same fields as a run, "cycling" for the activity.
    request = _load("route-request-cycling.json")
    assert set(request) == _names(RouteRequestBody) - PEN_UP - NEAR - PLACEMENT
    assert RouteRequestBody.model_validate(request).activity == "cycling"
    data = _load("route-result.json")
    result = RouteResult(
        **{**data, "points": [tuple(p) for p in data["points"]], "alternatives": []}
    )
    asked: list[RouteRequest] = []

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=result, search=None)

    app = create_app(FileSource(FIXTURES / "unused.graphml"), planner=planner)
    response = TestClient(app).post("/routes", json=request)
    assert response.status_code == 200, response.json()
    assert asked[0].activity == "cycling" and asked[0].distance_m == 20_000


def _engine_result(data: dict[str, Any]) -> RouteResult:
    """A RouteResult from a fixture: JSON arrays are tuples again."""
    return RouteResult(
        **{
            **data,
            "points": [tuple(p) for p in data["points"]],
            "walks": [tuple(w) for w in data.get("walks", [])],
            "on_foot": [tuple(s) for s in data.get("on_foot", [])],
            "alternatives": [],
        }
    )


def test_the_bike_result_fixture_is_a_valid_body() -> None:
    # TASK-206: where the bike is walked, in the alternatives too.
    data = _load("route-result-cycling.json")
    for fields_of in (data, *data["alternatives"]):
        assert (
            set(fields_of)
            == _names(RouteResultBody) - BETTER - CENTRE - ROTATION - PLACED
        )
    body = RouteResultBody.model_validate(data)
    assert body.on_foot == [(2, 3)] and body.walks == []
    assert [other.on_foot for other in body.alternatives] == [[(2, 3)]]


def test_the_api_answers_where_a_bike_route_is_walked() -> None:
    data = _load("route-result-cycling.json")
    others = [Plan(_engine_result(other), None) for other in data["alternatives"]]

    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        return Plan(result=_engine_result(data), search=None, alternatives=others)

    app = create_app(FileSource(FIXTURES / "unused.graphml"), planner=planner)
    response = TestClient(app).post("/routes", json=_load("route-request-cycling.json"))
    assert response.status_code == 200, response.json()
    assert response.json() == _with_no_better(data)


def test_a_gpx_request_takes_a_bike_route_back_with_its_stretches_on_foot() -> None:
    # The app sends back the result it got: on_foot within its points.
    result = _load("route-result-cycling.json")
    request = _load("route-request-cycling.json")
    body = GpxRequestBody.model_validate({"request": request, "result": result})
    assert body.result.on_foot == [(2, 3)]
    count = len(result["points"])
    for wrong in ([[2, count]], [[3, 2]], [[2, 4], [3, 5]]):
        with pytest.raises(ValidationError, match="stretch on foot"):
            GpxRequestBody.model_validate(
                {"request": request, "result": {**result, "on_foot": wrong}}
            )


def test_the_api_passes_a_paddling_request_on_to_the_engine() -> None:
    # TASK-191: the same fields again, "paddling" for the activity, planned
    # on the water the API has, not on a graph (test_paddling.py).
    request = _load("route-request-paddling.json")
    assert set(request) == _names(RouteRequestBody) - PEN_UP - NEAR - PLACEMENT
    assert RouteRequestBody.model_validate(request).activity == "paddling"
    data = _load("route-result.json")
    result = RouteResult(
        **{**data, "points": [tuple(p) for p in data["points"]], "alternatives": []}
    )
    asked: list[tuple[RouteRequest, object]] = []

    def planner(request: RouteRequest, source: object) -> Plan:
        asked.append((request, source))
        return Plan(result=result, search=None)

    water = FileWaterSource(WATER_FIXTURE)
    graphs = ActivityGraphs({}, water=water)
    response = TestClient(create_app(graphs, planner=planner)).post(
        "/routes", json=request
    )
    assert response.status_code == 200, response.json()
    (request_asked, source), *_ = asked
    assert request_asked.activity == "paddling" and request_asked.shape == "heart"
    assert source is water


def test_a_moved_shape_and_its_centre_are_in_the_contract() -> None:
    # TASK-238: every field of the request and of the result; the request
    # asks for the shape near the result's centre, moved.
    request = _load("route-request-paddling-near.json")
    assert set(request) == _names(RouteRequestBody) - PLACEMENT
    body = RouteRequestBody.model_validate(request)
    assert body.activity == "paddling" and body.near is not None
    data = _load("route-result-paddling.json")
    assert set(data) == _names(RouteResultBody) - ROTATION - PLACED  # of its day
    answered = RouteResultBody.model_validate(data)
    assert answered.centre is not None and answered.centre != body.near
    result = RouteResult(
        **{
            **data,
            "points": [tuple(p) for p in data["points"]],
            "centre": tuple(data["centre"]),
        }
    )
    asked: list[RouteRequest] = []

    def planner(request: RouteRequest, source: object) -> Plan:
        asked.append(request)
        return Plan(result=result, search=None)

    graphs = ActivityGraphs({}, water=FileWaterSource(WATER_FIXTURE))
    response = TestClient(create_app(graphs, planner=planner)).post(
        "/routes", json=request
    )
    assert response.status_code == 200, response.json()
    assert asked[0].near == body.near
    # Upright, and nothing placed on the water (TASK-347).
    assert response.json() == {**data, "rotation_deg": 0.0, "placed_outline": []}


def test_image_fixtures_are_valid_bodies() -> None:
    # TASK-073, ADR-0069: the outline of an image, its route, its refusal.
    request = _load("image-outline-request.json")
    assert set(request) == _names(ImageOutlineRequestBody)
    ImageOutlineRequestBody.model_validate(request)
    outline = _load("image-outline.json")
    # As an API older than TASK-079 answers: no details (ADR-0074).
    assert set(outline) == _names(ImageOutlineBody) - {"strokes", "image_strokes"}
    ImageOutlineBody.model_validate(outline)
    route = _load("image-route-request.json")
    # As an app older than TASK-079 sends it: no details; nor the pen up,
    # which an image refuses anyway (TASK-197).
    assert (
        set(route) == _names(ImageRouteRequestBody) - {"strokes"} - PEN_UP - PLACEMENT
    )
    assert ImageRouteRequestBody.model_validate(route).outline == [
        tuple(p) for p in outline["points"]
    ]
    result = _load("route-result-image.json")
    assert (
        set(result)
        == _names(RouteResultBody)
        - WALKS
        - ON_FOOT
        - BETTER
        - CENTRE
        - ROTATION
        - PLACED
    )
    body = RouteResultBody.model_validate(result)
    assert body.shape is None and body.word is None
    error = _load("image-error.json")
    assert set(error["error"]) == _names(ErrorDetail)
    assert ErrorBody.model_validate(error).error.reason == "background"


def test_an_image_route_request_is_a_route_request_with_an_outline() -> None:
    # No letters in an image, so no style (TASK-080); its pen_up is there to
    # be refused with the reason (TASK-197). An image is not drawn on the
    # water, so it is not moved there (TASK-238).
    engine = {f.name for f in fields(RouteRequest)} - {
        "shape",
        "word",
        "style",
        "near",
    }
    assert _names(ImageRouteRequestBody) == engine | {"outline", "strokes"} | PLACEMENT


def test_image_reasons_and_limits_match_shared_types() -> None:
    assert list(get_args(ImageReason)) == _load("image-reasons.json")
    assert _load("image-limits.json") == {
        "max_image_bytes": MAX_IMAGE_BYTES,
        "max_outline_points": MAX_POINTS,
        "max_detail_points": MAX_DETAIL_POINTS,
        "max_drawn_points": MAX_DRAWN_POINTS,
    }


def test_every_reason_of_the_engine_is_in_the_contract() -> None:
    source = inspect.getsource(image_outline)
    raised = set(re.findall(r'InvalidImageError\(\s*"(\w+)"', source))
    assert raised == set(get_args(ImageReason))


def test_outline_edit_fixtures_are_valid_bodies() -> None:
    # TASK-079, ADR-0074: a line drawn on an outline, and what it gives.
    request = _load("image-outline-edit-request.json")
    assert set(request) == _names(ImageOutlineEditRequestBody)
    ImageOutlineEditRequestBody.model_validate(request)
    edited = _load("image-outline-edited.json")
    assert set(edited) == _names(ImageOutlineBody)
    assert len(ImageOutlineBody.model_validate(edited).strokes) == 1
    error = _load("outline-edit-error.json")
    assert set(error["error"]) == _names(ErrorDetail)
    assert ErrorBody.model_validate(error).error.reason == "short"


def test_the_api_answers_the_edited_outline_fixture() -> None:
    app = create_app(FileSource(FIXTURES / "unused.graphml"))
    response = TestClient(app).post(
        "/image-outline-edits", json=_load("image-outline-edit-request.json")
    )
    assert response.status_code == 200, response.json()
    assert response.json() == _load("image-outline-edited.json")


def test_edit_reasons_match_shared_types() -> None:
    assert list(get_args(EditReason)) == _load("edit-reasons.json")


def test_every_edit_reason_of_the_engine_is_in_the_contract() -> None:
    source = inspect.getsource(outline_edits)
    raised = set(re.findall(r'InvalidEditError\(\s*"(\w+)"', source))
    assert raised == set(get_args(EditReason))
    assert set(outline_edits.EDIT_REASONS) == set(get_args(EditReason))
