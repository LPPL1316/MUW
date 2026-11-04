import type { Activity } from "@shaperoute/shared-types";

/**
 * True for a route on the water (TASK-191, TASK-323): paddling or a swim. It
 * follows no road and has no directions; a shape in pieces keeps them apart
 * there; «Start» goes through the safety notice of its sport.
 */
export function isOnWater(activity: Activity | undefined): boolean {
  return activity === "paddling" || activity === "swimming";
}
