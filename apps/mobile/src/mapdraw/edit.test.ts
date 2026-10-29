import {
  type LatLon,
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
  type OutlinePoint,
} from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";

import { requestLines } from "../route/figureLines";
import { newDrawing, travelledPoints, withDetail } from "./drawing";
import { asDrawing, type Drawing, drawingOf, erasedAt, touchesLines } from "./edit";
import { lookOf, type Unit } from "./figure";
import { isSimpleRing, nearestOnSegment, type P } from "./geometry";
import { fromPlane } from "./plane";

/**
 * Changing the figure on the map (TASK-331, ADR-0288): the outline of a
 * picture becomes a drawing the engine takes, where it was; a shape of the
 * catalogue is not changed; a tap with «Erase» takes a line away.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** A straight line of `steps` points. */
function stroke(a: P, b: P, steps = 20): P[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] as P;
  });
}

/** The square from (-1, -1) to (1, 1), closed. */
const SQUARE: Unit[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/** How far `point` is from the nearest side of `line`. */
function awayFrom(point: P, line: readonly P[]): number {
  let away = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const at = nearestOnSegment(point, line[i - 1], line[i]);
    away = Math.min(away, Math.hypot(at[0] - point[0], at[1] - point[1]));
  }
  return away;
}

/** The drawing, or a failed test. */
function sure(drawing: Drawing | null): Drawing {
  if (drawing === null) throw new Error("no drawing");
  return drawing;
}

/** The lines of the image request of the fixtures, with `strokes`. */
function pictureLines(strokes: OutlinePoint[][] = []) {
  const lines = requestLines({
    ...imageRequest,
    start: imageRequest.start as LatLon,
    outline: imageRequest.outline as OutlinePoint[],
    strokes,
    activity: "running",
  });
  if (lines === null) throw new Error("no lines");
  return lines;
}

test("a picture's outline is kept as it is, its details hung on it as the engine reads them", () => {
  const lines = pictureLines([
    // On the outline's first point, then one away from the figure.
    [imageRequest.outline[0] as OutlinePoint, [0, 0]],
    [
      [0.1, 0.1],
      [0.2, 0.3],
    ],
  ]);
  const drawing = sure(drawingOf(lines));
  expect(drawing.outline).toBe(lines.outline);
  expect(drawing.details[0]).toBe(lines.details[0]);
  // Every detail starts on the outline or on a detail before it.
  drawing.details.forEach((detail, i) => {
    const before = [drawing.outline, ...drawing.details.slice(0, i)];
    expect(before.some((line) => awayFrom(detail[0], line) < 1e-6)).toBe(true);
  });
  expect(travelledPoints(drawing.details)).toBeLessThanOrEqual(MAX_DETAIL_POINTS);
});

test("an outline with more corners than the engine takes is straightened; nothing enclosed, or too much, is none", () => {
  // A circle of 300 corners.
  const round: Unit[] = Array.from({ length: 301 }, (_, i) => {
    const a = (2 * Math.PI * (i % 300)) / 300;
    return [Math.cos(a), Math.sin(a)];
  });
  const straightened = sure(drawingOf({ outline: round, details: [] }));
  expect(straightened.outline.length).toBeLessThanOrEqual(MAX_OUTLINE_POINTS + 1);
  expect(isSimpleRing(straightened.outline)).toBe(true);
  // A line that encloses nothing makes no drawing.
  expect(drawingOf({ outline: stroke([-1, 0], [1, 0]), details: [] })).toBeNull();
  // Details beyond what a route runs make none either.
  const many: P[][] = Array.from({ length: 30 }, (_, i) =>
    stroke([0, 0], [i * 0.02, 0.9], 10),
  );
  expect(drawingOf({ outline: SQUARE, details: many })).toBeNull();
});

test("a photo on the map becomes a drawing where it is; a drawing stays itself; a shape of the catalogue is not changed", () => {
  const photo = sure(
    asDrawing({
      kind: "picture",
      outline: imageRequest.outline as OutlinePoint[],
      strokes: [],
    }),
  );
  expect(photo.outline).toEqual(imageRequest.outline);
  expect(photo.details).toEqual([]);
  expect(asDrawing(photo)).toBe(photo);
  expect(asDrawing({ kind: "shape", shape: "heart" })).toBeNull();
});

test("Erase on a shape of the catalogue: a finger on its line, and nowhere else", () => {
  const { lines } = lookOf({ kind: "shape", shape: "heart" });
  expect(touchesLines(lines, [lines[0][3]])).toBe(true);
  expect(touchesLines(lines, [[5, 5]])).toBe(false);
});

test("Erase: the line under the finger goes; the outline takes the details with it", () => {
  const square: Drawing = { kind: "drawing", outline: SQUARE, details: [] };
  const one = { ...square, details: [stroke([0, -1], [0, 0.4])] };
  const two = { ...one, details: [...one.details, stroke([-0.6, -1], [-0.6, 0.4])] };
  // A tap on the second detail, a little off it.
  expect(erasedAt(two, [[-0.58, 0]])).toEqual({ drawing: one });
  // A tap on the outline: nothing is left.
  expect(erasedAt(two, [[1.02, 0.5]])).toEqual({ drawing: null });
  // A tap on nothing, and a line that touches nothing: nothing happens.
  expect(erasedAt(two, [[0.5, 0.5]])).toBeNull();
  expect(erasedAt(two, stroke([0.4, 0.2], [0.6, 0.6]))).toBeNull();
  // A finger's line across the first detail: the first line it touches.
  expect(erasedAt(two, stroke([0.3, 0], [-0.1, 0]))).toEqual({
    drawing: { ...square, details: [two.details[1]] },
  });
});

test("a detail erased takes the details hung on it", () => {
  const square: Drawing = { kind: "drawing", outline: SQUARE, details: [] };
  const trunk = { ...square, details: [stroke([0, -1], [0, 0.4])] };
  // A branch from the trunk, far from the outline: it starts on the trunk.
  const branch = { ...trunk, details: [...trunk.details, stroke([0, 0], [0.5, 0])] };
  expect(erasedAt(branch, [[0, 0.3]])).toEqual({ drawing: square });
  // The branch alone leaves the trunk.
  expect(erasedAt(branch, [[0.45, 0]])).toEqual({ drawing: trunk });
});

test("on an open line, Erase takes the line, and with it the whole drawing", () => {
  const drawn = newDrawing(
    [
      [-500, 0],
      [0, 400],
      [500, 0],
    ].map(([x, y]) => fromPlane(TRENTO, [x, y])),
  );
  if (drawn === null || !("placed" in drawn)) throw new Error("no drawing");
  const open = drawn.placed.figure as Drawing;
  // Its start, where the ring is: the ring is no line, the line is.
  expect(erasedAt(open, [open.outline[0]])).toEqual({ drawing: null });
  // A line hung on it goes alone; the open line stays.
  const hung = withDetail(drawn.placed, [
    fromPlane(TRENTO, [0, 380]),
    fromPlane(TRENTO, [0, 0]),
  ]);
  if (hung === null || !("placed" in hung)) throw new Error("no detail");
  const two = hung.placed.figure as Drawing;
  const tip = two.details[1][two.details[1].length - 1];
  expect(erasedAt(two, [tip])).toEqual({ drawing: open });
});
