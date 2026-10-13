"""Tests for sample_pictures.py: the pictures of «Draw» and their outlines."""

from __future__ import annotations

import io
import json

import numpy as np
import pytest
from PIL import Image
from route_engine.image_outline import MAX_POINTS
from route_engine.shapes.outline import parse_outline
from sample_pictures import (
    OUTLINES_FILE,
    PICTURES,
    PICTURES_DIR,
    SIDE,
    as_prettier,
    drawn,
    traced,
)
from shapely.geometry import Polygon

# How far a corner of the app's outline may be from the engine's, in the
# [-1, 1] frame: other versions of shapely may place corners a little apart.
TOLERANCE = 0.02


@pytest.fixture(scope="module")
def outlines() -> dict[str, dict[str, object]]:
    return json.loads(OUTLINES_FILE.read_text(encoding="utf-8"))


def test_the_twelve_pictures_of_the_user_in_their_order(
    outlines: dict[str, dict[str, object]],
) -> None:
    assert list(PICTURES) == [
        "bike",
        "running_shoe",
        "dinosaur",
        "guitar",
        "eiffel_tower",
        "rocket",
        "heart_with_arrow",
        "anchor",
        "plane",
        "ice_cream",
        "balloon",
        "leaf",
    ]
    assert list(outlines) == list(PICTURES)


def test_the_outlines_are_written_as_prettier_writes_them() -> None:
    text = OUTLINES_FILE.read_text(encoding="utf-8")
    assert as_prettier(json.loads(text)) == text
    assert as_prettier({"a": [[1, -0.5], [2.25, 3]], "b": []}) == (
        '{\n  "a": [\n    [1, -0.5],\n    [2.25, 3]\n  ],\n  "b": []\n}\n'
    )


@pytest.mark.parametrize("name", list(PICTURES))
def test_a_picture_is_one_subject_the_engine_traces(name: str) -> None:
    png = drawn(name)
    with Image.open(io.BytesIO(png)) as picture:
        assert picture.size == (SIDE, SIDE)
    outline = traced(png)
    corners = len(outline["points"]) - 1  # type: ignore[arg-type]
    assert 3 <= corners <= MAX_POINTS
    assert outline["strokes"] == []
    assert outline["aspect"] == 1


@pytest.mark.parametrize("name", list(PICTURES))
def test_the_app_has_the_picture_as_drawn(name: str) -> None:
    kept = np.asarray(Image.open(PICTURES_DIR / f"{name}.png").convert("L"), float)
    now = np.asarray(Image.open(io.BytesIO(drawn(name))).convert("L"), float)
    # The same drawing: another version of Pillow may smooth an edge apart.
    assert np.mean(np.abs(kept - now)) < 1.0


@pytest.mark.parametrize("name", list(PICTURES))
def test_the_app_has_the_outline_the_engine_traces(
    name: str, outlines: dict[str, dict[str, object]]
) -> None:
    kept = outlines[name]
    now = traced((PICTURES_DIR / f"{name}.png").read_bytes())
    assert set(kept) == set(now)
    # A closed outline the engine accepts as it is sent back (ADR-0069).
    parse_outline(
        {"name": name, "source": "the app", "license": "ours", "points": kept["points"]}
    )
    shape = Polygon(kept["points"])  # type: ignore[arg-type]
    assert shape.hausdorff_distance(Polygon(now["points"])) < TOLERANCE  # type: ignore[arg-type]
    assert len(kept["image_points"]) == len(kept["points"])  # type: ignore[arg-type]
