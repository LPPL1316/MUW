import { useEffect } from "react";
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
import { endMusic, hearMusic, MUSIC, type Music, musicName } from "./videoMusic";

type Props = {
  /** The track the video gets; null for none. */
  music: Music | null;
  onChange: (music: Music | null) => void;
};

/**
 * «Music» in «Share your run» (TASK-301, ADR-0262): «None» and the ten
 * tracks, one of them chosen. A tap on a track plays it from its start, a
 * tap on «None» stops it. «None» is chosen when the post opens.
 */
export function MusicRow({ music, onChange }: Props) {
  // The track stops when the post closes.
  useEffect(() => endMusic, []);

  function pick(next: Music | null) {
    onChange(next);
    hearMusic(next);
  }

  const choices: (Music | null)[] = [null, ...MUSIC];
  return (
    <>
      <Text style={styles.label}>{t("Music")}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {choices.map((choice) => {
          const on = choice === music;
          return (
            <Pressable
              key={choice ?? "none"}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => pick(choice)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {choice === null ? t("None") : musicName(choice)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{t("Tap a track to hear it.")}</Text>
    </>
  );
}

// As the results' chips of SharePost.
const styles = StyleSheet.create({
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  chipOn: {
    borderColor: color.text,
    backgroundColor: color.surfaceRaised,
  },
  chipText: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  chipTextOn: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
});
