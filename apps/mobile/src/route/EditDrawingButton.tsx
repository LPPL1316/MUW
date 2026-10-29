import { Pressable, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { color, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";

/**
 * «Edit the drawing» (TASK-320) beside the figures of the result: it puts
 * the figure on the map of «Draw on the map», to draw on (TASK-331). Not
 * for a shape of the catalogue, which is not changed (ADR-0288).
 */
export function EditDrawingButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{t("Edit the drawing")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  buttonText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
