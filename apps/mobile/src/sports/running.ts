import { MIN_DISTANCE_M, RUNNING_BEST_DISTANCES } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { InUnits, SportProfile } from "./base";

/**
 * The longest distance the app offers for a run (ADR-0034). At Trento a new
 * 21 km zone downloads in about 105 s and the route takes 35–50 s, well
 * within the 5 minutes the app waits; a 30 km zone alone takes about 280 s
 * to download. The engine and the contract go up to MAX_DISTANCE_M.
 */
export const MAX_APP_DISTANCE_KM = 21;

/** What «Draw» says of a drawing in parts and of a word on foot, and for a
 * sport that says none: walked between them. */
export const ON_FOOT_PARTS: InUnits = {
  km: tLater("{drawn} km of drawing + {between} km walking between the parts"),
  mi: tLater("{drawn} mi of drawing + {between} mi walking between the parts"),
};
export const ON_FOOT_LETTERS: InUnits = {
  km: tLater("{letters} km of letters + {between} km walking between them"),
  mi: tLater("{letters} mi of letters + {between} mi walking between them"),
};

/** A run: on the foot network, drawn on the phone too. */
export const RUNNING: SportProfile = {
  activity: "running",
  name: tLater("Run"),
  emoji: "🏃‍♂️",
  timeAt: "runner",
  partsBetween: ON_FOOT_PARTS,
  lettersBetween: ON_FOOT_LETTERS,
  bests: { distances: RUNNING_BEST_DISTANCES, named: "race" },
  drawKm: [MIN_DISTANCE_M / 1000, MAX_APP_DISTANCE_KM],
  appleWorkout: 37,
  appleDistance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  healthConnect: 56,
  network: "foot",
  // ACSM running: VO₂ = 3.5 + 0.2·v + 0.9·v·grade (ml/kg/min).
  energy: { kind: "oxygen", mlKgPerM: 0.2, mlKgPerMUp: 0.9 },
  // A run has no numbers of its own, and its file is as before.
  freeRunAs: undefined,
  muwLabel: tLater("Route created by MuW – run it yourself"),
};
