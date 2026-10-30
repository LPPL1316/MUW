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
import type { AboutId } from "./documents";

/** The texts of «ABOUT», by the name of their row; in English, shown with
 * `t()` (TASK-210). */
export const ABOUT_ROWS: readonly { id: AboutId; emoji: string; name: string }[] = [
  { id: "help", emoji: "❓", name: tLater("Help") },
  { id: "terms", emoji: "📄", name: tLater("Terms") },
  { id: "privacy", emoji: "🔒", name: tLater("Privacy") },
];

/** The name of the row of `id`, in English. */
export function aboutName(id: AboutId): string {
  return ABOUT_ROWS.find((row) => row.id === id)?.name ?? ABOUT_ROWS[0].name;
}

type Props = {
  /** Opens the text as a page of «Profile». */
  onOpen: (id: AboutId) => void;
};

/**
 * «Help», «Terms» and «Privacy» in «Settings» (TASK-184, ADR-0205): three
 * rows that open their text as a page, with «←» back to «Settings». Not
 * under the row, as «Language» does: these are pages of text to read.
 */
export function AboutRows({ onOpen }: Props) {
  return (
    <View style={styles.menu}>
      {ABOUT_ROWS.map((row, at) => (
        <View key={row.id}>
          {at > 0 && <Hairline />}
          <Tap
            style={styles.row}
            onPress={() => onOpen(row.id)}
            accessibilityRole="button"
            // One name for the row: the emoji and the arrow are not read.
            accessibilityLabel={t(row.name)}
          >
            <Text style={styles.emoji}>{row.emoji}</Text>
            <Text style={styles.rowText}>{t(row.name)}</Text>
            <Text style={styles.arrow}>›</Text>
          </Tap>
        </View>
      ))}
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), so these sit among
// the others as three of them.
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
  // It opens a page: the other rows open under themselves.
  arrow: {
    color: color.textMuted,
    fontSize: fontSize.title,
  },
});
