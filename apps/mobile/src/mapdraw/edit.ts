import { MAX_DETAIL_POINTS, MAX_OUTLINE_POINTS } from "@shaperoute/shared-types";

import { detailOf, isOpenLine, outlineOf, travelledPoints } from "./drawing";
import type { Figure, Unit } from "./figure";
import { boxOf, dist, isSimpleRing, nearestOnSegment, type P } from "./geometry";

/**
 * Changing the figure on the map of «Draw on the map» (TASK-331, ADR-0288):
 * a drawing, a photo's outline, a route asked for or a member's drawing is
 * a drawing to add lines to, and «Erase» takes a line of it away. A shape
 * of the catalogue — an emoji — is not changed: the user's «it is no use».
 * Moved here from the board of «Draw» (TASK-320, ADR-0280), which drawing
 * on the map replaces.
 */

export type Drawing = Extract<Figure, { kind: "drawing" }>;

/** The lines of a figure the app proposes (figureLines.ts), in the
 * engine's frame, y up: not yet checked. */
export type FigureLines = { outline: Unit[]; details: Unit[][] };

/** How near a tap must come to a line to erase it, as a share of the
 * figure's size: a finger's width, about, with the figure filling the map. */
export const ERASE_SHARE = 0.05;

/** A point lying on a line, as near as the arithmetic puts it. */
const ON_LINE = 1e-6;

/** How far `point` is from the nearest side of `line`. */
function awayFrom(point: P, line: readonly P[]): number {
  let away = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    away = Math.min(away, dist(point, nearestOnSegment(point, line[i - 1], line[i])));
  }
  return away;
}

/** Whether `outline` is one the engine takes as it is: closed on its first
 * point, at most MAX_OUTLINE_POINTS corners, never crossing itself. */
function takenAsIs(outline: readonly Unit[]): boolean {
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
 * The drawing of `lines`: the outline as it is when the engine would take
 * it, else closed and straightened as a line drawn (a shape of the
 * catalogue with more corners than an outline may have); the details as
 * they are when they start on the figure, else hung on it as a line drawn.
 * Null when the outline encloses nothing, or the details are more than a
 * route runs.
 */
export function drawingOf(lines: FigureLines): Drawing | null {
  let outline: Unit[];
  if (takenAsIs(lines.outline)) {
    outline = lines.outline;
  } else {
    const closed = outlineOf(lines.outline);
    if (closed === null || "problem" in closed) {
      return null;
    }
    outline = closed;
  }
  const details: Unit[][] = [];
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
  return { kind: "drawing", outline, details };
}

/**
 * `figure` as a drawing in the same frame, so it stays where it is and as
 * big: a photo's outline with its strokes. Null for a shape of the
 * catalogue, which is not changed, and when it makes none (`drawingOf`).
 */
export function asDrawing(figure: Figure): Drawing | null {
  if (figure.kind === "drawing") {
    return figure;
  }
  if (figure.kind === "picture") {
    return drawingOf({ outline: figure.outline, details: figure.strokes });
  }
  return null;
}

/** Whether the points a finger touched come within ERASE_SHARE of one of
 * `lines`: «Erase» on a shape of the catalogue takes it whole. */
export function touchesLines(
  lines: readonly Unit[][],
  touched: readonly Unit[],
): boolean {
  const within = ERASE_SHARE * boxOf(lines).size;
  return touched.some((point) => lines.some((line) => awayFrom(point, line) <= within));
}

/** The line under `point`, within `within` of it: the outline, or a detail
 * by its index; the nearest when more than one. Null for none. The ring of
 * an open line is no line to erase: nothing of it shows. */
export function lineAt(
  drawing: Drawing,
  point: Unit,
  within: number,
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
  if (!isOpenLine(drawing.outline, drawing.details)) {
    consider(drawing.outline, { kind: "outline" });
  }
  drawing.details.forEach((detail, index) =>
    consider(detail, { kind: "detail", index }),
  );
  return best.at;
}

/** The details hung on `detail`, or on one of those, and so on: they start
 * on it, and would float without it. */
function hungOn(details: readonly Unit[][], index: number): Set<number> {
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
 * «Erase»: the line nearest to the points of `touched` taken away, within
 * ERASE_SHARE of the drawing's size. The outline takes the whole drawing
 * with it (`{ drawing: null }`); a detail takes the details hung on it, and
 * an open line without the line drawn is nothing either. Null when no line
 * is under the finger.
 */
export function erasedAt(
  drawing: Drawing,
  touched: readonly Unit[],
): { drawing: Drawing | null } | null {
  const within = ERASE_SHARE * boxOf([drawing.outline, ...drawing.details]).size;
  let at: ReturnType<typeof lineAt> = null;
  for (const point of touched) {
    at = lineAt(drawing, point, within);
    if (at !== null) {
      break;
    }
  }
  if (at === null) {
    return null;
  }
  if (at.kind === "outline") {
    return { drawing: null };
  }
  const gone = hungOn(drawing.details, at.index);
  const details = drawing.details.filter((_, i) => !gone.has(i));
  if (
    isOpenLine(drawing.outline, drawing.details) &&
    !isOpenLine(drawing.outline, details)
  ) {
    return { drawing: null };
  }
  return { drawing: { ...drawing, details } };
}
