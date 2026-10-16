import type { LatLon, RouteResult, Shape } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import { act, renderHook } from "@testing-library/react-native";

import type { BackgroundPriority } from "../api/routeQueue";
import type { requestRoute, RouteOutcome } from "../api/routes";
import { files } from "../engine/memoryFiles";
import {
  asRecommended,
  type ExampleDetail,
  examplesKey,
  forgetExamples,
  PADDLE_EXAMPLES,
  type Storage,
  useCityExamples,
} from "../explore/exampleRoutes";
import {
  drawShapesAhead,
  IN_FRONT_CHECK_MS,
  LEFT_OUT_MS,
  MAX_PLACES_KEPT,
  PLACES_AHEAD,
  placesAhead,
} from "./aheadExamples";
import { readAheadFile, writeAheadFile } from "./aheadStore";
import beaches from "./beaches.json";
import { WATER_PLACES } from "./waterPlaces";
import { examplesAt, NEAR_ME_M, type WaterSpot } from "./waterSpots";

jest.mock("expo-file-system", () => jest.requireActual("../engine/memoryFiles"));

const result = fixture as unknown as RouteResult;
const LEVICO_TERME: LatLon = [46.0122, 11.2986];
const LEVICO: WaterSpot = {
  name: "Lago di Levico",
  point: [46.0085, 11.283],
  distance_m: 2000,
};
const CALDONAZZO: WaterSpot = {
  name: "Lago di Caldonazzo",
  point: [46.02, 11.24],
  distance_m: 2000,
};
const SMALL: WaterSpot = {
  name: "Lago Pudro",
  point: [46.08, 11.22],
  distance_m: 1000,
};
const FAR: WaterSpot = { name: "Lago di Como", point: [45.99, 9.26], distance_m: 2000 };
const SPOTS = [FAR, SMALL, CALDONAZZO, LEVICO];
const SHAPES: Shape[] = [
  "circle",
  "heart",
  "star",
  "moon",
  "horse",
  "snail",
  "dog_head",
  "rabbit_head",
];

function keyOf(spot: WaterSpot): string {
  return examplesKey(spot.point, examplesAt(spot.distance_m));
}

/** The phone's file of the page, in memory. */
function memory(kept: Record<string, ExampleDetail[]> = {}): Storage {
  return { load: () => JSON.parse(JSON.stringify(kept)), save: () => undefined };
}

type Asked = { start: LatLon; shape: Shape; distance_m: number; activity: string };

/** An API that draws every shape, in pieces when asked so, but `answers`. */
function api(answers: (asked: Asked) => RouteOutcome | undefined = () => undefined) {
  const asked: Asked[] = [];
  const request = jest.fn(async (_url: string, body: Asked & { pen_up?: boolean }) => {
    asked.push(body);
    return (
      answers(body) ?? {
        kind: "route",
        result: body.pen_up === true ? { ...result, walks: [[1, 2]] } : result,
      }
    );
  }) as unknown as typeof requestRoute & jest.Mock;
  return { request, asked };
}

/** A clock that moves only while the round waits, and the app's queue of
 * route requests as the round sees it: each request in its turn, at once. */
function clock(start = 1_000_000) {
  const waits: number[] = [];
  const turns: BackgroundPriority[] = [];
  let at = start;
  return {
    waits,
    turns,
    now: () => at,
    wait: async (ms: number) => {
      waits.push(ms);
      at += ms;
    },
    queue: {
      background: (priority: BackgroundPriority, run: () => Promise<RouteOutcome>) => {
        turns.push(priority);
        return run();
      },
    },
  };
}

beforeEach(() => {
  files.clear();
  forgetExamples();
});

test("the three places nearest, one a name, within «Near me»", () => {
  const twice = [...SPOTS, { ...LEVICO, point: [46.02, 11.29] as LatLon }];
  expect(placesAhead(LEVICO_TERME, twice).map((spot) => spot.name)).toEqual([
    "Lago di Levico",
    "Lago di Caldonazzo",
    "Lago Pudro",
  ]);
  expect(PLACES_AHEAD).toBe(3);
  expect(placesAhead(LEVICO_TERME, [FAR])).toEqual([]);
  expect(NEAR_ME_M).toBeLessThan(100_000);
});

test("a beach is a place as a lake is: its shapes are asked from its shore", async () => {
  const alassio = beaches.beaches.find((beach) => beach.name === "Alassio");
  expect(alassio).toBeDefined();
  const point = alassio?.point as LatLon;
  // The app's own list (TASK-245), a little inland of the beach.
  const here: LatLon = [point[0] + 0.01, point[1]];
  const places = placesAhead(here);
  expect(places[0]).toMatchObject({ name: "Alassio", point, distance_m: 2000 });
  expect(places.length).toBeLessThanOrEqual(PLACES_AHEAD);
  const { request, asked } = api(() => ({ kind: "unreachable", url: "https://api" }));
  expect(
    await drawShapesAhead("https://api", here, {
      request,
      storage: memory(),
      ...clock(),
      active: () => true,
    }),
  ).toBe("stopped");
  expect(asked).toEqual([
    { shape: "circle", distance_m: 2000, start: point, activity: "paddling" },
  ]);
});

test("every shape of the three places is asked, the nearest first, and kept", async () => {
  const { request, asked } = api();
  const { now, wait, waits, queue, turns } = clock();
  const outcome = await drawShapesAhead("https://api", LEVICO_TERME, {
    request,
    storage: memory(),
    spots: SPOTS,
    now,
    wait,
    queue,
  });
  expect(outcome).toBe("done");
  expect(asked.map((a) => a.start)).toEqual([
    ...SHAPES.map(() => LEVICO.point),
    ...SHAPES.map(() => CALDONAZZO.point),
    ...SHAPES.map(() => SMALL.point),
  ]);
  expect(asked.slice(0, 8).map((a) => a.shape)).toEqual(SHAPES);
  expect(asked.every((a) => a.activity === "paddling")).toBe(true);
  // A small lake at its own distance.
  expect(asked[0].distance_m).toBe(2000);
  expect(asked[23].distance_m).toBe(1000);
  // Each in its turn in the app's queue (TASK-287), after the user's and
  // the page's: the queue keeps them to their share of the minute.
  expect(turns).toEqual(Array.from({ length: 24 }, () => "prefetch"));
  expect(waits).toEqual([]);
  const { examples } = readAheadFile();
  expect(Object.keys(examples).sort()).toEqual(
    [keyOf(LEVICO), keyOf(CALDONAZZO), keyOf(SMALL)].sort(),
  );
  const kept = examples[keyOf(LEVICO)] as ExampleDetail[];
  expect(kept.map((d) => d.shape)).toEqual(SHAPES);
  expect(kept[0]).toMatchObject({
    city: "Lago di Levico",
    activity: "paddling",
    distance_m: 2000,
  });
  expect(kept[0].alternatives).toHaveLength(result.alternatives?.length ?? 0);
});

test("the next opening asks nothing", async () => {
  const first = api();
  const options = { storage: memory(), spots: SPOTS, ...clock() };
  await drawShapesAhead("https://api", LEVICO_TERME, {
    ...options,
    request: first.request,
  });
  const second = api();
  expect(
    await drawShapesAhead("https://api", LEVICO_TERME, {
      ...options,
      request: second.request,
    }),
  ).toBe("done");
  expect(second.asked).toEqual([]);
});

test("with a home area, the places nearest it: those «Explore» suggests (TASK-269)", async () => {
  const { request, asked } = api(() => ({ kind: "unreachable", url: "https://api" }));
  // The phone is near Como, on a trip; home is by Levico.
  await drawShapesAhead("https://api", FAR.point, {
    request,
    storage: memory(),
    spots: SPOTS,
    home: () => ({ point: LEVICO_TERME, place: "Levico Terme" }),
    ...clock(),
    active: () => true,
  });
  expect(asked.map((a) => a.start)).toEqual([LEVICO.point]);
  // A home area kept by «My activities» is read from the phone.
  files.set(
    "file:///documents/home-area.json",
    JSON.stringify({ point: FAR.point, place: "Como" }),
  );
  const fromFile = api(() => ({ kind: "unreachable", url: "https://api" }));
  await drawShapesAhead("https://api", LEVICO_TERME, {
    request: fromFile.request,
    storage: memory(),
    spots: SPOTS,
    ...clock(),
    active: () => true,
  });
  expect(fromFile.asked.map((a) => a.start)).toEqual([FAR.point]);
});

test("«Explore» shows the shapes drawn ahead at once, without the API", async () => {
  await drawShapesAhead("https://api", LEVICO_TERME, {
    request: api().request,
    storage: memory(),
    spots: [LEVICO],
    ...clock(),
  });
  const page = api();
  const place = { label: LEVICO.name, point: LEVICO.point };
  const options = {
    request: page.request,
    storage: memory(),
    set: examplesAt(LEVICO.distance_m),
  };
  const { result: hook } = await renderHook(() =>
    useCityExamples("https://api", place, options),
  );
  await act(async () => undefined);
  expect(hook.current.examples?.map((e) => e.status)).toEqual(
    SHAPES.map(() => "ready"),
  );
  expect(page.asked).toEqual([]);
});

test("what the page kept is not asked again, but what it would draw again", async () => {
  const set = examplesAt(LEVICO.distance_m);
  const place = { label: LEVICO.name, point: LEVICO.point };
  const heart = asRecommended(place, "heart", result, set).detail;
  // One kept before the pieces: drawn again, as the page would.
  const dog = asRecommended(place, "dog_head", result, set).detail;
  const { request, asked } = api();
  await drawShapesAhead("https://api", LEVICO_TERME, {
    request,
    storage: memory({ [keyOf(LEVICO)]: [heart, dog] }),
    spots: [LEVICO],
    ...clock(),
  });
  expect(asked.map((a) => a.shape)).toEqual(SHAPES.filter((s) => s !== "heart"));
});

test("a place whose shapes came with the app costs nothing", async () => {
  const riva = WATER_PLACES[0];
  const spot: WaterSpot = { name: riva.name, point: riva.point, distance_m: 2000 };
  expect(PADDLE_EXAMPLES.bundled?.[keyOf(spot)]).toHaveLength(8);
  const { request, asked } = api();
  expect(
    await drawShapesAhead("https://api", riva.point, {
      request,
      storage: memory(),
      spots: [spot],
      ...clock(),
    }),
  ).toBe("done");
  expect(asked).toEqual([]);
});

test("a shape the API cannot draw there is left out for a week, the others go on", async () => {
  const time = clock();
  const options = { storage: memory(), spots: [LEVICO], ...time };
  const first = api((asked) =>
    asked.shape === "horse"
      ? { kind: "api_error", code: "shape_not_drawable", message: "" }
      : undefined,
  );
  expect(
    await drawShapesAhead("https://api", LEVICO_TERME, {
      ...options,
      request: first.request,
    }),
  ).toBe("done");
  expect(first.asked).toHaveLength(8);
  expect(
    (readAheadFile().examples[keyOf(LEVICO)] as ExampleDetail[]).map((d) => d.shape),
  ).toEqual(SHAPES.filter((shape) => shape !== "horse"));
  const soon = api();
  await drawShapesAhead("https://api", LEVICO_TERME, {
    ...options,
    request: soon.request,
  });
  expect(soon.asked).toEqual([]);
  await time.wait(LEFT_OUT_MS);
  const later = api();
  await drawShapesAhead("https://api", LEVICO_TERME, {
    ...options,
    request: later.request,
  });
  expect(later.asked.map((a) => a.shape)).toEqual(["horse"]);
});

test("without the network the round stops, and goes on at the next opening", async () => {
  const options = { storage: memory(), spots: SPOTS, ...clock() };
  let left = 3;
  const first = api(() =>
    left-- > 0 ? undefined : { kind: "unreachable", url: "https://api" },
  );
  expect(
    await drawShapesAhead("https://api", LEVICO_TERME, {
      ...options,
      request: first.request,
    }),
  ).toBe("stopped");
  expect(first.asked).toHaveLength(4);
  const second = api();
  expect(
    await drawShapesAhead("https://api", LEVICO_TERME, {
      ...options,
      request: second.request,
    }),
  ).toBe("done");
  expect(second.asked).toHaveLength(24 - 3);
});

test("a place without water on the server is passed over", async () => {
  const { request, asked } = api((a) =>
    a.start === LEVICO.point
      ? { kind: "api_error", code: "map_data_unavailable", message: "" }
      : undefined,
  );
  expect(
    await drawShapesAhead("https://api", LEVICO_TERME, {
      request,
      storage: memory(),
      spots: SPOTS,
      ...clock(),
    }),
  ).toBe("done");
  expect(asked.filter((a) => a.start === LEVICO.point)).toHaveLength(1);
  expect(asked).toHaveLength(1 + 16);
});

test("in the background nothing is asked: the round waits for the app", async () => {
  const { request, asked } = api();
  const time = clock();
  let away = 2;
  const seen: number[] = [];
  const outcome = await drawShapesAhead("https://api", LEVICO_TERME, {
    request,
    storage: memory(),
    spots: [LEVICO],
    ...time,
    active: () => {
      seen.push(asked.length);
      // Left after the third shape, for two looks.
      return asked.length !== 3 || away-- <= 0;
    },
  });
  expect(outcome).toBe("done");
  expect(asked).toHaveLength(8);
  expect(seen.filter((n) => n === 3)).toHaveLength(3);
  expect(time.waits).toEqual([IN_FRONT_CHECK_MS, IN_FRONT_CHECK_MS]);
});

test("one round at a time", async () => {
  let answer: (outcome: RouteOutcome) => void = () => undefined;
  const request = jest.fn(
    () => new Promise<RouteOutcome>((resolve) => (answer = resolve)),
  ) as unknown as typeof requestRoute;
  const options = { request, storage: memory(), spots: [LEVICO], ...clock() };
  const going = drawShapesAhead("https://api", LEVICO_TERME, options);
  expect(await drawShapesAhead("https://api", LEVICO_TERME, options)).toBe("busy");
  answer({ kind: "timeout" });
  expect(await going).toBe("stopped");
});

test("the file keeps the places drawn last, and reads whatever it holds", async () => {
  const spots = Array.from({ length: MAX_PLACES_KEPT + 1 }, (_, i): WaterSpot => ({
    name: `Lake ${i}`,
    point: [46 + i, 11],
    distance_m: 2000,
  }));
  for (const spot of spots) {
    await drawShapesAhead("https://api", spot.point, {
      request: api().request,
      storage: memory(),
      spots: [spot],
      ...clock(),
    });
  }
  const keys = Object.keys(readAheadFile().examples);
  expect(keys).toHaveLength(MAX_PLACES_KEPT);
  expect(keys[0]).toBe(keyOf(spots[MAX_PLACES_KEPT]));
  expect(keys).not.toContain(keyOf(spots[0]));

  files.set("file:///documents/paddle-ahead.json", "not json");
  expect(readAheadFile()).toEqual({ examples: {}, leftOut: {} });
  writeAheadFile({ examples: { a: "nonsense" }, leftOut: {} });
  files.set(
    "file:///documents/paddle-ahead.json",
    JSON.stringify({ examples: [], leftOut: { a: { heart: "x", star: 5 }, b: 3 } }),
  );
  expect(readAheadFile()).toEqual({ examples: {}, leftOut: { a: { star: 5 } } });
});
