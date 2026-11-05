import type { PlannedSport } from "./base.ts";

/** Swimming in open water 20–150 m from the shore, lap after lap, a shape of
 * the catalogue or a drawing (TASK-323, ADR-0283): 0.5–3 km, every lap and
 * the legs from the shore. */
export const SWIMMING = {
  activity: "swimming",
  distanceM: [500, 3_000],
} as const satisfies PlannedSport;
