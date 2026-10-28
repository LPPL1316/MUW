import type {
  ImageOutline,
  ImagePenUpRouteRequest,
  ImageRouteRequest,
  OutlinePoint,
} from "@shaperoute/shared-types";

/** What a picture adds to its route request (ADR-0069): the outline the
 * user has seen, with its strokes, or with its pieces and the pen up. */
export type ImageAsked =
  | Pick<ImageRouteRequest, "outline" | "strokes">
  | Pick<ImagePenUpRouteRequest, "outline" | "pieces" | "pen_up">;

/**
 * The pieces of an outline, to draw with the pen up (TASK-297 part C2,
 * ADR-0258): the other subjects and the holes of the picture, each on its
 * own. None from an API older than TASK-297, nor after an edit (TASK-079):
 * then the picture is drawn as before, with the pen down.
 */
export function piecesOf(outline: ImageOutline): OutlinePoint[][] {
  return outline.pieces ?? [];
}

/** Whether the picture is drawn in pieces: the pen up, and pieces to lift
 * it between. The switch «Lift the pen between parts» shows only with
 * pieces. */
export function drawnApart(outline: ImageOutline, penUp: boolean): boolean {
  return penUp && piecesOf(outline).length > 0;
}

/** The request of a picture: its outline and the strokes that hang its
 * other subjects on it; drawn apart, its outline and its pieces instead,
 * which are the same subjects without the stems, and the holes. */
export function imageAsked(outline: ImageOutline, penUp: boolean): ImageAsked {
  return drawnApart(outline, penUp)
    ? { outline: outline.points, pieces: piecesOf(outline), pen_up: true }
    : { outline: outline.points, strokes: outline.strokes };
}

/** The lines over the picture besides the outline: its pieces when drawn
 * apart, its strokes otherwise. */
export function linesOver(
  outline: ImageOutline,
  penUp: boolean,
): OutlinePoint[][] | undefined {
  return drawnApart(outline, penUp) ? outline.image_pieces : outline.image_strokes;
}
