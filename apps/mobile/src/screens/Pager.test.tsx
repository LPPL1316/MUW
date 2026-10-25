import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { pageAt, Pager, type PagerPage, pagesInView } from "./Pager";

// The window of the tests (react-native's jest setup).
const WIDTH = 750;

/** A page that says it was built, and the top edge it was given. */
function Body({ name, built }: { name: string; built: jest.Mock }) {
  built(name);
  return <Text>{`${name} body, top inset ${useSafeAreaInsets().top}`}</Text>;
}

function threePages(built: jest.Mock): PagerPage[] {
  return [
    { title: "Feed", render: () => <Body name="Feed" built={built} /> },
    { title: "Draw", render: () => <Body name="Draw" built={built} /> },
    {
      title: "Explore",
      lazy: true,
      render: () => <Body name="Explore" built={built} />,
    },
  ];
}

/** And the account's profile after «Explore», not named in the header
 * (TASK-278). */
function fourPages(built: jest.Mock): PagerPage[] {
  return [
    ...threePages(built),
    {
      title: "Profile",
      unnamed: true,
      lazy: true,
      render: () => <Body name="Profile" built={built} />,
    },
  ];
}

function pager(
  page: number,
  onPage: (index: number) => void,
  built = jest.fn(),
  pages = threePages,
) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <Pager pages={pages(built)} page={page} onPage={onPage} />
    </SafeAreaProvider>
  );
}

function at(x: number) {
  return { nativeEvent: { contentOffset: { x, y: 0 } } };
}

function names(built: jest.Mock): string[] {
  return Array.from(new Set(built.mock.calls.map(([name]) => String(name))));
}

test("a scroll offset rests on the nearest page, within the pages", () => {
  expect(pageAt(0, 390, 3)).toBe(0);
  expect(pageAt(389.6, 390, 3)).toBe(1);
  expect(pageAt(600, 390, 3)).toBe(2);
  expect(pageAt(-40, 390, 3)).toBe(0);
  expect(pageAt(5000, 390, 3)).toBe(2);
  // Before the window is measured there is one page: the first.
  expect(pageAt(100, 0, 3)).toBe(0);
});

test("a scroll offset shows the page it rests on, or the two it is between", () => {
  expect(pagesInView(390, 390, 3)).toEqual([1]);
  // A scroll at rest is never exactly on the page.
  expect(pagesInView(389.7, 390, 3)).toEqual([1]);
  expect(pagesInView(390.4, 390, 3)).toEqual([1]);
  expect(pagesInView(400, 390, 3)).toEqual([1, 2]);
  expect(pagesInView(200, 390, 3)).toEqual([0, 1]);
  expect(pagesInView(900, 390, 3)).toEqual([2]);
  expect(pagesInView(100, 0, 3)).toEqual([]);
});

test("shows the names of the pages in order, and which one is on screen", async () => {
  await render(pager(1, jest.fn()));
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(
    ["Feed", "Draw", "Explore"],
  );
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.getByRole("tab", { name: "Feed", selected: false })).toBeOnTheScreen();
  // The page on screen is the one a screen reader finds.
  expect(screen.getByText(/^Draw body/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Feed body/)).toBeNull();
  expect(screen.getByText(/^Feed body/, { includeHiddenElements: true })).toBeTruthy();
});

test("the header keeps the top edge: the pages start under it", async () => {
  await render(pager(1, jest.fn()));
  expect(screen.getByText("Draw body, top inset 0")).toBeOnTheScreen();
});

test("a page that asks as it opens is not built until someone goes there", async () => {
  const built = jest.fn();
  await render(pager(1, jest.fn(), built));
  expect(names(built)).toEqual(["Feed", "Draw"]);
  // A swipe toward «Feed» builds nothing more.
  await fireEvent.scroll(screen.getByTestId("pager"), at(WIDTH - 60));
  expect(names(built)).toEqual(["Feed", "Draw"]);
  // The first pixels toward «Explore» build it: it slides in whole.
  await fireEvent.scroll(screen.getByTestId("pager"), at(WIDTH + 12));
  expect(names(built)).toEqual(["Feed", "Draw", "Explore"]);
});

test("a page that joins the row later leaves the pages built in place (TASK-296)", async () => {
  const built = jest.fn();
  const { rerender } = await render(pager(3, jest.fn(), built, fourPages));
  expect(names(built)).toEqual(["Feed", "Draw", "Profile"]);
  // «Play» comes between «Explore» and the profile, which moves one place.
  const withPlay = (b: jest.Mock): PagerPage[] => [
    ...threePages(b),
    { title: "Play", lazy: true, render: () => <Body name="Play" built={b} /> },
    ...fourPages(b).slice(3),
  ];
  built.mockClear();
  await rerender(pager(4, jest.fn(), built, withPlay));
  // The profile is still there, «Play» not built until someone goes there.
  expect(names(built)).toEqual(["Feed", "Draw", "Profile"]);
  expect(screen.getByText("Profile body, top inset 0")).toBeOnTheScreen();
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(
    ["Feed", "Draw", "Explore", "Play"],
  );
});

test("a swipe that comes to rest on another page says which", async () => {
  const onPage = jest.fn();
  await render(pager(1, onPage));
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", at(2 * WIDTH));
  expect(onPage).toHaveBeenCalledWith(2);
  // Back where it started is no news.
  onPage.mockClear();
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", at(WIDTH));
  expect(onPage).not.toHaveBeenCalled();
});

test("a finger lifted right on a page counts, half way it waits for the rest", async () => {
  const onPage = jest.fn();
  await render(pager(1, onPage));
  await fireEvent(screen.getByTestId("pager"), "scrollEndDrag", at(WIDTH / 2));
  expect(onPage).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId("pager"), "scrollEndDrag", at(0));
  expect(onPage).toHaveBeenCalledWith(0);
});

test("touching a name asks for its page, which is built before it slides in", async () => {
  const built = jest.fn();
  const onPage = jest.fn();
  const shown = await render(pager(1, onPage, built));
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(onPage).toHaveBeenCalledWith(2);
  expect(names(built)).toEqual(["Feed", "Draw"]);
  // The app says yes: the page is there, and it is the one on screen.
  await shown.rerender(pager(2, onPage, built));
  expect(names(built)).toEqual(["Feed", "Draw", "Explore"]);
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText(/^Explore body/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Draw body/)).toBeNull();
});

test("a fourth page without a name: a swipe to the left from «Explore» shows it, one to the right goes back", async () => {
  const built = jest.fn();
  const onPage = jest.fn();
  const shown = await render(pager(2, onPage, built, fourPages));
  // Three names in the header, as before.
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(
    ["Feed", "Draw", "Explore"],
  );
  expect(names(built)).toEqual(["Feed", "Draw", "Explore"]);
  // The first pixels toward it build it, and it comes to rest on screen.
  await fireEvent.scroll(screen.getByTestId("pager"), at(2 * WIDTH + 12));
  expect(names(built)).toEqual(["Feed", "Draw", "Explore", "Profile"]);
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", at(3 * WIDTH));
  expect(onPage).toHaveBeenCalledWith(3);
  await shown.rerender(pager(3, onPage, built, fourPages));
  expect(screen.getByText(/^Profile body/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Explore body/)).toBeNull();
  // No name is lit: the page has none.
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.queryByRole("tab", { selected: true })).toBeNull();

  onPage.mockClear();
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", at(2 * WIDTH));
  expect(onPage).toHaveBeenCalledWith(2);
  await shown.rerender(pager(2, onPage, built, fourPages));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  // Out of sight, out of the screen reader's too.
  expect(screen.queryByText(/^Profile body/)).toBeNull();
  expect(
    screen.getByText(/^Profile body/, { includeHiddenElements: true }),
  ).toBeTruthy();
});

test("the last page is the last: a swipe beyond it rests on it", async () => {
  const onPage = jest.fn();
  await render(pager(3, onPage, jest.fn(), fourPages));
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", at(4 * WIDTH));
  expect(onPage).not.toHaveBeenCalled();
});
