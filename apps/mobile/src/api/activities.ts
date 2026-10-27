import type {
  Activity as Sport,
  LatLon,
  TrackFix,
  Walk,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";

/**
 * The runs an account recorded (TASK-172): GET, PUT and DELETE
 * /me/activities, all with the session token (docs/API.md, «My
 * activities»). The bodies are packages/shared-types/fixtures/
 * activities.json, activity.json and activity-request.json, and since
 * TASK-200 activity-pauses.json; the types live here, like `Favorite`.
 */

/** One run of the list, with a light preview of its lines. */
export type Activity = {
  /** The key the app made from the run's track (activityKey). */
  id: string;
  /** When the run began, as the API writes a moment: read on the phone's
   * clock. */
  started_at: string;
  /** The town the run starts from, when the API found it. */
  place: string | null;
  shape: string | null;
  word: string | null;
  style: string | null;
  /** What the route draws when neither a shape nor a word says it. */
  title: string | null;
  /** Metres and seconds of the run, pauses left out; counted by the API. */
  distance_m: number;
  duration_s: number;
  /** From 0 to 100; null without a route, or for a run too short to judge. */
  score: number | null;
  fidelity: number | null;
  /** What the run was (TASK-251): on the water its pace is a paddler's.
   * Absent from an API before TASK-251, which only knew runs. */
  activity?: Sport;
  /**
   * How far the planned route's shape is turned, as RouteResult.rotation_deg
   * (TASK-232): the drawing is shown turned back. Null for a run without a
   * route, one north up and every run saved before; missing from an API
   * older than TASK-232 part C. Read through `bearingOf`.
   */
  rotation_deg?: number | null;
  /** The planned route; null for a run without one. */
  route_preview: LatLon[] | null;
  track_preview: LatLon[];
};

/** One run whole, to show on the map. */
export type ActivityDetail = Omit<Activity, "route_preview" | "track_preview"> & {
  /** The planned route's similarity to its shape. */
  similarity: number | null;
  points: LatLon[] | null;
  track: LatLon[];
  /**
   * The planned route's walks, for a word with the pen up (TASK-199):
   * [from, to] indices into `points`. Empty for any other run; missing from
   * an API older than TASK-199. Read through `walksOf`, which trusts only
   * walks that fit the points.
   */
  walks?: Walk[];
  /**
   * Its pauses, in the order they were recorded (TASK-200); missing from an
   * API older than TASK-200. Nothing shows them yet.
   */
  pauses?: SavedPause[];
  /**
   * Its post as it was last shared (TASK-258): «Share» opens it as it was.
   * Null for a run whose post was never shared; missing from an API older
   * than TASK-258.
   */
  post?: RunPost | null;
};

/** An emoji on the post: its centre as shares of the picture's width and
 * height, from the top left (stickers.ts). */
export type PostEmoji = {
  emoji: string;
  x: number;
  y: number;
};

/**
 * The post of a run as the app shared it (TASK-258, ADR-0194 for the post):
 * enough to make the same picture again from the run, never the picture.
 * PUT /me/activities/{key}/post: packages/shared-types/fixtures/
 * run-post-request.json.
 */
export type RunPostRequest = {
  /** What was written over the drawing; null for a post without one. */
  title: string | null;
  /** The results shown, in the post's order: "distance", "time", "pace". */
  results: string[];
  emoji: PostEmoji[];
};

/** The post kept, with when it was last shared (fixtures/run-post.json). */
export type RunPost = RunPostRequest & {
  shared_at: string;
};

/** A pause of a run saved, in seconds since the first point of its `track`,
 * only what of it lies inside the run. */
export type SavedPause = {
  from_s: number;
  to_s: number;
  auto: boolean;
  /** Only as true: a pause of the pen between two letters (TASK-199). */
  pen?: boolean;
};

/** A page of the list, the latest run first. */
export type ActivitiesPage = {
  activities: Activity[];
  /** What to ask the next page with; null on the last one. */
  next: string | null;
  /** How many runs the account has. */
  total: number;
};

/** A stretch of a run that is not of it, on the clock of its fixes. */
export type ActivityPause = {
  from_ms: number;
  to_ms: number;
  auto: boolean;
  /** Paused by the pen between two letters (TASK-198, TASK-199): sent only
   * as true, and only on a run along a word with the pen up. */
  pen?: boolean;
};

/**
 * A fix of a run sent: TrackFix, with the phone's height when it gave one
 * (TASK-311). The API counts the climb from it, for the totals of the
 * profile; POST /track-scores takes no height.
 */
export type ActivityFix = TrackFix & {
  /** Metres above sea level; sent only when known: an API older than
   * TASK-311 refuses the field. */
  altitude_m?: number;
};

/** What PUT /me/activities/{key} takes: the run as the app recorded it. The
 * API counts metres, seconds, climb and score itself. */
export type ActivityRequest = {
  track: ActivityFix[];
  pauses: ActivityPause[];
  /** The planned route and its similarity: both, or both null. */
  points: LatLon[] | null;
  similarity: number | null;
  shape: string | null;
  word: string | null;
  style: "round" | "block" | null;
  title: string | null;
  /**
   * The planned route's walks, for a word with the pen up (TASK-199): the
   * API scores the letters alone. Sent only then: an API older than
   * TASK-199 refuses a field it does not know.
   */
  walks?: Walk[];
  /**
   * How far the planned route's shape is turned, as RouteResult.rotation_deg
   * (TASK-232, ADR-0195). Sent only when the route is turned: an API older
   * than TASK-232 part C refuses the field.
   */
  rotation_deg?: number;
};

/**
 * `request` as an app older than TASK-199 sends it: without the walks,
 * without the pen on its pauses and without the turn of TASK-232. The same
 * object when it has none of them.
 */
export function withoutPenUp(request: ActivityRequest): ActivityRequest {
  if (
    request.walks === undefined &&
    request.rotation_deg === undefined &&
    !request.pauses.some((p) => "pen" in p)
  ) {
    return request;
  }
  const { walks: _walks, rotation_deg: _turn, ...older } = request;
  return {
    ...older,
    pauses: request.pauses.map(({ pen: _pen, ...pause }) => pause),
  };
}

/**
 * `request` as an app older than TASK-311 sends it, without the heights of
 * its fixes: an API before it refuses them, and keeps the run without its
 * climb. The same object when no fix has one.
 */
export function withoutHeights(request: ActivityRequest): ActivityRequest {
  if (!request.track.some((fix) => "altitude_m" in fix)) {
    return request;
  }
  return {
    ...request,
    track: request.track.map(({ altitude_m: _height, ...fix }) => fix),
  };
}

/**
 * `request` as an app older than TASK-232 part C sends it, without the turn
 * of its route: an API before it refuses the field, and keeps the run as
 * one north up. The same object when it has none.
 */
export function withoutTurn(request: ActivityRequest): ActivityRequest {
  if (request.rotation_deg === undefined) {
    return request;
  }
  const { rotation_deg: _turn, ...older } = request;
  return older;
}

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** GET /me/activities: a page, the first without a `cursor`. */
export function fetchActivities(
  baseUrl: string,
  token: string,
  cursor: string | null = null,
  options: Options = {},
): Promise<AccountOutcome<ActivitiesPage>> {
  const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/me/activities${query}`,
    { method: "GET", token },
    isActivitiesPage,
    options,
  );
}

/** GET /me/activities/{key}: the run whole. */
export function fetchActivity(
  baseUrl: string,
  token: string,
  id: string,
  options: Options = {},
): Promise<AccountOutcome<ActivityDetail>> {
  return ask(
    baseUrl,
    `/me/activities/${id}`,
    { method: "GET", token },
    isActivityDetail,
    options,
  );
}

/**
 * PUT /me/activities/{key}: saved once, however many times it is sent. A
 * run with the heights of its fixes that the API refuses is first sent
 * again without them (TASK-311, ADR-0271); a run along a turned route then
 * without the turn (TASK-232, ADR-0195); a run along a word with the pen up
 * goes once more as an older app sends it (TASK-199, ADR-0158): an API
 * older than TASK-199 keeps it, scored on the whole route, rather than the
 * run being lost.
 */
export async function saveActivity(
  baseUrl: string,
  token: string,
  id: string,
  request: ActivityRequest,
  options: Options = {},
): Promise<AccountOutcome<Activity>> {
  const put = (body: ActivityRequest) =>
    ask(
      baseUrl,
      `/me/activities/${id}`,
      { method: "PUT", body, token },
      isActivity,
      options,
    );
  const refused = (outcome: AccountOutcome<Activity>) =>
    outcome.kind === "api_error" && outcome.code === "invalid_request";
  let sent = request;
  let outcome = await put(sent);
  for (const older of [withoutHeights, withoutTurn, withoutPenUp]) {
    const next = older(sent);
    if (refused(outcome) && next !== sent) {
      sent = next;
      outcome = await put(sent);
    }
  }
  return outcome;
}

/** PUT /me/activities/{key}/post: the post as shared now, over the one
 * before (TASK-258). 404 for a run the API does not have. */
export function savePost(
  baseUrl: string,
  token: string,
  id: string,
  request: RunPostRequest,
  options: Options = {},
): Promise<AccountOutcome<RunPost>> {
  return ask(
    baseUrl,
    `/me/activities/${id}/post`,
    { method: "PUT", body: request, token },
    isRunPost,
    options,
  );
}

/** DELETE /me/activities/{key}: gone, or never there. */
export function removeActivity(
  baseUrl: string,
  token: string,
  id: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `/me/activities/${id}`,
    { method: "DELETE", token },
    isEmpty,
    options,
  );
}

function isEmpty(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isLine(value: unknown): value is LatLon[] {
  return Array.isArray(value) && value.every(isPoint);
}

function isText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isPause(value: unknown): value is SavedPause {
  return (
    isRecord(value) &&
    typeof value.from_s === "number" &&
    typeof value.to_s === "number" &&
    typeof value.auto === "boolean" &&
    (value.pen === undefined || typeof value.pen === "boolean")
  );
}

/** What the list and the whole run share. */
function isPostEmoji(value: unknown): value is PostEmoji {
  return (
    isRecord(value) &&
    typeof value.emoji === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

export function isRunPost(body: unknown): body is RunPost {
  return (
    isRecord(body) &&
    isText(body.title) &&
    Array.isArray(body.results) &&
    body.results.every((result) => typeof result === "string") &&
    Array.isArray(body.emoji) &&
    body.emoji.every(isPostEmoji) &&
    typeof body.shared_at === "string"
  );
}

function hasFields(body: Record<string, unknown>): boolean {
  return (
    typeof body.id === "string" &&
    typeof body.started_at === "string" &&
    isText(body.place) &&
    isText(body.shape) &&
    isText(body.word) &&
    isText(body.style) &&
    isText(body.title) &&
    typeof body.distance_m === "number" &&
    typeof body.duration_s === "number" &&
    isNumber(body.score) &&
    isNumber(body.fidelity) &&
    (body.rotation_deg === undefined || isNumber(body.rotation_deg))
  );
}

export function isActivity(body: unknown): body is Activity {
  return (
    isRecord(body) &&
    hasFields(body) &&
    (body.route_preview === null || isLine(body.route_preview)) &&
    isLine(body.track_preview)
  );
}

export function isActivityDetail(body: unknown): body is ActivityDetail {
  return (
    isRecord(body) &&
    hasFields(body) &&
    isNumber(body.similarity) &&
    (body.points === null || isLine(body.points)) &&
    isLine(body.track) &&
    body.track.length >= 2 &&
    (body.pauses === undefined ||
      (Array.isArray(body.pauses) && body.pauses.every(isPause))) &&
    (body.post === undefined || body.post === null || isRunPost(body.post))
  );
}

export function isActivitiesPage(body: unknown): body is ActivitiesPage {
  return (
    isRecord(body) &&
    Array.isArray(body.activities) &&
    body.activities.every(isActivity) &&
    isText(body.next) &&
    typeof body.total === "number"
  );
}
