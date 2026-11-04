import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isEmptyBody } from "../body/bodyProfile";
import { weightLabel } from "../body/bodyUnits";
import { useBody } from "../body/useBody";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { useUnits } from "../units/useUnits";
import { BodyPage } from "./BodyPage";

/**
 * «Body» in «Settings» (TASK-374, ADR-0318), under «Units»: the weight at
 * the end of the row, or «Not set». A tap opens the page where sex, weight,
 * height and year of birth are typed, all of them optional and kept only on
 * this phone.
 */
export function BodySetting() {
  const body = useBody();
  const units = useUnits();
  const [open, setOpen] = useState(false);
  const shown =
    body.weightKg !== null
      ? weightLabel(body.weightKg, units)
      : isEmptyBody(body)
        ? t("Not set")
        : null;
  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={shown === null ? t("Body") : `${t("Body")}, ${shown}`}
      >
        <Text style={styles.emoji}>⚖️</Text>
        <Text style={styles.rowText}>{t("Body")}</Text>
        {shown !== null && <Text style={styles.value}>{shown}</Text>}
      </Tap>
      <BodyPage visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), as «Units» has them.
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
});
