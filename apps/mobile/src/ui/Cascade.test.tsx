import { act, render, screen } from "@testing-library/react-native";
import { Animated, StyleSheet, Text, View } from "react-native";

import { motion } from "../theme/tokens";
import { runAnimationsOnJs } from "./animationsOnJs.testing";
import { CASCADE_MAX, CASCADE_RISE, CASCADE_STEP_MS, Cascade } from "./Cascade";
import { useReduceMotion } from "./useReduceMotion";

// The rows of a list that has just come (TASK-388 C), on fake timers.

jest.mock("./useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

const ROWS = 9;

type Look = { opacity?: number; transform?: { translateY: number }[] };

function look(index: number): Look {
  return (StyleSheet.flatten(screen.getByTestId(`row-${index}`).props.style) ??
    {}) as Look;
}
const opacity = (index: number) => look(index).opacity ?? 1;
const rise = (index: number) => look(index).transform?.[0].translateY ?? 0;

async function show() {
  await render(
    <View>
      {Array.from({ length: ROWS }, (_, index) => (
        <Cascade key={index} index={index} testID={`row-${index}`}>
          <Text>{`Row ${index}`}</Text>
        </Cascade>
      ))}
    </View>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  runAnimationsOnJs();
  reduceMotion.mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("the rows come one after the other, from a little below", async () => {
  const spring = jest.spyOn(Animated, "spring");
  await show();
  expect(opacity(0)).toBe(0);
  expect(rise(0)).toBeCloseTo(CASCADE_RISE, 5);
  await act(() => jest.advanceTimersByTimeAsync(CASCADE_STEP_MS + 16));
  // The first is on its way, the third has not started.
  expect(opacity(0)).toBeGreaterThan(0);
  expect(opacity(2)).toBe(0);
  expect(opacity(0)).toBeGreaterThan(opacity(1));
  await act(() => jest.advanceTimersByTimeAsync(1500));
  for (let index = 0; index < CASCADE_MAX; index += 1) {
    expect(opacity(index)).toBeCloseTo(1, 2);
    expect(rise(index)).toBeCloseTo(0, 1);
  }
  expect(spring).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ ...motion.spring.smooth, useNativeDriver: true }),
  );
});

test("past the first six, the rows are there at once", async () => {
  await show();
  for (let index = CASCADE_MAX; index < ROWS; index += 1) {
    expect(opacity(index)).toBe(1);
    expect(rise(index)).toBe(0);
  }
});

test("with Reduce Motion every row is there at once", async () => {
  reduceMotion.mockReturnValue(true);
  const spring = jest.spyOn(Animated, "spring");
  await show();
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(opacity(0)).toBe(1);
  expect(rise(0)).toBe(0);
  expect(spring).not.toHaveBeenCalled();
});
