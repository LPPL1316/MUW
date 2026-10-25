import type { RouteResult } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { t } from "../i18n";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { choiceLabel, likeness } from "./choices";

type Props = {
  /** The routes to choose from, the engine's first (`choicesOf`). */
  choices: RouteResult[];
  chosen: number;
  onChoose: (index: number) => void;
};

/**
 * Under the route: one tile for each route to choose from (TASK-093,
 * ADR-0087), with its length and how much it looks like the shape. The one
 * chosen has the route's yellow; the others are grey on the map too. The
 * length is in the app's units (TASK-182).
 */
export function RouteTiles({ choices, chosen, onChoose }: Props) {
  const units = useUnits();
  if (choices.length < 2) {
    return null;
  }
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {choices.map((result, index) => {
        const km = distanceLabel(result.distance_m, units);
        const selected = index === chosen;
        return (
          <Pressable
            key={choiceLabel(index)}
            testID={`route-${choiceLabel(index)}`}
            style={[styles.tile, selected && styles.chosen]}
            onPress={() => onChoose(index)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(
              "Route {label}, {distance}, {likeness} like the shape",
              {
                label: choiceLabel(index),
                distance: km,
                likeness: likeness(result),
              },
            )}
          >
            <Text style={styles.label}>{choiceLabel(index)}</Text>
            <Text style={styles.detail}>{`${km} · ${likeness(result)}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  tile: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  chosen: {
    borderWidth: 2,
    borderColor: color.accent,
  },
  label: {
    color: color.text,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.body,
  },
  detail: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
});
