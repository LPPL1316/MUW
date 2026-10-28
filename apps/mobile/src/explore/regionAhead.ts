import type { LatLon, RouteRequest, Shape } from "@shaperoute/shared-types";
import { useEffect } from "react";

import { type KeptOutcome, queueOutcome, requestKeptRoutes } from "../api/keptRoutes";
import { type RouteQueue, routeQueue } from "../api/routeQueue";
import { metresBetween } from "../map/coordinates";
import type { Place } from "../places/photon";
import {
  asRecommended,
  asWord,
  cityKey,
  drawOrderOf,
  EXAMPLE_WORDS,
  examplesKey,
  type ExampleDetail,
  readyExample,
  readyWord,
  requestOf,
  RUN_EXAMPLES,
  takeAhead,
  wordOrder,
  wordRequestOf,
} from "./exampleRoutes";
import { fetchNearbyCities } from "./nearbyCities";
import { KEEP_MS, townEntry, townRoutes, writeTown } from "./regionStore";

/**
 * The examples of the towns near the start and of the region, taken ahead
 * of «Explore» (TASK-316, ADR-0276; the user's request of 2026-10-27): for
 * each town, all its examples the API already keeps, in one request, so
 * that the town opens with its cards ready. Never one the API has not
 * drawn: what it does not keep is drawn when the town is tapped, as before,
 * and a phone never has the server draw nor download a zone for a town
 * nobody chose.
 *
 * The towns near first, then those around them: GET /nearby-cities from
 * each of their points, the nearest to the start first. Each request waits
 * behind everything else in the app's queue ("prefetch"). What comes is
 * written in the town's file (regionStore.ts), for days.
 */

/** The towns near and of the region, in all. */
export const REGION_TOWNS = 18;
/** The routes taken from the API in a run of the app, at most. */
export const MAX_ROUTES = 150;
/** A town with all its examples is asked again after this: its file is not
 * read any more (regionStore.ts). */
export const FRESH_MS = KEEP_MS;
/** A town the API had not all of, after this: it may have drawn more. */
export const AGAIN_MS = 24 * 3600_000;

// The routes taken in this run of the app, and the API that said it has no
// POST /kept-routes: neither is asked again until the app starts again.
let taken = 0;
let notHere: string | null = null;
let running: AbortController | null = null;

type Asked = { name: string; request: RouteRequest; shape?: Shape; word?: string };

/** A town's examples, as its page asks them: the shapes, then the words. */
function examplesOf(town: Place): Asked[] {
  return [
    ...drawOrderOf(RUN_EXAMPLES).map((shape) => ({
      name: shape,
      shape,
      request: requestOf(town, shape, RUN_EXAMPLES),
    })),
    ...wordOrder(EXAMPLE_WORDS).map((word) => ({
      name: `word:${word}`,
      word,
      request: wordRequestOf(town, word, RUN_EXAMPLES),
    })),
  ];
}

/** How many examples a town has: eight shapes and six words. */
const EXAMPLES = drawOrderOf(RUN_EXAMPLES).length + EXAMPLE_WORDS.length;

/** Whether a town was asked recently enough not to ask it now. */
function recent(key: string, now: number): boolean {
  const entry = townEntry(key, now);
  if (entry === null) {
    return false;
  }
  return now - entry.at < (entry.has.length >= EXAMPLES ? FRESH_MS : AGAIN_MS);
}

/** What a kept route draws, as `Asked.name` says it. */
function nameOf(detail: unknown): string | null {
  if (typeof detail !== "object" || detail === null) {
    return null;
  }
  const { shape, word } = detail as Partial<ExampleDetail>;
  return typeof shape === "string"
    ? shape
    : typeof word === "string"
      ? `word:${word}`
      : null;
}

export type RegionOptions = {
  request?: typeof requestKeptRoutes;
  fetchTowns?: typeof fetchNearbyCities;
  /** The app's `fetch`, for both; injected in tests. */
  fetchFn?: typeof fetch;
  queue?: Pick<RouteQueue, "background">;
  /** Told once, when the towns near are done or the round ends before:
   * what was asked of them is in their files. */
  onNearby?: () => void;
};

/** For tests: nothing taken, every API asked again, nothing running. */
export function forgetRegion(): void {
  running?.abort();
  running = null;
  taken = 0;
  notHere = null;
}

/**
 * Takes ahead the examples of `nearby`, the towns near `start`, then of the
 * region; never throws. It goes on until done, until MAX_ROUTES, or until
 * the returned function is called: the next call goes on from the files.
 * Trouble with the API (no network, too many requests, an API without the
 * endpoint) ends it: the next call tries again, the last one never.
 */
export function prepareRegion(
  apiUrl: string,
  start: LatLon,
  nearby: readonly Place[],
  {
    request = requestKeptRoutes,
    fetchTowns = fetchNearbyCities,
    fetchFn,
    queue = routeQueue,
    onNearby,
  }: RegionOptions = {},
): () => void {
  running?.abort();
  const controller = new AbortController();
  running = controller;
  const { signal } = controller;

  /** One town; false when nothing more is to be asked now. */
  const takeTown = async (town: Place): Promise<boolean> => {
    if (taken >= MAX_ROUTES || notHere === apiUrl) {
      return false;
    }
    const key = examplesKey(town.point);
    if (recent(key, Date.now())) {
      return true;
    }
    const all = examplesOf(town);
    const missing = all.filter(({ shape, word }) =>
      shape !== undefined
        ? readyExample(town, shape) === null
        : readyWord(town, word ?? "") === null,
    );
    if (missing.length === 0) {
      return true;
    }
    // Set by the request, once its turn comes.
    let answer = { kind: "cancelled" } as KeptOutcome;
    await queue.background(
      "prefetch",
      async () => {
        answer = await request(
          apiUrl,
          missing.map((m) => m.request),
          { signal, fetchFn },
        );
        return queueOutcome(answer);
      },
      { signal },
    );
    if (signal.aborted || answer.kind !== "kept") {
      if (answer.kind === "not_here") {
        notHere = apiUrl;
      }
      return false;
    }
    const routes = answer.routes;
    const got: ExampleDetail[] = [];
    missing.forEach(({ shape, word }, i) => {
      const result = routes[i];
      if (result === null || result === undefined) {
        return;
      }
      got.push(
        shape !== undefined
          ? asRecommended(town, shape, result).detail
          : asWord(town, word ?? "", result).detail,
      );
    });
    taken += got.length;
    const asked = new Set(missing.map((m) => m.name));
    const came = new Set(got.map(nameOf));
    // What the file had of the others stays beside what came.
    const before = townRoutes(key).filter((d) => {
      const name = nameOf(d);
      return name !== null && !asked.has(name);
    });
    // Ready now: those not asked were ready already.
    const has = all.map((a) => a.name).filter((n) => !asked.has(n) || came.has(n));
    writeTown(key, [...before, ...got], { at: Date.now(), has });
    takeAhead(town);
    return true;
  };

  let told = false;
  const nearbyDone = () => {
    if (!told) {
      told = true;
      onNearby?.();
    }
  };
  void (async () => {
    for (const town of nearby) {
      if (!(await takeTown(town)) || signal.aborted) {
        return;
      }
    }
    nearbyDone();
    const seen = new Set(nearby.map((town) => cityKey(town.point)));
    const region: Place[] = [];
    for (const town of nearby) {
      const around = await fetchTowns(apiUrl, town.point, { signal, fetchFn });
      if (signal.aborted) {
        return;
      }
      for (const other of around ?? []) {
        if (!seen.has(cityKey(other.point))) {
          seen.add(cityKey(other.point));
          region.push(other);
        }
      }
    }
    region.sort(
      (a, b) => metresBetween(start, a.point) - metresBetween(start, b.point),
    );
    for (const town of region.slice(0, Math.max(0, REGION_TOWNS - nearby.length))) {
      if (!(await takeTown(town)) || signal.aborted) {
        return;
      }
    }
  })().finally(nearbyDone);
  return () => controller.abort();
}

/**
 * The region taken ahead while «Near me» shows `towns`: it goes on from
 * where the opening of the app left it, and stops when the page leaves.
 */
export function useRegionAhead(
  apiUrl: string | null,
  start: LatLon | null,
  towns: readonly Place[],
  fetchFn?: typeof fetch,
): void {
  const keys = towns.map((town) => cityKey(town.point)).join(" ");
  const lat = start?.[0];
  const lon = start?.[1];
  useEffect(() => {
    if (
      apiUrl === null ||
      lat === undefined ||
      lon === undefined ||
      towns.length === 0
    ) {
      return;
    }
    return prepareRegion(apiUrl, [lat, lon], towns, { fetchFn });
    // The towns' points are the key: a new array of the same towns is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, lat, lon, keys, fetchFn]);
}
