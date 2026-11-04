import type { LatLon } from "@shaperoute/shared-types";

import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { saveLanguageChoice } from "../i18n/language";
import {
  complexityOf,
  foundExamples,
  namedShapes,
  normalized,
  previewOf,
  sortedExamples,
  wordsOf,
} from "./drawingMatch";
import { NO_FILTERS } from "./searchFilters";

afterEach(() => saveLanguageChoice("phone"));

/** An example drawing, as sampleFeed.json writes one. */
function example(changes: Partial<SamplePost> = {}): SamplePost {
  return {
    id: "trento-heart-5000-0",
    user: "marta_b",
    title: "A heart in Trento",
    city: "trento",
    shape: "heart",
    route_m: 5000,
    minutes: 30,
    score: 80,
    line: SQUARE,
    ...changes,
  };
}

/** A square of about 1 km: its four sides over its diagonal, 2.8. */
const SQUARE: LatLon[] = [
  [46.0671, 11.1214],
  [46.0671, 11.1344],
  [46.0761, 11.1344],
  [46.0761, 11.1214],
  [46.0671, 11.1214],
];

/** Up and down `strokes` times in a square: a long line in a small box. */
function zigzag(strokes: number): LatLon[] {
  const line: LatLon[] = [];
  for (let i = 0; i <= strokes; i += 1) {
    const lon = 11.1214 + (0.013 * i) / strokes;
    line.push([46.0671, lon], [46.0761, lon]);
  }
  return line;
}

test("capitals and accents do not count, as on the API", () => {
  expect(normalized("Città ÀNCORA Señora Łódź")).toBe("citta ancora senora lodz");
  expect(wordsOf("  Cane   Trento ")).toEqual(["cane", "trento"]);
  expect(wordsOf("   ")).toEqual([]);
});

test("the words name the shapes in the app's language, and the categories", () => {
  saveLanguageChoice("it");
  expect(namedShapes(["cuore"])).toEqual(["heart"]);
  expect(namedShapes(["cane"])).toEqual(["dog_head"]);
  // «Animali»: every animal of the catalogue.
  expect(namedShapes(["animali"])).toEqual(
    expect.arrayContaining(["horse", "cat", "fish", "dog_head"]),
  );
  // One letter names nothing.
  expect(namedShapes(["c"])).toEqual([]);
  saveLanguageChoice("phone");
  expect(namedShapes(["heart"])).toEqual(["heart"]);
});

test("the complexity is the API's: length over the diagonal of the box", () => {
  expect(complexityOf(SQUARE)).toBe("simple");
  expect(complexityOf(zigzag(12))).toBe("complex");
  expect(complexityOf([SQUARE[0]])).toBe("simple");
  // At most 64 points count, the first and the last kept.
  const long = zigzag(60);
  const preview = previewOf(long);
  expect(preview).toHaveLength(64);
  expect(preview[0]).toBe(long[0]);
  expect(preview[63]).toBe(long[long.length - 1]);
});

test("every word must be there, in the title, the runner, the shape or the town", () => {
  const examples = [
    example(),
    example({ id: "b", title: "Sunday dog", shape: "dog_head", city: "bari" }),
  ];
  const titles = (typed: string) =>
    foundExamples(examples, typed, NO_FILTERS).map((p) => p.title);
  expect(titles("heart")).toEqual(["A heart in Trento"]);
  expect(titles("MARTA")).toEqual(["A heart in Trento", "Sunday dog"]);
  expect(titles("sunday bari")).toEqual(["Sunday dog"]);
  expect(titles("sunday trento")).toEqual([]);
  // A word that names a shape finds that shape alone, as the API's `named`
  // (ADR-0297, point 3).
  expect(titles("dog trento")).toEqual(["Sunday dog"]);
  // The shape named in the app's language is found though not written.
  saveLanguageChoice("it");
  expect(titles("cuore")).toEqual(["A heart in Trento"]);
  // Too long a search finds nothing, as on the API.
  expect(titles("x".repeat(81))).toEqual([]);
});

test("each filter leaves out what is not its own", () => {
  const examples = [
    example({ id: "a", title: "Heart run", route_m: 5000 }),
    example({ id: "b", title: "Star ride", shape: "star", route_m: 25000 }),
    example({
      id: "c",
      title: "Fish paddle",
      shape: "fish",
      route_m: 60000,
      activity: "paddling",
      city: "levico",
      line: zigzag(12),
    }),
  ];
  const titles = (filters: Partial<typeof NO_FILTERS>) =>
    foundExamples(examples, "", { ...NO_FILTERS, ...filters }).map((p) => p.title);
  expect(titles({ category: "animals" })).toEqual(["Fish paddle"]);
  expect(titles({ category: "symbols" })).toEqual(["Star ride"]);
  expect(titles({ activities: ["paddling"] })).toEqual(["Fish paddle"]);
  expect(titles({ activities: ["running"] })).toEqual(["Heart run", "Star ride"]);
  expect(titles({ distance: "10-30" })).toEqual(["Star ride"]);
  expect(titles({ distance: "50+" })).toEqual(["Fish paddle"]);
  expect(titles({ place: "LEVICO" })).toEqual(["Fish paddle"]);
  expect(titles({ complexities: ["complex"] })).toEqual(["Fish paddle"]);
});

test("the orders: «Feed»'s, the longest, the best scored", () => {
  const examples = [
    example({ id: "a", title: "A", route_m: 5000, score: 70 }),
    example({ id: "b", title: "B", route_m: 9000, score: 60 }),
    example({ id: "c", title: "C", route_m: 7000, score: 90 }),
  ];
  const titles = (sort: "recent" | "longest" | "popular") =>
    sortedExamples(examples, sort).map((p) => p.title);
  expect(titles("recent")).toEqual(["A", "B", "C"]);
  expect(titles("longest")).toEqual(["B", "C", "A"]);
  expect(titles("popular")).toEqual(["C", "A", "B"]);
});

test("every example of «Feed» is found by its own shape's name", () => {
  for (const post of SAMPLE_FEED) {
    const found = foundExamples(SAMPLE_FEED, post.shape.replace(/_/g, " "), NO_FILTERS);
    expect(found).toContain(post);
  }
});
