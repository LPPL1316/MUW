import type { LatLon } from "@shaperoute/shared-types";

import type { PositionState } from "./useCurrentPosition";

/** Where the user wants to start from (TASK-054): the GPS, or another place. */
export type StartMode = "gps" | "place";

/** Where the route will start: the GPS position, a place searched for, or a
 * point chosen on the map (TASK-292), which has no name. */
export type Start =
  | { point: LatLon; source: "gps" }
  | { point: LatLon; source: "search"; label: string }
  | { point: LatLon; source: "map" };

/** A place found by the search, as the start needs it; without a label, a
 * point chosen on the map (TASK-292). */
export type ChosenPlace = { point: LatLon; label: string | null };

/**
 * The start for the mode chosen. With "place" only the place counts, even when
 * the GPS answers; with "gps" the GPS wins as soon as it answers, and a place
 * searched while it could not answer stands in for it. A point chosen on the
 * map counts as a place searched for.
 */
export function chooseStart(
  mode: StartMode,
  position: PositionState,
  place: ChosenPlace | null,
): Start | null {
  if (mode === "gps" && position.status === "ok") {
    return { point: position.point, source: "gps" };
  }
  if (place?.label === null) {
    return { point: place.point, source: "map" };
  }
  if (place) {
    return { point: place.point, source: "search", label: place.label };
  }
  return null;
}

/** The search shows when another place is asked for, or the GPS cannot help. */
export function showsSearch(mode: StartMode, position: PositionState): boolean {
  return (
    mode === "place" ||
    position.status === "denied" ||
    position.status === "unavailable"
  );
}
