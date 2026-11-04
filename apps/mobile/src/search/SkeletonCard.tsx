import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useReduceMotion } from "../ui/useReduceMotion";
import { color, radius, space } from "../theme/tokens";
import { PREVIEW_RATIO } from "./DrawingResultCard";

/** One breath of the placeholders, in and out. */
const BREATH_MS = 900;

/**
 * The place of a drawing on its way (TASK-344): the shape of a card,
 * breathing softly. With «Reduce Motion» on it stays still. Hidden from
 * the screen reader: the search says it is looking.
 */
export function SkeletonCard({ width }: { width: number }) {
  const still = useReduceMotion();
  const [glow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) {
      return;
    }
    const breath = Animated.loop(
      Animated.sequence([
        // In JS: driven natively, nothing moves inside a Modal on iOS
        // (the new architecture; SuperLikeSheet.tsx).
        Animated.timing(glow, {
          toValue: 1,
          duration: BREATH_MS,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: BREATH_MS,
          useNativeDriver: false,
        }),
      ]),
    );
    breath.start();
    return () => breath.stop();
  }, [glow, still]);
  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      style={[styles.card, { width, opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="search-skeleton"
    >
      <View style={[styles.preview, { height: width * PREVIEW_RATIO }]} />
      <View style={styles.words}>
        <View style={[styles.line, { width: "70%" }]} />
        <View style={[styles.line, { width: "45%" }]} />
      </View>
    </Animated.View>
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
    backgroundColor: color.surfaceRaised,
  },
  words: {
    padding: space.md,
    gap: space.sm,
  },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: color.surfaceRaised,
  },
});
