import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPage, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { DrawingsContext, useDrawingsDoor } from "../social/drawingsDoor";
import { FollowsContext } from "../social/followsDoor";
import { SearchScreen } from "./SearchScreen";
import { SEARCH_DELAY_MS } from "./useDrawingSearch";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The documents of the phone, in memory: the recent searches.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");
const API = "http://api";
const SIGNED_IN: AccountState = { status: "signedIn", session: session as Session };
const PAGE = feed as FeedPage;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  jest.useFakeTimers();
  files.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

/** The pause after the last letter. */
async function pause() {
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DELAY_MS);
  });
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByTestId("search-field"), text);
  await pause();
}

/** The ids of the drawings found, in their order. */
function found(): string[] {
  return within(screen.getByTestId("search-results"))
    .queryAllByTestId(/^result-/)
    .map((card) => String(card.props.testID).replace(/^result-/, ""));
}

async function open(
  props: Partial<{ onClose: () => void; onOpenExample: () => void }> = {},
  around: (children: ReactNode) => ReactNode = (children) => children,
) {
  const onClose = props.onClose ?? jest.fn();
  const onOpenExample = props.onOpenExample ?? jest.fn();
  await render(
    <>
      {around(<SearchScreen visible onClose={onClose} onOpenExample={onOpenExample} />)}
    </>,
  );
  return { onClose, onOpenExample };
}

test("before anything is typed: the categories and the featured drawings", async () => {
  await open();
  expect(screen.getByTestId("search-field").props.autoFocus).toBe(true);
  for (const name of ["Animals", "Hearts", "Symbols", "Emoji"]) {
    expect(screen.getByRole("button", { name })).toBeOnTheScreen();
  }
  // No API said it finds the words drawn: no «Words» (TASK-344 part B).
  expect(screen.queryByRole("button", { name: "Words" })).toBeNull();
  // The best scored examples first: without an account, there are only those.
  const best = [...SAMPLE_FEED].sort((a, b) => b.score - a.score)[0];
  expect(screen.getByTestId(`featured-${best.id}`)).toBeOnTheScreen();
  expect(screen.queryByText("Recent searches")).toBeNull();
  for (const tab of ["all", "drawings", "people", "routes"]) {
    expect(screen.getByTestId(`search-tab-${tab}`)).toBeOnTheScreen();
  }
});

test("words find the examples once the typing pauses; one opens as its route", async () => {
  const { onClose, onOpenExample } = await open();
  await fireEvent.changeText(screen.getByTestId("search-field"), "horse");
  // While the typing has not paused, the placeholders.
  expect(
    screen.getAllByTestId("search-skeleton", { includeHiddenElements: true }).length,
  ).toBeGreaterThan(0);
  await pause();
  const horses = SAMPLE_FEED.filter((post) => post.shape === "horse");
  expect(found()).toEqual(horses.map((post) => post.id));
  await fireEvent.press(screen.getByTestId(`result-${horses[0].id}`));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onOpenExample).toHaveBeenCalledWith(horses[0]);
});

test("a category chip asks its shapes, and its own chip takes it off", async () => {
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "Hearts" }));
  await pause();
  const hearts = SAMPLE_FEED.filter((post) => post.shape === "heart");
  expect(found()).toEqual(hearts.map((post) => post.id));
  await fireEvent.press(screen.getByTestId("search-category"));
  await pause();
  expect(screen.getByTestId("search-start")).toBeOnTheScreen();
});

test("the filters wait for «Apply», and their number is on the button", async () => {
  await open();
  await fireEvent.press(screen.getByTestId("search-filters"));
  await fireEvent.press(screen.getByTestId("filter-distance-10-30"));
  await fireEvent.press(screen.getByTestId("filter-sort-longest"));
  expect(screen.queryByTestId("search-filters-count")).toBeNull();
  expect(screen.getByText("Apply (2)")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("filter-apply"));
  await pause();
  expect(screen.getByTestId("search-filters-count")).toHaveTextContent("2");
  const longest = SAMPLE_FEED.filter(
    (post) => post.route_m >= 10_000 && post.route_m <= 30_000,
  )
    .sort((a, b) => b.route_m - a.route_m)
    .map((post) => post.id);
  expect(found()).toEqual(longest);
});

test("nothing found: the lens, the words, and the way to take the filters off", async () => {
  await open();
  await type("zzzz");
  expect(screen.getByText("No drawings found")).toBeOnTheScreen();
  expect(screen.getByText("Try other words, or change the filters.")).toBeOnTheScreen();
  // No filter on: nothing to take off.
  expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
});

test("a search touched is kept, the last first, and can be removed", async () => {
  await open();
  await type("star");
  await fireEvent(screen.getByTestId("search-field"), "submitEditing");
  await type("");
  expect(screen.getByText("Recent searches")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "star" }));
  await pause();
  expect(screen.getByTestId("search-field").props.value).toBe("star");
  await type("");
  await fireEvent.press(screen.getByRole("button", { name: "Remove star" }));
  expect(screen.queryByText("Recent searches")).toBeNull();
});

test("with an account, the members' drawings first; one opens on the map", async () => {
  fetchSpy.mockImplementation(async (input) => {
    const path = String(input).replace(API, "");
    if (path.startsWith("/search/drawings")) {
      return Response.json(PAGE);
    }
    return Response.json({ people: [] });
  });
  const opened = jest.fn();
  await open({}, (children) => (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state: SIGNED_IN, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      <Drawings open={opened}>{children}</Drawings>
    </FollowsContext.Provider>
  ));
  await type("star");
  const [first] = PAGE.posts;
  expect(screen.getByTestId(`result-${first.id}`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId(`result-${first.id}`));
  expect(opened).toHaveBeenCalledWith(first);
});

/** The search with an account, its API answering `page` to every search. */
async function openSignedIn(page: object) {
  fetchSpy.mockImplementation(async (input) => {
    const path = String(input).replace(API, "");
    return Response.json(path.startsWith("/search/drawings") ? page : { people: [] });
  });
  await open({}, (children) => (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state: SIGNED_IN, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      {children}
    </FollowsContext.Provider>
  ));
  await pause();
}

test("«Words» comes once the API says it finds the words drawn", async () => {
  await openSignedIn({ ...PAGE, words: true });
  await fireEvent.press(screen.getByRole("button", { name: "Words" }));
  await pause();
  const asked = fetchSpy.mock.calls.map(([url]) => String(url));
  expect(asked.some((url) => url.includes("shape=word"))).toBe(true);
});

test("an API before it hides «Words»: nothing wrong to show", async () => {
  // The server of before part B: the page without `words`.
  await openSignedIn(PAGE);
  expect(screen.getByRole("button", { name: "Hearts" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Words" })).toBeNull();
});

/** The drawings' door of the app, with `open` watched. */
function Drawings({ open, children }: { open: jest.Mock; children: ReactNode }) {
  const door = useDrawingsDoor();
  return (
    <DrawingsContext.Provider value={{ ...door, open }}>
      {children}
    </DrawingsContext.Provider>
  );
}
