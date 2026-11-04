import {
  type Activity,
  RECORD_ACTIVITIES,
  type RecordActivity,
  type RunActivity,
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

/** The activity of a route, or none for a day on the snow, which has none. */
export function routeActivity(
  activity: RunActivity | null | undefined,
): Activity | undefined {
  return activity === null || activity === undefined || isOnSnow(activity)
    ? undefined
    : activity;
}
