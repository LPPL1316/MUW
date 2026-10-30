import {
  type Activity,
  type Drawing,
  type LetterStyle,
  type Shape,
  SHAPES,
} from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { isOnWater } from "../swim/water";
import { APP_DISTANCE_LIMITS_KM } from "./distance";
import { checkWord, wordDistanceM } from "./wordInput";

/**
 * «Draw it near me» (TASK-313): the figure of a route of «Explore» or of a
 * drawing, to choose in «Draw» as it is, at the same distance. The start is
 * «Draw»'s, and «Draw route» asks for it there: the engine decides the
 * route in the new place, never the line of the old one.
 */
export type DrawAgain =
  | { kind: "shape"; shape: Shape; distance_m: number }
  | { kind: "word"; word: string; style: LetterStyle; distance_m: number };

/** What «Draw» reads of a drawing: what it drew, and how far it was run. */
export type DrawnFigure = Pick<Drawing, "shape" | "word" | "style" | "distance_m">;

/** The distance field takes tenths of a km: a run's 5243 m are 5.2 km. */
const STEP_M = 100;

function isShape(value: string | null | undefined): value is Shape {
  return (SHAPES as readonly string[]).includes(value ?? "");
}

/**
 * The figure of a route of «Explore» (its example, a recommended route, a
 * favorite, a drawing of «Feed» opened as one): a shape of the catalogue
 * or a word. Null for a picture or a photo, which «Draw» cannot choose
 * from a request.
 */
export function againOfRequest(request: AnyRouteRequest): DrawAgain | null {
  if (isImageRequest(request)) {
    return null;
  }
  const { distance_m } = request;
  if (request.word != null && request.word !== "") {
    return {
      kind: "word",
      word: request.word,
      style: request.style ?? "round",
      distance_m,
    };
  }
  return isShape(request.shape)
    ? { kind: "shape", shape: request.shape, distance_m }
    : null;
}

/**
 * The figure of a member's drawing: the shape or the word of its planned
 * route. Null for a run without one (a picture, a photo, a run without a
 * route): the drawing keeps only its title.
 */
export function againOfDrawing(drawing: DrawnFigure): DrawAgain | null {
  const { distance_m } = drawing;
  if (drawing.word !== null && drawing.word !== "") {
    return {
      kind: "word",
      word: drawing.word,
      style: drawing.style ?? "round",
      distance_m,
    };
  }
  return isShape(drawing.shape)
    ? { kind: "shape", shape: drawing.shape, distance_m }
    : null;
}

/**
 * Whether «Draw» of `activity` can draw it: on the water only a shape of
 * the catalogue (TASK-191), so a word there would wait for another sport;
 * elsewhere a word «Draw» takes as typed (one word, the letters A to Z,
 * no more letters than the sport allows), never one it would refuse.
 */
export function drawsAgain(
  again: DrawAgain | null,
  activity: Activity,
): again is DrawAgain {
  if (again === null) {
    return false;
  }
  if (again.kind === "shape") {
    return true;
  }
  // Without a distance, the distance is not checked: «Draw» chooses it.
  // No word on the water, paddled or swum (TASK-323).
  return !isOnWater(activity) && checkWord(again.word, null, activity).ok;
}

/**
 * The distance «Draw» chooses for it: to the tenth of a km, a word never
 * shorter than its letters need (a run cut a little short), within the
 * limits of the sport of «Draw» (a 5 km run is a 10 km bike route).
 */
export function againDistanceM(again: DrawAgain, activity: Activity): number {
  const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
  const least = again.kind === "word" ? wordDistanceM(again.word) : 0;
  const stepped = Math.max(Math.round(again.distance_m / STEP_M) * STEP_M, least);
  return Math.min(Math.max(stepped, lowest * 1000), highest * 1000);
}
