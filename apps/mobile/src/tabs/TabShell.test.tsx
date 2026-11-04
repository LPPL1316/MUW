import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { AccessibilityInfo, BackHandler, Text, TextInput } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { tourPager } from "../tour/tourParts";
import { TabShell, type ShellPage } from "./TabShell";
import { useTabReselect } from "./tabReselect";
import { STRIP_START } from "./tabStrip";

/** A page that says it was built, the edges it was given, and how many
 * times its tab was touched again. */
function Body({ name, built }: { name: string; built: jest.Mock }) {
  built(name);
  const insets = useSafeAreaInsets();
  const [again, setAgain] = useState(0);
  useTabReselect(() => setAgain((n) => n + 1));
  return (
    <>
      <Text>{`${name} body, top ${insets.top}, bottom ${insets.bottom}`}</Text>
      <Text>{`${name} touched again ${again}`}</Text>
      <TextInput testID={`${name}-field`} />
    </>
  );
}

function pages(built: jest.Mock): ShellPage[] {
  return [
    {
      title: "Feed",
      label: "Feed",
      icon: "house",
      render: () => <Body name="Feed" built={built} />,
    },
    {
      title: "Draw",
      label: "Draw",
      icon: "pencil",
      render: () => <Body name="Draw" built={built} />,
    },
    {
      title: "Messages",
      label: "Messages, 3 waiting",
      icon: "send",
      count: 3,
      lazy: true,
      render: () => <Body name="Messages" built={built} />,
    },
    {
      title: "Explore",
      label: "Explore",
      icon: "search",
      lazy: true,
      render: () => <Body name="Explore" built={built} />,
    },
  ];
}

/** The shell as App holds it: the page on screen is the app's, which may
 * `send` elsewhere, as «Messages» sends to the profile without an account. */
function Shell({
  built,
  first = 1,
  send = (index) => index,
}: {
  built: jest.Mock;
  first?: number;
  send?: (index: number) => number;
}) {
  const [page, setPage] = useState(first);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TabShell
        pages={pages(built)}
        page={page}
        onPage={(index) => setPage(send(index))}
        action={<Text>Running</Text>}
      />
    </SafeAreaProvider>
  );
}

test("five tabs without words: the screen reader has their names, the page on screen selected", async () => {
  await render(<Shell built={jest.fn()} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
    "Feed",
    "Draw",
    "Messages, 3 waiting",
    "Explore",
  ]);
  expect(screen.getByRole("tab", { name: "Draw" })).toBeSelected();
  expect(screen.getByRole("tab", { name: "Feed" })).not.toBeSelected();
  // The red number of what waits, and the header with the sport.
  expect(screen.getByText("3")).toBeOnTheScreen();
  expect(screen.getByLabelText("MuW")).toBeOnTheScreen();
  expect(screen.getByText("Running")).toBeOnTheScreen();
});

test("a lazy page is built only when its tab is touched, and stays built", async () => {
  const built = jest.fn();
  await render(<Shell built={built} />);
  expect(built).not.toHaveBeenCalledWith("Explore");
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(built).toHaveBeenCalledWith("Explore");
  expect(screen.getByText("Explore body, top 0, bottom 0")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  // Out of sight, still there.
  expect(
    screen.getByText("Explore body, top 0, bottom 0", { includeHiddenElements: true }),
  ).toBeTruthy();
});

test("a page keeps what was typed while another is on screen", async () => {
  await render(<Shell built={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId("Draw-field"), "heart");
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByTestId("Draw-field")).toHaveDisplayValue("heart");
});

test("the tab of the page on screen touched again takes the page back, and no other", async () => {
  await render(<Shell built={jest.fn()} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByText("Draw touched again 1")).toBeOnTheScreen();
  expect(
    screen.getByText("Feed touched again 0", { includeHiddenElements: true }),
  ).toBeTruthy();
  // Touched from another page, it only shows it.
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(screen.getByText("Feed touched again 0")).toBeOnTheScreen();
});

test("the pages lie between the header and the bar: no edge of their own", async () => {
  await render(<Shell built={jest.fn()} />);
  expect(screen.getByText("Draw body, top 0, bottom 0")).toBeOnTheScreen();
});

test("on Android «back» goes to the page shown before, then leaves", async () => {
  const handlers: (() => boolean)[] = [];
  const spy = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_, handler) => {
      handlers.push(handler as () => boolean);
      return { remove: jest.fn() };
    });
  await render(<Shell built={jest.fn()} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  const back = handlers.at(-1);
  expect(back).toBeDefined();
  let handled: boolean | undefined;
  await act(() => {
    handled = back?.();
  });
  expect(handled).toBe(true);
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  await act(() => {
    handled = back?.();
  });
  expect(handled).toBe(true);
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  // The first page shown: the app goes.
  expect(back?.()).toBe(false);
  spy.mockRestore();
});

test("the tour moves between the pages by their names", async () => {
  await render(<Shell built={jest.fn()} />);
  expect(tourPager()?.shown()).toBe("Draw");
  await act(() => tourPager()?.show("Explore"));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
});

// The swipe between the pages (TASK-379, ADR-0323).

// The window of the tests (react-native's jest setup).
const WIDTH = 750;

/** The scroll of the strip at `place`, and `plus` points on. */
function at(place: number, plus = 0) {
  return { nativeEvent: { contentOffset: { x: place * WIDTH + plus, y: 0 } } };
}

function strip() {
  return screen.getByTestId("tab-pages");
}

function pageView(title: string) {
  return screen.getByTestId(`tab-page-${title}`, { includeHiddenElements: true });
}

function names(built: jest.Mock): string[] {
  return Array.from(new Set(built.mock.calls.map(([name]) => String(name))));
}

test("the page on screen lies between the one before and the one after", async () => {
  await render(<Shell built={jest.fn()} />);
  expect(pageView("Draw")).toHaveStyle({ left: STRIP_START * WIDTH, width: WIDTH });
  expect(pageView("Feed")).toHaveStyle({ left: (STRIP_START - 1) * WIDTH });
  // «Messages» waits there, empty until the swipe gets to it.
  expect(pageView("Messages")).toHaveStyle({ left: (STRIP_START + 1) * WIDTH });
  expect(
    screen.queryByText(/^Messages body/, { includeHiddenElements: true }),
  ).toBeNull();
  // Two swipes away: not built, not laid out.
  expect(
    screen.queryByTestId("tab-page-Explore", { includeHiddenElements: true }),
  ).toBeNull();
});

test("a swipe that comes to rest on the page beside shows it, and the bar follows", async () => {
  const built = jest.fn();
  await render(<Shell built={built} />);
  // The first pixels toward «Messages» build it: it slides in whole.
  await fireEvent.scroll(strip(), at(STRIP_START, 12));
  expect(names(built)).toEqual(["Feed", "Draw", "Messages"]);
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START + 1));
  expect(
    screen.getByRole("tab", { name: /^Messages/, selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Messages body, top 0, bottom 0")).toBeOnTheScreen();
  // «Explore» takes the place beyond, out of sight; «Draw» stays where it was.
  expect(pageView("Explore")).toHaveStyle({ left: (STRIP_START + 2) * WIDTH });
  expect(pageView("Draw")).toHaveStyle({ left: STRIP_START * WIDTH });
  expect(names(built)).not.toContain("Explore");
});

test("past half way the screen reader has the page beside; the bar waits for the rest", async () => {
  await render(<Shell built={jest.fn()} />);
  await fireEvent.scroll(strip(), at(STRIP_START, -0.6 * WIDTH));
  expect(screen.getByText(/^Feed body/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Draw body/)).toBeNull();
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  // Back before half way, nothing changed.
  await fireEvent.scroll(strip(), at(STRIP_START, -0.3 * WIDTH));
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START));
  expect(screen.getByText(/^Draw body/)).toBeOnTheScreen();
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
});

test("round and round: from the last page a swipe goes to the first, and back", async () => {
  await render(<Shell built={jest.fn()} first={3} />);
  expect(pageView("Feed")).toHaveStyle({ left: (STRIP_START + 1) * WIDTH });
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START + 1));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  // Beyond «Feed» lies «Draw»; before it, «Explore» still.
  expect(pageView("Draw")).toHaveStyle({ left: (STRIP_START + 2) * WIDTH });
  expect(pageView("Explore")).toHaveStyle({ left: STRIP_START * WIDTH });
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START - 1));
  expect(
    screen.getByRole("tab", { name: /^Messages/, selected: true }),
  ).toBeOnTheScreen();
});

test("a tab touched shows its page at once where the strip stands, and builds none between", async () => {
  const built = jest.fn();
  await render(<Shell built={built} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(pageView("Explore")).toHaveStyle({ left: STRIP_START * WIDTH });
  expect(screen.getByText(/^Explore body/)).toBeOnTheScreen();
  expect(names(built)).toEqual(["Feed", "Draw", "Explore"]);
  // And the swipe goes on from there: «Feed» after «Explore».
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START + 1));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
});

test("a page the app sends to instead comes at once where the swipe rested", async () => {
  // «Messages» without an account: the app shows another page.
  await render(<Shell built={jest.fn()} send={(index) => (index === 2 ? 3 : index)} />);
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START + 1));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  expect(pageView("Explore")).toHaveStyle({ left: (STRIP_START + 1) * WIDTH });
  expect(screen.getByText(/^Explore body/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Messages body/)).toBeNull();
});

test("a finger lifted right on a page counts, half way it waits for the rest", async () => {
  await render(<Shell built={jest.fn()} />);
  await fireEvent(strip(), "scrollEndDrag", at(STRIP_START, 0.5 * WIDTH));
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  await fireEvent(strip(), "scrollEndDrag", at(STRIP_START - 1, 0.4));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
});

test("a page keeps what was typed when the swipe goes away and back", async () => {
  await render(<Shell built={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId("Draw-field"), "heart");
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START - 1));
  await fireEvent(strip(), "momentumScrollEnd", at(STRIP_START));
  expect(screen.getByTestId("Draw-field")).toHaveDisplayValue("heart");
});

test("the strip goes one page a swipe, keeps the taps of an open keyboard and closes it", async () => {
  await render(<Shell built={jest.fn()} />);
  expect(strip()).toHaveProp("horizontal", true);
  expect(strip()).toHaveProp("pagingEnabled", true);
  expect(strip()).toHaveProp("bounces", false);
  expect(strip()).toHaveProp("keyboardShouldPersistTaps", "handled");
  expect(strip()).toHaveProp("keyboardDismissMode", "on-drag");
  // A touch on the clock scrolls the page up, not the strip.
  expect(strip()).toHaveProp("scrollsToTop", false);
  expect(strip()).toHaveProp("scrollEnabled", true);
});

test("with VoiceOver the pages go by the tabs only", async () => {
  const spy = jest
    .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
    .mockResolvedValue(true);
  await render(<Shell built={jest.fn()} />);
  await waitFor(() => expect(strip()).toHaveProp("scrollEnabled", false));
  // The tabs as before.
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  spy.mockRestore();
});
