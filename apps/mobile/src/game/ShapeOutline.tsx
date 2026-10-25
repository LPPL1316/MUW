import { useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { outlineSegments } from "./outlineSegments";

type Props = {
  /** From the API's catalog: 0 to 1, y downwards, closed. */
  outline: readonly (readonly [number, number])[];
  size: number;
  color: string;
  thickness?: number;
  /** From 0 to 1: how much of the outline the pen has drawn. Without it,
   * the whole outline at once. */
  draw?: Animated.Value;
  testID?: string;
};

/** The line stays inside the square by this much. */
const PAD_SHARE = 0.1;

/**
 * A shape of the game drawn as thin turned Views, as the run's drawing is
 * (no SVG in the app). With `draw`, each stroke appears as the pen reaches
 * it, in the order of the outline: the shape is drawn, not shown.
 */
export function ShapeOutline({
  outline,
  size,
  color,
  thickness = 3,
  draw,
  testID,
}: Props) {
  const segments = useMemo(
    () => outlineSegments(outline, size, size * PAD_SHARE),
    [outline, size],
  );
  const count = segments.length;
  return (
    <View style={{ width: size, height: size }} testID={testID} accessible={false}>
      {segments.map((s, i) => {
        const placed = {
          left: s.left,
          top: s.top - thickness / 2,
          width: s.length + thickness / 2,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: `${s.angle}deg` }],
        };
        if (draw === undefined) {
          return <View key={i} style={[styles.stroke, placed]} />;
        }
        return (
          <Animated.View
            key={i}
            style={[
              styles.stroke,
              placed,
              {
                opacity: draw.interpolate({
                  inputRange: [i / count, (i + 1) / count],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stroke: {
    position: "absolute",
  },
});
