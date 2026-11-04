import type { Activity } from "@shaperoute/shared-types";

import { MIN_PACE_M } from "../units/format";
import { paceClock } from "./runStats";

/**
 * A swim in open water with the phone in the safety buoy (TASK-323 D,
 * ADR-0283, the user's choice): what changes from a run. With the head in
 * the water nobody hears the phone nor looks at it: no voice at all. The
 * numbers are the paddle's (speeds in km/h) with a swimmer's pace, the time
 * of 100 m, where a run has a kilometre's. Pure functions; a run, and any
 * other activity, is followed as before.
 */

/** A swimmer's pace is the time of this many metres, with miles too: it is
 * how swims are timed everywhere. */
export const SWIM_PACE_M = 100;

/** Written beside a swimmer's pace. The same in every language. */
export const SWIM_PACE_UNIT = "/100 m";

/**
 * Standing still this long pauses a swim, when the swimmer wants it (a
 * run's is AUTO_PAUSE_AFTER_MS, 10 s): a moment to sight the shore, to fix
 * the goggles, a slow breaststroke of 0.5 m/s that takes 10 s for the 5 m
 * of a fix, are still the swim.
 */
export const SWIM_AUTO_PAUSE_AFTER_MS = 30_000;

/**
 * Slower than this, in seconds per kilometre, a swimmer stands: 60 min/km,
 * 6:00 every 100 m, 1 km/h. A run's STANDING_S_PER_KM, 20 min/km, is the
 * pace of an easy swim (2:00 every 100 m): its «Speed now» would be empty.
 */
export const SWIM_STANDING_S_PER_KM = 60 * 60;

/** Whether a route of `activity` is swum. */
export function isSwim(activity: Activity | undefined | null | string): boolean {
  return activity === "swimming";
}

/** The seconds SWIM_PACE_M take at `secondsPerKm`. */
export function per100S(secondsPerKm: number): number {
  return (secondsPerKm * SWIM_PACE_M) / 1000;
}

/** "2:05 /100 m": the average pace of a swim; null before MIN_PACE_M. */
export function swimPaceLabel(metres: number, ms: number): string | null {
  if (metres < MIN_PACE_M || ms <= 0) {
    return null;
  }
  return `${paceClock(per100S(ms / metres))} ${SWIM_PACE_UNIT}`;
}
