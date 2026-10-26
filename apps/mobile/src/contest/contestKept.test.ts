import closed from "@shaperoute/shared-types/fixtures/contest-closed.json";
import open from "@shaperoute/shared-types/fixtures/contest.json";
import type { Contest } from "@shaperoute/shared-types";

import { answers, apiError, held } from "../account/testing";
import {
  askContestOnce,
  CONTEST_FILE,
  forgetContest,
  keepContest,
  keptContest,
  loadContest,
  refreshContest,
  subscribeContest,
  winnerDrawingId,
} from "./contestKept";

// The phone's documents folder, in memory: the contest kept.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const API = "http://api.test";
const TOKEN = "token-of-ada";
const ADA = "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13";
const OPEN = open as Contest;
const CLOSED = closed as Contest;

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

afterEach(() => {
  forgetContest();
});

test("a phone that never heard from the API has no contest", () => {
  expect(keptContest()).toBeNull();
  expect(loadContest()).toBeNull();
});

test("the contest the API answers is shown and kept, with whom it was asked for", async () => {
  const told = jest.fn();
  subscribeContest(told);
  await refreshContest(API, TOKEN, ADA, {
    fetchFn: fake({ status: 200, body: OPEN }),
    key: null,
  });
  expect(keptContest()).toEqual({ account: ADA, contest: OPEN });
  expect(told).toHaveBeenCalled();
  // On the phone, for the next opening.
  expect(loadContest()).toEqual({ account: ADA, contest: OPEN });
});

test("asked without a token, it is nobody's", async () => {
  await refreshContest(API, null, ADA, {
    fetchFn: fake({ status: 200, body: OPEN }),
    key: null,
  });
  expect(keptContest()?.account).toBeNull();
});

test("a 404 forgets the contest kept: no card", async () => {
  keepContest({ account: null, contest: OPEN });
  await refreshContest(API, null, null, {
    fetchFn: fake({ status: 404, body: apiError("no_contest") }),
    key: null,
  });
  expect(keptContest()).toBeNull();
  expect(loadContest()).toBeNull();
});

test("without a network, or with an API that fails, the last answer stands", async () => {
  keepContest({ account: null, contest: OPEN });
  await refreshContest(API, null, null, {
    fetchFn: fake(new Error("offline")),
    key: null,
  });
  expect(keptContest()?.contest).toEqual(OPEN);
  await refreshContest(API, null, null, {
    fetchFn: fake({ status: 503, body: apiError("accounts_unavailable") }),
    key: null,
  });
  expect(keptContest()?.contest).toEqual(OPEN);
  await refreshContest(API, null, null, {
    fetchFn: fake({ status: 200, body: { id: "not a contest" } }),
    key: null,
  });
  expect(keptContest()?.contest).toEqual(OPEN);
});

test("without an API nothing is asked", async () => {
  const fetchFn = fake();
  await refreshContest(null, TOKEN, ADA, { fetchFn, key: null });
  expect(fetchFn).not.toHaveBeenCalled();
  expect(keptContest()).toBeNull();
});

test("an answer that comes after a newer request's is not kept", async () => {
  const slow = held();
  const first = refreshContest(API, null, null, {
    fetchFn: slow.fetchFn as unknown as jest.Mock,
    key: null,
  });
  await refreshContest(API, TOKEN, ADA, {
    fetchFn: fake({ status: 200, body: CLOSED }),
    key: null,
  });
  slow.answer(404, apiError("no_contest"));
  await first;
  expect(keptContest()?.contest).toEqual(CLOSED);
});

test("asked once per account while the app is open", async () => {
  const fetchFn = jest.fn(async () => Response.json(OPEN));
  await askContestOnce(API, null, null, { fetchFn, key: null });
  await askContestOnce(API, null, null, { fetchFn, key: null });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  // Signed in: asked again, for `mine`.
  await askContestOnce(API, TOKEN, ADA, { fetchFn, key: null });
  await askContestOnce(API, TOKEN, ADA, { fetchFn, key: null });
  expect(fetchFn).toHaveBeenCalledTimes(2);
  // A pull asks whatever was asked before.
  await refreshContest(API, TOKEN, ADA, { fetchFn, key: null });
  expect(fetchFn).toHaveBeenCalledTimes(3);
});

test("a file kept that is not a contest is nothing", () => {
  const { File, Paths } =
    jest.requireMock<typeof import("expo-file-system")>("expo-file-system");
  const file = new File(Paths.document, CONTEST_FILE);
  file.create();
  file.write(JSON.stringify(OPEN));
  // The answer alone, without whom it was asked for, is not what is kept.
  expect(loadContest()).toBeNull();
  file.write("{");
  expect(loadContest()).toBeNull();
});

test("the winning drawing is the closed contest's, never the open one's", () => {
  expect(winnerDrawingId(null)).toBeNull();
  expect(winnerDrawingId({ account: null, contest: OPEN })).toBeNull();
  expect(winnerDrawingId({ account: null, contest: CLOSED })).toBe(
    "3f9d2c71-8a4b-4e06-b5d1-c27e9a40f815",
  );
  expect(
    winnerDrawingId({
      account: null,
      contest: { ...CLOSED, winner: { reactions: 0, drawing: null } },
    }),
  ).toBeNull();
});
