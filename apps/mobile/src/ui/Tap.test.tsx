import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, StyleSheet, Text } from "react-native";

import { motion } from "../theme/tokens";
import { runAnimationsOnJs } from "./animationsOnJs.testing";
import { Tap } from "./Tap";
import { useReduceMotion } from "./useReduceMotion";

jest.mock("./useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

beforeEach(() => reduceMotion.mockReturnValue(false));
afterEach(() => jest.restoreAllMocks());

test("is a Pressable: it answers the press and keeps its accessibility", async () => {
  const onPress = jest.fn();
  await render(
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel="Start">
      <Text>Start</Text>
    </Tap>,
  );
  fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("disabled, it answers nothing", async () => {
  const onPress = jest.fn();
  await render(
    <Tap
      onPress={onPress}
      disabled
      accessibilityRole="button"
      accessibilityLabel="Start"
    >
      <Text>Start</Text>
    </Tap>,
  );
  fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(onPress).not.toHaveBeenCalled();
});

test("the caller's pressIn and pressOut still arrive, under the animated look", async () => {
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  // Seen, not run: an animation left running would spill into the next test.
  const still = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  const timing = jest.spyOn(Animated, "timing").mockReturnValue(still);
  const spring = jest.spyOn(Animated, "spring").mockReturnValue(still);
  await render(
    <Tap testID="tap" onPressIn={onPressIn} onPressOut={onPressOut}>
      <Text>Go</Text>
    </Tap>,
  );
  const tap = screen.getByTestId("tap");
  await fireEvent(tap, "pressIn");
  await fireEvent(tap, "pressOut");
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);

  // Down in `pressMs`, back on the spring `snappy` (TASK-388), both on the
  // native driver.
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing.mock.calls[0][1]).toMatchObject({
    toValue: 1,
    duration: motion.pressMs,
    useNativeDriver: true,
  });
  expect(spring).toHaveBeenCalledTimes(1);
  expect(spring.mock.calls[0][1]).toMatchObject({
    toValue: 0,
    ...motion.spring.snappy,
    useNativeDriver: true,
  });

  // The press lays an opacity and a scale over the caller's style: both
  // there, and whole while nothing is pressed.
  const style = StyleSheet.flatten(tap.props.style) as {
    opacity?: number;
    transform?: { scale?: number }[];
  };
  expect(style.opacity).toBe(1);
  expect(style.transform?.[0]?.scale).toBe(1);
});

test("told another spring, it comes back on that one", async () => {
  const still = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  jest.spyOn(Animated, "timing").mockReturnValue(still);
  const spring = jest.spyOn(Animated, "spring").mockReturnValue(still);
  await render(
    <Tap testID="tap" settle="glide">
      <Text>Go</Text>
    </Tap>,
  );
  await fireEvent(screen.getByTestId("tap"), "pressIn");
  await fireEvent(screen.getByTestId("tap"), "pressOut");
  expect(spring.mock.calls[0][1]).toMatchObject({
    toValue: 0,
    ...motion.spring.glide,
    useNativeDriver: true,
  });
});

describe("on fake timers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    runAnimationsOnJs();
  });
  afterEach(() => jest.useRealTimers());

  test("let go, it passes its size by a hair and settles, the light never past full", async () => {
    await render(
      <Tap testID="tap" pressScale={0.88}>
        <Text>Go</Text>
      </Tap>,
    );
    const tap = screen.getByTestId("tap");
    const look = () =>
      StyleSheet.flatten(screen.getByTestId("tap").props.style) as {
        opacity: number;
        transform: { scale: number }[];
      };
    await fireEvent(tap, "pressIn");
    await act(() => jest.advanceTimersByTimeAsync(motion.pressMs + 50));
    expect(look().transform[0].scale).toBeCloseTo(0.88, 2);

    await fireEvent(tap, "pressOut");
    let largest = 0;
    for (let ms = 0; ms < 800; ms += 16) {
      await act(() => jest.advanceTimersByTimeAsync(16));
      largest = Math.max(largest, look().transform[0].scale);
      expect(look().opacity).toBeLessThanOrEqual(1);
    }
    // Past whole, by less than 3% of the way back (0.12): never elastic.
    expect(largest).toBeGreaterThan(1);
    expect(largest).toBeLessThan(1 + 0.03 * 0.12);
    expect(look().transform[0].scale).toBeCloseTo(1, 3);
  });

  test("a press half way back starts from where it is, without a jump", async () => {
    await render(
      <Tap testID="tap" pressScale={0.88}>
        <Text>Go</Text>
      </Tap>,
    );
    const tap = screen.getByTestId("tap");
    const scale = () =>
      (
        StyleSheet.flatten(screen.getByTestId("tap").props.style) as {
          transform: { scale: number }[];
        }
      ).transform[0].scale;
    await fireEvent(tap, "pressIn");
    await act(() => jest.advanceTimersByTimeAsync(motion.pressMs + 50));
    await fireEvent(tap, "pressOut");
    await act(() => jest.advanceTimersByTimeAsync(64));
    const halfWay = scale();
    expect(halfWay).toBeGreaterThan(0.89);
    expect(halfWay).toBeLessThan(0.99);

    await fireEvent(tap, "pressIn");
    await act(() => jest.advanceTimersByTimeAsync(16));
    // One frame on, still near where it was: it went on down from there.
    expect(Math.abs(scale() - halfWay)).toBeLessThan(0.03);
    expect(scale()).toBeLessThanOrEqual(halfWay + 0.005);
  });
});
