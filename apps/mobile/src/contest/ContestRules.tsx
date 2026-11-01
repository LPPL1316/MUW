import type { Contest } from "@shaperoute/shared-types";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayLabel } from "../activities/activityText";
import { t, tLater } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { themedOf, themeText } from "./contestApi";

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

/**
 * The rules of a monthly challenge (TASK-343 part B, CONCORSI §8 and §15), a
 * text the user approves: after the theme, how to enter and how many
 * drawings, who wins among those entered, and what MuW may leave out. The
 * prize and the sentence on Apple and Google are the contest's.
 */
export const THEMED_RULES = [
  tLater(
    "Anyone with a MuW account can take part, for free: publish a run recorded with MuW for everyone during the challenge, and enter it. You can enter as many drawings as you like, and withdraw them until the challenge ends.",
  ),
  tLater(
    "At the end, the entered post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.",
  ),
  RULES[2],
  tLater(
    "MuW may leave out a post that does not fit the theme or breaks the community rules.",
  ),
  RULES[4],
] as const;

type Props = {
  contest: Contest;
  visible: boolean;
  onClose: () => void;
};

/**
 * The official rules of the contest over the whole screen (TASK-299 part B,
 * docs/CONCORSI.md §8), from «How it works»: who organises it and its days,
 * on the phone's calendar and in the app's language, then the rules. A
 * monthly challenge says its theme too, and has its own rules (TASK-343).
 * «Close», or Android's back, goes back to «Feed».
 */
export function ContestRules({ contest, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const language = useLanguage();
  const themed = themedOf(contest);
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
          <Text style={styles.eyebrow}>
            {themed === null ? t("MuW contest") : t("Monthly challenge")}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {t("Official rules")}
          </Text>
          <Text style={styles.text}>
            {t("Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.", {
              start: dayLabel(contest.starts_at),
              end: dayLabel(contest.ends_at),
            })}
          </Text>
          {themed !== null && (
            <Text style={styles.text}>
              {t("The theme is “{theme}”.", {
                theme: themeText(themed.theme, language).title,
              })}
            </Text>
          )}
          {(themed === null ? RULES : THEMED_RULES).map((rule) => (
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
