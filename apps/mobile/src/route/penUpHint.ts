import type { RouteResult } from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import type { RouteState } from "./useRouteRequest";

/**
 * A route the engine calls good (route_engine/optimizer.py,
 * SIMILARITY_THRESHOLD and DISTANCE_TOLERANCE), as TASK-311 A judged the
 * words it measured: below the one, or beyond the other, the word did not
 * come out.
 */
export const GOOD_SIMILARITY = 0.9;
export const DISTANCE_TOLERANCE = 0.1;

/** A word of two letters or more on the roads, asked in one line: the pen
 * could go up between its letters. */
function oneLineWord(request: AnyRouteRequest): boolean {
  return (
    !isImageRequest(request) &&
    typeof request.word === "string" &&
    Array.from(request.word).length >= 2 &&
    request.pen_up !== true &&
    request.activity !== "paddling"
  );
}

/**
 * Whether to offer the pen up under a word drawn in one line (TASK-311 B,
 * ADR-0271): with the pen up, words of five letters or more came out good
 * 40 times in 100 instead of 11. Offered when the engine's choice did not
 * come out (`choice`: the request's, not an alternative's; the route on
 * screen without one) or when the word does not fit the roads at all;
 * never for a word already asked with the pen up, a single letter, a
 * shape or a picture.
 */
export function penUpHint(
  view: RouteState,
  choice: RouteResult | null = null,
): boolean {
  if (view.status === "failed") {
    return (
      oneLineWord(view.request) &&
      view.problem.kind === "api_error" &&
      view.problem.code === "shape_not_drawable"
    );
  }
  if (view.status !== "done" || !oneLineWord(view.request)) {
    return false;
  }
  const judged = choice ?? view.result;
  const off = Math.abs(judged.distance_m / view.request.distance_m - 1);
  return judged.similarity < GOOD_SIMILARITY || off > DISTANCE_TOLERANCE;
}

/** The same request with the pen up between the letters: what «Lift the
 * pen» draws. Anything but a word stays as it is. */
export function withPenUp(request: AnyRouteRequest): AnyRouteRequest {
  if (isImageRequest(request) || typeof request.word !== "string") {
    return request;
  }
  return { ...request, word: request.word, pen_up: true };
}
