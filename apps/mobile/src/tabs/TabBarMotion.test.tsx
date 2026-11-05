import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { selectionFeel } from "../haptics/haptics";
import { motion } from "../theme/tokens";
import { runAnimationsOnJs } from "../ui/animationsOnJs.testing";
import { useReduceMotion } from "../ui/useReduceMotion";
import { type BarTab, TAB_CAPSULE_WIDTH, TAB_ICON_RISE, TabBar } from "./TabBar";

// The capsule, the icons and the buzz of the tab bar (TASK-388, ADR-0329),
// watched frame by frame on fake timers.

jest.mock("../haptics/haptics", () => ({ selectionFeel: jest.fn() }));
jest.mock("../ui/useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

const TABS: BarTab[] = [
  { title: "Feed", label: "Feed", icon: "house" },
  { title: "Draw", label: "Draw", icon: "pencil" },
  { title: "Messages", label: "Messages", icon: "send" },
  { title: "Explore", label: "Explore", icon: "search" },
  { title: "Profile", label: "Profile", icon: "house" },
];
const SLOT = Dimensions.get("window").width / TABS.length;
const FRAME = 16;

/** Where the capsule stands under the tab `index`. */
function under(index: number): number {
  return index * SLOT + (SLOT - TAB_CAPSULE_WIDTH) / 2;
}

type Look = { opacity: number; transform: Record<string, number>[] };

function look(testID: string): Look {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as Look;
}
function capsuleX(testID = "tab-capsule"): number {
  return look(testID).transform[0].translateX;
}

function bar(
  page: number,
  onTab: (index: number) => void = jest.fn(),
  drag?: Animated.Value,
) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TabBar tabs={TABS} page={page} onTab={onTab} drag={drag} />
    </SafeAreaProvider>
  );
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
  reduceMotion.mockReturnValue(false);
  jest.mocked(selectionFeel).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("the capsule glides to the new tab and stops there, never past it, never stretched", async () => {
  const { rerender } = await render(bar(0));
  expect(capsuleX()).toBeCloseTo(under(0), 3);

  await rerender(bar(3));
  const xs: number[] = [];
  await frames(60, () => {
    xs.push(capsuleX());
    // Only a slide: no stretch, no second movement on top of it.
    expect(look("tab-capsule").transform).toHaveLength(1);
  });

  // It slid, it did not jump: the first frame is still near the start.
  expect(xs[0] - under(0)).toBeLessThan(SLOT);
  // Critically damped (A2): always onwards, never past the tab and back.
  for (let i = 1; i < xs.length; i += 1) {
    expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 0.001);
  }
  expect(Math.max(...xs)).toBeLessThanOrEqual(under(3) + 0.01);
  expect(capsuleX()).toBeCloseTo(under(3), 1);
  // On the bar's spring.
  expect(motion.spring.glide).toEqual({ stiffness: 256, damping: 32, mass: 1 });
});

test("a touched tab sets the capsule off at the touch, before the page comes, and the page starts nothing new", async () => {
  const spring = jest.spyOn(Animated, "spring");
  const toExplore = () =>
    spring.mock.calls.filter(([, config]) => config.toValue === 3);
  let atAnswer = -1;
  function Bar() {
    const [page, setPage] = useState(0);
    return bar(page, (index: number) => {
      // What the app hears: the spring is already on its way.
      atAnswer = toExplore().length;
      setPage(index);
    });
  }
  await render(<Bar />);
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(atAnswer).toBeGreaterThan(0);
  expect(toExplore()[0][1]).toMatchObject({
    ...motion.spring.glide,
    useNativeDriver: true,
  });
  // The page came: nothing started again for it.
  expect(toExplore().length).toBe(atAnswer);

  await frames(60);
  expect(toExplore().length).toBe(atAnswer);
  expect(capsuleX()).toBeCloseTo(under(3), 1);
  expect(look("tab-icon-on-Explore").opacity).toBe(1);
  expect(look("tab-icon-on-Feed").opacity).toBe(0);
});

test("a page the app keeps: the capsule set off at the touch comes back", async () => {
  // As «Messages» for nobody signed in, on the profile already.
  await render(bar(0));
  await fireEvent.press(screen.getByRole("tab", { name: "Messages" }));
  await frames(60);
  expect(capsuleX()).toBeCloseTo(under(0), 1);
  expect(look("tab-icon-on-Feed").opacity).toBe(1);
  expect(look("tab-icon-on-Messages").opacity).toBe(0);
});

test("a new tab half way goes on from where the capsule is, without a jump", async () => {
  const { rerender } = await render(bar(0));
  await rerender(bar(4));
  await frames(6);
  const halfWay = capsuleX();
  expect(halfWay).toBeGreaterThan(under(0));
  expect(halfWay).toBeLessThan(under(4));

  await rerender(bar(1));
  await frames(1);
  // One frame on it is still near where it was: it turned, it did not jump.
  expect(Math.abs(capsuleX() - halfWay)).toBeLessThan(SLOT);
  await frames(60);
  expect(capsuleX()).toBeCloseTo(under(1), 1);
});

test("a new tab buzzes once; the tab on screen, touched again, does not", async () => {
  const onTab = jest.fn();
  await render(bar(0, onTab));
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(selectionFeel).toHaveBeenCalledTimes(1);
  expect(onTab).toHaveBeenLastCalledWith(3);

  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(selectionFeel).toHaveBeenCalledTimes(1);
  expect(onTab).toHaveBeenLastCalledWith(0);
});

test("the icon taking its tab rises and fills in a cross fade; the one leaving fades back", async () => {
  const { rerender } = await render(bar(0));
  expect(look("tab-icon-on-Feed").opacity).toBe(1);
  expect(look("tab-icon-off-Draw").opacity).toBe(1);
  expect(look("tab-icon-on-Draw").opacity).toBe(0);

  await rerender(bar(1));
  await frames(4);
  // Half way both lines show.
  const onHalf = look("tab-icon-on-Draw").opacity;
  expect(onHalf).toBeGreaterThan(0);
  expect(onHalf).toBeLessThan(1);
  await frames(60);
  expect(look("tab-icon-on-Draw").opacity).toBe(1);
  expect(look("tab-icon-off-Draw").opacity).toBe(0);
  expect(look("tab-icon-on-Feed").opacity).toBe(0);
  expect(look("tab-icon-off-Feed").opacity).toBe(1);

  const raised = (title: string) =>
    (
      StyleSheet.flatten(
        screen.getByTestId(`tab-icon-on-${title}`).parent?.props.style,
      ) as {
        transform: { translateY: number }[];
      }
    ).transform[0].translateY;
  expect(raised("Draw")).toBeCloseTo(-TAB_ICON_RISE, 2);
  expect(raised("Feed")).toBeCloseTo(0, 2);
});

test("with «Reduce Motion» no spring starts: the capsule fades in where it goes", async () => {
  reduceMotion.mockReturnValue(true);
  const spring = jest.spyOn(Animated, "spring");
  const { rerender } = await render(bar(0));
  await rerender(bar(3));

  // There at once, nothing slides.
  expect(capsuleX()).toBeCloseTo(under(3), 3);
  expect(look("tab-capsule").opacity).toBe(0);
  await frames(Math.ceil(motion.pressMs / FRAME) + 2);
  expect(look("tab-capsule").opacity).toBe(1);

  // The icons only fade: no rise.
  const raised = StyleSheet.flatten(
    screen.getByTestId("tab-icon-on-Explore").parent?.props.style,
  ) as { transform: { translateY: number }[] };
  expect(raised.transform[0].translateY).toBe(0);
  expect(look("tab-icon-on-Explore").opacity).toBe(1);
  expect(spring).not.toHaveBeenCalled();
});

test("under a finger sliding the pages the capsule follows it, round from the last tab to the first", async () => {
  const drag = new Animated.Value(0);
  const { rerender } = await render(bar(1, jest.fn(), drag));

  await act(() => drag.setValue(0.4));
  expect(capsuleX()).toBeCloseTo(under(1.4), 3);

  // Let go past half way: the next page comes, the slide back to 0 with it,
  // and the capsule, already there, does not spring.
  await act(() => drag.setValue(1));
  // As TabShell does: the new page first, then the slide back to 0, in
  // the same commit there; here one after the other.
  await rerender(bar(2, jest.fn(), drag));
  await act(() => drag.setValue(0));
  // And it stays: no spring sets off from the tab it left.
  await frames(10, () => expect(capsuleX()).toBeCloseTo(under(2), 3));

  // From the last tab round to the first: one capsule leaves at the right,
  // its twin a whole bar to the left comes in.
  await rerender(bar(4, jest.fn(), drag));
  await frames(60);
  await act(() => drag.setValue(0.5));
  expect(capsuleX()).toBeCloseTo(under(4.5), 3);
  expect(capsuleX("tab-capsule-0")).toBeCloseTo(under(4.5) - TABS.length * SLOT, 3);
  await act(() => drag.setValue(1));
  await rerender(bar(0, jest.fn(), drag));
  await act(() => drag.setValue(0));
  // And it stays: no spring sets off from the tab it left.
  await frames(10, () => expect(capsuleX()).toBeCloseTo(under(0), 3));
});
