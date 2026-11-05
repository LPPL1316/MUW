import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/**
 * A day of alpine skiing, recorded without a shape (TASK-375, ADR-0319).
 * Apple Health keeps the workout's total only: its own distances would be
 * a new permission to ask.
 */
export const SKIING: SportProfile = {
  activity: "skiing",
  name: tLater("Ski"),
  // `.downhillSkiing`.
  appleWorkout: 61,
  // EXERCISE_TYPE_SKIING, downhill and cross-country alike.
  healthConnect: 61,
  // No numbers of its own until part C: a ride's speeds in km/h.
  freeRunAs: "cycling",
};
