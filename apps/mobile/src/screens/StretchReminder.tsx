import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { runControl } from "../navigation/runControl";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { endRunAudio, say, startRunAudio } from "../voice/runAudio";
import { speaking, spokenWords } from "../voice/voiceChoice";

/**
 * The end of a run, before «Your run» (TASK-285 part A, ADR-0247): the app
 * reminds the runner to stretch, on the screen and with the run's voice,
 * and offers two ways on. «Stretch» opens the exercises (part B); «Skip»
 * goes straight to «Your run». The reminder is asked once per run, at the
 * moment the run ends: a run opened again later (TASK-272) is not asked.
 */

type Props = {
  onStretch: () => void;
  onSkip: () => void;
};

/**
 * Says the reminder once, when the card appears, with the run's voice and
 * sound (TASK-209, TASK-261 B): over the silent switch and over the music,
 * as every other word of the run. With «Voice» off, nothing is said.
 */
export function sayStretch(): void {
  if (!runControl().voice) {
    return;
  }
  say(spokenWords().stretch, speaking().options);
}

export function StretchReminder({ onStretch, onSkip }: Props) {
  useEffect(() => {
    // The sound is the run's while the card is here: the voice is heard as
    // during the run, and let go when the card leaves.
    startRunAudio();
    sayStretch();
    return endRunAudio;
  }, []);
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t("Remember to stretch")}
      </Text>
      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={onSkip} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Skip")}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onStretch} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Stretch")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space.sm,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
