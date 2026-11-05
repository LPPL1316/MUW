import type { Activity, LatLon, RunActivity } from "@shaperoute/shared-types";

import { whereAndWhat } from "../activities/activityText";
import { routeActivity } from "../activities/snow";
import type { ActivityDetail, RunPost, RunPostRequest } from "../api/activities";
import { turnOf } from "../explore/recommendedRoutes";
import { t } from "../i18n";
import { clockLabel } from "../navigation/freeRun";
import { isPaddle, paddlePaceLabel } from "../navigation/paddle";
import { isSwim, swimPaceLabel } from "../navigation/swim";
import { durationMs, type Track } from "../navigation/trackRecorder";
import { paceLabel, runDistanceLabel } from "../units/format";

/**
 * A run as its post shows it (TASK-231, ADR-0194): the picture to share on
 * Instagram and the text that goes with it to Strava. Made from the end of
 * a run or from a run of «My activities».
 */
export type PostRun = {
  /** The saved run's key, for Strava; null before «Save». */
  key: string | null;
  /** The title over the drawing; null shows none. */
  title: string | null;
  /** What was run, whole: the post draws all of it (ADR-0330). */
  track: LatLon[];
  distanceM: number;
  /** The time of the run, its pauses left out. */
  durationMs: number;
  /** What the run was, when the post knows: on the water its pace is of
   * 500 m (TASK-251). Absent, a run's. */
  activity?: RunActivity;
  /** How far the route's shape is turned (TASK-232): the drawing on the
   * post is turned back, so it reads upright. Absent, north up. */
  rotationDeg?: number;
  /** Its post as last shared, kept by the API (TASK-258): «Share» opens it
   * as it was. Absent or null: none, or a run not saved yet. */
  post?: RunPost | null;
};

/** The turn of a route as the post keeps it: only when it is turned. */
function turned(route: { rotation_deg?: number | null }): { rotationDeg?: number } {
  const turn = turnOf(route).rotation_deg;
  return turn === undefined ? {} : { rotationDeg: turn };
}

/** A run of «My activities» as its post shows it: its title, or where it
 * was and what it drew; its sport, when the API says it (TASK-251). */
export function postOfActivity(activity: ActivityDetail): PostRun {
  return {
    key: activity.id,
    title: activity.title ?? whereAndWhat(activity, activity.points !== null),
    track: activity.track,
    distanceM: activity.distance_m,
    durationMs: activity.duration_s * 1000,
    ...(activity.activity === undefined ? {} : { activity: activity.activity }),
    ...turned(activity),
    post: activity.post ?? null,
  };
}

/**
 * The post as the API keeps it (TASK-258): what is on the picture now, the
 * results in the post's order. `emoji` are the stickers without their ids.
 */
export function postRequestOf(
  run: PostRun,
  shown: readonly PostResult[],
  emoji: RunPostRequest["emoji"],
): RunPostRequest {
  return {
    title: run.title,
    results: POST_RESULTS.filter((result) => shown.includes(result)),
    emoji,
  };
}

/** A run that just ended, before «Save»: no title yet. `activity` is its
 * route's, when it followed one, and `rotationDeg` how far the route's
 * shape is turned. */
export function postOfTrack(
  track: Track,
  activity?: Activity,
  rotationDeg?: number,
): PostRun {
  return {
    key: null,
    title: null,
    track: track.fixes.map((fix) => fix.point),
    distanceM: track.distanceM,
    durationMs: durationMs(track),
    ...(activity === undefined ? {} : { activity }),
    ...turned({ rotation_deg: rotationDeg }),
  };
}

/** A number of the run the post can show, each one on or off. Never its
 * score: the post has none (TASK-241, the user's choice). */
export type PostResult = "distance" | "time" | "pace";

/** In the order the post shows them. */
export const POST_RESULTS: readonly PostResult[] = ["distance", "time", "pace"];

/** The name of a result, as the post writes it over its number. */
export function resultName(result: PostResult): string {
  switch (result) {
    case "distance":
      return t("Distance");
    case "time":
      return t("Time");
    case "pace":
      return t("Pace");
  }
}

/** The number of `result` for `run`, as runners read it, in the app's units
 * (TASK-182: "3.23 mi", "8:43 /mi"); null when the run has none (too short
 * for a pace). On the water the pace is a paddler's, "5:00 /500 m", with
 * miles too (TASK-251). */
export function resultValue(run: PostRun, result: PostResult): string | null {
  switch (result) {
    case "distance":
      return runDistanceLabel(run.distanceM);
    case "time":
      return clockLabel(run.durationMs);
    case "pace":
      if (isSwim(run.activity)) {
        // A swimmer's pace, of 100 m (TASK-323 D).
        return swimPaceLabel(run.distanceM, run.durationMs);
      }
      return isPaddle(routeActivity(run.activity))
        ? paddlePaceLabel(run.distanceM, run.durationMs)
        : paceLabel(run.distanceM, run.durationMs);
  }
}

/** The results `run` has, of all the post can show. */
export function resultsOf(run: PostRun): PostResult[] {
  return POST_RESULTS.filter((result) => resultValue(run, result) !== null);
}

/**
 * The text that goes with the post to Strava: the emoji, then the results
 * shown, as in «🔥❤️ 5.20 km · 28:10 · 5:25 /km». The API puts
 * «Drawn with Sgrava» under it. Null when there is nothing to say.
 */
export function postCaption(
  run: PostRun,
  shown: readonly PostResult[],
  emoji: readonly string[],
): string | null {
  const numbers = POST_RESULTS.filter((result) => shown.includes(result))
    .map((result) => resultValue(run, result))
    .filter((part): part is string => part !== null)
    .join(" · ");
  const caption = [emoji.join(""), numbers].filter((part) => part !== "").join(" ");
  return caption === "" ? null : caption;
}

/**
 * The line the post draws: the whole track, start and end too, as the
 * drawing others see (ADR-0330). Empty with fewer than two fixes: the post
 * then shows its numbers alone.
 */
export function postLine(track: readonly LatLon[]): LatLon[] {
  return track.length > 1 ? [...track] : [];
}
