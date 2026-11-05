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

/**
 * Every activity a run of this app may be (RUN_ACTIVITIES) but those of
 * before. Not `trackless`: no screen shows a post without a line yet
 * (TASK-385 will say it, with its screens).
 */
export const READS: readonly string[] = RUN_ACTIVITIES.filter(
  (activity) => !OLD_APP_ACTIVITIES.includes(activity),
);

/** The header, for `ask` (accounts.ts). */
export function readsHeaders(): Record<string, string> {
  return { [READS_HEADER]: READS.join(",") };
}
