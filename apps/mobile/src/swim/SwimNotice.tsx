import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t, tLater } from "../i18n";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

/**
 * What to know before swimming in open water (TASK-323 C), the text the
 * user approved (ADR-0283): the engine knows the shore, not the water's
 * rules, its flags nor its weather, and promises nothing of them.
 */
export const SWIM_NOTICE_TITLE = tLater("Before you swim");
export const SWIM_NOTICE_LINES = [
  tLater("Never swim alone. Tow a bright swim buoy and wear a bright cap."),
  tLater(
    "Check the water, the weather, the flags and the local rules: swimming areas, boat lanes, harbours. MuW does not know them.",
  ),
  tLater(
    "The route stays between 20 and 150 m from the shore. That does not make it safe or allowed.",
  ),
  tLater("If you feel tired or cold, head for the shore at once."),
] as const;

/**
 * The safety notice over the whole screen, before the first «Start» of a
 * swim on this phone (useSwimNotice, in safetyNotice.ts): «I understand»
 * starts, «Not now» goes back to the route. As the paddle's (TASK-191).
 */
export function SwimNotice({
  visible,
  onAccept,
  onDismiss,
}: {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      // Android's back button is «Not now».
      onRequestClose={onDismiss}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + space.xl,
            paddingBottom: insets.bottom + space.lg,
          },
        ]}
      >
        <View style={styles.words}>
          <Text style={styles.emoji} accessibilityElementsHidden>
            🏊
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {t(SWIM_NOTICE_TITLE)}
          </Text>
          {SWIM_NOTICE_LINES.map((line) => (
            <View key={line} style={styles.line}>
              <Text style={styles.bullet} accessibilityElementsHidden>
                •
              </Text>
              <Text style={styles.text}>{t(line)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <Pressable
            style={styles.accept}
            onPress={onAccept}
            accessibilityRole="button"
          >
            <Text style={styles.acceptText}>{t("I understand")}</Text>
          </Pressable>
          <Pressable
            style={styles.dismiss}
            onPress={onDismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>{t("Not now")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    backgroundColor: color.background,
  },
  words: {
    gap: space.md,
  },
  emoji: {
    fontSize: fontSize.title * 2,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    marginBottom: space.sm,
  },
  line: {
    flexDirection: "row",
    gap: space.sm,
  },
  bullet: {
    color: color.textMuted,
    fontSize: fontSize.input,
  },
  text: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    lineHeight: fontSize.input * 1.4,
  },
  buttons: {
    gap: space.sm,
  },
  // Yellow as «Start», which it is the first time.
  accept: {
    minHeight: MIN_TAP_SIZE + space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  // Dark on yellow: white does not reach the contrast minimum (ADR-0046).
  acceptText: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.input,
  },
  dismiss: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  dismissText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
