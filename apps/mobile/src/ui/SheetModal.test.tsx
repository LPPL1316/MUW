import { act, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Animated, StyleSheet, Text, TextInput } from "react-native";

import { motion } from "../theme/tokens";
import { runAnimationsOnJs } from "./animationsOnJs.testing";
import { SheetModal } from "./SheetModal";
import { useReduceMotion } from "./useReduceMotion";

// The sheets from the bottom (TASK-388 C), watched frame by frame on fake
// timers.

jest.mock("./useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

const FRAME = 16;
// The window of the jest preset.
const HEIGHT = 1334;

type Look = { opacity?: number; transform?: { translateY: number }[] };

function look(): Look {
  return StyleSheet.flatten(screen.getByTestId("sheet").props.style) as Look;
}
function lift(): number {
  return look().transform?.[0].translateY ?? 0;
}

async function frames(count: number, each?: () => void) {
  for (let i = 0; i < count; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(FRAME));
    each?.();
  }
}

/** What the sheet holds, with a field of its own, as the app's sheets. */
function Body() {
  const [text, setText] = useState("");
  return (
    <>
      <Text>Report</Text>
      <TextInput testID="field" value={text} onChangeText={setText} />
    </>
  );
}

function Sheet({ visible, onHidden }: { visible: boolean; onHidden?: () => void }) {
  return (
    <SheetModal
      visible={visible}
      onRequestClose={() => {}}
      onHidden={onHidden}
      testID="sheet"
    >
      <Body />
    </SheetModal>
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

test("nothing while closed", async () => {
  await render(<Sheet visible={false} />);
  expect(screen.queryByText("Report")).toBeNull();
});

test("it comes up from below on `smooth`, never past its place", async () => {
  const spring = jest.spyOn(Animated, "spring");
  await render(<Sheet visible />);
  expect(screen.getByText("Report")).toBeOnTheScreen();
  expect(lift()).toBeCloseTo(HEIGHT, 0);
  let last = lift();
  await frames(80, () => {
    // Up all the way, and no more than a point past it.
    expect(lift()).toBeLessThanOrEqual(last + 0.5);
    expect(lift()).toBeGreaterThan(-1);
    last = lift();
  });
  expect(lift()).toBeCloseTo(0, 0);
  expect(spring).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ ...motion.spring.smooth, useNativeDriver: true }),
  );
});

test("closed, it goes down first, then the Modal goes and `onHidden` follows", async () => {
  const onHidden = jest.fn();
  const { rerender } = await render(<Sheet visible onHidden={onHidden} />);
  await frames(80);
  await rerender(<Sheet visible={false} onHidden={onHidden} />);
  // Still there on its way down, taking no more touches.
  expect(screen.getByText("Report")).toBeOnTheScreen();
  expect(screen.getByTestId("sheet")).toHaveProp("pointerEvents", "none");
  await frames(4);
  expect(lift()).toBeGreaterThan(0);
  expect(onHidden).not.toHaveBeenCalled();
  await frames(120);
  expect(screen.queryByText("Report")).toBeNull();
  expect(onHidden).toHaveBeenCalledTimes(1);
});

test("opened again on its way down, it comes back from where it is, new", async () => {
  const { rerender } = await render(<Sheet visible />);
  await frames(80);
  await act(async () => {
    screen.getByTestId("field").props.onChangeText("Left unsent");
  });
  await rerender(<Sheet visible={false} />);
  await frames(6);
  const down = lift();
  expect(down).toBeGreaterThan(0);
  await rerender(<Sheet visible />);
  await frames(1);
  // No jump: from where it was, back up.
  expect(Math.abs(lift() - down)).toBeLessThan(HEIGHT * 0.1);
  await frames(80);
  expect(lift()).toBeCloseTo(0, 0);
  expect(screen.getByTestId("field")).toHaveProp("value", "");
});

test("with Reduce Motion it only fades, in place", async () => {
  reduceMotion.mockReturnValue(true);
  const spring = jest.spyOn(Animated, "spring");
  await render(<Sheet visible />);
  expect(look().transform).toBeUndefined();
  await frames(30);
  expect(look().opacity).toBeCloseTo(1, 2);
  expect(spring).not.toHaveBeenCalled();
});
