import type { LatLon } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { RunDrawing } from "../activities/RunDrawing";
import { Tap } from "../ui/Tap";
import { color, font, radius, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";

/** How tall the drawing is for its width. */
export const PREVIEW_RATIO = 0.8;

type Props = {
  title: string;
  /** Who drew it: a member's name, or an example's runner. */
  author: string;
  distanceM: number;
  /** The line of the drawing, as the feed lists it. */
  line: readonly LatLon[];
  /** How far its shape is turned (TASK-232): drawn turned back. */
  rotationDeg?: number | null;
  width: number;
  onPress: () => void;
  testID?: string;
};

/**
 * A drawing found (TASK-344): the line in the route's yellow on the dark,
 * its title, who drew it and how long it is. VoiceOver reads the three.
 */
export function DrawingResultCard({
  title,
  author,
  distanceM,
  line,
  rotationDeg,
  width,
  onPress,
  testID,
}: Props) {
  const distance = distanceLabel(distanceM);
  return (
    <Tap
      style={[styles.card, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${author}, ${distance}`}
      testID={testID}
    >
      <View style={styles.preview}>
        <RunDrawing
          route={[...line]}
          track={[]}
          width={width}
          height={width * PREVIEW_RATIO}
          rotationDeg={rotationDeg}
        />
      </View>
      <View style={styles.words}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {author} · {distance}
        </Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  preview: {
    backgroundColor: color.map.background,
  },
  words: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  title: {
    ...font.cardTitle,
    color: color.text,
  },
  detail: {
    ...font.detail,
    color: color.textMuted,
  },
});
