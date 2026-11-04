import { Animated, Easing } from "react-native";

import { motion } from "../theme/tokens";

/**
 * The one way the app moves on a spring (TASK-388, ADR-0329): the springs of
 * `motion.spring`, on the native driver, so only `transform` and `opacity`
 * may hang on them. A spring started on a value that is still moving takes
 * it from where it is, with its speed: a touch half way never jumps.
 */

export type SpringName = keyof typeof motion.spring;

/** Below these the spring is at rest: less than a hundredth of a point. */
const REST = { restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 };

/** `value` to `toValue` on the spring `name`; `.start()` it. */
export function springTo(
  value: Animated.Value,
  toValue: number,
  name: SpringName,
): Animated.CompositeAnimation {
  return Animated.spring(value, {
    toValue,
    ...motion.spring[name],
    ...REST,
    useNativeDriver: true,
  });
}

/**
 * A short fade, `value` to `toValue`: what is left of a movement when the
 * phone asks for less motion («Reduce Motion»): no spring, nothing slides.
 */
export function fadeTo(
  value: Animated.Value,
  toValue: number,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration: motion.pressMs,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
}

type Spring = { stiffness: number; damping: number; mass: number };

/** Seconds of one swing of the undamped spring: SwiftUI's `response`. */
export function springResponse({ stiffness, mass }: Spring): number {
  return 2 * Math.PI * Math.sqrt(mass / stiffness);
}

/** Its damping fraction: 1 never passes the mark, less passes it. */
export function springDampingFraction({ stiffness, damping, mass }: Spring): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

/** How far past its mark it goes, as a share of the way: 0.02 is 2%. */
export function springOvershoot(spring: Spring): number {
  const zeta = springDampingFraction(spring);
  if (zeta >= 1) {
    return 0;
  }
  return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}
