import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  distanceLimits,
} from "./distance";

// TASK-371: a walk is 1-30 km, its contract limits (the user's choice), and
// in miles the whole miles inside them.
test("a walk is 1 to 30 km, or 1 to 18 mi", () => {
  expect(DISTANCE_LIMITS_M.walking).toEqual([1_000, 30_000]);
  expect(APP_DISTANCE_LIMITS_KM.walking).toEqual([1, 30]);
  expect(distanceLimits("walking", "km")).toEqual([1, 30]);
  expect(APP_DISTANCE_LIMITS_MI.walking).toEqual([1, 18]);
  expect(distanceLimits("walking", "mi")).toEqual([1, 18]);
});

test("a run keeps its own distances", () => {
  expect(APP_DISTANCE_LIMITS_KM.running).toEqual([1, 21]);
});
