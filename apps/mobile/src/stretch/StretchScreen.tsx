import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { t } from "../i18n";
import { useRunAwake } from "../navigation/useRunAwake";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { chime } from "./chime";
import { type Exercise, EXERCISES } from "./exercises";
import { Figure, POSE_MS } from "./Figure";
import { STAND } from "./poses";

/**
 * The stretching after a run (TASK-285 part B, ADR-0247): five exercises
 * one after the other, each with the figure doing it, a line on how, and a
 * countdown. When the time is up a short sound rings and the next one
 * comes by itself; an exercise held on each side turns the figure round
 * half-way. «Pause» holds the time, «Skip» leaves for «Your run» at any
 * moment, and so does «Done» after the last. Opened from «Stretch» on the
 * card of part A.
 */

/** The countdown's step. */
export const TICK_MS = 1000;

/** Between two sides the figure stands up, then turns and goes down again. */
export const STAND_MS = POSE_MS * 0.6;

/** How often the time left is said to a screen reader. */
export const SAID_EVERY_S = 10;

type Props = {
  /** The stretching is over, skipped or done: on to «Your run». */
  onLeave: () => void;
  exercises?: readonly Exercise[];
};

/** "0:20", "1:05": the seconds left as a clock. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where the routine is: which exercise, which side, how long still. */
type Step = { index: number; side: 0 | 1; left: number };

export function StretchScreen({ onLeave, exercises = EXERCISES }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [step, setStep] = useState<Step>({
    index: 0,
    side: 0,
    left: exercises[0].seconds,
  });
  const [paused, setPaused] = useState(false);
  // Between two sides: standing, before the turned figure goes down again.
  const [standing, setStanding] = useState(false);
  const exercise = exercises[step.index];
  const last = step.index === exercises.length - 1;
  // Where the timer is, kept by the timer itself: two ticks may fire before
  // React has drawn the first (under jest they do), and the second must
  // count from the first. The screen follows it through `step`.
  const now = useRef(step);
  const leave = useRef(onLeave);
  const stand = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    leave.current = onLeave;
  }, [onLeave]);
  useEffect(
    () => () => {
      if (stand.current !== null) {
        clearTimeout(stand.current);
      }
    },
    [],
  );

  useRunAwake(true);

  /** The timer moves on: what it reads next, and what the screen shows. */
  const go = useCallback((to: Step) => {
    now.current = to;
    setStep(to);
  }, []);

  /** The time is up: the other side, the next exercise, or the end. */
  const advance = useCallback(
    (from: Step) => {
      chime();
      const done = exercises[from.index];
      if (done.sides && from.side === 0) {
        setStanding(true);
        go({ index: from.index, side: 1, left: done.seconds });
        AccessibilityInfo.announceForAccessibility(t("Switch sides"));
        stand.current = setTimeout(() => setStanding(false), STAND_MS);
        return;
      }
      if (from.index + 1 < exercises.length) {
        const next = exercises[from.index + 1];
        go({ index: from.index + 1, side: 0, left: next.seconds });
        AccessibilityInfo.announceForAccessibility(t(next.name));
        return;
      }
      go({ ...from, left: 0 });
      leave.current();
    },
    [exercises, go],
  );

  // The countdown: one second at a time while not paused.
  useEffect(() => {
    if (paused) {
      return;
    }
    const timer = setInterval(() => {
      const at = now.current;
      if (at.left > 1) {
        go({ ...at, left: at.left - 1 });
      } else if (at.left === 1) {
        advance(at);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [paused, advance, go]);

  // The time left, now and then, for a screen reader.
  useEffect(() => {
    if (
      step.left > 0 &&
      step.left % SAID_EVERY_S === 0 &&
      step.left < exercise.seconds
    ) {
      AccessibilityInfo.announceForAccessibility(
        t("{seconds} seconds left", { seconds: step.left }),
      );
    }
  }, [step.left, exercise.seconds]);

  const sideLabel = exercise.sides
    ? step.side === 0
      ? t("Right side")
      : t("Left side")
    : null;
  const figureHeight = Math.min(360, windowHeight * 0.4);

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      // Android's back button leaves, as «Skip» does.
      onRequestClose={onLeave}
    >
      <StatusBar hidden />
      <View style={styles.screen} testID="stretch-screen">
        <View style={styles.top}>
          <Text style={styles.count}>
            {t("{index} of {total}", {
              index: step.index + 1,
              total: exercises.length,
            })}
          </Text>
          <Text style={styles.name} accessibilityRole="header">
            {t(exercise.name)}
          </Text>
          <Text style={styles.howTo}>{t(exercise.howTo)}</Text>
          {sideLabel !== null && <Text style={styles.side}>{sideLabel}</Text>}
        </View>
        <Figure
          pose={standing ? STAND : exercise.pose}
          height={figureHeight}
          mirrored={step.side === 1}
          testID="stretch-figure"
        />
        <View style={styles.bottom}>
          <Text
            style={styles.clock}
            accessibilityRole="timer"
            accessibilityLabel={t("{seconds} seconds left", { seconds: step.left })}
          >
            {clockLabel(step.left)}
          </Text>
          <View style={styles.bar} accessible={false}>
            <View style={[styles.barLeft, { flex: step.left }]} />
            <View style={{ flex: exercise.seconds - step.left }} />
          </View>
          <View style={styles.buttons}>
            <Pressable
              style={styles.button}
              onPress={() => setPaused((p) => !p)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{paused ? t("Resume") : t("Pause")}</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={onLeave}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{last ? t("Done") : t("Skip")}</Text>
            </Pressable>
          </View>
          <Text style={styles.care}>{t("Stop if it hurts.")}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: space.xxl * 2,
    paddingBottom: space.xxl,
    paddingHorizontal: space.xl,
    backgroundColor: color.background,
  },
  top: {
    gap: space.sm,
  },
  count: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  howTo: {
    color: color.textMuted,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.4,
  },
  side: {
    color: color.accent,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  bottom: {
    gap: space.md,
    alignItems: "center",
  },
  clock: {
    color: color.text,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  bar: {
    alignSelf: "stretch",
    flexDirection: "row",
    height: space.sm,
    borderRadius: space.sm / 2,
    overflow: "hidden",
    backgroundColor: color.surfaceRaised,
  },
  barLeft: {
    backgroundColor: color.accent,
  },
  buttons: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "center",
    gap: space.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
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
  care: {
    color: color.textFaint,
    fontSize: fontSize.small,
  },
});
