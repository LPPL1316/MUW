import type { RecordedSport } from "./base.ts";

/** A day of alpine skiing, recorded without a shape (TASK-375, ADR-0319). */
export const SKIING = {
  activity: "skiing",
  recordOnly: true,
} as const satisfies RecordedSport;
