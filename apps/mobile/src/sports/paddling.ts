import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { MetBand, SportProfile } from "./base";

const MPH_KMH = 1.609344;

/**
 * Where the distance field starts for paddling (TASK-191, ADR-0169): 2 km,
 * which the shapes fit on the sea too, 200 m off the shore (ADR-0161: the
 * heart up to 3 km); the examples of «Explore» are 2 km as well. A run's
 * 5 km fits the paddling limits, but at sea most shapes do not fit at it.
 */
export const PADDLING_START_KM = 2;

/** Canoeing and kayaking, Compendium 2024: under 4 mph 2.8 (light), 4–5.9
 * 5.8 (moderate), 6 and over 12.5 (vigorous). */
const BANDS: readonly MetBand[] = [
  { belowKmh: 4 * MPH_KMH, met: 2.8 },
  { belowKmh: 6 * MPH_KMH, met: 5.8 },
  { belowKmh: Infinity, met: 12.5 },
];

/** Paddling (TASK-191): its contract limits, 1–5 km, the user's choice;
 * drawn by the server, it needs the water (TASK-214, choice 5). */
export const PADDLING: SportProfile = {
  activity: "paddling",
  name: tLater("Paddle"),
  emoji: "🛶",
  pace: "paddle",
  onWater: true,
  shapesOnly: true,
  // On the water (TASK-226): the whole is the distance asked.
  partsBetween: {
    km: tLater("{drawn} km of drawing + {between} km paddling between the parts"),
    mi: tLater("{drawn} mi of drawing + {between} mi paddling between the parts"),
  },
  drawKm: [DISTANCE_LIMITS_M.paddling[0] / 1000, DISTANCE_LIMITS_M.paddling[1] / 1000],
  startKm: PADDLING_START_KM,
  appleWorkout: 31,
  // From iOS 18: before it, the workout keeps its total only.
  appleDistance: "HKQuantityTypeIdentifierDistancePaddleSports",
  healthConnect: 46,
  energy: { kind: "met", bands: BANDS },
  // An outing on the water is a paddler's (TASK-251).
  freeRunAs: "paddling",
  muwLabel: tLater("Route created by MuW – paddle it yourself"),
};
