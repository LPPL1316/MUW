import closed from "@shaperoute/shared-types/fixtures/contest-closed.json";
import open from "@shaperoute/shared-types/fixtures/contest.json";

import { answers, apiError } from "../account/testing";
import { fetchContest, isContest, noContest } from "./contestApi";

const API = "http://api.test";
const TOKEN = "token-of-ada";

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

test("the contest is asked without an account, with the app's key", async () => {
  const { mine: _mine, ...withoutMine } = open;
  const fetchFn = fake({ status: 200, body: withoutMine });
  const outcome = await fetchContest(API, null, { fetchFn, key: "the-key" });
  expect(outcome).toEqual({ kind: "ok", value: withoutMine });
  expect(fetchFn.mock.calls[0][0]).toBe(`${API}/contests/current`);
  const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers["X-API-Key"]).toBe("the-key");
  expect(headers.Authorization).toBeUndefined();
});

test("with a token, it goes with the request: the answer has `mine`", async () => {
  const fetchFn = fake({ status: 200, body: open });
  const outcome = await fetchContest(API, TOKEN, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: open });
  const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
});

test("a closed contest, with its winner, is one", () => {
  expect(isContest(closed)).toBe(true);
  // Its winning run deleted since: no drawing.
  expect(isContest({ ...closed, winner: { reactions: 0, drawing: null } })).toBe(true);
  // Without a token `mine` is missing; with one, null without a post.
  expect(isContest({ ...open, mine: null })).toBe(true);
});

test.each([
  ["no id", { ...open, id: 7 }],
  ["an end that is no moment", { ...open, ends_at: "soon" }],
  ["a closing that is no moment", { ...open, closed_at: 3 }],
  ["no list of the first", { ...open, top: null }],
  [
    "one of the first without its drawing",
    { ...open, top: [{ rank: 1, reactions: 2 }] },
  ],
  [
    "a drawing without its author",
    {
      ...open,
      top: [{ ...open.top[0], drawing: { ...open.top[0].drawing, author: null } }],
    },
  ],
  [
    "a best post without its place",
    { ...open, mine: { drawing_id: "d", reactions: 1 } },
  ],
  ["a winner without its reactions", { ...closed, winner: { drawing: null } }],
])("an answer with %s is no contest", async (_what, body) => {
  expect(isContest(body)).toBe(false);
  const fetchFn = fake({ status: 200, body });
  const outcome = await fetchContest(API, null, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "bad_answer", status: 200 });
});

test("404 no_contest, and the 404 of an API from before the contest: no contest", async () => {
  const none = await fetchContest(API, null, {
    fetchFn: fake({ status: 404, body: apiError("no_contest") }),
    key: null,
  });
  expect(noContest(none)).toBe(true);
  const before = await fetchContest(API, null, {
    fetchFn: fake({ status: 404, body: apiError("http_error") }),
    key: null,
  });
  expect(noContest(before)).toBe(true);
});

test("an API that cannot be reached, or fails, is not an API without a contest", async () => {
  const offline = await fetchContest(API, null, {
    fetchFn: fake(new Error("offline")),
    key: null,
  });
  expect(offline.kind).toBe("unreachable");
  expect(noContest(offline)).toBe(false);
  const failing = await fetchContest(API, null, {
    fetchFn: fake({ status: 503, body: apiError("accounts_unavailable") }),
    key: null,
  });
  expect(noContest(failing)).toBe(false);
  const ended = await fetchContest(API, TOKEN, {
    fetchFn: fake({ status: 401, body: apiError("not_signed_in") }),
    key: null,
  });
  expect(noContest(ended)).toBe(false);
});
