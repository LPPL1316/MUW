import type { Activity } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";

import { t, tLater } from "../i18n";

/** What a route is for: a run, a bike ride since TASK-190, or paddling on a
 * lake or the sea since TASK-191 (a canoe, a kayak, a SUP). Paragliding is
 * only «Soon» for now (TASK-305 D0, ADR-0265): never chosen, so never a
 * route, and wherever the sports are told apart it goes as a run. */
export type Sport = "run" | "bike" | "paddle" | "paragliding";

export type SportOption = {
  id: Sport;
  emoji: string;
  /** In English: where it is shown, `t(name)` (TASK-210). */
  name: string;
  /**
   * False until the Route Engine draws routes for it: «Settings» shows it
   * with «Soon» and it cannot be chosen. The task that brings the sport
   * turns this on and gives it its activity (activityOf).
   */
  ready: boolean;
};

/** The sports of «Settings», in the order they are shown. */
export const SPORTS: readonly SportOption[] = [
  { id: "run", emoji: "🏃‍♂️", name: tLater("Run"), ready: true },
  { id: "bike", emoji: "🚴", name: tLater("Bike"), ready: true },
  { id: "paddle", emoji: "🛶", name: tLater("Paddle"), ready: true },
  { id: "paragliding", emoji: "🪂", name: tLater("Paragliding"), ready: false },
];

export const DEFAULT_SPORT: Sport = "run";
export const SPORT_FILE = "sport.json";

/** True when `sport` is one of `sports` and its routes can be drawn. */
export function canChoose(
  sport: unknown,
  sports: readonly SportOption[] = SPORTS,
): sport is Sport {
  return sports.some((option) => option.id === sport && option.ready);
}

/**
 * The sport chosen on this phone; "run" when none was chosen, the file does
 * not read, or the one in it is not ready (any more).
 */
export function loadSport(sports: readonly SportOption[] = SPORTS): Sport {
  try {
    const file = new File(Paths.document, SPORT_FILE);
    if (!file.exists) {
      return DEFAULT_SPORT;
    }
    const data: unknown = JSON.parse(file.textSync());
    const sport =
      typeof data === "object" && data !== null && "sport" in data ? data.sport : null;
    return canChoose(sport, sports) ? sport : DEFAULT_SPORT;
  } catch {
    return DEFAULT_SPORT;
  }
}

/** Told of each sport saved, while the app is open (TASK-190). */
const listeners = new Set<(sport: Sport) => void>();

/** Calls `listener` with each sport saved from now on, until the returned
 * function is called: «Draw» follows «Settings» at once (useSport). */
export function subscribeSport(listener: (sport: Sport) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps the choice for the next opening; a phone that refuses keeps nothing. */
export function saveSport(sport: Sport): void {
  try {
    const file = new File(Paths.document, SPORT_FILE);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ sport }));
  } catch {
    // The choice still holds while the app is open.
  }
  for (const listener of listeners) {
    listener(sport);
  }
}

/**
 * What «Draw» asks the API for (TASK-190, ADR-0153): a route on the roads a
 * bike may ride for «Bike», a shape on the water for «Paddle» (TASK-191,
 * ADR-0164), a run for «Run».
 */
export function activityOf(sport: Sport): Activity {
  switch (sport) {
    case "bike":
      return "cycling";
    case "paddle":
      return "paddling";
    default:
      return "running";
  }
}

/** The way out of «Draw» with the track only (TASK-149), in the sport's
 * words: «Ride» by bike (TASK-190), «Paddle» on the water (TASK-191). */
export function withoutRouteLabel(sport: Sport): string {
  switch (sport) {
    case "bike":
      return t("Ride without a route");
    case "paddle":
      return t("Paddle without a route");
    default:
      return t("Run without a route");
  }
}
