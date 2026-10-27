import type { LatLon, RouteResult } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";

import type { BackgroundPriority } from "../api/routeQueue";
import type { RouteOutcome } from "../api/routes";
import { files } from "../engine/memoryFiles";
import type { ZoneEntry } from "../engine/zones";
import {
  exampleDetail,
  exampleRequest,
  forgetExamples,
} from "../explore/exampleRoutes";
import { FEATURED_CITIES } from "../explore/presets";
import { metresBetween } from "../map/coordinates";
import type { Place } from "../places/photon";
import {
  CITIES_PER_SHAPE,
  ELSEWHERE_ONLY,
  fillNearYou,
  forgetNearYou,
  type NearKept,
  type NearOptions,
  NEAR_SHAPES,
  nearYouCards,
  readNear,
  shuffled,
} from "./nearYouShapes";

jest.mock("expo-file-system", () => jest.requireActual("../engine/memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ createDownloadResumable: jest.fn() }));

const API = "http://api.test";
const result = fixture as unknown as RouteResult;
const done: RouteOutcome = { kind: "route", result };
const refused: RouteOutcome = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "No.",
};
const offline: RouteOutcome = { kind: "unreachable", url: API };
const trento: LatLon = [46.0702, 11.1265];
// About 300 m north, and about 3 km north.
const nearTrento: LatLon = [46.0729, 11.1265];
const farFromTrento: LatLon = [46.0972, 11.1265];
// No zone around the phone: the wait for one is skipped in these tests.
const NO_ZONES = (): ZoneEntry[] => [];

/** Each featured city at a point of its own, as GET /cities would give. */
function cityOf(name: string): Place {
  const i = FEATURED_CITIES.indexOf(name as (typeof FEATURED_CITIES)[number]);
  return { label: `${name}, Somewhere`, point: [10 + i, 20 + i] };
}

/** The cities in the order the row asks them, with `random` always 0. */
const ORDER = shuffled(FEATURED_CITIES, () => 0);

function storage() {
  let kept: NearKept | null = null;
  return {
    load: () => kept,
    save: jest.fn((next: NearKept) => {
      kept = JSON.parse(JSON.stringify(next)) as NearKept;
    }),
    peek: () => kept,
  };
}

type Asked = { shape: string; start: LatLon; priority: BackgroundPriority };

/** The options of a test: the phone, the API, the queue, all answered here. */
function options(
  near: (shape: string) => RouteOutcome | Promise<RouteOutcome>,
  elsewhere: (shape: string, start: LatLon) => RouteOutcome | "later" = () => done,
  kept = storage(),
) {
  const asked: { near: Asked[]; elsewhere: Asked[] } = { near: [], elsewhere: [] };
  let priority: BackgroundPriority = "visible";
  const queue = {
    background: (
      p: BackgroundPriority,
      run: () => Promise<RouteOutcome>,
      { signal }: { signal?: AbortSignal } = {},
    ) => {
      priority = p;
      return signal?.aborted
        ? Promise.resolve<RouteOutcome>({ kind: "cancelled" })
        : run();
    },
  };
  const drawNear = jest.fn(
    (_api: string, body: unknown, opts?: { signal?: AbortSignal }) => {
      const { shape, start } = body as { shape: string; start: LatLon };
      asked.near.push({ shape, start, priority });
      return Promise.resolve(near(shape)).then((outcome) =>
        opts?.signal?.aborted ? ({ kind: "cancelled" } as RouteOutcome) : outcome,
      );
    },
  );
  const drawElsewhere = jest.fn(
    (
      _api: string,
      body: unknown,
      opts?: { signal?: AbortSignal; onStatus?: (status: never) => void },
    ) => {
      const { shape, start } = body as { shape: string; start: LatLon };
      asked.elsewhere.push({ shape, start, priority });
      const answer = elsewhere(shape, start);
      if (answer === "later") {
        // The API would draw it now: the row lets it go.
        opts?.onStatus?.("queued" as never);
        return Promise.resolve<RouteOutcome>(
          opts?.signal?.aborted ? { kind: "cancelled" } : { kind: "timeout" },
        );
      }
      return Promise.resolve(answer);
    },
  );
  const search = jest.fn((_api: string, name: string) =>
    Promise.resolve<Place[] | null>([cityOf(name)]),
  );
  const keepFeatured = jest.fn();
  const opts: NearOptions = {
    drawNear: drawNear as never,
    drawElsewhere: drawElsewhere as never,
    queue,
    storage: kept,
    zones: NO_ZONES,
    zoneWaitMs: 0,
    search: search as never,
    featured: () => null,
    keepFeatured,
    random: () => 0,
  };
  return { opts, asked, kept, search, keepFeatured, drawNear, drawElsewhere };
}

/** Lets what is already answered go through. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 50; j += 1) {
      await Promise.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function describeCards(here: LatLon | null): string[] {
  return nearYouCards(here).map((card) =>
    card.status === "drawing"
      ? `${card.shape} drawing`
      : `${card.shape} ${card.near ? "near" : card.route.city}`,
  );
}

beforeEach(() => {
  forgetNearYou();
  forgetExamples();
  files.clear();
});

test("the circle, the heart and the star of 5 km from the phone, in the queue", async () => {
  expect(NEAR_SHAPES).toEqual(["circle", "heart", "star"]);
  const { opts, asked, drawNear } = options(() => done);
  fillNearYou(API, trento, opts);
  expect(describeCards(trento)).toEqual([
    "circle drawing",
    "heart drawing",
    "star drawing",
  ]);
  await settle();
  expect(asked.near.map((a) => `${a.shape} ${a.priority}`)).toEqual([
    "circle visible",
    "heart visible",
    "star visible",
  ]);
  expect(drawNear.mock.calls[0][1]).toEqual({
    shape: "circle",
    distance_m: 5000,
    start: trento,
    activity: "running",
  });
  expect(describeCards(trento)).toEqual(["circle near", "heart near", "star near"]);
  // Nothing of other cities: all three came out.
  expect(asked.elsewhere).toEqual([]);
});

test("a card opens as an example, its id without the position", async () => {
  const { opts } = options(() => done);
  fillNearYou(API, trento, opts);
  await settle();
  const card = nearYouCards(trento)[1];
  expect(card.status).toBe("ready");
  const route = card.status === "ready" ? card.route : null;
  expect(route?.id).toBe("near-you:heart");
  expect(route?.city).toBe("");
  const detail = exampleDetail("near-you:heart");
  expect(detail?.points).toEqual(result.points);
  expect(
    detail?.alternatives?.every((other) => other.id.startsWith("near-you:heart:")),
  ).toBe(true);
  expect(exampleRequest("near-you:heart")).toEqual({
    shape: "heart",
    distance_m: 5000,
    start: trento,
    activity: "running",
  });
});

test("kept on the phone: opened again within 1 km, nothing is asked", async () => {
  const first = options(() => done);
  fillNearYou(API, trento, first.opts);
  await settle();
  expect(first.kept.peek()?.point).toEqual(trento);
  // The app opens again: the memory is gone, the file is not.
  forgetNearYou();
  forgetExamples();
  const again = options(() => done, undefined, first.kept);
  fillNearYou(API, nearTrento, again.opts);
  expect(describeCards(nearTrento)).toEqual(["circle near", "heart near", "star near"]);
  await settle();
  expect(again.drawNear).not.toHaveBeenCalled();
  expect(exampleDetail("near-you:star")?.points).toEqual(result.points);
});

test("more than 1 km away they are drawn again, from there", async () => {
  const { opts, asked } = options(() => done);
  fillNearYou(API, trento, opts);
  await settle();
  fillNearYou(API, farFromTrento, opts);
  await settle();
  expect(asked.near.map((a) => a.start)).toEqual([
    trento,
    trento,
    trento,
    farFromTrento,
    farFromTrento,
    farFromTrento,
  ]);
});

test("a shape refused near gives its place to the same shape in a featured city", async () => {
  const { opts, asked, kept, keepFeatured } = options((shape) =>
    shape === "heart" ? refused : done,
  );
  fillNearYou(API, trento, opts);
  await settle();
  const first = ORDER[0];
  expect(asked.elsewhere.map((a) => `${a.shape} ${a.start.join(",")}`)).toEqual([
    `heart ${cityOf(first).point.join(",")}`,
  ]);
  expect(describeCards(trento)).toEqual(["circle near", "star near", `heart ${first}`]);
  // It says how far its start is from the phone; the shapes near do not.
  const [circle, , heart] = nearYouCards(trento);
  expect(circle.status === "ready" && circle.awayM).toBeFalsy();
  expect(heart.status === "ready" && heart.awayM).toBe(
    heart.status === "ready" ? metresBetween(trento, heart.route.start) : null,
  );
  // The city is kept for «Explore» and the next time.
  expect(keepFeatured).toHaveBeenCalledWith(first, cityOf(first));
  // Refused, it is kept as such: not asked again here.
  expect(kept.peek()?.shapes.heart).toBeNull();
});

test("nothing near: six shapes in six cities, the simplest first", async () => {
  const { opts, asked } = options(() => refused);
  fillNearYou(API, trento, opts);
  await settle();
  expect(ELSEWHERE_ONLY).toBe(6);
  expect(asked.elsewhere.map((a) => a.shape)).toEqual([
    "circle",
    "heart",
    "star",
    "moon",
    "horse",
    "snail",
  ]);
  expect(describeCards(trento)).toEqual(
    ["circle", "heart", "star", "moon", "horse", "snail"].map(
      (shape, i) => `${shape} ${ORDER[i]}`,
    ),
  );
});

test("without the position: six shapes of other cities, nothing near", async () => {
  const { opts, asked } = options(() => done);
  fillNearYou(API, null, opts);
  await settle();
  expect(asked.near).toEqual([]);
  expect(describeCards(null)).toEqual(
    ["circle", "heart", "star", "moon", "horse", "snail"].map(
      (shape, i) => `${shape} ${ORDER[i]}`,
    ),
  );
  // Far from where, nobody knows: the city's name alone.
  expect(nearYouCards(null).every((card) => !("awayM" in card))).toBe(true);
});

test("a shape the API would draw now is let go: another city, three at most", async () => {
  const { opts, asked } = options(
    () => refused,
    (shape) => (shape === "circle" ? "later" : done),
  );
  fillNearYou(API, trento, opts);
  await settle();
  const circles = asked.elsewhere.filter((a) => a.shape === "circle");
  expect(circles).toHaveLength(CITIES_PER_SHAPE);
  // The circle left out: the next shapes in the next cities.
  expect(describeCards(trento).map((card) => card.split(" ")[0])).toEqual([
    "heart",
    "star",
    "moon",
    "horse",
    "snail",
    "dog_head",
  ]);
});

test("a city's example ready on the phone needs no request", async () => {
  const { opts, asked } = options(() => refused);
  fillNearYou(API, trento, opts);
  await settle();
  const before = asked.elsewhere.length;
  // Opened again in this run: the shapes of the cities are there.
  forgetNearYou();
  const again = options(() => refused);
  fillNearYou(API, trento, again.opts);
  await settle();
  expect(before).toBe(6);
  expect(again.asked.elsewhere).toEqual([]);
  expect(describeCards(trento)).toHaveLength(6);
});

test("no network for the cities: it stops, and the row keeps what it has", async () => {
  const { opts, asked } = options(
    (shape) => (shape === "circle" ? done : refused),
    () => offline,
  );
  fillNearYou(API, trento, opts);
  await settle();
  expect(asked.elsewhere).toHaveLength(1);
  expect(describeCards(trento)).toEqual(["circle near"]);
});

test("stopped while a shape is drawn: it waits, and goes on the next time", async () => {
  let release: (outcome: RouteOutcome) => void = () => {};
  const { opts, asked } = options((shape) =>
    shape === "heart" ? new Promise((resolve) => (release = resolve)) : done,
  );
  const stop = fillNearYou(API, trento, opts);
  await settle();
  expect(describeCards(trento)).toEqual([
    "circle near",
    "heart drawing",
    "star drawing",
  ]);
  stop();
  release(done);
  await settle();
  expect(asked.near.map((a) => a.shape)).toEqual(["circle", "heart"]);
  expect(describeCards(trento)).toEqual([
    "circle near",
    "heart drawing",
    "star drawing",
  ]);
  const again = options(
    () => done,
    undefined,
    opts.storage as ReturnType<typeof storage>,
  );
  fillNearYou(API, trento, again.opts);
  await settle();
  // Only what was missing.
  expect(again.asked.near.map((a) => a.shape)).toEqual(["heart", "star"]);
  expect(describeCards(trento)).toEqual(["circle near", "heart near", "star near"]);
});

test("the maps around the phone are waited for, then the phone draws", async () => {
  let zones: ZoneEntry[] = [];
  const { opts, drawNear } = options(() => done);
  fillNearYou(API, trento, {
    ...opts,
    zones: () => zones,
    zoneWaitMs: 60_000,
    zoneCheckMs: 1,
  });
  await settle();
  expect(drawNear).not.toHaveBeenCalled();
  zones = [
    {
      name: "foot_46.00000_11.00000_46.20000_11.30000.zone.json.gz",
      etag: null,
      bytes: 1,
      usedAt: 0,
    },
  ];
  await settle();
  expect(drawNear).toHaveBeenCalled();
});

test("the file is read with care: what does not read is drawn again", () => {
  expect(readNear(null)).toBeNull();
  expect(readNear({ point: "here" })).toBeNull();
  expect(readNear({ point: trento, shapes: { heart: { id: 1 }, star: null } })).toEqual(
    {
      point: trento,
      shapes: { star: null },
    },
  );
});

test("the cities' order is the same for the same chances", () => {
  expect(shuffled(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
  expect(shuffled(["a", "b", "c"], () => 0.99)).toEqual(["a", "b", "c"]);
});
