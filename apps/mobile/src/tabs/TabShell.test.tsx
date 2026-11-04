import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { BackHandler, Text, TextInput } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { tourPager } from "../tour/tourParts";
import { TabShell, type ShellPage } from "./TabShell";
import { useTabReselect } from "./tabReselect";

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

/** The shell as App holds it: the page on screen is the app's. */
function Shell({ built, first = 1 }: { built: jest.Mock; first?: number }) {
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
        onPage={setPage}
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
