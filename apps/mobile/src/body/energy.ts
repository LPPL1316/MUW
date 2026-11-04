import type { Activity } from "@shaperoute/shared-types";

import { ageIn, type BodyProfile, type Sex } from "./bodyProfile";

/**
 * About how much energy an activity took, in kilocalories (TASK-374,
 * ADR-0318): the «active energy» of Apple Health and Health Connect, what
 * the body spent above what it spends at rest in the same time.
 *
 * - Running: the ACSM running equation, VO₂ = 3.5 + 0.2·v + 0.9·v·grade
 *   (ml/kg/min), added up over the run: 0.2 ml/kg for each metre, 0.9 for
 *   each metre climbed, 3.5 for each minute.
 * - Cycling and paddling: the MET of the Compendium of Physical Activities
 *   (2024) for the average moving speed.
 * - At rest: Mifflin-St Jeor with sex, age, weight and height; with any of
 *   them missing, one standard MET.
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
/** ACSM running: oxygen for each metre run and each metre climbed, ml/kg. */
const RUN_ML_KG_PER_M = 0.2;
const RUN_ML_KG_PER_M_UP = 0.9;

/** Mifflin-St Jeor's last term, kcal a day: «Prefer not to say» takes the
 * mean of the other two (the user's choice). */
const MIFFLIN_SEX: Readonly<Record<Sex, number>> = {
  male: 5,
  female: -161,
  unsaid: -78,
};

const MINUTES_A_DAY = 1440;
const MPH_KMH = 1.609344;

/** A MET from `bands`: the first whose speed is above the activity's. */
type Band = { belowKmh: number; met: number };

/** Bicycling, Compendium 2024: under 10 mph 4.0 (01010), 10–11.9 6.8,
 * 12–13.9 8.0, 14–15.9 10.0, 16–19 12.0 (01050), 20 and over 15.8. */
const CYCLING: readonly Band[] = [
  { belowKmh: 10 * MPH_KMH, met: 4.0 },
  { belowKmh: 12 * MPH_KMH, met: 6.8 },
  { belowKmh: 14 * MPH_KMH, met: 8.0 },
  { belowKmh: 16 * MPH_KMH, met: 10.0 },
  { belowKmh: 20 * MPH_KMH, met: 12.0 },
  { belowKmh: Infinity, met: 15.8 },
];

/** Canoeing and kayaking, Compendium 2024: under 4 mph 2.8 (light), 4–5.9
 * 5.8 (moderate), 6 and over 12.5 (vigorous). */
const PADDLING: readonly Band[] = [
  { belowKmh: 4 * MPH_KMH, met: 2.8 },
  { belowKmh: 6 * MPH_KMH, met: 5.8 },
  { belowKmh: Infinity, met: 12.5 },
];

/** The MET of a ride or a paddle at `kmh` on average. */
export function metAt(activity: "cycling" | "paddling", kmh: number): number {
  const bands = activity === "cycling" ? CYCLING : PADDLING;
  return (bands.find((band) => kmh < band.belowKmh) ?? bands[bands.length - 1]).met;
}

/** What an activity was, as far as its energy goes. */
export type Effort = {
  activity: Activity;
  metres: number;
  /** In movement, pauses left out; null when not known (a post of the Feed
   * without its time): a run is then counted from its metres alone, a ride
   * or a paddle not at all. */
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
  if (effort.activity === "running") {
    const up = Math.max(0, effort.climbM ?? 0);
    return MET_ML_KG_MIN * minutes + RUN_ML_KG_PER_M * metres + RUN_ML_KG_PER_M_UP * up;
  }
  if (minutes <= 0) {
    return 0;
  }
  const kmh = metres / 1000 / (minutes / 60);
  return metAt(effort.activity, kmh) * MET_ML_KG_MIN * minutes;
}

/**
 * The active energy of `effort` for `body` in `year`, whole kilocalories;
 * never below zero, and none without metres: standing still is rest.
 */
export function activeKcal(effort: Effort, body: BodyProfile, year: number): number {
  if (!(effort.metres > 0)) {
    return 0;
  }
  const weight = body.weightKg ?? DEFAULT_WEIGHT_KG;
  const minutes = Math.max(0, effort.seconds ?? 0) / 60;
  const total = (oxygenMlKg(effort, minutes) / 1000) * KCAL_PER_L_O2 * weight;
  const rest = restKcalPerMin(body, year) * minutes;
  return Math.max(0, Math.round(total - rest));
}
