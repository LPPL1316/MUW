import { Animated } from "react-native";

import { motion } from "../theme/tokens";
import {
  fadeTo,
  type SpringName,
  springDampingFraction,
  springOvershoot,
  springResponse,
  springTo,
} from "./motion";

// The app's springs (TASK-388, ADR-0329): iOS-like, never elastic.

const NAMES = Object.keys(motion.spring) as SpringName[];

test.each(NAMES)(
  "«%s» answers in 0.35–0.5 s and passes its mark by 3% at most",
  (name) => {
    const spring = motion.spring[name];
    expect(springResponse(spring)).toBeGreaterThanOrEqual(0.35);
    expect(springResponse(spring)).toBeLessThanOrEqual(0.5);
    expect(springOvershoot(spring)).toBeLessThanOrEqual(0.03);
    expect(springDampingFraction(spring)).toBeLessThanOrEqual(1);
  },
);

test("as the token says: snappy and island bounce a hair, smooth hardly at all, glide never", () => {
  expect(springOvershoot(motion.spring.snappy)).toBeCloseTo(0.025, 2);
  // The tab bar's (A2): critically damped, it never passes its mark.
  expect(springDampingFraction(motion.spring.glide)).toBe(1);
  expect(springOvershoot(motion.spring.glide)).toBe(0);
  expect(springResponse(motion.spring.glide)).toBeCloseTo(0.39, 2);
  expect(springOvershoot(motion.spring.island)).toBeCloseTo(0.017, 2);
  expect(springOvershoot(motion.spring.smooth)).toBeLessThan(0.001);
  expect(springOvershoot({ stiffness: 100, damping: 20, mass: 1 })).toBe(0);
});

test("springs and fades go on the native driver, with the token's numbers", () => {
  const still = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  const spring = jest.spyOn(Animated, "spring").mockReturnValue(still);
  const timing = jest.spyOn(Animated, "timing").mockReturnValue(still);
  const value = new Animated.Value(0);

  springTo(value, 1, "island");
  expect(spring).toHaveBeenCalledWith(
    value,
    expect.objectContaining({
      toValue: 1,
      ...motion.spring.island,
      useNativeDriver: true,
    }),
  );
  fadeTo(value, 0);
  expect(timing).toHaveBeenCalledWith(
    value,
    expect.objectContaining({
      toValue: 0,
      duration: motion.pressMs,
      useNativeDriver: true,
    }),
  );
  jest.restoreAllMocks();
});
