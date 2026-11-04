import type { LatLon, RunActivity } from "@shaperoute/shared-types";

import { withPaddle } from "./paddlePosts";
import posts from "./sampleFeed.json";

/**
 * An example drawing of «Feed» (TASK-156, ADR-0127): a figure of the seed
 * catalogue, with a made-up runner, title, time and score. The line is the
 * route engine's, with fewer points; `tools/sample_feed.py` writes the file.
 * A drawing on the water is an example of «Explore» with «Paddle», and its
 * id is that example's (TASK-228).
 */
export type SamplePost = {
  /** The route in the catalogue, as the API names it: "trento-star-5000-0". */
  id: string;
  user: string;
  title: string;
  /** As in the catalogue: "firenze". `cityName` makes it readable. */
  city: string;
  shape: string;
  route_m: number;
  minutes: number;
  /** From 0 to 100, as the score of a run (ADR-0090). */
  score: number;
  line: LatLon[];
  /** A drawing on the water (TASK-228), or on a bike (a member's, TASK-118);
   * a run's does not say it. */
  activity?: RunActivity;
  /** What was drawn, when `shape` does not say it: a word, a route's title;
   * null for a run without a route. Only a member's drawing has it
   * (TASK-118); an example's shape is in the catalogue. */
  what?: string | null;
  /** The points of `line` the pen comes to without drawing: a shape in
   * pieces (TASK-226). */
  gaps?: number[];
  /** How far the engine turned the figure, as RouteResult.rotation_deg
   * (TASK-232): the drawing is shown turned back. Absent for a figure
   * north up. */
  rotation_deg?: number;
};

/** The drawings of the runs, in their order. In the file a point is a list
 * of two numbers, which is what a `LatLon` is. */
export const RUN_POSTS = posts as unknown as readonly SamplePost[];

/** The example drawings, in the order they are shown: those of the runs,
 * and among them those on the water (TASK-228, `paddlePosts`). */
export const SAMPLE_FEED: readonly SamplePost[] = withPaddle(RUN_POSTS);
