import type { PlannedSport } from "./base.ts";

/** By bike on the roads a bike may ride, one-way streets kept (TASK-190,
 * ADR-0153): 10–30 km. */
export const CYCLING = {
  activity: "cycling",
  distanceM: [10_000, 30_000],
} as const satisfies PlannedSport;
