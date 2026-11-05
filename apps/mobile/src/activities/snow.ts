import {
  type Activity,
  RECORD_ACTIVITIES,
  type RecordActivity,
  type RunActivity,
  TRACKLESS_ACTIVITIES,
  type TracklessActivity,
} from "@shaperoute/shared-types";

/**
 * A day on the snow (TASK-375, ADR-0319): alpine or cross-country skiing,
 * recorded without a shape. In the Feed it is a post like the others, with
 * its comments, reactions and «Share», but none of what is done with a
 * route: no «Draw it near me», no «Start» on it, no «Edit the drawing», no
 * sending it in a message as a drawing to run (the user's choice,
 * 2026-11-04).
 */
export function isOnSnow(
  activity: RunActivity | null | undefined,
): activity is RecordActivity {
  return (
    activity !== null &&
    activity !== undefined &&
    (RECORD_ACTIVITIES as readonly string[]).includes(activity)
  );
}

/**
 * A workout at the gym (TASK-385, ADR-0327): saved without a track, its
 * post shows its numbers in place of the line, and like a day on the snow
 * it has nothing of a route.
 */
export function isTrackless(
  activity: RunActivity | null | undefined,
): activity is TracklessActivity {
  return (
    activity !== null &&
    activity !== undefined &&
    (TRACKLESS_ACTIVITIES as readonly string[]).includes(activity)
  );
}

/** The activity of a route, or none for a day on the snow or a workout at
 * the gym, which have none. */
export function routeActivity(
  activity: RunActivity | null | undefined,
): Activity | undefined {
  return activity === null ||
    activity === undefined ||
    isOnSnow(activity) ||
    isTrackless(activity)
    ? undefined
    : activity;
}
