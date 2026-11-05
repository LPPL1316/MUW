import assert from "node:assert/strict";
import { test } from "node:test";

import catalog from "../fixtures/gym-exercises.json" with { type: "json" };
import runActivities from "../fixtures/run-activities.json" with { type: "json" };
import session from "../fixtures/gym-session.json" with { type: "json" };
import {
  GYM_SET_KINDS,
  type GymSessionRequest,
  type GymSetKind,
  RUN_ACTIVITIES,
  TRACKLESS_ACTIVITIES,
  type TracklessActivity,
} from "../src/index.ts";
import { TRACKLESS_SPORTS } from "../src/sports/index.ts";

// The same fixtures are checked by the API's test_gym_catalog.py and
// test_gym.py (TASK-385, ADR-0327).

test("a workout at the gym is the activity saved without a track", () => {
  assert.deepEqual([...TRACKLESS_ACTIVITIES], runActivities.trackless_activities);
  assert.deepEqual(
    TRACKLESS_SPORTS.map((sport) => sport.trackless),
    [true],
  );
  // One of RUN_ACTIVITIES since the app shows a post without a line (B0),
  // after all those with a track.
  assert.deepEqual(RUN_ACTIVITIES.slice(-TRACKLESS_ACTIVITIES.length), [
    ...TRACKLESS_ACTIVITIES,
  ]);
  const gym: TracklessActivity = "gym";
  assert.equal(gym, "gym");
});

test("the example workout is a request of the contract", () => {
  const request: GymSessionRequest = {
    ...session,
    sets: session.sets.map((item) => ({ ...item, kind: item.kind as GymSetKind })),
  };
  assert.ok(Date.parse(request.ended_at) > Date.parse(request.started_at));
  for (const item of request.sets ?? []) {
    assert.ok(GYM_SET_KINDS.includes(item.kind));
    assert.ok((item.exercise === undefined) !== (item.name === undefined));
  }
});

test("the catalog names each exercise once, of a kind and a scale it has", () => {
  const keys = catalog.exercises.map((exercise) => exercise.key);
  assert.equal(keys.length, 91);
  assert.equal(new Set(keys).size, keys.length);
  for (const exercise of catalog.exercises) {
    assert.ok(
      (GYM_SET_KINDS as readonly string[]).includes(exercise.kind),
      exercise.key,
    );
    if (exercise.scale !== null) {
      assert.ok(exercise.scale in catalog.scales, exercise.key);
    }
  }
  for (const scale of Object.values(catalog.scales)) {
    assert.equal(scale.levels.length, catalog.figures.length);
    assert.deepEqual(
      [...scale.levels].sort((a, b) => a - b),
      scale.levels,
    );
  }
});
