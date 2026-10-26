import type { UserPhoto, UserPhotosPage } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isDrawingPhoto } from "./drawings";

/**
 * The photos of a profile (TASK-305, docs/API.md, «Profile»): GET
 * /users/{public_id}/photos with the session token, a page at a time, the
 * latest run first. Each is read as the photo of its drawing
 * (drawingPhotoSource) and opens it. An API older than TASK-305 has no such
 * endpoint: 404, `http_error`.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** GET /users/{public_id}/photos: a page, the first without a `cursor`. */
export function fetchUserPhotos(
  baseUrl: string,
  token: string,
  publicId: string,
  cursor: string | null = null,
  options: Options = {},
): Promise<AccountOutcome<UserPhotosPage>> {
  const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/users/${encodeURIComponent(publicId)}/photos${query}`,
    { method: "GET", token },
    isUserPhotosPage,
    options,
  );
}

export function isUserPhoto(value: unknown): value is UserPhoto {
  if (!isDrawingPhoto(value)) {
    return false;
  }
  const photo = value as unknown as Record<string, unknown>;
  return (
    typeof photo.drawing_id === "string" &&
    (photo.title === null || typeof photo.title === "string") &&
    typeof photo.started_at === "string"
  );
}

export function isUserPhotosPage(body: unknown): body is UserPhotosPage {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const page = body as Record<string, unknown>;
  return (
    Array.isArray(page.photos) &&
    page.photos.every(isUserPhoto) &&
    (page.next === null || typeof page.next === "string")
  );
}
