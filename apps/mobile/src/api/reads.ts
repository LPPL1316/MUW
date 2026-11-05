import { RUN_ACTIVITIES } from "@shaperoute/shared-types";

/**
 * What this app can show, said to the API in every request of an account
 * (TASK-387, ADR-0328, docs/API.md): the kinds it reads besides running,
 * cycling and paddling. The API leaves out of every list what a request
 * does not say, so an app without the header (one of before) never
 * receives a walk or a day on the snow.
 */
export const READS_HEADER = "X-MuW-Reads";

/** What every app has always read: the API sends them without the header. */
export const OLD_APP_ACTIVITIES: readonly string[] = ["running", "cycling", "paddling"];

/** A run or a post without a track (TASK-385 B0): a workout at the gym,
 * shown with its numbers in place of the line. */
export const TRACKLESS = "trackless";

/**
 * Every activity a run of this app may be (RUN_ACTIVITIES) but those of
 * before, and `trackless`: the Feed, the profiles, the search and the
 * drawing show a post without a line since TASK-385 B0.
 */
export const READS: readonly string[] = [
  ...RUN_ACTIVITIES.filter((activity) => !OLD_APP_ACTIVITIES.includes(activity)),
  TRACKLESS,
];

/** The header, for `ask` (accounts.ts). */
export function readsHeaders(): Record<string, string> {
  return { [READS_HEADER]: READS.join(",") };
}
