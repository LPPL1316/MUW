import assert from "node:assert/strict";
import { test } from "node:test";

import publicProfile from "../fixtures/public-profile.json" with { type: "json" };
import reading from "../fixtures/vo2max-reading-request.json" with { type: "json" };
import settings from "../fixtures/vo2max-settings.json" with { type: "json" };
import {
  type PublicProfile,
  RUNNING_BEST_DISTANCES,
  type Vo2MaxReadingRequest,
  type Vo2MaxSettings,
} from "../src/index.ts";

// The same JSON is validated by the API's test_vo2max.py (TASK-397).
const shown = settings as Vo2MaxSettings;
const sent = reading as Vo2MaxReadingRequest;
const seen: PublicProfile = { ...publicProfile, follow: "following" };

test("a VO₂ max is a whole number of a day, from Health or estimated", () => {
  const vo2max = shown.vo2max;
  assert.ok(vo2max !== null);
  assert.deepEqual(Object.keys(vo2max).sort(), [
    "from_distance",
    "measured_on",
    "source",
    "value",
  ]);
  assert.ok(Number.isInteger(vo2max.value));
  assert.match(vo2max.measured_on, /^\d{4}-\d{2}-\d{2}$/);
  // Only the estimate says which best it comes from.
  assert.equal(vo2max.source === "estimate", vo2max.from_distance !== null);
  assert.ok(
    vo2max.from_distance === null || RUNNING_BEST_DISTANCES.includes(vo2max.from_distance),
  );
});

test("the phone sends a day and a value of Health, never the hour", () => {
  assert.deepEqual(Object.keys(sent).sort(), ["measured_on", "source", "value"]);
  assert.match(sent.measured_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(sent.value >= 10 && sent.value <= 90);
  assert.notEqual(sent.source as string, "estimate");
});

test("without the yes the profile carries no VO₂ max", () => {
  assert.equal(seen.vo2max, null);
});
