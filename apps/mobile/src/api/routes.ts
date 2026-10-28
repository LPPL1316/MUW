import {
  type ApiError,
  type ApiErrorCode,
  type Direction,
  type ImagePenUpRouteRequest,
  type ImageRouteRequest,
  JOB_STATUSES,
  type JobStatus,
  type RouteJob,
  type RouteRequest,
  type RouteResult,
  TURNS,
} from "@shaperoute/shared-types";

import { apiKey as configuredKey, keyHeaders } from "./apiUrl";

/** How often the app asks where a route job stands (ADR-0032), at most. */
export const POLL_MS = 2_000;
/**
 * The first asks come sooner (ADR-0136): a 5 km route is ready in a
 * couple of seconds, and asked every 2 s it was seen up to 2 s late, three
 * times over for a city's examples. Each pair: until so long after the
 * request, ask this often. A long route is then asked as before.
 */
export const QUICK_POLLS: readonly (readonly [untilMs: number, everyMs: number])[] = [
  [6_000, 500],
  [20_000, 1_000],
];
/** When the app stops waiting: the worst case seen was about 165 s. */
export const MAX_WAIT_MS = 5 * 60_000;
/** Failures in a row while waiting before the API counts as gone: network
 * errors, and 5xx answers that are not the API's (TASK-254: a proxy's). */
export const MAX_POLL_FAILURES = 3;

/** How long to wait before asking again, `waitedMs` after the request. */
export function pollDelay(waitedMs: number, pollMs: number = POLL_MS): number {
  const quick = QUICK_POLLS.find(([untilMs]) => waitedMs < untilMs);
  return quick === undefined ? pollMs : Math.min(quick[1], pollMs);
}

/** Every way a route request can end. */
export type RouteOutcome =
  | { kind: "route"; result: RouteResult }
  | {
      kind: "api_error";
      code: ApiErrorCode;
      message: string;
      /** A distance the shape fits (TASK-031); missing from older APIs. */
      suggested_distance_m?: number | null;
      /** Why an image has no outline (TASK-073), or a drawn line was not
       * added to it (TASK-079); missing from older APIs. As ApiError says it:
       * with a comment's reason too (TASK-120), which no route request gets. */
      reason?: ApiError["error"]["reason"];
    }
  | { kind: "bad_answer"; status: number }
  | { kind: "unreachable"; url: string }
  /** The API does not know the job any more: restarted, or 10 minutes gone. */
  | { kind: "lost" }
  | { kind: "timeout" }
  | { kind: "cancelled" };

type Options = {
  /** Aborting it cancels the request, on the API too. */
  signal?: AbortSignal;
  /** Called with each state the API reports while working. */
  onStatus?: (status: JobStatus) => void;
  fetchFn?: typeof fetch;
  /** Sent in every call; by default EXPO_PUBLIC_API_KEY (TASK-081). */
  apiKey?: string | null;
  pollMs?: number;
  maxWaitMs?: number;
};

type Answer = { status: number; ok: boolean; body: unknown };

/** A shape or a word, or the outline of an image (TASK-073), with its pieces
 * and the pen up (TASK-297). */
export type AnyRouteRequest = RouteRequest | ImageRouteRequest | ImagePenUpRouteRequest;

export function isImageRequest(
  request: AnyRouteRequest,
): request is ImageRouteRequest | ImagePenUpRouteRequest {
  return "outline" in request;
}

/**
 * Asks the API for a route in two steps (ADR-0032): POST /route-jobs answers
 * at once with a job, then GET /route-jobs/{id} until the job is done or
 * failed: often at first, then every `pollMs` (`pollDelay`). A route the API
 * kept is done in the first answer, and nothing is asked again. An image's outline is posted to /image-route-jobs
 * instead (ADR-0069), and read the same way. Never throws.
 */
export async function requestRoute(
  baseUrl: string,
  request: AnyRouteRequest,
  {
    signal,
    onStatus,
    fetchFn = fetch,
    apiKey = configuredKey(),
    pollMs = POLL_MS,
    maxWaitMs = MAX_WAIT_MS,
  }: Options = {},
): Promise<RouteOutcome> {
  const asked = Date.now();
  const deadline = asked + maxWaitMs;
  const auth = keyHeaders(apiKey);
  let answer: Answer;
  try {
    const jobs = isImageRequest(request) ? "image-route-jobs" : "route-jobs";
    answer = await call(fetchFn, `${baseUrl}/${jobs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    return signal?.aborted
      ? { kind: "cancelled" }
      : { kind: "unreachable", url: baseUrl };
  }
  if (!isRouteJob(answer.body)) {
    return problemOf(answer);
  }
  let job = answer.body;
  const jobUrl = `${baseUrl}/route-jobs/${encodeURIComponent(job.job_id)}`;
  // Tells the API to drop the job; nobody waits for its answer.
  const forget = () =>
    void fetchFn(jobUrl, { method: "DELETE", headers: auth }).catch(() => undefined);

  let failures = 0;
  for (;;) {
    if (job.status === "done" && job.result) {
      return { kind: "route", result: job.result };
    }
    if (job.status === "failed" && job.error) {
      return { kind: "api_error", ...job.error };
    }
    onStatus?.(knownStatus(job.status));
    if (Date.now() >= deadline) {
      forget();
      return { kind: "timeout" };
    }
    try {
      await sleep(pollDelay(Date.now() - asked, pollMs), signal);
      answer = await call(fetchFn, jobUrl, { headers: auth, signal });
    } catch {
      if (signal?.aborted) {
        forget();
        return { kind: "cancelled" };
      }
      failures += 1;
      if (failures >= MAX_POLL_FAILURES) {
        return { kind: "unreachable", url: baseUrl };
      }
      continue;
    }
    if (answer.status === 404) {
      return { kind: "lost" };
    }
    if (!isRouteJob(answer.body)) {
      // A 5xx that is not the API's own error (a proxy's, TASK-254): one
      // failure, as a network error is; the job may well be fine.
      if (answer.status >= 500 && !isApiError(answer.body)) {
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) {
          return { kind: "bad_answer", status: answer.status };
        }
        continue;
      }
      return problemOf(answer);
    }
    failures = 0;
    job = answer.body;
  }
}

/** A status this version of the app knows, for `onStatus`: a new one of a
 * newer API is work in progress, as "computing" is (TASK-254). */
function knownStatus(status: string): JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(status)
    ? (status as JobStatus)
    : "computing";
}

/**
 * The answer with the turns this version of the app has no words for read
 * as "straight" (TASK-254): the server and the app are published apart, and
 * a new kind of turn must not refuse the whole route.
 */
export function withKnownTurns(body: unknown): unknown {
  if (
    !isRecord(body) ||
    !isRecord(body.result) ||
    !Array.isArray(body.result.directions)
  ) {
    return body;
  }
  const directions = body.result.directions.map((direction: unknown) =>
    isRecord(direction) &&
    typeof direction.turn === "string" &&
    !(TURNS as readonly string[]).includes(direction.turn)
      ? { ...direction, turn: "straight" }
      : direction,
  );
  return { ...body, result: { ...body.result, directions } };
}

async function call(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Answer> {
  const response = await fetchFn(url, init);
  const body: unknown = await response.json().catch(() => undefined);
  return { status: response.status, ok: response.ok, body: withKnownTurns(body) };
}

function problemOf(answer: Answer): RouteOutcome {
  if (!answer.ok && isApiError(answer.body)) {
    return { kind: "api_error", ...answer.body.error };
  }
  return { kind: "bad_answer", status: answer.status };
}

/** Waits `ms`, or rejects as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

/** Enough checks to draw it safely: the API is ours, but it is another program. */
export function isRouteResult(body: unknown): body is RouteResult {
  return (
    isRecord(body) &&
    Array.isArray(body.points) &&
    body.points.length >= 2 &&
    body.points.every(isPoint) &&
    typeof body.distance_m === "number" &&
    typeof body.similarity === "number" &&
    // A shape, or a word (TASK-056), never both; both null for an image
    // (TASK-073), which only an API that knows words sends. A shape this
    // version of the app does not know is one all the same (TASK-254): a
    // newer server draws it, and shapeName has a name for it.
    (typeof body.shape === "string"
      ? body.word === undefined || body.word === null
      : body.shape === null && (typeof body.word === "string" || body.word === null)) &&
    Array.isArray(body.warnings) &&
    body.warnings.every((warning) => typeof warning === "string") &&
    // Required since TASK-048: an API without them is out of date, not empty.
    Array.isArray(body.directions) &&
    body.directions.every(isDirection)
  );
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

export function isDirection(value: unknown): value is Direction {
  return (
    isRecord(value) &&
    typeof value.node === "number" &&
    isPoint(value.point) &&
    typeof value.distance_m === "number" &&
    (TURNS as readonly unknown[]).includes(value.turn) &&
    typeof value.angle_deg === "number" &&
    isNullableString(value.street) &&
    isNullableString(value.road_type) &&
    typeof value.branches === "number" &&
    typeof value.joined === "boolean"
  );
}

/** A code this version of the app does not know is an error all the same
 * (TASK-254): shown as the API's words say it (route/problems.ts, default). */
function isErrorDetail(value: unknown): value is ApiError["error"] {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

export function isApiError(body: unknown): body is ApiError {
  return isRecord(body) && isErrorDetail(body.error);
}

export function isRouteJob(body: unknown): body is RouteJob {
  return (
    isRecord(body) &&
    typeof body.job_id === "string" &&
    // A status of a newer API is work in progress (TASK-254, knownStatus).
    typeof body.status === "string" &&
    (body.result === null || isRouteResult(body.result)) &&
    (body.error === null || isErrorDetail(body.error))
  );
}
