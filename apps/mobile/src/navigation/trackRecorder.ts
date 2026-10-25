import type { LatLon } from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import { POOR_FIX_M } from "./navigator";

/**
 * The track of a run (TASK-112, ADR-0091): pure functions from GPS fixes to
 * the line that was run, its length and how long it took. What to do with a
 * doubtful fix is decided here once; the score cleans the rest (ADR-0090).
 * A run can be paused (TASK-169, ADR-0137): what happens in a pause is not
 * of the run, neither its metres nor its time. The walks of a word with the
 * pen up are pauses too, of the pen's (TASK-198).
 */

/** A fix closer than this to the last one kept adds nothing to the line. */
export const MIN_STEP_M = 5;
/** A fix less accurate than this is not where the runner was (ADR-0070). */
export const MAX_ACCURACY_M = POOR_FIX_M;

export type TrackFix = {
  point: LatLon;
  /** When the fix was taken, in milliseconds. */
  timeMs: number;
  /** Radius of the fix's error, in metres, when the phone gives it. */
  accuracyM: number | null;
  /** Height above the sea, in metres, when the phone gives it (TASK-169). */
  altitudeM?: number | null;
  /** The first fix after the runner's pause: no metres from the one before,
   * wherever the pause was spent. */
  gap?: true;
};

/** A stretch of time that is not of the run. Open while `toMs` is null. */
export type Pause = {
  fromMs: number;
  toMs: number | null;
  /** The runner stood still and the app paused by itself: the next fix
   * that moves ends it. Absent when the runner asked. */
  auto?: true;
  /** The pen is up between two letters of a word (TASK-198): the app paused
   * at the end of a letter, and the start of the next one ends it. Like the
   * runner's own, nothing in it is of the run. Absent otherwise. */
  pen?: true;
  /** The GPS stopped with the app (TASK-255): the phone locked, or another
   * app over it, where the GPS is followed in the foreground only; or iOS
   * froze the app, where it goes on in the background (TASK-261). Nothing
   * in it is of the run, wherever the runner went: the next fix ends it and
   * starts a new stretch of the line. Absent otherwise. */
  away?: true;
};

export type Track = {
  fixes: TrackFix[];
  /** Length of the line through the fixes, in metres. */
  distanceM: number;
  /** The pauses, in the order they came. Absent before TASK-169. */
  pauses?: Pause[];
};

export function emptyTrack(): Track {
  return { fixes: [], distanceM: 0 };
}

/** The pause the track is in, or null while the run goes on. */
export function openPause(track: Track): Pause | null {
  const last = track.pauses?.[track.pauses.length - 1];
  return last !== undefined && last.toMs === null ? last : null;
}

/** `track` paused from `atMs`; the same track when it is paused already. */
export function pauseTrack(track: Track, atMs: number, auto = false): Track {
  if (openPause(track) !== null) {
    return track;
  }
  // Never before the last fix: the pause is what comes after it.
  const last = track.fixes[track.fixes.length - 1];
  const fromMs = last === undefined ? atMs : Math.max(atMs, last.timeMs);
  const pause: Pause = auto
    ? { fromMs, toMs: null, auto: true }
    : { fromMs, toMs: null };
  return { ...track, pauses: [...(track.pauses ?? []), pause] };
}

/** `track` left by the app from `atMs` (TASK-255): a pause of the phone's.
 * The same track when the runner, or the pen, paused it already; a pause by
 * standing still ends here, as what follows is not the runner's. */
export function leaveTrack(track: Track, atMs: number): Track {
  const open = openPause(track);
  if (open !== null && open.auto !== true) {
    return track;
  }
  const still = open === null ? track : resumeTrack(track, atMs);
  const last = still.fixes[still.fixes.length - 1];
  const fromMs = last === undefined ? atMs : Math.max(atMs, last.timeMs);
  return {
    ...still,
    pauses: [...(still.pauses ?? []), { fromMs, toMs: null, away: true }],
  };
}

/** `track` going on from `atMs`; the same track when it is not paused. */
export function resumeTrack(track: Track, atMs: number): Track {
  const pause = openPause(track);
  if (pause === null || track.pauses === undefined) {
    return track;
  }
  return {
    ...track,
    pauses: [
      ...track.pauses.slice(0, -1),
      { ...pause, toMs: Math.max(pause.fromMs, atMs) },
    ],
  };
}

/**
 * `track` with the pen lifted from `atMs`, at the end of a letter (TASK-198):
 * a pause of the pen's. A pause by standing still becomes the pen's, so
 * moving on along the walk does not end it; a pause of the runner's stays
 * as it is, and so does a track already paused by the pen.
 */
export function penUpTrack(track: Track, atMs: number): Track {
  const open = openPause(track);
  if (open === null) {
    const last = track.fixes[track.fixes.length - 1];
    const fromMs = last === undefined ? atMs : Math.max(atMs, last.timeMs);
    return {
      ...track,
      pauses: [...(track.pauses ?? []), { fromMs, toMs: null, pen: true }],
    };
  }
  if (open.auto !== true || track.pauses === undefined) {
    return track;
  }
  return {
    ...track,
    pauses: [
      ...track.pauses.slice(0, -1),
      { fromMs: open.fromMs, toMs: null, pen: true },
    ],
  };
}

/**
 * `track` going on from `atMs` when the pen paused it: the next letter
 * starts. Any other pause, the runner's above all, is not the pen's to end.
 */
export function penDownTrack(track: Track, atMs: number): Track {
  return openPause(track)?.pen === true ? resumeTrack(track, atMs) : track;
}

/**
 * A track taken up again at `nowMs`, after «Stop» or after the app closed:
 * the time since it was left is a pause of the runner's, so the clock does
 * not count it and the next fix is not joined to the last.
 */
export function continueTrack(track: Track, nowMs: number): Track {
  const last = track.fixes[track.fixes.length - 1];
  if (last === undefined) {
    return emptyTrack();
  }
  const open = openPause(track);
  const earlier =
    open === null ? (track.pauses ?? []) : (track.pauses ?? []).slice(0, -1);
  const fromMs = open === null ? last.timeMs : open.fromMs;
  return {
    ...track,
    pauses: [...earlier, { fromMs, toMs: Math.max(fromMs, nowMs) }],
  };
}

/**
 * A track taken up again paused, after the app closed during the run
 * (TASK-272, ADR-0240): the time since its last fix is a pause of the
 * runner's, still open, that «Resume» ends. A pause open when the app
 * closed goes on from where it began: the runner's as it was, and the
 * pen's between two letters as it was, so the next letter still ends it;
 * one by standing still, or of the app away, becomes the runner's.
 */
export function holdTrack(track: Track): Track {
  const last = track.fixes[track.fixes.length - 1];
  if (last === undefined) {
    return emptyTrack();
  }
  const open = openPause(track);
  if (open !== null && open.auto !== true && open.away !== true) {
    return track;
  }
  const earlier =
    open === null ? (track.pauses ?? []) : (track.pauses ?? []).slice(0, -1);
  const fromMs = open === null ? last.timeMs : open.fromMs;
  return { ...track, pauses: [...earlier, { fromMs, toMs: null }] };
}

/** Whether the next fix kept comes after a pause of the runner's, or of the
 * pen's: no metres from where it began, wherever the walk went. */
function afterPause(track: Track, last: TrackFix): boolean {
  const pause = track.pauses?.[track.pauses.length - 1];
  return (
    pause !== undefined &&
    pause.auto !== true &&
    pause.toMs !== null &&
    pause.fromMs >= last.timeMs
  );
}

/** `track` with `fix` at its end, or `track` itself when the fix is dropped. */
export function addFix(track: Track, fix: TrackFix): Track {
  const pause = openPause(track);
  // Paused by the runner, or by the pen between two letters: nothing is of
  // the run until it goes on. A pause by standing still, or by the app
  // leaving the front, ends with this fix.
  if (pause !== null && pause.auto !== true && pause.away !== true) {
    return track;
  }
  const [lat, lon] = fix.point;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(fix.timeMs)) {
    return track;
  }
  if (fix.accuracyM !== null && fix.accuracyM > MAX_ACCURACY_M) {
    return track;
  }
  const last = track.fixes[track.fixes.length - 1];
  if (last === undefined) {
    return { ...track, fixes: [fix], distanceM: 0 };
  }
  // The phone's clock can step back; the line goes on in the order of arrival.
  if (fix.timeMs < last.timeMs) {
    return track;
  }
  const stepM = metresBetween(last.point, fix.point);
  if (stepM < MIN_STEP_M) {
    return track;
  }
  // Moving again ends a pause that standing still began; coming back
  // ends one the app left.
  const moving = pause === null ? track : resumeTrack(track, fix.timeMs);
  if (afterPause(moving, last)) {
    return { ...moving, fixes: [...track.fixes, { ...fix, gap: true }] };
  }
  return {
    ...moving,
    fixes: [...track.fixes, fix],
    distanceM: track.distanceM + stepM,
  };
}

/** The milliseconds of pause between `fromMs` and `toMs`. */
export function pausedMs(track: Track, fromMs: number, toMs: number): number {
  let total = 0;
  for (const pause of track.pauses ?? []) {
    const start = Math.max(fromMs, pause.fromMs);
    const end = Math.min(toMs, pause.toMs ?? toMs);
    if (end > start) {
      total += end - start;
    }
  }
  return total;
}

/** The time of the run from `fromMs` to `toMs`: what passed, less the pauses. */
export function activeBetween(track: Track, fromMs: number, toMs: number): number {
  return Math.max(0, toMs - fromMs - pausedMs(track, fromMs, toMs));
}

/** The time of the run up to `nowMs`, from the first fix: 0 before it. */
export function activeMs(track: Track, nowMs: number): number {
  const first = track.fixes[0];
  return first === undefined ? 0 : activeBetween(track, first.timeMs, nowMs);
}

/** From the first fix to the last, in milliseconds: pauses left out. */
export function durationMs(track: Track): number {
  const last = track.fixes[track.fixes.length - 1];
  return last === undefined ? 0 : activeMs(track, last.timeMs);
}

/** One step of the line, from the fix before `index` to it: its metres and
 * its time, both nothing of what a pause took. */
export function stepAt(track: Track, index: number): { metres: number; ms: number } {
  const from = track.fixes[index - 1];
  const to = track.fixes[index];
  if (from === undefined || to === undefined) {
    return { metres: 0, ms: 0 };
  }
  return {
    metres: to.gap ? 0 : metresBetween(from.point, to.point),
    ms: activeBetween(track, from.timeMs, to.timeMs),
  };
}
