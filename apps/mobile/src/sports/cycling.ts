import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { MetBand, SportProfile } from "./base";

const MPH_KMH = 1.609344;

/** What a MuW route says on its card for a sport that says none. */
export const RIDE_IT_YOURSELF = tLater("Route created by MuW – ride it yourself");

/** Bicycling, Compendium 2024: under 10 mph 4.0 (01010), 10–11.9 6.8,
 * 12–13.9 8.0, 14–15.9 10.0, 16–19 12.0 (01050), 20 and over 15.8. */
const BANDS: readonly MetBand[] = [
  { belowKmh: 10 * MPH_KMH, met: 4.0 },
  { belowKmh: 12 * MPH_KMH, met: 6.8 },
  { belowKmh: 14 * MPH_KMH, met: 8.0 },
  { belowKmh: 16 * MPH_KMH, met: 10.0 },
  { belowKmh: 20 * MPH_KMH, met: 12.0 },
  { belowKmh: Infinity, met: 15.8 },
];

/**
 * A ride (TASK-190): all of its contract limits, 10–30 km, the user's
 * choice. Outside the bike zones downloaded ahead a bike route downloads
 * 23–26 km of map, and may take longer than the 5 minutes the app waits
 * (ADR-0153).
 */
export const CYCLING: SportProfile = {
  activity: "cycling",
  name: tLater("Bike"),
  drawKm: [DISTANCE_LIMITS_M.cycling[0] / 1000, DISTANCE_LIMITS_M.cycling[1] / 1000],
  appleWorkout: 13,
  appleDistance: "HKQuantityTypeIdentifierDistanceCycling",
  healthConnect: 8,
  network: "bike",
  energy: { kind: "met", bands: BANDS },
  // A ride's numbers are speeds, as along a route by bike (TASK-251 C).
  freeRunAs: "cycling",
  muwLabel: RIDE_IT_YOURSELF,
};
