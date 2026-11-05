import type { Activity } from "@shaperoute/shared-types";

import { type MetBand, profileOf } from "../sports";
import { ageIn, type BodyProfile, type Sex } from "./bodyProfile";

/**
 * About how much energy an activity took, in kilocalories (TASK-374,
 * ADR-0318): the «active energy» of Apple Health and Health Connect, what
 * the body spent above what it spends at rest in the same time.
 *
 * - Running: the ACSM running equation, VO₂ = 3.5 + 0.2·v + 0.9·v·grade
 *   (ml/kg/min), added up over the run: 0.2 ml/kg for each metre, 0.9 for
 *   each metre climbed, 3.5 for each minute.
 * - Walking (TASK-371, ADR-0315): the ACSM walking equation, VO₂ = 3.5 +
 *   0.1·v + 1.8·v·grade, added up the same way: 0.1 ml/kg for each metre,
 *   1.8 for each metre climbed. About half a run's, 0.5 kcal per kilogram
 *   and kilometre on the flat.
 * - Cycling and paddling: the MET of the Compendium of Physical Activities
 *   (2024) for the average moving speed.
 * - At rest: Mifflin-St Jeor with sex, age, weight and height; with any of
 *   them missing, one standard MET.
 *
 * A swim has none yet (TASK-323 C2).
 *
 * With no body at all a flat run is 1.0 kcal per kilogram and kilometre for
 * 70 kg, as near as the 1.036 of before (−3.5%).
 */

/** The weight counted with when none is set, in kilograms. */
export const DEFAULT_WEIGHT_KG = 70;

/** Kilocalories in a litre of oxygen. */
const KCAL_PER_L_O2 = 5;
/** One MET: 3.5 ml of oxygen for each kilogram and minute. */
const MET_ML_KG_MIN = 3.5;

/** Mifflin-St Jeor's last term, kcal a day: «Prefer not to say» takes the
 * mean of the other two (the user's choice). */
const MIFFLIN_SEX: Readonly<Record<Sex, number>> = {
  male: 5,
  female: -161,
  unsaid: -78,
};

const MINUTES_A_DAY = 1440;
/** The MET of a ride or a paddle at `kmh` on average: the first band of
 * the sport (src/sports) whose speed is above it. */
export function metAt(activity: "cycling" | "paddling", kmh: number): number {
  const energy = profileOf(activity).energy;
  return energy?.kind === "met" ? metOf(energy.bands, kmh) : 0;
}

function metOf(bands: readonly MetBand[], kmh: number): number {
  return (bands.find((band) => kmh < band.belowKmh) ?? bands[bands.length - 1]).met;
}

/** What an activity was, as far as its energy goes. */
export type Effort = {
  activity: Activity;
  metres: number;
  /** In movement, pauses left out; null when not known (a post of the Feed
   * without its time): a run or a walk is then counted from its metres
   * alone, a ride or a paddle not at all. */
  seconds: number | null;
  /** Metres climbed; null when not known. */
  climbM: number | null;
};

/** What the body spends at rest, kcal a minute: Mifflin-St Jeor with all
 * four fields, one standard MET otherwise. */
export function restKcalPerMin(body: BodyProfile, year: number): number {
  const weight = body.weightKg ?? DEFAULT_WEIGHT_KG;
  const age = ageIn(body, year);
  if (body.sex === null || body.heightCm === null || age === null) {
    return (MET_ML_KG_MIN * weight * KCAL_PER_L_O2) / 1000;
  }
  const day = 10 * weight + 6.25 * body.heightCm - 5 * age + MIFFLIN_SEX[body.sex];
  return day / MINUTES_A_DAY;
}

/** The oxygen of the activity, in ml for each kilogram. */
function oxygenMlKg(effort: Effort, minutes: number): number {
  const metres = Math.max(0, effort.metres);
  const energy = profileOf(effort.activity).energy;
  if (energy?.kind === "oxygen") {
    const up = Math.max(0, effort.climbM ?? 0);
    return MET_ML_KG_MIN * minutes + energy.mlKgPerM * metres + energy.mlKgPerMUp * up;
  }
  if (minutes <= 0 || energy === undefined) {
    return 0;
  }
  const kmh = metres / 1000 / (minutes / 60);
  return metOf(energy.bands, kmh) * MET_ML_KG_MIN * minutes;
}

/**
 * The active energy of `effort` for `body` in `year`, whole kilocalories;
 * never below zero, and none without metres: standing still is rest.
 */
export function activeKcal(effort: Effort, body: BodyProfile, year: number): number {
  // A swim has no formula yet (TASK-323 C2): its sport has no energy.
  if (!(effort.metres > 0) || profileOf(effort.activity).energy === undefined) {
    return 0;
  }
  const weight = body.weightKg ?? DEFAULT_WEIGHT_KG;
  const minutes = Math.max(0, effort.seconds ?? 0) / 60;
  const total = (oxygenMlKg(effort, minutes) / 1000) * KCAL_PER_L_O2 * weight;
  const rest = restKcalPerMin(body, year) * minutes;
  return Math.max(0, Math.round(total - rest));
}
