import {
  type DrawingDetail,
  type LatLon,
  MAX_OUTLINE_POINTS,
} from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { CLOSED_SHARE, firstLineOf } from "../mapdraw/drawing";
import type { FigureLines } from "../mapdraw/edit";
import { boxOf, dist } from "../mapdraw/geometry";
import { fromPlane, toPlane } from "../mapdraw/plane";

/**
 * The lines of a figure the app proposes, as «Edit the drawing» puts them
 * on the map of «Draw on the map» (TASK-320, TASK-331): a route asked for,
 * the points of a route run. In the engine's frame, [-1, 1] with y up;
 * `drawingOf` (mapdraw/edit.ts) makes the drawing of them. A shape of the
 * catalogue — an emoji — is not changed, so it has none (ADR-0288). The
 * track of a member's drawing goes on the map where it was run and as big
 * (TASK-346, ADR-0299): with its lines, its middle and its size. Since
 * TASK-369 (ADR-0313) so does the line of every route and drawing, an emoji
 * and a word too: the track, not the figure asked for.
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

/** The lines of a route run where it was run (TASK-346): in the frame of
 * the figure, with the point of the map at its middle and the metres of
 * one unit, so `figure.onMap` gives back the points of the track. */
export type TrackInPlace = { lines: FigureLines; centre: LatLon; unitM: number };

/** At most `size` points of the line, evenly spread, first and last kept. */
function spread<T>(points: readonly T[], size: number): T[] {
  if (points.length <= size) {
    return [...points];
  }
  const step = (points.length - 1) / (size - 1);
  return Array.from({ length: size }, (_, i) => points[Math.round(i * step)]);
}

/**
 * The line of a route run where it was run and as big: centred on the
 * middle of its box and scaled into [-1, 1], y up, in metres on the plane
 * (never in degrees), so it is put back on the map just where it was. A
 * line that ends near its start (CLOSED_SHARE) is one closed outline of at
 * most MAX_OUTLINE_POINTS corners, as a favorite keeps the outline of an
 * image (`favoriteRoute.outlineOf`); one that ends away from it stays open,
 * as a first line drawn on the map does (`firstLineOf`, TASK-331): a ring
 * at its start and the line hung on it (TASK-369).
 */
export function trackInPlace(points: readonly LatLon[]): TrackInPlace {
  const origin = points[0];
  const xys = points.map((point) => toPlane(origin, point));
  const xs = xys.map(([x]) => x);
  const ys = xys.map(([, y]) => y);
  const middle: [number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  const centre = fromPlane(origin, middle);
  const atCentre = points.map((point) => toPlane(centre, point));
  const unitM = Math.max(
    (Math.max(...xs) - Math.min(...xs)) / 2,
    (Math.max(...ys) - Math.min(...ys)) / 2,
    1e-6,
  );
  const units = atCentre.map(([x, y]): [number, number] => [x / unitM, y / unitM]);
  const open = openLines(units);
  if (open !== null) {
    return { lines: open, centre, unitM };
  }
  const outline = spread(units, MAX_OUTLINE_POINTS);
  const [first, last] = [outline[0], outline[outline.length - 1]];
  const closed =
    first[0] === last[0] && first[1] === last[1] ? outline : [...outline, first];
  return { lines: { outline: closed, details: [] }, centre, unitM };
}

/** The lines of a track that ends away from its start, as a first line
 * drawn on the map that stays open; null for one that ends near it, and for
 * one with more points than a route runs (it is then closed, as before). */
function openLines(units: readonly [number, number][]): FigureLines | null {
  const { size } = boxOf([units]);
  if (dist(units[0], units[units.length - 1]) <= CLOSED_SHARE * size) {
    return null;
  }
  const lines = firstLineOf(units);
  return lines === null || "problem" in lines ? null : lines;
}

/** What a member's drawing says of its figure (GET /drawings/{id}). */
type DrawnRun = Pick<DrawingDetail, "track">;

/**
 * The track of a member's drawing (TASK-320 part B), where it was run
 * (TASK-346): the one line the API gives of it, whatever it draws — a
 * picture, a figure drawn by hand, an emoji, a word, a free run, one
 * imported from another app, a drawing paddled (TASK-369, ADR-0313). Null
 * for a post of photos alone and a track too short to follow.
 */
export function drawingTrack(drawing: DrawnRun): TrackInPlace | null {
  return drawing.track.length >= 2 ? trackInPlace(drawing.track) : null;
}

/**
 * The line of a route of «Explore» where it is (TASK-369, ADR-0313): an
 * example, a search, a favorite, a drawing of a message, an example of the
 * Feed, a shape «NEAR YOU», a themed route, by the points of its result.
 * Null for a route too short to follow.
 */
export function routeTrack(points: readonly LatLon[]): TrackInPlace | null {
  return points.length >= 2 ? trackInPlace(points) : null;
}
