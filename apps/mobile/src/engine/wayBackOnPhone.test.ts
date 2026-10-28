import wayBackRequest from "@shaperoute/shared-types/fixtures/way-back-request.json";
import answered from "@shaperoute/shared-types/fixtures/way-back.json";
import type { ApiErrorCode, WayBack, WayBackRequest } from "@shaperoute/shared-types";

import type { requestWayBack, WayBackOutcome } from "../api/wayBack";
import type { PhoneEngine, PlanAnswer } from "./phoneEngine";
import { wayBackOnPhoneFirst } from "./wayBackOnPhone";
import type { ZoneEntry } from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ downloadAsync: jest.fn() }));

const URL = "http://192.168.1.23:8000";
const REQUEST = wayBackRequest as WayBackRequest;
const WAY = answered as WayBack;
const PHONE = "0123456789abcdef0123456789abcdef";

/** Trento's foot zone, which holds the fixture's made-up town. */
const ZONE: ZoneEntry = {
  name: "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz",
  etag: '"e"',
  bytes: 2_700_000,
  usedAt: 1,
};

function engine(answer: PlanAnswer, available = true) {
  const wayBack = jest.fn(async () => answer);
  return { engine: { available, wayBack } as unknown as PhoneEngine, wayBack };
}

function server(outcome: WayBackOutcome) {
  return jest.fn(
    async (..._: Parameters<typeof requestWayBack>): Promise<WayBackOutcome> => outcome,
  );
}

const done = (body: unknown): PlanAnswer => ({
  kind: "done",
  json: JSON.stringify(body),
  ms: 300,
  memoryMb: 200,
});

const apiError = (code: ApiErrorCode) => ({
  error: { code, message: code, suggested_distance_m: null },
});

test("with a zone saved the phone gives the way, and the server is not asked", async () => {
  const phone = engine(done(answered));
  const ask = server({ kind: "cancelled" });

  const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
    engine: phone.engine,
    zones: () => [ZONE],
    phone: () => PHONE,
    ask,
  });

  expect(answer).toEqual({ kind: "way", way: WAY, by: "phone" });
  expect(phone.wayBack).toHaveBeenCalledWith(
    JSON.stringify(REQUEST),
    [expect.objectContaining({ name: ZONE.name })],
    expect.any(Number),
    undefined,
  );
  expect(ask).not.toHaveBeenCalled();
});

test("without a zone around the runner the server gives the way", async () => {
  const phone = engine(done(answered));
  const ask = server({ kind: "way", way: WAY });

  const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
    engine: phone.engine,
    zones: () => [],
    phone: () => PHONE,
    ask,
  });

  expect(answer).toEqual({ kind: "way", way: WAY, by: "server" });
  expect(phone.wayBack).not.toHaveBeenCalled();
  expect(ask).toHaveBeenCalledWith(URL, REQUEST, { signal: undefined, phone: PHONE });
});

test("the phone without the map, failing or slow, leaves it to the server", async () => {
  for (const onPhone of [
    done(apiError("map_data_unavailable")),
    { kind: "failed", why: "the route took too long on the phone" } as const,
    done("not a way"),
  ]) {
    const ask = server({ kind: "way", way: WAY });
    const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
      engine: engine(onPhone).engine,
      zones: () => [ZONE],
      phone: () => PHONE,
      ask,
    });
    expect(answer).toMatchObject({ kind: "way", by: "server" });
  }
});

test("no way back on the phone's map is not asked again of the server", async () => {
  const ask = server({ kind: "way", way: WAY });

  const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
    engine: engine(done(apiError("invalid_request"))).engine,
    zones: () => [ZONE],
    phone: () => PHONE,
    ask,
  });

  expect(answer).toEqual({ kind: "none", why: "invalid_request" });
  expect(ask).not.toHaveBeenCalled();
});

test("today's server, without the way back, leaves the straight line", async () => {
  // No zone on the phone, and the API answers 404: nothing to draw, no error.
  for (const outcome of [
    { kind: "bad_answer", status: 404 } as const,
    { kind: "api_error", ...apiError("http_error").error } as const,
  ]) {
    const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
      engine: engine({ kind: "failed", why: "no" }).engine,
      zones: () => [],
      phone: () => PHONE,
      ask: server(outcome),
    });
    expect(answer.kind).toBe("none");
  }
});

test("offline, too many asked or no way back on the server: the straight line", async () => {
  for (const outcome of [
    { kind: "unreachable", url: URL } as const,
    { kind: "api_error", ...apiError("too_many_requests").error } as const,
    { kind: "api_error", ...apiError("invalid_request").error } as const,
    { kind: "api_error", ...apiError("map_data_unavailable").error } as const,
  ]) {
    const answer = await wayBackOnPhoneFirst(URL, REQUEST, {
      engine: engine({ kind: "failed", why: "no" }, false).engine,
      zones: () => [ZONE],
      phone: () => PHONE,
      ask: server(outcome),
    });
    expect(answer.kind).toBe("none");
  }
});

test("without a server and a zone there is no way back", async () => {
  const answer = await wayBackOnPhoneFirst(null, REQUEST, {
    engine: engine(done(answered)).engine,
    zones: () => [],
    phone: () => PHONE,
    ask: server({ kind: "way", way: WAY }),
  });
  expect(answer).toEqual({
    kind: "none",
    why: "no zone saved around the runner, and no server",
  });
});

test("on the water there is no way back to ask", async () => {
  const phone = engine(done(answered));
  const ask = server({ kind: "way", way: WAY });

  const answer = await wayBackOnPhoneFirst(
    URL,
    { ...REQUEST, activity: "paddling" },
    { engine: phone.engine, zones: () => [ZONE], phone: () => PHONE, ask },
  );

  expect(answer.kind).toBe("none");
  expect(phone.wayBack).not.toHaveBeenCalled();
  expect(ask).not.toHaveBeenCalled();
});

test("a way back no longer wanted is cancelled, wherever it was", async () => {
  const controller = new AbortController();
  const ask = server({ kind: "way", way: WAY });
  const phone = engine({ kind: "cancelled" });

  expect(
    await wayBackOnPhoneFirst(URL, REQUEST, {
      engine: phone.engine,
      zones: () => [ZONE],
      phone: () => PHONE,
      ask,
      signal: controller.signal,
    }),
  ).toEqual({ kind: "cancelled" });
  expect(ask).not.toHaveBeenCalled();

  expect(
    await wayBackOnPhoneFirst(URL, REQUEST, {
      engine: phone.engine,
      zones: () => [],
      phone: () => PHONE,
      ask: server({ kind: "cancelled" }),
    }),
  ).toEqual({ kind: "cancelled" });
});
