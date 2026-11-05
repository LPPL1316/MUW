import type { MuwRoute } from "@shaperoute/shared-types";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { findProfile, type SportProfile } from "../sports";
import { CYCLING, RIDE_IT_YOURSELF } from "../sports/cycling";

/**
 * What every MuW route says on its card (TASK-365, ADR-0310), approved by the
 * user in five languages: who made it, and that nobody ran it yet. Never
 * left out. Each sport says its own in src/sports (TASK-376 part B3); one
 * that says none, a ride's.
 */
export function muwLabel(activity: string): string {
  return t(muwSport(activity).muwLabel ?? RIDE_IT_YOURSELF);
}

/** The sport a MuW route is shown as: its own when it says its label, a
 * ride's otherwise. */
export function muwSport(activity: string): SportProfile {
  const sport = findProfile(activity);
  return sport?.muwLabel === undefined ? CYCLING : sport;
}

/** The route's title in `language`, in English when the file has none. */
export function muwTitle(route: MuwRoute, language: Language): string {
  return route.titles[language] ?? route.titles.en ?? "";
}
