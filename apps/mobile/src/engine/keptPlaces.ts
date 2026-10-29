import type { LatLon } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";

import { apiKey as configuredKey, keyHeaders } from "../api/apiUrl";
import { PHONE_HEADER, phoneId, retryAt } from "./prefetch";
import {
  AROUND_MARGIN_M,
  deleteZone,
  downloadZone,
  type Network,
  savedZones,
} from "./zones";

/**
 * The places the user keeps on the phone (TASK-334, ADR-0290): in
 * «Settings» → «Offline maps», «Add a place» finds a town by name, and the
 * zone around it is downloaded and kept, so shapes there are drawn on the
 * phone, even without signal. The user's choice of 2026-10-29.
 *
 * For each place the phone asks POST /phone-zones/{network}/places: `ready`
 * when the server has the zone, and the phone downloads it as the zone
 * around itself (AROUND_MARGIN_M); `preparing` while the server downloads
 * it, and the phone asks again (ASK_AGAIN_MS while «Settings» is open, and
 * at each opening of the app). After a 429 (three new places a day) or a
 * 503 (Overpass refused) it waits for Retry-After. A server without the
 * places answers 404: the phone then downloads what it has there, if any.
 *
 * The zones of kept places are out of the 2 GB and never deleted by
 * themselves (`ZoneEntry.kept`): only removing the place, or «Delete».
 * The list is in `Documents/engine/places.json`, beside the zones.
 */

/** The user's choice of 2026-10-29: at most ten places. */
export const MAX_PLACES = 10;
/** How often «Settings» asks again for a place being prepared. */
export const ASK_AGAIN_MS = 30_000;
/** A server with no zone there and no way to prepare it (one before
 * TASK-334), or one that refused for another reason: asked again after
 * this. */
export const LATER_MS = 60 * 60_000;

export type PlaceStatus =
  /** Its zone is on the phone. */
  | "ready"
  /** The server is preparing it, or the phone is downloading it. */
  | "preparing"
  /** Not now: the day's places are over, Overpass refused, or the server
   * has no zone there yet; asked again later. */
  | "later";

export type KeptPlace = {
  /** What the search gave, e.g. "Levico Terme, Trentino". */
  label: string;
  point: LatLon;
  /** The sport's network when the place was added. */
  network: Network;
  /** The zone file downloaded for it; null before. */
  zone: string | null;
  status: PlaceStatus;
  /** Not asked again before this, in ms since 1970 (after 429 or 503). */
  waitUntil: number;
};

export type AddOutcome = "added" | "already" | "full";

function placesFile(): File {
  return new File(Paths.document, "engine", "places.json");
}

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

function isPlace(value: unknown): value is KeptPlace {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const place = value as Record<string, unknown>;
  return (
    typeof place.label === "string" &&
    isPoint(place.point) &&
    (place.network === "foot" || place.network === "bike") &&
    (place.zone === null || typeof place.zone === "string") &&
    (place.status === "ready" ||
      place.status === "preparing" ||
      place.status === "later") &&
    typeof place.waitUntil === "number"
  );
}

/** The places kept, in the order they were added; none when the file does
 * not read. A place whose zone is gone shows as being prepared again. */
export function readPlaces(): KeptPlace[] {
  try {
    const file = placesFile();
    if (!file.exists) {
      return [];
    }
    const data: unknown = JSON.parse(file.textSync());
    const places =
      typeof data === "object" &&
      data !== null &&
      "places" in data &&
      Array.isArray(data.places)
        ? data.places.filter(isPlace)
        : [];
    const zones = new Set(savedZones().map((zone) => zone.name));
    return places.map((place) =>
      place.status === "ready" && (place.zone === null || !zones.has(place.zone))
        ? { ...place, zone: null, status: "preparing" as const }
        : place,
    );
  } catch {
    return [];
  }
}

const watchers = new Set<() => void>();

/** Calls `watcher` each time the places change, until the call it returns. */
export function watchPlaces(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

function savePlaces(places: readonly KeptPlace[]): void {
  try {
    const file = placesFile();
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify({ places }));
  } catch {
    // Asked again at the next opening; nothing breaks.
  }
  for (const watcher of watchers) {
    watcher();
  }
}

function samePoint([a, b]: LatLon, [c, d]: LatLon): boolean {
  return Math.abs(a - c) < 1e-5 && Math.abs(b - d) < 1e-5;
}

/** Adds a place to keep, for `network`; it is asked for at the next
 * `keepPlaces`. */
export function addPlace(label: string, point: LatLon, network: Network): AddOutcome {
  const places = readPlaces();
  if (
    places.some((place) => place.network === network && samePoint(place.point, point))
  ) {
    return "already";
  }
  if (places.length >= MAX_PLACES) {
    return "full";
  }
  savePlaces([
    ...places,
    { label, point, network, zone: null, status: "preparing", waitUntil: 0 },
  ]);
  return "added";
}

/** Removes the place at `index`, with its zone when no other place keeps
 * it. */
export function removePlace(index: number): void {
  const places = readPlaces();
  const gone = places[index];
  if (gone === undefined) {
    return;
  }
  const left = places.filter((_, at) => at !== index);
  savePlaces(left);
  if (gone.zone !== null && !left.some((place) => place.zone === gone.zone)) {
    deleteZone(gone.zone);
  }
}

/** Forgets every place («Delete» in «Settings», with the zones). */
export function forgetPlaces(): void {
  savePlaces([]);
}

type KeepOptions = {
  apiKey?: string | null;
  fetchFn?: typeof fetch;
  download?: typeof downloadZone;
  now?: () => number;
};

let running: Promise<void> | null = null;

/**
 * Asks the server for each place not on the phone yet, one at a time, and
 * downloads those it has ready. A call while one is going waits for that
 * one. Never throws: a place that did not come is asked again next time.
 */
export function keepPlaces(baseUrl: string, options: KeepOptions = {}): Promise<void> {
  if (running === null) {
    running = keepAll(baseUrl, options).finally(() => {
      running = null;
    });
  }
  return running;
}

async function keepAll(
  baseUrl: string,
  {
    apiKey = configuredKey(),
    fetchFn = fetch,
    download = downloadZone,
    now = Date.now,
  }: KeepOptions,
): Promise<void> {
  for (const place of readPlaces()) {
    if (place.status === "ready" || now() < place.waitUntil) {
      continue;
    }
    const next = await keepOne(baseUrl, place, { apiKey, fetchFn, download, now });
    if (next === null) {
      return; // no answer: offline, the others would not come either
    }
    // Saved over the list as it is now: the user may have removed it.
    const places = readPlaces();
    const at = places.findIndex(
      (each) => each.network === place.network && samePoint(each.point, place.point),
    );
    if (at >= 0) {
      places[at] = { ...places[at], ...next };
      savePlaces(places);
    }
  }
}

type Change = Pick<KeptPlace, "zone" | "status" | "waitUntil">;

async function keepOne(
  baseUrl: string,
  place: KeptPlace,
  {
    apiKey,
    fetchFn,
    download,
    now,
  }: Required<Pick<KeepOptions, "fetchFn" | "download" | "now">> & {
    apiKey: string | null;
  },
): Promise<Change | null> {
  const [lat, lon] = place.point;
  let answer: Response;
  try {
    answer = await fetchFn(`${baseUrl}/phone-zones/${place.network}/places`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...keyHeaders(apiKey),
        [PHONE_HEADER]: phoneId(),
      },
      body: JSON.stringify({ lat, lon }),
    });
  } catch {
    return null;
  }
  if (answer.status === 202) {
    return { zone: null, status: "preparing", waitUntil: 0 };
  }
  if (answer.status === 429 || answer.status === 503) {
    return {
      zone: null,
      status: "later",
      waitUntil: retryAt(answer.headers.get("retry-after"), now()),
    };
  }
  // 200 ready; 404 from a server without the places, which may still have
  // a zone there.
  if (answer.status !== 200 && answer.status !== 404) {
    return { zone: null, status: "later", waitUntil: now() + LATER_MS };
  }
  const zone = await download(baseUrl, place.network, place.point, {
    apiKey,
    now,
    marginM: AROUND_MARGIN_M,
    kept: true,
  });
  if (zone.kind === "saved" || zone.kind === "unchanged") {
    return { zone: zone.zone.name, status: "ready", waitUntil: 0 };
  }
  if (zone.kind === "failed") {
    return { zone: null, status: "preparing", waitUntil: 0 };
  }
  return { zone: null, status: "later", waitUntil: now() + LATER_MS };
}
