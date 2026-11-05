import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { durationLabel } from "../screens/FinishScreen";
import { GYM } from "../sports/gym";
import { color, font, fontSize, fontWeight, space } from "../theme/tokens";

type Props = {
  width: number;
  height: number;
  /** The workout's seconds; none, the tile shows only what it is (a
   * thumbnail). */
  durationS?: number;
};

/**
 * What a workout at the gym shows in place of the line (TASK-385 B0,
 * ADR-0327): the MuW yellow made by the app, with 🏋️, «Gym» and its time.
 * The yellow is the user's choice for this tile («Prima foto, se no
 * riquadro», 2026-11-04), the text on it `onAccent`. The parts after B0
 * add the energy, the heart rate and the main exercises. A screen reader
 * hears the card's words, not the tile's.
 */
export function GymTile({ width, height, durationS }: Props) {
  const small = durationS === undefined;
  return (
    <View
      style={[styles.tile, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="gym-tile"
    >
      <Text style={small ? styles.emojiSmall : styles.emoji}>{GYM.emoji}</Text>
      {!small && (
        <>
          <Text style={styles.name}>{t(GYM.name)}</Text>
          <Text style={styles.time}>{durationLabel(durationS * 1000)}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: color.accent,
  },
  emoji: {
    fontSize: fontSize.display,
  },
  emojiSmall: {
    fontSize: fontSize.title,
  },
  name: {
    ...font.label,
    color: color.onAccent,
  },
  time: {
    ...font.title,
    color: color.onAccent,
    fontWeight: fontWeight.medium,
  },
});
