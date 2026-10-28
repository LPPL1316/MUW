import type { ApiError, WayBack, WayBackRequest } from "@shaperoute/shared-types";

import { PHONE_HEADER } from "../engine/prefetch";
import { apiKey, keyHeaders } from "./apiUrl";
import { isApiError, isDirection } from "./routes";

/**
 * The way back to the route on the streets, for a runner off it (TASK-314,
 * ADR-0274): POST /way-back. The bodies are
 * packages/shared-types/fixtures/way-back-request.json and way-back.json.
 * An API older than TASK-314 answers 404: a bad answer, and the run keeps
 * the straight line of ADR-0263.
 */

/** Every way asking for the way back can end. */
export type WayBackOutcome =
  | { kind: "way"; way: WayBack }
  | ({ kind: "api_error" } & ApiError["error"])
  | { kind: "unreachable"; url: string }
  | { kind: "bad_answer"; status: number }
  | { kind: "cancelled" };

/** Asks the API for the way back. `phone` is the phone's anonymous id
 * (prefetch.phoneId), by which the API counts its requests. Never throws. */
export async function requestWayBack(
  baseUrl: string,
  request: WayBackRequest,
  {
    signal,
    fetchFn = fetch,
    key = apiKey(),
    phone = null,
  }: {
    signal?: AbortSignal;
    fetchFn?: typeof fetch;
    key?: string | null;
    phone?: string | null;
  } = {},
): Promise<WayBackOutcome> {
  let response: Response;
  try {
    response = await fetchFn(`${baseUrl}/way-back`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...keyHeaders(key),
        ...(phone === null ? {} : { [PHONE_HEADER]: phone }),
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    return signal?.aborted
      ? { kind: "cancelled" }
      : { kind: "unreachable", url: baseUrl };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok && isWayBack(body)) {
    return { kind: "way", way: body };
  }
  return !response.ok && isApiError(body)
    ? { kind: "api_error", ...body.error }
    : { kind: "bad_answer", status: response.status };
}

function isPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** The answer of POST /way-back, from the server or the phone's engine. */
export function isWayBack(body: unknown): body is WayBack {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { points, distance_m, rejoin, rejoin_m, directions } = body as Record<
    string,
    unknown
  >;
  // One point at least: a runner on the route itself is where it rejoins.
  return (
    Array.isArray(points) &&
    points.length >= 1 &&
    points.every(isPair) &&
    typeof distance_m === "number" &&
    isPair(rejoin) &&
    typeof rejoin_m === "number" &&
    Array.isArray(directions) &&
    directions.every(isDirection)
  );
}
