import type { Activity, RunActivity } from "@shaperoute/shared-types";

import { profileOf } from "../sports";

/**
 * What a run without a route is, from the sport «Settings» has when it
 * starts: a ride's numbers are speeds, as along a route by bike (TASK-251
 * part C, ADR-0215), and an outing on the water's a paddler's (TASK-251).
 * A run has none, and its file is as before. A day on the snow (TASK-375,
 * ADR-0319) has no numbers of its own until part C: downhill a ride's
 * speeds in km/h, across country a runner's pace. It is saved as "skiing"
 * or "xc_skiing" all the same: «Save» takes the sport of «Settings».
 * Each sport says it in src/sports (TASK-376 part B3), its `freeRunAs`.
 */
export function freeRunActivity(sport: RunActivity): Activity | undefined {
  return profileOf(sport).freeRunAs;
}
