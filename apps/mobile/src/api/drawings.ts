import type {
  Activity,
  Drawing,
  DrawingDetail,
  DrawingPhoto,
  DrawingPhotoRequest,
  DrawingRequest,
  DrawingsPage,
  DrawingTag,
  LatLon,
  MyDrawing,
  Visibility,
} from "@shaperoute/shared-types";
import { ACTIVITIES, VISIBILITIES } from "@shaperoute/shared-types";

import { accountProblem, SESSION_ENDED } from "../account/messages";
import { t } from "../i18n";
import { type AccountOutcome, ask, authHeaders } from "./accounts";
import { apiKey, keyHeaders } from "./apiUrl";

/**
 * Drawings (TASK-117, ADR-0159; TASK-208, ADR-0170): the calls of
 * docs/API.md, «Drawings», all with the session token. A saved run of «My
 * activities» gets a title, a description, the people tagged, what it was
 * and who can see it; seen by others, it is in their profile, cut by the
 * API: never its first and last 200 m, never the planned route. The bodies
 * are packages/shared-types/fixtures/*drawing*.json.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * What the owner chooses for a run (TASK-208): a title (null: none), a
 * description (null: none), what it was, who is tagged, and who can see
 * it. The choice is whole: sending it again changes nothing.
 */
export type DrawingChoice = {
  title: string | null;
  description: string | null;
  activity: Activity;
  /** The members tagged, in order; their names are what the form shows. */
  tags: DrawingTag[];
  visibility: Visibility;
};

/** Nothing chosen yet: no title, a run, nobody tagged, only the owner. */
export const NOT_CHOSEN: DrawingChoice = {
  title: null,
  description: null,
  activity: "running",
  tags: [],
  visibility: "only_me",
};

/** The title as the API keeps it: without the spaces around; "" is none. */
export function titleOf(text: string): string | null {
  const title = text.trim();
  return title === "" ? null : title;
}

/** The description as the API keeps it: lines and all, "" is none. */
export function descriptionOf(text: string): string | null {
  const description = text.trim();
  return description === "" ? null : description;
}

/** Other members see the drawing: everyone, or those who follow. */
export function isSeen(visibility: Visibility): boolean {
  return visibility !== "only_me";
}

/**
 * Something was chosen for the run, worth a drawing on the API: the
 * drawing of a run with nothing chosen is not sent (ADR-0159). A run that
 * was not a run (a ride, a paddle) counts: the API takes every run for a
 * run until told.
 */
export function isChosen(choice: DrawingChoice): boolean {
  return (
    choice.title !== null ||
    choice.description !== null ||
    choice.activity !== NOT_CHOSEN.activity ||
    choice.tags.length > 0 ||
    isSeen(choice.visibility)
  );
}

/** Two choices that would send the same drawing. */
export function sameChoice(a: DrawingChoice, b: DrawingChoice): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.activity === b.activity &&
    a.visibility === b.visibility &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, i) => tag.public_id === b.tags[i].public_id)
  );
}

/** The choice as the API keeps it: a MyDrawing from before TASK-208 has
 * only `public`. */
export function choiceOf(drawing: MyDrawing): DrawingChoice {
  return {
    title: drawing.title,
    description: drawing.description ?? null,
    activity: drawing.activity ?? NOT_CHOSEN.activity,
    tags: drawing.tags ?? [],
    visibility: drawing.visibility ?? (drawing.public ? "everyone" : "only_me"),
  };
}

/**
 * A choice read back from a file of the phone: the whole one, or the one
 * of before TASK-208 (`title` and `public`), made whole. Null when it is
 * neither.
 */
export function choiceFrom(value: unknown): DrawingChoice | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const title = typeof item.title === "string" && item.title !== "" ? item.title : null;
  if (typeof item.public === "boolean" && item.visibility === undefined) {
    return { ...NOT_CHOSEN, title, visibility: item.public ? "everyone" : "only_me" };
  }
  if (!isVisibility(item.visibility) || !isActivity(item.activity)) {
    return null;
  }
  const tags = Array.isArray(item.tags) ? item.tags.filter(isDrawingTag) : null;
  if (tags === null) {
    return null;
  }
  return {
    title,
    description:
      typeof item.description === "string" && item.description !== ""
        ? item.description
        : null,
    activity: item.activity,
    tags,
    visibility: item.visibility,
  };
}

function drawingPath(key: string): string {
  return `/me/activities/${encodeURIComponent(key)}/drawing`;
}

/** GET /me/activities/{key}/drawing: what the owner chose for the run. */
export function fetchMyDrawing(
  baseUrl: string,
  token: string,
  key: string,
  options: Options = {},
): Promise<AccountOutcome<MyDrawing>> {
  return ask(baseUrl, drawingPath(key), { method: "GET", token }, isMyDrawing, options);
}

/**
 * PUT /me/activities/{key}/drawing: the choice whole, every field every
 * time, so sending it again after a phone without a network changes
 * nothing. With "only_me" the API drops the drawing's photos (ADR-0170).
 */
export function saveDrawing(
  baseUrl: string,
  token: string,
  key: string,
  choice: DrawingChoice,
  options: Options = {},
): Promise<AccountOutcome<MyDrawing>> {
  const body: DrawingRequest = {
    title: choice.title,
    visibility: choice.visibility,
    description: choice.description,
    activity: choice.activity,
    tags: choice.tags.map((tag) => tag.public_id),
  };
  return ask(
    baseUrl,
    drawingPath(key),
    { method: "PUT", body, token },
    isMyDrawing,
    options,
  );
}

/**
 * PUT /me/activities/{key}/drawing/photos/{n}: a JPEG in base64 into the
 * place `n` (1 to DRAWING_MAX_PHOTOS). The answer is the drawing as the API
 * keeps it now. On a drawing only the owner sees the API says 409
 * `http_error` (ADR-0170): the photo stays on the phone.
 */
export function saveDrawingPhoto(
  baseUrl: string,
  token: string,
  key: string,
  n: number,
  image: string,
  options: Options = {},
): Promise<AccountOutcome<MyDrawing>> {
  const body: DrawingPhotoRequest = { image };
  return ask(
    baseUrl,
    `${drawingPath(key)}/photos/${n}`,
    { method: "PUT", body, token },
    isMyDrawing,
    options,
  );
}

/** DELETE /me/activities/{key}/drawing/photos/{n}: the place `n` emptied,
 * even when it was. */
export function removeDrawingPhoto(
  baseUrl: string,
  token: string,
  key: string,
  n: number,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `${drawingPath(key)}/photos/${n}`,
    { method: "DELETE", token },
    isNothing,
    options,
  );
}

/** What an `Image` shows of a photo on the API: its address, read with the
 * token as every other call (ADR-0120), and with the API's key: a server
 * with one answers 401 to a request without it, and the photo stays blank
 * (TASK-330). */
export function drawingPhotoSource(
  baseUrl: string,
  token: string,
  photo: DrawingPhoto,
  key: string | null = apiKey(),
): { uri: string; headers: Record<string, string> } {
  return {
    uri: `${baseUrl}${photo.url}`,
    headers: { ...keyHeaders(key), ...authHeaders(token) },
  };
}

/**
 * GET /me/drawings: the runs with a title or made public. An API older
 * than TASK-117 has no such endpoint and says 404: none, there.
 */
export async function fetchMyDrawings(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<MyDrawing[]>> {
  const outcome = await ask(
    baseUrl,
    "/me/drawings",
    { method: "GET", token },
    isMyDrawings,
    options,
  );
  if (outcome.kind === "ok") {
    return { kind: "ok", value: outcome.value.drawings };
  }
  return outcome.kind === "api_error" && outcome.code === "http_error"
    ? { kind: "ok", value: [] }
    : outcome;
}

/** GET /users/{public_id}/drawings: a page, the first without a `cursor`. */
export function fetchUserDrawings(
  baseUrl: string,
  token: string,
  publicId: string,
  cursor: string | null = null,
  options: Options = {},
): Promise<AccountOutcome<DrawingsPage>> {
  const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/users/${encodeURIComponent(publicId)}/drawings${query}`,
    { method: "GET", token },
    isDrawingsPage,
    options,
  );
}

/** GET /drawings/{id}: one drawing whole, cut as the others see it. */
export function fetchDrawing(
  baseUrl: string,
  token: string,
  id: string,
  options: Options = {},
): Promise<AccountOutcome<DrawingDetail>> {
  return ask(
    baseUrl,
    `/drawings/${encodeURIComponent(id)}`,
    { method: "GET", token },
    isDrawingDetail,
    options,
  );
}

/**
 * A choice that the same call, later, could make go: no network, the API
 * silent or busy. A run the API does not know (deleted, `404`) or a choice
 * it refuses (`422`, a run too short to publish) would be refused again.
 */
export function worthAgain(outcome: AccountOutcome<unknown>): boolean {
  switch (outcome.kind) {
    case "ok":
      return false;
    case "unreachable":
      return true;
    case "bad_answer":
      return outcome.status >= 500;
    case "api_error":
      return outcome.code === "too_many_requests";
  }
}

/** Words for a drawing call that did not go; null when it did. */
export function drawingProblem(outcome: AccountOutcome<unknown>): string | null {
  if (outcome.kind === "ok") {
    return null;
  }
  if (outcome.kind === "unreachable") {
    return t("No connection. Try again when you are online.");
  }
  if (outcome.kind === "api_error") {
    if (outcome.code === "session_expired" || outcome.code === "not_signed_in") {
      return t(SESSION_ENDED);
    }
    // The API's own words: a title too long, a run too short to publish.
    if (outcome.code === "invalid_request") {
      return outcome.message;
    }
    if (outcome.code === "http_error") {
      return t("This run is no longer in your activities.");
    }
  }
  return accountProblem(outcome);
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null;
}

function isNothing(body: unknown): body is null {
  return body === null;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isVisibility(value: unknown): value is Visibility {
  return (
    typeof value === "string" && (VISIBILITIES as readonly string[]).includes(value)
  );
}

function isActivity(value: unknown): value is Activity {
  return typeof value === "string" && (ACTIVITIES as readonly string[]).includes(value);
}

export function isDrawingTag(value: unknown): value is DrawingTag {
  return (
    isRecord(value) &&
    typeof value.public_id === "string" &&
    typeof value.username === "string"
  );
}

export function isDrawingPhoto(value: unknown): value is DrawingPhoto {
  return (
    isRecord(value) &&
    typeof value.n === "number" &&
    typeof value.url === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

/** The fields of TASK-208, when the API has them: each right, or absent. */
function hasDetailFields(body: Record<string, unknown>): boolean {
  return (
    (body.visibility === undefined || isVisibility(body.visibility)) &&
    (body.description === undefined || isStringOrNull(body.description)) &&
    (body.activity === undefined || isActivity(body.activity)) &&
    (body.tags === undefined ||
      (Array.isArray(body.tags) && body.tags.every(isDrawingTag))) &&
    (body.photos === undefined ||
      (Array.isArray(body.photos) && body.photos.every(isDrawingPhoto)))
  );
}

function isLine(value: unknown): value is LatLon[] {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number",
    )
  );
}

export function isMyDrawing(body: unknown): body is MyDrawing {
  return (
    isRecord(body) &&
    typeof body.key === "string" &&
    isStringOrNull(body.id) &&
    isStringOrNull(body.title) &&
    typeof body.public === "boolean" &&
    isStringOrNull(body.published_at) &&
    hasDetailFields(body)
  );
}

function isMyDrawings(body: unknown): body is { drawings: MyDrawing[] } {
  return (
    isRecord(body) && Array.isArray(body.drawings) && body.drawings.every(isMyDrawing)
  );
}

/** The fields every drawing has, in a list or whole. */
function hasDrawingFields(body: Record<string, unknown>): boolean {
  return (
    typeof body.id === "string" &&
    isStringOrNull(body.title) &&
    typeof body.started_at === "string" &&
    isStringOrNull(body.published_at) &&
    isStringOrNull(body.place) &&
    isStringOrNull(body.shape) &&
    isStringOrNull(body.word) &&
    isStringOrNull(body.style) &&
    isStringOrNull(body.route_title) &&
    typeof body.distance_m === "number" &&
    typeof body.duration_s === "number" &&
    isNumberOrNull(body.score) &&
    isNumberOrNull(body.fidelity) &&
    hasDetailFields(body)
  );
}

export function isDrawing(body: unknown): body is Drawing {
  return isRecord(body) && hasDrawingFields(body) && isLine(body.track_preview);
}

export function isDrawingsPage(body: unknown): body is DrawingsPage {
  return (
    isRecord(body) &&
    Array.isArray(body.drawings) &&
    body.drawings.every(isDrawing) &&
    isStringOrNull(body.next) &&
    typeof body.total === "number"
  );
}

export function isDrawingDetail(body: unknown): body is DrawingDetail {
  if (!isRecord(body) || !hasDrawingFields(body) || !isRecord(body.author)) {
    return false;
  }
  return (
    typeof body.author.public_id === "string" &&
    typeof body.author.username === "string" &&
    typeof body.public === "boolean" &&
    isLine(body.track)
  );
}
