import { SHAPES } from "@shaperoute/shared-types";

import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import {
  BEST_FILE,
  forgetBest,
  guessable,
  loadBest,
  OPTIONS,
  pointsFor,
  roundOf,
  saveBest,
  shapesOf,
} from "./guessRounds";

// «Guess the shape» (TASK-317): the rounds, the points and the best score
// kept on the phone.

jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const state = { failing: false };
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      if (state.failing) {
        throw new Error("No space left on device");
      }
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
  }
  return { File, Paths: { document: { uri: "file:///doc/" } }, files, state };
});

const fileSystem = jest.requireMock<{
  files: Map<string, string>;
  state: { failing: boolean };
}>("expo-file-system");

const BEST_URI = `file:///doc/${BEST_FILE}`;

function post(shape: string, id = shape): SamplePost {
  return {
    id,
    user: "marta_b",
    title: "A test",
    city: "trento",
    shape,
    route_m: 5000,
    minutes: 30,
    score: 90,
    line: [
      [46.07, 11.12],
      [46.08, 11.13],
    ],
  };
}

beforeEach(() => {
  fileSystem.files.clear();
  fileSystem.state.failing = false;
  forgetBest();
});

test("the answers are the catalogue's shapes among the drawings, once each", () => {
  const posts = [post("heart"), post("heart", "h2"), post("star"), post("word")];
  expect(shapesOf(posts)).toEqual(["heart", "star"]);
  expect(guessable(posts).map((p) => p.id)).toEqual(["heart", "h2", "star"]);
});

test("the drawings of «Feed» give enough shapes for a round", () => {
  const shapes = shapesOf(SAMPLE_FEED);
  expect(shapes.length).toBeGreaterThanOrEqual(OPTIONS);
  for (const shape of shapes) {
    expect(SHAPES).toContain(shape);
  }
});

test("a round offers the drawing's shape and two others, each once", () => {
  const shapes = ["heart", "star", "moon", "cat", "fish"];
  for (const seed of [0, 0.3, 0.6, 0.99]) {
    const round = roundOf(post("moon"), shapes, () => seed);
    expect(round.options).toHaveLength(OPTIONS);
    expect(round.options).toContain("moon");
    expect(new Set(round.options).size).toBe(OPTIONS);
    for (const shape of round.options) {
      expect(shapes).toContain(shape);
    }
  }
});

test("the sooner the answer, the more points, never under 10", () => {
  expect(pointsFor(0)).toBe(100);
  expect(pointsFor(0.24)).toBe(80);
  expect(pointsFor(0.5)).toBe(50);
  expect(pointsFor(0.9)).toBe(10);
  expect(pointsFor(1)).toBe(10);
});

test("the best score stays on the phone", () => {
  expect(loadBest()).toBe(0);
  saveBest(120);
  expect(JSON.parse(fileSystem.files.get(BEST_URI) ?? "")).toEqual({ best: 120 });
  forgetBest();
  expect(loadBest()).toBe(120);
  // A lower score never takes its place.
  saveBest(40);
  expect(loadBest()).toBe(120);
});

test("a file that does not read is no best score", () => {
  fileSystem.files.set(BEST_URI, "{not json");
  expect(loadBest()).toBe(0);
  fileSystem.files.set(BEST_URI, JSON.stringify({ best: "lots" }));
  expect(loadBest()).toBe(0);
});

test("a phone that cannot write keeps the best score until the app closes", () => {
  fileSystem.state.failing = true;
  saveBest(70);
  expect(fileSystem.files.has(BEST_URI)).toBe(false);
  expect(loadBest()).toBe(70);
});
