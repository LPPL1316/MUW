"""The catalog of the gym (TASK-385, ADR-0327): gym_catalog.py, the fixture
the app follows (packages/shared-types/fixtures/gym-exercises.json) and
docs/sports/gym.md say the same exercises, kinds, scales and caps."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from shaperoute_api.gym_catalog import (
    EXERCISES,
    EXERCISES_BY_KEY,
    FIGURES,
    SCALES,
    level_of,
    measured,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURE = json.loads(
    (REPO / "packages" / "shared-types" / "fixtures" / "gym-exercises.json").read_text(
        encoding="utf-8"
    )
)
GYM_MD = (REPO / "docs" / "sports" / "gym.md").read_text(encoding="utf-8")
KINDS = {"L": "load", "B": "bodyweight", "T": "timed", "C": "cardio"}
UNITS = {"kg": 1, "rip.": 1, "s": 1, "min": 60, "h": 3600, "km": 1000}


def _catalog_rows() -> list[list[str]]:
    rows = []
    for line in GYM_MD.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) == 8 and re.fullmatch(r"[a-z0-9_]+", cells[0]):
            rows.append(cells)
    return rows


def _values(text: str) -> list[float]:
    """«40 · 80 · 120 kg», «30 s · 1 · 2 min»: each number in the unit
    written after it, or after the next one that has one."""
    values: list[float] = []
    waiting: list[float] = []
    for part in text.split("·"):
        number, *unit = part.split()
        waiting.append(float(number))
        if unit:
            values += [value * UNITS[unit[0]] for value in waiting]
            waiting = []
    assert not waiting, text
    return values


def test_the_fixture_is_the_catalog() -> None:
    assert list(FIGURES) == FIXTURE["figures"]
    assert {
        name: {"measure": s.measure, "levels": list(s.levels), "cap": s.cap}
        for name, s in SCALES.items()
    } == FIXTURE["scales"]
    kept = []
    for exercise in EXERCISES:
        row = {
            "key": exercise.key,
            "group": exercise.group,
            "kind": exercise.kind,
            "scale": exercise.scale,
        }
        if exercise.cap is not None:
            row["cap"] = exercise.cap
        if exercise.fields:
            row["fields"] = list(exercise.fields)
        kept.append(row)
    assert kept == FIXTURE["exercises"]


def test_the_catalog_is_the_one_of_the_docs() -> None:
    rows = _catalog_rows()
    assert len(rows) == len(EXERCISES) == len(EXERCISES_BY_KEY) == 91
    for cells, exercise in zip(rows, EXERCISES, strict=True):
        key, group, kind_scale = cells[0], cells[6], cells[7]
        assert exercise.key == key
        assert exercise.group == group.lower().replace(" ", "_")
        assert exercise.kind == KINDS[kind_scale[0]], key
        written = re.match(r"([LBTC])(?:-([A-Za-z]+))?", kind_scale)
        assert written is not None
        if kind_scale.startswith("L, senza scala"):
            assert exercise.scale is None
        else:
            letter, size = written.groups()
            assert exercise.scale == (letter if size is None else f"{letter}-{size}")


def test_the_scales_are_those_of_the_docs() -> None:
    table = re.search(r"\| Scala \|.*?\n\n", GYM_MD, re.S)
    assert table is not None
    for line in table.group(0).splitlines()[2:]:
        if not line.startswith("|"):
            continue
        name, levels, cap = (c.strip() for c in line.strip().strip("|").split("|"))
        scale = SCALES[name.split()[0]]
        assert list(scale.levels) == _values(levels), name
        if scale.cap is not None and ";" not in cap:
            assert [scale.cap] == _values(cap.split("(")[0]), name
    # The caps of their own, written as words in the docs.
    assert EXERCISES_BY_KEY["back_squat"].capped_at() == 510
    assert EXERCISES_BY_KEY["deadlift"].capped_at() == 510
    assert EXERCISES_BY_KEY["hip_thrust"].capped_at() == 600
    assert EXERCISES_BY_KEY["bench_press"].capped_at() == 360
    assert EXERCISES_BY_KEY["lat_pulldown"].capped_at() == 350


@pytest.mark.parametrize(
    ("key", "values", "expected"),
    [
        # A bench press of 100 kg is the fifth level, the bear.
        ("bench_press", {"reps": 1, "load_kg": 100}, 100),
        # Above the cap: a typo, counted for nothing.
        ("bench_press", {"reps": 1, "load_kg": 400}, None),
        # A load needs a rep.
        ("bench_press", {"load_kg": 100}, None),
        ("pull_up", {"reps": 12}, 12),
        ("plank", {"duration_s": 90}, 90),
        ("treadmill", {"duration_s": 1800, "distance_m": 5000}, 5000),
        ("stair_climber", {"duration_s": 1200, "floors": 80}, 1200),
        # Less weight is harder: no scale.
        ("assisted_pull_up", {"reps": 8, "load_kg": 30}, None),
    ],
)
def test_what_a_set_counts_for(
    key: str, values: dict[str, float | None], expected: float | None
) -> None:
    assert measured(EXERCISES_BY_KEY[key], values) == expected


def test_the_levels_unlock_the_figures_in_order() -> None:
    bench = EXERCISES_BY_KEY["bench_press"]
    assert [level_of(bench, kg) for kg in (10, 20, 59, 60, 100, 140, 200)] == [
        0,
        1,
        2,
        3,
        5,
        7,
        7,
    ]
    assert FIGURES[level_of(bench, 100) - 1] == "bear"
    assert level_of(EXERCISES_BY_KEY["assisted_pull_up"], 100) == 0
