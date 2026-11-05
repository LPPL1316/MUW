import type { GymSetKind } from "@shaperoute/shared-types";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import { color, space } from "../theme/tokens";
import { GYM_EXERCISES, type GymExercise, type GymGroup } from "./catalog";
import { groupName, GYM_GROUPS } from "./groups";
import { gymStyles } from "./gymStyles";
import type { Entry } from "./setKinds";

/** The longest name the API keeps for an exercise of one's own. */
export const MAX_NAME = 40;

/** Lower case and without accents, to find «Développé» typing «develop». */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** The exercises of `group` (all, with null) whose name in `language`, or
 * in English, has `search` in it, in the catalog's order. */
export function exercisesFound(
  search: string,
  group: GymGroup | null,
  language: Language,
): GymExercise[] {
  const wanted = plain(search);
  return GYM_EXERCISES.filter(
    (exercise) =>
      (group === null || exercise.group === group) &&
      (wanted === "" ||
        plain(exercise.names[language]).includes(wanted) ||
        plain(exercise.names.en).includes(wanted)),
  );
}

/** The kinds one's own exercise may be, with the words of its fields. */
const OWN_KINDS: readonly GymSetKind[] = ["load", "bodyweight", "timed", "cardio"];

function kindName(kind: GymSetKind, language: Language): string {
  switch (kind) {
    case "load":
      return t("Weight");
    case "bodyweight":
      return t("Reps");
    case "timed":
      return t("Time");
    case "cardio":
      return groupName("cardio", language);
  }
}

/**
 * «+ Exercise» (TASK-385 part B, the user's «Sì, così»): the catalog by
 * group, a search, and «Add “{name}”» for one it has not, with the kind
 * chosen by whoever writes it (by the words of its fields: weight, reps,
 * time, cardio).
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (entry: Entry) => void;
  onClose: () => void;
}) {
  const language = appLanguage();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<GymGroup | null>(null);
  const [own, setOwn] = useState<string | null>(null);
  const found = exercisesFound(search, group, language);
  const name = search.trim().slice(0, MAX_NAME);
  const exact = found.some(
    (exercise) => plain(exercise.names[language]) === plain(name),
  );

  if (own !== null) {
    return (
      <View style={gymStyles.content} testID="own-exercise">
        <Text style={gymStyles.title}>{own}</Text>
        <View style={styles.wrap}>
          {OWN_KINDS.map((kind) => (
            <Pressable
              key={kind}
              style={gymStyles.chip}
              onPress={() => onPick({ name: own, kind })}
              accessibilityRole="button"
              testID={`own-kind-${kind}`}
            >
              <Text style={gymStyles.chipText}>{kindName(kind, language)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={gymStyles.button}
          onPress={() => setOwn(null)}
          accessibilityRole="button"
        >
          <Text style={gymStyles.buttonText}>{t("Back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[gymStyles.content, styles.picker]} testID="exercise-picker">
      <View style={styles.top}>
        <TextInput
          style={[gymStyles.input, styles.search]}
          value={search}
          onChangeText={setSearch}
          placeholder={t("Search exercises")}
          placeholderTextColor={color.textFaint}
          accessibilityLabel={t("Search exercises")}
          autoCorrect={false}
          testID="exercise-search"
        />
        <Pressable style={gymStyles.chip} onPress={onClose} accessibilityRole="button">
          <Text style={gymStyles.chipText}>{t("Close")}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groups}
      >
        {GYM_GROUPS.map((item) => {
          const on = item === group;
          return (
            <Pressable
              key={item}
              style={[gymStyles.chip, on && gymStyles.chipOn]}
              onPress={() => setGroup(on ? null : item)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`group-${item}`}
            >
              <Text style={[gymStyles.chipText, on && gymStyles.chipTextOn]}>
                {groupName(item, language)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      >
        {name !== "" && !exact && (
          <Pressable
            style={styles.row}
            onPress={() => setOwn(name)}
            accessibilityRole="button"
            testID="add-own-exercise"
          >
            <Text style={gymStyles.text}>{t("Add “{name}”", { name })}</Text>
          </Pressable>
        )}
        {found.map((exercise) => (
          <Pressable
            key={exercise.key}
            style={styles.row}
            onPress={() => onPick({ exercise: exercise.key, kind: exercise.kind })}
            accessibilityRole="button"
            testID={`exercise-${exercise.key}`}
          >
            <Text style={gymStyles.text}>{exercise.names[language]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    flex: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  search: {
    flex: 1,
  },
  groups: {
    gap: space.sm,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  list: {
    paddingBottom: space.xxl,
  },
  row: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
});
