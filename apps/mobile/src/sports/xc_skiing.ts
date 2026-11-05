import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/** A day of cross-country skiing, recorded without a shape (TASK-375,
 * ADR-0319), as alpine skiing. */
export const XC_SKIING: SportProfile = {
  activity: "xc_skiing",
  name: tLater("Cross-country ski"),
  // `.crossCountrySkiing`.
  appleWorkout: 60,
  // EXERCISE_TYPE_SKIING: Health Connect has no type of its own for it.
  healthConnect: 61,
  // No numbers of its own until part C: a runner's pace.
  freeRunAs: undefined,
};
