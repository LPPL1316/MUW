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
import { type SpringName, springTo } from "./motion";
import { useReduceMotion } from "./useReduceMotion";

type Props = Omit<PressableProps, "style"> & {
  /** The Pressable itself, for a caller that measures or scrolls to it. */
  ref?: Ref<View>;
  /** The control's own look; the press lays its scale and opacity over it. */
  style?: StyleProp<ViewStyle>;
  /** How small it gets under the finger: `motion.pressScale` unless told. */
  pressScale?: number;
  /** The spring it comes back on: `snappy` unless told. */
  settle?: SpringName;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that answers the finger (TASK-339, ADR-0293): while pressed
 * it shrinks a little and dims, in `motion.pressMs`; let go, it comes back
 * on the spring `snappy`, a hair past its size and settling (TASK-388,
 * ADR-0329), as everything in the app answers the finger. In place of the flat `opacity: 0.6` the app's
 * controls showed. On the native driver, so a busy JS thread does not hold
 * the answer back. With «Reduce Motion» on it is a plain Pressable that
 * only dims while held: nothing moves, nothing is animated. Takes
 * everything a Pressable takes, except a `style` function: the pressed
 * look is this component's.
 */
export function Tap({
  ref,
  style,
  pressScale = motion.pressScale,
  settle = "snappy",
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
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

  // Each starts from where the last left it: a press half way back is smooth.
  function press() {
    Animated.timing(pressed, {
      toValue: 1,
      duration: motion.pressMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }
  function release() {
    springTo(pressed, 0, settle).start();
  }

  // The spring passes 0 by a hair: the size a hair past whole, the light
  // never past full.
  const scale = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, pressScale],
  });
  const opacity = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, motion.pressOpacity],
    extrapolate: "clamp",
  });

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      style={[style, { opacity, transform: [{ scale }] }]}
      onPressIn={(event: GestureResponderEvent) => {
        press();
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        release();
        onPressOut?.(event);
      }}
    />
  );
}

const styles = {
  held: { opacity: motion.pressOpacity },
} as const;
