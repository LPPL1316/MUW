import type { MuwRoute, MuwRoutesPage } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "./apiUrl";

/**
 * The routes MuW draws for «Feed» (TASK-365, ADR-0310): GET /muw-routes of
 * docs/API.md, «MuW routes». Routes, not runs: no person, date or time. The
 * body is packages/shared-types/fixtures/muw-routes.json. No token: they say
 * nothing about who asks.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

const ACTIVITIES = new Set(["running", "cycling", "paddling"]);

function isPoint(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** A route the app can show: an activity it knows, a title, a line. */
export function isMuwRoute(value: unknown): value is MuwRoute {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.city === "string" &&
    typeof r.activity === "string" &&
    ACTIVITIES.has(r.activity) &&
    typeof r.titles === "object" &&
    r.titles !== null &&
    typeof (r.titles as Record<string, unknown>).en === "string" &&
    typeof r.route_m === "number" &&
    typeof r.climb_m === "number" &&
    typeof r.rotation_deg === "number" &&
    isPoint(r.start) &&
    Array.isArray(r.preview) &&
    r.preview.length >= 2 &&
    r.preview.every(isPoint)
  );
}

/**
 * Every MuW route, by id. Never throws: anything that is not the list (no
 * network, an API before TASK-365 that answers 404, a body it does not know)
 * is no route, and «Feed» is as before. A route it cannot show is left out.
 */
export async function fetchMuwRoutes(
  baseUrl: string,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<MuwRoute[]> {
  try {
    const response = await fetchFn(`${baseUrl}/muw-routes`, {
      headers: keyHeaders(key),
      signal,
    });
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as Partial<MuwRoutesPage> | null;
    return Array.isArray(body?.routes) ? body.routes.filter(isMuwRoute) : [];
  } catch {
    return [];
  }
}
