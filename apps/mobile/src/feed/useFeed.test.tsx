import page from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { LatLon, Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { answers, apiError, held } from "../account/testing";
import { FollowsContext } from "../social/followsDoor";
import { forgetFeed, useFeed } from "./useFeed";

beforeEach(forgetFeed);

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const TRENTO: LatLon = [46.0671, 11.1214];
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

type Props = { active?: boolean; near?: LatLon | null; state?: AccountState };

/** The hook inside «Profile»'s doors, with the account `state`; `signIn`
 * changes the account for the next rerender. */
async function feedHook(
  fetchFn: jest.Mock,
  sessionEnded = jest.fn(),
  first: Props = {},
) {
  let state = first.state ?? SIGNED_IN;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FollowsContext.Provider
      value={{ apiUrl: API, account: { state, sessionEnded }, openProfile: () => {} }}
    >
      {children}
    </FollowsContext.Provider>
  );
  const hook = await renderHook(
    ({ active = true, near = null }: Props) => useFeed(active, near, options(fetchFn)),
    { wrapper, initialProps: first },
  );
  return {
    ...hook,
    signIn: (next: AccountState) => {
      state = next;
    },
  };
}

function asked(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url]) => String(url).replace(API, ""));
}

test("without an account the feed is off, and nothing is asked", async () => {
  const fetchFn = answers();
  const { result } = await feedHook(fetchFn, jest.fn(), { state: SIGNED_OUT });
  expect(result.current.shown).toEqual({ kind: "off" });
  expect(result.current.signedIn).toBe(false);
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the first page is asked once «Feed» is on the screen, from where the phone is", async () => {
  const { fetchFn, answer } = held();
  const { result, rerender } = await feedHook(fetchFn, jest.fn(), {
    active: false,
    near: TRENTO,
  });
  expect(result.current.shown).toEqual({ kind: "off" });
  expect(fetchFn).not.toHaveBeenCalled();
  await rerender({ active: true, near: TRENTO });
  expect(result.current.shown).toEqual({ kind: "loading" });
  expect(asked(fetchFn)).toEqual(["/feed?lat=46.07&lon=11.12"]);
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
  await act(async () => answer(200, page));
  expect(result.current.shown).toEqual({
    kind: "ready",
    posts: page.posts,
    next: page.next,
  });
  expect(result.current.signedIn).toBe(true);
  // Off the screen and back: not asked again.
  await rerender({ active: false, near: TRENTO });
  await rerender({ active: true, near: TRENTO });
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("the next page follows the cursor from the same point, and adds its posts", async () => {
  const second = { posts: [{ ...page.posts[1], id: "another" }], next: null };
  const fetchFn = answers({ status: 200, body: page }, { status: 200, body: second });
  const { result, rerender } = await feedHook(fetchFn, jest.fn(), { near: TRENTO });
  await waitFor(() => expect(result.current.shown.kind).toBe("ready"));
  // The phone moved meanwhile: the pages of this read keep the first point.
  await rerender({ near: [45.0, 10.0] });
  await act(async () => result.current.more());
  await waitFor(() =>
    expect(result.current.shown).toEqual({
      kind: "ready",
      posts: [...page.posts, second.posts[0]],
      next: null,
    }),
  );
  expect(asked(fetchFn)).toEqual([
    "/feed?lat=46.07&lon=11.12",
    `/feed?lat=46.07&lon=11.12&cursor=${page.next}`,
  ]);
  // No page left: nothing more is asked.
  await act(async () => result.current.more());
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("a page asked twice is asked once", async () => {
  const { fetchFn, answer } = held();
  const first = answers({ status: 200, body: page });
  const both = jest.fn((url: string, init?: RequestInit) =>
    String(url).includes("cursor") ? fetchFn(url, init) : first(url, init),
  );
  const { result } = await feedHook(both);
  await waitFor(() => expect(result.current.shown.kind).toBe("ready"));
  await act(async () => {
    result.current.more();
    result.current.more();
  });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(asked(both)).toEqual(["/feed", `/feed?cursor=${page.next}`]);
  await act(async () => answer(200, { posts: [], next: null }));
  expect(result.current.shown).toMatchObject({ kind: "ready", next: null });
});

test("a pull reads the first page again from where the phone is now; one that fails leaves the posts", async () => {
  const fetchFn = answers(
    { status: 200, body: page },
    { status: 200, body: { posts: [page.posts[1]], next: null } },
    new TypeError("Network request failed"),
  );
  const { result, rerender } = await feedHook(fetchFn);
  await waitFor(() => expect(result.current.shown.kind).toBe("ready"));
  await rerender({ near: TRENTO });
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.refreshing).toBe(false));
  expect(result.current.shown).toEqual({
    kind: "ready",
    posts: [page.posts[1]],
    next: null,
  });
  expect(asked(fetchFn)[1]).toBe("/feed?lat=46.07&lon=11.12");
  // Offline: the pull ends, the posts stay.
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.refreshing).toBe(false));
  expect(result.current.shown).toEqual({
    kind: "ready",
    posts: [page.posts[1]],
    next: null,
  });
  expect(fetchFn).toHaveBeenCalledTimes(3);
});

test("what was there stays while a pull reads", async () => {
  const { fetchFn, answer } = held();
  const first = answers({ status: 200, body: page });
  let pulls = 0;
  const both = jest.fn((url: string, init?: RequestInit) =>
    pulls++ === 0 ? first(url, init) : fetchFn(url, init),
  );
  const { result } = await feedHook(both);
  await waitFor(() => expect(result.current.shown.kind).toBe("ready"));
  await act(async () => result.current.refresh());
  expect(result.current.refreshing).toBe(true);
  expect(result.current.shown).toMatchObject({ kind: "ready", posts: page.posts });
  await act(async () => answer(200, { posts: [], next: null }));
  expect(result.current.refreshing).toBe(false);
  expect(result.current.shown).toEqual({ kind: "ready", posts: [], next: null });
});

test("an older API, or no network at the start, leaves the feed off; a pull asks again", async () => {
  const older = answers({ status: 404, body: apiError("http_error") });
  const { result } = await feedHook(older);
  await waitFor(() => expect(result.current.shown).toEqual({ kind: "off" }));
  expect(older).toHaveBeenCalledTimes(1);
  // Another opening of the app, offline this time.
  forgetFeed();
  const offline = answers(new TypeError("Network request failed"), {
    status: 200,
    body: page,
  });
  const { result: away } = await feedHook(offline);
  await waitFor(() => expect(away.current.shown).toEqual({ kind: "off" }));
  await act(async () => away.current.refresh());
  await waitFor(() => expect(away.current.shown.kind).toBe("ready"));
});

test("the session over: the account is told, the feed is off", async () => {
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  const sessionEnded = jest.fn();
  const { result } = await feedHook(fetchFn, sessionEnded);
  await waitFor(() => expect(sessionEnded).toHaveBeenCalledWith(SESSION.token));
  expect(result.current.shown).toEqual({ kind: "off" });
});

test("another account's feed is not this one's", async () => {
  const fetchFn = answers({ status: 200, body: page });
  const { result, rerender, signIn } = await feedHook(fetchFn);
  await waitFor(() => expect(result.current.shown.kind).toBe("ready"));
  // Signed out: off at once, nothing asked.
  signIn(SIGNED_OUT);
  await rerender({});
  expect(result.current.shown).toEqual({ kind: "off" });
  expect(result.current.signedIn).toBe(false);
  expect(fetchFn).toHaveBeenCalledTimes(1);
});
