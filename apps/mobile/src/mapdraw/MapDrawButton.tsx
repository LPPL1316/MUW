import { Pressable, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { color, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";

/**
 * Under «Shape | Word | Image» in «Draw» (TASK-281, the user's choice of
 * 2026-10-13): opens the map of the start, to draw on it or put a figure
 * there. Not on the water, where «Draw» has no switch.
 */
export function MapDrawButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.text}>{t("Draw on the map")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Not yellow: that is the route's, and «Draw route» below.
  button: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  text: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
