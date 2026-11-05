import type { PlannedSport } from "./base.ts";

/** On foot: a plausible run, 1–50 km. */
export const RUNNING = {
  activity: "running",
  distanceM: [1_000, 50_000],
} as const satisfies PlannedSport;
