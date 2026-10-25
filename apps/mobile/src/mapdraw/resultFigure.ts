import type { Shape } from "@shaperoute/shared-types";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { shapeAsked } from "../route/penUpShapes";
import {
  SAMPLE_PICTURES,
  type SamplePicture,
  type SamplePictureId,
} from "../route/samplePictures";
import type { Figure, Placed } from "./figure";

/**
 * Another figure from the map of the result (TASK-286, an addition to
 * ADR-0245): a tile of the row under the route, and the route of it from
 * the same start and as long, at once.
 */

/** A tile of the row: a shape of the catalogue or a ready-made picture. */
export type FigureChoice =
  { kind: "shape"; shape: Shape } | { kind: "picture"; sample: SamplePicture };

/** The tile marked as the figure of the route on screen; none for a word,
 * a drawing or a photo. */
export type ChosenTile = { shape: Shape | null; sample: SamplePictureId | null };

export const NO_TILE: ChosenTile = { shape: null, sample: null };

/** The figure of «Draw on the map» a tile puts on it. */
export function figureOf(choice: FigureChoice): Figure {
  if (choice.kind === "shape") {
    return { kind: "shape", shape: choice.shape };
  }
  const { outline, id } = choice.sample;
  return {
    kind: "picture",
    outline: outline.points,
    strokes: outline.strokes ?? [],
    sample: id,
  };
}

/**
 * The request of «Draw» for `choice` in place of the figure of `request`:
 * the same start, distance and sport; a shape with the pen up as «Draw»
 * asks it (`shapeAsked`), a picture with the outline «Draw» sends for it,
 * the very arrays. On the water a shape moved by the user stays where it
 * was left (`near`, ADR-0202).
 */
export function changedRequest(
  request: AnyRouteRequest,
  choice: FigureChoice,
  penUp: boolean,
): AnyRouteRequest {
  const { start, distance_m, activity } = request;
  if (choice.kind === "picture") {
    const { outline } = choice.sample;
    return {
      start,
      distance_m,
      activity,
      outline: outline.points,
      strokes: outline.strokes,
    };
  }
  const near = isImageRequest(request) ? null : (request.near ?? null);
  return {
    start,
    distance_m,
    activity,
    ...shapeAsked(choice.shape, penUp, activity),
    ...(near !== null ? { near } : {}),
  };
}

/** The tile of the route of «Draw» on screen: its shape, or the ready-made
 * picture whose outline it sends unchanged. */
export function drawnTile(request: AnyRouteRequest): ChosenTile {
  if (!isImageRequest(request)) {
    return { shape: request.shape ?? null, sample: null };
  }
  const sample = SAMPLE_PICTURES.find(
    (picture) => picture.outline.points === request.outline,
  );
  return { shape: null, sample: sample?.id ?? null };
}

/** The tile of the figure of «Draw on the map». */
export function placedTile(placed: Placed | null): ChosenTile {
  const figure = placed?.figure;
  if (figure?.kind === "shape") {
    return { shape: figure.shape, sample: null };
  }
  if (figure?.kind === "picture" && figure.sample !== undefined) {
    return { shape: null, sample: figure.sample as SamplePictureId };
  }
  return NO_TILE;
}

/** Whether `choice` is the tile already marked: it asks for nothing. */
export function isChosen(choice: FigureChoice, chosen: ChosenTile): boolean {
  return choice.kind === "shape"
    ? choice.shape === chosen.shape
    : choice.sample.id === chosen.sample;
}
