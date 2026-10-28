import type { ImageOutline } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "./apiUrl";
import { isApiError, type RouteOutcome } from "./routes";

/** Every way asking for the outline of an image can end. */
export type ImageOutcome =
  | { kind: "outline"; outline: ImageOutline }
  | Extract<RouteOutcome, { kind: "api_error" | "bad_answer" | "unreachable" }>
  | { kind: "cancelled" };

/**
 * Asks the API for the outline the engine traces from an image (TASK-073,
 * ADR-0069): the image goes once, in base64. The app shows the outline
 * before the route is asked for. Never throws.
 */
export async function requestImageOutline(
  baseUrl: string,
  base64: string,
  {
    signal,
    fetchFn = fetch,
    key = apiKey(),
  }: { signal?: AbortSignal; fetchFn?: typeof fetch; key?: string | null } = {},
): Promise<ImageOutcome> {
  let response: Response;
  try {
    response = await fetchFn(`${baseUrl}/image-outlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...keyHeaders(key) },
      body: JSON.stringify({ image: base64 }),
      signal,
    });
  } catch {
    return signal?.aborted
      ? { kind: "cancelled" }
      : { kind: "unreachable", url: baseUrl };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok && isImageOutline(body)) {
    return { kind: "outline", outline: withUsablePieces(body) };
  }
  return !response.ok && isApiError(body)
    ? { kind: "api_error", ...body.error }
    : { kind: "bad_answer", status: response.status };
}

function isPoints(value: unknown, min: number, max: number, least = 4): boolean {
  return (
    Array.isArray(value) &&
    value.length >= least &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(
          (part) =>
            typeof part === "number" &&
            Number.isFinite(part) &&
            part >= min &&
            part <= max,
        ),
    )
  );
}

/** Details in both frames, one for one; missing from an API older than
 * TASK-079, which is none. */
function isStrokes(strokes: unknown, imageStrokes: unknown): boolean {
  if (strokes === undefined && imageStrokes === undefined) {
    return true;
  }
  return (
    Array.isArray(strokes) &&
    Array.isArray(imageStrokes) &&
    strokes.length === imageStrokes.length &&
    strokes.every((stroke) => isPoints(stroke, -1, 1, 2)) &&
    imageStrokes.every(
      (stroke, i) =>
        isPoints(stroke, 0, 1, 2) &&
        (stroke as unknown[]).length === (strokes[i] as unknown[]).length,
    )
  );
}

/** The outline with its pieces for the pen up (TASK-297) when they can be
 * drawn and sent back, in both frames one for one, as the strokes;
 * without them otherwise, as an API older than TASK-297 answers: the
 * picture is drawn with the pen down, never refused for its pieces. */
export function withUsablePieces(outline: ImageOutline): ImageOutline {
  const { pieces, image_pieces, ...rest } = outline;
  return pieces !== undefined && pieces.length > 0 && isStrokes(pieces, image_pieces)
    ? outline
    : rest;
}

/** Enough checks to draw it and send it back safely. */
export function isImageOutline(body: unknown): body is ImageOutline {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { points, image_points, aspect, strokes, image_strokes } = body as Record<
    string,
    unknown
  >;
  return (
    isPoints(points, -1, 1) &&
    isPoints(image_points, 0, 1) &&
    (image_points as unknown[]).length === (points as unknown[]).length &&
    typeof aspect === "number" &&
    Number.isFinite(aspect) &&
    aspect > 0 &&
    isStrokes(strokes, image_strokes)
  );
}
