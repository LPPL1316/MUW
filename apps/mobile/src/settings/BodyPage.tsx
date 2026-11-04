import { type ReactNode, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  type Read,
  readBirthYear,
  readHeightCm,
  readHeightFeetInches,
  readWeight,
} from "../body/bodyFields";
import {
  appBody,
  type BodyProfile,
  saveBody,
  SEXES,
  type Sex,
} from "../body/bodyProfile";
import { feetInchesOf, weightIn, weightUnit } from "../body/bodyUnits";
import { useBody } from "../body/useBody";
import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";
import { HeartZonesPage } from "./HeartZonesPage";

// In English; shown with t() in the app's language (TASK-210).
const SEX_NAMES: Readonly<Record<Sex, string>> = {
  male: tLater("Male"),
  female: tLater("Female"),
  unsaid: tLater("Prefer not to say"),
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The page of «Body» (TASK-374, ADR-0318): sex, weight, height and year of
 * birth, each optional, each kept on this phone as soon as it is typed. A
 * value out of its limits says why and is not kept; «Clear» empties a field,
 * and an empty field counts as before (70 kg, one standard MET at rest).
 * At the bottom, «Heart rate zones» opens their page (part B).
 */
export function BodyPage({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Its own edges: opened from «Profile», a page of the tab bar, whose
          frame says top 0 (TASK-366). Mounted with the page: each opening
          starts from what is kept. */}
      {visible && (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Page onClose={onClose} />
        </SafeAreaProvider>
      )}
    </Modal>
  );
}

/** Keeps `change` on top of the body as it is now. */
function keep(change: Partial<BodyProfile>) {
  saveBody({ ...appBody(), ...change });
}

function Page({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const body = useBody();
  const units = useUnits();
  const [zonesOpen, setZonesOpen] = useState(false);
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Tap style={styles.back} onPress={onClose} accessibilityRole="button">
          <Text style={styles.backText}>{t("Back")}</Text>
        </Tap>
        <Text style={styles.title} accessibilityRole="header">
          {t("Body")}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>
          {t(
            "Used only to estimate your calories and heart rate zones. It stays on this phone.",
          )}
        </Text>
        <Field
          label={t("Sex")}
          filled={body.sex !== null}
          onClear={() => keep({ sex: null })}
        >
          <View style={styles.choices} accessibilityRole="radiogroup">
            {SEXES.map((sex) => (
              <Tap
                key={sex}
                style={[styles.choice, body.sex === sex && styles.chosen]}
                onPress={() => keep({ sex })}
                accessibilityRole="radio"
                accessibilityState={{ checked: body.sex === sex }}
              >
                <Text
                  style={[styles.choiceText, body.sex === sex && styles.chosenText]}
                >
                  {t(SEX_NAMES[sex])}
                </Text>
              </Tap>
            ))}
          </View>
        </Field>
        <WeightField kg={body.weightKg} units={units} />
        {units === "mi" ? (
          <FeetInchesField cm={body.heightCm} />
        ) : (
          <CmField cm={body.heightCm} />
        )}
        <YearField birthYear={body.birthYear} />
        <Text style={styles.note}>
          {t("Calories are an estimate. Weight matters most.")}
        </Text>
        {/* The zones count with the year of birth above (TASK-374 part B). */}
        <Tap
          style={styles.zonesRow}
          onPress={() => setZonesOpen(true)}
          accessibilityRole="button"
        >
          <Text style={styles.zonesText}>{t("Heart rate zones")}</Text>
        </Tap>
      </ScrollView>
      <HeartZonesPage visible={zonesOpen} onClose={() => setZonesOpen(false)} />
    </View>
  );
}

type FieldProps = {
  label: string;
  filled: boolean;
  onClear: () => void;
  problem?: string | null;
  children: ReactNode;
};

/** A field under its name, «Clear» beside the name when it holds a value,
 * and why a value is not kept under it. */
function Field({ label, filled, onClear, problem = null, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {filled && (
          <Tap
            style={styles.clear}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`${t("Clear")}, ${label}`}
          >
            <Text style={styles.clearText}>{t("Clear")}</Text>
          </Tap>
        )}
      </View>
      {children}
      {problem !== null && (
        <Text style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
    </View>
  );
}

/** A number box with its unit after it. */
function NumberInput({ unit, ...input }: TextInputProps & { unit: string }) {
  return (
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        placeholderTextColor={color.textFaint}
        keyboardAppearance="dark"
        returnKeyType="done"
        {...input}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

/** What a field does with what was typed: keep it, or say why not. */
function useTyped(
  initial: string,
  read: (text: string) => Read,
  save: (value: number | null) => void,
) {
  const [text, setText] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const done = (typed: string = text) => {
    const result = read(typed);
    if (result.kind === "wrong") {
      setProblem(result.problem);
      return;
    }
    setProblem(null);
    save(result.kind === "value" ? result.value : null);
  };
  const clear = () => {
    setText("");
    setProblem(null);
    save(null);
  };
  return { text, setText, problem, done, clear };
}

function WeightField({ kg, units }: { kg: number | null; units: Units }) {
  const field = useTyped(
    kg === null ? "" : String(weightIn(kg, units)),
    (text) => readWeight(text, units),
    (weightKg) => keep({ weightKg }),
  );
  return (
    <Field
      label={t("Weight")}
      filled={kg !== null}
      onClear={field.clear}
      problem={field.problem}
    >
      <NumberInput
        unit={weightUnit(units)}
        value={field.text}
        onChangeText={field.setText}
        onEndEditing={() => field.done()}
        keyboardType="decimal-pad"
        accessibilityLabel={t("Weight")}
      />
    </Field>
  );
}

function CmField({ cm }: { cm: number | null }) {
  const field = useTyped(
    cm === null ? "" : String(Math.round(cm)),
    readHeightCm,
    (heightCm) => keep({ heightCm }),
  );
  return (
    <Field
      label={t("Height")}
      filled={cm !== null}
      onClear={field.clear}
      problem={field.problem}
    >
      <NumberInput
        unit="cm"
        value={field.text}
        onChangeText={field.setText}
        onEndEditing={() => field.done()}
        keyboardType="number-pad"
        accessibilityLabel={t("Height")}
      />
    </Field>
  );
}

function FeetInchesField({ cm }: { cm: number | null }) {
  const was = cm === null ? null : feetInchesOf(cm);
  const [feet, setFeet] = useState(was === null ? "" : String(was.feet));
  const [inches, setInches] = useState(was === null ? "" : String(was.inches));
  const [problem, setProblem] = useState<string | null>(null);
  const done = () => {
    const result = readHeightFeetInches(feet, inches);
    if (result.kind === "wrong") {
      setProblem(result.problem);
      return;
    }
    setProblem(null);
    keep({ heightCm: result.kind === "value" ? result.value : null });
  };
  const clear = () => {
    setFeet("");
    setInches("");
    setProblem(null);
    keep({ heightCm: null });
  };
  return (
    <Field label={t("Height")} filled={cm !== null} onClear={clear} problem={problem}>
      <View style={styles.feetInches}>
        <NumberInput
          unit="ft"
          value={feet}
          onChangeText={setFeet}
          onEndEditing={done}
          keyboardType="number-pad"
          accessibilityLabel={`${t("Height")}, ft`}
        />
        <NumberInput
          unit="in"
          value={inches}
          onChangeText={setInches}
          onEndEditing={done}
          keyboardType="number-pad"
          accessibilityLabel={`${t("Height")}, in`}
        />
      </View>
    </Field>
  );
}

function YearField({ birthYear }: { birthYear: number | null }) {
  const field = useTyped(
    birthYear === null ? "" : String(birthYear),
    (text) => readBirthYear(text, new Date().getFullYear()),
    (year) => keep({ birthYear: year }),
  );
  return (
    <Field
      label={t("Year of birth")}
      filled={birthYear !== null}
      onClear={field.clear}
      problem={field.problem}
    >
      <NumberInput
        unit=""
        value={field.text}
        onChangeText={field.setText}
        onEndEditing={() => field.done()}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel={t("Year of birth")}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  header: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    gap: space.md,
  },
  back: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  backText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  content: {
    gap: space.lg,
    padding: space.md,
  },
  intro: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  field: {
    gap: space.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  clear: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  clearText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  // Neutral: the yellow belongs to the route (docs/UI.md, «Il tema»).
  choice: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chosen: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  choiceText: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  chosenText: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  feetInches: {
    flexDirection: "row",
    gap: space.md,
  },
  input: {
    minWidth: 96,
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
  unit: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  // A row of «Settings», as «Body» is there.
  zonesRow: {
    minHeight: MIN_TAP_SIZE + space.sm,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  zonesText: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
});
