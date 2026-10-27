import type { Contest } from "@shaperoute/shared-types";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayLabel } from "../activities/activityText";
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
 * The official rules after the dates, the text the user approved
 * (TASK-299, «Testi da approvare»): who takes part and how, how one wins,
 * that the prize has no money value, and that Apple and Google are not
 * involved (App Store 5.3, Google Play's rules on contests).
 */
export const RULES = [
  tLater(
    "Anyone with a MuW account can take part, for free, by publishing a run for everyone in the app during the contest.",
  ),
  tLater(
    "At the end, the post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.",
  ),
  tLater(
    "The prize has no money value: the winner gets the Winner badge on their profile and their post shown at the top of the Feed for a week.",
  ),
  tLater("MuW may leave out a post that breaks the community rules."),
  tLater(
    "Apple and Google are not sponsors of this contest and are not involved in it in any way.",
  ),
] as const;

type Props = {
  contest: Contest;
  visible: boolean;
  onClose: () => void;
};

/**
 * The official rules of the contest over the whole screen (TASK-299 part B,
 * docs/CONCORSI.md §8), from «How it works»: who organises it and its days,
 * on the phone's calendar and in the app's language, then the rules.
 * «Close», or Android's back, goes back to «Feed».
 */
export function ContestRules({ contest, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
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
        <ScrollView contentContainerStyle={styles.words}>
          <Text style={styles.eyebrow}>{t("MuW contest")}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {t("Official rules")}
          </Text>
          <Text style={styles.text}>
            {t("Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.", {
              start: dayLabel(contest.starts_at),
              end: dayLabel(contest.ends_at),
            })}
          </Text>
          {RULES.map((rule) => (
            <Text key={rule} style={styles.text}>
              {t(rule)}
            </Text>
          ))}
        </ScrollView>
        <Pressable
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>{t("Close")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.lg,
    paddingHorizontal: space.xl,
    backgroundColor: color.background,
  },
  words: {
    gap: space.md,
  },
  eyebrow: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    marginBottom: space.sm,
  },
  text: {
    color: color.text,
    fontSize: fontSize.body,
  },
  close: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  pressed: {
    opacity: 0.6,
  },
  closeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
