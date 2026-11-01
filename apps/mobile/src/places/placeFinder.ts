import type { LatLon } from "@shaperoute/shared-types";

import { apiKey, apiUrl, keyHeaders } from "../api/apiUrl";
import { nearParams, type Place, searchPlaces } from "./photon";

/** An API that does not answer by then is skipped for Photon: the PC may
 * be off, and a suggestion late by seconds is no suggestion. */
export const API_TIMEOUT_MS = 2500;
/** After the API was slow or did not answer, Photon alone for this long
 * (TASK-287): else each letter typed waits API_TIMEOUT_MS again. */
export const API_PAUSE_MS = 3 * 60_000;

export type FindPlaces = (query: string, near: LatLon | null) => Promise<Place[]>;

/**
 * Places from the API's GET /places, Geoapify behind it (TASK-123,
 * ADR-0095); from Photon, as before, when there is no API, it is slow, or
 * it says the search is off (503: no key). After a 503 the API is not asked
 * again until the app restarts; after a slow or failed answer, not for
 * API_PAUSE_MS. Throws only when Photon fails too.
 */
export function placeFinder({
  baseUrl = apiUrl(),
  key = apiKey(),
  fetchFn = fetch,
  timeoutMs = API_TIMEOUT_MS,
  now = () => Date.now(),
}: {
  baseUrl?: string | null;
  key?: string | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
} = {}): FindPlaces {
  let apiOff = baseUrl === null;
  let pausedUntil = 0;
  return async (query, near) => {
    if (!apiOff && baseUrl && now() >= pausedUntil) {
      const answer = await fromApi(baseUrl, key, query, near, fetchFn, timeoutMs);
      if (answer.kind === "places") {
        return answer.places;
      }
      apiOff = answer.kind === "off";
      pausedUntil = now() + API_PAUSE_MS;
    }
    return searchPlaces(query, fetchFn, near);
  };
}

type ApiAnswer =
  { kind: "places"; places: Place[] } | { kind: "off" } | { kind: "failed" };

async function fromApi(
  baseUrl: string,
  key: string | null,
  query: string,
  near: LatLon | null,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<ApiAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(placesUrl(baseUrl, query, near), {
      headers: keyHeaders(key),
      signal: controller.signal,
    });
    if (response.status === 503) {
      return { kind: "off" };
    }
    const body: unknown = await response.json();
    return response.ok && isPlaces(body)
      ? { kind: "places", places: body.places }
      : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function placesUrl(baseUrl: string, query: string, near: LatLon | null): string {
  const url = `${baseUrl}/places?q=${encodeURIComponent(query.trim())}`;
  // It only orders the places: about a kilometre is enough (TASK-363).
  return near ? `${url}&${nearParams(near)}` : url;
}

/** The body of GET /places (packages/shared-types/fixtures/places.json). */
export function isPlaces(body: unknown): body is { places: Place[] } {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const places = (body as Record<string, unknown>).places;
  return (
    Array.isArray(places) &&
    places.every((place: unknown) => {
      if (typeof place !== "object" || place === null) {
        return false;
      }
      const { label, point } = place as Record<string, unknown>;
      return (
        typeof label === "string" &&
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((value) => typeof value === "number" && Number.isFinite(value))
      );
    })
  );
}
