import { favoriteTitle } from "../favorites/favoriteRoute";
import { t, tLater } from "../i18n";
import { clockLabel } from "../navigation/freeRun";
import { paddlePaceLabel } from "../navigation/paddle";
import { paceLabel, runDistanceLabel } from "../units/format";

/**
 * A run of «My activities» in words (TASK-172): when it began, where, what
 * it drew, how far and how fast. The moment is read on the phone's clock.
 */

// In English; shown with t() in the app's language (TASK-210).
const DAYS = [
  tLater("Sun"),
  tLater("Mon"),
  tLater("Tue"),
  tLater("Wed"),
  tLater("Thu"),
  tLater("Fri"),
  tLater("Sat"),
];
export const MONTHS = [
  tLater("Jan"),
  tLater("Feb"),
  tLater("Mar"),
  tLater("Apr"),
  tLater("May"),
  tLater("Jun"),
  tLater("Jul"),
  tLater("Aug"),
  tLater("Sep"),
  tLater("Oct"),
  tLater("Nov"),
  tLater("Dec"),
];

function two(value: number): string {
  return String(value).padStart(2, "0");
}

/** "Fri 2 Oct 2026": the day the run began, on the phone's clock, without
 * the time (a drawing others see, TASK-117); "" for a moment that is not one. */
export function dayLabel(startedAt: string): string {
  const when = new Date(startedAt);
  if (Number.isNaN(when.getTime())) {
    return "";
  }
  // One text, so a language can put the day and the month in its own order.
  return t("{weekday} {day} {month} {year}", {
    weekday: t(DAYS[when.getDay()]),
    day: String(when.getDate()),
    month: t(MONTHS[when.getMonth()]),
    year: String(when.getFullYear()),
  });
}

/** "Fri 2 Oct 2026 · 08:12": the day and the time the run began, on the
 * phone's clock; "" for a moment that is not one. */
export function startedLabel(startedAt: string): string {
  const when = new Date(startedAt);
  if (Number.isNaN(when.getTime())) {
    return "";
  }
  return `${dayLabel(startedAt)} · ${two(when.getHours())}:${two(when.getMinutes())}`;
}

type Drawn = { shape: string | null; word: string | null; title: string | null };

/** "Trento · Star", "Trento", "Star": where the run began and what its
 * route drew; "Run" when nobody knows either. */
export function whereAndWhat(
  run: Drawn & { place: string | null },
  /** Whether the run followed a route: without one it drew nothing. */
  withRoute: boolean,
): string {
  const parts = [run.place, withRoute ? favoriteTitle(run) : null].filter(
    (part): part is string => part !== null && part !== "",
  );
  return parts.length > 0 ? parts.join(" · ") : t("Run");
}

/** "4.01 km · 19:00 · 4:44 /km": distance, time and average pace, in the
 * app's units (TASK-182: "2.49 mi · 19:00 · 7:37 /mi"); no pace for a run
 * too short to have one. On the water the pace is a paddler's, "5:37
 * /500 m" (TASK-251); an API before it says no sport, and the pace is a
 * run's. */
export function runFacts(run: {
  distance_m: number;
  duration_s: number;
  /** As the API writes it: "paddling" is an outing on the water. */
  activity?: string;
}): string {
  const ms = run.duration_s * 1000;
  return [
    runDistanceLabel(run.distance_m),
    clockLabel(ms),
    run.activity === "paddling"
      ? paddlePaceLabel(run.distance_m, ms)
      : paceLabel(run.distance_m, ms),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
