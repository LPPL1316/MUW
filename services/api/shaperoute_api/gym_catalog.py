"""The exercises of a workout at the gym (TASK-385, ADR-0327,
docs/sports/gym.md): the catalog the app picks from, each with its kind of
set, and the scales of the milestones with their caps.

A set is of one of four kinds, each with its own fields: `load` (reps and
kg), `bodyweight` (reps, kg of a weight added if any), `timed` (seconds) and
`cardio` (seconds, and what its machine shows: metres, km/h, incline,
level, floors). An exercise the runner names has no key and no scale.

The same table is packages/shared-types/fixtures/gym-exercises.json, which
the app's catalog follows; test_gym_catalog.py compares the two. Above the
cap of its scale a set is kept but counts for no milestone: a typo or a
number made up, not a judgement. Loads in kg (a dumbbell's per hand),
distances in metres, times in seconds.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SetKind = Literal["load", "bodyweight", "timed", "cardio"]
Measure = Literal["load_kg", "reps", "duration_s", "distance_m"]
CardioField = Literal[
    "duration_s", "distance_m", "speed_kmh", "incline_pct", "level", "floors"
]

FIGURES: tuple[str, ...] = (
    "mouse",
    "rabbit",
    "fox",
    "wolf",
    "bear",
    "rhino",
    "gorilla",
)


@dataclass(frozen=True)
class Scale:
    """Seven levels, one figure each, and the value above which a set
    counts for none; None: each exercise of the scale says its own."""

    measure: Measure
    levels: tuple[float, ...]
    cap: float | None


@dataclass(frozen=True)
class Exercise:
    key: str
    group: str
    kind: SetKind
    scale: str | None
    """None for an exercise whose levels would read backwards (the assisted
    pull-up: less weight is harder)."""
    cap: float | None = None
    """Its own cap, over its scale's."""
    fields: tuple[CardioField, ...] = ()
    """What a cardio machine shows, besides the time."""

    def capped_at(self) -> float | None:
        if self.cap is not None:
            return self.cap
        return None if self.scale is None else SCALES[self.scale].cap


SCALES: dict[str, Scale] = {
    "L-XL": Scale("load_kg", (40, 80, 120, 160, 200, 250, 300), 1000),
    "L-big": Scale("load_kg", (40, 60, 80, 100, 140, 180, 220), None),
    "L-M": Scale("load_kg", (20, 40, 60, 80, 100, 120, 140), 350),
    "L-S": Scale("load_kg", (10, 20, 30, 40, 50, 60, 80), 200),
    "L-XS": Scale("load_kg", (4, 6, 8, 10, 14, 18, 24), 80),
    "B-hard": Scale("reps", (1, 3, 5, 10, 15, 20, 30), 150),
    "B-easy": Scale("reps", (10, 20, 30, 40, 50, 75, 100), 500),
    "T": Scale("duration_s", (30, 60, 120, 180, 300, 480, 600), 7200),
    "C-run": Scale(
        "distance_m", (1000, 3000, 5000, 10000, 15000, 21000, 42000), 100000
    ),
    "C-bike": Scale(
        "distance_m", (5000, 10000, 20000, 30000, 40000, 60000, 100000), 300000
    ),
    "C-row": Scale(
        "distance_m", (1000, 2000, 5000, 10000, 15000, 21000, 42000), 100000
    ),
    "C-time": Scale("duration_s", (300, 600, 900, 1200, 1800, 2700, 3600), 14400),
}

EXERCISES: tuple[Exercise, ...] = (
    Exercise("bench_press", "chest", "load", "L-M", cap=360),
    Exercise("incline_bench_press", "chest", "load", "L-M"),
    Exercise("decline_bench_press", "chest", "load", "L-M"),
    Exercise("dumbbell_bench_press", "chest", "load", "L-XS"),
    Exercise("dumbbell_fly", "chest", "load", "L-XS"),
    Exercise("chest_press_machine", "chest", "load", "L-M"),
    Exercise("pec_deck", "chest", "load", "L-S"),
    Exercise("cable_crossover", "chest", "load", "L-S"),
    Exercise("push_up", "chest", "bodyweight", "B-easy"),
    Exercise("dips", "chest", "bodyweight", "B-hard"),
    Exercise("deadlift", "back", "load", "L-big", cap=510),
    Exercise("pull_up", "back", "bodyweight", "B-hard"),
    Exercise("chin_up", "back", "bodyweight", "B-hard"),
    Exercise("assisted_pull_up", "back", "load", None),
    Exercise("lat_pulldown", "back", "load", "L-M"),
    Exercise("seated_cable_row", "back", "load", "L-M"),
    Exercise("row_machine", "back", "load", "L-M"),
    Exercise("barbell_row", "back", "load", "L-M"),
    Exercise("dumbbell_row", "back", "load", "L-S"),
    Exercise("t_bar_row", "back", "load", "L-M"),
    Exercise("straight_arm_pulldown", "back", "load", "L-S"),
    Exercise("back_extension", "back", "bodyweight", "B-easy"),
    Exercise("back_squat", "legs", "load", "L-big", cap=510),
    Exercise("front_squat", "legs", "load", "L-M"),
    Exercise("smith_squat", "legs", "load", "L-M"),
    Exercise("leg_press", "legs", "load", "L-XL"),
    Exercise("hack_squat", "legs", "load", "L-XL"),
    Exercise("leg_extension", "legs", "load", "L-M"),
    Exercise("leg_curl", "legs", "load", "L-M"),
    Exercise("romanian_deadlift", "legs", "load", "L-M"),
    Exercise("lunge", "legs", "load", "L-XS"),
    Exercise("bulgarian_split_squat", "legs", "load", "L-XS"),
    Exercise("step_up", "legs", "load", "L-XS"),
    Exercise("hip_thrust", "legs", "load", "L-big", cap=600),
    Exercise("glute_machine", "legs", "load", "L-M"),
    Exercise("hip_abduction", "legs", "load", "L-M"),
    Exercise("hip_adduction", "legs", "load", "L-M"),
    Exercise("standing_calf_raise", "legs", "load", "L-M"),
    Exercise("seated_calf_raise", "legs", "load", "L-M"),
    Exercise("overhead_press", "shoulders", "load", "L-S"),
    Exercise("dumbbell_shoulder_press", "shoulders", "load", "L-XS"),
    Exercise("shoulder_press_machine", "shoulders", "load", "L-S"),
    Exercise("lateral_raise", "shoulders", "load", "L-XS"),
    Exercise("front_raise", "shoulders", "load", "L-XS"),
    Exercise("rear_delt_fly", "shoulders", "load", "L-XS"),
    Exercise("reverse_pec_deck", "shoulders", "load", "L-S"),
    Exercise("face_pull", "shoulders", "load", "L-S"),
    Exercise("upright_row", "shoulders", "load", "L-S"),
    Exercise("shrug", "shoulders", "load", "L-M"),
    Exercise("barbell_curl", "arms", "load", "L-S"),
    Exercise("dumbbell_curl", "arms", "load", "L-XS"),
    Exercise("hammer_curl", "arms", "load", "L-XS"),
    Exercise("preacher_curl", "arms", "load", "L-S"),
    Exercise("cable_curl", "arms", "load", "L-S"),
    Exercise("biceps_curl_machine", "arms", "load", "L-S"),
    Exercise("triceps_pushdown", "arms", "load", "L-S"),
    Exercise("skull_crusher", "arms", "load", "L-S"),
    Exercise("overhead_triceps_extension", "arms", "load", "L-XS"),
    Exercise("close_grip_bench_press", "arms", "load", "L-M"),
    Exercise("triceps_machine", "arms", "load", "L-S"),
    Exercise("wrist_curl", "arms", "load", "L-XS"),
    Exercise("crunch", "core", "bodyweight", "B-easy"),
    Exercise("ab_crunch_machine", "core", "load", "L-S"),
    Exercise("cable_crunch", "core", "load", "L-S"),
    Exercise("hanging_leg_raise", "core", "bodyweight", "B-hard"),
    Exercise("russian_twist", "core", "bodyweight", "B-easy"),
    Exercise("ab_wheel", "core", "bodyweight", "B-hard"),
    Exercise("plank", "core", "timed", "T"),
    Exercise("side_plank", "core", "timed", "T"),
    Exercise("wall_sit", "core", "timed", "T"),
    Exercise("power_clean", "full_body", "load", "L-M"),
    Exercise("snatch", "full_body", "load", "L-M"),
    Exercise("kettlebell_swing", "full_body", "load", "L-S"),
    Exercise("farmer_carry", "full_body", "load", "L-S"),
    Exercise("burpee", "full_body", "bodyweight", "B-easy"),
    Exercise("box_jump", "full_body", "bodyweight", "B-easy"),
    Exercise("battle_ropes", "full_body", "timed", "T"),
    Exercise(
        "treadmill",
        "cardio",
        "cardio",
        "C-run",
        fields=("duration_s", "distance_m", "speed_kmh", "incline_pct"),
    ),
    Exercise(
        "curved_treadmill",
        "cardio",
        "cardio",
        "C-run",
        fields=("duration_s", "distance_m"),
    ),
    Exercise(
        "exercise_bike",
        "cardio",
        "cardio",
        "C-bike",
        fields=("duration_s", "distance_m", "level"),
    ),
    Exercise(
        "spin_bike",
        "cardio",
        "cardio",
        "C-bike",
        fields=("duration_s", "distance_m", "level"),
    ),
    Exercise(
        "recumbent_bike",
        "cardio",
        "cardio",
        "C-bike",
        fields=("duration_s", "distance_m", "level"),
    ),
    Exercise(
        "air_bike", "cardio", "cardio", "C-bike", fields=("duration_s", "distance_m")
    ),
    Exercise(
        "elliptical",
        "cardio",
        "cardio",
        "C-run",
        fields=("duration_s", "distance_m", "level"),
    ),
    Exercise(
        "rowing_machine",
        "cardio",
        "cardio",
        "C-row",
        fields=("duration_s", "distance_m", "level"),
    ),
    Exercise(
        "ski_machine", "cardio", "cardio", "C-row", fields=("duration_s", "distance_m")
    ),
    Exercise(
        "stair_climber",
        "cardio",
        "cardio",
        "C-time",
        fields=("duration_s", "floors", "level"),
    ),
    Exercise("stepper", "cardio", "cardio", "C-time", fields=("duration_s", "level")),
    Exercise("vertical_climber", "cardio", "cardio", "C-time", fields=("duration_s",)),
    Exercise(
        "arm_ergometer", "cardio", "cardio", "C-time", fields=("duration_s", "level")
    ),
    Exercise("jump_rope", "cardio", "cardio", "C-time", fields=("duration_s",)),
)
EXERCISES_BY_KEY: dict[str, Exercise] = {e.key: e for e in EXERCISES}


def measured(exercise: Exercise, values: dict[str, float | None]) -> float | None:
    """The value of a set that its milestones read (gym.md, «I tipi di
    serie»), when it is under the cap; None when it counts for none."""
    if exercise.scale is None:
        return None
    value = values.get(SCALES[exercise.scale].measure)
    if value is None or value <= 0:
        return None
    cap = exercise.capped_at()
    if cap is not None and value > cap:
        return None
    if exercise.kind == "load" and not values.get("reps"):
        return None
    return value


def level_of(exercise: Exercise, value: float) -> int:
    """The level a value reaches, 0 to 7: the figure FIGURES[level - 1]."""
    if exercise.scale is None:
        return 0
    return sum(1 for step in SCALES[exercise.scale].levels if value >= step)
