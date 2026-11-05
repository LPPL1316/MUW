import { Pressable, StyleSheet, Text, View } from "react-native";

import { saveStyleInFeed, useStyleInFeed } from "../feed/styleInFeedChoice";
import { styleWords } from "../feed/styleWords";
import { color, fontSize, radius, space } from "../theme/tokens";
import { contactStyles } from "./ContactField";

/**
 * «Style posts in the Feed» in «Settings» (TASK-384, ADR-0326): MuW Style is
 * advertising, and it can be turned off. Off, «All» has no Style post; the
 * lens «Style» still has them all. On at the start; kept on the phone.
 */
export function StyleSetting() {
  const on = useStyleInFeed();
  const words = styleWords();
  return (
    <View style={styles.setting}>
      <View style={contactStyles.menu}>
        <Pressable
          style={({ pressed }) => [contactStyles.row, pressed && contactStyles.pressed]}
          onPress={() => saveStyleInFeed(!on)}
          accessibilityRole="switch"
          accessibilityLabel={words.settingTitle}
          accessibilityHint={words.settingNote}
          accessibilityState={{ checked: on }}
          testID="style-setting"
        >
          <Text style={contactStyles.emoji}>👕</Text>
          <Text style={contactStyles.rowText}>{words.settingTitle}</Text>
          <View style={[styles.track, on && styles.trackOn]}>
            <View style={[styles.knob, on && styles.knobOn]} />
          </View>
        </Pressable>
      </View>
      <Text style={styles.note}>{words.settingNote}</Text>
    </View>
  );
}

// As the switches of «Notifications» (`./NotificationsSetting`).
const styles = StyleSheet.create({
  setting: {
    gap: space.sm,
  },
  track: {
    width: 40,
    height: 24,
    justifyContent: "center",
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  trackOn: {
    backgroundColor: color.text,
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: color.textMuted,
  },
  knobOn: {
    alignSelf: "flex-end",
    backgroundColor: color.background,
  },
  note: {
    paddingHorizontal: space.md,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
