import {
  type LatLon,
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
} from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import { lookOf, type Placed, placedLines } from "./figure";
import { isSimpleRing, type P, signedArea } from "./geometry";
import {
  CLOSED_SHARE,
  firstLineOf,
  isOpenLine,
  newDrawing,
  outlineOf,
  travelledPoints,
  withDetail,
} from "./drawing";
import { fromPlane } from "./plane";

const TRENTO: LatLon = [46.0671, 11.1214];

/** A line of the map from points in metres around Trento. */
function onMap(points: P[]): LatLon[] {
  return points.map((p) => fromPlane(TRENTO, p));
}

/** A circle of `radius` metres, from angle `from` for `turns` turns, as a
 * finger draws it: many close points. */
function circle(radius: number, turns = 1, from = 0, centre: P = [0, 0]): P[] {
  const steps = Math.round(300 * turns);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + (2 * Math.PI * turns * i) / steps;
    return [centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)] as P;
  });
}

function placedOf(drawn: ReturnType<typeof newDrawing>): Placed {
  if (drawn === null || !("placed" in drawn)) {
    throw new Error(`no drawing: ${JSON.stringify(drawn)}`);
  }
  return drawn.placed;
}

test("a line drawn round is closed by the app, where it was and as big", () => {
  const placed = placedOf(newDrawing(onMap(circle(800, 0.97))));
  const figure = placed.figure;
  if (figure.kind !== "drawing") throw new Error(figure.kind);
  const outline = figure.outline;
  // Closed on its first point, at most 100 corners, not crossing itself.
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  expect(outline.length - 1).toBeLessThanOrEqual(MAX_OUTLINE_POINTS);
  expect(isSimpleRing(outline)).toBe(true);
  // In the frame [-1, 1], placed in the middle of the circle, as big.
  expect(Math.max(...outline.map(([x]) => Math.abs(x)))).toBeCloseTo(1, 1);
  expect(metresBetween(placed.centre, TRENTO)).toBeLessThan(30);
  expect(placed.unitM).toBeCloseTo(800, -2);
  // Its length: about the circle's, in metres.
  expect(lookOf(figure).length * placed.unitM).toBeCloseTo(2 * Math.PI * 800, -2);
  // The route starts where the finger started.
  expect(
    metresBetween(placedLines(placed)[0][0], fromPlane(TRENTO, [800, 0])),
  ).toBeLessThan(5);
});

test("a line that runs past its start is cut where it crosses itself", () => {
  // A turn and a quarter: the last quarter runs over the first.
  const outline = outlineOf(
    circle(500, 1.25, 0, [0, 0]).map(([x, y]) => [x, y + x / 10] as P),
  );
  expect(Array.isArray(outline)).toBe(true);
  const ring = outline as P[];
  expect(isSimpleRing(ring)).toBe(true);
  // The whole loop is kept, the tail is gone.
  const length = ring
    .slice(1)
    .reduce((t, p, i) => t + Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]), 0);
  expect(length).toBeGreaterThan(0.9 * 2 * Math.PI * 500);
  expect(length).toBeLessThan(1.1 * 2 * Math.PI * 500);
});

test("a figure of eight keeps its larger loop", () => {
  const eight: P[] = [
    ...circle(400, 1, Math.PI, [400, 0]),
    ...circle(250, 1, 0, [-250, 0]),
  ];
  const ring = outlineOf(eight) as P[];
  expect(isSimpleRing(ring)).toBe(true);
  expect(Math.max(...ring.map(([x]) => x))).toBeGreaterThan(700);
  expect(Math.min(...ring.map(([x]) => x))).toBeGreaterThan(-50);
});

test("a line that crosses itself where it cannot be cut is refused", () => {
  // Two loops of the same size, joined: either one is half of what was drawn.
  const zigzag: P[] = [
    [0, 0],
    [1000, 1000],
    [1000, 0],
    [0, 1000],
    [-1000, 0],
    [-1000, 1000],
  ];
  expect(outlineOf(zigzag)).toEqual({ problem: "crosses" });
});

test("a tap is no drawing", () => {
  expect(newDrawing(onMap([[0, 0]]))).toBeNull();
  expect(
    newDrawing(
      onMap([
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
    ),
  ).toBeNull();
});

/** The drawing of the first line, or a failed test. */
function drawingOf(line: P[]) {
  const placed = placedOf(newDrawing(onMap(line)));
  if (placed.figure.kind !== "drawing") throw new Error(placed.figure.kind);
  return { placed, figure: placed.figure };
}

test("a line that does not come back to its start stays open, run there and back from where the finger started (TASK-331)", () => {
  // An arch, its ends a kilometre apart: the user's «not a circle».
  const arch = circle(500, 0.5, 0);
  const { placed, figure } = drawingOf(arch);
  expect(isOpenLine(figure.outline, figure.details)).toBe(true);
  // The outline is a ring too small to see, on the line's first point.
  expect(figure.outline).toHaveLength(4);
  expect(figure.outline[3]).toEqual(figure.outline[0]);
  expect(isSimpleRing(figure.outline)).toBe(true);
  expect(Math.abs(signedArea(figure.outline))).toBeGreaterThan(0);
  // The line is the one detail, from that very point, and not closed.
  expect(figure.details).toHaveLength(1);
  const [line] = figure.details;
  expect(line[0]).toBe(figure.outline[0]);
  const last = line[line.length - 1];
  expect(Math.hypot(last[0] - line[0][0], last[1] - line[0][1])).toBeGreaterThan(1.5);
  // Its length: the arch out and back, about.
  expect(lookOf(figure).length * placed.unitM).toBeCloseTo(2 * Math.PI * 500, -2);
  // The route starts where the finger started.
  expect(
    metresBetween(placedLines(placed)[0][0], fromPlane(TRENTO, [500, 0])),
  ).toBeLessThan(5);
  // A straight line, the simplest of all, is open too.
  const straight = drawingOf([
    [0, 0],
    [100, 0],
    [200, 0],
    [300, 0],
  ]).figure;
  expect(isOpenLine(straight.outline, straight.details)).toBe(true);
  expect(straight.details[0]).toHaveLength(2);
});

test("a line ending near its start closes, even with a short side; one ending farther stays open", () => {
  // A tenth of its size from its start, then an eighth: closed, by a short
  // side.
  const near = drawingOf(circle(500, 0.97)).figure;
  expect(near.details).toEqual([]);
  expect(isOpenLine(near.outline, near.details)).toBe(false);
  const shut = firstLineOf(circle(500, 0.96));
  expect(shut !== null && "outline" in shut && shut.details).toEqual([]);
  // A sixth: open.
  const wide = firstLineOf(circle(500, 0.95));
  expect(wide !== null && "outline" in wide && wide.details).toHaveLength(1);
  // Three quarters of a circle: a «C», open.
  const open = firstLineOf(circle(500, 0.75));
  if (open === null || !("outline" in open)) throw new Error("no line");
  expect(open.details).toHaveLength(1);
  expect(CLOSED_SHARE).toBe(0.15);
});

test("a line that comes back to its start but cannot be closed stays open: no line is refused", () => {
  // A figure of eight of two equal loops: either loop is half of it.
  const eight: P[] = [
    ...circle(400, 1, Math.PI, [400, 0]),
    ...circle(400, 1, 0, [-400, 0]),
  ];
  expect(outlineOf(eight)).toEqual({ problem: "crosses" });
  const first = firstLineOf(eight);
  if (first === null || !("outline" in first)) throw new Error("no line");
  expect(first.details).toHaveLength(1);
  // Back on its first point: a loop the route runs once.
  const [line] = first.details;
  expect(line[line.length - 1]).toEqual(line[0]);
});

test("lines drawn on an open line hang on it, and keep it open", () => {
  const { placed, figure } = drawingOf(circle(500, 0.5, 0));
  const top = Math.max(...figure.details[0].map(([, y]) => y));
  const hung = placedOf(
    withDetail(
      placed,
      onMap([
        [0, 500],
        [0, 200],
      ]),
    ),
  );
  if (hung.figure.kind !== "drawing") throw new Error(hung.figure.kind);
  expect(hung.figure.details).toHaveLength(2);
  // It starts on the top of the arch, where it came nearest.
  expect(hung.figure.details[1][0][1]).toBeCloseTo(top, 1);
  expect(isOpenLine(hung.figure.outline, hung.figure.details)).toBe(true);
});

test("a line drawn after the first is hung on the drawing, there and back", () => {
  const placed = placedOf(newDrawing(onMap(circle(1000, 0.98))));
  // A line from inside, down towards the circle, ending near it.
  const line = onMap([
    [0, 0],
    [0, -300],
    [0, -600],
    [0, -960],
  ]);
  const hung = placedOf(withDetail(placed, line));
  if (hung.figure.kind !== "drawing") throw new Error(hung.figure.kind);
  const [detail] = hung.figure.details;
  // It starts on the circle, where it came nearest, and runs inwards.
  expect(detail[0][1]).toBeLessThan(-0.9);
  expect(detail[detail.length - 1][1]).toBeCloseTo(0, 1);
  // Same place, same size: only the detail is new.
  expect(hung.centre).toBe(placed.centre);
  expect(hung.unitM).toBe(placed.unitM);
  expect(lookOf(hung.figure).length).toBeGreaterThan(
    lookOf(placed.figure).length + 1.5,
  );
});

test("a detail away from the drawing gets a link; one closing on itself is an eye", () => {
  const placed = placedOf(newDrawing(onMap(circle(1000, 0.98))));
  const eye = onMap(circle(150, 1, 0, [-400, 300]));
  const hung = placedOf(withDetail(placed, eye));
  if (hung.figure.kind !== "drawing") throw new Error(hung.figure.kind);
  const [detail] = hung.figure.details;
  // The link from the circle, then the loop, closed on one of its points.
  const last = detail[detail.length - 1];
  const loop = detail.findIndex((p) => p[0] === last[0] && p[1] === last[1]);
  expect(loop).toBeGreaterThan(0);
  expect(loop).toBeLessThan(detail.length - 1);
  expect(Math.hypot(detail[0][0], detail[0][1])).toBeCloseTo(1, 1);
});

test("a tap on a drawing adds nothing, and too many details are refused", () => {
  const placed = placedOf(newDrawing(onMap(circle(1000, 0.98))));
  expect(
    withDetail(
      placed,
      onMap([
        [0, 0],
        [5, 5],
      ]),
    ),
  ).toBeNull();
  if (placed.figure.kind !== "drawing") throw new Error(placed.figure.kind);
  // A wiggly line is kept wiggly while the route can run it.
  const wiggle = onMap(
    Array.from(
      { length: 30 },
      (_, i) => [-600 + i * 40, i % 2 === 0 ? 150 : -150] as P,
    ),
  );
  const wiggly = placedOf(withDetail(placed, wiggle));
  if (wiggly.figure.kind !== "drawing") throw new Error(wiggly.figure.kind);
  expect(wiggly.figure.details[0].length).toBeGreaterThan(20);
  // Details the route runs 199 points of: one more is too much.
  const start = placed.figure.outline[0];
  const long = Array.from(
    { length: 100 },
    (_, i) => [start[0] - i * 0.009, start[1]] as [number, number],
  );
  const full: Placed = { ...placed, figure: { ...placed.figure, details: [long] } };
  expect(travelledPoints([long])).toBe(199);
  expect(
    withDetail(
      full,
      onMap([
        [0, 0],
        [0, -500],
      ]),
    ),
  ).toEqual({ problem: "too_much" });
  expect(travelledPoints(wiggly.figure.details)).toBeLessThanOrEqual(MAX_DETAIL_POINTS);
});
