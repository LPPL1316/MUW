import {
  MAX_DETAIL_POINTS,
  MAX_OUTLINE_POINTS,
  type OutlinePoint,
} from "@shaperoute/shared-types";

import { framed } from "../mapdraw/canvasRequest";
import {
  detailOf,
  type DrawingProblem,
  outlineOf,
  travelledPoints,
} from "../mapdraw/drawing";
import { dist, isSimpleRing, nearestOnSegment, type P } from "../mapdraw/geometry";

/**
 * The figure drawn with a finger on the board of «Draw» (TASK-320,
 * ADR-0280), with the rules of the line drawn on the map (ADR-0245) brought
 * to the board's square instead of the plane in metres: the first line is
 * the outline, closed by the app; each line after it a detail hung on the
 * figure, run there and back; a tap with «Erase» on takes a line away. All
 * on the phone: nothing goes out before «Draw route».
 */

/** A point of the board: shares of its square, from the top left, y down,
 * as the lines of a picture are drawn over it (`image_points`). */
export type BoardPoint = OutlinePoint;

/** The outline, closed on its first point, and the details hung on it. */
export type FreehandFigure = { outline: BoardPoint[]; details: BoardPoint[][] };

/** Lines to open in the board, as a figure proposes them: not yet checked. */
export type FreehandLines = { outline: BoardPoint[]; details: BoardPoint[][] };

/** Why a line gave nothing: the map's reasons, and a first line that
 * encloses nothing (a straight line, a dot). */
export type FreehandProblem = DrawingProblem | "open";

export type Added = { figure: FreehandFigure } | { problem: FreehandProblem } | null;

/** How near a tap must come to a line to erase it, as a share of the
 * board's square: a finger's width, about. */
export const ERASE_SHARE = 0.05;

/** A point lying on a line, as near as the arithmetic puts it. */
const ON_LINE = 1e-6;

/** The points of a line, without one equal to the one before. */
function distinct(line: readonly BoardPoint[]): BoardPoint[] {
  return line.filter((p, i) => i === 0 || dist(p, line[i - 1]) > 0);
}

/**
 * The figure of the first line: its outline, closed by the app, as the map
 * makes it (`outlineOf`). Null for a tap, which says nothing; `open` for a
 * line that encloses nothing; `crosses` for one that cannot be closed.
 */
export function newFigure(line: readonly BoardPoint[]): Added {
  if (distinct(line).length < 3) {
    return null;
  }
  const outline = outlineOf(line);
  if (outline === null) {
    return { problem: "open" };
  }
  if ("problem" in outline) {
    return outline;
  }
  return { figure: { outline, details: [] } };
}

/**
 * A line drawn on the figure, hung on it as a detail, as on the map
 * (`detailOf`): null for a line too short to add; `too_much` when the
 * details would be more than a route runs.
 */
export function withLine(figure: FreehandFigure, line: readonly BoardPoint[]): Added {
  const detail = detailOf(figure.outline, figure.details, line);
  if (detail === null || "problem" in detail) {
    return detail;
  }
  return { figure: { ...figure, details: [...figure.details, detail] } };
}

/** A line drawn on the board: the outline when there is none, a detail
 * after it. */
export function addLine(
  figure: FreehandFigure | null,
  line: readonly BoardPoint[],
): Added {
  return figure === null ? newFigure(line) : withLine(figure, line);
}

/** How far `point` is from the nearest side of `line`. */
function awayFrom(point: P, line: readonly P[]): number {
  let away = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    away = Math.min(away, dist(point, nearestOnSegment(point, line[i - 1], line[i])));
  }
  return away;
}

/** The line under `point`, within `within` of it: the outline, or a detail
 * by its index; the nearest when more than one. Null for none. */
export function lineAt(
  figure: FreehandFigure,
  point: BoardPoint,
  within: number = ERASE_SHARE,
): { kind: "outline" } | { kind: "detail"; index: number } | null {
  let best: { away: number; at: ReturnType<typeof lineAt> } = {
    away: within,
    at: null,
  };
  const consider = (line: readonly P[], at: NonNullable<ReturnType<typeof lineAt>>) => {
    const away = awayFrom(point, line);
    if (away <= best.away) {
      best = { away, at };
    }
  };
  consider(figure.outline, { kind: "outline" });
  figure.details.forEach((detail, index) =>
    consider(detail, { kind: "detail", index }),
  );
  return best.at;
}

/** The details hung on `detail`, or on one of those, and so on: they start
 * on it, and would float without it. */
function hungOn(details: readonly BoardPoint[][], index: number): Set<number> {
  const gone = new Set([index]);
  let more = true;
  while (more) {
    more = false;
    details.forEach((detail, i) => {
      if (gone.has(i)) {
        return;
      }
      for (const on of gone) {
        if (awayFrom(detail[0], details[on]) <= ON_LINE) {
          gone.add(i);
          more = true;
          break;
        }
      }
    });
  }
  return gone;
}

/**
 * «Erase»: the line under `point` taken away. The outline takes the whole
 * figure with it, and the next line drawn is the new outline; a detail
 * takes the details hung on it. Null when no line is under the finger.
 */
export function erased(
  figure: FreehandFigure,
  point: BoardPoint,
  within: number = ERASE_SHARE,
): { figure: FreehandFigure | null } | null {
  const at = lineAt(figure, point, within);
  if (at === null) {
    return null;
  }
  if (at.kind === "outline") {
    return { figure: null };
  }
  const gone = hungOn(figure.details, at.index);
  return {
    figure: { ...figure, details: figure.details.filter((_, i) => !gone.has(i)) },
  };
}

/** Whether `outline` is one the engine takes as it is: closed on its first
 * point, at most MAX_OUTLINE_POINTS corners, never crossing itself. */
function takenAsIs(outline: readonly BoardPoint[]): boolean {
  const [first, last] = [outline[0], outline[outline.length - 1]];
  return (
    outline.length >= 4 &&
    outline.length <= MAX_OUTLINE_POINTS + 1 &&
    first !== undefined &&
    first[0] === last[0] &&
    first[1] === last[1] &&
    isSimpleRing(outline)
  );
}

/**
 * The figure the board opens for `lines` (figureLines.ts): the outline as
 * it is when the engine would take it, else closed and straightened as a
 * line drawn (a shape of the catalogue with more corners than an outline
 * may have); the details as they are when they start on the figure, else
 * hung on it as a line drawn. Null when the outline encloses nothing, or
 * the details are more than a route runs.
 */
export function figureOf(lines: FreehandLines): FreehandFigure | null {
  let outline: BoardPoint[];
  if (takenAsIs(lines.outline)) {
    outline = lines.outline;
  } else {
    const closed = outlineOf(lines.outline);
    if (closed === null || "problem" in closed) {
      return null;
    }
    outline = closed;
  }
  const details: BoardPoint[][] = [];
  for (const detail of lines.details) {
    if (detail.length < 2) {
      continue;
    }
    const onFigure = [outline, ...details].some(
      (line) => awayFrom(detail[0], line) <= ON_LINE,
    );
    if (onFigure) {
      details.push(detail);
      continue;
    }
    const hung = detailOf(outline, details, detail);
    if (hung === null) {
      continue;
    }
    if ("problem" in hung) {
      return null;
    }
    details.push(hung);
  }
  if (travelledPoints(details) > MAX_DETAIL_POINTS) {
    return null;
  }
  return { outline, details };
}

/** The outlines the board sent: a route of one is a «Drawing», where a
 * photo's is an «Image». */
const DRAWN = new WeakSet<OutlinePoint[]>();

/** The request of each figure, made once: the same figure asks for the
 * same arrays, and the app knows a request by them (`sameRequest`). */
const REQUESTS = new WeakMap<
  FreehandFigure,
  { outline: OutlinePoint[]; strokes?: OutlinePoint[][] }
>();

/** A point of the board as the engine reads an outline: y up. The frame
 * centres and scales it (`framed`), as for a line drawn on the map. */
function up([x, y]: BoardPoint): OutlinePoint {
  return [x, -y];
}

/**
 * What «Draw route» sends for the figure, as «Draw on the map» sends a line
 * drawn with a finger (`canvasRequest`): the outline and the details
 * centred and scaled together into [-1, 1], the `outline` and `strokes` of
 * an ImageRouteRequest. Nothing new in the contract.
 */
export function freehandRequest(figure: FreehandFigure): {
  outline: OutlinePoint[];
  strokes?: OutlinePoint[][];
} {
  let made = REQUESTS.get(figure);
  if (made === undefined) {
    const { outline, strokes } = framed(
      figure.outline.map(up),
      figure.details.map((detail) => detail.map(up)),
    );
    made = strokes.length > 0 ? { outline, strokes } : { outline };
    DRAWN.add(outline);
    REQUESTS.set(figure, made);
  }
  return made;
}

/** Whether `outline` is one the board made: its route is a «Drawing». */
export function isDrawnOutline(outline: OutlinePoint[]): boolean {
  return DRAWN.has(outline);
}
