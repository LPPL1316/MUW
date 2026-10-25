import type { LatLon, Shape } from "@shaperoute/shared-types";
import { AppState } from "react-native";

import { type RouteQueue, routeQueue } from "../api/routeQueue";
import { requestRoute } from "../api/routes";
import {
  asRecommended,
  drawOrderOf,
  type ExampleDetail,
  examplesKey,
  fileStorage,
  readKept,
  requestOf,
  type Storage,
} from "../explore/exampleRoutes";
import type { Place } from "../places/photon";
import { readAheadFile, writeAheadFile } from "./aheadStore";
import { type HomeArea, loadHomeArea } from "./homeArea";
import {
  byName,
  examplesAt,
  NEAR_ME_M,
  WATER_SPOTS,
  type WaterSpot,
} from "./waterSpots";

/**
 * The shapes on the water drawn ahead (TASK-246, ADR-0211; the user's
 * request and choice of 2026-10-05): at each opening of the app, after the
 * maps around the phone, the eight shapes of the three places nearest it,
 * asked of the API one after the other and kept on the phone, so that
 * «Explore» with «Paddle» shows them at once. Whatever the sport of
 * «Settings», without a notice, on any network.
 *
 * Only what the phone misses is asked: a place whose shapes came with the
 * app, or were drawn before, costs nothing. A shape the API could not draw
 * there is not asked again for a week. Trouble that is not a shape's (no
 * network, too many requests) ends the round: it goes on at the next
 * opening. With the app in the background nothing is asked: the round
 * waits for it to come back.
 */

/** The places whose shapes are drawn ahead, the nearest first. */
export const PLACES_AHEAD = 3;
/**
 * How often a round looks again whether the app is back in front. Each
 * request waits for its turn in the app's queue of route requests
 * (TASK-287, routeQueue.ts), after the user's and the page's: at most ten
 * a minute, as before, all of the app's counted.
 */
export const IN_FRONT_CHECK_MS = 6000;
/** A shape the API could not draw in a place is asked again after this:
 * the engine or the water may be newer. */
export const LEFT_OUT_MS = 7 * 24 * 3600 * 1000;
/** The places the file keeps, the last drawn first: someone who travels
 * does not fill the phone. */
export const MAX_PLACES_KEPT = 6;

export type ShapesOutcome =
  /** Every shape of every place is on the phone, or left out. */
  | "done"
  /** A request failed for a reason that is not the shape's. */
  | "stopped"
  /** A round is going already. */
  | "busy";

/** The places nearest `here`, one a name, as «Explore» offers them. */
export function placesAhead(
  here: LatLon,
  spots: readonly WaterSpot[] = WATER_SPOTS,
): WaterSpot[] {
  return byName(spots, here)
    .filter(({ away_m }) => (away_m ?? Infinity) <= NEAR_ME_M)
    .slice(0, PLACES_AHEAD)
    .map(({ spot }) => spot);
}

/** Whether the app is in front: a moment «inactive» (a call, the Control
 * Centre) still is. */
function inFront(): boolean {
  return AppState.currentState !== "background";
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `detail` added to the file, its place first, the oldest places out. */
function keepAhead(key: string, detail: ExampleDetail): void {
  const file = readAheadFile();
  const had = readKept({ [key]: file.examples[key] })[key] ?? [];
  const keys = [key, ...Object.keys(file.examples).filter((k) => k !== key)].slice(
    0,
    MAX_PLACES_KEPT,
  );
  const examples: Record<string, unknown> = {};
  for (const k of keys) {
    examples[k] =
      k === key
        ? [...had.filter((d) => d.shape !== detail.shape), detail]
        : file.examples[k];
  }
  writeAheadFile({ examples, leftOut: file.leftOut });
}

function leaveOut(key: string, shape: Shape, at: number): void {
  const file = readAheadFile();
  writeAheadFile({
    examples: file.examples,
    leftOut: { ...file.leftOut, [key]: { ...file.leftOut[key], [shape]: at } },
  });
}

let running = false;

/**
 * One round of shapes ahead; never throws. The places are those nearest
 * the home area the phone keeps (TASK-269), as «Explore» suggests them;
 * without one, those nearest `here`. A shape the page of «Explore» drew
 * meanwhile is not asked again: the phone's files are read before each
 * request.
 */
export async function drawShapesAhead(
  apiUrl: string,
  here: LatLon,
  {
    request = requestRoute,
    storage = fileStorage,
    spots = WATER_SPOTS,
    home = loadHomeArea,
    now = Date.now,
    wait = pause,
    active = inFront,
    queue = routeQueue,
  }: {
    request?: typeof requestRoute;
    storage?: Storage;
    spots?: readonly WaterSpot[];
    home?: () => HomeArea | null;
    now?: () => number;
    wait?: (ms: number) => Promise<void>;
    active?: () => boolean;
    queue?: Pick<RouteQueue, "background">;
  } = {},
): Promise<ShapesOutcome> {
  if (running) {
    return "busy";
  }
  running = true;
  try {
    const from = home()?.point ?? here;
    for (const spot of placesAhead(from, spots)) {
      const set = examplesAt(spot.distance_m);
      const key = examplesKey(spot.point, set);
      const place: Place = { label: spot.name, point: spot.point };
      for (const shape of drawOrderOf(set)) {
        const asked = requestOf(place, shape, set);
        const file = readAheadFile();
        // As the page reads them (`fromFile`): the first of a shape counts.
        const kept = [
          ...(set.bundled?.[key] ?? []),
          ...(readKept({ [key]: file.examples[key] })[key] ?? []),
          ...(storage.load()[key] ?? []),
        ].find((d) => d.shape === shape);
        if (
          kept !== undefined &&
          kept.alternatives !== undefined &&
          !("pen_up" in asked && kept.walks === undefined)
        ) {
          continue;
        }
        const leftAt = file.leftOut[key]?.[shape];
        if (leftAt !== undefined && now() - leftAt < LEFT_OUT_MS && now() >= leftAt) {
          continue;
        }
        while (!active()) {
          await wait(IN_FRONT_CHECK_MS);
        }
        const outcome = await queue.background("prefetch", () =>
          request(apiUrl, asked),
        );
        if (outcome.kind === "route") {
          keepAhead(key, asRecommended(place, shape, outcome.result, set).detail);
        } else if (
          outcome.kind === "api_error" &&
          outcome.code === "shape_not_drawable"
        ) {
          leaveOut(key, shape, now());
        } else if (
          outcome.kind === "api_error" &&
          outcome.code === "map_data_unavailable"
        ) {
          // No water of this place on the server: the next place.
          break;
        } else {
          return "stopped";
        }
      }
    }
    return "done";
  } catch {
    return "stopped";
  } finally {
    running = false;
  }
}
