import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";
import { KEPT_ROUTES_MAX } from "@shaperoute/shared-types/src/keptRoutes";

import { apiKey as configuredKey, keyHeaders } from "./apiUrl";
import { isApiError, isRouteResult, type RouteOutcome, withKnownTurns } from "./routes";

/**
 * POST /kept-routes (TASK-316, ADR-0276): the routes the API already keeps
 * for some requests, and nothing drawn. «Explore» asks the examples of the
 * towns near and of the region with it as the app opens: what the API has
 * not drawn stays undrawn until someone taps the town.
 */
export type KeptOutcome =
  /** One for each request, in its order: the route kept, or null. */
  | { kind: "kept"; routes: (RouteResult | null)[] }
  /** An API older than TASK-316: it has no such endpoint. */
  | { kind: "not_here" }
  | Exclude<RouteOutcome, { kind: "route" }>;

type Options = {
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
  /** Sent in every call; by default EXPO_PUBLIC_API_KEY (TASK-081). */
  apiKey?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The routes `requests` have on the API, at most KEPT_ROUTES_MAX of them. */
export async function requestKeptRoutes(
  baseUrl: string,
  requests: readonly RouteRequest[],
  { signal, fetchFn = fetch, apiKey = configuredKey() }: Options = {},
): Promise<KeptOutcome> {
  const asked = requests.slice(0, KEPT_ROUTES_MAX);
  if (asked.length === 0) {
    return { kind: "kept", routes: [] };
  }
  let response: Response;
  let body: unknown;
  try {
    response = await fetchFn(`${baseUrl}/kept-routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...keyHeaders(apiKey) },
      body: JSON.stringify({ requests: asked }),
      signal,
    });
    body = await response.json().catch(() => undefined);
  } catch {
    return signal?.aborted
      ? { kind: "cancelled" }
      : { kind: "unreachable", url: baseUrl };
  }
  if (response.status === 404) {
    return { kind: "not_here" };
  }
  if (!response.ok) {
    return isApiError(body)
      ? { kind: "api_error", ...body.error }
      : { kind: "bad_answer", status: response.status };
  }
  const routes = isRecord(body) ? body.routes : undefined;
  if (!Array.isArray(routes) || routes.length !== asked.length) {
    return { kind: "bad_answer", status: response.status };
  }
  return {
    kind: "kept",
    routes: routes.map((route: unknown) => {
      if (route === null) {
        return null;
      }
      // A turn this version has no words for reads as "straight" (TASK-254).
      const known = withKnownTurns({ result: route });
      const result = isRecord(known) ? known.result : undefined;
      return isRouteResult(result) ? result : null;
    }),
  };
}

/**
 * What the app's queue of route requests reads off the answer (routeQueue.ts):
 * a 429 holds the background for a minute. The routes themselves are not a
 * route request's outcome, and are read from the answer.
 */
export function queueOutcome(outcome: KeptOutcome): RouteOutcome {
  return outcome.kind === "kept" || outcome.kind === "not_here"
    ? { kind: "cancelled" }
    : outcome;
}
