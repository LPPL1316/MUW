import type { Activity, LatLon } from "@shaperoute/shared-types";
import { Directory, File, Paths } from "expo-file-system";
import {
  createDownloadResumable,
  type DownloadOptions,
  type FileSystemDownloadResult,
} from "expo-file-system/legacy";

import { apiKey as configuredKey, keyHeaders } from "../api/apiUrl";
import type { PageZone } from "./page";
import {
  PHONE_HEADER,
  pausePrefetch,
  phoneId,
  prefetchPausedUntil,
  retryAt,
} from "./prefetch";

/**
 * The zones saved on the phone for the engine on the phone (TASK-214,
 * ADR-0177): the road network of an area, as GET /phone-zones/{network}
 * gives it, in `Documents/engine/zones/`, under the name the API gives it
 * (the network and the area). An index beside them keeps each zone's ETag,
 * size and last use. Beyond SPACE_LIMIT_BYTES, the zones used longest ago
 * are deleted; those of the places the user keeps (TASK-334) never are, nor
 * count in it.
 */

/** The user's choice of 2026-10-03: up to 2 GB of zones on the phone. */
export const SPACE_LIMIT_BYTES = 2_000_000_000;
export const ZONE_SUFFIX = ".zone.json.gz";

export type Network = "foot" | "bike";

/** The network of each activity the phone draws: paddling is the
 * server's, it needs the water (TASK-214, choice 5). */
export const NETWORKS: Readonly<Partial<Record<Activity, Network>>> = {
  running: "foot",
  cycling: "bike",
};

export type ZoneEntry = {
  name: string;
  /** The ETag the API sent with it, to ask again with If-None-Match. */
  etag: string | null;
  bytes: number;
  /** When a route last used it, or it was saved, in ms since 1970; 0 for
   * a zone saved ahead that no route used yet, the first to go. */
  usedAt: number;
  /** The zone of a place the user keeps (TASK-334, `keptPlaces.ts`): out
   * of the limit, deleted only with the place or «Delete». */
  kept?: boolean;
};

export type ZoneArea = {
  network: Network;
  south: number;
  west: number;
  north: number;
  east: number;
};

const ENGINE_DIRECTORY = "engine";
const INDEX_FILE = "zones.json";
const NUMBER = String.raw`-?\d{1,3}\.\d{5}`;
// As phone_zones.zone_name writes it; nothing else is ever saved.
const ZONE_NAME = new RegExp(
  `^(foot|bike)_(${NUMBER})_(${NUMBER})_(${NUMBER})_(${NUMBER})\\.zone\\.json\\.gz$`,
);

export function zonesDirectory(): Directory {
  return new Directory(Paths.document, ENGINE_DIRECTORY, "zones");
}

/** The network and area of a zone file, null when `name` is not one. */
export function zoneArea(name: string): ZoneArea | null {
  const match = ZONE_NAME.exec(name);
  if (match === null) {
    return null;
  }
  const [south, west, north, east] = match.slice(2).map(Number);
  return { network: match[1] as Network, south, west, north, east };
}

/**
 * How much room the phone asks for around itself (part E): the zone the
 * server has with 6 km around the point, when it is small enough for the
 * phone, else the one with 3 km every phone gets. A route of up to 8 km
 * crops at most 3.8 km around its start: with 6 km it fits also from a
 * start 2 km away, chosen on the map; with 3 km, only from where the app
 * opened.
 */
export const AROUND_MARGIN_M = 6_000;

/** The ETags of the other zones the phone has around the point, beside
 * If-None-Match (part E). */
export const ZONE_TAGS_HEADER = "X-Zone-ETags";

/** The saved zones of `network` that hold `point`, the smallest first, as
 * the server picks its zones. */
export function coveringZones(
  zones: readonly ZoneEntry[],
  network: Network,
  [lat, lon]: LatLon,
): ZoneEntry[] {
  const found: { size: number; zone: ZoneEntry }[] = [];
  for (const zone of zones) {
    const area = zoneArea(zone.name);
    if (
      area !== null &&
      area.network === network &&
      area.south <= lat &&
      lat <= area.north &&
      area.west <= lon &&
      lon <= area.east
    ) {
      found.push({ size: (area.north - area.south) * (area.east - area.west), zone });
    }
  }
  return found.sort((a, b) => a.size - b.size).map(({ zone }) => zone);
}

/** At most this many zones go to the engine for a route: the page keeps
 * their files in its memory, 12 MB at most each (part E). */
export const ENGINE_ZONES = 3;

/** The zones for the engine around `point`, the smallest first: Python
 * draws on the smallest that holds the whole route (PhoneZones), so a
 * route too wide for the zone around the phone may fit in a wider one. */
export function zonesForEngine(
  zones: readonly ZoneEntry[],
  network: Network,
  point: LatLon,
): PageZone[] {
  return coveringZones(zones, network, point)
    .slice(0, ENGINE_ZONES)
    .map((zone) => ({
      name: zone.name,
      uri: zoneUri(zone),
      version: zone.etag ?? String(zone.bytes),
    }));
}

/** The smallest saved zone of `network` that holds `point`; null when none
 * does. */
export function coveringZone(
  zones: readonly ZoneEntry[],
  network: Network,
  point: LatLon,
): ZoneEntry | null {
  return coveringZones(zones, network, point)[0] ?? null;
}

/** The zones to delete so the rest fits in `limit`: those used longest ago
 * first, never `keep`. The zones of kept places are neither deleted nor
 * counted (TASK-334). */
export function overLimit(
  zones: readonly ZoneEntry[],
  limit: number = SPACE_LIMIT_BYTES,
  keep: string | null = null,
): ZoneEntry[] {
  const free = zones.filter((zone) => zone.kept !== true);
  let total = free.reduce((sum, zone) => sum + zone.bytes, 0);
  const out: ZoneEntry[] = [];
  for (const zone of [...free].sort((a, b) => a.usedAt - b.usedAt)) {
    if (total <= limit) {
      break;
    }
    if (zone.name !== keep) {
      out.push(zone);
      total -= zone.bytes;
    }
  }
  return out;
}

function indexFile(): File {
  return new File(Paths.document, ENGINE_DIRECTORY, INDEX_FILE);
}

function isEntry(value: unknown): value is ZoneEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    zoneArea(entry.name) !== null &&
    (entry.etag === null || typeof entry.etag === "string") &&
    typeof entry.bytes === "number" &&
    typeof entry.usedAt === "number" &&
    (entry.kept === undefined || typeof entry.kept === "boolean")
  );
}

/** The zones saved on the phone; none when the index does not read. Only
 * the zones whose file is there. */
export function savedZones(): ZoneEntry[] {
  try {
    const file = indexFile();
    if (!file.exists) {
      return [];
    }
    const data: unknown = JSON.parse(file.textSync());
    const zones =
      typeof data === "object" &&
      data !== null &&
      "zones" in data &&
      Array.isArray(data.zones)
        ? data.zones.filter(isEntry)
        : [];
    return zones.filter((zone) => new File(zonesDirectory(), zone.name).exists);
  } catch {
    return [];
  }
}

/** What «Settings» shows of the zones: told each time the index changes. */
const watchers = new Set<() => void>();

/** Calls `watcher` each time the saved zones change, until the call it
 * returns. */
export function watchZones(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

function saveIndex(zones: readonly ZoneEntry[]): void {
  const file = indexFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify({ zones }));
  for (const watcher of watchers) {
    watcher();
  }
}

/** The space the saved zones take on the phone, in bytes. */
export function savedBytes(zones: readonly ZoneEntry[] = savedZones()): number {
  return zones.reduce((sum, zone) => sum + zone.bytes, 0);
}

/** The file of a saved zone, for the page. */
export function zoneUri(zone: ZoneEntry): string {
  return new File(zonesDirectory(), zone.name).uri;
}

/** Marks `name` as used now: it is the last to go beyond the limit. With
 * `kept`, also as the zone of a place the user keeps (TASK-334). */
export function touchZone(
  name: string,
  now: number = Date.now(),
  kept: boolean = false,
): void {
  try {
    saveIndex(
      savedZones().map((zone) =>
        zone.name === name
          ? { ...zone, usedAt: now, ...(kept ? { kept: true } : {}) }
          : zone,
      ),
    );
  } catch {
    // The order of deletion is a little off; nothing else changes.
  }
}

/** Deletes the saved zone `name`, the zone of a place the user no longer
 * keeps (TASK-334). */
export function deleteZone(name: string): void {
  try {
    deleteQuietly(new File(zonesDirectory(), name));
    saveIndex(savedZones().filter((zone) => zone.name !== name));
  } catch {
    // A file left behind is replaced by the next download, or «Delete».
  }
}

/** Deletes every saved zone («Offline maps» in «Settings», part C). */
export function deleteZones(): void {
  try {
    const folder = zonesDirectory();
    if (folder.exists) {
      folder.delete();
    }
    saveIndex([]);
  } catch {
    // What is left is deleted next time, or replaced.
  }
}

export type ZoneDownload =
  | { kind: "saved"; zone: ZoneEntry }
  | { kind: "unchanged"; zone: ZoneEntry }
  /** The server has no zone around the point: it draws routes there. */
  | { kind: "none" }
  /** A zone ahead past the day's cap (part A2): none before `retryAt`,
   * in ms since 1970. */
  | { kind: "later"; retryAt: number }
  | { kind: "failed"; why: string };

function header(headers: Record<string, string>, name: string): string | null {
  const key = Object.keys(headers).find((each) => each.toLowerCase() === name);
  return key === undefined ? null : headers[key];
}

/** The file name in a Content-Disposition header, when it is a zone's. */
export function fileNameOf(disposition: string | null): string | null {
  const match = disposition === null ? null : /filename="?([^";]+)"?/.exec(disposition);
  return match !== null && zoneArea(match[1]) !== null ? match[1] : null;
}

/** Downloads `url` into `fileUri`; `onSize` hears the size of the body
 * once, as the first bytes arrive, when the server sends it. */
export type Download = (
  url: string,
  fileUri: string,
  options: DownloadOptions,
  onSize?: (bytes: number) => void,
) => Promise<FileSystemDownloadResult | undefined>;

/** The phone's download, with the size for the notice of the first maps
 * (part C): downloadAsync does not tell it. */
export const downloadTelling: Download = (url, fileUri, options, onSize) => {
  let told = false;
  return createDownloadResumable(url, fileUri, options, (progress) => {
    // -1 when the server sends no Content-Length.
    if (!told && progress.totalBytesExpectedToWrite > 0) {
      told = true;
      onSize?.(progress.totalBytesExpectedToWrite);
    }
  }).downloadAsync();
};

/**
 * Saves the zone of `network` the server has around `point`, unless the
 * phone has it already (If-None-Match, 304). The file lands beside the
 * others only whole, under the name the API gives it; then the zones used
 * longest ago go, beyond the limit. `onSize` hears the size of what the
 * server sends, also a short error. Never throws.
 *
 * `prefetch`: a zone downloaded ahead, not the one around the phone. It says
 * so to the server with the phone's id, which counts it against the day's
 * cap; after a 429 the phone asks for none until Retry-After (part A2). It
 * is saved as never used: beyond the limit it goes before the zones the
 * phone was in (part B2).
 *
 * `kept`: the zone of a place the user keeps (TASK-334), out of the limit.
 * A zone once kept stays so when a download around the phone saves it
 * again; only the place, or «Delete», lets it go.
 */
export async function downloadZone(
  baseUrl: string,
  network: Network,
  [lat, lon]: LatLon,
  {
    apiKey = configuredKey(),
    now = Date.now,
    download = downloadTelling,
    onSize,
    prefetch = false,
    marginM,
    kept = false,
  }: {
    apiKey?: string | null;
    now?: () => number;
    download?: Download;
    onSize?: (bytes: number) => void;
    prefetch?: boolean;
    /** The room asked for around the point (AROUND_MARGIN_M); the server's
     * 3 km when not given. */
    marginM?: number;
    kept?: boolean;
  } = {},
): Promise<ZoneDownload> {
  try {
    if (prefetch) {
      const paused = prefetchPausedUntil();
      if (now() < paused) {
        return { kind: "later", retryAt: paused };
      }
    }
    const folder = zonesDirectory();
    folder.create({ idempotent: true, intermediates: true });
    const zones = savedZones();
    // All the zones held there: the server may give any of them (part E).
    // The smallest one's ETag goes in If-None-Match, as before part E, and
    // the others beside it: a server before part E reads only the first, and
    // answers as it always did.
    const near = coveringZones(zones, network, [lat, lon]);
    const have = near.filter((zone) => zone.etag !== null);
    const first = near[0]?.etag ? near[0] : undefined;
    const others = have.filter((zone) => zone !== first);
    // Its own partial file: a place may download while the zones around
    // the phone do.
    const partial = new File(folder, `.${network}${kept ? ".place" : ""}.download`);
    const query = `lat=${lat}&lon=${lon}${prefetch ? "&prefetch=1" : ""}${
      marginM === undefined ? "" : `&margin_m=${marginM}`
    }`;
    const answer = await download(
      `${baseUrl}/phone-zones/${network}?${query}`,
      partial.uri,
      {
        headers: {
          ...keyHeaders(apiKey),
          ...(first?.etag ? { "If-None-Match": first.etag } : {}),
          ...(others.length > 0
            ? { [ZONE_TAGS_HEADER]: others.map((zone) => zone.etag).join(", ") }
            : {}),
          ...(prefetch ? { [PHONE_HEADER]: phoneId() } : {}),
        },
      },
      onSize,
    );
    if (answer === undefined) {
      deleteQuietly(partial);
      return { kind: "failed", why: "the download stopped" };
    }
    if (answer.status === 304 && have.length > 0) {
      const tag = header(answer.headers, "etag");
      const same = have.find((zone) => zone.etag === tag) ?? have[0];
      touchZone(same.name, now(), kept);
      deleteQuietly(partial);
      return { kind: "unchanged", zone: same };
    }
    if (answer.status === 429 && prefetch) {
      deleteQuietly(partial);
      const until = retryAt(header(answer.headers, "retry-after"), now());
      pausePrefetch(until);
      return { kind: "later", retryAt: until };
    }
    if (answer.status !== 200) {
      deleteQuietly(partial);
      return answer.status === 404
        ? { kind: "none" }
        : { kind: "failed", why: `the server answered ${answer.status}` };
    }
    const name = fileNameOf(header(answer.headers, "content-disposition"));
    if (name === null || zoneArea(name)?.network !== network) {
      deleteQuietly(partial);
      return { kind: "failed", why: "the server sent a file that is not a zone" };
    }
    const target = new File(folder, name);
    if (target.exists) {
      target.delete();
    }
    partial.moveSync(target);
    const before = savedZones().find((each) => each.name === name);
    const zone: ZoneEntry = {
      name,
      etag: header(answer.headers, "etag"),
      bytes: new File(folder, name).size,
      usedAt: prefetch ? 0 : now(),
      ...(kept || before?.kept === true ? { kept: true } : {}),
    };
    const all = [...savedZones().filter((each) => each.name !== name), zone];
    const gone = overLimit(all, SPACE_LIMIT_BYTES, name);
    for (const old of gone) {
      deleteQuietly(new File(folder, old.name));
    }
    saveIndex(all.filter((each) => !gone.includes(each)));
    return { kind: "saved", zone };
  } catch (error) {
    return { kind: "failed", why: String(error) };
  }
}

function deleteQuietly(file: File): void {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // A file left behind is replaced by the next download.
  }
}
