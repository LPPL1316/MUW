import {
  ACTIVITIES,
  type Activity,
  type LatLon,
  type RunActivity,
} from "@shaperoute/shared-types";

import { activityKey } from "../activities/activityKey";
import { appBody, type BodyProfile } from "../body/bodyProfile";
import { activeKcal } from "../body/energy";
import { climbM } from "../navigation/runMetrics";
import { activeMs, type Track } from "../navigation/trackRecorder";

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
  activity: RunActivity;
  /** The first and the last fix, in milliseconds. */
  startMs: number;
  endMs: number;
  /** The metres MuW counts: pauses take none. */
  distanceM: number;
  /** The active energy, estimated, in kilocalories, with each sport's own
   * formula and the body on the phone (TASK-374, ADR-0318). Null for an
   * activity too short to count one. */
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

/** One of the activities with a route, whose energy MuW estimates. */
function isRouteActivity(activity: RunActivity): activity is Activity {
  return (ACTIVITIES as readonly string[]).includes(activity);
}

/**
 * The workout of a finished `track`, done as `activity` by `body`; null
 * with less than two fixes, or no time between the first and the last.
 */
export function workoutOf(
  track: Track,
  activity: RunActivity,
  body: BodyProfile = appBody(),
): Workout | null {
  const first = track.fixes[0];
  const last = track.fixes[track.fixes.length - 1];
  if (first === undefined || last === undefined || last.timeMs <= first.timeMs) {
    return null;
  }
  const startMs = first.timeMs;
  const endMs = last.timeMs;
  // A day on the snow has no estimate yet (TASK-375 part C): no energy.
  const energy = !isRouteActivity(activity)
    ? 0
    : activeKcal(
        {
          activity,
          metres: track.distanceM,
          seconds: activeMs(track, endMs) / 1000,
          climbM: climbM(track),
        },
        body,
        new Date(startMs).getFullYear(),
      );
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
