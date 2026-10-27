import type { LatLon } from "@shaperoute/shared-types";

import { type RouteQueue, routeQueue } from "../api/routeQueue";
import { fetchNearbyCities } from "./nearbyCities";
import { drawSamples } from "./nearbySamples";
import { fetchRecommended, type RecommendedRoute } from "./recommendedRoutes";

/**
 * «Explore» prepared as the app opens (TASK-306, ADR-0266; the user's
 * request of 2026-10-26): with the start known, before the page is opened,
 * the routes near the start, the towns near it and their examples, as the
 * page asks them. Opened, it has them at once: the list kept here, the
 * towns kept by fetchNearbyCities, their shapes by the samples' store.
 *
 * The examples of the towns wait behind everything else in the app's queue
 * of route requests ("prefetch"): the user's routes and the shapes of the
 * page on screen go first.
 */

/** A list fetched ahead stands in for the page's own this long: then the
 * page asks again, for what was published meanwhile. */
export const LIST_FRESH_MS = 10 * 60_000;

// The routes near each start, as «Explore» would have fetched them, and
// when.
const lists = new Map<string, { routes: RecommendedRoute[]; at: number }>();

/** The key of a start's list, as «Explore» writes it. */
export function listKey(apiUrl: string, near: LatLon): string {
  return `${apiUrl} ${near[0]},${near[1]}`;
}

/** The routes near a start fetched ahead, while they are fresh. */
export function listAhead(
  key: string,
  now: number = Date.now(),
): RecommendedRoute[] | undefined {
  const kept = lists.get(key);
  return kept !== undefined && now - kept.at < LIST_FRESH_MS ? kept.routes : undefined;
}

/** For tests: nothing fetched ahead. */
export function forgetExploreAhead(): void {
  lists.clear();
}

/** The app's queue, the examples behind those of the page on screen. */
const AHEAD_QUEUE: Pick<RouteQueue, "background"> = {
  background: (_priority, run, options) =>
    routeQueue.background("prefetch", run, options),
};

export type AheadOptions = {
  fetchList?: typeof fetchRecommended;
  fetchTowns?: typeof fetchNearbyCities;
  draw?: typeof drawSamples;
  queue?: Pick<RouteQueue, "background">;
  now?: () => number;
};

/**
 * Prepares «Explore» around `near`; never throws. The list is fetched once
 * a start; the towns' examples go on until done or until the returned
 * function is called, as when «Explore» opens and draws them itself.
 */
export function prepareExplore(
  apiUrl: string,
  near: LatLon,
  {
    fetchList = fetchRecommended,
    fetchTowns = fetchNearbyCities,
    draw = drawSamples,
    queue = AHEAD_QUEUE,
    now = Date.now,
  }: AheadOptions = {},
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  let stopSamples: (() => void) | null = null;
  void (async () => {
    const key = listKey(apiUrl, near);
    if (listAhead(key, now()) === undefined) {
      const outcome = await fetchList(apiUrl, near, { signal });
      if (signal.aborted) {
        return;
      }
      if (outcome.kind === "routes") {
        lists.set(key, { routes: outcome.routes, at: now() });
      }
    }
    const towns = await fetchTowns(apiUrl, near, { signal });
    if (signal.aborted || towns === null || towns.length === 0) {
      return;
    }
    stopSamples = draw(apiUrl, towns, { queue });
  })();
  return () => {
    controller.abort();
    stopSamples?.();
  };
}
