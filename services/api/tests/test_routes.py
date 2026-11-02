"""POST /routes end to end, and every error the API can return (docs/API.md)."""

from __future__ import annotations

from dataclasses import fields
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteRequest, RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan, ShapeNotDrawableError
from route_engine.validation import InvalidRouteError

from shaperoute_api.app import create_app
from shaperoute_api.graphs import MapDataUnavailableError

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"

LEVICO_CIRCLE = {
    "start": [46.0122, 11.2986],
    "shape": "circle",
    "distance_m": 1500,
    "activity": "running",
}

TRENTO_HEART = {
    "start": [46.0671, 11.1214],
    "shape": "heart",
    "distance_m": 5000,
    "activity": "running",
}


def failing_with(exc: Exception):  # type: ignore[no-untyped-def]
    def planner(request: RouteRequest, source: GraphLoader) -> Plan:
        raise exc

    return planner


def client_failing_with(exc: Exception) -> TestClient:
    app = create_app(source=FileSource(LEVICO_GRAPH), planner=failing_with(exc))
    # A 500 is an answer to check here, not an error of the test.
    return TestClient(app, raise_server_exceptions=False)


def test_health() -> None:
    client = TestClient(create_app(FileSource(LEVICO_GRAPH)))
    assert client.get("/health").json() == {"status": "ok"}


def test_a_route_on_the_levico_test_graph() -> None:
    # The only real run of the engine here: about 5 s.
    client = TestClient(create_app(FileSource(LEVICO_GRAPH)))
    response = client.post("/routes", json=LEVICO_CIRCLE)
    assert response.status_code == 200
    body = response.json()
    # The API adds where the drawing was placed (TASK-347): the engine has not.
    assert set(body) == {f.name for f in fields(RouteResult)} | {"placed_outline"}
    assert body["shape"] == "circle"
    assert body["points"][0] == body["points"][-1]
    assert len(body["points"]) > 10
    assert 0.0 <= body["similarity"] <= 1.0
    assert body["distance_m"] > 0


@pytest.mark.parametrize(
    ("body", "fragment"),
    [
        ({k: v for k, v in TRENTO_HEART.items() if k != "distance_m"}, "distance_m"),
        ({**TRENTO_HEART, "distance": 5000}, "distance"),
        ({**TRENTO_HEART, "start": [46.0671]}, "start"),
        ({**TRENTO_HEART, "distance_m": "far"}, "distance_m"),
        ({**TRENTO_HEART, "distance_m": 100}, "distance must be between"),
        ({**TRENTO_HEART, "shape": "house"}, "unknown shape 'house'"),
        ({**TRENTO_HEART, "start": [91.0, 11.1]}, "latitude must be between"),
        # A shape or a word, one of the two, and a word the engine can write
        # (TASK-056).
        ({**TRENTO_HEART, "word": "ciao"}, "either a shape or a word"),
        ({**TRENTO_HEART, "shape": None}, "either a shape or a word"),
        (
            {**TRENTO_HEART, "shape": None, "word": "città", "distance_m": 15000},
            "no letter À: a word can use only the letters A to Z",
        ),
        (
            {**TRENTO_HEART, "shape": None, "word": "ciao"},
            "a 4-letter word needs at least 12 km",
        ),
        # The letters' style, only for a word (TASK-080).
        ({**TRENTO_HEART, "style": "block"}, "a style is for the letters of a word"),
        (
            {
                **TRENTO_HEART,
                "shape": None,
                "word": "ciao",
                "distance_m": 15000,
                "style": "italic",
            },
            "unknown style 'italic'",
        ),
    ],
)
def test_invalid_requests(body: dict[str, object], fragment: str) -> None:
    client = client_failing_with(AssertionError("the engine must not run"))
    response = client.post("/routes", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert fragment in response.json()["error"]["message"]


def test_malformed_json() -> None:
    client = client_failing_with(AssertionError("the engine must not run"))
    response = client.post(
        "/routes", content=b"{not json", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


@pytest.mark.parametrize(
    ("exc", "status", "code", "message"),
    [
        (
            ShapeNotDrawableError("a 5 km heart cannot be drawn here: too few roads"),
            422,
            "shape_not_drawable",
            "a 5 km heart cannot be drawn here: too few roads",
        ),
        (
            MapDataUnavailableError("OpenStreetMap data could not be downloaded"),
            503,
            "map_data_unavailable",
            "OpenStreetMap data could not be downloaded",
        ),
        (
            InvalidRouteError("the route does not close"),
            500,
            "engine_error",
            "The route engine failed; see the API log.",
        ),
        (
            KeyError("anything unexpected"),
            500,
            "engine_error",
            "The route engine failed; see the API log.",
        ),
    ],
)
def test_engine_errors(exc: Exception, status: int, code: str, message: str) -> None:
    response = client_failing_with(exc).post("/routes", json=TRENTO_HEART)
    assert response.status_code == status
    assert response.json() == {
        "error": {
            "code": code,
            "message": message,
            "suggested_distance_m": None,
            "reason": None,
        }
    }


def test_unknown_paths_use_the_same_error_shape() -> None:
    response = client_failing_with(AssertionError()).get("/nowhere")
    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "http_error",
            "message": "Not Found",
            "suggested_distance_m": None,
            "reason": None,
        }
    }


@pytest.mark.parametrize(
    ("best_m", "suggested"),
    [(4_300.0, 4_000), (4_600.0, 5_000), (300.0, 1_000), (61_000.0, 50_000)],
)
def test_a_shape_that_misses_the_distance_suggests_one(
    best_m: float, suggested: int
) -> None:
    exc = ShapeNotDrawableError("a 7 km heart cannot be drawn here", best_m)
    response = client_failing_with(exc).post("/routes", json=TRENTO_HEART)
    assert response.status_code == 422
    assert response.json()["error"]["suggested_distance_m"] == suggested
