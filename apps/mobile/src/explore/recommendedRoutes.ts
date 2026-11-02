import type { Activity, LatLon, Walk } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "../api/apiUrl";
import { shapeWord } from "../i18n/shapeNames";
import { metresBetween } from "../map/coordinates";
import { nearParams } from "../places/photon";

/**
 * The best routes already planned near a point, for "Explore" (TASK-126,
 * ADR-0098): GET /recommended-routes and GET /recommended-routes/{id}.
 * The bodies are packages/shared-types/fixtures/recommended-routes.json and
 * recommended-route.json; the types live here, like `Place` in photon.ts.
 */

/** One route of the list, with a light preview of its line. */
export type RecommendedRoute = {
  id: string;
  city: string;
  /** A shape of the catalogue, or null for a word. */
  shape: string | null;
  /** The word in capitals, or null for a shape. */
  word: string | null;
  /** "round" or "block", for a word. */
  style: string | null;
  /** The distance asked for. */
  distance_m: number;
  /** The distance on the roads. */
  route_m: number;
  similarity: number;
  start: LatLon;
  /** From the point asked about to the start, in a straight line. */
  away_m: number;
  preview: LatLon[];
  /**
   * The points of `preview` the route comes to without drawing: a card
   * draws no segment that ends at one (an example drawn in pieces on the
   * water, TASK-226). Absent for a route in one line.
   */
  gaps?: number[];
  /**
   * How far its shape is turned, as RouteResult.rotation_deg (TASK-232): the
   * card draws it turned back. Absent for a route that does not say, which
   * stays north up.
   */
  rotation_deg?: number;
};

/** One route whole, to show on the map and export. */
export type RecommendedRouteDetail = {
  id: string;
  city: string;
  shape: string | null;
  word: string | null;
  style: string | null;
  distance_m: number;
  route_m: number;
  similarity: number;
  points: LatLon[];
  license: string;
  /**
   * What it was drawn for, when not a run: an example drawn on the phone on
   * the water (TASK-191). The API's routes are runs and do not say.
   */
  activity?: Activity;
  /**
   * The stretches with the pen up of a shape drawn in pieces on the water
   * (TASK-226), as RouteResult.walks: an example's only, when it has some.
   */
  walks?: Walk[];
  /**
   * How far its shape is turned, as RouteResult.rotation_deg (TASK-232): the
   * map turns the other way, also while it is run. Absent for a route that
   * does not say, which stays north up.
   */
  rotation_deg?: number;
};

/**
 * The turn of a route to keep with it: none for a route that does not say,
 * or that is upright. What does not read as degrees is as none.
 */
export function turnOf(route: {
  rotation_deg?: unknown;
}): Pick<RecommendedRouteDetail, "rotation_deg"> {
  const turn = route.rotation_deg;
  return typeof turn === "number" && Number.isFinite(turn) && turn !== 0
    ? { rotation_deg: turn }
    : {};
}

/** "Near you" (TASK-092, variant C): a start a short run away. */
export const NEAR_RADIUS_M = 5000;

export type ListOutcome =
  { kind: "routes"; routes: RecommendedRoute[] } | { kind: "failed" };

export type DetailOutcome =
  { kind: "route"; route: RecommendedRouteDetail } | { kind: "failed" };

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

export function recommendedUrl(
  baseUrl: string,
  near: LatLon,
  radiusM: number = NEAR_RADIUS_M,
): string {
  return `${baseUrl}/recommended-routes?${nearParams(near)}&radius_m=${radiusM}`;
}

/**
 * How far each route is from the real `near`: the API was told about a
 * kilometre (TASK-363), so its `away_m` is measured from the rounded point.
 */
export function measuredFrom(
  near: LatLon,
  routes: RecommendedRoute[],
): RecommendedRoute[] {
  return routes.map((route) => ({
    ...route,
    away_m: Math.round(metresBetween(near, route.start)),
  }));
}

/** The routes near `near`, the best first. Never throws. */
export async function fetchRecommended(
  baseUrl: string,
  near: LatLon,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<ListOutcome> {
  try {
    const response = await fetchFn(recommendedUrl(baseUrl, near), {
      headers: keyHeaders(key),
      signal,
    });
    const body: unknown = await response.json();
    return response.ok && isRecommendedList(body)
      ? { kind: "routes", routes: measuredFrom(near, body.routes) }
      : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

/** One route whole. Never throws. */
export async function fetchRecommendedRoute(
  baseUrl: string,
  id: string,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<DetailOutcome> {
  try {
    const response = await fetchFn(
      `${baseUrl}/recommended-routes/${encodeURIComponent(id)}`,
      { headers: keyHeaders(key), signal },
    );
    const body: unknown = await response.json();
    return response.ok && isRecommendedDetail(body)
      ? { kind: "route", route: body }
      : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isLine(value: unknown, min: number): value is LatLon[] {
  return Array.isArray(value) && value.length >= min && value.every(isPoint);
}

function stringOrNull(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function hasRouteFields(r: Record<string, unknown>): boolean {
  return (
    typeof r.id === "string" &&
    typeof r.city === "string" &&
    stringOrNull(r.shape) &&
    stringOrNull(r.word) &&
    stringOrNull(r.style) &&
    // One of the two, as in a route request.
    (typeof r.shape === "string") !== (typeof r.word === "string") &&
    typeof r.distance_m === "number" &&
    typeof r.route_m === "number" &&
    typeof r.similarity === "number"
  );
}

export function isRecommendedList(
  body: unknown,
): body is { routes: RecommendedRoute[] } {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const routes = (body as Record<string, unknown>).routes;
  return (
    Array.isArray(routes) &&
    routes.every((route: unknown) => {
      if (typeof route !== "object" || route === null) {
        return false;
      }
      const r = route as Record<string, unknown>;
      return (
        hasRouteFields(r) &&
        isPoint(r.start) &&
        typeof r.away_m === "number" &&
        isLine(r.preview, 2)
      );
    })
  );
}

export function isRecommendedDetail(body: unknown): body is RecommendedRouteDetail {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const r = body as Record<string, unknown>;
  return hasRouteFields(r) && isLine(r.points, 2) && typeof r.license === "string";
}

/**
 * What a route draws, as the user reads it: "heart", "CIAO"; the shape in
 * the app's language, «Herz» (TASK-210 F).
 */
export function routeTitle(route: {
  shape: string | null;
  word: string | null;
}): string {
  return route.word ?? shapeWord(route.shape ?? "");
}

/** The cities of the catalogue whose name is two words: its files have one. */
const TWO_WORDS: Record<string, string> = {
  newyork: "New York",
  sanfrancisco: "San Francisco",
};

/** The city as the user reads it: "milano" → "Milano", "newyork" → "New York". */
export function cityName(city: string): string {
  return TWO_WORDS[city] ?? city.charAt(0).toUpperCase() + city.slice(1);
}
