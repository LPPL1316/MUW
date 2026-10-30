import {
  type Activity,
  DISTANCE_LIMITS_M,
  MIN_DISTANCE_M,
} from "@shaperoute/shared-types";

import {
  type Limits,
  readDistance,
  steppedDistance,
  switchedDistance,
  tenthsToM,
  typedTenths,
  unitsNumber,
  wholeMilesWithin,
  wholeUnits,
  writeDistance,
  writtenM,
} from "../units/distanceInput";
import { appUnits, type Units } from "../units/units";

/**
 * The longest distance the app offers for a run (ADR-0034). At Trento a new
 * 21 km zone downloads in about 105 s and the route takes 35–50 s, well
 * within the 5 minutes the app waits; a 30 km zone alone takes about 280 s
 * to download. The engine and the contract go up to MAX_DISTANCE_M.
 */
export const MAX_APP_DISTANCE_KM = 21;
export const MIN_DISTANCE_KM = MIN_DISTANCE_M / 1000;

/**
 * The distances «Draw» offers for each activity, [lowest, highest] in whole
 * km: a run from 1 to MAX_APP_DISTANCE_KM; a bike route all of its contract
 * limits, 10–30 km (TASK-190, the user's choice). Outside the bike zones
 * downloaded ahead a bike route downloads 23–26 km of map, and may take
 * longer than the 5 minutes the app waits (ADR-0153). Paddling its contract
 * limits too, 1–5 km (TASK-191, the user's choice), and a swim its own,
 * 0.5–3 km, by half a km (TASK-323 C2).
 */
export const APP_DISTANCE_LIMITS_KM: Readonly<
  Record<Activity, readonly [lowest: number, highest: number]>
> = {
  running: [MIN_DISTANCE_KM, MAX_APP_DISTANCE_KM],
  cycling: [DISTANCE_LIMITS_M.cycling[0] / 1000, DISTANCE_LIMITS_M.cycling[1] / 1000],
  paddling: [
    DISTANCE_LIMITS_M.paddling[0] / 1000,
    DISTANCE_LIMITS_M.paddling[1] / 1000,
  ],
  swimming: [
    DISTANCE_LIMITS_M.swimming[0] / 1000,
    DISTANCE_LIMITS_M.swimming[1] / 1000,
  ],
};

/** Above this the panel warns that the route takes longer (ADR-0034). */
export const LONG_DISTANCE_KM = 15;

/**
 * The same in whole miles, with «Miles» (TASK-182 part B, the user's choice
 * of 2026-10-05): the whole miles inside the limits in km, so a run goes
 * from 1 to 13 mi, a bike route from 7 to 18, paddling from 1 to 3. A swim
 * by half a mile, 0.5 to 1.5 (0.8 to 2.4 km: 2 mi are past the 3 km).
 */
export const APP_DISTANCE_LIMITS_MI: Readonly<Record<Activity, Limits>> = {
  running: milesWithin("running"),
  cycling: milesWithin("cycling"),
  paddling: milesWithin("paddling"),
  swimming: [0.5, 1.5],
};

function milesWithin(activity: Activity): Limits {
  const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
  return wholeMilesWithin(lowest * 1000, highest * 1000);
}

/** The distances «Draw» offers for `activity`, in whole `units`: the app's
 * unless said. */
export function distanceLimits(activity: Activity, units: Units = appUnits()): Limits {
  return units === "mi"
    ? APP_DISTANCE_LIMITS_MI[activity]
    : APP_DISTANCE_LIMITS_KM[activity];
}

/** The same in metres: 13 mi are 20 922 m. */
export function distanceLimitsM(
  activity: Activity,
  units: Units = appUnits(),
): readonly [lowest: number, highest: number] {
  const [lowest, highest] = distanceLimits(activity, units);
  return [tenthsToM(lowest * 10, units), tenthsToM(highest * 10, units)];
}

/**
 * What is typed in the distance field as whole metres: "7", "7,5", "7.5"
 * are km; with «Miles» the field writes "4.5 mi" (`units/distanceInput`),
 * and that is 7242 m. Null when it is not such a number, or falls outside
 * the limits of `activity` in the unit typed (APP_DISTANCE_LIMITS_KM: 1 to
 * MAX_APP_DISTANCE_KM km for a run; APP_DISTANCE_LIMITS_MI).
 *
 * While the app is in miles a text in km is not something typed: the app
 * wrote it in metres (a «Try», a small lake's distance), or it is there
 * from before «Settings» changed. It is taken as the metres it says, within
 * the limits in km.
 */
export function toDistanceM(
  text: string,
  activity: Activity = "running",
  units: Units = appUnits(),
): number | null {
  const typed = readDistance(text.trim());
  if (typed.units === "km" && units === "mi") {
    const metres = writtenM(typed.number);
    const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
    return metres !== null && metres >= lowest * 1000 && metres <= highest * 1000
      ? metres
      : null;
  }
  // In tenths, and integer arithmetic: 1.1 * 1000 would give
  // 1100.0000000000002.
  const tenths = typedTenths(typed.number);
  if (tenths === null) {
    return null;
  }
  const [lowest, highest] = distanceLimits(activity, typed.units);
  if (tenths < lowest * 10 || tenths > highest * 10) {
    return null;
  }
  return tenthsToM(tenths, typed.units);
}

/** What − and + add to the distance; a mile with «Miles». */
export const DISTANCE_STEP_KM = 1;

/** A swim goes by half a km, or half a mile (TASK-323 C2, the user's
 * choice): 0.5 to 3 km are six steps, whole km would be three. */
export const SWIM_STEP = 0.5;

/** How far − and + go for `activity`, in its units: one, half for a swim. */
export function distanceStep(activity: Activity): number {
  return activity === "swimming" ? SWIM_STEP : DISTANCE_STEP_KM;
}

/**
 * The distance field after pressing − (steps < 0) or + (steps > 0): one
 * DISTANCE_STEP_KM each, or one mile with «Miles», half of either for a swim
 * (distanceStep), held within the limits of `activity` (for a run
 * MIN_DISTANCE_KM to MAX_APP_DISTANCE_KM, or 1 to 13 mi). A value out of
 * range is brought back into it; text that is not a number starts from the
 * lowest. The decimal keeps the separator typed.
 */
export function stepDistance(
  text: string,
  steps: number,
  activity: Activity = "running",
  units: Units = appUnits(),
): string {
  return steppedDistance(
    text.trim(),
    steps * distanceStep(activity),
    units,
    distanceLimits(activity, units),
  );
}

/**
 * The distance field for a sport just chosen (TASK-190): as typed when it is
 * within the limits of `activity`, brought within them otherwise, as − and +
 * do (5 km of a run are 10 by bike, 25 km by bike are 21 on foot). A text
 * in the other unit is first written in the app's (switchDistance).
 */
export function fitDistance(
  text: string,
  activity: Activity,
  units: Units = appUnits(),
): string {
  const here =
    readDistance(text).units === units ? text : switchDistance(text, activity, units);
  return toDistanceM(here, activity, units) !== null
    ? here
    : stepDistance(here, 0, activity, units);
}

/**
 * The distance field once «Settings» turns the app to `units` (TASK-182):
 * the same distance to the nearest whole km or mile, within the limits of
 * `activity` (5 km are 3 mi; 21 km are 13 mi; 3 mi are 5 km).
 */
export function switchDistance(text: string, activity: Activity, units: Units): string {
  return switchedDistance(text.trim(), units, distanceLimits(activity, units));
}

/**
 * The field's text for a distance the app writes by itself, in metres
 * («Use 12 km» under a word): "12" in km, as before; "8 mi" with «Miles».
 */
export function distanceField(metres: number, units: Units = appUnits()): string {
  return writeDistance(String(unitsNumber(metres, units)), units);
}

/**
 * A distance the app offers by itself («Try», «better at about»), as it
 * asks for it: the metres as they are in km; with «Miles» the nearest whole
 * mile within the limits of `activity`, in whole metres (5 km are 3 mi,
 * 4828 m).
 */
export function offeredDistanceM(
  metres: number,
  activity: Activity,
  units: Units = appUnits(),
): number {
  return units === "mi"
    ? tenthsToM(wholeUnits(metres, "mi", APP_DISTANCE_LIMITS_MI[activity]) * 10, "mi")
    : metres;
}

/**
 * Where the distance field starts for paddling (TASK-191, ADR-0169): 2 km,
 * which the shapes fit on the sea too, 200 m off the shore (ADR-0161: the
 * heart up to 3 km); the examples of «Explore» are 2 km as well. A run's
 * 5 km fits the paddling limits, but at sea most shapes do not fit at it.
 */
export const PADDLING_START_KM = 2;

/** Where it starts for a swim (TASK-323 C2, the user's choice): 1 km, two
 * laps of most shapes on a straight coast (ADR-0283). */
export const SWIMMING_START_KM = 1;

/**
 * The distance field for a sport, at the opening or just chosen: paddling
 * starts from PADDLING_START_KM; a run and a bike route keep the distance
 * typed, brought within their limits (fitDistance). With «Miles» the same
 * to the nearest whole mile: a run's 5 km start at 3 mi, paddling at 1 mi.
 */
export function distanceForSport(
  text: string,
  activity: Activity,
  units: Units = appUnits(),
): string {
  if (activity === "paddling") {
    return fitDistance(String(PADDLING_START_KM), activity, units);
  }
  return activity === "swimming"
    ? fitDistance(String(SWIMMING_START_KM), activity, units)
    : fitDistance(text, activity, units);
}
