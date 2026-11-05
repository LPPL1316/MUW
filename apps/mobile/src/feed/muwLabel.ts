import type { MuwRoute } from "@shaperoute/shared-types";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { SPORT_PROFILES } from "../sports";
import { RIDE_IT_YOURSELF } from "../sports/cycling";

/**
 * What every MuW route says on its card (TASK-365, ADR-0310), approved by the
 * user in five languages: who made it, and that nobody ran it yet. Never
 * left out. Each sport says its own in src/sports (TASK-376 part B3); one
 * that says none, a ride's.
 */
export function muwLabel(activity: string): string {
  const sport = SPORT_PROFILES.find((profile) => profile.activity === activity);
  return t(sport?.muwLabel ?? RIDE_IT_YOURSELF);
}

/** The route's title in `language`, in English when the file has none. */
export function muwTitle(route: MuwRoute, language: Language): string {
  return route.titles[language] ?? route.titles.en ?? "";
}
