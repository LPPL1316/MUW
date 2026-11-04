import type { Activity, MuwRoute, MuwRouteDetail } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "../api/apiUrl";
import type { FetchWhole } from "../explore/explored";
import {
  type RecommendedRoute,
  type RecommendedRouteDetail,
  turnOf,
} from "../explore/recommendedRoutes";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** The id a MuW route has as a route of «Explore»: never one of the catalogue's. */
export function muwRouteId(route: { id: string }): string {
  return `muw:${route.id}`;
}

/**
 * A MuW route as a route of «Explore» (TASK-365, ADR-0310): what the map and
 * its card show while the route is fetched whole. No likeness is said of it:
 * the app shows no score, and these routes have none to show.
 */
export function muwCardRoute(route: MuwRoute): RecommendedRoute {
  return {
    id: muwRouteId(route),
    city: route.city,
    shape: route.shape ?? null,
    word: route.word ?? null,
    style: route.style ?? null,
    distance_m: route.route_m,
    route_m: route.route_m,
    similarity: 1,
    start: route.start,
    away_m: 0,
    preview: route.preview,
    ...turnOf(route),
  };
}

/**
 * The route whole, as the map opens it: its saved line is the route shown,
 * run and exported (`explored.toResult`; Start asks only for its directions).
 * Its figure gives it the request a route of «Explore» needs to open at all.
 */
export function muwDetail(detail: MuwRouteDetail): RecommendedRouteDetail {
  return {
    id: muwRouteId(detail),
    city: detail.city,
    shape: detail.shape ?? null,
    word: detail.word ?? null,
    style: detail.style ?? null,
    distance_m: detail.route_m,
    route_m: detail.route_m,
    similarity: 1,
    points: detail.points,
    license: detail.license,
    activity: detail.activity as Activity,
    ...(detail.outline ? { outline: detail.outline } : {}),
    ...turnOf(detail),
  };
}

function isDetail(body: unknown): body is MuwRouteDetail {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const r = body as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.route_m === "number" &&
    typeof r.license === "string" &&
    Array.isArray(r.points) &&
    r.points.length >= 2 &&
    (typeof r.shape === "string" || typeof r.word === "string")
  );
}

/**
 * How a MuW route is fetched whole: GET /muw-routes/{id}. One without its
 * figure has no request, cannot open, and fails as one that does not load.
 */
export function fetchMuwRoute(route: MuwRoute, options: Options = {}): FetchWhole {
  const { fetchFn = fetch, key = apiKey() } = options;
  return async (apiUrl) => {
    try {
      const response = await fetchFn(
        `${apiUrl}/muw-routes/${encodeURIComponent(route.id)}`,
        { headers: keyHeaders(key) },
      );
      const body: unknown = await response.json();
      return response.ok && isDetail(body)
        ? { kind: "route", route: muwDetail(body) }
        : { kind: "failed" };
    } catch {
      return { kind: "failed" };
    }
  };
}
