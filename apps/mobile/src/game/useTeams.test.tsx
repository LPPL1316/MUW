import session from "@shaperoute/shared-types/fixtures/session.json";
import team from "@shaperoute/shared-types/fixtures/game-team.json";
import type { GameTeam, Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { answers, apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import { forgetTeams, useTeams } from "./useTeams";

beforeEach(forgetTeams);

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const TEAM = team as GameTeam;
const OTHER: GameTeam = {
  ...TEAM,
  id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  name: "Night owls",
  code: "ZZ9988",
};
const ME = SESSION.user.public_id as string;
const ADAM = TEAM.members[1].public_id;

type Props = { active?: boolean };

async function teamsHook(
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
    ({ active = true }: Props) => useTeams(active, { fetchFn, key: null }),
    { wrapper, initialProps: first },
  );
}

function calls(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url, init]) => `${init.method} ${url}`);
}

test("without an account the teams are off and nothing is asked", async () => {
  const fetchFn = answers();
  const { result } = await teamsHook(fetchFn, SIGNED_OUT);
  expect(result.current.shown).toEqual({ status: "off" });
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the teams are asked with the token once the tab is on screen", async () => {
  const fetchFn = answers({ status: 200, body: { teams: [TEAM] } });
  const { result, rerender } = await teamsHook(fetchFn, SIGNED_IN, jest.fn(), {
    active: false,
  });
  expect(result.current.shown).toEqual({ status: "loading" });
  expect(fetchFn).not.toHaveBeenCalled();
  await rerender({ active: true });
  await waitFor(() =>
    expect(result.current.shown).toEqual({ status: "ready", teams: [TEAM] }),
  );
  expect(calls(fetchFn)).toEqual([`GET ${API}/game/teams`]);
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
});

test("an API without the teams yet is no error: there are none", async () => {
  const fetchFn = answers({ status: 404, body: apiError("http_error", "Not Found") });
  const { result } = await teamsHook(fetchFn);
  await waitFor(() => expect(result.current.shown).toEqual({ status: "none" }));
});

test("without a network the last list stays, and an error shows only without one", async () => {
  const first = await teamsHook(answers({ status: 200, body: { teams: [TEAM] } }));
  await waitFor(() => expect(first.result.current.shown.status).toBe("ready"));
  await first.unmount();
  const again = await teamsHook(answers(new Error("offline")));
  expect(again.result.current.shown).toEqual({ status: "ready", teams: [TEAM] });
  await act(async () => {});
  expect(again.result.current.shown).toEqual({ status: "ready", teams: [TEAM] });
  forgetTeams();
  const alone = await teamsHook(
    answers(new Error("offline"), { status: 200, body: { teams: [] } }),
  );
  await waitFor(() => expect(alone.result.current.shown.status).toBe("failed"));
  expect(alone.result.current.shown).toMatchObject({
    problem: expect.stringMatching(/^No connection\./),
  });
  await act(async () => alone.result.current.refresh());
  await waitFor(() =>
    expect(alone.result.current.shown).toEqual({ status: "ready", teams: [] }),
  );
});

test("a team created goes into the list at once, and the list is read again", async () => {
  const fetchFn = answers(
    { status: 200, body: { teams: [] } },
    { status: 201, body: TEAM },
    { status: 200, body: { teams: [TEAM] } },
  );
  const { result } = await teamsHook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  let done: Awaited<ReturnType<typeof result.current.create>> | null = null;
  await act(async () => {
    done = await result.current.create("Trento runners");
  });
  expect(done).toEqual({ ok: true, value: TEAM });
  expect(JSON.parse(String(fetchFn.mock.calls[1][1]?.body))).toEqual({
    name: "Trento runners",
  });
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(3));
  expect(result.current.shown).toEqual({ status: "ready", teams: [TEAM] });
});

test("joining: a code nobody has, a team that cannot be joined, a team joined", async () => {
  const fetchFn = answers(
    { status: 200, body: { teams: [TEAM] } },
    { status: 404, body: apiError("http_error", "No team with this code.") },
    { status: 403, body: apiError("http_error", "You can't join this team.") },
    { status: 200, body: OTHER },
    { status: 200, body: { teams: [TEAM, OTHER] } },
  );
  const { result } = await teamsHook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  let done: Awaited<ReturnType<typeof result.current.join>> | null = null;
  await act(async () => {
    done = await result.current.join("ABCDEF");
  });
  expect(done).toEqual({ ok: false, problem: "No team with this code." });
  await act(async () => {
    done = await result.current.join("ABCDEF");
  });
  // Blocked, full or too many teams: the same words, without the reason.
  expect(done).toEqual({ ok: false, problem: "You can't join this team." });
  await act(async () => {
    done = await result.current.join("zz9988");
  });
  expect(done).toEqual({ ok: true, value: OTHER });
  expect(JSON.parse(String(fetchFn.mock.calls[3][1]?.body))).toEqual({
    code: "zz9988",
  });
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(5));
  expect(result.current.shown).toEqual({ status: "ready", teams: [TEAM, OTHER] });
});

test("leaving takes the team out of the list; the owner removing takes the member out", async () => {
  const without = { ...TEAM, members: [TEAM.members[0]] };
  const fetchFn = answers(
    { status: 200, body: { teams: [TEAM, OTHER] } },
    { status: 204 },
    { status: 200, body: { teams: [without, OTHER] } },
    { status: 204 },
    { status: 200, body: { teams: [without] } },
  );
  const { result } = await teamsHook(fetchFn);
  await waitFor(() => expect(result.current.shown.status).toBe("ready"));
  await act(async () => {
    await result.current.remove(TEAM.id, ADAM);
  });
  expect(calls(fetchFn)[1]).toBe(`DELETE ${API}/game/teams/${TEAM.id}/members/${ADAM}`);
  expect(result.current.shown).toMatchObject({
    teams: [{ id: TEAM.id, members: [TEAM.members[0]] }, OTHER],
  });
  await act(async () => {
    await result.current.remove(OTHER.id, ME);
  });
  expect(calls(fetchFn)[3]).toBe(`DELETE ${API}/game/teams/${OTHER.id}/members/${ME}`);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(5));
  expect(result.current.shown).toEqual({ status: "ready", teams: [without] });
});

test("a session the API ended signs the account out", async () => {
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  const sessionEnded = jest.fn();
  const { result } = await teamsHook(fetchFn, SIGNED_IN, sessionEnded);
  await waitFor(() => expect(sessionEnded).toHaveBeenCalledWith(SESSION.token));
  await waitFor(() =>
    expect(result.current.shown).toEqual({
      status: "failed",
      problem: "Your session has ended. Log in again.",
    }),
  );
});
