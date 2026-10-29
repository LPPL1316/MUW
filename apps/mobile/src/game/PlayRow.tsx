import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { pageTitle } from "../screens/pageTitles";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";

/**
 * «Play» under the distance of «Draw» (the user's choice of 2026-10-29): no
 * more a page in the header, beside «Explore», but a row that opens the
 * shape game over the app (`PlayOverlay`). The app shows it only while the
 * API has the game.
 */
export function PlayRow({ onPress }: { onPress: () => void }) {
  const detail = t("Collect shapes by running");
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pageTitle("play")}, ${detail}`}
      testID="play-row"
    >
      <View style={styles.words}>
        <Text style={styles.label}>{t("PLAY")}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

// The label as the other rows of «Draw», the box as «Messages» (MessagesRow).
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  words: {
    flex: 1,
    gap: space.xs,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  detail: {
    color: color.text,
    fontSize: fontSize.body,
  },
  arrow: {
    color: color.textMuted,
    fontSize: fontSize.title,
  },
});
