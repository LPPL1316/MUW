import type { RouteRequest } from "@shaperoute/shared-types";

import { phoneFirst } from "./onPhone";
import { NETWORKS } from "./zones";

// TASK-371: a walk is drawn as a run, on the foot zones of the phone too.
test("a walk is drawn on the foot zones, on the phone first", () => {
  expect(NETWORKS.walking).toBe("foot");
  const walk: RouteRequest = {
    start: [46.0671, 11.1214],
    shape: "heart",
    word: null,
    distance_m: 3000,
    activity: "walking",
    style: "round",
  };
  expect(phoneFirst(walk)).toBe(phoneFirst({ ...walk, activity: "running" }));
  expect(phoneFirst(walk)).toBe(true);
});
