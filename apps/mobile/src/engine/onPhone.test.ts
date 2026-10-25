import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";

import { requestRoute } from "../api/routes";
import { files } from "./memoryFiles";
import {
  OFFLINE_TIMEOUT_MS,
  PHONE_MAX_DISTANCE_M,
  phoneFirst,
  planOnPhone,
  requestRouteOnPhoneFirst,
} from "./onPhone";
import { PhoneEngine, PLAN_TIMEOUT_MS, type PlanAnswer } from "./phoneEngine";
import type { ZoneEntry } from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ downloadAsync: jest.fn() }));
jest.mock("../api/routes", () => ({
  ...jest.requireActual("../api/routes"),
  requestRoute: jest.fn(),
}));

const TRENTO = "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz";
const ZONES: ZoneEntry[] = [{ name: TRENTO, etag: '"e"', bytes: 7, usedAt: 0 }];
const HEART: RouteRequest = {
  start: [46.0679, 11.1211],
  shape: "heart",
  distance_m: 5000,
  activity: "running",
};
const RESULT: RouteResult = {
  points: [
    [46.0679, 11.1211],
    [46.068, 11.1212],
  ],
  distance_m: 5165,
  similarity: 0.92,
  shape: "heart",
  warnings: [],
  directions: [],
} as unknown as RouteResult;
const SERVER = { kind: "route", result: { ...RESULT, distance_m: 5100 } } as const;

/** A real engine whose page answers `answer`. */
function engineAnswering(answer: PlanAnswer | (() => Promise<PlanAnswer>)) {
  const engine = new PhoneEngine();
  const plan = jest
    .spyOn(engine, "plan")
    .mockImplementation(typeof answer === "function" ? answer : async () => answer);
  return { engine, plan };
}

function job(body: object): PlanAnswer {
  return {
    kind: "done",
    json: JSON.stringify({ job_id: "phone", ...body }),
    ms: 1,
    memoryMb: 1,
  };
}

beforeEach(() => {
  files.clear();
  jest.mocked(requestRoute).mockReset().mockResolvedValue(SERVER);
});

test("with a zone around the start, the phone draws the route", async () => {
  const { engine, plan } = engineAnswering(
    job({ status: "done", result: RESULT, error: null }),
  );
  const onStatus = jest.fn();
  const outcome = await planOnPhone(HEART, { engine, zones: () => ZONES, onStatus });
  expect(outcome).toEqual({ kind: "route", result: RESULT });
  expect(onStatus).toHaveBeenCalledWith("computing");
  expect(plan).toHaveBeenCalledWith(
    JSON.stringify(HEART),
    [
      {
        name: TRENTO,
        uri: `file:///documents/engine/zones/${TRENTO}`,
        version: '"e"',
      },
    ],
    PLAN_TIMEOUT_MS,
    undefined,
  );
});

test("every zone holding the start goes to the engine, the smallest first (part E)", async () => {
  const centre = "foot_46.05000_11.10000_46.09000_11.14000.zone.json.gz";
  const elsewhere = "foot_45.40000_9.10000_45.50000_9.30000.zone.json.gz";
  const zones: ZoneEntry[] = [
    ...ZONES,
    { name: elsewhere, etag: '"m"', bytes: 9, usedAt: 0 },
    { name: centre, etag: '"c"', bytes: 3, usedAt: 0 },
  ];
  const { engine, plan } = engineAnswering(
    job({ status: "done", result: RESULT, error: null }),
  );
  await planOnPhone(HEART, { engine, zones: () => zones });
  expect(plan.mock.calls[0][1].map((zone) => zone.name)).toEqual([centre, TRENTO]);
});

test("no zone, a photo, paddling: the phone does not try", async () => {
  const { engine, plan } = engineAnswering(
    job({ status: "done", result: RESULT, error: null }),
  );
  await expect(planOnPhone(HEART, { engine, zones: () => [] })).resolves.toMatchObject({
    kind: "skipped",
  });
  await expect(
    planOnPhone({ ...HEART, activity: "paddling" }, { engine, zones: () => ZONES }),
  ).resolves.toMatchObject({ kind: "skipped" });
  await expect(
    planOnPhone(
      {
        start: HEART.start,
        distance_m: 5000,
        activity: "running",
        outline: [],
      } as never,
      { engine, zones: () => ZONES },
    ),
  ).resolves.toMatchObject({ kind: "skipped" });
  // A bike route needs a bike zone.
  await expect(
    planOnPhone(
      { ...HEART, activity: "cycling", distance_m: 15000 },
      { engine, zones: () => ZONES },
    ),
  ).resolves.toMatchObject({ kind: "skipped" });
  expect(plan).not.toHaveBeenCalled();
});

test("the engine's verdict is shown at once; a zone too small goes to the server", async () => {
  const verdict = {
    code: "shape_not_drawable",
    message: "Too short for a heart",
    suggested_distance_m: 3000,
    reason: null,
  };
  const { engine } = engineAnswering(
    job({ status: "failed", result: null, error: verdict }),
  );
  await expect(planOnPhone(HEART, { engine, zones: () => ZONES })).resolves.toEqual({
    kind: "api_error",
    ...verdict,
  });
  const small = engineAnswering(
    job({
      status: "failed",
      result: null,
      error: { code: "map_data_unavailable", message: "zone too small" },
    }),
  );
  await expect(
    planOnPhone(HEART, { engine: small.engine, zones: () => ZONES }),
  ).resolves.toEqual({
    kind: "skipped",
    why: "zone too small",
  });
});

test("a failure of the page, or an answer that is not a job, goes to the server", async () => {
  for (const answer of [
    { kind: "failed", why: "the engine was closed" } as const,
    { kind: "done", json: "not json", ms: 1, memoryMb: 1 } as const,
    { kind: "done", json: '{"status":"done"}', ms: 1, memoryMb: 1 } as const,
  ]) {
    const { engine } = engineAnswering(answer);
    await expect(
      planOnPhone(HEART, { engine, zones: () => ZONES }),
    ).resolves.toMatchObject({
      kind: "skipped",
    });
  }
});

test("a request cancelled while the phone worked stays cancelled", async () => {
  const controller = new AbortController();
  const { engine } = engineAnswering(async () => {
    controller.abort();
    return job({ status: "done", result: RESULT, error: null });
  });
  await expect(
    planOnPhone(HEART, { engine, zones: () => ZONES, signal: controller.signal }),
  ).resolves.toEqual({ kind: "cancelled" });
});

test("the engine is told of a cancel, and nothing goes to the server (TASK-287)", async () => {
  const controller = new AbortController();
  const { engine, plan } = engineAnswering({ kind: "cancelled" });
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: ZONES }));
  files.set(`file:///documents/engine/zones/${TRENTO}`, "zone");
  await expect(
    requestRouteOnPhoneFirst("https://api", HEART, {
      engine,
      signal: controller.signal,
    }),
  ).resolves.toEqual({ kind: "cancelled" });
  expect(plan.mock.calls[0][3]).toBe(controller.signal);
  expect(requestRoute).not.toHaveBeenCalled();
});

test("the server draws only what the phone did not", async () => {
  const drawn = engineAnswering(job({ status: "done", result: RESULT, error: null }));
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: ZONES }));
  files.set(`file:///documents/engine/zones/${TRENTO}`, "zone");
  await expect(
    requestRouteOnPhoneFirst("https://api", HEART, { engine: drawn.engine }),
  ).resolves.toEqual({ kind: "route", result: RESULT });
  expect(requestRoute).not.toHaveBeenCalled();

  const closed = engineAnswering({ kind: "failed", why: "closed" });
  await expect(
    requestRouteOnPhoneFirst("https://api", HEART, {
      engine: closed.engine,
      apiKey: "k",
    }),
  ).resolves.toEqual(SERVER);
  expect(requestRoute).toHaveBeenCalledWith("https://api", HEART, { apiKey: "k" });
});

test("long routes go to the server first: the phone plans its starts one by one", () => {
  expect(phoneFirst(HEART)).toBe(true);
  expect(phoneFirst({ ...HEART, distance_m: PHONE_MAX_DISTANCE_M.foot + 1 })).toBe(
    false,
  );
  expect(phoneFirst({ ...HEART, activity: "cycling", distance_m: 30_000 })).toBe(true);
  expect(phoneFirst({ ...HEART, activity: "paddling", distance_m: 2_000 })).toBe(false);
});

test("a long route with no server to ask is drawn on the phone, with time", async () => {
  const LONG = { ...HEART, distance_m: 12_000 };
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: ZONES }));
  files.set(`file:///documents/engine/zones/${TRENTO}`, "zone");
  const { engine, plan } = engineAnswering(
    job({ status: "done", result: RESULT, error: null }),
  );

  await expect(
    requestRouteOnPhoneFirst("https://api", LONG, { engine }),
  ).resolves.toEqual(SERVER);
  expect(plan).not.toHaveBeenCalled();

  const offline = { kind: "unreachable", url: "https://api" } as const;
  jest.mocked(requestRoute).mockResolvedValue(offline);
  await expect(
    requestRouteOnPhoneFirst("https://api", LONG, { engine }),
  ).resolves.toEqual({
    kind: "route",
    result: RESULT,
  });
  expect(plan).toHaveBeenCalledWith(
    JSON.stringify(LONG),
    expect.any(Array),
    OFFLINE_TIMEOUT_MS,
    undefined,
  );

  const closed = engineAnswering({ kind: "failed", why: "closed" });
  await expect(
    requestRouteOnPhoneFirst("https://api", LONG, { engine: closed.engine }),
  ).resolves.toEqual(offline);
});
