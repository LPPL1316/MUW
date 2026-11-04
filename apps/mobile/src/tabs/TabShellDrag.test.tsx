import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { runAnimationsOnJs } from "../ui/animationsOnJs.testing";
import { useReduceMotion } from "../ui/useReduceMotion";
import { TAB_CAPSULE_WIDTH } from "./TabBar";
import { pagesFromPage, type ShellPage, TabShell } from "./TabShell";
import { STRIP_START } from "./tabStrip";

// The bar's capsule under a finger sliding the pages (TASK-388 with the
// swipe of TASK-379): it follows the strip, and a page reached by sliding
// finds it already there.

jest.mock("../haptics/haptics", () => ({ selectionFeel: jest.fn() }));
jest.mock("../ui/useReduceMotion");

const PAGES: ShellPage[] = ["Feed", "Draw", "Messages", "Explore"].map(
  (title, index) => ({
    title,
    label: title,
    icon: (["house", "pencil", "send", "search"] as const)[index],
    render: () => <Text>{`${title} page`}</Text>,
  }),
);

// The window of the tests (react-native's jest setup).
const WIDTH = 750;
const SLOT = WIDTH / PAGES.length;
const FRAME = 16;

function under(index: number): number {
  return index * SLOT + (SLOT - TAB_CAPSULE_WIDTH) / 2;
}

function capsuleX(testID = "tab-capsule"): number {
  const style = StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    transform: { translateX: number }[];
  };
  return style.transform[0].translateX;
}

function Shell({ first = 1, send = (index: number) => index }) {
  const [page, setPage] = useState(first);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TabShell pages={PAGES} page={page} onPage={(index) => setPage(send(index))} />
    </SafeAreaProvider>
  );
}

/** The strip scrolled to `place`, and `plus` pages on. */
function at(place: number, plus = 0) {
  return { nativeEvent: { contentOffset: { x: (place + plus) * WIDTH, y: 0 } } };
}

async function slide(place: number, plus = 0) {
  await fireEvent.scroll(screen.getByTestId("tab-pages"), at(place, plus));
}

async function rest(place: number) {
  await slide(place);
  await fireEvent(screen.getByTestId("tab-pages"), "momentumScrollEnd", at(place));
}

async function frames(count: number, each?: () => void) {
  for (let i = 0; i < count; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(FRAME));
    each?.();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  runAnimationsOnJs();
  jest.mocked(useReduceMotion).mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("the capsule follows the finger, and a page reached by sliding finds it there", async () => {
  await render(<Shell />);
  expect(capsuleX()).toBeCloseTo(under(1), 3);

  await slide(STRIP_START, 0.4);
  expect(capsuleX()).toBeCloseTo(under(1.4), 3);

  await rest(STRIP_START + 1);
  expect(screen.getByRole("tab", { name: "Messages" })).toBeSelected();
  // There, and it stays: no spring sets off from the tab it left.
  await frames(10, () => expect(capsuleX()).toBeCloseTo(under(2), 3));
});

test("backwards from the first page round to the last: one capsule leaves, its twin comes in", async () => {
  await render(<Shell first={0} />);
  await slide(STRIP_START, -0.5);
  expect(capsuleX()).toBeCloseTo(under(-0.5), 3);
  expect(capsuleX("tab-capsule-2")).toBeCloseTo(under(3.5), 3);

  await rest(STRIP_START - 1);
  expect(screen.getByRole("tab", { name: "Explore" })).toBeSelected();
  await frames(10, () => expect(capsuleX()).toBeCloseTo(under(3), 3));
});

test("a tab touched leaves the strip where it is: the capsule slides on its spring", async () => {
  await render(<Shell first={0} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await frames(4);
  expect(capsuleX()).toBeGreaterThan(under(0));
  expect(capsuleX()).toBeLessThan(under(3));
  await frames(60);
  expect(capsuleX()).toBeCloseTo(under(3), 1);
});

test("slid to a page the app sends elsewhere, the capsule goes on from where the finger left it", async () => {
  // As «Messages» sends to the profile without an account.
  await render(<Shell send={(index) => (index === 2 ? 3 : index)} />);
  await slide(STRIP_START, 0.7);
  await rest(STRIP_START + 1);
  expect(screen.getByRole("tab", { name: "Explore" })).toBeSelected();

  const xs: number[] = [];
  await frames(60, () => xs.push(capsuleX()));
  // From «Messages», never back towards «Draw», to «Explore».
  expect(Math.min(...xs)).toBeGreaterThan(under(2) - 1);
  expect(capsuleX()).toBeCloseTo(under(3), 1);
});

test("flicks one after the other, before the strip rests: the capsule goes on round, and the page found there", async () => {
  await render(<Shell />);
  // «Draw» on screen; three pages on without a rest, the strip handing its
  // places on half way, as a fast thumb does.
  const steps = [0.5, 1, 1.5, 2, 2.5, 3];
  for (const plus of steps) {
    await slide(STRIP_START, plus);
    // Always onwards, never back towards «Draw».
    expect(capsuleX()).toBeCloseTo(under(1 + plus), 3);
  }
  // Three on from «Draw» is «Feed», round the bar: the twin is there.
  expect(capsuleX("tab-capsule-0")).toBeCloseTo(under(0), 3);

  await rest(STRIP_START + 3);
  expect(screen.getByRole("tab", { name: "Feed" })).toBeSelected();
  await frames(10, () => expect(capsuleX()).toBeCloseTo(under(0), 3));
});

test("the pages from the app's page: counted from the strip's, the round nearest the last", () => {
  const now = { page: 3, place: 1002 };
  // The strip at rest on «Explore», two places on from «Draw».
  expect(pagesFromPage(1002 * 100, 100, now, 1, 4, 1.9)).toBeCloseTo(2);
  // Half way past it, still onwards.
  expect(pagesFromPage(1002.5 * 100, 100, now, 1, 4, 2)).toBeCloseTo(2.5);
  // The same strip seen from the other way round, when that is nearer.
  expect(pagesFromPage(1002 * 100, 100, now, 1, 4, -1.8)).toBeCloseTo(-2);
});
