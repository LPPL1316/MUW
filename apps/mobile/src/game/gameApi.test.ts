import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import run from "@shaperoute/shared-types/fixtures/game-run.json";

import { answers, apiError } from "../account/testing";
import { fetchGameCatalog, fetchGameMe, fetchRunGame, noGame } from "./gameApi";

const API = "http://api.test";
const TOKEN = "token-of-ada";

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

test("the catalog is asked without an account, with the app's key", async () => {
  const fetchFn = fake({ status: 200, body: catalog });
  const outcome = await fetchGameCatalog(API, { fetchFn, key: "the-key" });
  expect(outcome).toEqual({ kind: "ok", value: catalog });
  expect(fetchFn.mock.calls[0][0]).toBe(`${API}/game/catalog`);
  const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers["X-API-Key"]).toBe("the-key");
  expect(headers.Authorization).toBeUndefined();
});

test("an API before the game answers 404: no game", async () => {
  const fetchFn = fake({ status: 404, body: apiError("http_error") });
  const outcome = await fetchGameCatalog(API, { fetchFn, key: null });
  expect(noGame(outcome)).toBe(true);
});

test("an API that cannot be reached is not an API without the game", async () => {
  const fetchFn = fake(new Error("offline"));
  const outcome = await fetchGameCatalog(API, { fetchFn, key: null });
  expect(outcome.kind).toBe("unreachable");
  expect(noGame(outcome)).toBe(false);
});

test("a catalog that is not one is a bad answer", async () => {
  const fetchFn = fake({
    status: 200,
    body: { rules_version: 1, shapes: [{ id: 1 }] },
  });
  const outcome = await fetchGameCatalog(API, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "bad_answer", status: 200 });
});

test("the account's game and a run's are asked with the token", async () => {
  const fetchFn = fake({ status: 200, body: me }, { status: 200, body: run });
  expect(await fetchGameMe(API, TOKEN, { fetchFn, key: null })).toEqual({
    kind: "ok",
    value: me,
  });
  expect(
    await fetchRunGame(API, TOKEN, "7c2e91a4b05d3f68", { fetchFn, key: null }),
  ).toEqual({ kind: "ok", value: run });
  expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
    `${API}/game/me`,
    `${API}/game/runs/7c2e91a4b05d3f68`,
  ]);
  for (const call of fetchFn.mock.calls) {
    expect(call[1]).toMatchObject({ headers: { Authorization: `Bearer ${TOKEN}` } });
  }
});
