import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTIVITIES,
  type Activity,
  API_ACTIVITIES,
  DISTANCE_LIMITS_M,
  MAX_DISTANCE_M,
  MIN_DISTANCE_M,
  RECORD_ACTIVITIES,
  type RecordActivity,
  RUN_ACTIVITIES,
} from "../src/index.ts";
import { PLANNED_SPORTS, RECORDED_SPORTS } from "../src/sports/index.ts";

// The sports of the contract (TASK-376, ADR-0320) give the tables index.ts
// wrote by hand before them, value for value and in the same order. The API
// checks its own against the same names (test_sport_registry_api.py).

const BEFORE_ACTIVITIES = ["running", "cycling", "paddling", "swimming", "walking"];
const BEFORE_RECORD_ACTIVITIES = ["skiing", "xc_skiing"];
const BEFORE_LIMITS = {
  running: [1_000, 50_000],
  cycling: [10_000, 30_000],
  paddling: [1_000, 5_000],
  swimming: [500, 3_000],
  walking: [1_000, 30_000],
};

test("the activities are those of before, in their order", () => {
  assert.deepEqual([...ACTIVITIES], BEFORE_ACTIVITIES);
  assert.deepEqual([...API_ACTIVITIES], BEFORE_ACTIVITIES);
  assert.deepEqual([...RECORD_ACTIVITIES], BEFORE_RECORD_ACTIVITIES);
  // Then a workout at the gym, saved without a track (TASK-385 B0).
  assert.deepEqual(
    [...RUN_ACTIVITIES],
    [...BEFORE_ACTIVITIES, ...BEFORE_RECORD_ACTIVITIES, "gym"],
  );
});

test("the distances are those of before, in their order", () => {
  assert.deepEqual(
    Object.entries(DISTANCE_LIMITS_M).map(([a, l]) => [a, [...l]]),
    Object.entries(BEFORE_LIMITS),
  );
  assert.deepEqual([MIN_DISTANCE_M, MAX_DISTANCE_M], [1_000, 50_000]);
});

test("every sport is named once, each planned one with its distances", () => {
  const names = [...PLANNED_SPORTS, ...RECORDED_SPORTS].map((s) => s.activity);
  assert.equal(new Set(names).size, names.length);
  for (const sport of PLANNED_SPORTS) {
    const [lowest, highest] = sport.distanceM;
    assert.ok(0 < lowest && lowest < highest, sport.activity);
  }
});

test("the types are the literals of before", () => {
  // Each name keeps its literal type: a typo would not compile.
  const run: Activity = ACTIVITIES[0];
  const ski: RecordActivity = RECORD_ACTIVITIES[1];
  assert.equal(run, "running");
  assert.equal(ski, "xc_skiing");
  const exact: Activity extends
    "running" | "cycling" | "paddling" | "swimming" | "walking"
    ? true
    : false = true;
  assert.ok(exact);
});
