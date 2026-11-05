import type { LatLon, RunActivity } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { RunDrawing } from "../activities/RunDrawing";
import { isTrackless } from "../activities/snow";
import { GymTile } from "../gym/GymTile";
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
  /** What the run was: a workout at the gym shows its tile and no
   * distance (TASK-385 B0); none, a run. */
  activity?: RunActivity;
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
  activity,
  width,
  onPress,
  testID,
}: Props) {
  const gym = isTrackless(activity);
  // Who drew it and how far; a workout at the gym, who only.
  const said = gym ? [author] : [author, distanceLabel(distanceM)];
  return (
    <Tap
      style={[styles.card, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, ...said].join(", ")}
      testID={testID}
    >
      <View style={styles.preview}>
        {gym ? (
          <GymTile width={width} height={width * PREVIEW_RATIO} />
        ) : (
          <RunDrawing
            route={[...line]}
            track={[]}
            width={width}
            height={width * PREVIEW_RATIO}
            rotationDeg={rotationDeg}
          />
        )}
      </View>
      <View style={styles.words}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {said.join(" · ")}
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
