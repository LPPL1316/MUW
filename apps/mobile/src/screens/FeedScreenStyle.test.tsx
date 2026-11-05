/**
 * MuW Style in «Feed» (TASK-384, ADR-0326): while the API has Style posts,
 * one in «All» after the 7th drawing and never in «Following», and a tab
 * «Style» with all of them, its filters and its pages, with an account or
 * without; turned off in «Settings», none in «All», still in «Style»; from
 * an API without Style, the Feed is as before.
 */
import page from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import stylePost from "@shaperoute/shared-types/fixtures/style-post.json";
import type { FeedPost, Session, StylePost } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { saveFeedTab } from "../feed/feedTabChoice";
import { forgetStyleInFeed, saveStyleInFeed } from "../feed/styleInFeedChoice";
import { forgetFeed } from "../feed/useFeed";
import { forgetStylePosts } from "../feed/useStylePosts";
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
jest.mock("expo-file-system", () => {
  class MockFile {
    get exists() {
      return false;
    }
    create() {}
    write() {}
    textSync() {
      return "";
    }
  }
  return { File: MockFile, Paths: { document: "doc" } };
});

const API = "http://api";
const SIGNED_IN: AccountState = { status: "signedIn", session: session as Session };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const [STAR] = page.posts as FeedPost[];
const STYLE = stylePost as StylePost;
const TRAIL: StylePost = {
  ...STYLE,
  id: "MS-037",
  theme: "trail",
  gender: "women",
  title: { ...STYLE.title, en: "Alpine trail day" },
};
// Ten drawings: room for a Style post after the 7th.
const DRAWINGS: FeedPost[] = Array.from({ length: 10 }, (_, i) => ({
  ...STAR,
  id: `d${i}`,
}));

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let style: unknown;

function asked(prefix: string): string[] {
  return fetchSpy.mock.calls
    .map(([url]) => String(url).replace(API, ""))
    .filter((path) => path.startsWith(prefix));
}

function Around({
  children,
  state = SIGNED_IN,
}: {
  children: ReactNode;
  state?: AccountState;
}) {
  return (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      <PeopleContext.Provider value={{ open: () => {} }}>
        {children}
      </PeopleContext.Provider>
    </FollowsContext.Provider>
  );
}

beforeEach(() => {
  forgetFeed();
  forgetStylePosts();
  forgetStyleInFeed();
  saveFeedTab("all");
  style = { posts: [STYLE, TRAIL], before: null };
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("filter=following")) {
      return Response.json({
        posts: DRAWINGS,
        next: null,
        filter: "following",
        follows_anyone: true,
      });
    }
    if (url.startsWith(`${API}/feed`)) {
      return Response.json({ posts: DRAWINGS, next: null, filter: "all" });
    }
    if (url.startsWith(`${API}/style?`)) {
      const theme = new URL(url).searchParams.get("theme");
      const body = style as { posts: StylePost[]; before: null };
      return Response.json(
        theme === null
          ? body
          : { ...body, posts: body.posts.filter((p) => p.theme === theme) },
      );
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => fetchSpy.mockRestore());

const hidden = { includeHiddenElements: true };

test("one Style post in «All», after the 7th drawing, and a tab «Style»", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Style");
  const list = screen.getByTestId("feed-list");
  const rows = list.props.data as { kind: string }[];
  expect(rows.map((row) => row.kind).indexOf("style")).toBe(7);
  expect(rows.filter((row) => row.kind === "style")).toHaveLength(1);
  expect(asked("/style")).toEqual(["/style?limit=20"]);
});

test("never in «Following»", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Style");
  await fireEvent.press(screen.getByText("Following"));
  await waitFor(() =>
    expect(screen.getByTestId("feed-list-following").props.data).toHaveLength(10),
  );
  const rows = screen.getByTestId("feed-list-following").props.data as {
    kind: string;
  }[];
  expect(rows.every((row) => row.kind === "post")).toBe(true);
});

test("the tab «Style» has them all, with its filters", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await fireEvent.press(await screen.findByText("Style"));
  expect(await screen.findByText("Alpine trail day")).toBeOnTheScreen();
  expect(screen.getAllByTestId("style-post")).toHaveLength(2);
  expect(saveFeedTab).toHaveBeenLastCalledWith("style");
  await fireEvent.press(screen.getByText("Trail"));
  await waitFor(() => expect(screen.getAllByTestId("style-post")).toHaveLength(1));
  expect(asked("/style")).toContain("/style?theme=trail&limit=20");
  // «All» is hidden, not gone.
  expect(screen.getByTestId("feed-list", hidden)).toBeTruthy();
});

test("without an account the tabs are «All» and «Style»", async () => {
  await render(
    <Around state={SIGNED_OUT}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("Style")).toBeOnTheScreen();
  expect(screen.getByText("All")).toBeOnTheScreen();
  expect(screen.queryByText("Following")).toBeNull();
});

test("turned off in «Settings», none in «All», still all in «Style»", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Style");
  await act(() => saveStyleInFeed(false));
  const rows = screen.getByTestId("feed-list").props.data as { kind: string }[];
  expect(rows.some((row) => row.kind === "style")).toBe(false);
  await fireEvent.press(screen.getByText("Style"));
  expect(await screen.findAllByTestId("style-post")).toHaveLength(2);
});

test("from an API without Style posts, no tab and no card", async () => {
  style = { posts: [], before: null };
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await waitFor(() => expect(asked("/style")).toHaveLength(1));
  await waitFor(() =>
    expect(screen.getByTestId("feed-list").props.data).toHaveLength(10),
  );
  expect(screen.queryByText("Style")).toBeNull();
  expect(screen.queryByTestId("style-post")).toBeNull();
});
