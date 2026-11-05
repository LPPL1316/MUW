import { MIN_DISTANCE_M } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import type { SportProfile } from "./base";

/**
 * The longest distance the app offers for a run (ADR-0034). At Trento a new
 * 21 km zone downloads in about 105 s and the route takes 35–50 s, well
 * within the 5 minutes the app waits; a 30 km zone alone takes about 280 s
 * to download. The engine and the contract go up to MAX_DISTANCE_M.
 */
export const MAX_APP_DISTANCE_KM = 21;

/** A run: on the foot network, drawn on the phone too. */
export const RUNNING: SportProfile = {
  activity: "running",
  name: tLater("Run"),
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
