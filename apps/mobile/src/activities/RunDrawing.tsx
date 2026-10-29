import type { LatLon } from "@shaperoute/shared-types";
import { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

import { bearingOf } from "../map/turnedMap";
import { color, radius, route as routeLine, space, track } from "../theme/tokens";
import { fitLines, type Segment } from "./fitLines";

/** The route under the run, thicker: its yellow shows on both sides. */
const ROUTE_WIDTH = 4;

/** The room left around the lines; a map laid under them is taken with it. */
export const RUN_DRAWING_PAD = space.sm;

type Props = {
  /** The planned route; null for a run without one. */
  route: LatLon[] | null;
  /** What was run. */
  track: LatLon[];
  width: number;
  height: number;
  /**
   * How far the route's shape is turned, counterclockwise
   * (`rotation_deg` of the run, TASK-232): the drawing is turned the other
   * way, so it reads upright as on the map. Without it, north up.
   */
  rotationDeg?: number | null;
  /**
   * A picture of the map to lay under the lines (`useFeedMap`, TASK-332),
   * taken for the route alone in this box with `RUN_DRAWING_PAD` and the
   * same turn; null while it has not come. Without it, the lines on the
   * dark, as ever.
   */
  map?: string | null;
};

const NO_ROUTE: LatLon[] = [];

/**
 * A run as the end of a run shows it on the map, small (TASK-172): the
 * route yellow, and over it, thin and light, what was run. No SVG in the
 * app: each segment is a thin turned View. A run along a turned route is
 * drawn turned back, route and run together (TASK-232).
 */
export function RunDrawing({
  route,
  track: run,
  width,
  height,
  rotationDeg,
  map = null,
}: Props) {
  const bearing = bearingOf(rotationDeg);
  const [planned, done] = useMemo(
    () => fitLines([route ?? NO_ROUTE, run], width, height, RUN_DRAWING_PAD, bearing),
    [route, run, width, height, bearing],
  );
  return (
    <View style={[styles.box, { width, height }]} accessible={false}>
      {map !== null && (
        <Image
          testID="run-drawing-map"
          style={StyleSheet.absoluteFill}
          source={{ uri: map }}
          accessible={false}
        />
      )}
      {planned.map((s, i) => (
        <View
          key={`route-${i}`}
          testID="run-drawing-route"
          style={[styles.route, placed(s, ROUTE_WIDTH)]}
        />
      ))}
      {done.map((s, i) => (
        <View
          key={`track-${i}`}
          testID="run-drawing-track"
          style={[styles.track, placed(s, track.width)]}
        />
      ))}
    </View>
  );
}

function placed(s: Segment, thickness: number) {
  return {
    left: s.left,
    top: s.top - thickness / 2,
    width: s.length + thickness / 2,
    transform: [{ rotate: `${s.angle}deg` }],
  };
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    backgroundColor: color.map.background,
    overflow: "hidden",
  },
  route: {
    position: "absolute",
    height: ROUTE_WIDTH,
    borderRadius: ROUTE_WIDTH / 2,
    backgroundColor: routeLine.color,
  },
  track: {
    position: "absolute",
    height: track.width,
    borderRadius: track.width / 2,
    backgroundColor: track.color,
    opacity: track.opacity,
  },
});
