/**
 * The tabs of «Feed» (TASK-362, ADR-0308): each reads for itself, on the
 * server; going from one to the other asks nothing again and keeps the list
 * built; the empty pages, the choice kept, and no tabs without an account.
 */
import page from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPost, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { loadFeedTab, saveFeedTab } from "../feed/feedTabChoice";
import { forgetFeed } from "../feed/useFeed";
import { FollowsContext } from "../social/followsDoor";
import { PeopleContext } from "../social/peopleDoor";
import { FeedScreen } from "./FeedScreen";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../feed/feedTabChoice", () => {
  let kept = "all";
  return {
    loadFeedTab: jest.fn(() => kept),
    saveFeedTab: jest.fn((tab: string) => {
      kept = tab;
    }),
  };
});

const API = "http://api";
const SIGNED_IN: AccountState = { status: "signedIn", session: session as Session };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const [STAR, WORD] = page.posts as FeedPost[];

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let following: unknown;

function asked(): string[] {
  return (
    fetchSpy.mock.calls
      .map(([url]) => String(url).replace(API, ""))
      // The contest's card and MuW Style (TASK-384) are read beside the feed.
      .filter((path) => path !== "/contests/current" && !path.startsWith("/style"))
  );
}

function Around({
  children,
  state = SIGNED_IN,
  findPeople = () => {},
}: {
  children: ReactNode;
  state?: AccountState;
  findPeople?: () => void;
}) {
  return (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      <PeopleContext.Provider value={{ open: findPeople }}>
        {children}
      </PeopleContext.Provider>
    </FollowsContext.Provider>
  );
}

beforeEach(() => {
  forgetFeed();
  saveFeedTab("all");
  following = { posts: [WORD], next: null, filter: "following", follows_anyone: true };
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("filter=following")) {
      return Response.json(following);
    }
    if (url.startsWith(`${API}/feed`)) {
      return Response.json({ posts: [STAR], next: null, filter: "all" });
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => fetchSpy.mockRestore());

test("going from tab to tab asks each once and leaves both lists built", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Sunday heart by the river");
  expect(asked()).toEqual(["/feed?filter=all"]);
  // «Following» is not read until it is opened.
  expect(screen.queryByTestId("feed-list-following")).toBeNull();
  await fireEvent.press(screen.getByText("Following"));
  expect(await screen.findByText("adam.trento")).toBeOnTheScreen();
  expect(asked()).toEqual(["/feed?filter=all", "/feed?filter=following"]);
  // Hidden, not gone: the same list keeps its place.
  const hidden = { includeHiddenElements: true };
  const list = screen.getByTestId("feed-list", hidden);
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Following"));
  expect(screen.getByTestId("feed-list", hidden)).toBe(list);
  expect(asked()).toHaveLength(2);
  expect(saveFeedTab).toHaveBeenLastCalledWith("following");
});

test("a pull reads only the tab on the screen", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Sunday heart by the river");
  await fireEvent.press(screen.getByText("Following"));
  await screen.findByText("adam.trento");
  fetchSpy.mockClear();
  const { refreshControl } = screen.getByTestId("feed-list-following").props;
  await refreshControl.props.onRefresh();
  await waitFor(() => expect(asked()).toEqual(["/feed?filter=following"]));
});

test("the tab chosen last opens again, and it alone is read", async () => {
  saveFeedTab("following");
  expect(loadFeedTab()).toBe("following");
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("adam.trento")).toBeOnTheScreen();
  expect(asked()).toEqual(["/feed?filter=following"]);
});

test("following nobody: says so, offers to find people, and shows no example", async () => {
  following = { posts: [], next: null, filter: "following", follows_anyone: false };
  saveFeedTab("following");
  const findPeople = jest.fn();
  await render(
    <Around findPeople={findPeople}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("feed-no-follows")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Find people to follow"));
  expect(findPeople).toHaveBeenCalled();
  expect(screen.queryByText(SAMPLE_FEED[0].user)).toBeNull();
});

test("following nobody with drawings of one's own: those, under the same offer", async () => {
  following = { posts: [WORD], next: null, filter: "following", follows_anyone: false };
  saveFeedTab("following");
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("adam.trento")).toBeOnTheScreen();
  expect(screen.getByTestId("feed-follow-nudge")).toBeOnTheScreen();
});

test("following people who have published nothing has its own words", async () => {
  following = { posts: [], next: null, filter: "following", follows_anyone: true };
  saveFeedTab("following");
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("feed-no-posts")).toBeOnTheScreen();
  expect(
    screen.getByText("The people you follow have not published anything yet."),
  ).toBeOnTheScreen();
});

test("without an account: no tabs, only the examples, whatever was chosen", async () => {
  saveFeedTab("following");
  await render(
    <Around state={SIGNED_OUT}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(screen.queryByText("Following")).toBeNull();
  expect(screen.queryByTestId("feed-list-following")).toBeNull();
  expect(await screen.findByText(SAMPLE_FEED[0].user)).toBeOnTheScreen();
  expect(asked()).toEqual([]);
});

test("an API before the tabs: the feed it sends, without tabs, whatever was chosen", async () => {
  saveFeedTab("following");
  // It ignores `filter` and sends the feed of before, without saying a tab.
  following = { posts: [WORD], next: null };
  fetchSpy.mockImplementation(async (input) => {
    const url = String(input);
    return url.startsWith(`${API}/feed`)
      ? Response.json({ posts: [STAR, WORD], next: null })
      : Response.json({ error: { code: "http_error", message: url } }, { status: 404 });
  });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("Sunday heart by the river")).toBeOnTheScreen();
  expect(screen.queryByText("Following")).toBeNull();
  expect(screen.queryByTestId("feed-list-following")).toBeNull();
  // The chosen tab asked first; then «All», which shows the feed of before.
  expect(asked()).toEqual(["/feed?filter=following", "/feed?filter=all"]);
});
