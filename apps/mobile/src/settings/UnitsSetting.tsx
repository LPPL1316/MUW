import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";
import { phoneUnits } from "../units/phoneUnits";
import {
  loadUnitsChoice,
  saveUnitsChoice,
  type Units,
  UNITS,
  type UnitsChoice,
} from "../units/units";
import { useUnits } from "../units/useUnits";

// In English; shown with t() in the app's language (TASK-210).
const NAMES: Readonly<Record<Units, string>> = {
  km: tLater("Kilometres"),
  mi: tLater("Miles"),
};

/**
 * «Units» in «Settings» (TASK-182, ADR-0149): the units the app shows
 * distances in, at the end of the row. A tap opens the choices under it, as
 * «Language» does: the phone's units first, which is what the app follows
 * until one is chosen, then kilometres and miles. The choice stays on the
 * phone and the app turns to it at once.
 */
export function UnitsSetting() {
  const units = useUnits();
  const [choice, setChoice] = useState<UnitsChoice>(loadUnitsChoice);
  const [open, setOpen] = useState(false);
  const shown = t(NAMES[units]);
  const choose = (next: UnitsChoice) => {
    setChoice(next);
    setOpen(false);
    saveUnitsChoice(next);
  };
  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={`${t("Units")}, ${shown}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.emoji}>📏</Text>
        <Text style={styles.rowText}>{t("Units")}</Text>
        <Text style={styles.value}>{shown}</Text>
      </Tap>
      {open && (
        <View accessibilityRole="radiogroup">
          <Choice
            name={t("Phone units")}
            detail={t(NAMES[phoneUnits()])}
            chosen={choice === "phone"}
            onPress={() => choose("phone")}
          />
          {UNITS.map((option) => (
            <Choice
              key={option}
              name={t(NAMES[option])}
              chosen={choice === option}
              onPress={() => choose(option)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type ChoiceProps = {
  name: string;
  /** Said after the name, quieter: the units the phone measures in. */
  detail?: string;
  chosen: boolean;
  onPress: () => void;
};

function Choice({ name, detail, chosen, onPress }: ChoiceProps) {
  return (
    <View>
      <Hairline />
      <Tap
        style={[styles.row, styles.choice]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={detail === undefined ? name : `${name}, ${detail}`}
        accessibilityState={{ checked: chosen }}
      >
        <Text style={styles.rowText}>{name}</Text>
        {detail !== undefined && <Text style={styles.value}>{detail}</Text>}
        {chosen && <Text style={styles.check}>✓</Text>}
      </Tap>
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), as «Language» has
// them (`./LanguageSetting`), so the row sits among the others as one of them.
const styles = StyleSheet.create({
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  // The choices start where the row's name does, under it.
  choice: {
    paddingLeft: space.md + space.xl + space.md,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  value: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  // Not yellow: the yellow belongs to the route (docs/UI.md, «Il tema»).
  check: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
});
