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
 * the app; each line after it a detail hung on the drawing, run there and
 * back. Done on the plane in metres, then in the drawing's own units.
 */

/** Straightened like the engine's outlines: corners closer than this share
 * of the line's size to the line are dropped (ADR-0068: 1%). */
export const SIMPLIFY_SHARE = 0.01;
/** A line ending this close to its start, as a share of its size, ends
 * there: the app closes it without a short side. */
export const CLOSE_SHARE = 0.05;
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

/** Why a line gives no figure: it crosses itself where the app cannot cut
 * it; too many details for one route. */
export type DrawingProblem = "crosses" | "too_much";

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
 * A new drawing from the first line drawn on the map: its outline, closed
 * by the app, in units of half its size, placed where it was drawn. Null
 * for a tap or a line that encloses nothing.
 */
export function newDrawing(line: readonly LatLon[]): Drawn {
  if (line.length < 3) {
    return null;
  }
  const origin = middleOf(line);
  const outline = outlineOf(line.map((point) => toPlane(origin, point)));
  if (outline === null || "problem" in outline) {
    return outline;
  }
  const { size, middle } = boxOf([outline]);
  const half = size / 2;
  const units = outline.map(([x, y]): Unit => [
    (x - middle[0]) / half,
    (y - middle[1]) / half,
  ]);
  // Closed on the very first point, as the engine reads an outline.
  units[units.length - 1] = units[0];
  return {
    placed: {
      figure: { kind: "drawing", outline: units, details: [] },
      centre: fromPlane(origin, middle),
      unitM: half,
    },
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
function nearestOn(
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
  const lines: P[][] = [figure.outline, ...figure.details];
  const { size } = boxOf(lines);
  const drawn = distinct(
    line.map((point) => {
      const [x, y] = toPlane(placed.centre, point);
      return [x / placed.unitM, y / placed.unitM] as P;
    }),
  );
  if (drawn.length < 2 || lineLength(drawn) < MIN_DETAIL_SHARE * size) {
    return null;
  }
  const fromStart = nearestOn(drawn[0], lines);
  const fromEnd = nearestOn(drawn[drawn.length - 1], lines);
  const oriented = fromEnd.away < fromStart.away ? [...drawn].reverse() : drawn;
  const hung = fromEnd.away < fromStart.away ? fromEnd : fromStart;
  const stroke: P[] =
    hung.away <= SNAP_SHARE * size
      ? [hung.at, ...oriented.slice(1)]
      : [hung.at, ...oriented];
  const budget = MAX_DETAIL_POINTS - travelledPoints(figure.details);
  let tolerance = SIMPLIFY_SHARE * size;
  for (let tries = 0; tries < 8; tries += 1) {
    const detail = looped(simplify(stroke, tolerance), size);
    if (detail.length >= 2 && travelledPoints([detail]) <= budget) {
      return {
        placed: {
          ...placed,
          figure: { ...figure, details: [...figure.details, detail] },
        },
      };
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
