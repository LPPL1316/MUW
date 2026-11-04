import { stepAt, type Track } from "./trackRecorder";

/**
 * What a run adds up to besides its distance and its time (TASK-169,
 * ADR-0137): each kilometre's time, the metres climbed and the energy spent.
 * Pure functions from the track; nothing here knows about the route.
 */

/**
 * The time of the run at the end of each whole `unitM` metres (a kilometre,
 * or with miles a mile: TASK-182), in milliseconds from the first fix,
 * pauses left out. One that ends between two fixes ends in proportion.
 */
export function unitTimesMs(track: Track, unitM: number): number[] {
  const times: number[] = [];
  let metres = 0;
  let ms = 0;
  for (let i = 1; i < track.fixes.length; i += 1) {
    const step = stepAt(track, i);
    while (step.metres > 0 && metres + step.metres >= (times.length + 1) * unitM) {
      const share = ((times.length + 1) * unitM - metres) / step.metres;
      times.push(ms + share * step.ms);
    }
    metres += step.metres;
    ms += step.ms;
  }
  return times;
}

/**
 * The time of the run at the end of each whole kilometre, in milliseconds
 * from the first fix, pauses left out. A kilometre that ends between two
 * fixes ends in proportion.
 */
export function kmTimesMs(track: Track): number[] {
  return unitTimesMs(track, 1000);
}

export type Split = {
  /** Which kilometre of the run: 1, 2, …; which mile, when the splits are
   * a mile long (TASK-182). */
  km: number;
  /** How long it took, in seconds. */
  seconds: number;
  /** Seconds more (slower) or fewer (faster) than the kilometre before;
   * null for the first. */
  change: number | null;
};

/**
 * The whole kilometres of the run, each with its time; with `unitM` the
 * metres of a mile, its whole miles (TASK-182): worked out here, from the
 * track the phone has, never kept. What is left after the last whole one
 * is not a split.
 */
export function splits(track: Track, unitM: number = 1000): Split[] {
  const times = unitTimesMs(track, unitM);
  return times.map((time, index) => {
    const seconds = (time - (index === 0 ? 0 : times[index - 1])) / 1000;
    const before =
      index === 0
        ? null
        : (times[index - 1] - (index === 1 ? 0 : times[index - 2])) / 1000;
    return {
      km: index + 1,
      seconds,
      change: before === null ? null : seconds - before,
    };
  });
}

/** "+0:12" slower, "-0:05" faster, "0:00" the same: a split against the
 * one before, to the second. */
export function changeLabel(seconds: number): string {
  const whole = Math.round(Math.abs(seconds));
  const sign = whole === 0 ? "" : seconds > 0 ? "+" : "-";
  return `${sign}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The GPS's height wanders by a few metres standing still: a climb counts
 * only once it is this much above the last height that counted. */
export const CLIMB_STEP_M = 3;

/**
 * The metres climbed, from the heights of the fixes: the sum of the rises,
 * each at least CLIMB_STEP_M. Descents take nothing away. Null when the
 * phone gave no height.
 */
export function climbM(track: Track): number | null {
  let from: number | null = null;
  let climbed = 0;
  for (const fix of track.fixes) {
    const height = fix.altitudeM;
    if (height === undefined || height === null || !Number.isFinite(height)) {
      continue;
    }
    if (from === null) {
      from = height;
    } else if (height - from >= CLIMB_STEP_M) {
      climbed += height - from;
      from = height;
    } else if (from - height >= CLIMB_STEP_M) {
      from = height;
    }
  }
  return from === null ? null : climbed;
}

// The energy of an activity is in `../body/energy` (TASK-374, ADR-0318).
