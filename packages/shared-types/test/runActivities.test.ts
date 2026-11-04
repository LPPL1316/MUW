import assert from "node:assert/strict";
import { test } from "node:test";

import contract from "../fixtures/contract.json" with { type: "json" };
import fixture from "../fixtures/run-activities.json" with { type: "json" };
import {
  API_ACTIVITIES,
  type ApiActivity,
  DISTANCE_LIMITS_M,
  RECORD_ACTIVITIES,
  type RecordActivity,
  RUN_ACTIVITIES,
  type RunActivity,
} from "../src/index.ts";

// The same JSON is checked by the API's test_record_only.py (TASK-375).

test("a saved run says an activity of the API or one recorded without a shape", () => {
  assert.deepEqual([...RECORD_ACTIVITIES], fixture.record_activities);
  assert.deepEqual([...RUN_ACTIVITIES], fixture.run_activities);
  assert.deepEqual([...RUN_ACTIVITIES], [...API_ACTIVITIES, ...RECORD_ACTIVITIES]);
});

test("the route engine plans none of the activities recorded without a shape", () => {
  for (const recorded of RECORD_ACTIVITIES) {
    assert.ok(!(contract.activities as string[]).includes(recorded));
    assert.ok(!(recorded in DISTANCE_LIMITS_M));
  }
  // A RecordActivity is no ApiActivity, so no route request can carry one.
  const apart: Extract<RecordActivity, ApiActivity> extends never ? true : false = true;
  assert.ok(apart);
  const ski: RunActivity = "skiing";
  assert.equal(ski, "skiing");
});
