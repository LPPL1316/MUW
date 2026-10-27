import type { LatLon, RouteRequest, RouteResult } from "@shaperoute/shared-types";
import penUp from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import shapeResult from "@shaperoute/shared-types/fixtures/route-result.json";

import { files } from "../engine/memoryFiles";
import type { KeptOutcome } from "../api/keptRoutes";
import type { RouteOutcome } from "../api/routes";
import type { Place } from "../places/photon";
import {
  drawExamples,
  examplesKey,
  forgetExamples,
  readyExample,
  readyWord,
} from "./exampleRoutes";
import {
  AGAIN_MS,
  FRESH_MS,
  forgetRegion,
  MAX_ROUTES,
  prepareRegion,
  REGION_TOWNS,
} from "./regionAhead";
import { forgetRegionStore, townEntry } from "./regionStore";

/**
 * The examples of the towns near and of the region taken ahead of «Explore»
 * from the API's kept routes (TASK-316, ADR-0276): one request a town,
 * never a route drawn.
 */

jest.mock("expo-file-system", () => jest.requireActual("../engine/memoryFiles"));

const API = "http://api.test";
const start: LatLon = [46.0036, 11.2647];
const town = (label: string, point: LatLon): Place => ({ label, point });
const levico = town("Levico Terme", [46.0091, 11.3018]);
const pergine = town("Pergine Valsugana", [46.0605, 11.2407]);
const tenna = town("Tenna", [46.0186, 11.2647]);
const borgo = town("Borgo Valsugana", [46.0533, 11.4566]);
const trento = town("Trento", [46.0679, 11.1211]);

beforeEach(() => {
  jest.restoreAllMocks();
  forgetRegion();
  forgetRegionStore();
  forgetExamples();
  files.clear();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The app's queue, at once, every request in its turn "prefetch". */
function queue() {
  const priorities: string[] = [];
  return {
    priorities,
    background: (priority: string, run: () => Promise<RouteOutcome>) => {
      priorities.push(priority);
      return run();
    },
  };
}

/** The API keeps every route asked: a shape's, or a word's with its walks. */
function keepsAll() {
  return jest.fn(
    (_api: string, requests: readonly RouteRequest[]): Promise<KeptOutcome> =>
      Promise.resolve({
        kind: "kept",
        routes: requests.map(
          (r) =>
            (r.word
              ? { ...penUp, word: r.word }
              : { ...shapeResult, shape: r.shape }) as RouteResult | null,
        ),
      }),
  );
}

function aroundOf(rings: Record<string, Place[]>) {
  return jest.fn((_api: string, point: LatLon) =>
    Promise.resolve(rings[point.join(",")] ?? []),
  );
}

test("the towns near first, then those around them, one request a town", async () => {
  const request = keepsAll();
  const q = queue();
  const fetchTowns = aroundOf({
    [levico.point.join(",")]: [pergine, borgo, tenna],
    [pergine.point.join(",")]: [levico, trento],
  });
  prepareRegion(API, start, [levico, pergine], {
    request,
    fetchTowns: fetchTowns as never,
    queue: q as never,
  });
  await settle();
  // Each town once, its fourteen examples in one request, behind the rest.
  const starts = request.mock.calls.map(([, asked]) => asked[0].start);
  expect(starts).toEqual([
    levico.point,
    pergine.point,
    // The region: nearest to the start first.
    tenna.point,
    trento.point,
    borgo.point,
  ]);
  expect(request.mock.calls.every(([, asked]) => asked.length === 14)).toBe(true);
  expect(q.priorities.every((p) => p === "prefetch")).toBe(true);
  expect(fetchTowns).toHaveBeenCalledTimes(2);
  // The town opens with them: nothing to ask the API.
  expect(readyExample(tenna, "moon")).not.toBeNull();
  expect(readyWord(tenna, "AMORE")).not.toBeNull();
});

test("what the API does not keep is never drawn: it stays to ask", async () => {
  const request = jest.fn(
    (_api: string, requests: readonly RouteRequest[]): Promise<KeptOutcome> =>
      Promise.resolve({
        kind: "kept",
        routes: requests.map((r) =>
          r.shape === "heart" ? ({ ...shapeResult } as RouteResult) : null,
        ),
      }),
  );
  let now = Date.now();
  jest.spyOn(Date, "now").mockImplementation(() => now);
  const options = {
    request,
    fetchTowns: aroundOf({}) as never,
    queue: queue() as never,
  };
  prepareRegion(API, start, [levico], options);
  await settle();
  expect(readyExample(levico, "heart")).not.toBeNull();
  expect(readyExample(levico, "moon")).toBeNull();
  expect(townEntry(examplesKey(levico.point))?.has).toEqual(["heart"]);
  // Asked again only a day later, and only what it lacks.
  now += AGAIN_MS - 1;
  prepareRegion(API, start, [levico], options);
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
  now += 1;
  prepareRegion(API, start, [levico], options);
  await settle();
  expect(request).toHaveBeenCalledTimes(2);
  const again = request.mock.calls[1][1];
  expect(again.map((r) => r.shape ?? r.word)).not.toContain("heart");
  expect(again).toHaveLength(13);
  // The heart stays in the file.
  expect(townEntry(examplesKey(levico.point))?.has).toEqual(["heart"]);
});

test("a town with all its examples is asked again after a week", async () => {
  const request = keepsAll();
  let now = Date.now();
  jest.spyOn(Date, "now").mockImplementation(() => now);
  const options = {
    request,
    fetchTowns: aroundOf({}) as never,
    queue: queue() as never,
  };
  prepareRegion(API, start, [levico], options);
  await settle();
  // Forgotten in memory, as when the app starts again: the files stay.
  forgetExamples();
  forgetRegionStore();
  forgetRegion();
  now += FRESH_MS - 1;
  prepareRegion(API, start, [levico], options);
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
  expect(readyExample(levico, "rabbit_head")).not.toBeNull();
  now += 1;
  forgetExamples();
  prepareRegion(API, start, [levico], options);
  await settle();
  expect(request).toHaveBeenCalledTimes(2);
});

test("an API without the endpoint is not asked again in this run", async () => {
  const request = jest.fn((): Promise<KeptOutcome> =>
    Promise.resolve({ kind: "not_here" }),
  );
  const fetchTowns = aroundOf({});
  const options = { request, fetchTowns: fetchTowns as never, queue: queue() as never };
  const onNearby = jest.fn();
  prepareRegion(API, start, [levico, pergine], { ...options, onNearby });
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
  expect(fetchTowns).not.toHaveBeenCalled();
  // Told anyway: the samples of the towns go on as before.
  expect(onNearby).toHaveBeenCalledTimes(1);
  prepareRegion(API, start, [levico, pergine], options);
  await settle();
  expect(request).toHaveBeenCalledTimes(1);
});

test("at most so many towns, and so many routes in a run", async () => {
  const request = keepsAll();
  const many = Array.from({ length: 30 }, (_, i) =>
    town(`Town ${i}`, [46 + i / 100, 11.3]),
  );
  prepareRegion(API, start, [levico], {
    request,
    fetchTowns: aroundOf({ [levico.point.join(",")]: many }) as never,
    queue: queue() as never,
  });
  await settle();
  const towns = request.mock.calls.length;
  expect(towns).toBeLessThanOrEqual(REGION_TOWNS);
  expect(towns).toBe(Math.ceil(MAX_ROUTES / 14));
});

test("a town already on the page gets its cards at once", async () => {
  // The town chosen, its examples asked and not answered yet.
  const never = jest.fn(() => new Promise<RouteOutcome>(() => {}));
  drawExamples(API, levico, {
    request: never as never,
    queue: { background: (_p, run) => run() } as never,
  });
  expect(readyExample(levico, "star")).toBeNull();
  prepareRegion(API, start, [levico], {
    request: keepsAll(),
    fetchTowns: aroundOf({}) as never,
    queue: queue() as never,
  });
  await settle();
  expect(readyExample(levico, "star")).not.toBeNull();
  expect(readyWord(levico, "MUW")).not.toBeNull();
});

test("stopped, it asks nothing more", async () => {
  const request = keepsAll();
  const stop = prepareRegion(API, start, [levico, pergine], {
    request,
    fetchTowns: aroundOf({}) as never,
    queue: queue() as never,
  });
  stop();
  await settle();
  expect(request.mock.calls.length).toBeLessThanOrEqual(1);
  expect(townEntry(examplesKey(pergine.point))).toBeNull();
});
