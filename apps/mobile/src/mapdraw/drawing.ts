import {
  type LatLon,
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
} from "@shaperoute/shared-types";

import type { Placed, Unit } from "./figure";
import {
  boxOf,
  crossing,
  dist,
  isSimpleRing,
  lineLength,
  nearestOnSegment,
  type P,
  signedArea,
  simplify,
} from "./geometry";
import { fromPlane, toPlane } from "./plane";

/**
 * Lines drawn with a finger on the map (TASK-281), made into what the engine
 * takes (ADR-0069, ADR-0074): the first line becomes the outline, closed by
 * the app, when it ends near its start; else it stays the open line drawn,
 * run there and back (TASK-331). Each line after it is a detail hung on the
 * drawing, run there and back. Done on the plane in metres, then in the
 * drawing's own units.
 */

/** Straightened like the engine's outlines: corners closer than this share
 * of the line's size to the line are dropped (ADR-0068: 1%). */
export const SIMPLIFY_SHARE = 0.01;
/** A first line ending this close to its start, as a share of its size, is
 * a closed shape, which the app closes (TASK-331); farther, it stays open. */
export const CLOSED_SHARE = 0.15;
/** A line ending this close to its start, as a share of its size, ends
 * there: the app closes it without a short side. */
export const CLOSE_SHARE = 0.05;
/** An open line has no outline of its own: a ring this small, as a share of
 * the line's size, at its first point stands for one, and the line is a
 * detail hung there (TASK-331). The request stays an outline with its
 * strokes, as the contract has it. */
export const START_RING_SHARE = 0.005;
/** A line shorter than this share of the drawing adds nothing: a tap, or a
 * slip of the finger (the engine's MIN_DRAWN_SHARE). */
export const MIN_DETAIL_SHARE = 0.03;
/** A detail that starts this close to the drawing starts on it (the
 * engine's SNAP_SHARE); farther, a straight link joins it. */
export const SNAP_SHARE = 0.06;
/** A detail that ends this close to one of its own points closes a loop
 * there, like an eye (the engine's CLOSE_SHARE). */
export const LOOP_SHARE = 0.03;
/** At least this much of a line that crosses itself must be kept when it is
 * cut where it crosses: less, and the drawing is not what was drawn. */
export const KEPT_SHARE = 0.6;

/** Why a line gives no figure: too many details for one route. A first
 * line that cannot be closed stays open instead (TASK-331). */
export type DrawingProblem = "too_much";

export type Drawn = { placed: Placed } | { problem: DrawingProblem } | null;

/** The points of a line, without one equal to the one before. */
function distinct(line: readonly P[]): P[] {
  return line.filter((p, i) => i === 0 || dist(p, line[i - 1]) > 0);
}

/** `line` simplified until it has at most `max` points. */
function simplifiedTo(line: readonly P[], tolerance: number, max: number): P[] {
  let kept = simplify(line, tolerance);
  let wider = tolerance;
  while (kept.length > max) {
    wider *= 1.5;
    kept = simplify(line, wider);
  }
  return kept;
}

/** The line closed: its end brought to its start when it is close, else a
 * last side back to it. */
function closed(line: readonly P[], size: number): P[] {
  const ring = [...line];
  if (ring.length > 2 && dist(ring[ring.length - 1], ring[0]) <= CLOSE_SHARE * size) {
    ring.pop();
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * The largest loop of `line` where it crosses itself, closed at the
 * crossing, that does not cross itself: a line that runs past its start, or
 * a figure of eight, keeps its main loop.
 */
function largestLoop(line: readonly P[]): P[] | null {
  const loops: P[][] = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    for (let j = i + 2; j < line.length - 1; j += 1) {
      const at = crossing(line[i], line[i + 1], line[j], line[j + 1], false);
      if (at !== null) {
        loops.push([at, ...line.slice(i + 1, j + 1), at]);
      }
    }
  }
  loops.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  return loops.find((loop) => isSimpleRing(distinct(loop))) ?? null;
}

/** The closed line with the fewest points cut from its two ends, so that
 * its last side does not cross it. */
function trimmed(line: readonly P[], size: number): P[] | null {
  for (let cut = 1; cut <= line.length - 3; cut += 1) {
    for (let fromStart = 0; fromStart <= cut; fromStart += 1) {
      const ring = closed(line.slice(fromStart, line.length - (cut - fromStart)), size);
      if (isSimpleRing(ring)) {
        return ring;
      }
    }
  }
  return null;
}

/** The outline of a line drawn in metres: closed, not crossing itself, at
 * most MAX_OUTLINE_POINTS corners; null when it encloses nothing. */
export function outlineOf(line: readonly P[]): P[] | { problem: "crosses" } | null {
  const points = distinct(line);
  const { size } = boxOf([points]);
  if (points.length < 3 || size === 0) {
    return null;
  }
  // One point fewer: closing it repeats the first.
  const straight = simplifiedTo(points, SIMPLIFY_SHARE * size, MAX_OUTLINE_POINTS);
  // A straight line encloses nothing.
  if (straight.length < 3) {
    return null;
  }
  let ring = closed(straight, size);
  if (!isSimpleRing(ring)) {
    const loop = largestLoop(straight) ?? trimmed(straight, size);
    if (loop === null || lineLength(loop) < KEPT_SHARE * lineLength(ring)) {
      return { problem: "crosses" };
    }
    ring = loop;
  }
  if (ring.length < 4 || signedArea(ring) === 0) {
    return null;
  }
  return ring;
}

/** The middle of the points of a line on the map. */
function middleOf(line: readonly LatLon[]): LatLon {
  const lat = line.reduce((total, p) => total + p[0], 0) / line.length;
  const lon = line.reduce((total, p) => total + p[1], 0) / line.length;
  return [lat, lon];
}

/**
 * The ring that stands for the outline of an open line (START_RING_SHARE):
 * a small triangle on its first point, behind it, so the line starts on it
 * and leaves it without crossing it. `size` is the drawing's.
 */
export function startRing(first: P, next: P, size: number): P[] {
  const side = START_RING_SHARE * size;
  const length = dist(first, next);
  const back: P = [(first[0] - next[0]) / length, (first[1] - next[1]) / length];
  const turned = (angle: number): P => [
    first[0] + side * (back[0] * Math.cos(angle) - back[1] * Math.sin(angle)),
    first[1] + side * (back[0] * Math.sin(angle) + back[1] * Math.cos(angle)),
  ];
  return [first, turned(Math.PI / 6), turned(-Math.PI / 6), first];
}

/** Whether a drawing is an open line: its outline only the ring at the
 * start of the line (`startRing`), nothing a route draws. */
export function isOpenLine(outline: readonly P[], details: readonly P[][]): boolean {
  if (details.length === 0) {
    return false;
  }
  const ring = boxOf([outline]).size;
  return ring <= 2 * START_RING_SHARE * boxOf([outline, ...details]).size;
}

/**
 * The first line drawn, in metres: its outline, closed by the app, when it
 * ends near its start and encloses something (CLOSED_SHARE); else the open
 * line, hung on the ring at its start and run there and back, as a detail
 * is (TASK-331). Null for a tap.
 */
export function firstLineOf(
  line: readonly P[],
): { outline: P[]; details: P[][] } | { problem: "too_much" } | null {
  const points = distinct(line);
  const { size } = boxOf([points]);
  if (points.length < 2 || size === 0) {
    return null;
  }
  if (dist(points[0], points[points.length - 1]) <= CLOSED_SHARE * size) {
    const outline = outlineOf(points);
    // One that crosses itself, or encloses nothing, stays open.
    if (outline !== null && !("problem" in outline)) {
      return { outline, details: [] };
    }
  }
  const open = fitted(points, size, MAX_DETAIL_POINTS);
  if ("problem" in open) {
    return open;
  }
  return { outline: startRing(open[0], open[1], size), details: [open] };
}

/**
 * A new drawing from the first line drawn on the map (`firstLineOf`), in
 * units of half its size, placed where it was drawn. Null for a tap.
 */
export function newDrawing(line: readonly LatLon[]): Drawn {
  if (line.length < 2) {
    return null;
  }
  const origin = middleOf(line);
  const first = firstLineOf(line.map((point) => toPlane(origin, point)));
  if (first === null || "problem" in first) {
    return first;
  }
  return { placed: placedDrawing(origin, first.outline, first.details) };
}

/**
 * A drawing made on the plane tangent at `origin`, in metres, placed where
 * it is: in units of half its size, about its middle. Its outline closes on
 * its very first point, as the engine reads one; a first detail starting
 * there, the line of an open one, starts on that very point.
 */
export function placedDrawing(
  origin: LatLon,
  outlineM: readonly P[],
  detailsM: readonly (readonly P[])[],
): Placed {
  const { size, middle } = boxOf([outlineM, ...detailsM]);
  const half = size / 2;
  const toUnits = (line: readonly P[]): Unit[] =>
    line.map(([x, y]): Unit => [(x - middle[0]) / half, (y - middle[1]) / half]);
  const outline = toUnits(outlineM);
  outline[outline.length - 1] = outline[0];
  const details = detailsM.map(toUnits);
  for (const [i, detail] of details.entries()) {
    if (dist(detailsM[i][0], outlineM[0]) === 0) {
      detail[0] = outline[0];
    }
  }
  return {
    figure: { kind: "drawing", outline, details },
    centre: fromPlane(origin, middle),
    unitM: half,
  };
}

/** The points of a detail as the route travels them (the engine's
 * `travelled_points`): a loop once, the rest out and back. */
export function travelledPoints(strokes: readonly (readonly Unit[])[]): number {
  return strokes.reduce((total, stroke) => {
    const last = stroke[stroke.length - 1];
    const loop = stroke.findIndex((p) => p[0] === last[0] && p[1] === last[1]);
    return total + stroke.length + loop;
  }, 0);
}

/** Where `point` meets the lines of a drawing nearest, and how far. */
export function nearestOn(
  point: P,
  lines: readonly (readonly P[])[],
): { at: P; away: number } {
  let best = { at: lines[0][0], away: Infinity };
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const at = nearestOnSegment(point, line[i - 1], line[i]);
      const away = dist(point, at);
      if (away < best.away) {
        best = { at, away };
      }
    }
  }
  return best;
}

/**
 * A line drawn on a drawing, hung on it as a detail (ADR-0074): it starts
 * on the drawing at its end nearest to it, or a straight link joins it
 * there; ending near one of its own points it closes a loop there. Null for
 * a line too short to add; `too_much` when the details would be more than a
 * route runs (MAX_DETAIL_POINTS).
 */
export function withDetail(placed: Placed, line: readonly LatLon[]): Drawn {
  const figure = placed.figure;
  if (figure.kind !== "drawing") {
    return null;
  }
  const drawn = line.map((point) => {
    const [x, y] = toPlane(placed.centre, point);
    return [x / placed.unitM, y / placed.unitM] as P;
  });
  const hung = detailOf(figure.outline, figure.details, drawn);
  if (hung === null || "problem" in hung) {
    return hung;
  }
  return {
    placed: {
      ...placed,
      figure: {
        ...figure,
        details: [...figure.details, hung.detail],
        linked: [...linkedOf(figure), hung.linked],
      },
    },
  };
}

/** Detail by detail, whether a drawing's first side is a link (`linked`):
 * none for a drawing made before links were told. */
export function linkedOf(drawing: {
  details: readonly unknown[];
  linked?: readonly boolean[];
}): boolean[] {
  return drawing.details.map((_, i) => drawing.linked?.[i] === true);
}

/**
 * The detail a line drawn on the plane makes, in the units of the drawing
 * it is drawn on (`outline` and `details`), and whether a straight link
 * joins it there (`linked`, TASK-331 part B). Null for a line too short to
 * add; `too_much` when the details would be more than a route runs.
 */
export function detailOf(
  outline: readonly P[],
  details: readonly (readonly P[])[],
  line: readonly P[],
): { detail: P[]; linked: boolean } | { problem: "too_much" } | null {
  const lines: (readonly P[])[] = [outline, ...details];
  const { size } = boxOf(lines);
  const drawn = distinct(line);
  if (drawn.length < 2 || lineLength(drawn) < MIN_DETAIL_SHARE * size) {
    return null;
  }
  const fromStart = nearestOn(drawn[0], lines);
  const fromEnd = nearestOn(drawn[drawn.length - 1], lines);
  const oriented = fromEnd.away < fromStart.away ? [...drawn].reverse() : drawn;
  const hung = fromEnd.away < fromStart.away ? fromEnd : fromStart;
  const linked = hung.away > SNAP_SHARE * size;
  const stroke: P[] = linked ? [hung.at, ...oriented] : [hung.at, ...oriented.slice(1)];
  const detail = fitted(stroke, size, MAX_DETAIL_POINTS - travelledPoints(details));
  return "problem" in detail ? detail : { detail, linked };
}

/** `stroke` straightened as a detail, more each time, until the route can
 * run it within `budget` points; a loop at its end closed on its point. */
function fitted(
  stroke: readonly P[],
  size: number,
  budget: number,
): P[] | { problem: "too_much" } {
  let tolerance = SIMPLIFY_SHARE * size;
  for (let tries = 0; tries < 8; tries += 1) {
    const detail = looped(simplify(stroke, tolerance), size);
    if (detail.length >= 2 && travelledPoints([detail]) <= budget) {
      return detail;
    }
    tolerance *= 2;
  }
  return { problem: "too_much" };
}

/** A detail whose end comes back near one of its own points ends on that
 * very point: a loop, run once. */
function looped(stroke: P[], size: number): P[] {
  const end = stroke[stroke.length - 1];
  const back = stroke.findIndex(
    (point, i) => i < stroke.length - 2 && dist(point, end) <= LOOP_SHARE * size,
  );
  if (back < 0 || stroke.length - back < 4) {
    return stroke;
  }
  return [...stroke.slice(0, -1), stroke[back]];
}
