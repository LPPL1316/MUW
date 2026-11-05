import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/**
 * A workout at the gym, saved without a track (TASK-385, ADR-0327): no
 * route, no distance, no network. Apple Health and Health Connect take it
 * as strength training, with no distance of its own.
 */
export const GYM: SportProfile = {
  activity: "gym",
  name: tLater("Gym"),
  emoji: "🏋️",
  // `.traditionalStrengthTraining`.
  appleWorkout: 50,
  // EXERCISE_TYPE_STRENGTH_TRAINING.
  healthConnect: 70,
  // Never a run without a route: a workout has its own screen (part B).
  freeRunAs: undefined,
};
