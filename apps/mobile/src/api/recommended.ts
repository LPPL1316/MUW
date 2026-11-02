import type { LatLon } from "@shaperoute/shared-types";

import {
  isRecommendedList,
  measuredFrom,
  NEAR_RADIUS_M,
  type RecommendedRoute,
} from "../explore/recommendedRoutes";
import { nearParams } from "../places/photon";
import { authHeaders } from "./accounts";
import { apiKey, keyHeaders } from "./apiUrl";

/**
 * The «Recommended» row of «Explore» (TASK-092, ADR-0229): GET /recommended
 * of docs/API.md, with the session token. The catalogue's routes near a
 * point, the best drawn first, then the most liked, then the most run and
 * kept. The body is that of GET /recommended-routes
 * (packages/shared-types/fixtures/recommended-routes.json).
 */

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

/** The routes in the row: what a thumb scrolls through. */
export const ROW_SIZE = 10;

export function recommendedRowUrl(baseUrl: string, near: LatLon): string {
  const query = new URLSearchParams({
    radius_m: String(NEAR_RADIUS_M),
    limit: String(ROW_SIZE),
  });
  return `${baseUrl}/recommended?${nearParams(near)}&${query.toString()}`;
}

/**
 * The row near `near`, the best first. Never throws: anything that is not
 * the row (no network, signed out on the API, an API without the row, a
 * body it does not know) is no row, and the page shows none.
 */
export async function fetchRecommendedRow(
  baseUrl: string,
  near: LatLon,
  token: string,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<RecommendedRoute[]> {
  try {
    const response = await fetchFn(recommendedRowUrl(baseUrl, near), {
      headers: { ...keyHeaders(key), ...authHeaders(token) },
      signal,
    });
    if (!response.ok) {
      return [];
    }
    const body: unknown = await response.json();
    return isRecommendedList(body)
      ? measuredFrom(near, body.routes.slice(0, ROW_SIZE))
      : [];
  } catch {
    return [];
  }
}
