import me from "@shaperoute/shared-types/fixtures/game-me.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { answers, apiError, held } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import { forgetGameMe, useGameMe } from "./useGameMe";

beforeEach(forgetGameMe);

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };

type Props = { active?: boolean };

/** The hook inside «Profile»'s doors, with the account `state`. */
async function gameHook(
  fetchFn: jest.Mock,
  state: AccountState = SIGNED_IN,
  sessionEnded = jest.fn(),
  first: Props = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FollowsContext.Provider
      value={{ apiUrl: API, account: { state, sessionEnded }, openProfile: () => {} }}
    >
      {children}
    </FollowsContext.Provider>
  );
  return renderHook(
    ({ active = true }: Props) => useGameMe(active, { fetchFn, key: null }),
    { wrapper, initialProps: first },
  );
}

test("the game is asked with the token once the page is on screen", async () => {
  const { fetchFn, answer } = held();
  const { result, rerender } = await gameHook(fetchFn, SIGNED_IN, jest.fn(), {
    active: false,
  });
  expect(result.current.shown).toEqual({ status: "loading" });
  expect(fetchFn).not.toHaveBeenCalled();
  await rerender({ active: true });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(fetchFn.mock.calls[0][0]).toBe(`${API}/game/me`);
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
  await act(async () => answer(200, me));
  expect(result.current.shown).toEqual({ status: "ready", me });
});

test("without an account the game is off and nothing is asked", async () => {
  const fetchFn = answers();
  const { result } = await gameHook(fetchFn, SIGNED_OUT);
  expect(result.current.shown).toEqual({ status: "off" });
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the last answer is shown again at once, and asked for anew", async () => {
  const first = await gameHook(answers({ status: 200, body: me }));
  await waitFor(() => expect(first.result.current.shown.status).toBe("ready"));
  await first.unmount();
  const { fetchFn, answer } = held();
  const again = await gameHook(fetchFn);
  expect(again.result.current.shown).toEqual({ status: "ready", me });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const newer = { ...me, counted_m: 20000 };
  await act(async () => answer(200, newer));
  await waitFor(() =>
    expect(again.result.current.shown).toEqual({ status: "ready", me: newer }),
  );
});

test("an API that cannot be reached says so, and «Try again» asks again", async () => {
  const fetchFn = answers(new Error("offline"), { status: 200, body: me });
  const { result } = await gameHook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("failed"));
  expect(result.current.shown).toMatchObject({
    status: "failed",
    problem: expect.stringMatching(
      /^No connection\. Check the network and try again\./,
    ),
  });
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.shown).toEqual({ status: "ready", me }));
});

test("a session the API ended signs the account out", async () => {
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  const sessionEnded = jest.fn();
  const { result } = await gameHook(fetchFn, SIGNED_IN, sessionEnded);
  await waitFor(() => expect(sessionEnded).toHaveBeenCalledWith(SESSION.token));
  await waitFor(() =>
    expect(result.current.shown).toEqual({
      status: "failed",
      problem: "Your session has ended. Log in again.",
    }),
  );
});
