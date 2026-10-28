import {
  type LatLon,
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
  type OutlinePoint,
  SHAPES,
} from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";

import { canvasRequest } from "../mapdraw/canvasRequest";
import { newDrawing, withDetail } from "../mapdraw/drawing";
import { isSimpleRing, type P } from "../mapdraw/geometry";
import { fromPlane } from "../mapdraw/plane";
import { requestLines, shapeLines } from "./figureLines";
import {
  addLine,
  type BoardPoint,
  erased,
  figureOf,
  type FreehandFigure,
  freehandRequest,
  isDrawnOutline,
  lineAt,
  newFigure,
  withLine,
} from "./freehand";

/**
 * The figure drawn by hand on the board (TASK-320): the rules of the line
 * drawn on the map (drawing.test.ts), on the board's square; «Erase»; and
 * the request, the one «Draw on the map» sends for the same lines.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** A line from `a` to `b` as a finger draws it: `steps` points along it. */
function stroke(a: BoardPoint, b: BoardPoint, steps = 20): BoardPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  });
}

/** Lines one after the other, as one finger stroke. */
function path(...corners: BoardPoint[]): BoardPoint[] {
  return corners.flatMap((corner, i) =>
    i === 0 ? [] : stroke(corners[i - 1], corner).slice(i === 1 ? 0 : 1),
  );
}

/** A square drawn almost round: it ends near its start. */
const SQUARE = path([0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.22]);

function figureOrThrow(added: ReturnType<typeof addLine>): FreehandFigure {
  if (added === null || !("figure" in added)) {
    throw new Error(`no figure: ${JSON.stringify(added)}`);
  }
  return added.figure;
}

/** The same line on the map, in metres around Trento: the board's square
 * is a kilometre wide, y up north. */
function onMap(line: readonly BoardPoint[]): LatLon[] {
  return line.map(([x, y]) => fromPlane(TRENTO, [(x - 0.5) * 1000, (0.5 - y) * 1000]));
}

/** What the API checks of an outline sent back (ADR-0069); with its
 * strokes, the figure is framed as a whole, so the frame's edge may be a
 * detail's (the sun's rays). */
function expectValidOutline(outline: OutlinePoint[], strokes: OutlinePoint[][] = []) {
  expect(outline.length).toBeGreaterThanOrEqual(4);
  expect(outline.length).toBeLessThanOrEqual(MAX_OUTLINE_POINTS + 1);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  const all = [...outline, ...strokes.flat()];
  for (const [x, y] of all) {
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(Math.abs(x)).toBeLessThanOrEqual(1);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  }
  expect(Math.max(...all.flat().map(Math.abs))).toBe(1);
  expect(isSimpleRing(outline)).toBe(true);
}

test("the first line is the outline, closed by the app on its first point", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  // Four corners, the end brought to the start, closed on it.
  expect(figure.outline).toHaveLength(5);
  expect(figure.outline[figure.outline.length - 1]).toEqual(figure.outline[0]);
  expect(figure.outline[0]).toEqual([0.2, 0.2]);
  expect(isSimpleRing(figure.outline)).toBe(true);
  expect(figure.details).toEqual([]);
});

test("a tap says nothing; a line that encloses nothing, and one that crosses itself, say why", () => {
  expect(newFigure([[0.5, 0.5]])).toBeNull();
  expect(
    newFigure([
      [0.5, 0.5],
      [0.5, 0.5],
      [0.51, 0.5],
    ]),
  ).toBeNull();
  expect(newFigure(stroke([0.1, 0.5], [0.9, 0.5]))).toEqual({ problem: "open" });
  // Two loops of the same size, joined: either one is half of what was drawn.
  const zigzag = path(
    [0.5, 0.5],
    [0.9, 0.9],
    [0.9, 0.5],
    [0.5, 0.9],
    [0.1, 0.5],
    [0.1, 0.9],
  );
  expect(newFigure(zigzag)).toEqual({ problem: "crosses" });
  // A line that runs past its start is cut where it crosses itself.
  const past = path(
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.2, 0.1],
    [0.3, 0.1],
  );
  expect(isSimpleRing(figureOrThrow(newFigure(past)).outline)).toBe(true);
});

test("a line after the first is a detail hung on the figure, there and back", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  // From the middle down to near the bottom side: it starts on the side.
  const hung = figureOrThrow(withLine(figure, stroke([0.5, 0.5], [0.5, 0.78])));
  expect(hung.details).toHaveLength(1);
  const [detail] = hung.details;
  expect(detail[0]).toEqual([0.5, 0.8]);
  expect(detail[detail.length - 1]).toEqual([0.5, 0.5]);
  // The outline is as it was.
  expect(hung.outline).toBe(figure.outline);
  // A slip of the finger adds nothing.
  expect(withLine(figure, stroke([0.5, 0.5], [0.505, 0.5]))).toBeNull();
  // `addLine` tells the two apart by the figure there is.
  expect(addLine(null, SQUARE)).toEqual({ figure });
  expect(addLine(figure, stroke([0.5, 0.5], [0.5, 0.78]))).toEqual({ figure: hung });
});

test("too many details for one route are refused", () => {
  let figure = figureOrThrow(newFigure(SQUARE));
  let refused = false;
  // Zigzags inside the square, each with many corners, until the budget ends.
  for (let i = 0; i < 40 && !refused; i += 1) {
    const y = 0.25 + (i % 10) * 0.05;
    const zig = path(
      [0.25, y],
      [0.3, y + 0.02],
      [0.35, y],
      [0.4, y + 0.02],
      [0.45, y],
      [0.5, y + 0.02],
      [0.55, y],
      [0.6, y + 0.02],
      [0.65, y],
      [0.7, y + 0.02],
      [0.75, y],
    );
    const added = withLine(figure, zig);
    if (added !== null && "problem" in added) {
      expect(added.problem).toBe("too_much");
      refused = true;
    } else {
      figure = figureOrThrow(added);
    }
  }
  expect(refused).toBe(true);
});

test("Erase: the line under the finger goes; the outline takes the details with it", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  const one = figureOrThrow(withLine(figure, stroke([0.5, 0.5], [0.5, 0.78])));
  const two = figureOrThrow(withLine(one, stroke([0.3, 0.5], [0.3, 0.78])));
  // A tap on the second detail, a little off it.
  expect(lineAt(two, [0.31, 0.6])).toEqual({ kind: "detail", index: 1 });
  expect(erased(two, [0.31, 0.6])).toEqual({ figure: one });
  // A tap on the outline: nothing is left, and the next line is the outline.
  expect(lineAt(two, [0.8, 0.5])).toEqual({ kind: "outline" });
  expect(erased(two, [0.8, 0.5])).toEqual({ figure: null });
  // A tap on nothing: nothing happens.
  expect(lineAt(two, [0.6, 0.4])).toBeNull();
  expect(erased(two, [0.6, 0.4])).toBeNull();
  // Zoomed in, the finger must come nearer.
  expect(lineAt(two, [0.31, 0.6], 0.005)).toBeNull();
});

test("a detail erased takes the details hung on it", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  const trunk = figureOrThrow(withLine(figure, stroke([0.5, 0.5], [0.5, 0.78])));
  // A branch from the trunk, far from the outline: it starts on the trunk.
  const branch = figureOrThrow(withLine(trunk, stroke([0.5, 0.6], [0.65, 0.6])));
  expect(branch.details).toHaveLength(2);
  expect(erased(branch, [0.5, 0.7])).toEqual({ figure });
  // The branch alone leaves the trunk.
  expect(erased(branch, [0.62, 0.6])).toEqual({ figure: trunk });
});

test("the request is the one «Draw on the map» sends for the same lines", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  const hung = figureOrThrow(withLine(figure, stroke([0.5, 0.5], [0.5, 0.78])));
  const ours = freehandRequest(hung);
  expectValidOutline(ours.outline);
  expect(ours.strokes).toHaveLength(1);
  // The same lines on the map, a kilometre wide.
  const drawn = newDrawing(onMap(SQUARE));
  if (drawn === null || !("placed" in drawn)) throw new Error("no drawing");
  const detailed = withDetail(drawn.placed, onMap(stroke([0.5, 0.5], [0.5, 0.78])));
  if (detailed === null || !("placed" in detailed)) throw new Error("no detail");
  const theirs = canvasRequest(detailed.placed, true, "running");
  if (!("outline" in theirs)) throw new Error("not an image request");
  expect(ours.outline).toHaveLength(theirs.outline.length);
  ours.outline.forEach(([x, y], i) => {
    expect(x).toBeCloseTo(theirs.outline[i][0], 3);
    expect(y).toBeCloseTo(theirs.outline[i][1], 3);
  });
  expect(ours.strokes?.[0]).toHaveLength(theirs.strokes?.[0].length ?? -1);
  ours.strokes?.[0].forEach(([x, y], i) => {
    expect(x).toBeCloseTo(theirs.strokes?.[0][i][0] ?? NaN, 3);
    expect(y).toBeCloseTo(theirs.strokes?.[0][i][1] ?? NaN, 3);
  });
  // y up: the top of the square on the board is the top of the request.
  expect(ours.outline[0]).toEqual([-1, 1]);
});

test("the same figure asks for the same arrays; a figure without details sends no strokes", () => {
  const figure = figureOrThrow(newFigure(SQUARE));
  const request = freehandRequest(figure);
  expect(freehandRequest(figure)).toBe(request);
  expect("strokes" in request).toBe(false);
  // The app knows the outline as the board's: its route is a «Drawing».
  expect(isDrawnOutline(request.outline)).toBe(true);
  expect(isDrawnOutline(imageRequest.outline as OutlinePoint[])).toBe(false);
});

test.each(SHAPES)(
  "the catalogue's «%s» opens as a closed outline the engine takes",
  (shape) => {
    const lines = shapeLines(shape);
    const figure = figureOf(lines);
    if (figure === null) throw new Error("no figure");
    expect(figure.outline[figure.outline.length - 1]).toEqual(figure.outline[0]);
    expect(figure.outline.length).toBeLessThanOrEqual(MAX_OUTLINE_POINTS + 1);
    expect(isSimpleRing(figure.outline)).toBe(true);
    expect(figure.details.reduce((n, d) => n + 2 * d.length, 0)).toBeLessThanOrEqual(
      MAX_DETAIL_POINTS,
    );
    // Every detail starts on the outline or on a detail before it, as the
    // engine reads them; a loop ends on its own point.
    figure.details.forEach((detail, i) => {
      const lines = [figure.outline, ...figure.details.slice(0, i)];
      expect(lines.some((line) => awayFrom(detail[0], line) < 1e-6)).toBe(true);
    });
    // The shapes with eyes, rays or a shell keep them as details.
    if (
      [
        "cat",
        "dog_head",
        "rabbit_head",
        "pumpkin",
        "smiley",
        "ghost",
        "sun",
        "donut",
        "snail",
        "fish",
        "butterfly",
        "christmas_tree",
      ].includes(shape)
    ) {
      expect(figure.details.length).toBeGreaterThan(0);
    }
    // On the board, inside its square.
    for (const [x, y] of figure.outline) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    const request = freehandRequest(figure);
    expectValidOutline(request.outline, request.strokes);
    expect(request.strokes?.length ?? 0).toBe(figure.details.length);
  },
);

/** How far `point` is from the nearest side of `line`. */
function awayFrom(point: P, line: readonly P[]): number {
  let away = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax;
    const dy = by - ay;
    const squared = dx * dx + dy * dy;
    const t =
      squared === 0
        ? 0
        : Math.min(
            1,
            Math.max(0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / squared),
          );
    away = Math.min(away, Math.hypot(ax + t * dx - point[0], ay + t * dy - point[1]));
  }
  return away;
}

test("a shape with more corners than an outline may have is straightened; a valid outline is kept as it is", () => {
  const horse = shapeLines("horse");
  expect(horse.outline.length).toBeGreaterThan(MAX_OUTLINE_POINTS + 1);
  const straightened = figureOf(horse);
  expect(straightened?.outline.length).toBeLessThanOrEqual(MAX_OUTLINE_POINTS + 1);
  const lines = requestLines({
    ...imageRequest,
    start: imageRequest.start as LatLon,
    outline: imageRequest.outline as OutlinePoint[],
    activity: "running",
  });
  if (lines === null) throw new Error("no lines");
  const kept = figureOf(lines);
  expect(kept?.outline).toBe(lines.outline);
  // A line that encloses nothing opens no figure.
  expect(figureOf({ outline: stroke([0.1, 0.5], [0.9, 0.5]), details: [] })).toBeNull();
  // Details beyond what a route runs open no figure either.
  const many: P[][] = Array.from({ length: 30 }, (_, i) =>
    stroke([0.5, 0.5], [0.5 + i * 0.01, 0.78], 10),
  );
  expect(figureOf({ outline: kept?.outline ?? [], details: many })).toBeNull();
});
