import type { Segment } from "../activities/fitLines";

/**
 * The pieces of a challenge (TASK-296 part D, ADR-0255; docs/GIOCO.md
 * §6.2): a shape's outline cut into N stretches of equal length, the same
 * cut the API makes (`game_rules.pieces_of`), and the pieces placed in a
 * square to be drawn as thin turned Views, all of them fitted together so
 * one piece lies where the shape has it.
 */

export type Point = readonly [number, number];

/** The decimals the API rounds the pieces to (`game_rules.OUTLINE_DECIMALS`). */
export const OUTLINE_DECIMALS = 4;

/** Python's `round(x, 4)` on a double: the exact value, correctly rounded.
 * `toFixed` reads the exact value too; the two differ only on an exact tie
 * at the fifth decimal, which no cut of the catalog's outlines makes. */
function rounded(value: number): number {
  return Number(value.toFixed(OUTLINE_DECIMALS));
}

/** `bisect.bisect_right`: the first index whose value is above `distance`. */
function bisectRight(along: readonly number[], distance: number): number {
  let low = 0;
  let high = along.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (distance < along[mid]) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

/** The point `distance` along the outline, read in a straight line on the
 * segment it falls in (`game_rules._point_at`). */
function pointAt(
  points: readonly Point[],
  along: readonly number[],
  distance: number,
): [number, number] {
  if (distance <= 0) {
    return [points[0][0], points[0][1]];
  }
  const last = points[points.length - 1];
  if (distance >= along[along.length - 1]) {
    return [last[0], last[1]];
  }
  const i = bisectRight(along, distance) - 1;
  const side = along[i + 1] - along[i];
  const share = side > 0 ? (distance - along[i]) / side : 0;
  const [x0, y0] = points[i];
  const [x1, y1] = points[i + 1];
  return [x0 + (x1 - x0) * share, y0 + (y1 - y0) * share];
}

/**
 * The closed outline cut into `n` pieces of equal length along it, from its
 * first point on: piece k runs from k·L/n to (k+1)·L/n, L the length of the
 * outline with each segment measured as sqrt(dx² + dy²); the last piece
 * ends at L itself. A piece has its two ends and the outline's points
 * strictly between them, all rounded to OUTLINE_DECIMALS. The same
 * operations in the same order as the API's `pieces_of`, so the two give
 * the same numbers (`pieceSegments.test.ts` checks them against its).
 */
export function piecesOf(outline: readonly Point[], n: number): [number, number][][] {
  if (n < 1) {
    throw new Error("a shape is cut into at least one piece");
  }
  if (outline.length === 0) {
    return Array.from({ length: n }, () => []);
  }
  const along = [0];
  for (let i = 1; i < outline.length; i += 1) {
    const dx = outline[i][0] - outline[i - 1][0];
    const dy = outline[i][1] - outline[i - 1][1];
    along.push(along[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const length = along[along.length - 1];
  const pieces: [number, number][][] = [];
  for (let k = 0; k < n; k += 1) {
    const start = (length * k) / n;
    const end = k === n - 1 ? length : (length * (k + 1)) / n;
    const piece: [number, number][] = [pointAt(outline, along, start)];
    outline.forEach((point, i) => {
      if (start < along[i] && along[i] < end) {
        piece.push([point[0], point[1]]);
      }
    });
    piece.push(pointAt(outline, along, end));
    pieces.push(piece.map(([x, y]) => [rounded(x), rounded(y)]));
  }
  return pieces;
}

/**
 * Where each point of the whole shape goes in a square of `size` points
 * with `pad` around, proportions kept and centred (as `outlineSegments`
 * fits one outline): one placement for all the pieces, so they join.
 */
export function placeOutline(
  outline: readonly Point[],
  size: number,
  pad: number,
): (point: Point) => [number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (outline.length === 0) {
    return () => [size / 2, size / 2];
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = (size - 2 * pad) / Math.max(spanX, spanY);
  const offX = (size - spanX * scale) / 2;
  const offY = (size - spanY * scale) / 2;
  return ([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale];
}

/** The length of a line through `points`. */
export function lengthOf(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  }
  return length;
}

/**
 * The line through `points` cut at `share` of its length, from 0 to 1: the
 * part run and the part left, which meet at the cut. A share of 0 leaves
 * everything; a share of 1 takes everything.
 */
export function splitPolyline(
  points: readonly Point[],
  share: number,
): [Point[], Point[]] {
  const whole = lengthOf(points);
  const limit = Math.min(1, Math.max(0, share));
  if (points.length < 2 || whole === 0) {
    return limit >= 1 ? [[...points], []] : [[], [...points]];
  }
  const target = whole * limit;
  if (target <= 0) {
    return [[], [...points]];
  }
  if (target >= whole) {
    return [[...points], []];
  }
  const done: Point[] = [points[0]];
  let along = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const side = Math.hypot(x1 - x0, y1 - y0);
    if (along + side >= target) {
      const part = side > 0 ? (target - along) / side : 0;
      const cut: Point = [x0 + (x1 - x0) * part, y0 + (y1 - y0) * part];
      done.push(cut);
      return [done, [cut, ...points.slice(i)]];
    }
    along += side;
    done.push(points[i]);
  }
  return [done, []];
}

/** The thin turned Views that draw the line through placed `points`, in
 * their order; a stretch shorter than half a point is not drawn. */
export function polylineSegments(points: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 0.5) {
      continue;
    }
    segments.push({
      left: (x1 + x2) / 2 - length / 2,
      top: (y1 + y2) / 2,
      length,
      angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
    });
  }
  return segments;
}
