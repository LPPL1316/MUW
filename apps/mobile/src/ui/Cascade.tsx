import { type ReactNode, useEffect, useState } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { springTo } from "./motion";
import { useReduceMotion } from "./useReduceMotion";

/** Between one row and the next, in milliseconds. */
export const CASCADE_STEP_MS = 25;
/** Only the first rows move: the rest are there at once. */
export const CASCADE_MAX = 6;
/** How far below its place a row starts, in points. */
export const CASCADE_RISE = 6;

type Props = {
  /** The row's place in the list, from 0. */
  index: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
};

/**
 * A row of a list that has just come (TASK-388 C, ADR-0329): it fades in
 * and rises a few points to its place on the spring `smooth`, each row
 * `CASCADE_STEP_MS` after the one above; only the first `CASCADE_MAX` move.
 * A row that comes later, as a page more, comes with its own fade. With
 * «Reduce Motion» the rows are there at once.
 */
export function Cascade({ index, style, testID, children }: Props) {
  const still = useReduceMotion();
  const plays = index < CASCADE_MAX;
  const [shown] = useState(() => new Animated.Value(plays ? 0 : 1));

  useEffect(() => {
    if (!plays || still) {
      shown.setValue(1);
      return;
    }
    const come = Animated.sequence([
      Animated.delay(index * CASCADE_STEP_MS),
      springTo(shown, 1, "smooth"),
    ]);
    come.start();
    return () => come.stop();
  }, [index, plays, still, shown]);

  if (!plays) {
    return (
      <Animated.View style={style} testID={testID}>
        {children}
      </Animated.View>
    );
  }
  const translateY = shown.interpolate({
    inputRange: [0, 1],
    outputRange: [CASCADE_RISE, 0],
  });
  const opacity = shown.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }] }]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}
