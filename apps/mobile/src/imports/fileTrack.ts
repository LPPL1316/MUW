import type { Activity, LatLon } from "@shaperoute/shared-types";

/**
 * What a file of another app says of an activity (TASK-312, ADR-0272;
 * docs/IMPORTAZIONI.md §3), as the readers of GPX, TCX and FIT give it:
 * every point it has, in its order, each with its position and its time
 * when it has them, and the sport when it says one. `importFile` decides
 * what of it becomes a run.
 */
export type FilePoint = {
  /** null: the point has no position (a treadmill, an indoor ride). */
  point: LatLon | null;
  /** Milliseconds since 1970 (UTC); null: the point has no time. */
  timeMs: number | null;
};

export type FileTrack = {
  points: FilePoint[];
  /** What the file says the activity was, among MuW's sports; null when it
   * says nothing, or a sport MuW does not have (a walk, a swim). */
  sport: Activity | null;
};

/** A position on the Earth, or null: out of range, or 0, 0, which a device
 * without a fix writes. */
export function positionOf(lat: number, lon: number): LatLon | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) {
    return null;
  }
  return [lat, lon];
}

/** "2024-05-01T07:12:33Z", with or without fractions of a second, with an
 * offset or none (UTC, as GPX and TCX mean it). */
const ISO_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** The moment an ISO 8601 time names, in milliseconds since 1970; null for
 * anything else. */
export function isoTimeMs(text: string): number | null {
  const found = ISO_TIME.exec(text.trim());
  if (found === null) {
    return null;
  }
  const [, year, month, day, hour, minute, second, fraction, zone] = found;
  const ms = fraction === undefined ? 0 : Math.round(Number(`0.${fraction}`) * 1000);
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    ms,
  );
  if (Number.isNaN(utc)) {
    return null;
  }
  return utc - offsetMs(zone);
}

/** "+02:00" as milliseconds ahead of UTC; Z and no zone are UTC. */
function offsetMs(zone: string | undefined): number {
  if (zone === undefined || zone.toUpperCase() === "Z") {
    return 0;
  }
  const sign = zone.startsWith("-") ? -1 : 1;
  const digits = zone.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
  return sign * (hours * 60 + minutes) * 60_000;
}

/**
 * The sport a file names, as one of MuW's: GPX's <type> («running»,
 * «cycling», Strava's «9» and «1»), TCX's Sport («Running», «Biking»).
 * null for the others: the form starts from the sport of «Settings».
 */
export function sportOfWord(word: string): Activity | null {
  const name = word.trim().toLowerCase();
  // Strava's own numbers in its GPX: 9 a run, 1 a ride.
  if (name === "9") {
    return "running";
  }
  if (name === "1") {
    return "cycling";
  }
  if (name.includes("run")) {
    return "running";
  }
  if (name.includes("cycl") || name.includes("bik") || name.includes("ride")) {
    return "cycling";
  }
  if (
    name.includes("paddl") ||
    name.includes("kayak") ||
    name.includes("canoe") ||
    name === "sup"
  ) {
    return "paddling";
  }
  // Open water (TASK-323 D): a pool's file has no track to draw.
  if (name.includes("swim")) {
    return "swimming";
  }
  return null;
}
