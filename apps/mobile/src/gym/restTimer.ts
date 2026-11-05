/**
 * The rest between two sets (TASK-385 part B, ADR-0327 point 6): only its
 * start and the moment it ends, so a phone asleep or an app closed in
 * between still knows how much is left. The workout's clock does not stop
 * for it: a rest is no «Pause». The durations are the user's (2026-11-04):
 * 30 s, 60 s, 90 s, 2 min, 3 min and «Custom» from 10 s to 10 min; the
 * last one of each exercise is remembered, and a rest starts by itself
 * after a set.
 */

/** The durations offered, in seconds. */
export const REST_CHOICES_S: readonly number[] = [30, 60, 90, 120, 180];

/** The bounds of «Custom», and of a rest made longer or shorter. */
export const MIN_REST_S = 10;
export const MAX_REST_S = 600;

/** A rest before any of its exercise. */
export const DEFAULT_REST_S = 90;

/** «−15 s» and «+15 s». */
export const REST_STEP_S = 15;

/** The light touch before the end, in milliseconds. */
export const SOON_MS = 10_000;

export type Rest = {
  /** When it began, in ms since the epoch. */
  fromMs: number;
  /** When it ends. */
  endsMs: number;
};

/** `seconds` within the bounds of a rest, whole. */
export function clampRestS(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_S;
  }
  return Math.min(MAX_REST_S, Math.max(MIN_REST_S, Math.round(seconds)));
}

/** A rest of `seconds` from `nowMs`. */
export function startRest(nowMs: number, seconds: number): Rest {
  return { fromMs: nowMs, endsMs: nowMs + clampRestS(seconds) * 1000 };
}

/** What is left of `rest` at `nowMs`, never below 0. */
export function restLeftMs(rest: Rest, nowMs: number): number {
  return Math.max(0, rest.endsMs - nowMs);
}

/** Whether `rest` is over at `nowMs`. */
export function restOver(rest: Rest, nowMs: number): boolean {
  return nowMs >= rest.endsMs;
}

/** «−15 s» or «+15 s»: the end moves by `deltaS`, but what is left stays
 * between nothing and MAX_REST_S, and the rest is never longer in all. */
export function shiftRest(rest: Rest, deltaS: number, nowMs: number): Rest {
  const left = restLeftMs(rest, nowMs) + deltaS * 1000;
  const bounded = Math.min(MAX_REST_S * 1000, Math.max(0, left));
  return { ...rest, endsMs: nowMs + bounded };
}

/** How long `rest` lasted when it ended at `nowMs` (its end, or a «Skip»
 * or a set before it), in whole seconds. */
export function restTakenS(rest: Rest, nowMs: number): number {
  return Math.max(0, Math.round((Math.min(nowMs, rest.endsMs) - rest.fromMs) / 1000));
}

/** The seconds a rest of `exercise` lasts: the last one chosen for it. */
export function restFor(
  remembered: Readonly<Record<string, number>>,
  exercise: string,
): number {
  const seconds = remembered[exercise];
  return seconds === undefined ? DEFAULT_REST_S : clampRestS(seconds);
}

/** «1:30», «0:05»: what is left, rounded up, so «0:00» shows only at the
 * end. */
export function restClock(leftMs: number): string {
  const seconds = Math.ceil(Math.max(0, leftMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
