import type { Activity } from "@shaperoute/shared-types";

import { steppedDistance } from "../units/distanceInput";
import { appUnits, type Units } from "../units/units";
import { distanceLimits } from "./distance";

/** What − and + add in the redesigned «Draw» (TASK-361): half a km, or
 * half a mile with «Miles». */
export const HALF_STEP = 0.5;

/**
 * The distance field after − (direction −1) or + (direction 1): half a unit,
 * held within the limits of `activity`, as `stepDistance` does by whole
 * ones. Text that is not a number starts from the lowest.
 */
export function halfStepDistance(
  text: string,
  direction: -1 | 1,
  activity: Activity = "running",
  units: Units = appUnits(),
): string {
  return steppedDistance(
    text.trim(),
    direction * HALF_STEP,
    units,
    distanceLimits(activity, units),
  );
}

/** How long a finger holds − or + before the first repeat, in ms. */
export const HOLD_DELAY_MS = 400;

/**
 * The wait before repeat `count` (0 is the first) while − or + is held:
 * slow for the first few half-steps, then faster, so 1 to 21 km takes
 * about two seconds and a single extra half-step is still easy to stop on.
 */
export function repeatDelayMs(count: number): number {
  if (count < 4) {
    return 150;
  }
  if (count < 12) {
    return 70;
  }
  return 40;
}
