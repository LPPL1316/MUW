import { type Ref, useState } from "react";
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

import { motion } from "../theme/tokens";
import { useReduceMotion } from "./useReduceMotion";

type Props = Omit<PressableProps, "style"> & {
  /** The Pressable itself, for a caller that measures or scrolls to it. */
  ref?: Ref<View>;
  /** The control's own look; the press lays its scale and opacity over it. */
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that answers the finger (TASK-339, ADR-0293): while pressed
 * it shrinks a little and dims, in `motion.pressMs`; let go, it comes back
 * in `motion.releaseMs`. In place of the flat `opacity: 0.6` the app's
 * controls showed. On the native driver, so a busy JS thread does not hold
 * the answer back. With «Reduce Motion» on it is a plain Pressable that
 * only dims while held: nothing moves, nothing is animated. Takes
 * everything a Pressable takes, except a `style` function: the pressed
 * look is this component's.
 */
export function Tap({ ref, style, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed] = useState(() => new Animated.Value(0));
  const still = useReduceMotion();

  if (still) {
    return (
      <Pressable
        ref={ref}
        {...rest}
        style={({ pressed: held }) => [style, held && styles.held]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />
    );
  }

  function moveTo(toValue: number, duration: number) {
    Animated.timing(pressed, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }

  const scale = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, motion.pressScale],
  });
  const opacity = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, motion.pressOpacity],
  });

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      style={[style, { opacity, transform: [{ scale }] }]}
      onPressIn={(event: GestureResponderEvent) => {
        moveTo(1, motion.pressMs);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        moveTo(0, motion.releaseMs);
        onPressOut?.(event);
      }}
    />
  );
}

const styles = {
  held: { opacity: motion.pressOpacity },
} as const;
