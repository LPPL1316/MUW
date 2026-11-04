import feed from "@shaperoute/shared-types/fixtures/feed.json";
import people from "@shaperoute/shared-types/fixtures/people.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPage, Session } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { apiError } from "../account/testing";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { FollowsContext } from "../social/followsDoor";
import { NO_FILTERS, type SearchFilters } from "./searchFilters";
import { queryOf, SEARCH_DELAY_MS, useDrawingSearch } from "./useDrawingSearch";

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const PAGE = feed as FeedPage;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** The fake API, by path: the answer of each, or a status with an error. */
function api(routes: Record<string, () => Response>) {
  return jest.fn(async (url: string) => {
    const path = String(url).replace(API, "");
    const key = Object.keys(routes).find((each) => path.startsWith(each));
    if (key === undefined) {
      throw new Error(`Not in this test: ${path}`);
    }
    return routes[key]();
  });
}

type Props = { typed: string; filters: SearchFilters };

async function searchHook(
  fetchFn: jest.Mock,
  state: AccountState = SIGNED_IN,
  sessionEnded = jest.fn(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FollowsContext.Provider
      value={{ apiUrl: API, account: { state, sessionEnded }, openProfile: () => {} }}
    >
      {children}
    </FollowsContext.Provider>
  );
  return renderHook(
    ({ typed, filters }: Props) =>
      useDrawingSearch(typed, filters, { fetchFn, key: null }),
    { wrapper, initialProps: { typed: "", filters: NO_FILTERS } },
  );
}

/** The pause after the last letter, and the answers it brings. */
async function pause() {
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DELAY_MS);
  });
}

function asked(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url]) => String(url).replace(API, ""));
}

test("the query of the API: the shapes the words name, the category, the band", () => {
  expect(
    queryOf("cuore", {
      ...NO_FILTERS,
      category: "hearts",
      distance: "10-30",
      sort: "longest",
    }),
  ).toMatchObject({
    q: "cuore",
    shapes: ["heart"],
    minM: 10_000,
    maxM: 30_000,
    sort: "longest",
  });
});

test("one request once the typing pauses, not one per letter", async () => {
  const fetchFn = api({
    "/search/drawings": () => Response.json(PAGE),
    "/users?q=": () => Response.json(people),
  });
  const { result, rerender } = await searchHook(fetchFn);
  await pause();
  fetchFn.mockClear();
  for (const typed of ["s", "st", "sta", "star"]) {
    await rerender({ typed, filters: NO_FILTERS });
  }
  expect(result.current.waiting).toBe(true);
  expect(fetchFn).not.toHaveBeenCalled();
  await pause();
  expect(asked(fetchFn).sort()).toEqual([
    "/search/drawings?q=star&named=star",
    "/users?q=star",
  ]);
  expect(result.current.waiting).toBe(false);
  expect(result.current.members).toMatchObject({ kind: "ready", posts: PAGE.posts });
  // The fixture is of an API before part B: it does not say `words`.
  expect(result.current.wordsKnown).toBe(false);
  expect(result.current.people).toEqual({ kind: "ready", people: people.people });
  // The examples are found on the phone, at once with the pause.
  expect(result.current.examples.every((post) => post.shape === "star")).toBe(true);
  expect(result.current.examples.length).toBeGreaterThan(0);
});

test("the next page joins the first, and is asked once", async () => {
  const first = { ...PAGE, next: "recent-1-00000000000000000000000000000001" };
  const fetchFn = api({
    "/search/drawings?cursor=": () =>
      Response.json({ ...PAGE, posts: PAGE.posts.slice(0, 1) }),
    "/search/drawings": () => Response.json(first),
  });
  const { result } = await searchHook(fetchFn);
  await pause();
  expect(result.current.members).toMatchObject({ kind: "ready", next: first.next });
  await act(async () => {
    result.current.more();
    result.current.more();
  });
  expect(asked(fetchFn).filter((path) => path.includes("cursor="))).toHaveLength(1);
  expect(result.current.members).toMatchObject({
    kind: "ready",
    posts: [...PAGE.posts, PAGE.posts[0]],
    next: PAGE.next,
  });
});

test("without an account, or with an API before the search: the examples only", async () => {
  const signedOut = await searchHook(api({}), SIGNED_OUT);
  await pause();
  expect(signedOut.result.current.members).toEqual({ kind: "off" });
  expect(signedOut.result.current.people).toEqual({ kind: "off" });
  expect(signedOut.result.current.examples).toHaveLength(SAMPLE_FEED.length);

  const older = await searchHook(
    api({
      "/search/drawings": () => Response.json(apiError("http_error"), { status: 404 }),
    }),
  );
  await pause();
  expect(older.result.current.members).toEqual({ kind: "off" });
});

test("a session ended says so to the account, and stops asking", async () => {
  const sessionEnded = jest.fn();
  const fetchFn = api({
    "/search/drawings": () =>
      Response.json(apiError("session_expired"), { status: 401 }),
  });
  const { result } = await searchHook(fetchFn, SIGNED_IN, sessionEnded);
  await pause();
  expect(sessionEnded).toHaveBeenCalledWith(SESSION.token);
  expect(result.current.members).toEqual({ kind: "off" });
});
