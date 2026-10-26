import challenge from "@shaperoute/shared-types/fixtures/game-challenge.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { GameChallenge, Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { answers, apiError, held } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import { forgetChallenges, keepChallenge, useChallenge } from "./useChallenge";

const API = "http://api";
const EVERY_MS = 1000;
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const GOING = challenge as GameChallenge;
const DONE: GameChallenge = {
  ...GOING,
  status: "completed",
  completed_at: "2026-10-27T10:00:00Z",
};
const ended = jest.fn();

let appState: (next: AppStateStatus) => void = () => {};
const removeAppState = jest.fn();

type Props = { id: string | null };

async function hook(
  fetchFn: jest.Mock,
  state: AccountState = SIGNED_IN,
  id: string | null = GOING.id,
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: ended },
        openProfile: () => {},
      }}
    >
      {children}
    </FollowsContext.Provider>
  );
  return renderHook(
    ({ id }: Props) => useChallenge(id, { fetchFn, key: null, everyMs: EVERY_MS }),
    { wrapper, initialProps: { id } },
  );
}

function calls(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url, init]) => `${init.method} ${url}`);
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetChallenges();
  ended.mockReset();
  removeAppState.mockReset();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appState = listener;
    return { remove: removeAppState };
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("the challenge is read with the token as it opens", async () => {
  const { fetchFn, answer } = held();
  const { result } = await hook(fetchFn);
  expect(result.current.shown).toEqual({ status: "loading" });
  await act(async () => answer(200, GOING));
  expect(result.current.shown).toEqual({ status: "ready", challenge: GOING });
  expect(calls(fetchFn)).toEqual([`GET ${API}/game/challenges/${GOING.id}`]);
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
});

test("without an account, or without a challenge, it is off and nothing is asked", async () => {
  const fetchFn = answers();
  const out = await hook(fetchFn, { status: "signedOut", notice: null });
  expect(out.result.current.shown).toEqual({ status: "off" });
  const none = await hook(fetchFn, SIGNED_IN, undefined);
  expect(none.result.current.shown).toEqual({ status: "off" });
  await act(async () => jest.advanceTimersByTime(3 * EVERY_MS));
  expect(fetchFn).not.toHaveBeenCalled();
});

test("it is read again every 15 s while it is going, and stops when it is over", async () => {
  const newer: GameChallenge = {
    ...GOING,
    pieces: GOING.pieces.map((piece) =>
      piece.idx === 1 ? { ...piece, done_m: 3100 } : piece,
    ),
  };
  const fetchFn = answers(
    { status: 200, body: GOING },
    { status: 200, body: newer },
    { status: 200, body: DONE },
    { status: 200, body: DONE },
  );
  const { result, unmount } = await hook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  await act(async () => jest.advanceTimersByTime(EVERY_MS));
  await waitFor(() =>
    expect(result.current.shown).toEqual({ status: "ready", challenge: newer }),
  );
  await act(async () => jest.advanceTimersByTime(EVERY_MS));
  await waitFor(() =>
    expect(result.current.shown).toEqual({ status: "ready", challenge: DONE }),
  );
  // Complete: nothing more to read.
  await act(async () => jest.advanceTimersByTime(5 * EVERY_MS));
  expect(fetchFn).toHaveBeenCalledTimes(3);
  await unmount();
  expect(removeAppState).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(5 * EVERY_MS));
  expect(fetchFn).toHaveBeenCalledTimes(3);
});

test("in the background nothing is read; back in front it is read at once", async () => {
  const fetchFn = answers(
    { status: 200, body: GOING },
    { status: 200, body: GOING },
    { status: 200, body: GOING },
  );
  const { result } = await hook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  await act(async () => appState("background"));
  await act(async () => jest.advanceTimersByTime(4 * EVERY_MS));
  expect(fetchFn).toHaveBeenCalledTimes(1);
  await act(async () => appState("active"));
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  await act(async () => jest.advanceTimersByTime(EVERY_MS));
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(3));
});

test("what the team's list said of it shows at once, while the API answers", async () => {
  keepChallenge(GOING);
  const { fetchFn, answer } = held();
  const { result } = await hook(fetchFn);
  expect(result.current.shown).toEqual({ status: "ready", challenge: GOING });
  await act(async () => answer(200, DONE));
  expect(result.current.shown).toEqual({ status: "ready", challenge: DONE });
});

test("a piece is taken and left; a refusal says why and reads the challenge again", async () => {
  const mine: GameChallenge = {
    ...GOING,
    pieces: GOING.pieces.map((piece) =>
      piece.idx === 2
        ? { ...piece, holder: { public_id: "me", username: "Runner_42" } }
        : piece,
    ),
  };
  const fetchFn = answers(
    { status: 200, body: GOING },
    { status: 200, body: mine },
    { status: 200, body: GOING },
    { status: 409, body: apiError("http_error", "Someone holds this piece already.") },
    { status: 200, body: mine },
  );
  const { result } = await hook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  let problem: string | null = "?";
  await act(async () => {
    problem = await result.current.hold(2);
  });
  expect(problem).toBeNull();
  expect(result.current.shown).toEqual({ status: "ready", challenge: mine });
  await act(async () => {
    problem = await result.current.release(2);
  });
  expect(problem).toBeNull();
  expect(result.current.shown).toEqual({ status: "ready", challenge: GOING });
  await act(async () => {
    problem = await result.current.hold(2);
  });
  expect(problem).toBe("Someone holds this piece already.");
  await waitFor(() =>
    expect(result.current.shown).toEqual({ status: "ready", challenge: mine }),
  );
  expect(calls(fetchFn)).toEqual([
    `GET ${API}/game/challenges/${GOING.id}`,
    `POST ${API}/game/challenges/${GOING.id}/pieces/2/hold`,
    `DELETE ${API}/game/challenges/${GOING.id}/pieces/2/hold`,
    `POST ${API}/game/challenges/${GOING.id}/pieces/2/hold`,
    `GET ${API}/game/challenges/${GOING.id}`,
  ]);
});

test("without a network the last answer stays; without one the words, and «Try again»", async () => {
  const fetchFn = answers(
    { status: 200, body: GOING },
    new Error("offline"),
    new Error("offline"),
    { status: 200, body: GOING },
  );
  const { result, unmount } = await hook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  await act(async () => jest.advanceTimersByTime(EVERY_MS));
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  expect(result.current.shown).toEqual({ status: "ready", challenge: GOING });
  await unmount();
  forgetChallenges();
  const alone = await hook(fetchFn);
  await waitFor(() => expect(alone.result.current.shown.status).toBe("failed"));
  expect(alone.result.current.shown).toMatchObject({
    problem: expect.stringMatching(/^No connection\./),
  });
  await act(async () => alone.result.current.refresh());
  await waitFor(() => expect(alone.result.current.shown.status).toBe("ready"));
});

test("a session the API ended signs the account out", async () => {
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  await hook(fetchFn);
  await waitFor(() => expect(ended).toHaveBeenCalledWith(SESSION.token));
});
