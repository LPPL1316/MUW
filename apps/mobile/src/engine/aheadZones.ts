import type { LatLon } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";

import { searchCities } from "../explore/cities";
import { fetchNearbyCities } from "../explore/nearbyCities";
import { FEATURED_CITIES } from "../explore/presets";
import { loadRecentCities } from "../explore/recentCities";
import { metresBetween } from "../map/coordinates";
import type { Place } from "../places/photon";
import { DAY_MS, prefetchPausedUntil } from "./prefetch";
import {
  coveringZone,
  downloadZone,
  type Network,
  SPACE_LIMIT_BYTES,
  savedBytes,
  savedZones,
} from "./zones";

/**
 * The zones downloaded ahead (TASK-214 part B2, ADR-0177; the user's choice
 * 4, point 2): after the zones around the phone, slowly, one at a time, the
 * zones of the cities the user may draw in next, up to 2 GB. First the
 * towns near the phone (GET /nearby-cities, TASK-236), then the cities
 * chosen last in «Explore», then its featured cities, nearest first.
 * Only the network of the sport of «Settings». Without a notice, on any
 * network (the user's choices of 2026-10-03).
 *
 * A city a saved zone already holds is not asked again: its zone is brought
 * up to date the day the phone opens there, as the zone around it. Each
 * zone goes with `prefetch=1`, against the server's cap of the day: after a
 * 429 nothing more until Retry-After (part A2). A whole round ends at most
 * once a day; one cut short goes on at the next opening.
 */

/** Room kept for the zone around the phone: a zone ahead never takes the
 * last of the 2 GB, the largest zones are ~30 MB. */
export const AHEAD_ROOM_BYTES = 100_000_000;

/** The featured cities' centres and labels, as GET /cities gave them
 * (they do not move), and when the last whole round ended, in ms since
 * 1970. «Explore» opens a featured city from here too (TASK-287). */
export type AheadState = {
  centres: Record<string, LatLon>;
  labels: Record<string, string>;
  doneAt: number;
};

export type AheadOutcome =
  /** Every city asked, or held by a saved zone: nothing until tomorrow. */
  | "done"
  /** A whole round ended less than a day ago. */
  | "lately"
  /** The server's cap of the day, or the phone's pause after it. */
  | "later"
  /** Close to 2 GB: nothing more ahead. */
  | "full"
  /** A download failed, or a centre did not come: again next opening. */
  | "stopped"
  /** A round is going already. */
  | "busy";

function stateFile(): File {
  return new File(Paths.document, "engine", "ahead.json");
}

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

/** What the phone keeps for the zones ahead; nothing when it does not
 * read. Beside the zones, not among them: «Delete» leaves it. */
export function readAhead(): AheadState {
  try {
    const file = stateFile();
    if (!file.exists) {
      return { centres: {}, labels: {}, doneAt: 0 };
    }
    const data: unknown = JSON.parse(file.textSync());
    const state = typeof data === "object" && data !== null ? data : {};
    const centres: Record<string, LatLon> = {};
    if (
      "centres" in state &&
      typeof state.centres === "object" &&
      state.centres !== null
    ) {
      for (const [name, point] of Object.entries(state.centres)) {
        if (isPoint(point)) {
          centres[name] = [point[0], point[1]];
        }
      }
    }
    const labels: Record<string, string> = {};
    if (
      "labels" in state &&
      typeof state.labels === "object" &&
      state.labels !== null
    ) {
      for (const [name, label] of Object.entries(state.labels)) {
        if (typeof label === "string") {
          labels[name] = label;
        }
      }
    }
    const doneAt =
      "doneAt" in state && typeof state.doneAt === "number" ? state.doneAt : 0;
    return { centres, labels, doneAt };
  } catch {
    return { centres: {}, labels: {}, doneAt: 0 };
  }
}

function saveAhead(state: AheadState): void {
  try {
    const file = stateFile();
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(state));
  } catch {
    // The centres are asked again, the round runs again: nothing breaks.
  }
}

/**
 * A featured city as GET /cities gave it, when the phone has it: «Explore»
 * opens its chip at once, without asking again (TASK-287). Null for a city
 * never asked, or kept before its label was.
 */
export function featuredPlace(name: string): Place | null {
  const { centres, labels } = readAhead();
  const point = centres[name];
  const label = labels[name];
  return point === undefined || label === undefined ? null : { label, point };
}

/** Keeps a featured city as GET /cities gave it, for the round of zones
 * ahead and for its chip in «Explore». */
export function keepFeaturedPlace(name: string, place: Place): void {
  const state = readAhead();
  state.centres[name] = place.point;
  state.labels[name] = place.label;
  saveAhead(state);
}

/** Where to download ahead, in order: the towns near `here`, nearest first
 * as the API gives them, the cities chosen last, as «Explore» keeps them,
 * then the featured ones, nearest to `here` first. */
export function aheadPoints(
  here: LatLon,
  nearby: readonly Place[],
  recent: readonly Place[],
  featured: readonly LatLon[],
): LatLon[] {
  const byDistance = [...featured].sort(
    (a, b) => metresBetween(here, a) - metresBetween(here, b),
  );
  return [
    ...nearby.map((place) => place.point),
    ...recent.map((place) => place.point),
    ...byDistance,
  ];
}

let running = false;

/**
 * One round of zones ahead of `network`, from `here`; never throws. The
 * centres of the featured cities come from GET /cities the first time, or
 * from a tap on their chip in «Explore», then from the phone. Without an answer
 * from GET /nearby-cities (a server before TASK-236, no Geoapify) the round
 * goes on without the towns near: they come with tomorrow's round.
 */
export async function downloadAhead(
  baseUrl: string,
  here: LatLon,
  network: Network,
  {
    now = Date.now,
    download = downloadZone,
    search = searchCities,
    recent = loadRecentCities,
    nearby = fetchNearbyCities,
  }: {
    now?: () => number;
    download?: typeof downloadZone;
    search?: typeof searchCities;
    recent?: () => Place[];
    nearby?: (baseUrl: string, near: LatLon) => Promise<Place[] | null>;
  } = {},
): Promise<AheadOutcome> {
  if (running) {
    return "busy";
  }
  running = true;
  try {
    const state = readAhead();
    const since = now() - state.doneAt;
    if (state.doneAt > 0 && since >= 0 && since < DAY_MS) {
      return "lately";
    }
    if (now() < prefetchPausedUntil()) {
      return "later";
    }
    const near = (await nearby(baseUrl, here)) ?? [];
    let whole = true;
    for (const name of FEATURED_CITIES) {
      // A centre kept before the labels is asked again, once: its chip in
      // «Explore» needs the label too.
      if (state.centres[name] === undefined || state.labels[name] === undefined) {
        const found = await search(baseUrl, name);
        if (found === null) {
          whole = false;
        } else if (found.length > 0) {
          state.centres[name] = found[0].point;
          state.labels[name] = found[0].label;
          keepFeaturedPlace(name, found[0]);
        }
      }
    }
    const featured = FEATURED_CITIES.flatMap((name) => {
      const centre = state.centres[name];
      return centre === undefined ? [] : [centre];
    });
    for (const point of aheadPoints(here, near, recent(), featured)) {
      if (coveringZone(savedZones(), network, point) !== null) {
        continue;
      }
      if (savedBytes() > SPACE_LIMIT_BYTES - AHEAD_ROOM_BYTES) {
        return "full";
      }
      const answer = await download(baseUrl, network, point, { now, prefetch: true });
      if (answer.kind === "later") {
        return "later";
      }
      if (answer.kind === "failed") {
        return "stopped";
      }
    }
    if (!whole) {
      return "stopped";
    }
    // As the file is now: «Explore» may have kept a city meanwhile.
    saveAhead({ ...readAhead(), doneAt: now() });
    return "done";
  } catch {
    return "stopped";
  } finally {
    running = false;
  }
}
