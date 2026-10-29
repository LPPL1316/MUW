import type { Activity, LatLon } from "@shaperoute/shared-types";

import { activityKey } from "../activities/activityKey";
import { kcal } from "../navigation/runMetrics";
import type { Track } from "../navigation/trackRecorder";

/**
 * A finished activity as Apple Health and Health Connect take it (TASK-321,
 * ADR-0281): worked out here, from the track the phone saved, the same for
 * both phones. What each phone's library wants is in `appleWorkout.ts` and
 * `healthConnectWorkout.ts`. Pure: nothing here writes anything.
 */

/** A place of the route: where, when, how sure, how high. */
export type WorkoutPoint = {
  point: LatLon;
  timeMs: number;
  /** Radius of the fix's error, in metres. */
  accuracyM: number;
  /** Height above the sea, in metres; null when the phone gave none. */
  altitudeM: number | null;
};

export type Workout = {
  /** What it was, as the end of the run says (running, cycling, paddling). */
  activity: Activity;
  /** The first and the last fix, in milliseconds. */
  startMs: number;
  endMs: number;
  /** The metres MuW counts: pauses take none. */
  distanceM: number;
  /** The active energy, estimated, in kilocalories: only for a run (the
   * user's choice), as the formula is a runner's (ADR-0137). Null for any
   * other activity, and for a run too short to count one. */
  kcal: number | null;
  /** The fixes of the track that say how sure they are, in order. */
  route: WorkoutPoint[];
  /** The pauses within the activity, in order; an open one at the end is
   * not within it. */
  pauses: { fromMs: number; toMs: number }[];
  /** The run's key (`activityKey`): the same run written twice is one
   * workout. */
  syncId: string;
};

/** The version of what is written for a run: there is only one so far. */
export const SYNC_VERSION = 1;

/**
 * The workout of a finished `track`, done as `activity`; null with less
 * than two fixes, or no time between the first and the last.
 */
export function workoutOf(track: Track, activity: Activity): Workout | null {
  const first = track.fixes[0];
  const last = track.fixes[track.fixes.length - 1];
  if (first === undefined || last === undefined || last.timeMs <= first.timeMs) {
    return null;
  }
  const startMs = first.timeMs;
  const endMs = last.timeMs;
  const energy = activity === "running" ? kcal(track.distanceM) : 0;
  return {
    activity,
    startMs,
    endMs,
    distanceM: Math.max(0, track.distanceM),
    kcal: energy > 0 ? energy : null,
    // A fix that does not say how sure it is cannot be a place of the
    // route: both phones want the radius of every one.
    route: track.fixes.flatMap((fix) =>
      fix.accuracyM === null
        ? []
        : [
            {
              point: fix.point,
              timeMs: fix.timeMs,
              accuracyM: fix.accuracyM,
              altitudeM:
                typeof fix.altitudeM === "number" && Number.isFinite(fix.altitudeM)
                  ? fix.altitudeM
                  : null,
            },
          ],
    ),
    pauses: (track.pauses ?? []).flatMap((pause) => {
      const fromMs = Math.max(pause.fromMs, startMs);
      const toMs = Math.min(pause.toMs ?? endMs, endMs);
      return toMs > fromMs ? [{ fromMs, toMs }] : [];
    }),
    syncId: activityKey(first),
  };
}
