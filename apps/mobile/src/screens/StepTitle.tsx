import { StyleSheet, Text, View } from "react-native";

import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";

/** The side of the number's circle. */
const NUMBER_SIZE = 22;

/**
 * A section of «Draw» as a step (TASK-361): «1 START», «2 WHAT YOU DRAW»,
 * «3 DISTANCE», so the screen reads in order, top to bottom. A header for
 * a screen reader, with its number.
 */
export function StepTitle({ number, label }: { number: number; label: string }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${number}. ${label}`}
    >
      <View style={styles.circle}>
        <Text style={styles.number}>{number}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  // Not yellow: the number orders, it does not ask to be pressed.
  circle: {
    width: NUMBER_SIZE,
    height: NUMBER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  number: {
    color: color.text,
    fontSize: fontSize.detail,
    fontWeight: fontWeight.bold,
  },
  // As the labels of «Draw», a step brighter: textMuted is 7:1.
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
});
