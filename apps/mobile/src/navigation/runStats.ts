import type { LatLon } from "@shaperoute/shared-types";
import { t, tLater } from "../i18n";

import { metresBetween } from "../map/coordinates";
import { MIN_PACE_M } from "./freeRun";
import { unitTimesMs } from "./runMetrics";
import { activeBetween, stepAt, type Track } from "./trackRecorder";

/**
 * The numbers of a run in progress (TASK-164, ADR-0133): pure functions from
 * the track to where the runner is heading, how fast lately, how long the
 * last kilometre took and where the start is. With a route or without one:
 * nothing here knows about the route.
 */

/** Degrees clockwise from north, 0 to 360, of the way from `from` to `to`. */
export function bearingDeg([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const rad = Math.PI / 180;
  const dLon = (lon2 - lon1) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** The heading is read over this much of the line: one fix apart (5 m) is
 * within the GPS's error, and the arrow would shake. */
export const HEADING_BASE_M = 10;
/** How many fixes back the heading looks for HEADING_BASE_M at most. */
const HEADING_FIXES = 12;

/**
 * Where the runner is heading, in degrees clockwise from north: the way from
 * a fix HEADING_BASE_M back to the last one. Null until the track is that
 * long. Standing still it stays what it was.
 */
export function headingDeg(track: Track): number | null {
  const { fixes } = track;
  const last = fixes[fixes.length - 1];
  if (last === undefined) {
    return null;
  }
  const oldest = Math.max(0, fixes.length - 1 - HEADING_FIXES);
  for (let i = fixes.length - 2; i >= oldest; i -= 1) {
    if (metresBetween(fixes[i].point, last.point) >= HEADING_BASE_M) {
      return bearingDeg(fixes[i].point, last.point);
    }
  }
  return null;
}

// Both translated where shown, with t() (TASK-210): «SO», «O» in Italian.
const POINTS = [
  tLater("N"),
  tLater("NE"),
  tLater("E"),
  tLater("SE"),
  tLater("S"),
  tLater("SW"),
  tLater("W"),
  tLater("NW"),
] as const;
const WORDS = [
  tLater("north"),
  tLater("north-east"),
  tLater("east"),
  tLater("south-east"),
  tLater("south"),
  tLater("south-west"),
  tLater("west"),
  tLater("north-west"),
] as const;

function octant(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 45) % 8;
}

/** "N", "NE", …: the nearest of the eight points of the compass. */
export function compassPoint(deg: number): string {
  return POINTS[octant(deg)];
}

/** "north", "north-east", …: the same, in words. */
export function compassWords(deg: number): string {
  return WORDS[octant(deg)];
}

/** `to` as seen by someone heading `heading`: 0 ahead, 90 on the right. */
export function relativeDeg(to: number, heading: number): number {
  return (((to - heading) % 360) + 360) % 360;
}

/** "Pace now" is the pace over this much of the line behind the runner:
 * long enough to smooth the GPS, short enough to follow a change of pace. */
export const RECENT_M = 200;
/** Slower than this, in seconds per kilometre, is standing, not running. */
export const STANDING_S_PER_KM = 20 * 60;

/**
 * Seconds per kilometre over the last RECENT_M up to `nowMs`; null before
 * MIN_PACE_M, and when the runner stands: slower than `standingSPerKm`, a
 * run's STANDING_S_PER_KM unless said (a swim's is slower, TASK-323 D). The
 * time goes on between fixes, so a runner who stops sees the pace slow
 * down, then nothing. A pause counts neither its time nor its metres
 * (TASK-169).
 */
export function recentPaceS(
  track: Track,
  nowMs: number,
  standingSPerKm: number = STANDING_S_PER_KM,
): number | null {
  const { fixes } = track;
  const last = fixes[fixes.length - 1];
  if (last === undefined) {
    return null;
  }
  let metres = 0;
  let from = fixes.length - 1;
  while (from > 0 && metres < RECENT_M) {
    metres += stepAt(track, from).metres;
    from -= 1;
  }
  if (metres < MIN_PACE_M) {
    return null;
  }
  const ms = activeBetween(track, fixes[from].timeMs, Math.max(nowMs, last.timeMs));
  const pace = ms / metres;
  return pace > standingSPerKm ? null : pace;
}

/** Seconds per kilometre since the first fix; null before MIN_PACE_M. */
export function averagePaceS(track: Track, ms: number): number | null {
  return track.distanceM < MIN_PACE_M || ms <= 0 ? null : ms / track.distanceM;
}

/**
 * The seconds the last whole kilometre took; null before the first. The
 * moment a kilometre ends falls between two fixes, in proportion. With
 * `unitM` the metres of a mile, the last whole mile (TASK-182).
 */
export function lastKmS(track: Track, unitM: number = 1000): number | null {
  const times = unitTimesMs(track, unitM);
  if (times.length === 0) {
    return null;
  }
  const before = times.length === 1 ? 0 : times[times.length - 2];
  return (times[times.length - 1] - before) / 1000;
}

/** "5:42": a pace as runners read it, minutes and seconds per kilometre. */
export function paceClock(secondsPerKm: number): string {
  const seconds = Math.round(secondsPerKm);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Milliseconds to cover `remainingM` at the average pace so far; null
 * before the pace means anything. */
export function etaMs(remainingM: number, track: Track, ms: number): number | null {
  const pace = averagePaceS(track, ms);
  return pace === null ? null : Math.max(0, remainingM) * pace;
}

/** "about 17 min", "about 1 h 5 min": never less than a minute. */
export function aboutMinutes(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes < 60
    ? t("about {minutes} min", { minutes })
    : t("about {hours} h {minutes} min", {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      });
}

/** Closer than this to the first fix, the runner is at the start. */
export const AT_START_M = 30;

/** From the last fix to the first, in a straight line: how far, and which
 * way in degrees clockwise from north. Null before the first fix. */
export function toStart(track: Track): { distanceM: number; bearing: number } | null {
  const first = track.fixes[0];
  const last = track.fixes[track.fixes.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  return {
    distanceM: metresBetween(last.point, first.point),
    bearing: bearingDeg(last.point, first.point),
  };
}

/** `doneM` of `totalM`, from 0 to 1. */
export function share(doneM: number, totalM: number): number {
  return totalM > 0 ? Math.min(1, Math.max(0, doneM / totalM)) : 0;
}
