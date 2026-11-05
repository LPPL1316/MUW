import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/** A swim goes by half a km, or half a mile (TASK-323 C2, the user's
 * choice): 0.5 to 3 km are six steps, whole km would be three. */
export const SWIM_STEP = 0.5;

/** Where it starts for a swim (TASK-323 C2, the user's choice): 1 km, two
 * laps of most shapes on a straight coast (ADR-0283). */
export const SWIMMING_START_KM = 1;

/**
 * A swim in open water (TASK-323): its own limits, 0.5–3 km, by half a km;
 * with «Miles» by half a mile, 0.5 to 1.5 (0.8 to 2.4 km: 2 mi are past
 * the 3 km). No energy yet (TASK-323 C2).
 */
export const SWIMMING: SportProfile = {
  activity: "swimming",
  name: tLater("Open water swim"),
  drawKm: [DISTANCE_LIMITS_M.swimming[0] / 1000, DISTANCE_LIMITS_M.swimming[1] / 1000],
  drawMi: [0.5, 1.5],
  step: SWIM_STEP,
  startKm: SWIMMING_START_KM,
  // `.swimming`; that it was in open water is TASK-321's to add
  // (HKMetadataKeySwimmingLocationType), with TASK-323 E.
  appleWorkout: 46,
  appleDistance: "HKQuantityTypeIdentifierDistanceSwimming",
  // EXERCISE_TYPE_SWIMMING_OPEN_WATER (TASK-323).
  healthConnect: 73,
  freeRunAs: "swimming",
};
