import type { RecordedSport } from "./base.ts";

/** A day of cross-country skiing, recorded without a shape (TASK-372,
 * TASK-375, ADR-0319). */
export const XC_SKIING = {
  activity: "xc_skiing",
  recordOnly: true,
} as const satisfies RecordedSport;
