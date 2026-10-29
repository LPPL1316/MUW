import type { DrawingDetail, LatLon } from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { outlineOf } from "../favorites/favoriteRoute";
import type { FigureLines } from "../mapdraw/edit";

/**
 * The lines of a figure the app proposes, as «Edit the drawing» puts them
 * on the map of «Draw on the map» (TASK-320, TASK-331): a route asked for,
 * the points of a route run. In the engine's frame, [-1, 1] with y up;
 * `drawingOf` (mapdraw/edit.ts) makes the drawing of them. A shape of the
 * catalogue — an emoji — is not changed, so it has none (ADR-0288).
 */

/**
 * The lines of the figure a route was asked for: a picture or a drawing by
 * the outline and the details it sent. Null for a shape of the catalogue
 * and for a word (letters with the pen up are not a closed figure).
 */
export function requestLines(request: AnyRouteRequest): FigureLines | null {
  return isImageRequest(request)
    ? { outline: request.outline, details: request.strokes ?? [] }
    : null;
}

/** The line of a route run, straightened and closed as a favorite keeps the
 * outline of an image (`favoriteRoute.outlineOf`): what a drawing without
 * a shape puts on the map. */
export function trackLines(points: LatLon[]): FigureLines {
  return { outline: outlineOf(points), details: [] };
}

/** What a member's drawing says of its figure (GET /drawings/{id}). */
type DrawnRun = Pick<
  DrawingDetail,
  "shape" | "word" | "route_title" | "source" | "track"
>;

/**
 * The lines of a member's drawing (TASK-320 part B): a picture, a photo or
 * a figure drawn by hand — a planned route that says only its title — by
 * the track run, the one line the API gives of it. Null for a shape of the
 * catalogue, a word, a run without a planned route (a free run, one
 * imported from another app, a post of photos alone) and a track too short
 * to follow.
 */
export function drawingLines(drawing: DrawnRun): FigureLines | null {
  if ((drawing.word !== null && drawing.word !== "") || drawing.shape !== null) {
    return null;
  }
  const planned = drawing.route_title !== null && drawing.source !== "file";
  return planned && drawing.track.length >= 2 ? trackLines(drawing.track) : null;
}
