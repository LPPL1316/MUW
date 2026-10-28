import type { RouteRequest } from "@shaperoute/shared-types";
import answer from "@shaperoute/shared-types/fixtures/kept-routes.json";
import asked from "@shaperoute/shared-types/fixtures/kept-routes-request.json";

import { queueOutcome, requestKeptRoutes } from "./keptRoutes";

/** POST /kept-routes (TASK-316): only what the API keeps, nothing drawn. */

const API = "http://api.test";
const requests = asked.requests as RouteRequest[];

function answering(body: unknown, status = 200) {
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(Response.json(body, { status })),
  );
}

test("the requests go in one POST, and each gets its route or null", async () => {
  const fetchFn = answering(answer);
  const outcome = await requestKeptRoutes(API, requests, {
    fetchFn: fetchFn as never,
    apiKey: null,
  });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${API}/kept-routes`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ requests });
  expect(outcome.kind).toBe("kept");
  if (outcome.kind === "kept") {
    expect(outcome.routes[0]?.shape).toBe("heart");
    expect(outcome.routes[1]).toBeNull();
  }
});

test("an API without the endpoint says so, and is not an error", async () => {
  const outcome = await requestKeptRoutes(API, requests, {
    fetchFn: answering({ detail: "Not Found" }, 404) as never,
  });
  expect(outcome).toEqual({ kind: "not_here" });
  expect(queueOutcome(outcome)).toEqual({ kind: "cancelled" });
});

test("too many requests reaches the app's queue, which waits a minute", async () => {
  const error = { error: { code: "too_many_requests", message: "Slow down" } };
  const outcome = await requestKeptRoutes(API, requests, {
    fetchFn: answering(error, 429) as never,
  });
  expect(outcome).toMatchObject({ kind: "api_error", code: "too_many_requests" });
  expect(queueOutcome(outcome)).toBe(outcome);
});

test("no network, an aborted request and an answer of another length", async () => {
  const offline = jest.fn(() =>
    Promise.reject(new TypeError("Network request failed")),
  );
  expect(await requestKeptRoutes(API, requests, { fetchFn: offline as never })).toEqual(
    {
      kind: "unreachable",
      url: API,
    },
  );
  const controller = new AbortController();
  controller.abort();
  expect(
    await requestKeptRoutes(API, requests, {
      fetchFn: offline as never,
      signal: controller.signal,
    }),
  ).toEqual({ kind: "cancelled" });
  expect(
    await requestKeptRoutes(API, requests, {
      fetchFn: answering({ routes: [null] }) as never,
    }),
  ).toEqual({ kind: "bad_answer", status: 200 });
});

test("nothing to ask asks nothing; a route that does not read is null", async () => {
  const fetchFn = answering(answer);
  expect(await requestKeptRoutes(API, [], { fetchFn: fetchFn as never })).toEqual({
    kind: "kept",
    routes: [],
  });
  expect(fetchFn).not.toHaveBeenCalled();
  const odd = await requestKeptRoutes(API, requests, {
    fetchFn: answering({ routes: [{ points: "no" }, null] }) as never,
  });
  expect(odd).toEqual({ kind: "kept", routes: [null, null] });
});

test("a turn this version does not know reads as straight", async () => {
  const route = answer.routes[0] as { directions: { turn: string }[] };
  const newer = {
    routes: [
      { ...route, directions: route.directions.map((d) => ({ ...d, turn: "hop" })) },
      null,
    ],
  };
  const outcome = await requestKeptRoutes(API, requests, {
    fetchFn: answering(newer) as never,
  });
  expect(outcome.kind).toBe("kept");
  if (outcome.kind === "kept") {
    expect(outcome.routes[0]?.directions.every((d) => d.turn === "straight")).toBe(
      true,
    );
  }
});
