import { Pressable, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

/**
 * «🏃 Run without a route» in the header of «Draw» (TASK-361): outlined, no
 * more yellow (ADR-0183 set aside), so the only yellow on the screen is the
 * route's button at its foot. The runner and the words are one button:
 * the runner alone did not say what it does.
 */
export function RunNoRouteButton({
  label,
  icon = "🏃",
  onPress,
}: {
  /** «Run without a route», or the sport's own words (`withoutRouteLabel`). */
  label: string;
  /** The sport's sign: a bike rides. */
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("Records the run without drawing a route first")}
      testID="run-no-route"
    >
      <Text style={styles.icon} importantForAccessibility="no">
        {icon}
      </Text>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: "transparent",
  },
  pressed: {
    backgroundColor: color.surfaceRaised,
  },
  icon: {
    fontSize: fontSize.body,
  },
  text: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
