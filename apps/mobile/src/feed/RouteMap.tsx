import type { LatLon } from "@shaperoute/shared-types";
import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { thumbSegments } from "../explore/RouteThumb";
import { t, tLater } from "../i18n";
import { bearingOf } from "../map/turnedMap";
import { color, route as routeLine, space } from "../theme/tokens";
import { useFeedMap } from "./FeedMaps";
import { turnedLine } from "./turnedLine";

/** How tall the drawing is, for how wide: most figures are wider than tall. */
const DRAWING_RATIO = 0.62;
/** The line of a drawing this wide: thicker than on a card of «Explore». */
const LINE_WIDTH = 3;
/** Clear around the line, on every side. */
export const DRAWING_PAD = space.xl;
/** The map's credit, in one line: small, and never on the line (TASK-355). */
export const CREDIT_SIZE = 10;
export const CREDIT_LINE = 13;
/** The dot at one end of the line, the flag at the other. */
const DOT = 10;
const POLE_WIDTH = 4;
const POLE_HEIGHT = 16;
const PENNANT_WIDTH = 11;
const PENNANT_HEIGHT = 8;

/** How tall the drawing of a card `width` wide is. */
export function drawingHeight(width: number): number {
  return Math.round(width * DRAWING_RATIO);
}

/**
 * Whose the map is, as its makers ask to be named (`ATTRIBUTION` in
 * `map/mapStyle`), on every picture of it. In English: shown with
 * `t(MAP_CREDIT)` (TASK-210), on a card through `creditLine`.
 */
export const MAP_CREDIT = tLater("OpenFreeMap © OpenMapTiles\nData from OpenStreetMap");

/** The credit in the app's language, in one line (TASK-355). */
export function creditLine(): string {
  return t(MAP_CREDIT).replace("\n", " · ");
}

type Segment = ReturnType<typeof thumbSegments>[number];

/** The two ends of a segment: it turns about its centre (`thumbSegments`). */
function endsOf({ left, top, length, angle }: Segment): {
  from: { x: number; y: number };
  to: { x: number; y: number };
} {
  const half = length / 2;
  const x = left + half;
  const dx = half * Math.cos((angle * Math.PI) / 180);
  const dy = half * Math.sin((angle * Math.PI) / 180);
  return { from: { x: x - dx, y: top - dy }, to: { x: x + dx, y: top + dy } };
}

/**
 * Where the first and the last point of the drawn line are, in the box; null
 * with nothing drawn. These are the ends of the track as the card has it,
 * already cut: never where the run really started or ended.
 */
export function lineEnds(
  segments: readonly Segment[],
): { first: { x: number; y: number }; last: { x: number; y: number } } | null {
  if (segments.length === 0) {
    return null;
  }
  return {
    first: endsOf(segments[0]).from,
    last: endsOf(segments[segments.length - 1]).to,
  };
}

type Props = {
  /** Whose picture of the map this is, among those of «Feed». */
  id: string;
  line: LatLon[];
  gaps?: readonly number[];
  rotationDeg?: number;
  width: number;
  /** A dot and a flag at the ends of the line (TASK-355): a member's cut
   * track has two ends to mark, an example of the catalogue is a figure. */
  marks?: boolean;
};

/**
 * A drawing on its map (TASK-162, TASK-355): the line in the route's yellow,
 * under it the picture of where it was run once taken, over it the map's
 * credit, in the margin the line never enters. A figure the engine turned is
 * drawn turned back, line and map, so it reads upright (TASK-232). With
 * `marks`, a dot and a flag tell the two ends apart by their shape, in the
 * colour of the text (ADR-0293 keeps one accent); no words call them start
 * or finish, because they are not.
 */
export function RouteMap({ id, line, gaps, rotationDeg, width, marks = false }: Props) {
  const height = drawingHeight(width);
  const bearing = bearingOf(rotationDeg);
  const segments = useMemo(
    () => thumbSegments(turnedLine(line, bearing), width, height, DRAWING_PAD, gaps),
    [line, bearing, gaps, width, height],
  );
  const map = useFeedMap(id, line, width, height, DRAWING_PAD, bearing);
  const ends = marks ? lineEnds(segments) : null;
  return (
    <View style={[styles.drawing, { width, height }]} testID="feed-drawing">
      {map !== null && (
        <Image
          testID="feed-map"
          style={StyleSheet.absoluteFill}
          source={{ uri: map }}
          accessible={false}
        />
      )}
      {segments.map((s, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              left: s.left,
              top: s.top - LINE_WIDTH / 2,
              width: s.length + LINE_WIDTH / 2,
              transform: [{ rotate: `${s.angle}deg` }],
            },
          ]}
        />
      ))}
      {ends !== null && (
        <>
          <View
            testID="feed-line-dot"
            style={[
              styles.dot,
              { left: ends.first.x - DOT / 2, top: ends.first.y - DOT / 2 },
            ]}
          />
          <View
            testID="feed-line-flag"
            style={[
              styles.flag,
              {
                left: ends.last.x - POLE_WIDTH / 2,
                top: ends.last.y - POLE_HEIGHT,
              },
            ]}
          >
            <View style={styles.pole} />
            <View style={styles.pennant} />
          </View>
        </>
      )}
      {map !== null && (
        <Text style={styles.credit} numberOfLines={1}>
          {creditLine()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  drawing: {
    backgroundColor: color.map.background,
    overflow: "hidden",
  },
  segment: {
    position: "absolute",
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: routeLine.color,
  },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: color.scrim,
    backgroundColor: color.text,
  },
  flag: {
    position: "absolute",
    flexDirection: "row",
  },
  pole: {
    width: POLE_WIDTH,
    height: POLE_HEIGHT,
    borderWidth: 1,
    borderColor: color.scrim,
    backgroundColor: color.text,
  },
  pennant: {
    width: PENNANT_WIDTH,
    height: PENNANT_HEIGHT,
    marginLeft: -1,
    borderWidth: 1,
    borderColor: color.scrim,
    backgroundColor: color.text,
  },
  credit: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    bottom: space.xs,
    color: color.textFaint,
    fontSize: CREDIT_SIZE,
    lineHeight: CREDIT_LINE,
    textAlign: "right",
  },
});
