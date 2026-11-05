import type { LatLon } from "@shaperoute/shared-types";

import type { FreeRun } from "../navigation/freeRun";
import { loadSport, runActivityOf, type Sport } from "../settings/sport";
import { type Leg, snowDay } from "./snowDay";

/**
 * The lifts of a day of skiing on its map (TASK-375 part C2, ADR-0319):
 * the descents stay the solid white line of a run, the lifts are dashed.
 */

/** The lifts of a day, as stretches of its track's fixes. */
export type Lifts = readonly Leg[];

/** The lifts of `run`, when it is a day of skiing and has any; null for
 * any other sport, and for a day without lifts: its line is as a run's.
 * Cross-country skiing has no lifts. */
export function snowLiftsOf(run: FreeRun, sport: Sport = loadSport()): Lifts | null {
  if (runActivityOf(sport) !== "skiing") {
    return null;
  }
  const { lifts } = snowDay(run.track);
  return lifts === null || lifts.length === 0 ? null : lifts;
}

/** The line through `points` cut at `lifts`: what was skied, and the lifts.
 * Each piece shares its ends with the ones beside it, so the line has no
 * hole. `lifts` in their order, as `snowDay` gives them. */
export function splitAtLifts(
  points: readonly LatLon[],
  lifts: Lifts,
): { skied: LatLon[][]; lifts: LatLon[][] } {
  const skied: LatLon[][] = [];
  const up: LatLon[][] = [];
  let from = 0;
  for (const lift of lifts) {
    if (lift.from > from) {
      skied.push(points.slice(from, lift.from + 1));
    }
    up.push(points.slice(lift.from, lift.to + 1));
    from = lift.to;
  }
  if (points.length - 1 > from) {
    skied.push(points.slice(from));
  }
  const drawn = (line: LatLon[]) => line.length > 1;
  return { skied: skied.filter(drawn), lifts: up.filter(drawn) };
}
