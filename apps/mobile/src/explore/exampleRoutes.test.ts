import type { RouteResult, Shape } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import penUpFixture from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import { act, renderHook } from "@testing-library/react-native";

import type { requestRoute, RouteOutcome } from "../api/routes";
import type { Place } from "../places/photon";
import {
  asRecommended,
  cityKey,
  DRAW_ORDER,
  drawExamples,
  EXAMPLE_DISTANCE_M,
  EXAMPLE_SHAPES,
  EXAMPLE_WORDS,
  EXAMPLES_PER_MINUTE,
  exampleDetail,
  exampleRequest,
  examplesKey,
  type Example,
  type ExampleSet,
  firstExamples,
  forgetExamples,
  isMore,
  MAX_KEPT_CITIES,
  MORE_SHAPES,
  movedExample,
  moreWaitMs,
  PADDLE_EXAMPLES,
  readKept,
  RUN_EXAMPLES,
  shownExamples,
  shownWords,
  type Storage,
  thinned,
  useCityExamples,
  type WordExample,
} from "./exampleRoutes";
import type { RecommendedRouteDetail } from "./recommendedRoutes";

const result = fixture as unknown as RouteResult;
const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
  kind: "city",
};
const levico: Place = { label: "Levico Terme, Trentino", point: [46.0091, 11.3018] };

/** A file in memory, as the phone's. */
function memory(): Storage & { kept: Record<string, RecommendedRouteDetail[]> } {
  const store = {
    kept: {} as Record<string, RecommendedRouteDetail[]>,
    load: () => JSON.parse(JSON.stringify(store.kept)),
    save: (kept: Record<string, RecommendedRouteDetail[]>) => {
      store.kept = kept;
    },
  };
  return store;
}

/** The API by hand: each request waits until the test answers it. */
function api() {
  const asked: {
    shape: Shape;
    /** A word's (TASK-279), or null for a shape. */
    word: string | null;
    penUp: boolean;
    signal?: AbortSignal;
    answer: (o: RouteOutcome) => void;
  }[] = [];
  const request = jest.fn(
    (
      _url: string,
      body: { shape?: Shape | null; word?: string | null; pen_up?: boolean },
      options?: { signal?: AbortSignal },
    ) =>
      new Promise<RouteOutcome>((resolve) => {
        asked.push({
          shape: body.shape as Shape,
          word: body.word ?? null,
          penUp: body.pen_up === true,
          signal: options?.signal,
          answer: resolve,
        });
      }),
  ) as unknown as typeof requestRoute & jest.Mock;
  return { request, asked };
}

/** Where the first shapes are; the others have their own tests. */
function statuses(key: string, read: () => Example[] | null): string {
  return (
    firstExamples(read() ?? [])
      .map((e) => `${e.shape}:${e.status}`)
      .join(" ") + ` (${key})`
  );
}

/** Where the shapes drawn after the first ones are. */
function others(read: () => Example[] | null): string {
  return (read() ?? [])
    .filter((e) => isMore(e.shape))
    .map((e) => `${e.shape}:${e.status}`)
    .join(" ");
}

const EVERY_SHAPE = EXAMPLE_SHAPES.length + MORE_SHAPES.length;
/** The shapes and then the words (TASK-279): all a city asks. */
const EVERY_EXAMPLE = EVERY_SHAPE + EXAMPLE_WORDS.length;
/** A word as the API writes it, the pen up between its letters. */
const written = penUpFixture as unknown as RouteResult;

/** Answers requests `from` to `to`, one after the other: a shape with
 * `result`, a word with `written`. */
async function answerAll(
  asked: ReturnType<typeof api>["asked"],
  from: number,
  to: number,
): Promise<void> {
  for (let i = from; i < to; i += 1) {
    const { word } = asked[i];
    await act(async () =>
      asked[i].answer({ kind: "route", result: word === null ? result : written }),
    );
  }
}

/** Where the words are (TASK-279). */
function wordsNow(read: () => WordExample[] | null): string {
  return (read() ?? []).map((e) => `${e.word}:${e.status}`).join(" ");
}

/** The cities' shapes alone, as before the words: for what is the shapes'. */
const SHAPES_ONLY: ExampleSet = { ...RUN_EXAMPLES, words: [] };
const notDrawable: RouteOutcome = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "no",
  suggested_distance_m: null,
};

beforeEach(() => {
  forgetExamples();
});

// A shape waiting for the minute's allowance holds a timer.
afterAll(() => {
  forgetExamples();
});

test("a city's key, a thinned line, a route as the list has it", () => {
  expect(cityKey([45.32519, 8.42277])).toBe("45.3252,8.4228");
  const line = Array.from(
    { length: 500 },
    (_, i) => [45 + i / 1e4, 8] as [number, number],
  );
  const thin = thinned(line, 60);
  expect(thin.length).toBe(60);
  expect(thin[0]).toBe(line[0]);
  expect(thin[59]).toBe(line[499]);
  expect(thinned(line.slice(0, 10))).toHaveLength(10);

  const { route, detail } = asRecommended(vercelli, "heart", result);
  expect(route).toMatchObject({
    id: "example:heart:45.3252,8.4228",
    city: "Vercelli",
    shape: "heart",
    word: null,
    distance_m: EXAMPLE_DISTANCE_M,
    route_m: result.distance_m,
    similarity: result.similarity,
    start: result.points[0],
  });
  expect(route.away_m).toBeGreaterThan(0);
  expect(detail.points).toBe(result.points);
  expect(detail.license).toMatch(/OpenStreetMap/);
});

test("the heart is the first card, the circle the first asked, one at a time", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.examples;
  // The circle's zone holds the others': asked first, one download for all.
  expect(statuses("start", read)).toBe(
    "heart:waiting circle:drawing star:waiting (start)",
  );
  expect(asked.map((a) => a.shape)).toEqual(["circle"]);
  expect(request.mock.calls[0][1]).toEqual({
    shape: "circle",
    distance_m: EXAMPLE_DISTANCE_M,
    start: vercelli.point,
    activity: "running",
  });

  await act(async () => asked[0].answer({ kind: "route", result }));
  expect(statuses("circle", read)).toBe(
    "heart:drawing circle:ready star:waiting (circle)",
  );
  await act(async () => asked[1].answer(notDrawable));
  await act(async () => asked[2].answer({ kind: "route", result }));
  expect(statuses("end", read)).toBe("heart:failed circle:ready star:ready (end)");
  expect(asked.map((a) => a.shape).slice(0, 3)).toEqual(["circle", "heart", "star"]);

  // The ready ones open whole, and the file has them for next time.
  const circle = read()?.[1];
  expect(circle?.status === "ready" && exampleDetail(circle.route.id)?.points).toBe(
    result.points,
  );
  expect(storage.kept[cityKey(vercelli.point)].map((d) => d.shape)).toEqual([
    "circle",
    "star",
  ]);
});

test("the order of asking: the first three, then the others, largest zone first", () => {
  expect([...DRAW_ORDER].sort()).toEqual([...EXAMPLE_SHAPES, ...MORE_SHAPES].sort());
  expect(DRAW_ORDER.slice(0, EXAMPLE_SHAPES.length).sort()).toEqual(
    [...EXAMPLE_SHAPES].sort(),
  );
  // Measured on the engine (ADR-0144): the circle reaches farthest of all,
  // the moon of those drawn after the first three.
  expect(DRAW_ORDER[0]).toBe("circle");
  expect(DRAW_ORDER[EXAMPLE_SHAPES.length]).toBe("moon");
});

test("the next time, after closing the app: from the file, nothing asked", async () => {
  const first = api();
  const storage = memory();
  drawExamples("http://api", vercelli, { request: first.request, storage });
  await answerAll(first.asked, 0, EVERY_EXAMPLE);
  expect(first.asked).toHaveLength(EVERY_EXAMPLE);
  forgetExamples(); // the app closed

  const again = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request: again.request, storage }),
  );
  expect(hook.current.examples?.map((e) => e.status)).toEqual(
    Array.from({ length: EVERY_SHAPE }, () => "ready"),
  );
  // The words too (TASK-279), with the walks between their letters.
  expect(wordsNow(() => hook.current.words)).toBe(
    EXAMPLE_WORDS.map((word) => `${word}:ready`).join(" "),
  );
  expect(again.request).not.toHaveBeenCalled();
  const star = hook.current.examples?.[2];
  expect(star?.status === "ready" && exampleDetail(star.route.id)).toBeTruthy();
  const [ciao] = hook.current.words ?? [];
  expect(ciao.status === "ready" && exampleDetail(ciao.route.id)?.walks).toEqual(
    written.walks,
  );
  expect(ciao.status === "ready" && ciao.route.gaps).toEqual([3, 4, 5]);
});

test("no map for the zone: every shape says so, and Try again asks again", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  await act(async () =>
    asked[0].answer({
      kind: "api_error",
      code: "map_data_unavailable",
      message: "Overpass refused",
    }),
  );
  const examples = hook.current.examples ?? [];
  expect(new Set(examples.map((e) => e.status))).toEqual(new Set(["failed"]));
  expect(examples).toHaveLength(EVERY_SHAPE);
  expect(examples[0].status === "failed" && examples[0].message).toMatch(
    /could not be downloaded/,
  );
  expect(asked).toHaveLength(1);

  await act(async () => hook.current.retry());
  expect(asked.map((a) => a.shape)).toEqual(["circle", "circle"]);
});

test("another city stops the one drawing; coming back asks what is missing", async () => {
  const { request, asked } = api();
  const storage = memory();
  drawExamples("http://api", vercelli, { request, storage });
  drawExamples("http://api", levico, { request, storage });
  expect(asked[0].signal?.aborted).toBe(true);
  expect(asked[1].shape).toBe("circle");
  await act(async () => asked[0].answer({ kind: "cancelled" }));

  // The same city twice asks once.
  drawExamples("http://api", levico, { request, storage });
  expect(asked).toHaveLength(2);

  drawExamples("http://api", vercelli, { request, storage });
  expect(asked[1].signal?.aborted).toBe(true);
  expect(asked[2].shape).toBe("circle");
});

test("the file keeps the last cities and drops what does not read", () => {
  const detail = asRecommended(vercelli, "heart", result).detail;
  expect(readKept({ a: [detail, { id: "bad" }], b: "nonsense" })).toEqual({
    a: [detail],
  });
  expect(readKept(null)).toEqual({});
  expect(readKept([detail])).toEqual({});
  expect(MAX_KEPT_CITIES).toBeGreaterThanOrEqual(5);
});

test("the file holds at most MAX_KEPT_CITIES cities, the last first", async () => {
  const storage = memory();
  for (let i = 0; i < MAX_KEPT_CITIES + 2; i += 1) {
    const city: Place = { label: `City ${i}`, point: [45 + i / 10, 8] };
    const { request, asked } = api();
    drawExamples("http://api", city, { request, storage });
    for (let j = 0; j < EXAMPLE_SHAPES.length; j += 1) {
      await act(async () => asked[j].answer({ kind: "route", result }));
    }
  }
  const keys = Object.keys(storage.kept);
  expect(keys).toHaveLength(MAX_KEPT_CITIES);
  expect(keys[0]).toBe(cityKey([45 + (MAX_KEPT_CITIES + 1) / 10, 8]));
});

test("no city or no API: no examples", async () => {
  const { request } = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples(null, vercelli, { request, storage: memory() }),
  );
  expect(hook.current.examples).toBeNull();
  const { result: none } = await renderHook(() =>
    useCityExamples("http://api", null, { request, storage: memory() }),
  );
  expect(none.current.examples).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("an example keeps the routes to choose from, and so does the file (TASK-151)", async () => {
  const [other] = result.alternatives ?? [];
  expect(other).toBeDefined();
  const { detail } = asRecommended(vercelli, "heart", result);
  expect(detail.alternatives).toHaveLength(1);
  expect(detail.alternatives?.[0]).toMatchObject({
    shape: "heart",
    distance_m: EXAMPLE_DISTANCE_M,
    route_m: other.distance_m,
    similarity: other.similarity,
    points: other.points,
  });
  // An older API sends none: an example with nothing else to choose.
  const alone = { ...result, alternatives: undefined };
  expect(asRecommended(vercelli, "heart", alone).detail.alternatives).toEqual([]);

  const { request, asked } = api();
  const storage = memory();
  drawExamples("http://api", vercelli, { request, storage });
  await act(async () => asked[0].answer({ kind: "route", result }));
  const [kept] = readKept(storage.load())[cityKey(vercelli.point)];
  expect(kept.alternatives?.map((a) => a.points)).toEqual([other.points]);
});

test("an example kept before the routes to choose from is drawn again", async () => {
  const storage = memory();
  const { alternatives: _none, ...old } = asRecommended(
    vercelli,
    "heart",
    result,
  ).detail;
  const star = asRecommended(vercelli, "star", result).detail;
  storage.kept = { [cityKey(vercelli.point)]: [old, star] };

  const { request, asked } = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  expect(statuses("old file", () => hook.current.examples)).toBe(
    "heart:waiting circle:drawing star:ready (old file)",
  );
  expect(asked.map((a) => a.shape)).toEqual(["circle"]);
});

test("alternatives that do not read are as none kept", () => {
  const detail = asRecommended(vercelli, "heart", result).detail;
  const { alternatives: _none, ...route } = detail;
  expect(readKept({ a: [{ ...detail, alternatives: [{ id: "bad" }] }] })).toEqual({
    a: [route],
  });
  expect(readKept({ a: [{ ...detail, alternatives: "nonsense" }] })).toEqual({
    a: [route],
  });
});

test("after the first three, other shapes, one at a time (TASK-176)", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.examples;
  // While the first are drawn the others wait, and show no card.
  expect(others(read)).toBe(MORE_SHAPES.map((shape) => `${shape}:waiting`).join(" "));
  expect(shownExamples(read() ?? []).map((e) => e.shape)).toEqual([...EXAMPLE_SHAPES]);

  for (let i = 0; i < EXAMPLE_SHAPES.length; i += 1) {
    await act(async () => asked[i].answer({ kind: "route", result }));
  }
  expect(asked.map((a) => a.shape)).toEqual(DRAW_ORDER.slice(0, 4));
  expect(request.mock.calls[3][1]).toEqual({
    shape: MORE_SHAPES[0],
    distance_m: EXAMPLE_DISTANCE_M,
    start: vercelli.point,
    activity: "running",
  });
  // The one being drawn is a card; the ones after it are not, yet.
  expect(shownExamples(read() ?? []).map((e) => `${e.shape}:${e.status}`)).toEqual([
    "heart:ready",
    "circle:ready",
    "star:ready",
    `${MORE_SHAPES[0]}:drawing`,
  ]);

  await act(async () => asked[3].answer({ kind: "route", result }));
  expect(asked[4].shape).toBe(MORE_SHAPES[1]);
  const [first] = (read() ?? []).filter((e) => isMore(e.shape));
  expect(first.status === "ready" && exampleDetail(first.route.id)?.points).toBe(
    result.points,
  );
  // Kept with the first ones, for the next time.
  expect(storage.kept[cityKey(vercelli.point)].map((d) => d.shape)).toEqual([
    ...EXAMPLE_SHAPES,
    MORE_SHAPES[0],
  ]);
});

test("another shape that does not come out is left out, and not asked again", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.examples;
  for (let i = 0; i < EXAMPLE_SHAPES.length; i += 1) {
    await act(async () => asked[i].answer({ kind: "route", result }));
  }
  await act(async () => asked[3].answer(notDrawable));
  // No card for it, no error: the next one is drawn.
  expect(shownExamples(read() ?? []).map((e) => e.shape)).toEqual([
    ...EXAMPLE_SHAPES,
    MORE_SHAPES[1],
  ]);
  await answerAll(asked, 4, EVERY_EXAMPLE);
  expect(asked).toHaveLength(EVERY_EXAMPLE);

  // Choosing the city again, or Try again, does not ask for it.
  await act(async () => hook.current.retry());
  await act(async () => {
    drawExamples("http://api", levico, { request, storage });
    drawExamples("http://api", vercelli, { request, storage });
  });
  expect(asked.map((a) => a.shape).slice(EVERY_EXAMPLE)).toEqual(["circle"]);
  expect(asked.filter((a) => a.shape === MORE_SHAPES[0])).toHaveLength(1);
});

test("trouble that is not a shape's stops the other shapes, quietly", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.examples;
  await act(async () => asked[0].answer({ kind: "route", result }));
  await act(async () => asked[1].answer(notDrawable));
  await act(async () => asked[2].answer({ kind: "route", result }));
  const heart = () => read()?.[0];
  const said = heart()?.status === "failed" ? heart() : undefined;
  expect(said).toBeDefined();

  // Too many requests in a minute, or no network: nothing to do with the moon.
  await act(async () =>
    asked[3].answer({
      kind: "api_error",
      code: "too_many_requests",
      message: "slow down",
      suggested_distance_m: null,
    }),
  );
  // The first three stay as they were, the heart with its own words; no
  // card and no error for the others, and none of them is asked.
  expect(statuses("stopped", read)).toBe(
    "heart:failed circle:ready star:ready (stopped)",
  );
  expect(heart()).toEqual(said);
  expect(shownExamples(read() ?? [])).toHaveLength(EXAMPLE_SHAPES.length);
  expect(others(read)).toBe(MORE_SHAPES.map((shape) => `${shape}:failed`).join(" "));
  // So the words (TASK-279): no card, none asked.
  expect(shownWords(hook.current.words ?? [])).toEqual([]);
  expect(wordsNow(() => hook.current.words)).toBe(
    EXAMPLE_WORDS.map((word) => `${word}:failed`).join(" "),
  );
  expect(asked).toHaveLength(4);

  // The next time the city is chosen they are asked again, the heart first.
  await act(async () => {
    drawExamples("http://api", levico, { request, storage });
    drawExamples("http://api", vercelli, { request, storage });
  });
  expect(asked.at(-1)?.shape).toBe("heart");
  await act(async () => asked.at(-1)?.answer({ kind: "route", result }));
  expect(asked.at(-1)?.shape).toBe(MORE_SHAPES[0]);
});

test("examples kept before the other shapes: only those are asked", async () => {
  const storage = memory();
  storage.kept = {
    [cityKey(vercelli.point)]: EXAMPLE_SHAPES.map(
      (shape) => asRecommended(vercelli, shape, result).detail,
    ),
  };
  const { request, asked } = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  expect(statuses("kept", () => hook.current.examples)).toBe(
    "heart:ready circle:ready star:ready (kept)",
  );
  expect(asked.map((a) => a.shape)).toEqual([MORE_SHAPES[0]]);
});

test("cities the API has drawn already: the other shapes keep to the minute's allowance", async () => {
  jest.useFakeTimers();
  try {
    const { request, asked } = api();
    const storage = memory();
    const cities = [0, 1, 2].map((i): Place => ({
      label: `City ${i}`,
      point: [45 + i / 10, 8],
    }));
    const answerNext = () =>
      act(async () => asked.at(-1)?.answer({ kind: "route", result }));
    // The shapes alone: the words keep to the same allowance (below).
    const set = SHAPES_ONLY;
    // Two cities, every shape answered at once: all sixteen are asked.
    expect(2 * EVERY_SHAPE).toBeLessThan(EXAMPLES_PER_MINUTE);
    for (const city of cities.slice(0, 2)) {
      drawExamples("http://api", city, { request, storage, set });
      for (let i = 0; i < EVERY_SHAPE; i += 1) {
        await answerNext();
      }
    }
    expect(asked).toHaveLength(2 * EVERY_SHAPE);
    expect(moreWaitMs(Date.now())).toBe(0);

    // The third city has its first three at once, as ever; the others wait:
    // the API takes 30 POSTs a minute, and they are not all for examples.
    drawExamples("http://api", cities[2], { request, storage, set });
    for (let i = 0; i < EXAMPLE_SHAPES.length; i += 1) {
      await answerNext();
    }
    const first = 2 * EVERY_SHAPE + EXAMPLE_SHAPES.length;
    expect(first).toBeGreaterThanOrEqual(EXAMPLES_PER_MINUTE);
    expect(asked).toHaveLength(first);
    expect(moreWaitMs(Date.now())).toBe(60_000);

    // A minute later the requests of before no longer count.
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(asked).toHaveLength(first + 1);
    expect(asked.at(-1)?.shape).toBe(MORE_SHAPES[0]);
  } finally {
    jest.useRealTimers();
  }
});

test("another city chosen while a shape waits for its allowance: it stops waiting", async () => {
  jest.useFakeTimers();
  try {
    const { request, asked } = api();
    const storage = memory();
    const cities = [0, 1, 2, 3].map((i): Place => ({
      label: `City ${i}`,
      point: [45 + i / 10, 8],
    }));
    const answerNext = () =>
      act(async () => asked.at(-1)?.answer({ kind: "route", result }));
    const set = SHAPES_ONLY;
    for (const city of cities.slice(0, 2)) {
      drawExamples("http://api", city, { request, storage, set });
      for (let i = 0; i < EVERY_SHAPE; i += 1) {
        await answerNext();
      }
    }
    drawExamples("http://api", cities[2], { request, storage, set });
    for (let i = 0; i < EXAMPLE_SHAPES.length; i += 1) {
      await answerNext();
    }
    const before = asked.length;
    // The fourth city's first three are asked at once all the same.
    drawExamples("http://api", cities[3], { request, storage, set });
    expect(asked).toHaveLength(before + 1);
    expect(asked.at(-1)?.shape).toBe(DRAW_ORDER[0]);
    // And the third city's other shapes are not asked behind its back.
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(asked).toHaveLength(before + 1);
  } finally {
    jest.useRealTimers();
  }
});

describe("on the water (TASK-191)", () => {
  // A place of «Explore» (its examples come with the app) and a start that
  // is not one, as «Near me» gives (TASK-227).
  const garda: Place = { label: "Lago di Garda", point: [45.88114, 10.84559] };
  const malcesine: Place = { label: "Your start", point: [45.7636, 10.8098] };
  const set = PADDLE_EXAMPLES;
  const eight: Shape[] = [...EXAMPLE_SHAPES, ...MORE_SHAPES];

  test("a place of «Explore» comes with the app: eight ready, nothing asked", async () => {
    const { request } = api();
    const storage = memory();
    const { result: hook } = await renderHook(() =>
      useCityExamples("http://api", garda, { request, storage, set }),
    );
    const list = hook.current.examples ?? [];
    expect(list.map((e) => `${e.shape}:${e.status}`)).toEqual(
      eight.map((shape) => `${shape}:ready`),
    );
    expect(request).not.toHaveBeenCalled();
    // Nothing is written to the phone: the app has them.
    expect(storage.kept).toEqual({});
    const heart = list[0];
    const detail = heart.status === "ready" ? exampleDetail(heart.route.id) : undefined;
    expect(detail).toMatchObject({
      id: "example:heart:paddling:45.8811,10.8456",
      shape: "heart",
      city: "Lago di Garda",
      distance_m: 2000,
      activity: "paddling",
      alternatives: [],
    });
    expect(detail?.points.length).toBeGreaterThan(100);
    // A head has its eyes apart (TASK-226): its card draws every point but
    // the stretches with the pen up; a shape in one line a few points.
    const dog = list.find((e) => e.shape === "dog_head");
    const whole = dog?.status === "ready" ? exampleDetail(dog.route.id) : undefined;
    expect(whole?.walks).toHaveLength(3);
    expect(dog?.status === "ready" && dog.route.preview).toEqual(whole?.points);
    expect(dog?.status === "ready" && dog.route.gaps).toEqual(
      whole?.walks?.map(([, to]) => to),
    );
    expect(heart.status === "ready" && heart.route.preview.length).toBe(60);
    expect(heart.status === "ready" && heart.route.gaps).toBeUndefined();
  });

  test("without an API the places of «Explore» show all the same", async () => {
    const { request } = api();
    const storage = memory();
    const { result: hook } = await renderHook(() =>
      useCityExamples(null, garda, { request, storage, set }),
    );
    expect(hook.current.examples?.every((e) => e.status === "ready")).toBe(true);
    expect(request).not.toHaveBeenCalled();
    const { result: near } = await renderHook(() =>
      useCityExamples(null, malcesine, { request, storage, set }),
    );
    expect(near.current.examples).toBeNull();
  });

  test("elsewhere the eight of 2 km are asked, in paddling, as a city's", async () => {
    const { request, asked } = api();
    const storage = memory();
    const { result: hook } = await renderHook(() =>
      useCityExamples("http://api", malcesine, { request, storage, set }),
    );
    const read = () => hook.current.examples;
    expect(request.mock.calls[0][1]).toEqual({
      shape: "circle",
      distance_m: 2000,
      start: malcesine.point,
      activity: "paddling",
    });
    for (let i = 0; i < eight.length; i += 1) {
      await act(async () => asked[i].answer({ kind: "route", result }));
    }
    expect(asked.map((a) => a.shape)).toEqual(DRAW_ORDER);
    // The heads are asked piece by piece, the pen up between their eyes and
    // their outline (TASK-226); the shapes in one line as before.
    expect(asked.filter((a) => a.penUp).map((a) => a.shape)).toEqual([
      "dog_head",
      "rabbit_head",
    ]);
    expect(read()?.map((e) => `${e.shape}:${e.status}`)).toEqual(
      eight.map((shape) => `${shape}:ready`),
    );

    // Opened whole, it says it is on the water, and so does the file.
    const heart = read()?.[0];
    const detail =
      heart?.status === "ready" ? exampleDetail(heart.route.id) : undefined;
    expect(detail).toMatchObject({
      shape: "heart",
      city: "Your start",
      distance_m: 2000,
      activity: "paddling",
    });
    const key = examplesKey(malcesine.point, set);
    expect(key).toBe("paddling:45.7636,10.8098");
    expect(storage.kept[key].map((d) => d.activity)).toEqual(
      eight.map(() => "paddling"),
    );
    // A run's examples of the same point are another set.
    expect(storage.kept[cityKey(malcesine.point)]).toBeUndefined();
  });

  test("a head drawn in pieces keeps its pen up, and one kept before is drawn again", async () => {
    const walks: [number, number][] = [[1, 2]];
    const inPieces = { ...result, walks } as RouteResult;
    const { request, asked } = api();
    const storage = memory();
    const { result: hook } = await renderHook(() =>
      useCityExamples("http://api", malcesine, { request, storage, set }),
    );
    for (let i = 0; i < eight.length; i += 1) {
      const answer = asked[i].penUp ? inPieces : result;
      await act(async () => asked[i].answer({ kind: "route", result: answer }));
    }
    const key = examplesKey(malcesine.point, set);
    const kept = storage.kept[key];
    expect(kept.filter((d) => d.walks !== undefined).map((d) => d.shape)).toEqual([
      "dog_head",
      "rabbit_head",
    ]);
    const dog = hook.current.examples?.find((e) => e.shape === "dog_head");
    const detail = dog?.status === "ready" ? exampleDetail(dog.route.id) : undefined;
    expect(detail?.walks).toEqual(walks);

    // The same file as an app before TASK-226 left it: the heads in one
    // line. They are drawn again, with the pen up; the others stay.
    forgetExamples();
    storage.kept = { [key]: kept.map(({ walks: _, ...before }) => before) };
    const again = api();
    drawExamples("http://api", malcesine, { request: again.request, storage, set });
    expect(again.asked.map((a) => `${a.shape}:${a.penUp}`)).toEqual(["dog_head:true"]);
    await act(async () => again.asked[0].answer({ kind: "route", result: inPieces }));
    expect(again.asked.map((a) => a.shape)).toEqual(["dog_head", "rabbit_head"]);
  });

  test("a run's heads are drawn in one line, as before", async () => {
    const { request, asked } = api();
    drawExamples("http://api", malcesine, { request, storage: memory() });
    for (let i = 0; i < eight.length; i += 1) {
      await act(async () => asked[i].answer({ kind: "route", result }));
    }
    // After them the words, with the pen up (TASK-279).
    const shapes = asked.filter((a) => a.word === null);
    expect(shapes.map((a) => a.shape)).toEqual(DRAW_ORDER);
    expect(shapes.some((a) => a.penUp)).toBe(false);
    const shapeBodies = request.mock.calls.filter(([, body]) => "shape" in body);
    expect(shapeBodies).toHaveLength(eight.length);
    expect(shapeBodies.every(([, body]) => !("pen_up" in body))).toBe(true);
  });

  test("a run's examples of the same point stay apart, and say no activity", async () => {
    const run = api();
    const storage = memory();
    drawExamples("http://api", malcesine, { request: run.request, storage });
    await act(async () => run.asked[0].answer({ kind: "route", result }));
    const water = api();
    drawExamples("http://api", malcesine, { request: water.request, storage, set });
    expect(water.request.mock.calls[0][1]).toMatchObject({ activity: "paddling" });
    const kept = storage.kept[cityKey(malcesine.point)];
    expect(kept.map((d) => d.shape)).toEqual(["circle"]);
    expect(kept[0]).not.toHaveProperty("activity");
    expect(asRecommended(malcesine, "heart", result).detail).not.toHaveProperty(
      "activity",
    );
  });

  test("a shape that does not fit the water says it in the water's words", async () => {
    const { request, asked } = api();
    const { result: hook } = await renderHook(() =>
      useCityExamples("http://api", malcesine, { request, storage: memory(), set }),
    );
    await act(async () =>
      asked[0].answer({
        kind: "api_error",
        code: "shape_not_drawable",
        message: "there is no lake or sea to paddle on within 2 km of here",
      }),
    );
    expect(hook.current.examples?.[1]).toEqual({
      shape: "circle",
      status: "failed",
      message:
        "There is no lake or sea near this start. Start from the shore, within 2 km of the water.",
    });
  });
});

describe("where its shape is, to be moved (TASK-244)", () => {
  const garda: Place = { label: "Lago di Garda", point: [45.88114, 10.84559] };
  const malcesine: Place = { label: "Your start", point: [45.7636, 10.8098] };
  const set = PADDLE_EXAMPLES;
  const centre: [number, number] = [45.7641, 10.8112];
  const placed = { ...result, centre } as RouteResult;

  test("an example of the app says its centre, and how it was asked", async () => {
    const { request } = api();
    const storage = memory();
    const { result: hook } = await renderHook(() =>
      useCityExamples("http://api", garda, { request, storage, set }),
    );
    const list = hook.current.examples ?? [];
    const heart = list[0];
    const dog = list.find((e) => e.shape === "dog_head");
    if (heart.status !== "ready" || dog?.status !== "ready") {
      throw new Error("the app's examples should be ready");
    }
    expect(exampleDetail(heart.route.id)?.centre).toEqual([45.878804, 10.844628]);
    // From the place, not from where the route begins: the API reads the
    // same water again.
    expect(exampleRequest(heart.route.id)).toEqual({
      shape: "heart",
      distance_m: 2000,
      start: garda.point,
      activity: "paddling",
    });
    // A head, with its eyes apart as it was drawn (TASK-226).
    expect(exampleRequest(dog.route.id)).toEqual({
      shape: "dog_head",
      pen_up: true,
      distance_m: 2000,
      start: garda.point,
      activity: "paddling",
    });
    expect(exampleRequest("example:heart:paddling:0.0000,0.0000")).toBeUndefined();
  });

  test("one asked to the API keeps the centre it answers, and so does the file", async () => {
    const { request, asked } = api();
    const storage = memory();
    const { result: hook, unmount } = await renderHook(() =>
      useCityExamples("http://api", malcesine, { request, storage, set }),
    );
    // The circle with its centre; the heart from an API of before TASK-238.
    await act(async () => asked[0].answer({ kind: "route", result: placed }));
    await act(async () => asked[1].answer({ kind: "route", result }));
    const [heart, circle] = hook.current.examples ?? [];
    if (heart.status !== "ready" || circle.status !== "ready") {
      throw new Error("the first two should be ready");
    }
    expect(exampleDetail(circle.route.id)?.centre).toEqual(centre);
    expect(exampleDetail(heart.route.id)).not.toHaveProperty("centre");
    expect(exampleRequest(circle.route.id)).toEqual({
      shape: "circle",
      distance_m: 2000,
      start: malcesine.point,
      activity: "paddling",
    });
    const key = examplesKey(malcesine.point, set);
    expect(storage.kept[key].map((d) => [d.shape, "centre" in d])).toEqual([
      ["heart", false],
      ["circle", true],
    ]);

    // The next time, from the file: the centre and the request are back.
    unmount();
    forgetExamples();
    expect(exampleRequest(circle.route.id)).toBeUndefined();
    const again = api();
    await renderHook(() =>
      useCityExamples("http://api", malcesine, {
        request: again.request,
        storage,
        set,
      }),
    );
    expect(exampleDetail(circle.route.id)?.centre).toEqual(centre);
    expect(exampleRequest(circle.route.id)?.start).toEqual(malcesine.point);
    // One kept without its centre is not asked again for that: it is not
    // moved until it is drawn again.
    expect(again.asked.map((a) => a.shape)).not.toContain("heart");
  });

  test("a run's example has no centre, and one that does not read is dropped", () => {
    expect(asRecommended(vercelli, "heart", result).detail).not.toHaveProperty(
      "centre",
    );
    const detail = asRecommended(malcesine, "heart", placed, set).detail;
    expect(detail.centre).toEqual(centre);
    const { centre: dropped, ...without } = detail;
    expect(dropped).toEqual(centre);
    expect(
      readKept({
        a: [detail, { ...detail, centre: "there" }, { ...detail, centre: [1] }],
      }),
    ).toEqual({ a: [detail, without, without] });
  });

  test("moved, the example is the engine's answer, the rest as it was", () => {
    const head = asRecommended(
      malcesine,
      "dog_head",
      { ...placed, walks: [[1, 2]] } as RouteResult,
      set,
    ).detail;
    const elsewhere: [number, number] = [45.7655, 10.8131];
    const answer = {
      ...result,
      points: result.points.map(([lat, lon]) => [lat + 0.001, lon + 0.002]),
      distance_m: 1968,
      similarity: 1,
      walks: [[2, 3]],
      centre: elsewhere,
    } as RouteResult;
    expect(movedExample(head, answer)).toEqual({
      ...head,
      points: answer.points,
      route_m: 1968,
      similarity: 1,
      walks: [[2, 3]],
      centre: elsewhere,
      alternatives: [],
    });
    // Moved to where it is drawn in one line, or by an API without the
    // centre: neither is kept from the route of before.
    const plain = movedExample(head, { ...result, walks: [] } as RouteResult);
    expect(plain).not.toHaveProperty("walks");
    expect(plain).not.toHaveProperty("centre");
  });
});
