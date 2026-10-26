import { t, tPlural } from "../i18n";

/**
 * How long a challenge has left (TASK-296 part D, docs/GIOCO.md §9), from
 * its deadline and the phone's clock: whole days and hours while there is a
 * day or more, hours and minutes under a day, minutes and seconds under an
 * hour; «Time is up» from the deadline on, whatever the API still counts
 * in its three hours of grace.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The milliseconds to `endsAt` (ISO 8601) from `nowMs`; 0 once past, and
 * for a moment that is not one. */
export function msLeft(endsAt: string, nowMs: number): number {
  const ends = Date.parse(endsAt);
  if (Number.isNaN(ends)) {
    return 0;
  }
  return Math.max(0, ends - nowMs);
}

/** "6 days 3 h left", "2 h 15 min left", "12 min 5 s left", "Time is up". */
export function timeLeftText(endsAt: string, nowMs: number): string {
  const left = msLeft(endsAt, nowMs);
  if (left <= 0) {
    return t("Time is up");
  }
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    const hours = Math.floor((left % DAY) / HOUR);
    return tPlural(days, "{count} day {hours} h left", "{count} days {hours} h left", {
      hours,
    });
  }
  if (left >= HOUR) {
    return t("{hours} h {minutes} min left", {
      hours: Math.floor(left / HOUR),
      minutes: Math.floor((left % HOUR) / MINUTE),
    });
  }
  return t("{minutes} min {seconds} s left", {
    minutes: Math.floor(left / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
  });
}

/** How often the countdown is written again: each second under an hour,
 * each minute above, so the text never shows a stale number. */
export function tickMs(endsAt: string, nowMs: number): number {
  return msLeft(endsAt, nowMs) >= HOUR ? MINUTE : SECOND;
}
