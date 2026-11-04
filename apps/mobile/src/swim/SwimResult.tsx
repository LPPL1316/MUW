import { MAX_SWIM_LAPS, type RouteResult } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t, tPlural } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { nearDistanceLabel } from "../units/format";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";

import { SwimRouteNote } from "./SwimRouteNote";
import { SwimTurns } from "./SwimTurns";

/** «3 laps of 320 m»: how many times round the shape, and how long one lap
 * is without the legs from the shore; null from an API without `lap_m`. */
export function lapsLine(result: RouteResult, units: Units): string | null {
  if (result.lap_m == null) {
    return null;
  }
  const values = { distance: nearDistanceLabel(result.lap_m, units) };
  return tPlural(
    result.laps ?? 1,
    "{count} lap of {distance}",
    "{count} laps of {distance}",
    values,
  );
}

/**
 * Under a swim's distance (TASK-323 C2, the user's choice): its laps, the
 * shape bigger or smaller at the same distance, the line under every swim
 * and the turns to learn before «Start». «Bigger shape» is a lap fewer,
 * «Smaller shape» a lap more (`onLaps`, the swim drawn again with them);
 * neither past 1 or MAX_SWIM_LAPS. When the engine cannot, the usual
 * message says so.
 */
export function SwimResult({
  result,
  onLaps,
}: {
  result: RouteResult;
  onLaps?: (laps: number) => void;
}) {
  const units = useUnits();
  const laps = result.laps ?? 1;
  const line = lapsLine(result, units);
  return (
    <View style={styles.swim}>
      {line !== null && <Text style={styles.laps}>{line}</Text>}
      {onLaps && (laps > 1 || laps < MAX_SWIM_LAPS) && (
        <View style={styles.sizes}>
          {laps > 1 && (
            <Pressable
              style={styles.size}
              onPress={() => onLaps(laps - 1)}
              accessibilityRole="button"
            >
              <Text style={styles.sizeText}>{t("Bigger shape")}</Text>
            </Pressable>
          )}
          {laps < MAX_SWIM_LAPS && (
            <Pressable
              style={styles.size}
              onPress={() => onLaps(laps + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.sizeText}>{t("Smaller shape")}</Text>
            </Pressable>
          )}
        </View>
      )}
      <SwimRouteNote />
      <SwimTurns turns={result.turns} laps={result.laps} />
    </View>
  );
}

const styles = StyleSheet.create({
  swim: {
    gap: space.sm,
  },
  // As the line under the route's distance (RoutePanel's `target`).
  laps: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  sizes: {
    flexDirection: "row",
    gap: space.sm,
  },
  // As RoutePanel's `secondary` buttons, side by side.
  size: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  sizeText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
