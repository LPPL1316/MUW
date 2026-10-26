import { decimal } from "../i18n";
import { appUnits, type Units } from "./units";

/**
 * How the app writes a distance and a pace (TASK-182, ADR-0149). The engine,
 * the API and the GPX stay in metres: these turn metres into what is shown,
 * in the app's units unless one is passed. In kilometres each one writes
 * what the app wrote before the choice was there.
 */

export const METRES_PER_KM = 1000;
export const METRES_PER_MILE = 1609.344;
export const METRES_PER_FOOT = 0.3048;

/** Below this the pace is noise, as in `navigation/freeRun`. */
export const MIN_PACE_M = 100;

/** The metres in one of `units`. */
export function metresPer(units: Units): number {
  return units === "mi" ? METRES_PER_MILE : METRES_PER_KM;
}

/** `metres` in kilometres or in miles, as a number. */
export function inUnits(metres: number, units: Units = appUnits()): number {
  return metres / metresPer(units);
}

/** How a number with decimals is written. */
export type Written = (value: number, digits: number) => string;

/** "5.2 km", "3.2 mi": the distance of a route, with the comma where the
 * app's language writes one. */
export function distanceLabel(
  metres: number,
  units: Units = appUnits(),
  written: Written = decimal,
): string {
  return `${written(inUnits(metres, units), 1)} ${units}`;
}

/** "5 km", "3 mi": a distance said in whole units. */
export function wholeDistanceLabel(metres: number, units: Units = appUnits()): string {
  return `${Math.round(inUnits(metres, units))} ${units}`;
}

/** "2.9" under ten units, "13" from there: how far a town is, the unit
 * written by the text around it. */
export function awayNumber(metres: number, units: Units = appUnits()): string {
  const away = inUnits(metres, units);
  return away < 10 ? decimal(away) : String(Math.round(away));
}

/** "4.01 km", "2.49 mi": the distance of a run, as runners read it on the
 * run's screen: two decimals and a point in every language. */
export function runDistanceLabel(metres: number, units: Units = appUnits()): string {
  return `${inUnits(Math.max(0, metres), units).toFixed(2)} ${units}`;
}

/** "4:44 /km", "7:37 /mi": the average pace; null before MIN_PACE_M. */
export function paceLabel(
  metres: number,
  ms: number,
  units: Units = appUnits(),
): string | null {
  if (metres < MIN_PACE_M || ms <= 0) {
    return null;
  }
  // Times one in kilometres: the same number as before, to the last digit.
  const seconds = Math.round((ms / metres) * (metresPer(units) / METRES_PER_KM));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")} /${units}`;
}

/** A short distance is said to the nearest ten metres, or fifty feet. */
const SHORT_STEP_M = 10;
const SHORT_STEP_FT = 50;

/** "50 m", "150 ft": a short distance, in metres or, with miles, in feet. */
export function shortDistanceLabel(metres: number, units: Units = appUnits()): string {
  if (units === "mi") {
    const feet = metres / METRES_PER_FOOT;
    return `${Math.round(feet / SHORT_STEP_FT) * SHORT_STEP_FT} ft`;
  }
  return `${Math.round(metres / SHORT_STEP_M) * SHORT_STEP_M} m`;
}

/** Under this a distance is short: a kilometre, or a thousand feet. */
export function shortBelowM(units: Units = appUnits()): number {
  return units === "mi" ? 1000 * METRES_PER_FOOT : METRES_PER_KM;
}

/** "120 m", "2.3 km"; "400 ft", "1.4 mi": how far something is, short or not. */
export function nearDistanceLabel(
  metres: number,
  units: Units = appUnits(),
  written: Written = decimal,
): string {
  return metres < shortBelowM(units)
    ? shortDistanceLabel(metres, units)
    : distanceLabel(metres, units, written);
}
