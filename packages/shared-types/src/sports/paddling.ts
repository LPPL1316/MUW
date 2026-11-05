import type { PlannedSport } from "./base.ts";

/** Paddling on a lake or the sea within 1 km of the shore, a shape of the
 * catalogue only (TASK-191, ADR-0161): 1–5 km. */
export const PADDLING = {
  activity: "paddling",
  distanceM: [1_000, 5_000],
} as const satisfies PlannedSport;
