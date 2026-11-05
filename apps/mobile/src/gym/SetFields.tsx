import { StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import { color, font, space } from "../theme/tokens";
import type { Units } from "../units/units";
import { gymStyles } from "./gymStyles";
import {
  type Entry,
  fieldsOf,
  fieldText,
  fieldUnit,
  readField,
  type SetField,
  type SetValues,
} from "./setKinds";

/** What is typed in each field, as it is typed. */
export type SetTexts = Partial<Record<SetField, string>>;

/** The name of `field` over its box (the user's texts, 2026-11-04). */
export function fieldName(field: SetField, entry: Entry): string {
  switch (field) {
    case "reps":
      return t("Reps");
    case "load_kg":
      return entry.kind === "bodyweight" ? t("Added weight") : t("Weight");
    case "duration_s":
      return t("Time");
    case "distance_m":
      return t("Distance");
    case "speed_kmh":
      return t("Speed");
    case "incline_pct":
      return t("Incline");
    case "level":
      return t("Level");
    case "floors":
      return t("Floors");
  }
}

/** The texts of `values`, to type them again. */
export function textsOf(entry: Entry, values: SetValues, units: Units): SetTexts {
  const texts: SetTexts = {};
  for (const field of fieldsOf(entry)) {
    const value = values[field];
    if (value !== undefined) {
      texts[field] = fieldText(field, value, units);
    }
  }
  return texts;
}

/** The values of what was typed; a field that is no number is left out,
 * and setOf says whether the set is whole. */
export function valuesOfTexts(entry: Entry, texts: SetTexts, units: Units): SetValues {
  const values: SetValues = {};
  for (const field of fieldsOf(entry)) {
    const text = texts[field];
    if (text === undefined || text.trim() === "") {
      continue;
    }
    const value = readField(field, text, entry.kind, units);
    if (value !== null) {
      values[field] = value;
    }
  }
  return values;
}

/** What a field shows before anything is typed: how a time is written. */
function hintOf(field: SetField): string | undefined {
  return field === "duration_s" ? "0:00" : undefined;
}

/**
 * The boxes of a set of `entry` (TASK-385 part B): reps and kg, or the
 * time, or what the machine shows, each named over its box with its unit
 * after the number (kg or lb, km or mi, as «Settings» says).
 */
export function SetFields({
  entry,
  texts,
  units,
  onChange,
}: {
  entry: Entry;
  texts: SetTexts;
  units: Units;
  onChange: (texts: SetTexts) => void;
}) {
  return (
    <View style={styles.fields}>
      {fieldsOf(entry).map((field) => {
        const name = fieldName(field, entry);
        const unit = fieldUnit(field, units);
        return (
          <View key={field} style={styles.field}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.box}>
              <TextInput
                style={[gymStyles.input, styles.input]}
                value={texts[field] ?? ""}
                onChangeText={(text) => onChange({ ...texts, [field]: text })}
                placeholder={hintOf(field)}
                placeholderTextColor={color.textFaint}
                keyboardType={
                  field === "duration_s" || field === "incline_pct"
                    ? "numbers-and-punctuation"
                    : "decimal-pad"
                }
                accessibilityLabel={name}
                testID={`set-${field}`}
              />
              {unit !== null && <Text style={styles.unit}>{unit}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  field: {
    flexGrow: 1,
    flexBasis: 120,
    gap: space.xs,
  },
  name: {
    ...font.small,
    color: color.textMuted,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  input: {
    flex: 1,
  },
  unit: {
    ...font.body,
    color: color.text,
  },
});
