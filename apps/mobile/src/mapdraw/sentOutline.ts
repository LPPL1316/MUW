import type { OutlinePoint } from "@shaperoute/shared-types";

import { awayFrom } from "./edit";
import { dist } from "./geometry";

/**
 * The outline «Draw route» sends (TASK-382): one the engine takes. The app
 * checks a figure before it is framed and rounded to a ten-thousandth
 * (`canvasRequest.framed`), and rounding can make two sides that nearly
 * touch meet: the thin strip or the spike that the leg from the shore
 * leaves in a route on the water, edited (TASK-369). The engine then
 * refuses the whole outline (`parse_outline`, «the outline crosses
 * itself», 422) and the phone said only «Something went wrong». Here the
 * outline is checked as it is sent, with the engine's own rule, and the
 * corners between two sides that meet are left out: never a new point, so
 * nothing is rounded again.
 */

type Point = OutlinePoint;

/** How near the outline a detail must start, as a share of the outline's
 * width: the engine's ATTACH_TOLERANCE (route_engine/shapes/outline.py). */
const ATTACH_TOLERANCE = 1e-3;

/** Positive when a → b → c turns left, zero on a line: the engine's
 * `_orient`, the same operations in the same order, so that the two agree
 * to the last bit. */
function orient(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** b → c goes back along a → b (`_folds_back`). */
function foldsBack(a: Point, b: Point, c: Point): boolean {
  return (
    orient(a, b, c) === 0 &&
    (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
  );
}

/** p, on the line through a and b, lies on the segment a-b (`_within`). */
function within(a: Point, b: Point, p: Point): boolean {
  const [x0, x1] = a[0] <= b[0] ? [a[0], b[0]] : [b[0], a[0]];
  const [y0, y1] = a[1] <= b[1] ? [a[1], b[1]] : [b[1], a[1]];
  return x0 <= p[0] && p[0] <= x1 && y0 <= p[1] && p[1] <= y1;
}

/** The sides p1-p2 and q1-q2 cross or touch (`_meet`). */
function meet(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = orient(q1, q2, p1);
  const d2 = orient(q1, q2, p2);
  const d3 = orient(p1, p2, q1);
  const d4 = orient(p1, p2, q2);
  if (d1 * d2 < 0 && d3 * d4 < 0) {
    return true;
  }
  return (
    (d1 === 0 && within(q1, q2, p1)) ||
    (d2 === 0 && within(q1, q2, p2)) ||
    (d3 === 0 && within(p1, p2, q1)) ||
    (d4 === 0 && within(p1, p2, q2))
  );
}

function same(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** The distinct corners of a ring, as the engine reads an outline
 * (`_ring`): a corner that repeats the one before is left out, and so is
 * the last when it is the first again. */
export function cornersOf(ring: readonly Point[]): Point[] {
  const corners: Point[] = [];
  for (const point of ring) {
    if (corners.length === 0 || !same(point, corners[corners.length - 1])) {
      corners.push(point);
    }
  }
  if (corners.length > 1 && same(corners[corners.length - 1], corners[0])) {
    corners.pop();
  }
  return corners;
}

/**
 * The first two sides of the ring of `corners` that meet, as the engine
 * finds them (`_first_crossing`): sides i and j, from corners i and j;
 * neighbours only when the second goes back along the first. Null when
 * none do.
 */
export function firstMeeting(corners: readonly Point[]): [number, number] | null {
  const n = corners.length;
  for (let i = 0; i < n; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    if (foldsBack(a, b, corners[(i + 2) % n])) {
      return [i, (i + 1) % n];
    }
    for (let j = i + 2; j < n; j += 1) {
      if (!(i === 0 && j === n - 1) && meet(a, b, corners[j], corners[(j + 1) % n])) {
        return [i, j];
      }
    }
  }
  return null;
}

/** `corners` without those between the sides i and j that meet: of the
 * two ways round from one to the other, the one with fewer corners. */
function without(corners: readonly Point[], [i, j]: [number, number]): Point[] {
  const n = corners.length;
  if (j === (i + 1) % n) {
    // A side going back along the one before: their shared corner.
    return corners.filter((_, k) => k !== j);
  }
  const between = j - i;
  return between <= n - between
    ? [...corners.slice(0, i + 1), ...corners.slice(j + 1)]
    : corners.slice(i + 1, j + 1);
}

/** Whether each detail starts on the outline or on a detail before it, as
 * near as the engine asks (`_strokes`). */
function attached(
  corners: readonly Point[],
  details: readonly OutlinePoint[][],
): boolean {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const tolerance =
    ATTACH_TOLERANCE *
    Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const lines: OutlinePoint[][] = [[...corners, corners[0]]];
  for (const detail of details) {
    if (!lines.some((line) => awayFrom(detail[0], line) <= tolerance)) {
      return false;
    }
    lines.push(detail);
  }
  return true;
}

/**
 * `outline`, closed and framed as it goes to the engine, with `details` as
 * they go with it: as it is when the engine takes it; else with the corners
 * between two sides that meet left out until none do — the spike or the
 * strip, or a small loop the rounding pinched — starting on the corner
 * nearest its first one, where the route starts. As it is, too, when too
 * little would be left or a detail would no longer start on it: the API
 * then says what is wrong, as before.
 */
export function sentOutline(
  outline: OutlinePoint[],
  details: readonly OutlinePoint[][],
): OutlinePoint[] {
  let corners = cornersOf(outline);
  if (corners.length < 3 || firstMeeting(corners) === null) {
    return outline;
  }
  for (;;) {
    const meeting = firstMeeting(corners);
    if (meeting === null) {
      break;
    }
    corners = cornersOf(without(corners, meeting));
    if (corners.length < 3) {
      return outline;
    }
  }
  if (!attached(corners, details)) {
    return outline;
  }
  const start = outline[0];
  const first = corners.reduce(
    (best, corner, k) => (dist(corner, start) < dist(corners[best], start) ? k : best),
    0,
  );
  const ring = [...corners.slice(first), ...corners.slice(0, first)];
  return [...ring, ring[0]];
}
