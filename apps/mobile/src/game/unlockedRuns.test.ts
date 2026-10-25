import run from "@shaperoute/shared-types/fixtures/game-run.json";

import { answers, apiError } from "../account/testing";
import { tellUnlocked } from "./unlockedRuns";
import { onUnlocked } from "./unlocks";

const API = "http://api.test";
const KEY = "7c2e91a4b05d3f68";

/** The fake fetch, as the request takes it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

let told: jest.Mock;
let stop: () => void;

beforeEach(() => {
  told = jest.fn();
  stop = onUnlocked(told);
});

afterEach(() => stop());

test("a run the API counted tells of the shapes it unlocked, with when it was kept", async () => {
  const fetchFn = fake({ status: 200, body: run });
  await tellUnlocked(API, "token", KEY, 1234, { fetchFn, key: null });
  expect(fetchFn.mock.calls[0][0]).toBe(`${API}/game/runs/${KEY}`);
  expect(told).toHaveBeenCalledWith({ shapeIds: ["triangle"], keptAt: 1234 });
});

test("a run that unlocked nothing tells nothing", async () => {
  const fetchFn = fake({ status: 200, body: { ...run, unlocked: [] } });
  await tellUnlocked(API, "token", KEY, null, { fetchFn, key: null });
  expect(told).not.toHaveBeenCalled();
});

test("an API before the game, or one that cannot be reached, tells nothing", async () => {
  await tellUnlocked(API, "token", KEY, null, {
    fetchFn: fake({ status: 404, body: apiError("http_error") }),
    key: null,
  });
  await tellUnlocked(API, "token", KEY, null, {
    fetchFn: fake(new Error("offline")),
    key: null,
  });
  expect(told).not.toHaveBeenCalled();
});
