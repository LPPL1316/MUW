import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, StyleSheet, Text } from "react-native";

import { motion } from "../theme/tokens";
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
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await render(
    <Tap testID="tap" onPressIn={onPressIn} onPressOut={onPressOut}>
      <Text>Go</Text>
    </Tap>,
  );
  const tap = screen.getByTestId("tap");
  fireEvent(tap, "pressIn");
  fireEvent(tap, "pressOut");
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);

  // Down in `pressMs`, back in `releaseMs`, on the native driver.
  expect(timing).toHaveBeenCalledTimes(2);
  expect(timing.mock.calls[0][1]).toMatchObject({
    toValue: 1,
    duration: motion.pressMs,
    useNativeDriver: true,
  });
  expect(timing.mock.calls[1][1]).toMatchObject({
    toValue: 0,
    duration: motion.releaseMs,
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
