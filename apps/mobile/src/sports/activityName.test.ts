import { RUN_ACTIVITIES } from "@shaperoute/shared-types";

import { activityName } from "../social/PublicParts";

// TASK-376 part B3c (ADR-0320): the form to publish names a run's sport as
// it did before, now from the sports' profiles.

it("names a run's sport in the form to publish as before", () => {
  expect(RUN_ACTIVITIES.map(activityName)).toEqual([
    "Run",
    "Bike",
    "Paddle",
    "Open water swim",
    "Walk",
    "Ski",
    "Cross-country ski",
    "Gym",
  ]);
});
