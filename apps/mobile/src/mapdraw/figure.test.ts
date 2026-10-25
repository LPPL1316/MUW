import type { LatLon } from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import {
  distanceOf,
  type Figure,
  lookOf,
  placeAt,
  placedLines,
  placedStart,
  travelledLength,
  withinLimits,
} from "./figure";
import { toPlane } from "./plane";

const TRENTO: LatLon = [46.0671, 11.1214];
const HEART: Figure = { kind: "shape", shape: "heart" };
const SQUARE: Figure = {
  kind: "drawing",
  outline: [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ],
  details: [],
};

test("a shape of the catalogue is sized as the engine sizes it", () => {
  // tools/catalogue_shapes.py: the perimeter of get_shape("heart")(64).
  expect(lookOf(HEART).length).toBeCloseTo(6.378, 2);
  expect(lookOf(HEART).lines).toHaveLength(1);
  // The smiley with the pen up: its pieces alone, apart.
  const smiley: Figure = { kind: "shape", shape: "smiley" };
  expect(lookOf(smiley, true).lines.length).toBeGreaterThan(1);
  expect(lookOf(smiley, true).length).toBeLessThan(lookOf(smiley).length);
  // A shape without pieces is the same either way.
  expect(lookOf(HEART, true)).toEqual(lookOf(HEART));
});

test("a drawing's length is its outline, and its details out and back", () => {
  expect(lookOf(SQUARE).length).toBeCloseTo(8);
  const withLine: Figure = {
    ...SQUARE,
    details: [
      [
        [0, 1],
        [0, 0],
      ],
    ],
  };
  expect(lookOf(withLine).length).toBeCloseTo(8 + 2);
  // An eye: the line to it out and back, the loop once.
  const eye = [
    [0, 1],
    [0, 0.5],
    [0.2, 0.3],
    [-0.2, 0.3],
    [0, 0.5],
  ] as [number, number][];
  expect(travelledLength(eye)).toBeCloseTo(2 * 0.5 + 2 * Math.hypot(0.2, 0.2) + 0.4);
});

test("on the map a figure is as big as its distance, around its middle", () => {
  const placed = placeAt(HEART, TRENTO, 6000);
  expect(distanceOf(placed)).toBeCloseTo(6000);
  const lines = placedLines(placed);
  // The heart's frame is 2 units wide: 2 × 6000 / 6.378 m.
  const xs = lines[0].map((p) => toPlane(TRENTO, p)[0]);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo((2 * 6000) / 6.378, -1);
  // The route starts at the heart's first point, at the top of its dip.
  const start = placedStart(placed);
  expect(metresBetween(start, lines[0][0])).toBeLessThan(1);
});

test("the figure grows no more than the distances allow, nor shrinks below", () => {
  const big = placeAt(HEART, TRENTO, 40_000);
  expect(distanceOf(withinLimits(big, [1000, 21_000]))).toBeCloseTo(21_000);
  const small = placeAt(HEART, TRENTO, 200);
  expect(distanceOf(withinLimits(small, [1000, 21_000]))).toBeCloseTo(1000);
  const fine = placeAt(HEART, TRENTO, 6000);
  expect(withinLimits(fine, [1000, 21_000])).toBe(fine);
});
