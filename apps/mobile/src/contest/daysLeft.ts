import { t, tPlural } from "../i18n";

/**
 * How long the contest has left (TASK-299 part B, docs/CONCORSI.md §7),
 * from its `ends_at` and the phone's clock, in days of the calendar: «3
 * days left» on the third day before the last, «1 day left» the day
 * before, «Ends today» on the last; from `ends_at` on, until the winner is
 * proclaimed, «Ended · the winner is coming».
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the contest stands on the phone's clock. */
export type ContestTime =
  { kind: "days"; days: number } | { kind: "today" } | { kind: "ended" };

/** The day of `ms` on the phone's calendar, as a count of days: the
 * difference of two is whole days, whatever the summer time does. */
function calendarDay(ms: number): number {
  const day = new Date(ms);
  return Math.round(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / DAY_MS,
  );
}

/** Where a contest that ends at `endsAt` (ISO 8601) stands at `nowMs`; a
 * moment that is not one has ended. */
export function contestTime(endsAt: string, nowMs: number): ContestTime {
  const ends = Date.parse(endsAt);
  if (Number.isNaN(ends) || nowMs >= ends) {
    return { kind: "ended" };
  }
  const days = calendarDay(ends) - calendarDay(nowMs);
  return days <= 0 ? { kind: "today" } : { kind: "days", days };
}

/** "3 days left", "1 day left", "Ends today", "Ended · the winner is coming". */
export function daysLeftText(endsAt: string, nowMs: number): string {
  const time = contestTime(endsAt, nowMs);
  switch (time.kind) {
    case "days":
      return tPlural(time.days, "{count} day left", "{count} days left");
    case "today":
      return t("Ends today");
    case "ended":
      return t("Ended · the winner is coming");
  }
}
