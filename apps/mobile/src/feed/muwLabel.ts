import type { MuwRoute } from "@shaperoute/shared-types";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";

/**
 * What every MuW route says on its card (TASK-365, ADR-0310), approved by the
 * user in five languages: who made it, and that nobody ran it yet. Never
 * left out.
 */
export function muwLabel(activity: string): string {
  switch (activity) {
    case "running":
      return t("Route created by MuW – run it yourself");
    case "paddling":
      return t("Route created by MuW – paddle it yourself");
    default:
      return t("Route created by MuW – ride it yourself");
  }
}

/** The route's title in `language`, in English when the file has none. */
export function muwTitle(route: MuwRoute, language: Language): string {
  return route.titles[language] ?? route.titles.en ?? "";
}
