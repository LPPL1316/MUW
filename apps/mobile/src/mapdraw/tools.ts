import {
  type LatLon,
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
} from "@shaperoute/shared-types";

import {
  type DrawingProblem,
  isOpenLine,
  linkedOf,
  MIN_DETAIL_SHARE,
  nearestOn,
  placedDrawing,
  SIMPLIFY_SHARE,
  startRing,
  travelledPoints,
} from "./drawing";
import { awayFrom, type Drawing, ON_LINE } from "./edit";
import type { Placed, Unit } from "./figure";
import {
  boxOf,
  dist,
  isSimpleRing,
  lineLength,
  nearestOnSegment,
  type P,
  simplify,
} from "./geometry";
import { toPlane } from "./plane";

/**
 * The tools of «Draw on the map» past the pen (TASK-331 part B, ADR-0288):
 * the eraser takes away the piece of a line a finger rubs, the straight
 * line is tapped point by point, and a line held and dragged bends. All on
 * a drawing in its own units. The route is one way round (ADR-0074): a
 * piece cut off from the drawing joins it again with the shortest link,
 * which the map shows dashed.
 */

/** How far along a line a bend reaches, either side of the point held, as
 * a share of the drawing's size; the map page bends it the same way. */
export const BEND_SHARE = 0.2;

/** A corner this near to the point held, as a share of the finger's reach,
 * is the point held; farther, a new corner is made there. */
export const CORNER_SHARE = 0.5;

/** Why a tool changed nothing: too much for one route, or an outline that
 * would cross itself. */
export type ToolProblem = DrawingProblem | "crosses";

/** `point` of the map in the units of `placed`. */
export function unitsOf(placed: Placed, point: LatLon): Unit {
  const [x, y] = toPlane(placed.centre, point);
  return [x / placed.unitM, y / placed.unitM];
}

/** Whether `line` ends on one of its own points: a loop, run once. */
function isLoop(line: readonly P[]): boolean {
  const last = line[line.length - 1];
  return line.findIndex((p) => p[0] === last[0] && p[1] === last[1]) < line.length - 1;
}

/** A point of a line the eraser looks at: a corner or a point between, and
 * whether it is left. */
type Sample = { at: P; corner: boolean; left: boolean };

/** `line` looked at every third of `radius`, each point left or rubbed out
 * by the finger's path `rubbed`. */
function sampled(line: readonly P[], rubbed: readonly P[], radius: number): Sample[] {
  const step = radius / 3;
  const samples: Sample[] = [];
  const add = (at: P, corner: boolean) =>
    samples.push({ at, corner, left: awayFrom(at, rubbed) > radius });
  line.forEach((point, i) => {
    if (i > 0) {
      const from = line[i - 1];
      const steps = Math.ceil(dist(from, point) / step);
      for (let k = 1; k < steps; k += 1) {
        add(
          [
            from[0] + ((point[0] - from[0]) * k) / steps,
            from[1] + ((point[1] - from[1]) * k) / steps,
          ],
          false,
        );
      }
    }
    add(point, true);
  });
  return samples;
}

/** The runs of points left, each a line of its corners and of where it was
 * cut. */
function leftRuns(samples: readonly Sample[]): P[][] {
  const runs: P[][] = [];
  let run: Sample[] = [];
  const close = () => {
    if (run.length >= 2) {
      const last = run.length - 1;
      runs.push(
        run.filter((s, i) => s.corner || i === 0 || i === last).map((s) => s.at),
      );
    }
    run = [];
  };
  for (const sample of samples) {
    if (sample.left) {
      run.push(sample);
    } else {
      close();
    }
  }
  close();
  return runs;
}

/** What is left of `line` after the finger's path, in pieces; a `ring`,
 * closed on its first point, keeps a piece across that point whole. Null
 * when nothing of it was rubbed. */
function leftOf(
  line: readonly P[],
  rubbed: readonly P[],
  radius: number,
  ring: boolean,
): P[][] | null {
  const samples = sampled(line, rubbed, radius);
  if (samples.every((s) => s.left)) {
    return null;
  }
  const runs = leftRuns(samples);
  if (ring && runs.length >= 2 && samples[0].left && samples[samples.length - 1].left) {
    const last = runs[runs.length - 1];
    return [[...last, ...runs[0].slice(1)], ...runs.slice(1, -1)];
  }
  return runs;
}

/**
 * The drawing of `outline` and of `pieces`: the outline as it is, or, with
 * none, the first piece as an open line on a small ring (TASK-331); each
 * other piece then joins it, the nearest first, at the end nearest to it:
 * on it when it touches it, else by a straight link. Straightened more
 * when the details are more than a route runs. `{ drawing: null }` for
 * nothing left.
 */
function joined(
  outline: P[] | null,
  pieces: readonly P[][],
): { drawing: Drawing | null } | { problem: "too_much" } {
  const rest = [...pieces];
  const details: P[][] = [];
  const linked: boolean[] = [];
  let ring = outline;
  if (ring === null) {
    const main = rest.shift();
    if (main === undefined) {
      return { drawing: null };
    }
    ring = startRing(main[0], main[1], boxOf(pieces).size);
    details.push(main);
    linked.push(false);
  }
  while (rest.length > 0) {
    const lines = outline === null ? details : [outline, ...details];
    let best = { piece: 0, reversed: false, ...nearestOn(rest[0][0], lines) };
    rest.forEach((piece, i) => {
      const ends = isLoop(piece) ? [false] : [false, true];
      for (const reversed of ends) {
        const end = reversed ? piece[piece.length - 1] : piece[0];
        const near = nearestOn(end, lines);
        if (near.away < best.away) {
          best = { piece: i, reversed, ...near };
        }
      }
    });
    const [taken] = rest.splice(best.piece, 1);
    const piece = best.reversed ? [...taken].reverse() : taken;
    const touching = best.away <= ON_LINE;
    details.push(touching ? [best.at, ...piece.slice(1)] : [best.at, ...piece]);
    linked.push(!touching);
  }
  return fittedDrawing(ring, details, linked);
}

/** The drawing, its details straightened more each time until the route
 * runs them (MAX_DETAIL_POINTS); a link stays as it is. */
function fittedDrawing(
  outline: P[],
  details: P[][],
  linked: boolean[],
): { drawing: Drawing } | { problem: "too_much" } {
  let kept = details;
  let tolerance = SIMPLIFY_SHARE * boxOf([outline, ...details]).size;
  for (let tries = 0; travelledPoints(kept) > MAX_DETAIL_POINTS; tries += 1) {
    if (tries === 8) {
      return { problem: "too_much" };
    }
    kept = details.map((detail, i) =>
      linked[i]
        ? [detail[0], ...simplify(detail.slice(1), tolerance)]
        : simplify(detail, tolerance),
    );
    tolerance *= 2;
  }
  return { drawing: { kind: "drawing", outline, details: kept, linked } };
}

/**
 * The eraser (TASK-331 part B): what is within `radius` of the finger's
 * path `rubbed` taken away from the lines of `drawing`, in its units. A
 * cut outline is a line again; what is left of a line too short to see
 * goes. Without the outline, the line of an open one left whole, or else
 * the longest piece left, is the line the others join. A link is no line
 * drawn: what it joined joins again. `{ drawing: null }` when nothing is
 * left; null when the finger rubbed no line.
 */
export function erased(
  drawing: Drawing,
  rubbed: readonly Unit[],
  radius: number,
): { drawing: Drawing | null } | { problem: "too_much" } | null {
  const { size } = boxOf([drawing.outline, ...drawing.details]);
  const open = isOpenLine(drawing.outline, drawing.details);
  const linked = linkedOf(drawing);
  let cut = false;
  let outline: P[] | null = null;
  // The pieces left, those of a line left whole first.
  const whole: P[][] = [];
  const cutPieces: P[][] = [];
  if (!open) {
    const left = leftOf(drawing.outline, rubbed, radius, true);
    if (left === null) {
      outline = drawing.outline;
    } else {
      cut = true;
      cutPieces.push(...left);
    }
  }
  drawing.details.forEach((detail, i) => {
    const drawn = linked[i] ? detail.slice(1) : detail;
    const left = leftOf(drawn, rubbed, radius, false);
    if (left === null) {
      whole.push(drawn);
    } else {
      cut = true;
      cutPieces.push(...left);
    }
  });
  if (!cut) {
    return null;
  }
  const seen = cutPieces.filter(
    (piece) => lineLength(piece) >= MIN_DETAIL_SHARE * size,
  );
  if (
    outline !== null ||
    (open && linked.length > 0 && whole[0] === drawing.details[0])
  ) {
    return joined(outline, [...whole, ...seen]);
  }
  const pieces = [...whole, ...seen].sort((a, b) => lineLength(b) - lineLength(a));
  return joined(null, pieces);
}

/** A straight line being tapped (TASK-331 part B): its first point, until
 * a second makes it a line; then the detail of the drawing it is, and
 * where its points tapped start in it, after a link. */
export type Straight =
  { kind: "first"; at: LatLon } | { kind: "line"; index: number; from: number };

/** The lines of a drawing a finger may change: the outline, but not the
 * ring of an open line; each detail after its link. */
function changeable(
  drawing: Drawing,
): { line: readonly P[]; detail: number | null; from: number }[] {
  const linked = linkedOf(drawing);
  const lines = drawing.details.map((line, i) => ({
    line,
    detail: i as number | null,
    from: linked[i] ? 1 : 0,
  }));
  return isOpenLine(drawing.outline, drawing.details)
    ? lines
    : [{ line: drawing.outline, detail: null, from: 0 }, ...lines];
}

/**
 * The second point tapped: a straight line from the first. On a drawing it
 * is a detail that starts on it when the first point is within `reachM` of
 * it, else joined to it by a link; on nothing, an open line of its own,
 * where it was tapped. `too_much` when the route would not run it.
 */
export function straightStarted(
  on: { placed: Placed; drawing: Drawing } | null,
  first: LatLon,
  second: LatLon,
  reachM: number,
): { placed: Placed; straight: Straight } | { problem: "too_much" } {
  if (on === null) {
    const origin: LatLon = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    const a = toPlane(origin, first);
    const b = toPlane(origin, second);
    return {
      placed: placedDrawing(origin, startRing(a, b, dist(a, b)), [[a, b]]),
      straight: { kind: "line", index: 0, from: 0 },
    };
  }
  const { placed, drawing } = on;
  const a = unitsOf(placed, first);
  const b = unitsOf(placed, second);
  const near = nearestOn(
    a,
    changeable(drawing).map((one) => one.line),
  );
  const starts = near.away <= reachM / placed.unitM;
  const detail = starts ? [near.at, b] : [near.at, a, b];
  const details = [...drawing.details, detail];
  if (travelledPoints(details) > MAX_DETAIL_POINTS) {
    return { problem: "too_much" };
  }
  return {
    placed: {
      ...placed,
      figure: {
        kind: "drawing",
        outline: drawing.outline,
        details,
        linked: [...linkedOf(drawing), !starts],
      },
    },
    straight: { kind: "line", index: drawing.details.length, from: starts ? 0 : 1 },
  };
}

/**
 * The next point tapped on a straight line: the line goes on to it. On its
 * first point, within `reach`, after two more, it closes there — and is the
 * outline when it is all there is and does not cross itself. `too_much`
 * when the route would not run it.
 */
export function straightGoneOn(
  drawing: Drawing,
  straight: { index: number; from: number },
  point: Unit,
  reach: number,
): { drawing: Drawing; closed: boolean } | { problem: "too_much" } {
  const detail = drawing.details[straight.index];
  const tapped = detail.slice(straight.from);
  const closed = tapped.length >= 3 && dist(point, tapped[0]) <= reach;
  const line = closed ? [...detail, tapped[0]] : [...detail, point];
  const alone =
    drawing.details.length === 1 && isOpenLine(drawing.outline, drawing.details);
  if (closed && alone && line.length <= MAX_OUTLINE_POINTS + 1 && isSimpleRing(line)) {
    return {
      drawing: { kind: "drawing", outline: line, details: [], linked: [] },
      closed,
    };
  }
  const details = drawing.details.map((one, i) => (i === straight.index ? line : one));
  if (travelledPoints(details) > MAX_DETAIL_POINTS) {
    return { problem: "too_much" };
  }
  return { drawing: { ...drawing, details, linked: linkedOf(drawing) }, closed };
}

/** How much of a bend a point gets at `away` along the line from the point
 * held: all of it there, less and less, none past `reach`. */
function share(away: number, reach: number): number {
  if (away >= reach) {
    return 0;
  }
  const r = away / reach;
  return (1 - r * r) ** 2;
}

/** How far along `line` each of its points is from its first. */
function along(line: readonly P[]): number[] {
  const at = [0];
  for (let i = 1; i < line.length; i += 1) {
    at.push(at[i - 1] + dist(line[i - 1], line[i]));
  }
  return at;
}

/** Where `point`, lying on `line`, is on it: the side, and how far along. */
function placeOn(line: readonly P[], point: P): { side: number; t: number } {
  let best = { side: 0, t: 0, away: Infinity };
  for (let i = 1; i < line.length; i += 1) {
    const at = nearestOnSegment(point, line[i - 1], line[i]);
    const away = dist(point, at);
    if (away < best.away) {
      const length = dist(line[i - 1], line[i]);
      best = {
        side: i - 1,
        t: length === 0 ? 0 : dist(line[i - 1], at) / length,
        away,
      };
    }
  }
  return best;
}

/**
 * A line held at `held` and dragged to `to` (TASK-331 part B): the point
 * of the line nearest to `held`, within `reach`, goes to `to` — a corner,
 * when one is that near, else a new one — and the line bends with it,
 * less and less, along BEND_SHARE of the drawing's size either side. The
 * start of a detail stays where it hangs; a detail hung on the line bent
 * moves with it. Null when no line is held; `crosses` when the outline
 * would cross itself.
 */
export function bent(
  drawing: Drawing,
  held: Unit,
  to: Unit,
  reach: number,
): { drawing: Drawing } | { problem: "crosses" } | null {
  let best: { detail: number | null; side: number; at: P; away: number } | null = null;
  for (const { line, detail, from } of changeable(drawing)) {
    for (let i = from + 1; i < line.length; i += 1) {
      const at = nearestOnSegment(held, line[i - 1], line[i]);
      const away = dist(held, at);
      if (away <= reach && (best === null || away < best.away)) {
        best = { detail, side: i - 1, at, away };
      }
    }
  }
  if (best === null) {
    return null;
  }
  const ring = best.detail === null;
  const line = ring ? drawing.outline : drawing.details[best.detail as number];
  const points = [...line];
  const [a, b] = [best.side, best.side + 1];
  let corner = dist(line[a], best.at) <= dist(line[b], best.at) ? a : b;
  const room = ring
    ? points.length <= MAX_OUTLINE_POINTS
    : travelledPoints(drawing.details) + 2 <= MAX_DETAIL_POINTS;
  if (dist(line[corner], best.at) > CORNER_SHARE * reach && room) {
    points.splice(b, 0, best.at);
    corner = b;
  }
  if (ring && corner === points.length - 1) {
    corner = 0;
  }
  // The start of a detail hangs on the drawing.
  if (!ring && corner === 0) {
    return null;
  }
  const by: P = [to[0] - points[corner][0], to[1] - points[corner][1]];
  const reachAlong = BEND_SHARE * boxOf([drawing.outline, ...drawing.details]).size;
  const at = along(points);
  const total = at[at.length - 1];
  const moved = points.map((point, k): P => {
    const apart = Math.abs(at[k] - at[corner]);
    const away = ring ? Math.min(apart, total - apart) : apart;
    const part = !ring && k === 0 ? 0 : share(away, reachAlong);
    return [point[0] + part * by[0], point[1] + part * by[1]];
  });
  if (ring) {
    moved[moved.length - 1] = moved[0];
    if (!isSimpleRing(moved)) {
      return { problem: "crosses" };
    }
  }
  // A detail hung on the line bent hangs on it still.
  const details = drawing.details.map((detail, i) => {
    if (i === best?.detail) {
      return moved;
    }
    if (awayFrom(detail[0], points) > ON_LINE) {
      return detail;
    }
    const { side, t } = placeOn(points, detail[0]);
    const [from, next] = [moved[side], moved[side + 1]];
    const start: P = [
      from[0] + t * (next[0] - from[0]),
      from[1] + t * (next[1] - from[1]),
    ];
    return [start, ...detail.slice(1)];
  });
  return {
    drawing: {
      ...drawing,
      outline: ring ? moved : drawing.outline,
      details,
      linked: linkedOf(drawing),
    },
  };
}
