import type { LatLon } from "@shaperoute/shared-types";

import { isOpenLine, startRing } from "./drawing";
import { awayFrom, type Drawing } from "./edit";
import { dist, lineLength, type P } from "./geometry";
import { fromPlane } from "./plane";
import { bent, erased, straightGoneOn, straightStarted } from "./tools";

/**
 * The tools of «Draw on the map» (TASK-331 part B, ADR-0288): the eraser
 * takes the piece of a line a finger rubs, what is cut off joins again by
 * a link; a straight line is tapped point by point; a line held bends.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** The square from (-1, -1) to (1, 1), closed. */
const SQUARE: P[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/** A straight line of `steps` points. */
function stroke(a: P, b: P, steps = 20): P[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] as P;
  });
}

/** An open line along `line`: its ring at the start, the line hung there. */
function openLine(line: P[]): Drawing {
  const ring = startRing(line[0], line[1], 2);
  return { kind: "drawing", outline: ring, details: [line] };
}

function drawingOf(result: ReturnType<typeof erased>): Drawing {
  if (result === null || "problem" in result || result.drawing === null) {
    throw new Error("no drawing");
  }
  return result.drawing;
}

function expectNear(point: P, to: P, within = 0.04) {
  expect(dist(point, to)).toBeLessThanOrEqual(within);
}

test("the eraser cuts the outline open: what is left is an open line, from the cut round to it", () => {
  const square: Drawing = { kind: "drawing", outline: SQUARE, details: [] };
  const left = drawingOf(erased(square, [[1, 0]], 0.1));
  expect(isOpenLine(left.outline, left.details)).toBe(true);
  const [line] = left.details;
  expect(left.details).toHaveLength(1);
  expect(line[0]).toBe(left.outline[0]);
  expectNear(line[0], [1, 0.1]);
  expectNear(line[line.length - 1], [1, -0.1]);
  expect(lineLength(line)).toBeCloseTo(7.8, 1);
  // Nothing rubbed: nothing changes.
  expect(erased(square, [[0, 0]], 0.1)).toBeNull();
});

test("a piece cut off from the drawing joins it again by a link, over the gap", () => {
  const square: Drawing = {
    kind: "drawing",
    outline: SQUARE,
    details: [stroke([0, -1], [0, 0.4])],
  };
  const left = drawingOf(erased(square, [[0, -0.3]], 0.05));
  expect(left.outline).toBe(SQUARE);
  expect(left.details).toHaveLength(2);
  expect(left.linked).toEqual([false, true]);
  const [kept, cutOff] = left.details;
  expect(kept[0]).toEqual([0, -1]);
  expectNear(kept[kept.length - 1], [0, -0.35]);
  // The link: from the end of the piece left to the start of the one cut off.
  expect(cutOff[0]).toEqual(kept[kept.length - 1]);
  expectNear(cutOff[1], [0, -0.25]);
  expectNear(cutOff[cutOff.length - 1], [0, 0.4], 1e-9);
});

test("a crumb left by the eraser goes; all of a line rubbed out leaves nothing", () => {
  const square: Drawing = {
    kind: "drawing",
    outline: SQUARE,
    details: [stroke([0, -1], [0, 0.4])],
  };
  const left = drawingOf(erased(square, [[0, 0.36]], 0.03));
  expect(left.details).toHaveLength(1);
  expectNear(left.details[0][left.details[0].length - 1], [0, 0.33]);

  const open = openLine(stroke([-1, 0], [1, 0], 5));
  expect(erased(open, stroke([-1, 0], [1, 0], 40), 0.1)).toEqual({ drawing: null });
});

test("a link is no line drawn: rubbing it out changes nothing", () => {
  const linked: Drawing = {
    kind: "drawing",
    outline: SQUARE,
    details: [
      [
        [0, -1],
        [0, -0.5],
        [0, 0],
      ],
    ],
    linked: [true],
  };
  expect(erased(linked, [[0, -0.8]], 0.05)).toBeNull();
});

test("two points tapped on nothing: an open line of its own, where they are", () => {
  const first = fromPlane(TRENTO, [0, 0]);
  const second = fromPlane(TRENTO, [600, 0]);
  const started = straightStarted(null, first, second, 40);
  if ("problem" in started) throw new Error(started.problem);
  const figure = started.placed.figure as Drawing;
  expect(isOpenLine(figure.outline, figure.details)).toBe(true);
  expect(figure.details[0]).toHaveLength(2);
  expect(figure.details[0][0]).toBe(figure.outline[0]);
  // Half its size: 600 m, and the small ring behind its start.
  expect(started.placed.unitM).toBeGreaterThan(300);
  expect(started.placed.unitM).toBeLessThan(303);
  expect(started.straight).toEqual({ kind: "line", index: 0, from: 0 });
});

test("a straight line that would cross itself closes as a loop, not as the outline", () => {
  const open = openLine([
    [0, 0],
    [1, 1],
  ]);
  let drawing = open;
  for (const point of [
    [1, 0],
    [0, 1],
  ] as P[]) {
    const gone = straightGoneOn(drawing, { index: 0, from: 0 }, point, 0.05);
    if ("problem" in gone) throw new Error(gone.problem);
    expect(gone.closed).toBe(false);
    drawing = gone.drawing;
  }
  const closed = straightGoneOn(drawing, { index: 0, from: 0 }, [0.01, 0.02], 0.05);
  if ("problem" in closed) throw new Error(closed.problem);
  expect(closed.closed).toBe(true);
  const [loop] = closed.drawing.details;
  expect(closed.drawing.outline).toBe(open.outline);
  expect(loop).toHaveLength(5);
  expect(loop[4]).toBe(loop[0]);
});

test("a line held in the middle of a side bends there, a new corner, the rest as it was", () => {
  const square: Drawing = { kind: "drawing", outline: SQUARE, details: [] };
  const result = bent(square, [1, 0], [1.5, 0], 0.05);
  if (result === null || "problem" in result) throw new Error("not bent");
  expect(result.drawing.outline).toEqual([
    [-1, -1],
    [1, -1],
    [1.5, 0],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ]);
  // Nowhere near a line, nothing is held.
  expect(bent(square, [0, 0], [0.5, 0], 0.05)).toBeNull();
});

test("a detail hung on the line bent goes with it; the start of a detail stays", () => {
  const hung: Drawing = {
    kind: "drawing",
    outline: SQUARE,
    details: [
      [
        [1, -0.5],
        [0, -0.5],
      ],
    ],
  };
  const result = bent(hung, [1, -0.4], [1.3, -0.4], 0.05);
  if (result === null || "problem" in result) throw new Error("not bent");
  const [detail] = result.drawing.details;
  expect(detail[0][0]).toBeCloseTo(1.25, 9);
  expect(detail[0][1]).toBeCloseTo(-0.5, 9);
  expect(awayFrom(detail[0], result.drawing.outline)).toBeLessThan(1e-9);
  expect(detail[1]).toEqual([0, -0.5]);
  // An open line held at its start, where it hangs: nothing bends.
  const open = openLine([
    [0, 0],
    [1, 0],
  ]);
  expect(bent(open, [0, 0], [0.5, 0.5], 0.01)).toBeNull();
});

test("a bend that would make the outline cross itself is refused", () => {
  const square: Drawing = { kind: "drawing", outline: SQUARE, details: [] };
  expect(bent(square, [1, 0], [-1.5, 0], 0.05)).toEqual({ problem: "crosses" });
});
