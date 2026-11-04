import type { Activity as SavedRun } from "../api/activities";
import { t } from "../i18n";
import { paceLabel } from "../units/format";
import type { Units } from "../units/units";

/**
 * How long the route will take (TASK-361): under the distance of «Draw»,
 * from the runner's own pace, or a usual one before there is any.
 */

/** The pace assumed with no runs saved: 6:00 a km, in seconds. */
export const USUAL_PACE_S_PER_KM = 360;
/** The pace assumed with no walks saved: 12:00 a km (TASK-371, the user's
 * choice). */
export const USUAL_WALK_S_PER_KM = 720;

/** Runs shorter than this say little about a pace. */
const SHORTEST_RUN_M = 1000;
/** The runs counted, the latest first. */
const RUNS_COUNTED = 10;
/** Slower than 15:00 a km is a walk, or a run left recording. */
const SLOWEST_S_PER_KM = 900;
/** Faster than 2:30 a km is a ride saved as a run. */
const FASTEST_S_PER_KM = 150;
/** A walk between 6:00 and 25:00 a km: faster is a run, slower a walk left
 * recording. */
const FASTEST_WALK_S_PER_KM = 360;
const SLOWEST_WALK_S_PER_KM = 1500;

/** A pace in seconds a km, and whether it is the runner's or the usual one;
 * with the walker's too (TASK-371), for the time under the distance of a
 * walk. */
export type Pace = { sPerKm: number; own: boolean; walking?: Pace };

/** The kinds of outing on foot a pace is read from. */
type OnFoot = "running" | "walking";

const BOUNDS: Readonly<
  Record<OnFoot, { fastest: number; slowest: number; usual: number }>
> = {
  running: {
    fastest: FASTEST_S_PER_KM,
    slowest: SLOWEST_S_PER_KM,
    usual: USUAL_PACE_S_PER_KM,
  },
  walking: {
    fastest: FASTEST_WALK_S_PER_KM,
    slowest: SLOWEST_WALK_S_PER_KM,
    usual: USUAL_WALK_S_PER_KM,
  },
};

/**
 * The runner's pace: all the metres over all the seconds of the last
 * runs on foot, each between 1 km and 2:30–15:00 a km. Imported activities
 * count: they are runs too. The usual pace when no run qualifies. Beside
 * it the walker's, from the walks between 6:00 and 25:00 a km, 12:00 a km
 * before there is any (TASK-371).
 */
export function averagePace(runs: readonly SavedRun[]): Pace {
  return { ...paceOf(runs, "running"), walking: paceOf(runs, "walking") };
}

/** The pace of the last outings of `kind`, as averagePace says it. */
function paceOf(runs: readonly SavedRun[], kind: OnFoot): Pace {
  const { fastest, slowest, usual } = BOUNDS[kind];
  let metres = 0;
  let seconds = 0;
  let counted = 0;
  for (const run of runs) {
    if (counted === RUNS_COUNTED) {
      break;
    }
    if ((run.activity ?? "running") !== kind || run.distance_m < SHORTEST_RUN_M) {
      continue;
    }
    const sPerKm = run.duration_s / (run.distance_m / 1000);
    if (sPerKm < fastest || sPerKm > slowest) {
      continue;
    }
    metres += run.distance_m;
    seconds += run.duration_s;
    counted += 1;
  }
  return counted === 0
    ? { sPerKm: usual, own: false }
    : { sPerKm: Math.round(seconds / (metres / 1000)), own: true };
}

/** "42 min", "1 h 05 min": a time to the minute. */
export function durationText(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return t("{minutes} min", { minutes });
  }
  return t("{hours} h {minutes} min", {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, "0"),
  });
}

/**
 * «≈ 42 min at 5:20/km»: the time of `distanceM` at `pace`, in the app's
 * units. With the usual pace the line says so. Null for a distance that is
 * not one: the field says why.
 */
export function runTimeText(
  distanceM: number | null,
  pace: Pace,
  units: Units,
): string | null {
  if (distanceM === null || distanceM <= 0) {
    return null;
  }
  const seconds = (distanceM / 1000) * pace.sPerKm;
  // paceLabel writes "5:20 /km"; here it sits in a sentence.
  const written = (paceLabel(1000, pace.sPerKm * 1000, "km") ?? "").replace(" /", "/");
  const perUnit =
    units === "mi"
      ? (paceLabel(1000, pace.sPerKm * 1000, "mi") ?? "").replace(" /", "/")
      : written;
  const values = { time: durationText(seconds), pace: perUnit };
  return pace.own
    ? t("≈ {time} at {pace}", values)
    : t("≈ {time} at {pace} (a usual pace)", values);
}
