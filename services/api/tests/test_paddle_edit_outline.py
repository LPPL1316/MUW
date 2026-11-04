"""«Edit the drawing» on an example on a lake, then «Draw route» (TASK-382).

Before, the app sent the outline as rounded, where two sides of the strip
left by the leg from the shore met: the API answered 422 invalid_request,
«outline: the outline crosses itself», and the phone said only «Something
went wrong on our side». The app now leaves those corners out
(apps/mobile/src/mapdraw/sentOutline.ts): the body it sends for the same
route is taken, and paddled on the water. The two bodies are the app's,
checked in apps/mobile/src/mapdraw/sentOutline.test.ts.

No network: the water is the engine's lake (make_water_fixtures.py),
written in a cache folder as a download would leave it.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine import water
from route_engine.models import RouteRequest
from route_engine.paddling import water_area
from route_engine.water import FileWaterSource, OverpassWaterSource

from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app

REPO = Path(__file__).resolve().parents[3]
LAKE = REPO / "services/route-engine/tests/fixtures/water_lake.json"
CONTRACT = REPO / "packages/shared-types/fixtures"
SENT = CONTRACT / "image-route-request-paddle-edit.json"
TOUCHING = CONTRACT / "image-route-request-paddle-edit-touching.json"


@pytest.fixture(autouse=True)
def _no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    def refused(query: str) -> dict[str, Any]:
        raise AssertionError("downloaded")

    monkeypatch.setattr(water, "overpass", refused)


def _body(path: Path) -> dict[str, Any]:
    body: dict[str, Any] = json.loads(path.read_text())
    return body


def _api_on_the_lake(cache: Path, body: dict[str, Any]) -> TestClient:
    """The API, with the lake's water in `cache` under the name of the area
    a paddle from the body's start needs."""
    start = (body["start"][0], body["start"][1])
    request = RouteRequest(
        start=start, shape="heart", distance_m=body["distance_m"], activity="paddling"
    )
    bbox = water_area(request)
    elements = FileWaterSource(LAKE).elements(bbox)
    water.write_water(OverpassWaterSource(cache).path(bbox), bbox, elements)
    return TestClient(create_app(ActivityGraphs.from_cache(cache)))


def _finished(client: TestClient, job_id: str, seconds: float = 60.0) -> dict[str, Any]:
    deadline = time.monotonic() + seconds
    while True:
        answer: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if answer["status"] in ("done", "failed"):
            return answer
        assert time.monotonic() < deadline, answer
        time.sleep(0.02)


def test_the_outline_sent_before_is_the_422_the_phone_had(tmp_path: Path) -> None:
    body = _body(TOUCHING)
    assert body["activity"] == "paddling"
    answer = _api_on_the_lake(tmp_path, body).post("/image-route-jobs", json=body)
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"] == (
        "outline: the outline crosses itself: the sides starting at points "
        "1 and 38 meet"
    )


def test_the_outline_sent_now_is_paddled_on_the_lake(tmp_path: Path) -> None:
    body = _body(SENT)
    # The same request but for the outline.
    assert {**_body(TOUCHING), "outline": body["outline"]} == body
    client = _api_on_the_lake(tmp_path, body)
    answer = client.post("/image-route-jobs", json=body)
    assert answer.status_code == 202, answer.text
    job = _finished(client, answer.json()["job_id"])
    assert job["status"] == "done", job
    result = job["result"]
    assert result["shape"] is None
    assert result["points"][0] == result["points"][-1]
    assert abs(result["distance_m"] - body["distance_m"]) <= 0.1 * body["distance_m"]
