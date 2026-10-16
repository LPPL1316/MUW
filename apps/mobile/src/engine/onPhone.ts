import type { ApiErrorCode, JobStatus } from "@shaperoute/shared-types";

import {
  type AnyRouteRequest,
  isImageRequest,
  isRouteJob,
  requestRoute,
  type RouteOutcome,
} from "../api/routes";
import { type PhoneEngine, phoneEngine, PLAN_TIMEOUT_MS } from "./phoneEngine";
import {
  coveringZone,
  type Network,
  NETWORKS,
  savedZones,
  touchZone,
  type ZoneEntry,
  zoneUri,
} from "./zones";

/**
 * The phone first, the server as the fallback (TASK-214, choice 5): a shape
 * or a word on roads, with a zone saved around the start, is drawn by the
 * engine on the phone; anything else, or anything the phone could not do,
 * goes to the server as before (requestRoute). Never throws.
 */

/** What the phone did with a request: a route, a verdict of the engine
 * (the same the server would give), or nothing, and why. */
export type PhoneOutcome =
  | Extract<RouteOutcome, { kind: "route" | "api_error" | "cancelled" }>
  | { kind: "skipped"; why: string };

/**
 * What the engine itself decides about a request, the same on the phone and
 * on the server: shown at once, without a second wait for the server. Any
 * other failure (a zone too small, an error of Python) goes to the server.
 */
export const VERDICTS: readonly ApiErrorCode[] = [
  "shape_not_drawable",
  "invalid_request",
];

/**
 * The longest routes the phone draws first, by network. The phone plans
 * the start and its nearby starts one after the other, where the server
 * plans them at the same time: a 10 km heart took 33–117 s in Pyodide on
 * the Mac, a 5 km one 7 s (TASK-214, «Esito»). Longer routes go to the
 * server first, and to the phone only when the server cannot be reached.
 * To be set again with the iPhone's times (part D).
 */
export const PHONE_MAX_DISTANCE_M: Readonly<Record<Network, number>> = {
  foot: 8_000,
  bike: 30_000,
};
/** A route with no server to ask may take this long on the phone. */
export const OFFLINE_TIMEOUT_MS = 5 * 60_000;

type Options = {
  signal?: AbortSignal;
  onStatus?: (status: JobStatus) => void;
  engine?: PhoneEngine;
  zones?: () => ZoneEntry[];
  timeoutMs?: number;
};

/** Whether the phone draws `request` before asking the server. */
export function phoneFirst(request: AnyRouteRequest): boolean {
  if (isImageRequest(request)) {
    return false;
  }
  const network = NETWORKS[request.activity];
  return network !== undefined && request.distance_m <= PHONE_MAX_DISTANCE_M[network];
}

export async function planOnPhone(
  request: AnyRouteRequest,
  {
    signal,
    onStatus,
    engine = phoneEngine,
    zones = savedZones,
    timeoutMs = PLAN_TIMEOUT_MS,
  }: Options = {},
): Promise<PhoneOutcome> {
  if (isImageRequest(request)) {
    return { kind: "skipped", why: "photos are drawn on the server" };
  }
  const network = NETWORKS[request.activity];
  if (network === undefined) {
    return { kind: "skipped", why: `${request.activity} is drawn on the server` };
  }
  if (!engine.available) {
    return { kind: "skipped", why: "the engine does not run on this phone" };
  }
  const zone = coveringZone(zones(), network, request.start);
  if (zone === null) {
    return { kind: "skipped", why: "no zone saved around the start" };
  }
  touchZone(zone.name);
  onStatus?.("computing");
  // Cancelled, the engine lets it go at once (TASK-287): another request
  // does not wait behind it.
  const answer = await engine.plan(
    JSON.stringify(request),
    [{ name: zone.name, uri: zoneUri(zone), version: zone.etag ?? String(zone.bytes) }],
    timeoutMs,
    signal,
  );
  if (signal?.aborted || answer.kind === "cancelled") {
    return { kind: "cancelled" };
  }
  if (answer.kind === "failed") {
    return { kind: "skipped", why: answer.why };
  }
  let job: unknown;
  try {
    job = JSON.parse(answer.json);
  } catch {
    return { kind: "skipped", why: "the engine gave no JSON" };
  }
  if (!isRouteJob(job)) {
    return { kind: "skipped", why: "the engine gave no route job" };
  }
  if (job.status === "done" && job.result) {
    return { kind: "route", result: job.result };
  }
  if (job.status === "failed" && job.error && VERDICTS.includes(job.error.code)) {
    return { kind: "api_error", ...job.error };
  }
  return { kind: "skipped", why: job.error?.message ?? "the engine did not finish" };
}

/**
 * requestRoute, with the phone. Up to PHONE_MAX_DISTANCE_M the phone first,
 * and the server only when the phone gave neither a route nor a verdict;
 * beyond it the server first, and the phone only when the server cannot be
 * reached (no signal), with all the time it needs.
 */
export async function requestRouteOnPhoneFirst(
  baseUrl: string,
  request: AnyRouteRequest,
  options: Parameters<typeof requestRoute>[2] & { engine?: PhoneEngine } = {},
): Promise<RouteOutcome> {
  const { engine, ...serverOptions } = options;
  const onPhone = (timeoutMs?: number) =>
    planOnPhone(request, {
      signal: options.signal,
      onStatus: options.onStatus,
      engine,
      timeoutMs,
    });
  if (phoneFirst(request)) {
    const drawn = await onPhone();
    return drawn.kind === "skipped"
      ? requestRoute(baseUrl, request, serverOptions)
      : drawn;
  }
  const onServer = await requestRoute(baseUrl, request, serverOptions);
  if (onServer.kind !== "unreachable") {
    return onServer;
  }
  const drawn = await onPhone(OFFLINE_TIMEOUT_MS);
  return drawn.kind === "skipped" ? onServer : drawn;
}
