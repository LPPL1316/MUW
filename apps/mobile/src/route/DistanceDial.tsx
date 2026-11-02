import type { Activity } from "@shaperoute/shared-types";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { stepFeel } from "../haptics/haptics";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useTourPart } from "../tour/tourParts";
import { TOUR_PART } from "../tour/tourSteps";
import { shownNumber, writeDistance } from "../units/distanceInput";
import { useUnits } from "../units/useUnits";
import { HOLD_DELAY_MS, halfStepDistance, repeatDelayMs } from "./halfStep";

type Props = {
  /** The distance as typed, as `DistanceStepper` has it. */
  text: string;
  onText: (text: string) => void;
  /** Whose limits − and + keep to: a run's unless said. */
  activity?: Activity;
  /** «≈ 42 min at 5:20/km» under the number (`runTime.ts`); none: no line. */
  timeText?: string | null;
};

/**
 * The distance of «Draw» (TASK-361), in place of `DistanceStepper`: − and +
 * by half a km (or mile), held down they run on, faster and faster; the
 * number is a field, a tap types it. Each step is felt (`haptics`). For a
 * screen reader the number is adjustable: swipe up and down.
 */
export function DistanceDial({ text, onText, activity = "running", timeText }: Props) {
  const units = useUnits();
  // Shown by the tour of the first opening (TASK-266).
  const tourRef = useTourPart(TOUR_PART.distance);
  // The text as the last step left it: a held button steps from it, not
  // from the render the timer was set in.
  const latest = useRef(text);
  useEffect(() => {
    latest.current = text;
  }, [text]);

  function step(direction: -1 | 1) {
    const next = halfStepDistance(latest.current, direction, activity, units);
    if (next !== latest.current) {
      latest.current = next;
      stepFeel();
      onText(next);
    }
  }

  const unitName = units === "mi" ? t("Distance in miles") : t("Distance in km");
  return (
    <View style={styles.box}>
      <View ref={tourRef} collapsable={false} style={styles.row}>
        <HoldStep label="−" name={t("Shorter")} onStep={() => step(-1)} />
        <View
          style={styles.value}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={unitName}
          accessibilityValue={{ text: `${shownNumber(text, units)} ${units}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) =>
            step(event.nativeEvent.actionName === "increment" ? 1 : -1)
          }
        >
          <TextInput
            style={styles.field}
            value={shownNumber(text, units)}
            onChangeText={(typed) => onText(writeDistance(typed, units))}
            keyboardType="decimal-pad"
            keyboardAppearance="dark"
            selectTextOnFocus
            textAlign="center"
            accessibilityLabel={unitName}
            accessibilityHint={t("Tap to type the distance")}
          />
          <Text style={styles.unit}>{units}</Text>
        </View>
        <HoldStep label="+" name={t("Longer")} onStep={() => step(1)} />
      </View>
      {timeText ? (
        <Text style={styles.time} testID="run-time">
          {timeText}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A round − or +: a tap is one step; held for `HOLD_DELAY_MS` it steps on
 * by itself until let go (`repeatDelayMs`).
 */
function HoldStep({
  label,
  name,
  onStep,
}: {
  label: string;
  name: string;
  onStep: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held long enough to repeat: the release is no extra step.
  const held = useRef(false);
  const latestStep = useRef(onStep);
  useEffect(() => {
    latestStep.current = onStep;
  }, [onStep]);

  function stop() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }
  useEffect(() => stop, []);

  function repeat(count: number) {
    latestStep.current();
    timer.current = setTimeout(() => repeat(count + 1), repeatDelayMs(count));
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
      onPressIn={() => {
        held.current = false;
        stop();
        timer.current = setTimeout(() => {
          held.current = true;
          repeat(0);
        }, HOLD_DELAY_MS);
      }}
      onPressOut={stop}
      onPress={() => {
        if (!held.current) {
          onStep();
        }
        held.current = false;
      }}
      hitSlop={space.xs}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  step: {
    width: MIN_TAP_SIZE + space.md,
    height: MIN_TAP_SIZE + space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  pressed: {
    opacity: 0.7,
  },
  stepText: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.medium,
  },
  value: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: space.xs,
  },
  // Underlined like a field: a tap types the number.
  field: {
    minWidth: 88,
    minHeight: MIN_TAP_SIZE,
    color: color.text,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  unit: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  time: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
  },
});
