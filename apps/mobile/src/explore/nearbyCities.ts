import type { LatLon } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "../api/apiUrl";
import { metresBetween } from "../map/coordinates";
import { nearParams, type Place } from "../places/photon";

/**
 * A town's photo (TASK-283, ADR-0243): where the API gives it, and the
 * credit its licence asks for, written on it; null when it asks for none.
 */
export type TownPhoto = { url: string; credit: string | null };

/** A town as the API gives it: a city, with its photo when it has one. */
type Town = Place & { photo?: TownPhoto };

/**
 * A town near the start (TASK-236): a city as the search gives it, its
 * label and its centre, and how far its centre is from the start, measured
 * on the phone (TASK-254): the API hears the start to about a kilometre.
 * With its photo, when it has one (TASK-283).
 */
export type NearbyCity = Town & { away_m: number };

/** As many as the API gives at most: four towns and the two places
 * nearest of all, however small. Six cards, never more. */
export const MAX_NEARBY = 6;

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

// The towns of each square asked in this run of the app, as the API gives
// them: «Explore» opened again, or the start moved a few metres, asks
// nothing; the distances are measured again from where the start is.
const known = new Map<string, Town[]>();

/** The towns with how far each is from `near`, the nearest first. */
function measured(near: LatLon, towns: readonly Town[]): NearbyCity[] {
  return towns
    .map((town) => ({ ...town, away_m: Math.round(metresBetween(near, town.point)) }))
    .sort((a, b) => a.away_m - b.away_m);
}

/** About 1 km, the square the API answers for (nearby_cities.py). */
export function nearbyKey(baseUrl: string, near: LatLon): string {
  return `${baseUrl} ${near[0].toFixed(2)},${near[1].toFixed(2)}`;
}

/** The towns already fetched around `near`, when they are. */
export function knownNearby(baseUrl: string, near: LatLon): NearbyCity[] | null {
  const towns = known.get(nearbyKey(baseUrl, near));
  return towns === undefined ? null : measured(near, towns);
}

/** For tests: as a new opening of the app. */
export function forgetNearby(): void {
  known.clear();
}

/** A place of the API's answer: a label and a point. Its `away_m` is
 * measured from the point the API received, about a kilometre off: the
 * phone measures its own (TASK-254). */
function isTown(value: unknown): value is Place & { photo?: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { label, point } = value as Record<string, unknown>;
  return (
    typeof label === "string" &&
    label.trim() !== "" &&
    Array.isArray(point) &&
    point.length === 2 &&
    point.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** A town's photo as the API gives it, when it reads: a path on the API
 * itself, never another host, and its credit or none. */
function photoOf(value: unknown): TownPhoto | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { url, credit } = value as Record<string, unknown>;
  if (typeof url !== "string" || !/^\/[^/]/.test(url)) {
    return null;
  }
  return { url, credit: typeof credit === "string" && credit.trim() ? credit : null };
}

/**
 * The towns near `near`, the nearest first, from the API's GET
 * /nearby-cities: at most four towns within 20 km, or up to 50 km where the
 * towns are few, and the two nearest places, villages too. How far each is
 * is measured here, from `near` as it is. Never throws: null when the API
 * does not answer, and nothing is kept then.
 */
export async function fetchNearbyCities(
  baseUrl: string,
  near: LatLon,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<NearbyCity[] | null> {
  const kept = knownNearby(baseUrl, near);
  if (kept !== null) {
    return kept;
  }
  try {
    // The square's worth of position, not the phone's (TASK-254): the API
    // looks around the square anyway, and measures `away_m` from the point.
    const response = await fetchFn(`${baseUrl}/nearby-cities?${nearParams(near)}`, {
      headers: keyHeaders(key),
      signal,
    });
    const body: unknown = await response.json();
    const places = (body as { places?: unknown } | null)?.places;
    if (!response.ok || !Array.isArray(places)) {
      return null;
    }
    const towns = places
      .filter(isTown)
      .slice(0, MAX_NEARBY)
      .map((town): Town => {
        const { label, point } = town;
        const photo = photoOf(town.photo);
        return photo === null ? { label, point } : { label, point, photo };
      });
    known.set(nearbyKey(baseUrl, near), towns);
    return measured(near, towns);
  } catch {
    return null;
  }
}
