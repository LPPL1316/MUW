import challenge from "@shaperoute/shared-types/fixtures/game-challenge.json";
import team from "@shaperoute/shared-types/fixtures/game-team.json";

import { answers, apiError } from "../account/testing";
import { saveLanguageChoice } from "../i18n/language";
import {
  createChallenge,
  createTeam,
  fetchChallenge,
  fetchTeams,
  holdPiece,
  isChallenge,
  isTeam,
  isTeams,
  joinTeam,
  noTeams,
  releasePiece,
  removeMember,
  teamProblem,
} from "./teamsApi";

const API = "http://api";
const TOKEN = "tok";
const withChallenge = { ...team, challenge };

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

afterEach(() => saveLanguageChoice("phone"));

function sent(fetchFn: jest.Mock): { url: string; method: string; body: unknown } {
  const [url, init] = fetchFn.mock.calls[0];
  return {
    url,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(init.body),
  };
}

test("the API's examples are a team and a challenge", () => {
  expect(isTeam(team)).toBe(true);
  expect(isTeam(withChallenge)).toBe(true);
  expect(isTeams({ teams: [team, withChallenge] })).toBe(true);
  expect(isChallenge(challenge)).toBe(true);
  expect(isChallenge({ ...challenge, status: "paused" })).toBe(false);
  expect(isChallenge({ ...challenge, pieces: [{ idx: 0 }] })).toBe(false);
  expect(isTeam({ ...team, members: [{ username: "x" }] })).toBe(false);
  expect(isTeams({ teams: [{}] })).toBe(false);
});

test("a team is created with its name, with the token", async () => {
  const fetchFn = fake({ status: 201, body: team });
  const outcome = await createTeam(
    API,
    TOKEN,
    { name: "Trento runners" },
    { fetchFn, key: null },
  );
  expect(outcome).toEqual({ kind: "ok", value: team });
  expect(sent(fetchFn)).toEqual({
    url: `${API}/game/teams`,
    method: "POST",
    body: { name: "Trento runners" },
  });
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
});

test("a team is joined with its code", async () => {
  const fetchFn = fake({ status: 200, body: team });
  const outcome = await joinTeam(
    API,
    TOKEN,
    { code: "k7pq2m" },
    { fetchFn, key: null },
  );
  expect(outcome).toEqual({ kind: "ok", value: team });
  expect(sent(fetchFn)).toEqual({
    url: `${API}/game/teams/join`,
    method: "POST",
    body: { code: "k7pq2m" },
  });
});

test("the teams are read, and a member is removed with no body back", async () => {
  const fetchFn = fake(
    { status: 200, body: { teams: [withChallenge] } },
    { status: 204 },
  );
  const teams = await fetchTeams(API, TOKEN, { fetchFn, key: null });
  expect(teams).toEqual({ kind: "ok", value: { teams: [withChallenge] } });
  const gone = await removeMember(API, TOKEN, team.id, team.members[1].public_id, {
    fetchFn,
    key: null,
  });
  expect(gone).toEqual({ kind: "ok", value: null });
  expect(fetchFn.mock.calls[1][0]).toBe(
    `${API}/game/teams/${team.id}/members/${team.members[1].public_id}`,
  );
  expect(fetchFn.mock.calls[1][1].method).toBe("DELETE");
});

test("a challenge is created, read, and its pieces are taken and left", async () => {
  const fetchFn = fake(
    { status: 201, body: challenge },
    { status: 200, body: challenge },
    { status: 200, body: challenge },
    { status: 200, body: challenge },
  );
  const request = {
    shape_id: "hexagon",
    pieces: 3,
    piece: { kind: "distance" as const, total_m: 5000 },
    days: 7,
  };
  expect(
    await createChallenge(API, TOKEN, team.id, request, { fetchFn, key: null }),
  ).toEqual({ kind: "ok", value: challenge });
  expect(sent(fetchFn)).toEqual({
    url: `${API}/game/teams/${team.id}/challenges`,
    method: "POST",
    body: request,
  });
  expect(
    await fetchChallenge(API, TOKEN, challenge.id, { fetchFn, key: null }),
  ).toEqual({
    kind: "ok",
    value: challenge,
  });
  await holdPiece(API, TOKEN, challenge.id, 2, { fetchFn, key: null });
  await releasePiece(API, TOKEN, challenge.id, 2, { fetchFn, key: null });
  const calls = fetchFn.mock.calls.map(([url, init]) => `${init.method} ${url}`);
  expect(calls.slice(1)).toEqual([
    `GET ${API}/game/challenges/${challenge.id}`,
    `POST ${API}/game/challenges/${challenge.id}/pieces/2/hold`,
    `DELETE ${API}/game/challenges/${challenge.id}/pieces/2/hold`,
  ]);
});

test("an API before the teams answers 404 to the teams: no teams, not an error", async () => {
  const fetchFn = fake({ status: 404, body: apiError("http_error", "Not found") });
  const outcome = await fetchTeams(API, TOKEN, { fetchFn, key: null });
  expect(noTeams(outcome)).toBe(true);
  expect(noTeams({ kind: "unreachable", url: API })).toBe(false);
  expect(noTeams({ kind: "ok", value: { teams: [] } })).toBe(false);
});

test("the API's refusals are said in the app's language, the unknown ones as they are", () => {
  const failed = (
    code: "http_error" | "comment_rejected" | "invalid_request" | "session_expired",
    message: string,
  ) => ({
    kind: "api_error" as const,
    code,
    message,
    suggested_distance_m: null,
    reason: null,
    retryAfterS: null,
  });
  expect(teamProblem(failed("http_error", "You can't join this team."))).toBe(
    "You can't join this team.",
  );
  expect(teamProblem(failed("http_error", "No team with this code."))).toBe(
    "No team with this code.",
  );
  expect(teamProblem(failed("http_error", "Someone holds this piece already."))).toBe(
    "Someone holds this piece already.",
  );
  expect(teamProblem(failed("comment_rejected", "…"))).toBe(
    "This name is not allowed. Choose another one.",
  );
  expect(teamProblem(failed("invalid_request", "The name is empty."))).toBe(
    "The name is empty.",
  );
  expect(teamProblem(failed("session_expired", "…"))).toBe(
    "Your session has ended. Log in again.",
  );
  expect(teamProblem({ kind: "unreachable", url: API })).toMatch(/^No connection\./);
  saveLanguageChoice("it");
  expect(teamProblem(failed("http_error", "You can't join this team."))).toBe(
    "Non puoi entrare in questa squadra.",
  );
  expect(teamProblem(failed("http_error", "No team with this code."))).toBe(
    "Nessuna squadra con questo codice.",
  );
});
