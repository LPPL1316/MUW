import open from "@shaperoute/shared-types/fixtures/contest.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Contest, Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import { forgetContest } from "./contestKept";
import { useContest } from "./useContest";

const API = "http://api";
const SESSION = session as Session;
const OPEN = open as Contest;
const { mine: _mine, ...WITHOUT_MINE } = OPEN;

/** The API: `mine` only with a token, as the real one. */
const fetchFn: jest.Mock = jest.fn(async (_url: string, init?: RequestInit) => {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return Response.json(headers.Authorization === undefined ? WITHOUT_MINE : OPEN);
});

function wrapperFor(state: { current: AccountState }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FollowsContext.Provider
        value={{
          apiUrl: API,
          account: { state: state.current, sessionEnded: () => {} },
          openProfile: () => {},
        }}
      >
        {children}
      </FollowsContext.Provider>
    );
  };
}

afterEach(() => {
  forgetContest();
  fetchFn.mockClear();
});

test("asked when «Feed» is on the screen, not before", async () => {
  const state = { current: { status: "signedOut", notice: null } as AccountState };
  const { result, rerender } = await renderHook(
    ({ active }: { active: boolean }) => useContest(active, { fetchFn, key: null }),
    { initialProps: { active: false }, wrapper: wrapperFor(state) },
  );
  expect(fetchFn).not.toHaveBeenCalled();
  expect(result.current.contest).toBeNull();
  await rerender({ active: true });
  await waitFor(() => expect(result.current.contest).toEqual(WITHOUT_MINE));
  // Nobody signed in: no line of its own.
  expect(result.current.mine).toBeUndefined();
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("signing in asks again, for the account's best post; signing out hides it", async () => {
  const state = { current: { status: "signedOut", notice: null } as AccountState };
  const { result, rerender } = await renderHook(
    () => useContest(true, { fetchFn, key: null }),
    { wrapper: wrapperFor(state) },
  );
  await waitFor(() => expect(result.current.contest).not.toBeNull());
  state.current = { status: "signedIn", session: SESSION };
  await rerender({});
  await waitFor(() => expect(result.current.mine).toEqual(OPEN.mine));
  expect(fetchFn).toHaveBeenCalledTimes(2);
  state.current = { status: "signedOut", notice: null };
  await rerender({});
  expect(result.current.mine).toBeUndefined();
});

test("a refresh asks again", async () => {
  const state = { current: { status: "signedIn", session: SESSION } as AccountState };
  const { result } = await renderHook(() => useContest(true, { fetchFn, key: null }), {
    wrapper: wrapperFor(state),
  });
  await waitFor(() => expect(result.current.contest).not.toBeNull());
  await act(async () => result.current.refresh());
  expect(fetchFn).toHaveBeenCalledTimes(2);
});
