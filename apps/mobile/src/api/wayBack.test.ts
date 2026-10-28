import wayBackRequest from "@shaperoute/shared-types/fixtures/way-back-request.json";
import answered from "@shaperoute/shared-types/fixtures/way-back.json";
import type { WayBack, WayBackRequest } from "@shaperoute/shared-types";

import { PHONE_HEADER } from "../engine/prefetch";
import { isWayBack, requestWayBack } from "./wayBack";

jest.mock("expo-file-system", () => jest.requireActual("../engine/memoryFiles"));

const URL = "http://192.168.1.23:8000";
// The fixtures are the contract: they must fit the types as they are.
const REQUEST = wayBackRequest as WayBackRequest;
const WAY = answered as WayBack;

function answering(status: number, body: unknown) {
  return jest.fn(async () => Response.json(body, { status }));
}

test("sends where the runner is and the stretch, and gets the way back", async () => {
  const fetchFn = answering(200, answered);
  const outcome = await requestWayBack(URL, REQUEST, {
    fetchFn,
    key: null,
    phone: "0123456789abcdef0123456789abcdef",
  });
  expect(outcome).toEqual({ kind: "way", way: WAY });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${URL}/way-back`);
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual(wayBackRequest);
  expect(init.headers).toMatchObject({
    [PHONE_HEADER]: "0123456789abcdef0123456789abcdef",
  });
  expect(WAY.directions.map((d) => d.turn)).toEqual(["depart", "right", "left"]);
});

test("without a phone id no header is sent", async () => {
  const fetchFn = answering(200, answered);
  await requestWayBack(URL, REQUEST, { fetchFn, key: null });
  const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(Object.keys(init.headers as object)).not.toContain(PHONE_HEADER);
});

test("no way back, or too many asked, is the API's error", async () => {
  for (const [status, code] of [
    [422, "invalid_request"],
    [429, "too_many_requests"],
    [503, "map_data_unavailable"],
  ] as const) {
    const error = {
      error: { code, message: "no", suggested_distance_m: null, reason: null },
    };
    const outcome = await requestWayBack(URL, REQUEST, {
      fetchFn: answering(status, error),
      key: null,
    });
    expect(outcome).toEqual({ kind: "api_error", ...error.error });
  }
});

test("an API older than the way back answers 404", async () => {
  // FastAPI's own 404, and the API's http_error.
  expect(
    await requestWayBack(URL, REQUEST, {
      fetchFn: answering(404, { detail: "Not Found" }),
      key: null,
    }),
  ).toEqual({ kind: "bad_answer", status: 404 });
  expect(
    await requestWayBack(URL, REQUEST, {
      fetchFn: answering(404, {
        error: { code: "http_error", message: "Not Found" },
      }),
      key: null,
    }),
  ).toMatchObject({ kind: "api_error", code: "http_error" });
});

test("no API is unreachable, a cancelled request is cancelled", async () => {
  const failing = jest.fn(async () => {
    throw new Error("Network request failed");
  });
  expect(await requestWayBack(URL, REQUEST, { fetchFn: failing, key: null })).toEqual({
    kind: "unreachable",
    url: URL,
  });
  const controller = new AbortController();
  controller.abort();
  expect(
    await requestWayBack(URL, REQUEST, {
      fetchFn: failing,
      key: null,
      signal: controller.signal,
    }),
  ).toEqual({ kind: "cancelled" });
});

test("an answer that is not a way is a bad answer", async () => {
  expect(
    await requestWayBack(URL, REQUEST, {
      fetchFn: answering(200, { points: [] }),
      key: null,
    }),
  ).toEqual({ kind: "bad_answer", status: 200 });
});

test("a way has its points, where it rejoins and its directions", () => {
  expect(isWayBack(answered)).toBe(true);
  expect(isWayBack({ ...answered, rejoin: [46] })).toBe(false);
  expect(isWayBack({ ...answered, points: [[46, "11"]] })).toBe(false);
  expect(isWayBack({ ...answered, directions: [{ turn: "left" }] })).toBe(false);
  expect(isWayBack(null)).toBe(false);
});
