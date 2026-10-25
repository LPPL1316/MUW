"""draw_examples: a city's examples asked as a phone asks, before any phone."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteRequest, RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan

from shaperoute_api import draw_examples
from shaperoute_api.app import create_app
from shaperoute_api.cities import CitySearch
from shaperoute_api.draw_examples import Call, Drawn, draw_city, draw_spot
from shaperoute_api.graphs import MapDataUnavailableError
from shaperoute_api.route_store import RouteStore
from shaperoute_api.water_spots import WaterSpot

ROVERETO = {
    "name": "Rovereto",
    "city": "Rovereto",
    "state": "Trentino-Alto Adige",
    "country": "Italy",
    "lat": 45.8906,
    "lon": 11.0401,
    "result_type": "city",
}


def planner(request: RouteRequest, source: GraphLoader) -> Plan:
    if request.shape == "heart" and request.start[0] > 46:
        raise MapDataUnavailableError("no Overpass")
    result = RouteResult(
        points=[request.start, (45.8915, 11.0420), request.start],
        distance_m=5100.0,
        similarity=0.9,
        shape=request.shape,
    )
    return Plan(result=result, search=None)


def over(client: TestClient) -> Call:
    """The command's calls, answered by the app under test."""

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        response = client.request(method, path, json=body)
        return response.status_code, response.json() if response.content else None

    return call


def api(tmp_path: Path, results: list[dict[str, Any]]) -> TestClient:
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            planner=planner,
            cities=CitySearch("K", fetch=lambda url: {"results": results}),
            route_store=RouteStore(tmp_path / "routes", engine="engine-a"),
        )
    )


def test_a_city_is_drawn_once_and_then_found_kept(tmp_path: Path) -> None:
    with api(tmp_path, [ROVERETO]) as client:
        first = draw_city("Rovereto", over(client), sleep=lambda s: None)
        assert first.label == "Rovereto, Trentino-Alto Adige, Italy"
        assert first.shapes == {"circle": "drawn", "heart": "drawn", "star": "drawn"}
        # The circle first, as the app asks them: its zone holds the others'.
        assert list(first.shapes) == ["circle", "heart", "star"]
        assert first.ready
        again = draw_city("Rovereto", over(client), sleep=lambda s: None)
        assert again.shapes == {"circle": "kept", "heart": "kept", "star": "kept"}
        assert again.line().startswith(
            "Rovereto, Trentino-Alto Adige, Italy: circle kept, heart kept, star kept"
        )


def test_a_city_not_found_and_a_zone_not_there_say_so(tmp_path: Path) -> None:
    with api(tmp_path, []) as client:
        nowhere = draw_city("Xyzzy", over(client), sleep=lambda s: None)
    assert nowhere.label is None and not nowhere.ready
    assert nowhere.line() == "Xyzzy: not found by the city search"

    north = {**ROVERETO, "name": "Bolzano", "city": "Bolzano", "lat": 46.4983}
    with api(tmp_path, [north]) as client:
        bolzano = draw_city("Bolzano", over(client), sleep=lambda s: None)
    # The circle is drawn; without the zone the star is not even asked.
    assert bolzano.shapes == {"circle": "drawn", "heart": "map_data_unavailable"}
    assert not bolzano.ready


def test_a_city_search_that_did_not_answer_is_asked_again(tmp_path: Path) -> None:
    """TASK-288: a 503 of GET /cities is the service failing, not a city it
    did not find: asked again a moment later."""
    answers = iter([OSError("slow"), OSError("slow"), {"results": [ROVERETO]}])

    def geoapify(url: str) -> Any:
        answer = next(answers)
        if isinstance(answer, Exception):
            raise answer
        return answer

    slept: list[float] = []
    client = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            planner=planner,
            cities=CitySearch("K", fetch=geoapify),
            route_store=RouteStore(tmp_path / "routes", engine="engine-a"),
        )
    )
    with client:
        drawn = draw_city("Rovereto", over(client), sleep=slept.append)
    assert drawn.label == "Rovereto, Trentino-Alto Adige, Italy" and drawn.ready
    assert slept[:2] == [draw_examples.CITY_SEARCH_WAIT_S] * 2


def test_a_city_search_that_never_answers_says_so_not_not_found() -> None:
    asked: list[str] = []

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        asked.append(f"{method} {path}")
        return 503, {"error": {"code": "http_error", "message": "try again"}}

    slept: list[float] = []
    drawn = draw_city("Rovereto", call, sleep=slept.append)
    retries = draw_examples.CITY_SEARCH_RETRIES
    assert asked == ["GET /cities?q=Rovereto"] * (1 + retries)
    assert slept == [draw_examples.CITY_SEARCH_WAIT_S] * retries
    assert drawn.label is None and not drawn.ready
    assert drawn.line() == "Rovereto: the city search did not answer (http_503)"


def test_too_many_requests_waits_as_long_as_the_api_says() -> None:
    slept: list[float] = []
    posts = iter(
        [
            (429, {"retry_after_s": "12"}),
            (202, {"job_id": "a", "status": "done"}),
            (202, {"job_id": "b", "status": "done"}),
            (202, {"job_id": "c", "status": "queued"}),
        ]
    )

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        if path.startswith("/cities"):
            return 200, {"places": [{"label": "Rovereto", "point": [45.89, 11.04]}]}
        if method == "POST":
            return next(posts)
        return 200, {"job_id": "c", "status": "failed", "error": {"code": "x"}}

    drawn = draw_city("Rovereto", call, sleep=slept.append)
    assert slept == [12.0, draw_examples.POLL_S]
    assert drawn.shapes == {"circle": "kept", "heart": "kept", "star": "x"}


def test_the_command_counts_the_cities_ready(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    asked: list[tuple[str, str | None]] = []

    def fake_http(api: str, key: str | None) -> Call:
        asked.append((api, key))
        return lambda method, path, body: (503, None)

    monkeypatch.setattr(draw_examples, "http_call", fake_http)
    monkeypatch.setattr(
        draw_examples,
        "draw_city",
        lambda city, call: Drawn(
            city, label=city, shapes={"heart": "kept" if city == "Rome" else "timeout"}
        ),
    )
    monkeypatch.setenv(draw_examples.KEY_VARIABLE, "a-key-only-for-this-test")
    assert draw_examples.main(["--api", "http://api", "Rome", "Rovereto"]) == 1
    assert asked == [("http://api", "a-key-only-for-this-test")]
    out = capsys.readouterr().out
    assert "Rovereto: heart timeout (0 s)" in out
    assert "1 of 2 cities have their examples" in out
    assert "a-key-only-for-this-test" not in out


LAKE = WaterSpot("Lago di Levico", (46.00869, 11.27722), 1500)


def test_a_point_on_the_water_asks_the_eight_shapes_as_a_phone() -> None:
    bodies: list[dict[str, Any]] = []

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        assert (method, path) == ("POST", "/route-jobs") and body is not None
        bodies.append(body)
        if body["shape"] == "horse":
            return 422, {"error": {"code": "shape_not_drawable"}}
        return 202, {"job_id": "j", "status": "done"}

    drawn = draw_spot(LAKE, call, sleep=lambda s: None)
    assert drawn.label == "Lago di Levico (46.0087,11.2772)"
    # The app's DRAW_ORDER, the point's distance, on the water.
    assert [b["shape"] for b in bodies] == [
        "circle",
        "heart",
        "star",
        "moon",
        "horse",
        "snail",
        "dog_head",
        "rabbit_head",
    ]
    assert all(b["distance_m"] == 1500 for b in bodies)
    assert all(b["start"] == [46.00869, 11.27722] for b in bodies)
    assert all(b["activity"] == "paddling" for b in bodies)
    # The shapes in pieces with the pen up, as the app asks them.
    assert [b["shape"] for b in bodies if b.get("pen_up")] == [
        "dog_head",
        "rabbit_head",
    ]
    assert drawn.shapes["horse"] == "shape_not_drawable"
    assert not drawn.ready


def test_a_point_without_water_on_the_api_stops_at_its_first_shape() -> None:
    asked: list[str] = []

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        assert body is not None
        asked.append(body["shape"])
        return 503, {"error": {"code": "map_data_unavailable"}}

    drawn = draw_spot(LAKE, call, sleep=lambda s: None)
    assert asked == ["circle"]
    assert drawn.shapes == {"circle": "map_data_unavailable"}


def test_the_points_on_the_water_are_one_a_square_and_by_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spots = [
        WaterSpot("Lago di Levico", (46.00869, 11.27722), 2000),
        WaterSpot("Lago di Levico", (46.008691, 11.277221), 2000),
        WaterSpot("Lago di Caldonazzo", (46.0213, 11.2442), 2000),
    ]
    monkeypatch.setattr(draw_examples, "read_spots", lambda: spots)
    assert draw_examples.water_spots() == [spots[0], spots[2]]
    assert draw_examples.water_spots(["lago di caldonazzo"]) == [spots[2]]


def test_the_command_draws_cities_and_points_on_the_water(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(draw_examples, "http_call", lambda api, key: None)
    monkeypatch.setattr(draw_examples, "read_spots", lambda: [LAKE])
    monkeypatch.setattr(
        draw_examples,
        "draw_city",
        lambda city, call: Drawn(city, label=city, shapes={"heart": "kept"}),
    )
    monkeypatch.setattr(
        draw_examples,
        "draw_spot",
        lambda spot, call: Drawn(spot.name, label=spot.name, shapes={"moon": "drawn"}),
    )
    assert draw_examples.main(["--api", "http://api", "Rome", "--water"]) == 0
    assert capsys.readouterr().out.splitlines() == [
        "Rome: heart kept (0 s)",
        "Lago di Levico: moon drawn (0 s)",
        "1 of 1 cities have their examples",
        "1 of 1 points on the water have their shapes",
    ]
    # A name that is not in the lists: nothing to draw.
    with pytest.raises(SystemExit):
        draw_examples.main(["--api", "http://api", "--water-name", "Garda"])
