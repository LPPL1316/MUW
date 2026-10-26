"""An image drawn with the pen up (TASK-297 part C, ADR-0258): with pieces
apart, its route is searched as a shape in pieces, walking between them;
without, as until now. The HTTP contract is part C2."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import pytest
from PIL import Image, ImageDraw
from route_engine.image_outline import outline_data
from route_engine.models import RouteResult
from route_engine.nearby_starts import NearbyPlan
from route_engine.network import FileSource
from route_engine.optimizer import MAX_TILT_DEG, Plan
from route_engine.shapes.outline import Outline, parse_outline

import shaperoute_api.images as images
from shaperoute_api.images import ImageRequest, image_job, plan_request

START = (46.0671, 11.1214)


def _png(hole: bool) -> bytes:
    """A dark disc on white, with a hole worth a third of it or without."""
    image = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse((60, 30, 300, 270), fill="black")
    if hole:
        draw.ellipse((110, 80, 250, 220), fill="white")
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _outline(hole: bool, pen_up: bool) -> Outline:
    return parse_outline(outline_data(_png(hole), pen_up=pen_up))


def test_the_pen_up_is_off_unless_asked() -> None:
    request = ImageRequest(start=START, outline=_outline(True, True), distance_m=5000)
    assert request.pen_up is False
    job = image_job(request)
    assert job.word is None and len(job.shape) == images.SHAPE_POINTS + 1


def test_an_image_with_pieces_is_searched_as_a_shape_in_pieces() -> None:
    outline = _outline(hole=True, pen_up=True)
    assert outline.in_pieces
    request = ImageRequest(
        start=START, outline=outline, distance_m=12000, pen_up=True, activity="cycling"
    )
    job = image_job(request)
    assert job.name == "image" and job.activity == "cycling"
    assert job.distance_m == 12000 and job.max_tilt_deg == MAX_TILT_DEG
    assert job.word is not None
    assert job.word.pen_up and job.word.kind == "piece"
    assert len(job.word.letters) == 2  # the outline, then the hole
    assert job.shape == tuple(job.word.points)


def test_without_pieces_the_pen_up_draws_the_outline_as_until_now() -> None:
    outline = _outline(hole=False, pen_up=True)
    assert not outline.in_pieces
    request = ImageRequest(start=START, outline=outline, distance_m=5000, pen_up=True)
    job = image_job(request)
    assert job.word is None and len(job.shape) == images.SHAPE_POINTS + 1
    assert job == image_job(ImageRequest(start=START, outline=outline, distance_m=5000))


def test_the_route_of_an_image_in_pieces_names_no_word_and_keeps_the_walks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called: dict[str, Any] = {}

    def plan_nearby(job: Any, start: Any, source: Any) -> Any:
        called.update(job=job, start=start)
        result = RouteResult(
            points=[START, (46.068, 11.122), (46.069, 11.123), START],
            distance_m=5100.0,
            similarity=0.8,
            shape=None,
            word=job.word.text,
            walks=[(1, 2)],
        )
        return NearbyPlan(Plan(result=result, search=None), 0, [])

    monkeypatch.setattr(images, "plan_nearby", plan_nearby)
    request = ImageRequest(
        start=START, outline=_outline(True, True), distance_m=5000, pen_up=True
    )
    plan = plan_request(request, FileSource(Path("unused.graphml")))
    assert called["job"].word is not None and called["start"] == START
    assert plan.result.word is None and plan.result.shape is None
    assert list(plan.result.walks) == [(1, 2)]
