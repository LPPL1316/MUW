import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import type { HealthStore } from "./healthPhone";
import type { HealthState } from "./useHealth";

type Props = {
  store: HealthStore;
  health: HealthState;
};

/**
 * Apple Health (or Health Connect) at the end of an activity (TASK-321,
 * ADR-0281), under «Send to Strava»: the button until the user's yes, as
 * «Connect with Strava» until Strava is connected; then a line says the
 * activity goes there with «Save», or that the phone's permission is off
 * and where to turn it on. Nothing without the native module. In the
 * words of Apple's rules: «Apple Health», never «HealthKit».
 */
export function HealthRunEnd({ store, health }: Props) {
  const apple = store === "apple";
  const { line, asking, turnOn } = health;
  if (line === "hidden") {
    return null;
  }
  if (line === "ask") {
    return (
      <View style={styles.block}>
        <View style={styles.row}>
          <Pressable
            style={styles.button}
            onPress={turnOn}
            disabled={asking}
            accessibilityRole="button"
            accessibilityState={{ disabled: asking, busy: asking }}
          >
            <Text style={styles.buttonText}>
              {t(apple ? "Save to Apple Health" : "Save to Health Connect")}
            </Text>
          </Pressable>
          {asking && (
            <ActivityIndicator testID="health-wheel" color={color.textMuted} />
          )}
        </View>
        <Text style={styles.line}>
          {t(
            apple
              ? "Your activities also go to the Fitness app, with the route."
              : "Your activities also go to Health Connect, with the route.",
          )}
        </Text>
      </View>
    );
  }
  if (line === "refused") {
    return (
      <Text style={styles.problem} accessibilityRole="alert">
        {t(
          apple
            ? "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW."
            : "MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.",
        )}
      </Text>
    );
  }
  return (
    <Text style={styles.line}>
      {t(
        apple
          ? "Also to Apple Health, with Save."
          : "Also to Health Connect, with Save.",
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  // Neutral, as every button of the end of a run: the yellow is the
  // route's (docs/UI.md, «Il tema»).
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  line: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
