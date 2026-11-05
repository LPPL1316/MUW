import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { gymStyles } from "./gymStyles";
import { readDuration } from "./setKinds";
import {
  REST_CHOICES_S,
  REST_STEP_S,
  type Rest,
  restClock,
  restLeftMs,
} from "./restTimer";

/**
 * The rest between two sets (TASK-385 part B, the user's «Sì, così»): what
 * is left, large; «−15 s», «+15 s» and «Skip»; the set after it written
 * under; the durations to choose another (30 s to 3 min, and «Custom»),
 * which the exercise then keeps.
 */
export function RestPanel({
  rest,
  nowMs,
  next,
  onShift,
  onSkip,
  onChoose,
}: {
  rest: Rest;
  nowMs: number;
  /** «Next: {exercise} · set {n}»; null before any exercise. */
  next: string | null;
  onShift: (deltaS: number) => void;
  onSkip: () => void;
  /** A duration chosen: the rest starts again with it. */
  onChoose: (seconds: number) => void;
}) {
  const [custom, setCustom] = useState<string | null>(null);
  const left = restLeftMs(rest, nowMs);
  const customS = custom === null ? null : readDuration(custom, "timed");
  return (
    <View style={styles.panel} testID="rest-panel">
      <Text style={styles.title} accessibilityRole="header">
        {t("Rest")}
      </Text>
      <Text style={styles.clock} accessibilityRole="timer" testID="rest-clock">
        {restClock(left)}
      </Text>
      <View style={gymStyles.row}>
        <Pressable
          style={gymStyles.button}
          onPress={() => onShift(-REST_STEP_S)}
          accessibilityRole="button"
          testID="rest-less"
        >
          <Text style={gymStyles.buttonText}>{`−${REST_STEP_S} s`}</Text>
        </Pressable>
        <Pressable
          style={gymStyles.button}
          onPress={() => onShift(REST_STEP_S)}
          accessibilityRole="button"
          testID="rest-more"
        >
          <Text style={gymStyles.buttonText}>{`+${REST_STEP_S} s`}</Text>
        </Pressable>
        <Pressable
          style={[gymStyles.button, gymStyles.primary]}
          onPress={onSkip}
          accessibilityRole="button"
          testID="rest-skip"
        >
          <Text style={[gymStyles.buttonText, gymStyles.primaryText]}>{t("Skip")}</Text>
        </Pressable>
      </View>
      {next !== null && <Text style={gymStyles.text}>{next}</Text>}
      <View style={styles.choices}>
        {REST_CHOICES_S.map((seconds) => (
          <Pressable
            key={seconds}
            style={gymStyles.chip}
            onPress={() => onChoose(seconds)}
            accessibilityRole="button"
            testID={`rest-${seconds}`}
          >
            <Text style={gymStyles.chipText}>{restClock(seconds * 1000)}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[gymStyles.chip, custom !== null && gymStyles.chipOn]}
          onPress={() => setCustom(custom === null ? "" : null)}
          accessibilityRole="button"
          testID="rest-custom"
        >
          <Text style={[gymStyles.chipText, custom !== null && gymStyles.chipTextOn]}>
            {t("Custom")}
          </Text>
        </Pressable>
      </View>
      {custom !== null && (
        <View style={gymStyles.row}>
          <TextInput
            style={[gymStyles.input, styles.custom]}
            value={custom}
            onChangeText={setCustom}
            placeholder="0:00"
            placeholderTextColor={color.textFaint}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={t("Custom")}
            testID="rest-custom-time"
          />
          <Pressable
            style={[gymStyles.button, customS === null && gymStyles.disabled]}
            disabled={customS === null}
            onPress={() => {
              if (customS !== null) {
                onChoose(customS);
                setCustom(null);
              }
            }}
            accessibilityRole="button"
            testID="rest-custom-done"
          >
            <Text style={gymStyles.buttonText}>{t("Done")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surfaceRaised,
  },
  title: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  clock: {
    color: color.text,
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  custom: {
    flex: 1,
  },
});
