import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import { clockLabel } from "../navigation/freeRun";
import { useRunAwake } from "../navigation/useRunAwake";
import { HoldButton } from "../screens/HoldButton";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import { exerciseName } from "./catalog";
import { ExerciseList } from "./ExerciseList";
import { ExercisePicker } from "./ExercisePicker";
import { gymStyles } from "./gymStyles";
import { useRestAlert } from "./restAlert";
import { RestPanel } from "./RestPanel";
import { restOver } from "./restTimer";
import { SetFields, type SetTexts, textsOf, valuesOfTexts } from "./SetFields";
import { type Entry, setOf } from "./setKinds";
import { StillTraining } from "./StillTraining";
import { changeWorkout } from "./useWorkout";
import {
  activeMs,
  chooseExercise,
  finishWorkout,
  isPaused,
  logSet,
  nextSetNumber,
  pauseWorkout,
  restNow,
  resumeWorkout,
  sameAgainValues,
  setsOf,
  shiftWorkoutRest,
  skipRest,
  stillAsking,
  stillTraining,
  type Workout,
} from "./workout";

/** The name of what `entry` is, in the app's language. */
export function entryName(entry: Entry): string {
  return exerciseName(
    "exercise" in entry ? { exercise: entry.exercise } : { name: entry.name },
    appLanguage(),
  );
}

/** «Next: {exercise} · set {n}», for the rest and its notification. */
export function nextLabel(workout: Workout): string | null {
  return workout.current === null
    ? null
    : t("Next: {exercise} · set {n}", {
        exercise: entryName(workout.current),
        n: String(nextSetNumber(workout)),
      });
}

/**
 * A workout at the gym while it lasts (TASK-385 part B, the user's choices
 * of 2026-11-04): the time without the pauses, the exercise being done
 * with the boxes of its next set, «Log set» and «Same again», «+ Exercise»,
 * the rest after each set, the sets so far, «Pause» and «Stop» to hold.
 * A set or a rest ends a «Pause»; the clock runs through the rests. The
 * screen stays on while a rest counts down.
 */
export function WorkoutScreen({ workout, nowMs }: { workout: Workout; nowMs: number }) {
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const [picking, setPicking] = useState(workout.current === null);
  const [texts, setTexts] = useState<SetTexts>(() => {
    const last = sameAgainValues(workout);
    return workout.current === null || last === null
      ? {}
      : textsOf(workout.current, last, units);
  });
  const paused = isPaused(workout);
  const rest =
    workout.rest !== null && !restOver(workout.rest, nowMs) ? workout.rest : null;
  const next = nextLabel(workout);
  useRestAlert(rest, next);
  useRunAwake(rest !== null);

  const current = workout.current;
  const typed =
    current === null
      ? null
      : setOf(current, valuesOfTexts(current, texts, units), 0, true);
  const again = sameAgainValues(workout);

  function pick(entry: Entry) {
    changeWorkout((going, at) => chooseExercise(going, entry, at));
    const last = setsOf(workout, entry).at(-1);
    setTexts(last === undefined ? {} : textsOf(entry, last, units));
    setPicking(false);
  }

  if (picking) {
    return (
      <View style={[gymStyles.screen, { paddingTop: insets.top + space.lg }]}>
        <ExercisePicker onPick={pick} onClose={() => setPicking(false)} />
      </View>
    );
  }

  const done = workout.sets.length > 0;
  return (
    <View style={gymStyles.screen} testID="gym-workout">
      <ScrollView
        contentContainerStyle={[
          gymStyles.content,
          { paddingTop: insets.top + space.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Text style={gymStyles.muted}>{`🏋️ ${t("Gym")}`}</Text>
          <Text style={styles.clock} accessibilityRole="timer" testID="gym-clock">
            {clockLabel(activeMs(workout, nowMs))}
          </Text>
          {paused && <Text style={gymStyles.muted}>{t("Paused")}</Text>}
        </View>
        {stillAsking(workout, nowMs) && (
          <StillTraining
            onYes={() => changeWorkout((going, at) => stillTraining(going, at))}
            onFinish={() => changeWorkout((going, at) => finishWorkout(going, at))}
          />
        )}
        {rest !== null && (
          <RestPanel
            rest={rest}
            nowMs={nowMs}
            next={next}
            onShift={(delta) =>
              changeWorkout((going, at) => shiftWorkoutRest(going, delta, at))
            }
            onSkip={() => changeWorkout((going, at) => skipRest(going, at))}
            onChoose={(seconds) =>
              changeWorkout((going, at) => restNow(going, seconds, at))
            }
          />
        )}
        {current !== null && (
          <View style={styles.set} testID="gym-set">
            <Text style={gymStyles.title}>{entryName(current)}</Text>
            <Text style={gymStyles.muted}>
              {t("Set {n}", { n: String(nextSetNumber(workout)) })}
            </Text>
            <SetFields
              entry={current}
              texts={texts}
              units={units}
              onChange={setTexts}
            />
            <View style={gymStyles.row}>
              <Pressable
                style={[
                  gymStyles.button,
                  gymStyles.primary,
                  typed === null && gymStyles.disabled,
                ]}
                disabled={typed === null}
                onPress={() =>
                  changeWorkout((going, at) =>
                    logSet(going, valuesOfTexts(current, texts, units), at),
                  )
                }
                accessibilityRole="button"
                testID="log-set"
              >
                <Text style={[gymStyles.buttonText, gymStyles.primaryText]}>
                  {t("Log set")}
                </Text>
              </Pressable>
              <Pressable
                style={[gymStyles.button, again === null && gymStyles.disabled]}
                disabled={again === null}
                onPress={() => {
                  if (again !== null) {
                    setTexts(textsOf(current, again, units));
                    changeWorkout((going, at) => logSet(going, again, at));
                  }
                }}
                accessibilityRole="button"
                testID="same-again"
              >
                <Text style={gymStyles.buttonText}>{t("Same again")}</Text>
              </Pressable>
            </View>
          </View>
        )}
        <Pressable
          style={[gymStyles.button, current === null && gymStyles.primary]}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          testID="add-exercise"
        >
          <Text
            style={[gymStyles.buttonText, current === null && gymStyles.primaryText]}
          >
            {t("+ Exercise")}
          </Text>
        </Pressable>
        {done && (
          <ExerciseList
            exercises={{
              rests: workout.rests,
              rest_s: workout.restS,
              sets: workout.sets,
            }}
          />
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          style={gymStyles.button}
          onPress={() =>
            changeWorkout((going, at) =>
              paused ? resumeWorkout(going, at) : pauseWorkout(going, at),
            )
          }
          accessibilityRole="button"
          testID="gym-pause"
        >
          <Text style={gymStyles.buttonText}>{paused ? t("Resume") : t("Pause")}</Text>
        </Pressable>
        <HoldButton
          onHeld={() => changeWorkout((going, at) => finishWorkout(going, at))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: "center",
    gap: space.xs,
  },
  clock: {
    color: color.text,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  set: {
    gap: space.md,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
});
