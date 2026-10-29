import { MAX_DETAIL_POINTS, MAX_OUTLINE_POINTS } from "@shaperoute/shared-types";

import { detailOf, outlineOf, travelledPoints } from "./drawing";
import type { Figure, Unit } from "./figure";
import { dist, isSimpleRing, nearestOnSegment, type P } from "./geometry";

/**
 * Changing the figure on the map of «Draw on the map» (TASK-331, ADR-0288):
 * a drawing, a photo's outline, a route asked for or a member's drawing is
 * a drawing to add lines to and to change with the tools (`tools.ts`). A
 * shape of the catalogue — an emoji — is not changed: the user's «it is no
 * use». Moved here from the board of «Draw» (TASK-320, ADR-0280), which
 * drawing on the map replaces.
 */

export type Drawing = Extract<Figure, { kind: "drawing" }>;

/** The lines of a figure the app proposes (figureLines.ts), in the
 * engine's frame, y up: not yet checked. */
export type FigureLines = { outline: Unit[]; details: Unit[][] };

/** A point lying on a line, as near as the arithmetic puts it. */
export const ON_LINE = 1e-6;

/** How far `point` is from the nearest side of `line`; from the point
 * itself, for a line of one point. */
export function awayFrom(point: P, line: readonly P[]): number {
  if (line.length === 1) {
    return dist(point, line[0]);
  }
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
  const linked: boolean[] = [];
  for (const detail of lines.details) {
    if (detail.length < 2) {
      continue;
    }
    const onFigure = [outline, ...details].some(
      (line) => awayFrom(detail[0], line) <= ON_LINE,
    );
    if (onFigure) {
      details.push(detail);
      linked.push(false);
      continue;
    }
    const hung = detailOf(outline, details, detail);
    if (hung === null) {
      continue;
    }
    if ("problem" in hung) {
      return null;
    }
    details.push(hung.detail);
    linked.push(hung.linked);
  }
  if (travelledPoints(details) > MAX_DETAIL_POINTS) {
    return null;
  }
  return { kind: "drawing", outline, details, linked };
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

/** Whether the points a finger rubbed come within `radius` of one of
 * `lines`: the eraser on a shape of the catalogue takes it whole. */
export function touchesLines(
  lines: readonly Unit[][],
  rubbed: readonly Unit[],
  radius: number,
): boolean {
  return rubbed.some((point) => lines.some((line) => awayFrom(point, line) <= radius));
}
