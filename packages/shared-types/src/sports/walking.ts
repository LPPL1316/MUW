import type { PlannedSport } from "./base.ts";

/** Walking, drawn as a run on the same foot network (TASK-371, ADR-0315):
 * 1–30 km. */
export const WALKING = {
  activity: "walking",
  distanceM: [1_000, 30_000],
} as const satisfies PlannedSport;
