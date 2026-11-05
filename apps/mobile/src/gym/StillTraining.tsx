import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, radius, space } from "../theme/tokens";
import { gymStyles } from "./gymStyles";

/**
 * «Still training?» (TASK-385 part B, the user's «Sì, così»): after 30
 * minutes with nothing logged. Without an answer the workout ends at its
 * last set (workout.ts `unanswered`).
 */
export function StillTraining({
  onYes,
  onFinish,
}: {
  onYes: () => void;
  onFinish: () => void;
}) {
  return (
    <View style={styles.card} testID="still-training" accessibilityRole="alert">
      <Text style={gymStyles.title}>{t("Still training?")}</Text>
      <View style={gymStyles.row}>
        <Pressable
          style={[gymStyles.button, gymStyles.primary]}
          onPress={onYes}
          accessibilityRole="button"
          testID="still-yes"
        >
          <Text style={[gymStyles.buttonText, gymStyles.primaryText]}>
            {t("Yes, keep going")}
          </Text>
        </Pressable>
        <Pressable
          style={gymStyles.button}
          onPress={onFinish}
          accessibilityRole="button"
          testID="still-finish"
        >
          <Text style={gymStyles.buttonText}>{t("Finish workout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.surfaceRaised,
  },
});
