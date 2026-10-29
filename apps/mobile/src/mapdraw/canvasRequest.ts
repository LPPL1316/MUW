import type {
  Activity,
  ImageRouteRequest,
  OutlinePoint,
  RouteRequest,
} from "@shaperoute/shared-types";

import type { AnyRouteRequest } from "../api/routes";
import { shapeAsked } from "../route/penUpShapes";
import { nearestTenths, tenthsToM } from "../units/distanceInput";
import { appUnits, type Units } from "../units/units";
import { distanceOf, type Figure, type Placed, placedStart } from "./figure";
import { boxOf } from "./geometry";

/**
 * «Draw route» on the map (TASK-281, ADR-0245): the request for the figure
 * where it is and as big as it is, without a new field in the contract. The
 * engine starts from the figure's first point, sizes the route by the
 * figure's distance, and may move it to find the roads: the very place is
 * TASK-282.
 */

/** A ten-thousandth of the frame, as the engine's outlines are written. */
const DECIMALS = 4;

/** Whether `figure` is asked with the pen up, as «Draw» would ask it. */
export function figureApart(
  figure: Figure,
  penUp: boolean,
  activity: Activity,
): boolean {
  return (
    figure.kind === "shape" && "pen_up" in shapeAsked(figure.shape, penUp, activity)
  );
}

function rounded(value: number): number {
  const kept = Math.round(value * 10 ** DECIMALS) / 10 ** DECIMALS;
  // −0 reads as 0 in JSON anyway; kept within the frame the API checks.
  return Math.min(1, Math.max(-1, kept)) || 0;
}

/**
 * The outline and the details of a drawing or a picture as an
 * `ImageOutline.points` and its `strokes`: centred and scaled together into
 * [-1, 1], y up. Scaling leaves the shape and its proportions as they are:
 * the size goes with `distance_m`.
 */
export function framed(
  outline: readonly OutlinePoint[],
  strokes: readonly (readonly OutlinePoint[])[],
): { outline: OutlinePoint[]; strokes: OutlinePoint[][] } {
  const { size, middle } = boxOf([outline, ...strokes]);
  const half = size / 2;
  const to = ([x, y]: OutlinePoint): OutlinePoint => [
    rounded((x - middle[0]) / half),
    rounded((y - middle[1]) / half),
  ];
  return { outline: outline.map(to), strokes: strokes.map((stroke) => stroke.map(to)) };
}

/** The framed outline of each figure, made once: the requests for the same
 * figure, moved or sized, share its arrays, and the app knows a request by
 * them (`sameRequest`). */
const FRAMED = new WeakMap<Figure, ReturnType<typeof framed>>();

/** The outlines of drawings asked for: a route of one is a «Drawing»,
 * where a photo's is an «Image» (TASK-320, TASK-331). */
const DRAWN = new WeakSet<OutlinePoint[]>();

function framedOf(figure: Extract<Figure, { outline: unknown }>) {
  let made = FRAMED.get(figure);
  if (made === undefined) {
    const details = figure.kind === "drawing" ? figure.details : figure.strokes;
    made = framed(figure.outline, details);
    if (figure.kind === "drawing") {
      DRAWN.add(made.outline);
    }
    FRAMED.set(figure, made);
  }
  return made;
}

/** Whether `outline` is one of a drawing on the map: its route is a
 * «Drawing». */
export function isDrawnOutline(outline: OutlinePoint[]): boolean {
  return DRAWN.has(outline);
}

/**
 * The request for `placed`: a shape of the catalogue by its name
 * (`POST /route-jobs`), a drawing or a picture by its outline
 * (`POST /image-route-jobs`). `start` is where the figure starts on the map,
 * `distance_m` its distance in whole metres, to the tenth of a km or of a
 * mile as a distance typed in «Draw»: the route says «target 5.7 km».
 */
export function canvasRequest(
  placed: Placed,
  penUp: boolean,
  activity: Activity,
  units: Units = appUnits(),
): AnyRouteRequest {
  const figure = placed.figure;
  const apart = figureApart(figure, penUp, activity);
  const common = {
    start: placedStart(placed, apart),
    distance_m: tenthsToM(nearestTenths(distanceOf(placed, apart), units), units),
    activity,
  };
  if (figure.kind === "shape") {
    const request: RouteRequest = {
      ...common,
      ...shapeAsked(figure.shape, penUp, activity),
    };
    return request;
  }
  const { outline, strokes } = framedOf(figure);
  const request: ImageRouteRequest = {
    ...common,
    outline,
    ...(strokes.length > 0 ? { strokes } : {}),
  };
  return request;
}
