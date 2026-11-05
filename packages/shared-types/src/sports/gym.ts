import type { TracklessSport } from "./base.ts";

/** A workout at the gym, saved without a track (TASK-385, ADR-0327). */
export const GYM = {
  activity: "gym",
  trackless: true,
} as const satisfies TracklessSport;
