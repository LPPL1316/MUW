import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { motion } from "../theme/tokens";
import { runAnimationsOnJs } from "./animationsOnJs.testing";
import { ISLAND_BORN, ISLAND_HOLD_MS, ISLAND_STEP_MS } from "./Island";
import { useIsland } from "./useIsland";
import { useReduceMotion } from "./useReduceMotion";

// The island (TASK-388 B), watched frame by frame on fake timers.

jest.mock("./useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

const FRAME = 16;

function Screen() {
  const [island, say] = useIsland();
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => say("Sent to Ada_runs.")}>
        <Text>Send to Ada</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => say("Sent to Bo.")}>
        <Text>Send to Bo</Text>
      </Pressable>
      {island}
    </View>
  );
}

async function show() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <Screen />
    </SafeAreaProvider>,
  );
}

type Look = { opacity: number; transform?: Record<string, number>[] };

function look(testID: string): Look {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as Look;
}
function scales(): { x: number; y: number } {
  const transform = look("island").transform ?? [];
  return { x: transform[0].scaleX, y: transform[1].scaleY };
}

async function frames(count: number, each?: () => void) {
  for (let i = 0; i < count; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(FRAME));
    each?.();
  }
}
async function wait(ms: number) {
  await frames(Math.ceil(ms / FRAME));
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

test("nothing until something is said", async () => {
  await show();
  expect(screen.queryByTestId("island")).toBeNull();
});

test("born small, it grows wider, then taller, then its words fade in", async () => {
  const spring = jest.spyOn(Animated, "spring");
  await show();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Ada" }));
  expect(scales().x).toBeCloseTo(ISLAND_BORN.wide, 3);
  expect(scales().y).toBeCloseTo(ISLAND_BORN.tall, 3);
  expect(look("island").opacity).toBe(0);

  // Before the second step: wider only, no words yet.
  await wait(ISLAND_STEP_MS - FRAME);
  expect(scales().x).toBeGreaterThan(ISLAND_BORN.wide + 0.1);
  expect(scales().y).toBeCloseTo(ISLAND_BORN.tall, 3);
  expect(look("island-words").opacity).toBe(0);

  // Open: whole, the words on, never more than a hair past its size.
  let widest = 0;
  await frames(60, () => {
    widest = Math.max(widest, scales().x);
  });
  expect(widest).toBeLessThan(1.03);
  expect(scales().x).toBeCloseTo(1, 2);
  expect(scales().y).toBeCloseTo(1, 2);
  expect(look("island").opacity).toBe(1);
  expect(look("island-words").opacity).toBeCloseTo(1, 2);
  expect(screen.getByText("Sent to Ada_runs.")).toBeOnTheScreen();

  // On the island's spring, on the native driver.
  expect(spring.mock.calls[0][1]).toMatchObject({
    ...motion.spring.island,
    useNativeDriver: true,
  });
});

test("it stays a moment, then closes the way it came and is gone", async () => {
  await show();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Ada" }));
  await frames(60);
  await wait(ISLAND_HOLD_MS - 200);
  expect(screen.getByText("Sent to Ada_runs.")).toBeOnTheScreen();
  expect(scales().x).toBeCloseTo(1, 2);

  // Closing: the words first, the width last.
  await wait(200 + ISLAND_STEP_MS);
  expect(look("island-words").opacity).toBeLessThan(0.5);
  expect(scales().x).toBeGreaterThan(0.95);
  await frames(90);
  expect(screen.queryByTestId("island")).toBeNull();
});

test("something new said while it is open changes the words without closing it", async () => {
  await show();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Ada" }));
  await frames(60);
  await fireEvent.press(screen.getByRole("button", { name: "Send to Bo" }));
  expect(screen.getByText("Sent to Bo.")).toBeOnTheScreen();
  // Open all along: no jump back to small.
  await frames(30, () => expect(scales().x).toBeGreaterThan(0.99));
  expect(look("island-words").opacity).toBeCloseTo(1, 2);
  // And the moment starts again from the new words.
  await wait(ISLAND_HOLD_MS - 600);
  expect(screen.getByText("Sent to Bo.")).toBeOnTheScreen();
  expect(scales().x).toBeCloseTo(1, 2);
});

test("with «Reduce Motion» it only fades, at its size, and no spring starts", async () => {
  reduceMotion.mockReturnValue(true);
  const spring = jest.spyOn(Animated, "spring");
  await show();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Ada" }));
  expect(look("island").transform).toEqual([{ scaleX: 1 }, { scaleY: 1 }]);
  await frames(40);
  expect(look("island").opacity).toBe(1);
  expect(look("island-words").opacity).toBe(1);
  await wait(ISLAND_HOLD_MS + 600);
  expect(screen.queryByTestId("island")).toBeNull();
  expect(spring).not.toHaveBeenCalled();
});
