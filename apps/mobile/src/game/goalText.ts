import type { GameGoal, GameMe } from "@shaperoute/shared-types";

import { decimal, t } from "../i18n";
import { inUnits, paceLabel } from "../units/format";
import { appUnits, type Units } from "../units/units";

/**
 * What a shape of the game asks, and how far along the account is, in
 * words (TASK-296, docs/GIOCO.md §5.2), in the app's units (TASK-182):
 * the API speaks in metres and seconds a kilometre.
 */

/** "5 km", "3.1 mi", "21.1 km": a goal's distance, whole when it is. */
export function goalDistanceLabel(metres: number, units: Units = appUnits()): string {
  const value = inUnits(metres, units);
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : decimal(rounded)} ${units}`;
}

/** "5:00 /km", "8:03 /mi": a pace of so many seconds a kilometre. */
export function goalPaceLabel(paceS: number, units: Units = appUnits()): string {
  return paceLabel(1000, paceS * 1000, units) ?? "";
}

/** "5 km in total", "1 km under 5:00 /km": what the shape asks. */
export function goalText(goal: GameGoal, units: Units = appUnits()): string {
  if (goal.kind === "distance") {
    return t("{distance} in total", {
      distance: goalDistanceLabel(goal.total_m, units),
    });
  }
  return t("{distance} under {pace}", {
    distance: goalDistanceLabel(goal.distance_m, units),
    pace: goalPaceLabel(goal.pace_s, units),
  });
}

/**
 * How far along a shape not unlocked yet is, in words: "14.2 / 20 km" for
 * a distance; for a pace, the best time against the target once the
 * distance was run in one go, else the longest run so far.
 */
export function progressText(
  goal: GameGoal,
  me: GameMe,
  units: Units = appUnits(),
): string {
  if (goal.kind === "distance") {
    return `${decimal(inUnits(me.counted_m, units))} / ${goalDistanceLabel(goal.total_m, units)}`;
  }
  const bestS = me.best_s[String(goal.distance_m)];
  if (bestS !== undefined && bestS > 0) {
    return t("Best {best} · target {target}", {
      best: paceLabel(goal.distance_m, bestS * 1000, units) ?? "",
      target: goalPaceLabel(goal.pace_s, units),
    });
  }
  return t("Longest run {distance}", {
    distance: `${decimal(inUnits(me.longest_m, units))} ${units}`,
  });
}

/** "71%": the share of the way, as the API counts it. */
export function percentText(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}
