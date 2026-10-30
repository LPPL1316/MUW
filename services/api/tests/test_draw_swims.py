"""draw_examples --swim (TASK-323 C4): the points of the lakes and beaches
swum, as «Explore» asks them with «Open water swim», before any phone."""

from __future__ import annotations

from typing import Any

import pytest

from shaperoute_api import draw_examples
from shaperoute_api.draw_examples import Drawn, draw_swim
from shaperoute_api.water_spots import WaterSpot

# A small lake's point: its paddle is shorter, the swim is not.
LAKE = WaterSpot("Lago di Levico", (46.00869, 11.27722), 1500)


def test_a_point_is_swum_as_the_app_asks_its_eight_shapes() -> None:
    bodies: list[dict[str, Any]] = []

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        assert (method, path) == ("POST", "/route-jobs") and body is not None
        bodies.append(body)
        return 202, {"job_id": "j", "status": "done"}

    drawn = draw_swim(LAKE, call, sleep=lambda s: None)
    assert drawn.label == "Lago di Levico swum (46.0087,11.2772)"
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
    # The app's SWIM_EXAMPLES: 1 km whatever the point, swum, no laps asked.
    assert all(b["distance_m"] == 1000 and b["activity"] == "swimming" for b in bodies)
    assert all("laps" not in b for b in bodies)
    assert [b["shape"] for b in bodies if b.get("pen_up")] == [
        "dog_head",
        "rabbit_head",
    ]
    assert drawn.ready


def test_a_shape_that_does_not_fit_within_150_m_is_an_answer() -> None:
    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        assert body is not None
        if body["shape"] == "horse":
            return 202, {
                "job_id": "j",
                "status": "failed",
                "error": {"code": "shape_not_drawable"},
            }
        return 202, {"job_id": "j", "status": "done"}

    drawn = draw_swim(LAKE, call, sleep=lambda s: None)
    assert drawn.shapes["horse"] == "shape_not_drawable"
    assert drawn.ready
    # On the paddle it is not.
    assert not Drawn("x", label="x", shapes={"horse": "shape_not_drawable"}).ready


def test_a_point_without_water_on_the_api_stops_at_its_first_shape() -> None:
    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        return 503, {"error": {"code": "map_data_unavailable"}}

    drawn = draw_swim(LAKE, call, sleep=lambda s: None)
    assert drawn.shapes == {"circle": "map_data_unavailable"}
    assert not drawn.ready


def test_the_command_swims_the_points_and_paddles_them_only_when_asked(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(draw_examples, "http_call", lambda api, key: None)
    monkeypatch.setattr(draw_examples, "read_spots", lambda: [LAKE])
    paddled: list[str] = []
    monkeypatch.setattr(
        draw_examples,
        "draw_spot",
        lambda spot, call: paddled.append(spot.name) or Drawn(spot.name, label="p"),
    )
    monkeypatch.setattr(
        draw_examples,
        "draw_swim",
        lambda spot, call: Drawn(spot.name, label=spot.name, shapes={"moon": "drawn"}),
    )
    assert draw_examples.main(["--api", "http://api", "--swim"]) == 0
    assert capsys.readouterr().out.splitlines() == [
        "Lago di Levico: moon drawn (0 s)",
        "1 of 1 points have their swims",
    ]
    # --water-name with --swim names the points to swim, not to paddle.
    assert (
        draw_examples.main(
            ["--api", "http://api", "--swim", "--water-name", "Lago di Levico"]
        )
        == 0
    )
    assert paddled == []
    # Without --swim it is the paddle's, as before.
    draw_examples.main(["--api", "http://api", "--water-name", "Lago di Levico"])
    assert paddled == ["Lago di Levico"]
