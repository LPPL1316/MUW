import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SIGN_IN_TO_KEEP_RUNS, useActivitiesDoor } from "../activities/activitiesDoor";
import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import { clockLabel } from "../navigation/freeRun";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import { restsLabel, rowsOf, setLabel } from "./ExerciseList";
import { ExercisePicker } from "./ExercisePicker";
import { gymStyles } from "./gymStyles";
import { SetFields, type SetTexts, textsOf, valuesOfTexts } from "./SetFields";
import { entryOf, type Entry, setOf, valuesOf } from "./setKinds";
import type { GymSaved } from "./useGymOutbox";
import { changeWorkout, endGymWorkout } from "./useWorkout";
import {
  activeMs,
  chooseExercise,
  deleteSet,
  editSet,
  logSet,
  savable,
  type LoggedSet,
  type Workout,
} from "./workout";
import { entryName } from "./WorkoutScreen";

type Editing = { kind: "set"; n: number; entry: Entry } | { kind: "new"; entry: Entry };

/**
 * The workout ended (TASK-385 part B): its time, its exercises and sets and
 * its rests; every set can be corrected or taken away, and one forgotten
 * added, before «Save» (the user's «Sì, così»); a set added now is not
 * «live». «Save» keeps it on the phone and sends it; «Discard» asks first.
 * Signed out, it says to sign in, as the end of a run does.
 */
export function GymEnd({
  workout,
  onSave,
}: {
  workout: Workout;
  onSave: (workout: Workout) => GymSaved;
}) {
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const { signedIn, signIn } = useActivitiesDoor();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [texts, setTexts] = useState<SetTexts>({});
  const [picking, setPicking] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [problem, setProblem] = useState(false);

  function edit(set: LoggedSet) {
    const entry = entryOf(set);
    setEditing({ kind: "set", n: set.n, entry });
    setTexts(textsOf(entry, valuesOf(set), units));
  }

  function done() {
    if (editing === null) {
      return;
    }
    const values = valuesOfTexts(editing.entry, texts, units);
    const changed =
      editing.kind === "set"
        ? changeWorkout((going) => editSet(going, editing.n, values))
        : changeWorkout((going, at) =>
            logSet(chooseExercise(going, editing.entry, at), values, at),
          );
    if (changed) {
      setEditing(null);
    }
  }

  function save() {
    const saved = onSave(workout);
    if (saved === "kept") {
      endGymWorkout();
    } else {
      setProblem(true);
    }
  }

  if (picking) {
    return (
      <View style={[gymStyles.screen, { paddingTop: insets.top + space.lg }]}>
        <ExercisePicker
          onPick={(entry) => {
            setPicking(false);
            setEditing({ kind: "new", entry });
            setTexts({});
          }}
          onClose={() => setPicking(false)}
        />
      </View>
    );
  }

  const rests = restsLabel({
    rests: workout.rests,
    rest_s: workout.restS,
    sets: workout.sets,
  });
  const typed =
    editing === null
      ? null
      : setOf(editing.entry, valuesOfTexts(editing.entry, texts, units), 0, true);

  return (
    <View style={gymStyles.screen} testID="gym-end">
      <ScrollView
        contentContainerStyle={[
          gymStyles.content,
          {
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + space.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Text style={gymStyles.muted}>{`🏋️ ${t("Gym")}`}</Text>
          <Text style={styles.clock} testID="gym-end-time">
            {clockLabel(activeMs(workout, workout.endedMs ?? workout.startedMs))}
          </Text>
        </View>
        {workout.sets.length > 0 && (
          <Text style={gymStyles.text}>
            {t("{n} exercises · {s} sets", {
              n: String(rowsOf(workout.sets, appLanguage()).length),
              s: String(workout.sets.length),
            })}
          </Text>
        )}
        {rests !== null && <Text style={gymStyles.muted}>{rests}</Text>}
        {editing !== null ? (
          <View style={styles.edit} testID="gym-edit">
            <Text style={gymStyles.title}>{entryName(editing.entry)}</Text>
            <SetFields
              entry={editing.entry}
              texts={texts}
              units={units}
              onChange={setTexts}
            />
            <View style={gymStyles.row}>
              {editing.kind === "set" && (
                <Pressable
                  style={gymStyles.button}
                  onPress={() => {
                    changeWorkout((going) => deleteSet(going, editing.n));
                    setEditing(null);
                  }}
                  accessibilityRole="button"
                  testID="delete-set"
                >
                  <Text style={[gymStyles.buttonText, gymStyles.danger]}>
                    {t("Delete")}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[
                  gymStyles.button,
                  gymStyles.primary,
                  typed === null && gymStyles.disabled,
                ]}
                disabled={typed === null}
                onPress={done}
                accessibilityRole="button"
                testID="edit-done"
              >
                <Text style={[gymStyles.buttonText, gymStyles.primaryText]}>
                  {t("Done")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.sets}>
              {workout.sets.map((set) => (
                <Pressable
                  key={set.n}
                  style={styles.setRow}
                  onPress={() => edit(set)}
                  accessibilityRole="button"
                  testID={`gym-set-${set.n}`}
                >
                  <Text style={gymStyles.text}>{entryName(entryOf(set))}</Text>
                  <Text style={gymStyles.muted}>{setLabel(set, units)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={gymStyles.button}
              onPress={() => setPicking(true)}
              accessibilityRole="button"
            >
              <Text style={gymStyles.buttonText}>{t("+ Exercise")}</Text>
            </Pressable>
          </>
        )}
        {problem && (
          <Text style={[gymStyles.muted, gymStyles.danger]}>
            {t("This run could not be kept on the phone. Try again.")}
          </Text>
        )}
        {!signedIn && (
          <Pressable onPress={signIn} accessibilityRole="button">
            <Text style={[gymStyles.text, styles.link]}>{t(SIGN_IN_TO_KEEP_RUNS)}</Text>
          </Pressable>
        )}
        {editing === null &&
          (discarding ? (
            <View style={gymStyles.row}>
              <Pressable
                style={gymStyles.button}
                onPress={() => setDiscarding(false)}
                accessibilityRole="button"
              >
                <Text style={gymStyles.buttonText}>{t("Keep it")}</Text>
              </Pressable>
              <Pressable
                style={gymStyles.button}
                onPress={endGymWorkout}
                accessibilityRole="button"
                testID="gym-discard-sure"
              >
                <Text style={[gymStyles.buttonText, gymStyles.danger]}>
                  {t("Discard")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={gymStyles.row}>
              <Pressable
                style={gymStyles.button}
                onPress={() => setDiscarding(true)}
                accessibilityRole="button"
                testID="gym-discard"
              >
                <Text style={[gymStyles.buttonText, gymStyles.danger]}>
                  {t("Discard")}
                </Text>
              </Pressable>
              {signedIn && (
                <Pressable
                  style={[
                    gymStyles.button,
                    gymStyles.primary,
                    !savable(workout) && gymStyles.disabled,
                  ]}
                  disabled={!savable(workout)}
                  onPress={save}
                  accessibilityRole="button"
                  accessibilityLabel={t("Save to My activities")}
                  testID="gym-save"
                >
                  <Text style={[gymStyles.buttonText, gymStyles.primaryText]}>
                    {t("Save")}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
      </ScrollView>
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
  edit: {
    gap: space.md,
  },
  sets: {
    gap: space.xs,
  },
  setRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  link: {
    textDecorationLine: "underline",
  },
});
