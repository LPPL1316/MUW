import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { loadSport, saveSport, type Sport, SPORTS, type SportOption } from "./sport";

type Props = {
  /** The sports to show; the app's own unless a test says otherwise. */
  sports?: readonly SportOption[];
};

/**
 * «Sport» in «Settings»: what the routes are for. A sport the Route Engine
 * cannot draw yet says «Soon» and takes no tap, like the other settings to
 * come: nothing is promised to work. The choice stays on the phone.
 */
export function SportSetting({ sports = SPORTS }: Props) {
  const [chosen, setChosen] = useState<Sport>(() => loadSport(sports));
  const choose = (sport: Sport) => {
    setChosen(sport);
    saveSport(sport);
  };
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("SPORT")}</Text>
      <View style={styles.menu} accessibilityRole="radiogroup">
        {sports.map((option, at) => (
          <View key={option.id}>
            {at > 0 && <Hairline />}
            {option.ready ? (
              <Pressable
                style={styles.row}
                onPress={() => choose(option.id)}
                accessibilityRole="radio"
                // One name for the row: the emoji is not read on its own.
                accessibilityLabel={t(option.name)}
                accessibilityState={{ checked: option.id === chosen }}
              >
                <Text style={styles.emoji}>{option.emoji}</Text>
                <Text style={styles.rowText}>{t(option.name)}</Text>
                {option.id === chosen && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ) : (
              <View
                style={styles.row}
                accessible
                accessibilityLabel={t("{sport}, coming soon", {
                  sport: t(option.name),
                })}
              >
                <Text style={styles.emoji}>{option.emoji}</Text>
                <Text style={styles.rowText}>{t(option.name)}</Text>
                <Text style={styles.soon}>{t("Soon")}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), so the section sits
// among the others as one of them.
const styles = StyleSheet.create({
  section: {
    gap: space.lg,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
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
  // Not yellow: the yellow belongs to the route (docs/UI.md, «Il tema»).
  check: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  soon: {
    color: color.textFaint,
    fontSize: fontSize.small,
  },
});
