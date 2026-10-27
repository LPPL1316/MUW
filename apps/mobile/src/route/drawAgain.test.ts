import type { ImageRouteRequest, RouteRequest } from "@shaperoute/shared-types";

import {
  againDistanceM,
  againOfDrawing,
  againOfRequest,
  type DrawAgain,
  type DrawnFigure,
  drawsAgain,
} from "./drawAgain";

// «Draw it near me» (TASK-313): the figure of a route or a drawing, to
// choose in «Draw» at the same distance.

const HEART: RouteRequest = {
  start: [46.07, 11.13],
  shape: "heart",
  distance_m: 5000,
  activity: "running",
};
const CAT: RouteRequest = {
  start: [46.07, 11.13],
  shape: "cat",
  pen_up: true,
  distance_m: 7000,
  activity: "running",
};
const WORD: RouteRequest = {
  start: [46.07, 11.13],
  word: "CIAO",
  style: "block",
  pen_up: true,
  distance_m: 12000,
  activity: "running",
};
const PHOTO: ImageRouteRequest = {
  start: [46.07, 11.13],
  outline: [
    [0, 1],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  distance_m: 5000,
  activity: "running",
};
const DRAWN: DrawnFigure = { shape: "star", word: null, style: null, distance_m: 5243 };

test("a route of «Explore» gives its shape or its word, at its distance", () => {
  expect(againOfRequest(HEART)).toEqual({
    kind: "shape",
    shape: "heart",
    distance_m: 5000,
  });
  // The pen up is «Draw»'s own switch: the shape alone.
  expect(againOfRequest(CAT)).toEqual({
    kind: "shape",
    shape: "cat",
    distance_m: 7000,
  });
  expect(againOfRequest(WORD)).toEqual({
    kind: "word",
    word: "CIAO",
    style: "block",
    distance_m: 12000,
  });
  // A word asked without a style is a round one.
  const { style: _style, ...plain } = WORD;
  expect(againOfRequest(plain)).toMatchObject({ style: "round" });
});

test("a picture or a photo gives nothing to choose", () => {
  expect(againOfRequest(PHOTO)).toBeNull();
});

test("a drawing gives the shape or the word of its route", () => {
  expect(againOfDrawing(DRAWN)).toEqual({
    kind: "shape",
    shape: "star",
    distance_m: 5243,
  });
  expect(
    againOfDrawing({ ...DRAWN, shape: null, word: "MUW", style: "block" }),
  ).toEqual({
    kind: "word",
    word: "MUW",
    style: "block",
    distance_m: 5243,
  });
  expect(againOfDrawing({ ...DRAWN, shape: null, word: "MUW" })).toMatchObject({
    style: "round",
  });
});

test("a drawing without a shape of the catalogue or a word gives nothing", () => {
  // A run without a route, a picture, a photo: the title alone.
  expect(againOfDrawing({ ...DRAWN, shape: null })).toBeNull();
  expect(againOfDrawing({ ...DRAWN, shape: null, word: "" })).toBeNull();
  // A shape this app does not know yet.
  expect(againOfDrawing({ ...DRAWN, shape: "dragon" })).toBeNull();
});

test("a word «Draw» would refuse is not drawn again", () => {
  const word = (letters: string) =>
    againOfDrawing({ ...DRAWN, shape: null, word: letters, distance_m: 21_000 });
  expect(drawsAgain(word("CIAO"), "running")).toBe(true);
  // Letters outside A to Z, two words, more letters than a run allows.
  expect(drawsAgain(word("ÉTÉ"), "running")).toBe(false);
  expect(drawsAgain(word("CIAO!"), "running")).toBe(false);
  expect(drawsAgain(word("TWO WORDS"), "running")).toBe(false);
  expect(drawsAgain(word("MOUNTAINS"), "running")).toBe(false);
});

test("on the water only a shape is drawn again", () => {
  const word = againOfDrawing({ ...DRAWN, shape: null, word: "MUW" });
  const shape = againOfDrawing(DRAWN);
  expect(drawsAgain(shape, "paddling")).toBe(true);
  expect(drawsAgain(word, "paddling")).toBe(false);
  expect(drawsAgain(word, "running")).toBe(true);
  expect(drawsAgain(word, "cycling")).toBe(true);
  expect(drawsAgain(null, "running")).toBe(false);
});

/** A star of `distance_m`. */
function star(distance_m: number): DrawAgain {
  return { kind: "shape", shape: "star", distance_m };
}

test("the distance is to the tenth of a km, within the sport of «Draw»", () => {
  expect(againDistanceM(star(5000), "running")).toBe(5000);
  expect(againDistanceM(star(5243), "running")).toBe(5200);
  expect(againDistanceM(star(5260), "running")).toBe(5300);
  // A 5 km run is the shortest bike route; a 30 km ride the longest run.
  expect(againDistanceM(star(5000), "cycling")).toBe(10000);
  expect(againDistanceM(star(30000), "running")).toBe(21000);
  expect(againDistanceM(star(400), "running")).toBe(1000);
  expect(againDistanceM(star(12000), "paddling")).toBe(5000);
});

test("a word is never shorter than its letters need", () => {
  const word = (distance_m: number, letters = "CIAO"): DrawAgain => ({
    kind: "word",
    word: letters,
    style: "round",
    distance_m,
  });
  // 3 km a letter: a run of «CIAO» cut a little short is asked at 12 km.
  expect(againDistanceM(word(11_640), "running")).toBe(12_000);
  expect(againDistanceM(word(12_430), "running")).toBe(12_400);
  // Within the sport all the same: «Draw» then says the letters are many.
  expect(againDistanceM(word(0, "MOUNTAINS"), "running")).toBe(21_000);
});
