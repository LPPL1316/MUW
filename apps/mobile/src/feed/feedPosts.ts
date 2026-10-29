import type { FeedPost } from "@shaperoute/shared-types";

import { dayLabel } from "../activities/activityText";
import { shapeName } from "../i18n/shapeNames";
import type { SamplePost } from "./sampleFeed";

/**
 * A drawing published by a member, as the card of «Feed» shows it
 * (TASK-118, ADR-0227): the fields of an example drawing, since the card
 * is the same, and the drawing itself, to open it whole on the map with
 * its reactions and comments.
 */
export type ShownPost = SamplePost & { drawing: FeedPost };

/** A post of the list is a member's drawing, not an example. */
export function isShown(post: SamplePost): post is ShownPost {
  return "drawing" in post;
}

/** A member's drawing of an activity added from a file of another app
 * (TASK-312): its card says «Imported». An example never is. */
export function isImportedPost(post: SamplePost): boolean {
  return (
    isShown(post) && post.drawing.source !== undefined && post.drawing.source !== "muw"
  );
}

/**
 * What the drawing draws, as the facts of the card say it: the shape's
 * name, the word as written, or the planned route's title; null when the
 * run had no route.
 */
export function whatWasDrawn(post: FeedPost): string | null {
  if (post.shape !== null) {
    return shapeName(post.shape);
  }
  return post.word ?? post.route_title;
}

/**
 * The drawing as the card shows it: who published it, its place, its
 * title or, without one, the day it was run (as a profile names it), the
 * cut track lightly drawn, the run's numbers. The score is not shown
 * (TASK-241); a run without one has none.
 */
export function shownPost(post: FeedPost): ShownPost {
  return {
    id: post.id,
    user: post.author.username,
    title: post.title ?? dayLabel(post.started_at),
    city: post.place ?? "",
    shape: post.shape ?? "",
    what: whatWasDrawn(post),
    route_m: post.distance_m,
    minutes: Math.round(post.duration_s / 60),
    score: post.score ?? 0,
    line: post.track_preview,
    activity: post.activity ?? "running",
    ...(post.rotation_deg != null ? { rotation_deg: post.rotation_deg } : {}),
    drawing: post,
  };
}
