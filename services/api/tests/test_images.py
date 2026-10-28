"""Images in the API (TASK-073, ADR-0069): POST /image-outlines traces the
outline with the engine, POST /image-route-jobs draws it. Every image is
drawn here with Pillow: no image files in the repository."""

from __future__ import annotations

import base64
import io
import json
import math
import random
import time
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from route_engine.models import (
    PEN_UP_WITHOUT_WORD,
    InvalidRequestError,
    RouteRequest,
    RouteResult,
)
from route_engine.nearby_starts import NearbyPlan
from route_engine.network import FileSource
from route_engine.optimizer import MAX_TILT_DEG, GraphLoader, Plan
from shapely.geometry import Polygon

import shaperoute_api.images as images
from shaperoute_api.app import create_app
from shaperoute_api.images import (
    PEN_UP_WITHOUT_PIECES,
    PIECES_WITHOUT_PEN_UP,
    AnyRequest,
    ImageRequest,
    outline_of,
    plan_request,
)

FIXTURES = (
    Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "fixtures"
)
START = [46.0671, 11.1214]
RESULT = RouteResult(
    points=[(46.0671, 11.1214), (46.0680, 11.1220), (46.0671, 11.1214)],
    distance_m=14800.0,
    similarity=0.93,
    shape=None,
    warnings=[],
)
SQUARE = [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0]]


def _png(image: Image.Image, kind: str = "PNG", **options: object) -> str:
    buffer = io.BytesIO()
    image.save(buffer, kind, **options)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _disc(size: tuple[int, int] = (400, 300)) -> Image.Image:
    """A dark disc in the left half of a white picture."""
    image = Image.new("RGB", size, "white")
    ImageDraw.Draw(image).ellipse((60, 70, 220, 230), fill="black")
    return image


@pytest.fixture
def client() -> Iterator[tuple[TestClient, list[AnyRequest]]]:
    asked: list[AnyRequest] = []

    def planner(request: AnyRequest, source: GraphLoader) -> Plan:
        asked.append(request)
        return Plan(result=RESULT, search=None)

    app = create_app(
        FileSource(Path("unused.graphml")),
        planner=planner,
        now=lambda: datetime(2026, 9, 26, 10, 0, tzinfo=UTC),
    )
    with TestClient(app) as test_client:
        yield test_client, asked


def _finished(client: TestClient, job_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.01)


def test_an_image_gives_its_outline_for_the_route_and_for_the_picture(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    response = http.post("/image-outlines", json={"image": _png(_disc())})
    assert response.status_code == 200, response.json()
    body = response.json()
    assert set(body) == {
        "points",
        "image_points",
        "aspect",
        "strokes",
        "image_strokes",
        "pieces",
        "image_pieces",
    }
    assert body["strokes"] == [] and body["image_strokes"] == []
    # One subject without holes: nothing to draw with the pen up (TASK-297).
    assert body["pieces"] == [] and body["image_pieces"] == []
    assert body["aspect"] == pytest.approx(4 / 3, rel=1e-4)
    points, over = body["points"], body["image_points"]
    assert points[0] == points[-1]
    assert len(points) == len(over)
    assert 8 <= len(points) - 1 <= images.MAX_POINTS
    # Normalized: centred, the longer side from -1 to 1.
    xs, ys = [x for x, _ in points], [y for _, y in points]
    assert max(xs) == pytest.approx(1) and min(xs) == pytest.approx(-1)
    assert max(ys) == pytest.approx(1, abs=0.02)
    # Over the picture: the disc, 60-220 of 400 across and 70-230 of 300 down.
    drawn = Polygon([(x * 400, y * 300) for x, y in over])
    disc = Polygon(
        [
            (
                140 + 80 * math.cos(a / 50 * math.tau),
                150 + 80 * math.sin(a / 50 * math.tau),
            )
            for a in range(50)
        ]
    )
    assert drawn.intersection(disc).area / drawn.union(disc).area > 0.95


def test_two_subjects_come_back_as_a_stroke_and_go_on_to_the_route_and_the_edits(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    """TASK-084: the second subject is a stroke with a loop, over the picture
    too; the route request and an edit take it as it is."""
    http, asked = client
    image = _disc()
    ImageDraw.Draw(image).ellipse((280, 100, 380, 200), fill="black")
    response = http.post("/image-outlines", json={"image": _png(image)})
    assert response.status_code == 200, response.json()
    outline = response.json()
    [stroke], [over] = outline["strokes"], outline["image_strokes"]
    assert len(stroke) == len(over)
    assert stroke[1] == stroke[-1] and over[1] == over[-1]
    # Over the picture: the stem across the gap, then the second disc.
    (x0, _), (x1, _) = over[0], over[1]
    assert x0 * 400 == pytest.approx(220, abs=4)
    assert x1 * 400 == pytest.approx(280, abs=4)
    second = Polygon([(x * 400, y * 300) for x, y in over[1:]])
    assert second.contains(Polygon([(320, 140), (340, 140), (330, 160)]))
    xs = [x for x, _ in [*outline["points"], *stroke]]
    assert max(xs) == pytest.approx(1) and min(xs) == pytest.approx(-1)

    response = http.post(
        "/image-route-jobs",
        json={
            "start": START,
            "outline": outline["points"],
            "strokes": outline["strokes"],
            "distance_m": 15000,
        },
    )
    assert response.status_code == 202, response.json()
    assert _finished(http, response.json()["job_id"])["status"] == "done"
    [request] = asked
    assert isinstance(request, ImageRequest)
    assert len(request.outline.strokes) == 1

    # A detail drawn from the second subject hangs on it.
    response = http.post(
        "/image-outline-edits",
        json={
            "image_points": outline["image_points"],
            "image_strokes": outline["image_strokes"],
            "aspect": outline["aspect"],
            "kind": "detail",
            "line": [[0.825, 0.34], [0.825, 0.2], [0.85, 0.1]],
        },
    )
    assert response.status_code == 200, response.json()
    edited = response.json()
    assert len(edited["strokes"]) == 2
    assert edited["image_strokes"][0] == over


def test_a_large_photo_turned_by_exif_gives_the_upright_aspect(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    # Stored 1600 x 1200, shown on its side: 1200 x 1600.
    photo = _disc((1600, 1200)).transpose(Image.Transpose.ROTATE_270)
    stored = photo.transpose(Image.Transpose.ROTATE_90)
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90° clockwise to show
    image = _png(stored, "JPEG", exif=exif, quality=90)
    body = http.post("/image-outlines", json={"image": image}).json()
    assert body["aspect"] == pytest.approx(3 / 4, rel=1e-4)
    over = Polygon(body["image_points"])
    assert 0 < over.bounds[0] and over.bounds[2] < 1
    assert 0 < over.bounds[1] and over.bounds[3] < 1


@pytest.mark.parametrize(
    ("draw", "reason"),
    [
        ("noise", "background"),
        ("five", "scattered"),
        ("empty", "no_subject"),
        ("gif", "format"),
    ],
)
def test_an_image_without_one_clear_subject_is_refused_with_the_reason(
    client: tuple[TestClient, list[AnyRequest]], draw: str, reason: str
) -> None:
    http, _ = client
    kind = "PNG"
    image = Image.new("RGB", (400, 300), "white")
    pen = ImageDraw.Draw(image)
    if draw == "noise":
        rng = random.Random(7)
        image.putdata(
            [(rng.randrange(256),) * 3 for _ in range(image.width * image.height)]
        )
    elif draw == "five":  # one more than can be joined in one line
        for k in range(5):
            pen.ellipse((15 + 76 * k, 120, 65 + 76 * k, 170), fill="black")
    elif draw == "gif":
        pen.ellipse((60, 70, 220, 230), fill="black")
        kind = "GIF"
    response = http.post("/image-outlines", json={"image": _png(image, kind)})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "image_not_usable"
    assert error["reason"] == reason
    assert error["suggested_distance_m"] is None
    assert error["message"]


def test_not_base64_is_an_invalid_request(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    response = http.post("/image-outlines", json={"image": "not base64!"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert "base64" in response.json()["error"]["message"]


def test_an_image_over_the_limit_is_an_invalid_request(
    client: tuple[TestClient, list[AnyRequest]], monkeypatch: pytest.MonkeyPatch
) -> None:
    http, _ = client
    monkeypatch.setattr(images, "MAX_IMAGE_BYTES", 1_000)
    response = http.post("/image-outlines", json={"image": _png(_disc())})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert "at most" in response.json()["error"]["message"]


def test_base64_longer_than_the_limit_is_refused_before_decoding(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    too_long = "A" * (images.MAX_IMAGE_BYTES // 3 * 4 + 8)
    response = http.post("/image-outlines", json={"image": too_long})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_the_outline_comes_back_as_an_image_route_job(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, asked = client
    outline = http.post("/image-outlines", json={"image": _png(_disc())}).json()
    response = http.post(
        "/image-route-jobs",
        json={"start": START, "outline": outline["points"], "distance_m": 15000},
    )
    assert response.status_code == 202, response.json()
    body = _finished(http, response.json()["job_id"])
    assert body["status"] == "done"
    assert body["result"]["shape"] is None
    assert body["result"]["word"] is None
    [request] = asked
    assert isinstance(request, ImageRequest)
    assert request.name == "image"
    assert request.distance_m == 15000
    assert len(request.outline.points) == len(outline["points"])


@pytest.mark.parametrize(
    ("outline", "words"),
    [
        (SQUARE[:-1], "open"),
        ([[-1, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], "crosses itself"),
        ([[0, 0], [2, 0], [0, 2], [0, 0]], "within [-1, 1]"),
        ([[0, 0], [1, 0], [0, 0], [0, 0]], "at least 3"),
    ],
)
def test_an_outline_that_is_not_one_is_an_invalid_request(
    client: tuple[TestClient, list[AnyRequest]], outline: list[Any], words: str
) -> None:
    http, asked = client
    response = http.post(
        "/image-route-jobs",
        json={"start": START, "outline": outline, "distance_m": 15000},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert words in error["message"]
    assert asked == []


def test_an_outline_with_too_many_corners_is_an_invalid_request(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    n = images.MAX_POINTS + 1
    ring = [[math.cos(k / n * math.tau), math.sin(k / n * math.tau)] for k in range(n)]
    response = http.post(
        "/image-route-jobs",
        json={"start": START, "outline": [*ring, ring[0]], "distance_m": 15000},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_start_and_distance_are_checked_as_for_a_shape(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    for body in (
        {"start": [95.0, 11.1], "outline": SQUARE, "distance_m": 15000},
        {"start": START, "outline": SQUARE, "distance_m": 500},
        {"start": START, "outline": SQUARE, "distance_m": 15000, "shape": "heart"},
    ):
        response = http.post("/image-route-jobs", json=body)
        assert response.status_code == 422, body
        assert response.json()["error"]["code"] == "invalid_request"


def test_points_that_are_not_finite_are_refused() -> None:
    with pytest.raises(InvalidRequestError, match="finite"):
        outline_of([(0.0, 0.0), (math.nan, 0.0), (0.0, 1.0), (0.0, 0.0)])
    with pytest.raises(InvalidRequestError, match="finite"):
        outline_of([(0.0, 0.0), (math.inf, 0.0), (0.0, 1.0), (0.0, 0.0)])


def test_an_image_route_is_planned_upright_and_names_no_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called: dict[str, Any] = {}

    def plan_nearby(job: Any, start: Any, source: Any) -> Any:
        called.update(job=job, start=start)

        def planned(similarity: float) -> Plan:
            result = RouteResult(
                points=RESULT.points,
                distance_m=15100.0,
                similarity=similarity,
                shape=job.name,
            )
            return Plan(result=result, search=None)

        plan = Plan(planned(0.9).result, None, alternatives=[planned(0.85)])
        return NearbyPlan(plan, 0, [])

    monkeypatch.setattr(images, "plan_nearby", plan_nearby)
    request = ImageRequest(
        start=(46.0671, 11.1214), outline=outline_of(SQUARE), distance_m=15000
    )
    plan = plan_request(request, FileSource(Path("unused.graphml")))
    job = called["job"]
    assert job.name == "image"
    assert job.max_tilt_deg == MAX_TILT_DEG
    assert len(job.shape) == images.SHAPE_POINTS + 1
    assert called["start"] == (46.0671, 11.1214)
    # The nearby starts give an image its alternatives too (TASK-093).
    for planned in (plan, *plan.alternatives):
        assert planned.result.shape is None
        assert planned.result.word is None
    assert [p.result.similarity for p in plan.alternatives] == [0.85]


def test_the_gpx_of_an_image_route_is_named_image(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, _ = client
    result = {
        "points": [list(p) for p in RESULT.points],
        "distance_m": RESULT.distance_m,
        "similarity": RESULT.similarity,
        "shape": None,
        "warnings": [],
        "directions": [],
        "word": None,
    }
    response = http.post(
        "/gpx",
        json={
            "request": {"start": START, "outline": SQUARE, "distance_m": 15000},
            "result": result,
        },
    )
    assert response.status_code == 200, response.text
    disposition = response.headers["content-disposition"]
    assert 'filename="sgrava-image-15km-2026-09-26.gpx"' in disposition


def test_a_shape_or_a_word_is_planned_with_nearby_starts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """TASK-076: the planner tries nearby starts too (ADR-0071)."""
    called: dict[str, Any] = {}
    plan = Plan(result=RESULT, search=None)

    def plan_nearby(job: Any, start: Any, source: Any) -> Any:
        called.update(job=job, start=start)
        return SimpleNamespace(plan=plan)

    monkeypatch.setattr(images, "plan_nearby", plan_nearby)
    request = RouteRequest(start=(46.0671, 11.1214), shape="heart", distance_m=10000)
    assert plan_request(request, FileSource(Path("unused.graphml"))) is plan
    assert called["start"] == request.start
    assert called["job"].name == "heart" and called["job"].distance_m == 10000


# TASK-297 part C2 (ADR-0258): an image with the pen up through the API.


def _ring() -> Image.Image:
    """A dark disc with a hole worth a third of it, on white: one subject and
    one piece, the hole, in the middle of the picture."""
    image = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse((80, 30, 320, 270), fill="black")
    draw.ellipse((130, 80, 270, 220), fill="white")
    return image


def _fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_an_image_with_a_hole_gives_its_piece_for_the_route_and_the_picture(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    http, asked = client
    response = http.post("/image-outlines", json={"image": _png(_ring())})
    assert response.status_code == 200, response.json()
    outline = response.json()
    # With the pen down the hole is left out, as before.
    assert outline["strokes"] == [] and outline["image_strokes"] == []
    [piece], [over] = outline["pieces"], outline["image_pieces"]
    assert len(piece) == len(over) and piece[0] == piece[-1]
    # In the frame of points: the ring of the disc from -1 to 1.
    assert all(abs(x) < 0.7 and abs(y) < 0.7 for x, y in piece)
    # Over the picture: the hole, 130-270 of 400 across and 80-220 of 300 down.
    drawn = Polygon([(x * 400, y * 300) for x, y in over])
    hole = Polygon(
        [
            (
                200 + 70 * math.cos(a / 50 * math.tau),
                150 + 70 * math.sin(a / 50 * math.tau),
            )
            for a in range(50)
        ]
    )
    assert drawn.intersection(hole).area / drawn.union(hole).area > 0.9

    response = http.post(
        "/image-route-jobs",
        json={
            "start": START,
            "outline": outline["points"],
            "pieces": outline["pieces"],
            "distance_m": 15000,
            "pen_up": True,
        },
    )
    assert response.status_code == 202, response.json()
    assert _finished(http, response.json()["job_id"])["status"] == "done"
    [request] = asked
    assert isinstance(request, ImageRequest)
    assert request.pen_up and request.outline.in_pieces
    assert len(request.outline.pieces) == 1 and request.outline.strokes == ()


def test_the_pieces_fixtures_are_what_the_api_answers_and_takes(
    client: tuple[TestClient, list[AnyRequest]],
) -> None:
    """The ImageOutline with pieces and the request with the pen up of
    packages/shared-types (the older ones are in test_contract.py)."""
    http, asked = client
    traced = images.ImageOutlineBody.model_validate(
        _fixture("image-outline-pieces.json")
    )
    assert len(traced.pieces) == len(traced.image_pieces) == 1
    body = _fixture("image-route-request-pen-up.json")
    assert set(body) == set(images.ImageRouteRequestBody.model_fields) - {"strokes"}
    assert body["outline"] == [list(p) for p in traced.points]
    assert body["pieces"] == [[list(p) for p in piece] for piece in traced.pieces]
    response = http.post("/image-route-jobs", json=body)
    assert response.status_code == 202, response.json()
    assert _finished(http, response.json()["job_id"])["status"] == "done"
    [request] = asked
    assert isinstance(request, ImageRequest) and request.pen_up


@pytest.mark.parametrize(
    ("change", "words"),
    [
        ({"pieces": []}, PEN_UP_WITHOUT_PIECES),
        ({"pen_up": False}, PIECES_WITHOUT_PEN_UP),
        # A piece over the outline: it would touch it.
        (
            {"pieces": [[[-1.2, -0.5], [0.2, -0.5], [0.0, -0.1], [-1.2, -0.5]]]},
            "within [-1, 1]",
        ),
        (
            {"pieces": [[[-0.9, -0.9], [0.9, -0.9], [0.0, 0.0], [-0.9, -0.9]]]},
            "piece 1 touches the outline",
        ),
        (
            {"pieces": [[[0.0, -0.5], [0.0, -0.4]]] * (images.MAX_PIECES + 1)},
            f"at most {images.MAX_PIECES}",
        ),
        (
            {
                "pieces": [
                    [[-0.3 + k / 1000, -0.5] for k in range(100)],
                    [[-0.3 + k / 1000, -0.3] for k in range(100)],
                ]
            },
            f"pieces: at most {images.MAX_SUBJECT_POINTS} points",
        ),
    ],
)
def test_the_pen_up_and_the_pieces_go_together_and_are_checked(
    client: tuple[TestClient, list[AnyRequest]], change: dict[str, Any], words: str
) -> None:
    http, asked = client
    body = {**_fixture("image-route-request-pen-up.json"), **change}
    response = http.post("/image-route-jobs", json=body)
    assert response.status_code == 422, response.json()
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert words in error["message"]
    assert asked == []


def test_the_pen_up_without_pieces_still_says_it_is_for_a_word() -> None:
    """The reason of before is in the new one (test_pen_up.py, TASK-197)."""
    assert PEN_UP_WITHOUT_WORD in PEN_UP_WITHOUT_PIECES


@pytest.mark.parametrize("why", ["refused", "other frame", "too many"])
def test_no_pieces_are_offered_when_the_pen_up_does_not_fit_the_outline(
    client: tuple[TestClient, list[AnyRequest]],
    monkeypatch: pytest.MonkeyPatch,
    why: str,
) -> None:
    """The pen up traces again (ADR-0258): when it fails, gives another
    outline, or more pieces than a route has walks, the outline is the one
    of before and the app offers no pen up."""
    http, _ = client
    traced = images.outline_data

    def outline_data(image: bytes, *args: Any, pen_up: bool = False, **kw: Any) -> Any:
        data = traced(image, *args, pen_up=pen_up, **kw)
        if not pen_up:
            return data
        if why == "refused":
            raise images.InvalidImageError("jagged", "the pieces are too jagged")
        if why == "other frame":
            ring = data["points"][:-1]
            data["points"] = [*ring[1:], ring[0], ring[1]]
        return data

    monkeypatch.setattr(images, "outline_data", outline_data)
    if why == "too many":
        monkeypatch.setattr(images, "MAX_PIECES", 0)
    response = http.post("/image-outlines", json={"image": _png(_ring())})
    assert response.status_code == 200, response.json()
    outline = response.json()
    assert outline["pieces"] == [] and outline["image_pieces"] == []
    assert len(outline["points"]) > 8


def test_an_image_with_the_pen_up_has_the_walks_in_its_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """As a word with the pen up (TASK-197): walks in the RouteResult, no
    word and no shape."""
    called: dict[str, Any] = {}

    def plan_nearby(job: Any, start: Any, source: Any) -> Any:
        called.update(job=job)
        result = RouteResult(
            points=[*RESULT.points[:2], (46.069, 11.123), RESULT.points[-1]],
            distance_m=15100.0,
            similarity=0.8,
            shape=None,
            word=job.word.text,
            walks=[(1, 2)],
        )
        return NearbyPlan(Plan(result=result, search=None), 0, [])

    monkeypatch.setattr(images, "plan_nearby", plan_nearby)
    app = create_app(FileSource(Path("unused.graphml")), planner=plan_request)
    with TestClient(app) as http:
        response = http.post(
            "/image-route-jobs", json=_fixture("image-route-request-pen-up.json")
        )
        assert response.status_code == 202, response.json()
        body = _finished(http, response.json()["job_id"])
    assert body["status"] == "done", body
    assert called["job"].word is not None and called["job"].word.pen_up
    result = body["result"]
    assert result["walks"] == [[1, 2]]
    assert result["word"] is None and result["shape"] is None
