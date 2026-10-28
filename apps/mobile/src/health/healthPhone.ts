import type { Workout } from "./workout";

/**
 * Where the phone keeps health data (TASK-321, ADR-0281), as the end of an
 * activity reaches it: Apple Health on the iPhone (`appleHealth.ts`),
 * Health Connect on Android (`healthConnect.ts`). Made from the native
 * library by `healthModules.ts`, from a fake in the tests.
 */

/** Which one: the words of the line change with it. */
export type HealthStore = "apple" | "healthConnect";

/** May MuW write there? «unasked» until the phone's sheet was answered. */
export type HealthPermission = "allowed" | "refused" | "unasked";

export type HealthPhone = {
  store: HealthStore;
  /** False where the phone has no health data (an iPad, an Android without
   * Health Connect). */
  available(): Promise<boolean>;
  /** Read again before every write: it is turned off from there. */
  permission(): Promise<HealthPermission>;
  /** Opens the phone's permission sheet, to write only. */
  ask(): Promise<void>;
  /** Writes the workout with what the permission allows; false when it
   * allows nothing. */
  write(workout: Workout): Promise<boolean>;
};
