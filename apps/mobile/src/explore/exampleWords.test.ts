import { LETTERS, type RouteResult, type Shape } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import penUpFixture from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import { act, renderHook } from "@testing-library/react-native";

import { BACKGROUND_SHARE, MINUTE_MS } from "../api/routeQueue";
import type { requestRoute, RouteOutcome } from "../api/routes";
import type { Place } from "../places/photon";
import { MAX_APP_WORD_LETTERS } from "../route/wordInput";
import {
  asRecommended,
  asWord,
  cityKey,
  drawExamples,
  EXAMPLE_DISTANCE_M,
  EXAMPLE_SHAPES,
  EXAMPLE_WORDS,
  exampleDetail,
  exampleRequest,
  type ExampleDetail,
  forgetExamples,
  MORE_SHAPES,
  PADDLE_EXAMPLES,
  shownWords,
  type Storage,
  useCityExamples,
  wordDistanceM,
  type WordExample,
  wordOrder,
  wordsOf,
} from "./exampleRoutes";

// The words written from a city's centre after its shapes (TASK-279): apart
// from exampleRoutes.test.ts, which is large enough.

const result = fixture as unknown as RouteResult;
/** A word as the API writes it, the pen up between its letters. */
const written = penUpFixture as unknown as RouteResult;
const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
  kind: "city",
};
const levico: Place = { label: "Levico Terme, Trentino", point: [46.0091, 11.3018] };
const EVERY_SHAPE = EXAMPLE_SHAPES.length + MORE_SHAPES.length;
const EVERY_EXAMPLE = EVERY_SHAPE + EXAMPLE_WORDS.length;
const notDrawable: RouteOutcome = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "no",
  suggested_distance_m: null,
};

/** A file in memory, as the phone's. */
function memory(): Storage & { kept: Record<string, ExampleDetail[]> } {
  const store = {
    kept: {} as Record<string, ExampleDetail[]>,
    load: () => JSON.parse(JSON.stringify(store.kept)),
    save: (kept: Record<string, ExampleDetail[]>) => {
      store.kept = kept;
    },
  };
  return store;
}

/** The API by hand: each request waits until the test answers it. */
function api() {
  const asked: {
    shape: Shape | null;
    word: string | null;
    penUp: boolean;
    answer: (o: RouteOutcome) => void;
  }[] = [];
  const request = jest.fn(
    (
      _url: string,
      body: { shape?: Shape | null; word?: string | null; pen_up?: boolean },
    ) =>
      new Promise<RouteOutcome>((resolve) => {
        asked.push({
          shape: body.shape ?? null,
          word: body.word ?? null,
          penUp: body.pen_up === true,
          answer: resolve,
        });
      }),
  ) as unknown as typeof requestRoute & jest.Mock;
  return { request, asked };
}

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

/** Where the words are. */
function wordsNow(read: () => WordExample[] | null): string {
  return (read() ?? []).map((e) => `${e.word}:${e.status}`).join(" ");
}

beforeEach(() => {
  forgetExamples();
});

// A word waiting for the minute's allowance holds a timer.
afterAll(() => {
  forgetExamples();
});

test("the words: letters the engine has, at the least distance of each", () => {
  for (const word of EXAMPLE_WORDS) {
    expect(word.length).toBeLessThanOrEqual(MAX_APP_WORD_LETTERS);
    expect([...word].every((l) => (LETTERS as readonly string[]).includes(l))).toBe(
      true,
    );
  }
  expect(EXAMPLE_WORDS.map(wordDistanceM)).toEqual([
    12_000, 12_000, 15_000, 9_000, 15_000, 9_000,
  ]);
  // The longest first: its zone holds the others'.
  expect(wordOrder(EXAMPLE_WORDS)).toEqual([
    "AMORE",
    "HELLO",
    "CIAO",
    "LOVE",
    "RUN",
    "MUW",
  ]);
  expect(wordsOf([{ word: "ciao" }, { word: null }, { word: "CIAO" }])).toEqual([
    "CIAO",
  ]);
});

test("after the shapes, the words, one at a time, the pen up", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.words;
  // While the shapes are drawn the words wait, and show no card.
  expect(wordsNow(read)).toBe(EXAMPLE_WORDS.map((w) => `${w}:waiting`).join(" "));
  expect(shownWords(read() ?? [])).toEqual([]);

  await answerAll(asked, 0, EVERY_SHAPE);
  expect(asked).toHaveLength(EVERY_SHAPE + 1);
  expect(request.mock.calls[EVERY_SHAPE][1]).toEqual({
    word: "AMORE",
    style: "round",
    pen_up: true,
    distance_m: 15_000,
    start: vercelli.point,
    activity: "running",
  });
  // The one being written is a card; the ones after it are not, yet.
  expect(shownWords(read() ?? []).map((e) => `${e.word}:${e.status}`)).toEqual([
    "AMORE:drawing",
  ]);

  await answerAll(asked, EVERY_SHAPE, EVERY_EXAMPLE);
  expect(asked.slice(EVERY_SHAPE).map((a) => `${a.word}:${a.penUp}`)).toEqual(
    wordOrder(EXAMPLE_WORDS).map((word) => `${word}:true`),
  );
  expect(asked).toHaveLength(EVERY_EXAMPLE);
  // The cards in the order chosen; each opens whole, with its walks.
  const list = read() ?? [];
  expect(list.map((e) => `${e.word}:${e.status}`)).toEqual(
    EXAMPLE_WORDS.map((word) => `${word}:ready`),
  );
  const run = list.find((e) => e.word === "RUN");
  const card = run?.status === "ready" ? run.route : undefined;
  expect(card).toMatchObject({
    id: "example:word:RUN:45.3252,8.4228",
    shape: null,
    word: "RUN",
    style: "round",
    distance_m: 9_000,
    route_m: written.distance_m,
    city: "Vercelli",
    gaps: [3, 4, 5],
  });
  expect(exampleDetail(card?.id ?? "")?.walks).toEqual(written.walks);
  expect(exampleRequest(card?.id ?? "")).toMatchObject({ word: "RUN", pen_up: true });
  // Kept with the shapes, for the next time.
  expect(
    storage.kept[cityKey(vercelli.point)].flatMap((d) => (d.word ? [d.word] : [])),
  ).toEqual([...EXAMPLE_WORDS]);
});

test("a word that does not come out is no card, and is not asked again", async () => {
  const { request, asked } = api();
  const storage = memory();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const read = () => hook.current.words ?? [];
  await answerAll(asked, 0, EVERY_SHAPE);
  expect(asked[EVERY_SHAPE].word).toBe("AMORE");
  await act(async () => asked[EVERY_SHAPE].answer(notDrawable));
  // No card for it, no error: the next one is written.
  expect(shownWords(read()).map((e) => `${e.word}:${e.status}`)).toEqual([
    "HELLO:drawing",
  ]);
  await answerAll(asked, EVERY_SHAPE + 1, EVERY_EXAMPLE);
  expect(shownWords(read()).map((e) => e.word)).toEqual(
    EXAMPLE_WORDS.filter((word) => word !== "AMORE"),
  );

  // Choosing the city again, or Try again, does not ask for it.
  await act(async () => hook.current.retry());
  await act(async () => {
    drawExamples("http://api", levico, { request, storage });
    drawExamples("http://api", vercelli, { request, storage });
  });
  expect(asked.filter((a) => a.word === "AMORE")).toHaveLength(1);
});

test("a city with routes of its own: the words it has not", async () => {
  const { request, asked } = api();
  const storage = memory();
  const has = [...EXAMPLE_SHAPES, ...MORE_SHAPES, "CIAO"];
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage, has }),
  );
  await answerAll(asked, 0, EXAMPLE_WORDS.length - 1);
  expect(asked.map((a) => a.word)).toEqual(
    wordOrder(EXAMPLE_WORDS).filter((word) => word !== "CIAO"),
  );
  expect(wordsNow(() => hook.current.words)).toBe(
    EXAMPLE_WORDS.filter((word) => word !== "CIAO")
      .map((word) => `${word}:ready`)
      .join(" "),
  );
});

test("a word kept at another distance, or without its walks, is written again", async () => {
  const storage = memory();
  const love = asWord(vercelli, "LOVE", written).detail;
  storage.kept = {
    [cityKey(vercelli.point)]: [
      ...[...EXAMPLE_SHAPES, ...MORE_SHAPES].map(
        (shape) => asRecommended(vercelli, shape, result).detail,
      ),
      ...EXAMPLE_WORDS.filter((word) => word !== "LOVE" && word !== "RUN").map(
        (word) => asWord(vercelli, word, written).detail,
      ),
      { ...love, distance_m: EXAMPLE_DISTANCE_M },
      asWord(vercelli, "RUN", result).detail,
    ],
  };
  const { request, asked } = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  expect(asked.map((a) => a.word)).toEqual(["LOVE"]);
  await answerAll(asked, 0, 1);
  expect(asked.map((a) => a.word)).toEqual(["LOVE", "RUN"]);
  expect(wordsNow(() => hook.current.words)).toContain("RUN:drawing");
});

test("the words keep to the share of the minute, as the other shapes", async () => {
  jest.useFakeTimers();
  try {
    const { request, asked } = api();
    const storage = memory();
    const [first, second, third] = [0, 1, 2].map((i): Place => ({
      label: `City ${i}`,
      point: [45 + i / 10, 8],
    }));
    drawExamples("http://api", first, { request, storage });
    await answerAll(asked, 0, EVERY_EXAMPLE);
    // Cities with every shape of their own: only their words to write.
    const has = [...EXAMPLE_SHAPES, ...MORE_SHAPES];
    drawExamples("http://api", second, { request, storage, has });
    const both = EVERY_EXAMPLE + EXAMPLE_WORDS.length;
    await answerAll(asked, EVERY_EXAMPLE, both);
    drawExamples("http://api", third, { request, storage, has });
    const share = BACKGROUND_SHARE.visible;
    const allowed = share - both;
    await answerAll(asked, both, share);
    expect(asked).toHaveLength(share);

    await act(async () => {
      jest.advanceTimersByTime(MINUTE_MS);
    });
    expect(asked).toHaveLength(share + 1);
    expect(asked.at(-1)?.word).toBe(wordOrder(EXAMPLE_WORDS)[allowed]);
  } finally {
    jest.useRealTimers();
  }
});

test("on the water no words: the eight shapes and nothing after", async () => {
  const { request, asked } = api();
  const storage = memory();
  const malcesine: Place = { label: "Your start", point: [45.7636, 10.8098] };
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", malcesine, {
      request,
      storage,
      set: PADDLE_EXAMPLES,
    }),
  );
  await answerAll(asked, 0, EVERY_SHAPE);
  expect(asked).toHaveLength(EVERY_SHAPE);
  expect(asked.every((a) => a.word === null)).toBe(true);
  expect(hook.current.words).toEqual([]);
});
