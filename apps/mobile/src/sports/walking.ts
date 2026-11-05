import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/**
 * A walk (TASK-371, ADR-0315): its contract limits, 1–30 km, the user's
 * choice; past 21 km the foot zone may take longer to download, as for a
 * run, and the panel warns from 15 km. Drawn as a run, on the foot zones.
 */
export const WALKING: SportProfile = {
  activity: "walking",
  name: tLater("Walk"),
  emoji: "🚶",
  timeAt: "walker",
  drawKm: [DISTANCE_LIMITS_M.walking[0] / 1000, DISTANCE_LIMITS_M.walking[1] / 1000],
  // `.walking`.
  appleWorkout: 52,
  // A walk counts with the runs, as Apple's own Workout app does.
  appleDistance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  // EXERCISE_TYPE_WALKING.
  healthConnect: 79,
  network: "foot",
  // ACSM walking: VO₂ = 3.5 + 0.1·v + 1.8·v·grade, about half a run's.
  energy: { kind: "oxygen", mlKgPerM: 0.1, mlKgPerMUp: 1.8 },
  freeRunAs: "walking",
};
