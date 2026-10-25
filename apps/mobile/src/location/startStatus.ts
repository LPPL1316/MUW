import { t } from "../i18n";
import type { Start, StartMode } from "./startMode";
import type { PositionState } from "./useCurrentPosition";

/**
 * The line under «My position» and «Another place» in «Draw»: where the
 * route starts, or what is missing for it, in the app's language (TASK-210,
 * part H; it was in `App.tsx`, in English).
 */
export function startStatus(
  mode: StartMode,
  position: PositionState,
  start: Start | null,
): string {
  if (start?.source === "gps") {
    return t("Starting from your position.");
  }
  if (start?.source === "search") {
    return t("Starting from {place}.", { place: start.label });
  }
  // No name for it: nothing is asked of the network (TASK-292).
  if (start?.source === "map") {
    return t("Starting from a point on the map.");
  }
  if (mode === "place") {
    return t("Search for a city or street to start from.");
  }
  switch (position.status) {
    case "denied":
      return t(
        "Location is off for MuW. Allow it in Settings, or search for a place to start from.",
      );
    case "unavailable":
      return t(
        "Your position is not available right now. Search for a place to start from.",
      );
    default:
      return t("Finding your position…");
  }
}
