import type { LatLon } from "@shaperoute/shared-types";
import { forwardRef, useMemo } from "react";
import { Image, type ImageSourcePropType, StyleSheet, View } from "react-native";

import { fitLines, type Segment } from "../../activities/fitLines";
import { bearingOf } from "../../map/turnedMap";
import { postLine } from "../../share/postRun";
import { color } from "../../theme/tokens";
import { type Box, COMPOSED_RATIO, layoutFrame, type PostLayout } from "./layoutFrame";

/**
 * The line a photo carries: the run's whole track, start and end too, as
 * the Feed and the shared post draw it (TASK-348, ADR-0330).
 */
export function composedLine(track: readonly LatLon[]): LatLon[] {
  return postLine(track);
}

type Props = {
  /** The photo as taken, as an `Image` shows it. */
  source: ImageSourcePropType;
  layout: PostLayout;
  track: readonly LatLon[];
  /** The planned route's turn (TASK-232): the drawing reads upright. */
  rotationDeg?: number | null;
  /** The picture's width in points; it is COMPOSED_RATIO tall. */
  width: number;
  /** The photo is drawn: the picture can be made. */
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * A photo with the drawing of its run in one of the four layouts: what the
 * form shows small, and what «Publish» makes the picture of (view-shot).
 * The ref is the View the picture is made of.
 */
export const ComposedPhoto = forwardRef<View, Props>(function ComposedPhoto(
  { source, layout, track, rotationDeg, width, onLoad, onError },
  ref,
) {
  const frame = layoutFrame(layout, width);
  const { drawing, line, pad } = frame;
  const bearing = bearingOf(rotationDeg);
  const [segments] = useMemo(
    () => fitLines([composedLine(track)], drawing.width, drawing.height, pad, bearing),
    [track, drawing.width, drawing.height, pad, bearing],
  );
  const photo = (
    <Image
      key="photo"
      source={source}
      style={[styles.absolute, boxStyle(frame.photo)]}
      resizeMode="cover"
      onLoad={onLoad}
      onError={onError}
      testID="composed-photo"
    />
  );
  const lines = (
    <View
      key="drawing"
      style={[styles.absolute, boxStyle(drawing), frame.panel && styles.panel]}
      testID="composed-drawing"
    >
      {/* Alone on a photo, the yellow line has a dark edge under it: it
          reads on a light sky as on a dark street. */}
      {!frame.panel &&
        segments.map((s, i) => (
          <View
            key={`edge-${i}`}
            style={[styles.edge, placed(s, line * 2), { borderRadius: line }]}
          />
        ))}
      {segments.map((s, i) => (
        <View
          key={i}
          testID="composed-line"
          style={[
            frame.panel ? styles.inkLine : styles.yellowLine,
            placed(s, line),
            { borderRadius: line / 2 },
          ]}
        />
      ))}
    </View>
  );
  return (
    <View
      ref={ref}
      // Android draws a View it can fold away into its parent: the picture
      // would come out empty.
      collapsable={false}
      style={[styles.picture, { width, height: width * COMPOSED_RATIO }]}
      accessible={false}
    >
      {frame.photoOnTop ? [lines, photo] : [photo, lines]}
    </View>
  );
});

function boxStyle(box: Box) {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function placed(s: Segment, thickness: number) {
  return {
    left: s.left,
    top: s.top - thickness / 2,
    width: s.length + thickness / 2,
    height: thickness,
    transform: [{ rotate: `${s.angle}deg` }],
  };
}

const styles = StyleSheet.create({
  picture: {
    overflow: "hidden",
    backgroundColor: color.accent,
  },
  absolute: {
    position: "absolute",
  },
  panel: {
    backgroundColor: color.accent,
    overflow: "hidden",
  },
  inkLine: {
    position: "absolute",
    backgroundColor: color.onAccent,
  },
  yellowLine: {
    position: "absolute",
    backgroundColor: color.accent,
  },
  edge: {
    position: "absolute",
    backgroundColor: color.onAccent,
    opacity: 0.6,
  },
});
