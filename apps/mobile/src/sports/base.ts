import type { QuantityTypeIdentifierWriteable } from "@kingstinct/react-native-healthkit";
import type { Activity, RunActivity } from "@shaperoute/shared-types";

import type { Limits } from "../units/distanceInput";

/**
 * What the app knows of a sport (TASK-376 part B3, ADR-0320): each sport
 * says it in a file of its own, and the tables of the app are read from
 * them, the same values in the same order as before. Pure: types only, no
 * screen, no native code.
 */

/** A MET for the speeds below `belowKmh`: the first band above the speed
 * is the one (Compendium of Physical Activities, 2024). */
export type MetBand = { belowKmh: number; met: number };

/**
 * How the active energy of the sport is counted (body/energy.ts, TASK-374,
 * ADR-0318): the oxygen of an ACSM equation, ml/kg for each metre and each
 * metre climbed, or a MET from the average moving speed.
 */
export type Energy =
  | { kind: "oxygen"; mlKgPerM: number; mlKgPerMUp: number }
  | { kind: "met"; bands: readonly MetBand[] };

/** The two networks of the engine on the phone (engine/zones.ts). */
export type Network = "foot" | "bike";

export interface SportProfile {
  activity: RunActivity;
  /** In English, as «Settings» and the search's filters name it: where it is
   * shown, `t(name)` (TASK-210). */
  name: string;
  /** What «Draw» offers, [lowest, highest] in whole km; none for a sport
   * recorded without a shape. */
  drawKm?: Limits;
  /** The same in miles when it is not the whole miles inside drawKm. */
  drawMi?: Limits;
  /** What − and + add, in km or miles; one when not said. */
  step?: number;
  /** Where the distance field starts when the sport is chosen; the distance
   * typed, brought within the limits, when not said. */
  startKm?: number;
  /** HKWorkoutActivityType, Apple's own number. */
  appleWorkout: number;
  /** The distance as Apple Health counts it a day; none, the workout keeps
   * its total only. */
  appleDistance?: QuantityTypeIdentifierWriteable;
  /** ExerciseSessionRecord.EXERCISE_TYPE_…, Health Connect's own number. */
  healthConnect: number;
  /** The network the engine on the phone draws it on; none, the server's. */
  network?: Network;
  /** None: no energy counted. */
  energy?: Energy;
  /** What a run without a route counts as, from «Settings»: its numbers are
   * that activity's; undefined, a run's (navigation/freeSport.ts). */
  freeRunAs: Activity | undefined;
  /** What a MuW route of the sport says on its card (TASK-365); a ride's
   * when not said. */
  muwLabel?: string;
}
