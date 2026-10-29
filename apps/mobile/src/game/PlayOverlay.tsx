import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import { pageTitle } from "../screens/pageTitles";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { PlayScreen } from "./PlayScreen";

type Props = {
  /** «←»: back to «Draw», where its row is (`PlayRow`). */
  onBack: () => void;
  /** «Sign in to collect shapes.» touched: the way to the account. */
  onSignIn: () => void;
};

/**
 * The shape game over the whole app (TASK-296, ADR-0255), opened from its
 * row under the distance of «Draw» (the user's choice of 2026-10-29), by
 * the card of a shape unlocked or by a notification: «Play» and «←» on
 * top, the game's two tabs under them (`PlayScreen`).
 */
export function PlayOverlay({ onBack, onSignIn }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.screen,
        { paddingTop: insets.top + space.sm },
      ]}
      testID="play-overlay"
    >
      {/* As the title of «Messages» (MessagesOverlay.tsx). */}
      <View style={styles.titleRow}>
        <Pressable
          style={styles.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("Back")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {pageTitle("play")}
        </Text>
      </View>
      <PlayScreen active onSignIn={onSignIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
});
