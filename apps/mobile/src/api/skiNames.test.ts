import skiNames from "@shaperoute/shared-types/fixtures/ski-names.json";

import { answers, apiError } from "../account/testing";
import { fetchSkiNames, isSkiNames } from "./skiNames";

const URL = "http://api";
const TOKEN = "the-token";
const ID = "0b8f8a1e-7c1d-4d2a-9f3e-2a6c5b4d3e21";
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

test("the example of the API is what the app reads", () => {
  expect(isSkiNames(skiNames)).toBe(true);
  expect(isSkiNames({ lifts: [], pistes: [] })).toBe(true);
});

test("a body that is not the names is not read", () => {
  const use = { name: "Pista Rossa", type: "intermediate", times: 2 };
  expect(isSkiNames(null)).toBe(false);
  expect(isSkiNames({ lifts: [] })).toBe(false);
  expect(isSkiNames({ lifts: [use], pistes: [{ ...use, times: 0 }] })).toBe(false);
  expect(isSkiNames({ lifts: [use], pistes: [{ ...use, times: 1.5 }] })).toBe(false);
  expect(isSkiNames({ lifts: [{ ...use, name: "" }], pistes: [] })).toBe(false);
  expect(isSkiNames({ lifts: [{ ...use, type: null }], pistes: [] })).toBe(false);
});

test("the names are asked by the drawing's id, saying the app reads skiing", async () => {
  const fetchFn = answers({ status: 200, body: skiNames });
  expect(await fetchSkiNames(URL, TOKEN, ID, options(fetchFn))).toEqual({
    kind: "ok",
    value: skiNames,
  });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/drawings/${ID}/ski-names`);
  const headers = init?.headers as Record<string, string>;
  expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  expect(headers["X-MuW-Reads"].split(",")).toContain("skiing");
});

test("a drawing the API does not give is an error, not names", async () => {
  const fetchFn = answers({ status: 404, body: apiError("not_found") });
  const outcome = await fetchSkiNames(URL, TOKEN, ID, options(fetchFn));
  expect(outcome.kind).toBe("api_error");
});
