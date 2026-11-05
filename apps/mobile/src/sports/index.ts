import type { Activity, RunActivity } from "@shaperoute/shared-types";

import type { SportProfile } from "./base";
import { CYCLING } from "./cycling";
import { PADDLING } from "./paddling";
import { RUNNING } from "./running";
import { SKIING } from "./skiing";
import { SWIMMING } from "./swimming";
import { WALKING } from "./walking";
import { XC_SKIING } from "./xc_skiing";

export type { Energy, MetBand, Network, SportProfile } from "./base";

/**
 * Every sport of the app, in the order of RUN_ACTIVITIES (TASK-376 part B3,
 * ADR-0320): a new sport is a file of its own and one line here.
 */
export const SPORT_PROFILES: readonly SportProfile[] = [
  RUNNING,
  CYCLING,
  PADDLING,
  SWIMMING,
  WALKING,
  SKIING,
  XC_SKIING,
];

/** The activity a request without one is: its request keeps no field. */
export const DEFAULT_ACTIVITY: Activity = "running";

export function profileOf(activity: RunActivity): SportProfile {
  const profile = SPORT_PROFILES.find((sport) => sport.activity === activity);
  if (profile === undefined) {
    throw new Error(`no sport profile for ${activity}`);
  }
  return profile;
}

/**
 * A table of the sports that have `value`, in their order: the activity to
 * what it gives. A sport for which it gives undefined is left out.
 */
export function tableOf<T>(
  value: (sport: SportProfile) => T | undefined,
): Readonly<Partial<Record<RunActivity, T>>> {
  const table: Partial<Record<RunActivity, T>> = {};
  for (const sport of SPORT_PROFILES) {
    const given = value(sport);
    if (given !== undefined) {
      table[sport.activity] = given;
    }
  }
  return table;
}
