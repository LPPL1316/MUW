import type { SwimTurn } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { useUnits } from "../units/useUnits";

import { firstLapTurns, lapsNote, turnAt, turnLabel } from "./swimTurns";

/**
 * On a swim's result, before «Start» (TASK-323 C): where it turns, the
 * first lap's turns in order, each with the place on the shore to look at
 * when the engine found one. In the water the phone is not looked at: they
 * are learnt here. Nothing for a swim without turns, like a circle.
 */
export function SwimTurns({
  turns,
  laps,
}: {
  turns: readonly SwimTurn[] | undefined;
  laps: number | undefined;
}) {
  const units = useUnits();
  const shown = firstLapTurns(turns);
  if (shown.length === 0) {
    return null;
  }
  const note = lapsNote(laps);
  return (
    <View style={styles.list}>
      <Text style={styles.label} accessibilityRole="header">
        {t("TURNS")}
      </Text>
      {note !== null && <Text style={styles.note}>{note}</Text>}
      {shown.map((turn) => {
        const label = turnLabel(turn);
        const at = turnAt(turn, units);
        return (
          <View
            key={turn.at_m}
            style={styles.row}
            accessible
            accessibilityLabel={`${label}, ${at}`}
          >
            <Text style={styles.arrow} accessibilityElementsHidden>
              {turn.side === "left" ? "↰" : "↱"}
            </Text>
            <View style={styles.words}>
              <Text style={styles.name}>{label}</Text>
              <Text style={styles.at}>{at}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
  },
  // As the section labels of the route's panel (RoutePanel's `label`).
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
  },
  arrow: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  words: {
    flex: 1,
    gap: space.xs,
  },
  name: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  at: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
