import type { LatLon } from "@shaperoute/shared-types";
import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { thumbSegments } from "../explore/RouteThumb";
import { color, radius, route as routeLine } from "../theme/tokens";

/** How long the pen takes to trace a drawing (TASK-317). */
export const PEN_MS = 6000;
/** How often the pen moves on. */
export const PEN_TICK_MS = 80;
/**
 * How often it moves on while the engine may be drawing on the phone
 * (TASK-214): as often as the loading bar, so the card adds only a few
 * light updates a second to the app's JavaScript while the engine runs.
 */
export const LIGHT_TICK_MS = 250;

/** The room left around the drawing in its box. */
const PAD = 8;
const PEN_SIZE = 8;
const NO_GAPS: readonly number[] = [];

/** The share of a drawing traced after `ms`, from 0 to 1. */
export function penShare(ms: number, penMs: number = PEN_MS): number {
  return Math.max(0, Math.min(1, ms / penMs));
}

/**
 * The milliseconds the pen has been drawing since `key` last changed,
 * counted every `tickMs` while `running`. A new key starts again at 0.
 */
export function usePenClock(
  key: string,
  running = true,
  tickMs: number = PEN_TICK_MS,
): number {
  const [at, setAt] = useState({ key, ms: 0 });
  if (at.key !== key) {
    setAt({ key, ms: 0 });
  }
  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(
      () => setAt((now) => ({ ...now, ms: now.ms + tickMs })),
      tickMs,
    );
    return () => clearInterval(id);
  }, [running, tickMs]);
  return at.key === key ? at.ms : 0;
}

type Segment = ReturnType<typeof thumbSegments>[number];

/** Where a segment ends, in its box. */
function endOf(s: Segment): { left: number; top: number } {
  const turn = (s.angle * Math.PI) / 180;
  return {
    left: s.left + (s.length / 2) * (1 + Math.cos(turn)),
    top: s.top + (s.length / 2) * Math.sin(turn),
  };
}

const Stroke = memo(function Stroke({ segment: s }: { segment: Segment }) {
  return (
    <View
      style={[
        styles.segment,
        {
          left: s.left,
          top: s.top - 1,
          width: s.length + 1,
          transform: [{ rotate: `${s.angle}deg` }],
        },
      ]}
    />
  );
});

type Props = {
  line: LatLon[];
  /** The points the pen comes to without drawing (TASK-226). */
  gaps?: readonly number[];
  /** The box is square, this many points a side. */
  size: number;
  /** How much of the drawing is traced, from 0 to 1. */
  share: number;
};

/**
 * A drawing traced by a pen while the route is being drawn (TASK-317): the
 * segments of `RouteThumb`, the first `share` of them, with the pen's dot
 * where it has got to. No SVG in the app, as in `RouteThumb`.
 */
export function PenDrawing({ line, gaps = NO_GAPS, size, share }: Props) {
  const segments = useMemo(
    () => thumbSegments(line, size, size, PAD, gaps),
    [line, size, gaps],
  );
  const shown = Math.round(Math.max(0, Math.min(1, share)) * segments.length);
  const last = shown > 0 && shown < segments.length ? segments[shown - 1] : undefined;
  const pen = last === undefined ? null : endOf(last);
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessible={false}
      testID="pen-drawing"
    >
      {segments.slice(0, shown).map((s, i) => (
        <Stroke key={i} segment={s} />
      ))}
      {pen !== null && (
        <View
          testID="pen"
          style={[
            styles.pen,
            { left: pen.left - PEN_SIZE / 2, top: pen.top - PEN_SIZE / 2 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.sm,
    backgroundColor: color.map.background,
    overflow: "hidden",
  },
  segment: {
    position: "absolute",
    height: 2,
    backgroundColor: routeLine.color,
    borderRadius: 1,
  },
  pen: {
    position: "absolute",
    width: PEN_SIZE,
    height: PEN_SIZE,
    borderRadius: PEN_SIZE / 2,
    backgroundColor: color.text,
  },
});
