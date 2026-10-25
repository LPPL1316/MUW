import type { RouteResult } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";

import type { BackgroundPriority } from "../api/routeQueue";
import type { RouteOutcome } from "../api/routes";
import type { Place } from "../places/photon";
import {
  cityKey,
  drawExamples,
  EXAMPLE_DISTANCE_M,
  exampleDetail,
  MORE_SHAPES,
  type Storage,
} from "./exampleRoutes";
import { drawSamples, forgetSamples, SAMPLE_SHAPES, townSample } from "./nearbySamples";

const API = "http://api.test";
const result = fixture as unknown as RouteResult;
const levico: Place = {
  label: "Levico Terme, Trentino, Italy",
  point: [46.0091, 11.3018],
};
const pergine: Place = {
  label: "Pergine Valsugana, Trentino, Italy",
  point: [46.0605, 11.2407],
};
const done: RouteOutcome = { kind: "route", result };
const notDrawable: RouteOutcome = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "No.",
};

beforeEach(() => {
  forgetSamples();
});

/** The file of a city's examples, in memory. */
function memory(): Storage {
  let kept = {};
  return {
    load: () => ({ ...kept }),
    save: (next) => {
      kept = next;
    },
  };
}

/** Lets what is already answered go through. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
  }
}

/** As `settle`, past the pause before a sample is asked once more. */
async function settleRetry(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await settle();
}

type Asked = { shape: string; start: [number, number] };

function requester(answer: (asked: Asked) => RouteOutcome | Promise<RouteOutcome>) {
  const asked: Asked[] = [];
  const request = jest.fn((_api: string, body: unknown) => {
    const { shape, start } = body as Asked;
    asked.push({ shape, start });
    return Promise.resolve(answer({ shape, start }));
  });
  return { request: request as never, asked, calls: request };
}

test("the circle first, then the heart and the star, a town after the other", async () => {
  expect(SAMPLE_SHAPES).toEqual(["circle", "heart", "star"]);
  const { request, asked, calls } = requester(() => done);
  drawSamples(API, [levico, pergine], { request });
  await settle();
  expect(asked.map((a) => `${a.shape} ${a.start[0]}`)).toEqual([
    "circle 46.0091",
    "heart 46.0091",
    "star 46.0091",
    "circle 46.0605",
    "heart 46.0605",
    "star 46.0605",
  ]);
  // As a city's examples ask it: the API keeps one answer for both.
  expect(calls.mock.calls[0][1]).toEqual({
    shape: "circle",
    distance_m: EXAMPLE_DISTANCE_M,
    start: levico.point,
    activity: "running",
  });
  const sample = townSample(levico);
  expect(sample.status).toBe("ready");
  // The card shows the heart.
  expect(sample.status === "ready" && sample.route.shape).toBe("heart");
  expect(sample.status === "ready" && sample.route.city).toBe("Levico Terme");
});

test("a town waits, then draws, and shows what came out before the heart", async () => {
  let release: (outcome: RouteOutcome) => void = () => {};
  const { request } = requester(({ shape }) =>
    shape === "heart" ? new Promise((resolve) => (release = resolve)) : done,
  );
  expect(townSample(levico)).toEqual({ status: "waiting" });
  drawSamples(API, [levico, pergine], { request });
  await settle();
  const drawing = townSample(levico);
  expect(drawing.status).toBe("drawing");
  expect(drawing.status === "drawing" && drawing.route?.shape).toBe("circle");
  expect(townSample(pergine)).toEqual({ status: "waiting" });
  release(done);
  await settle();
  expect(townSample(levico).status).toBe("ready");
  // Pergine's turn: its heart waits as Levico's did.
  expect(townSample(pergine).status).toBe("drawing");
  release(done);
  await settle();
  expect(townSample(pergine).status).toBe("ready");
});

test("a shape that does not come out is left out; none at all is no drawing", async () => {
  const { request } = requester(({ shape, start }) =>
    start[0] === levico.point[0] || shape === "heart" ? notDrawable : done,
  );
  drawSamples(API, [levico, pergine], { request });
  await settle();
  expect(townSample(levico)).toEqual({ status: "failed" });
  const sample = townSample(pergine);
  expect(sample.status === "ready" && sample.route.shape).toBe("circle");
});

test("trouble that is not a shape's stops every town, and the next call goes on", async () => {
  let down = true;
  const { request, asked } = requester(({ shape }) =>
    down && shape === "heart"
      ? { kind: "api_error", code: "map_data_unavailable", message: "No map." }
      : done,
  );
  drawSamples(API, [levico, pergine], { request });
  await settle();
  // Levico keeps its circle; Pergine was never asked.
  expect(asked).toHaveLength(2);
  const kept = townSample(levico);
  expect(kept.status === "ready" && kept.route.shape).toBe("circle");
  expect(townSample(pergine)).toEqual({ status: "failed" });
  down = false;
  drawSamples(API, [levico, pergine], { request });
  await settle();
  // The circle of Levico is not asked again.
  expect(asked.map((a) => a.shape)).toEqual([
    "circle",
    "heart",
    "heart",
    "star",
    "circle",
    "heart",
    "star",
  ]);
  const sample = townSample(levico);
  expect(sample.status === "ready" && sample.route.shape).toBe("heart");
});

test("a request the API did not get is asked once more, then it is trouble", async () => {
  let lost = 1;
  const { request, asked } = requester(({ shape }) => {
    if (shape === "heart" && lost > 0) {
      lost -= 1;
      return { kind: "unreachable", url: API };
    }
    return done;
  });
  drawSamples(API, [levico], { request, retryMs: 0 });
  await settleRetry();
  expect(asked.map((a) => a.shape)).toEqual(["circle", "heart", "heart", "star"]);
  const sample = townSample(levico);
  expect(sample.status === "ready" && sample.route.shape).toBe("heart");
  // Lost twice in a row: no network, and the other town is not asked.
  lost = 2;
  drawSamples(API, [pergine, levico], { request, retryMs: 0 });
  await settleRetry();
  expect(asked.map((a) => a.shape).slice(4)).toEqual(["circle", "heart", "heart"]);
  const kept = townSample(pergine);
  expect(kept.status === "ready" && kept.route.shape).toBe("circle");
});

test("stopped, nothing more is asked; ready towns are never asked again", async () => {
  let release: (outcome: RouteOutcome) => void = () => {};
  const { request, asked } = requester(({ start, shape }) =>
    start[0] === pergine.point[0] && shape === "circle"
      ? new Promise((resolve) => (release = resolve))
      : done,
  );
  const stop = drawSamples(API, [levico, pergine], { request });
  await settle();
  expect(asked).toHaveLength(4);
  stop();
  release(done);
  await settle();
  expect(asked).toHaveLength(4);
  drawSamples(API, [levico], { request });
  await settle();
  expect(asked).toHaveLength(4);
});

test("each sample waits for its turn in the app's queue, as an example on the page", async () => {
  const { request, asked } = requester(() => done);
  const turns: BackgroundPriority[] = [];
  let next: () => void = () => undefined;
  const queue = {
    background: (priority: BackgroundPriority, run: () => Promise<RouteOutcome>) => {
      turns.push(priority);
      return new Promise<void>((resolve) => (next = resolve)).then(run);
    },
  };
  drawSamples(API, [levico], { request, queue });
  await settle();
  expect(turns).toEqual(["visible"]);
  expect(asked).toHaveLength(0);
  next();
  await settle();
  expect(asked).toHaveLength(1);
  expect(turns).toHaveLength(2);
});

test("a sample drawn is the town's example: chosen, the town asks only the others", async () => {
  const { request } = requester(() => done);
  drawSamples(API, [levico], { request });
  await settle();
  expect(townSample(levico).status).toBe("ready");
  const chosen = requester(() => done);
  drawExamples(API, levico, { request: chosen.request, storage: memory() });
  await settle();
  expect(chosen.asked[0].shape).toBe(MORE_SHAPES[0]);
  expect(SAMPLE_SHAPES.every((s) => !chosen.asked.some((a) => a.shape === s))).toBe(
    true,
  );
  // Whole, to open on the map without the API.
  expect(exampleDetail(`example:heart:${cityKey(levico.point)}`)?.points).toEqual(
    result.points,
  );
});

test("a town whose first shapes are ready already is not sampled", async () => {
  const chosen = requester(() => done);
  drawExamples(API, pergine, { request: chosen.request, storage: memory() });
  await settle();
  const { request, asked } = requester(() => done);
  drawSamples(API, [pergine, levico], { request });
  await settle();
  expect(asked.every((a) => a.start[0] === levico.point[0])).toBe(true);
  const sample = townSample(pergine);
  expect(sample.status === "ready" && sample.route.shape).toBe("heart");
});
