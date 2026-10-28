import {
  type DrawingDetail,
  type LatLon,
  type OutlinePoint,
  type Shape,
  SHAPES,
} from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { outlineOf } from "../favorites/favoriteRoute";
import { lookOf } from "../mapdraw/figure";
import type { BoardPoint, FreehandLines } from "./freehand";

/**
 * The lines of a figure the app proposes, as the board of «Draw» opens them
 * (TASK-320, ADR-0280): a shape of the catalogue as the engine draws it, a
 * route asked for, the points of a route run. In the board's square, from
 * the top left, y down; `figureOf` (freehand.ts) makes the figure of them.
 */

/** A point of the engine's frame, [-1, 1] with y up, on the board. */
function onBoard([x, y]: OutlinePoint): BoardPoint {
  return [(x + 1) / 2, (1 - y) / 2];
}

function isShape(value: string | null | undefined): value is Shape {
  return (SHAPES as readonly string[]).includes(value ?? "");
}

function same(a: OutlinePoint, b: OutlinePoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * The line of a shape with the pen down, as the engine runs it, taken
 * apart: the engine draws an eye, a ray or the snail's shell as an
 * excursion inside the one line, out from a point of the outline and back
 * to it (`travelled_points`), so the line comes back to that very point.
 * Each excursion becomes a detail hung there: the way out alone when the
 * way back retraces it (a ray, the shell); out and around when it loops
 * (an eye), the detail ending on its own point, as the engine reads a loop.
 * What is left is the outline.
 */
export function splitExcursions(line: readonly OutlinePoint[]): FreehandLines {
  const outline: OutlinePoint[] = [];
  const details: OutlinePoint[][] = [];
  let i = 0;
  while (i < line.length) {
    // The last return to this point, so an eye's own loop stays inside.
    let back = -1;
    for (let j = line.length - 1; j > i; j -= 1) {
      // The line's own closing on its first point is no excursion.
      if (same(line[j], line[i]) && !(i === 0 && j === line.length - 1)) {
        back = j;
        break;
      }
    }
    outline.push(line[i]);
    if (back === -1) {
      i += 1;
      continue;
    }
    // How far the way back retraces the way out.
    let retraced = 0;
    while (
      i + retraced < back - retraced &&
      same(line[i + retraced], line[back - retraced])
    ) {
      retraced += 1;
    }
    const detail =
      back - i === 2 * retraced
        ? // There and back along the same points: the way out, to the tip.
          line.slice(i, i + retraced + 1)
        : // Out, around, and back: closed on the point the loop left from.
          line.slice(i, back - retraced + 2);
    if (detail.length >= 2) {
      details.push(detail);
    }
    i = back + 1;
  }
  return { outline, details };
}

/** The lines of a shape of the catalogue, with the pen down
 * (`catalogueShapes.json`): its one line taken apart into the outline and
 * the details the engine runs inside it; any line after it a detail. */
export function shapeLines(shape: Shape): FreehandLines {
  const [first, ...more] = lookOf({ kind: "shape", shape }).lines;
  const { outline, details } = splitExcursions(first);
  return {
    outline: outline.map(onBoard),
    details: [...details, ...more].map((detail) => detail.map(onBoard)),
  };
}

/**
 * The lines of the figure a route was asked for: a shape of the catalogue
 * by its lines, a picture or a drawing by the outline and the details it
 * sent. Null for a word (letters with the pen up are not a closed figure),
 * and for a shape the app does not know.
 */
export function requestLines(request: AnyRouteRequest): FreehandLines | null {
  if (isImageRequest(request)) {
    return {
      outline: request.outline.map(onBoard),
      details: (request.strokes ?? []).map((stroke) => stroke.map(onBoard)),
    };
  }
  if (request.word != null && request.word !== "") {
    return null;
  }
  return isShape(request.shape) ? shapeLines(request.shape) : null;
}

/** The line of a route run, straightened and closed as a favorite keeps the
 * outline of an image (`favoriteRoute.outlineOf`): what a drawing without
 * a shape opens in the board. */
export function trackLines(points: LatLon[]): FreehandLines {
  return { outline: outlineOf(points).map(onBoard), details: [] };
}

/** What a member's drawing says of its figure (GET /drawings/{id}). */
type DrawnRun = Pick<
  DrawingDetail,
  "shape" | "word" | "route_title" | "source" | "track"
>;

/**
 * The lines of a member's drawing (TASK-320 part B): a shape of the
 * catalogue by its lines; a picture, a photo or a figure drawn by hand —
 * a planned route that says only its title — by the track run, the one
 * line the API gives of it. Null for a word, a shape the app does not
 * know, a run without a planned route (a free run, one imported from
 * another app, a post of photos alone) and a track too short to follow.
 */
export function drawingLines(drawing: DrawnRun): FreehandLines | null {
  if (drawing.word !== null && drawing.word !== "") {
    return null;
  }
  if (drawing.shape !== null) {
    return isShape(drawing.shape) ? shapeLines(drawing.shape) : null;
  }
  const planned = drawing.route_title !== null && drawing.source !== "file";
  return planned && drawing.track.length >= 2 ? trackLines(drawing.track) : null;
}
