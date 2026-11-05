import type { GymPause, GymSessionRequest, GymSet } from "@shaperoute/shared-types";

import {
  type Rest,
  restFor,
  restOver,
  restTakenS,
  shiftRest,
  startRest,
} from "./restTimer";
import {
  type Entry,
  entryKey,
  entryOf,
  sameEntry,
  type SetValues,
  setOf,
  valuesOf,
} from "./setKinds";

/**
 * A workout at the gym as the phone keeps it while it lasts (TASK-385 part
 * B, ADR-0327): when it began, its pauses, the exercise being done, the
 * sets, the rest under way and the rests counted. No GPS: the time is that
 * of the clock. Every change is a new value, so the screen, the file and
 * the tests read the same thing. The choices are the user's (2026-11-04):
 * a rest is no pause and the clock runs through it; a set or a rest ends
 * a «Pause»; after 30 minutes with nothing «Still training?», and without
 * an answer the workout ends at its last set.
 */

/** A set of the workout, with the number the screen tells it by. */
export type LoggedSet = GymSet & { n: number };

/** A «Pause», in ms since the epoch; `toMs` null while it lasts. */
export type WorkoutPause = { fromMs: number; toMs: number | null };

export type Workout = {
  /** Its key on the API (gymKey.ts). */
  key: string;
  startedMs: number;
  pauses: WorkoutPause[];
  /** The exercise being done; null before the first «+ Exercise». */
  current: Entry | null;
  sets: LoggedSet[];
  /** The rest under way; null between rests. */
  rest: Rest | null;
  /** The rests counted, and their seconds summed. */
  rests: number;
  restS: number;
  /** The last rest chosen for each exercise, by entryKey. */
  restChoices: Record<string, number>;
  /** The last thing done: a set, a rest, an answer. «Still training?»
   * counts from it. */
  lastActiveMs: number;
  /** When it ended («Finish workout», or no answer); null while it lasts. */
  endedMs: number | null;
  /** The number of the next set. */
  nextN: number;
};

/** «Still training?» after this long with nothing. */
export const STILL_AFTER_MS = 30 * 60_000;
/** Without an answer for this long after the question, it ends. */
export const ANSWER_MS = 5 * 60_000;
/** The longest workout the API keeps (gym_sessions.py MAX_WORKOUT). */
export const MAX_WORKOUT_MS = 24 * 3_600_000;

export function newWorkout(key: string, nowMs: number): Workout {
  return {
    key,
    startedMs: nowMs,
    pauses: [],
    current: null,
    sets: [],
    rest: null,
    rests: 0,
    restS: 0,
    restChoices: {},
    lastActiveMs: nowMs,
    endedMs: null,
    nextN: 1,
  };
}

/** Whether the workout is in «Pause». */
export function isPaused(workout: Workout): boolean {
  return workout.pauses.some((pause) => pause.toMs === null);
}

/** The ms of «Pause» in it up to `nowMs`. */
function pausedMs(workout: Workout, nowMs: number): number {
  return workout.pauses.reduce(
    (total, pause) => total + Math.max(0, (pause.toMs ?? nowMs) - pause.fromMs),
    0,
  );
}

/** Its time at `nowMs` (or at its end): from start to now without the
 * pauses; the rests are in it. */
export function activeMs(workout: Workout, nowMs: number): number {
  const end = workout.endedMs ?? nowMs;
  return Math.max(0, end - workout.startedMs - pausedMs(workout, end));
}

/** Seconds since it began, as the API counts a set's `at_s`. */
function secondsAt(workout: Workout, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - workout.startedMs) / 1000));
}

/** The rest under way counted, if it is over or cut short at `nowMs`. */
function endRest(workout: Workout, nowMs: number): Workout {
  if (workout.rest === null) {
    return workout;
  }
  const taken = restTakenS(workout.rest, nowMs);
  return {
    ...workout,
    rest: null,
    rests: taken > 0 ? workout.rests + 1 : workout.rests,
    restS: workout.restS + taken,
  };
}

/** A rest that ran out while nobody looked, counted. */
export function settle(workout: Workout, nowMs: number): Workout {
  return workout.rest !== null && restOver(workout.rest, nowMs)
    ? endRest(workout, workout.rest.endsMs)
    : workout;
}

function closePause(workout: Workout, nowMs: number): Workout {
  return isPaused(workout)
    ? {
        ...workout,
        pauses: workout.pauses.map((pause) =>
          pause.toMs === null ? { ...pause, toMs: nowMs } : pause,
        ),
      }
    : workout;
}

/** «Pause»: everything stops, the rest under way too. */
export function pauseWorkout(workout: Workout, nowMs: number): Workout {
  if (isPaused(workout) || workout.endedMs !== null) {
    return workout;
  }
  const rested = endRest(workout, nowMs);
  return {
    ...rested,
    pauses: [...rested.pauses, { fromMs: nowMs, toMs: null }],
    lastActiveMs: nowMs,
  };
}

/** Back from «Pause». */
export function resumeWorkout(workout: Workout, nowMs: number): Workout {
  return { ...closePause(workout, nowMs), lastActiveMs: nowMs };
}

/** «+ Exercise»: `entry` is what the next sets are of. */
export function chooseExercise(workout: Workout, entry: Entry, nowMs: number): Workout {
  return { ...workout, current: entry, lastActiveMs: nowMs };
}

/** The sets of `entry`, in order. */
export function setsOf(workout: Workout, entry: Entry): LoggedSet[] {
  return workout.sets.filter((set) => sameEntry(entryOf(set), entry));
}

/** The number «Set {n}» of the next set of the current exercise. */
export function nextSetNumber(workout: Workout): number {
  return workout.current === null ? 1 : setsOf(workout, workout.current).length + 1;
}

/** The last rest chosen for `entry`. */
export function restSecondsFor(workout: Workout, entry: Entry): number {
  return restFor(workout.restChoices, entryKey(entry));
}

/**
 * «Log set»: a set of the current exercise with `values`; null when there
 * is none or the values are not a set. A «Pause» ends, a rest under way
 * ends, and the rest of this exercise starts by itself. After the end
 * (corrections before «Save») it is no live set and no rest starts.
 */
export function logSet(
  workout: Workout,
  values: SetValues,
  nowMs: number,
): Workout | null {
  if (workout.current === null) {
    return null;
  }
  if (workout.endedMs !== null) {
    return addAfter(workout, workout.current, values);
  }
  const set = setOf(workout.current, values, secondsAt(workout, nowMs), true);
  if (set === null) {
    return null;
  }
  const going = endRest(closePause(workout, nowMs), nowMs);
  return {
    ...going,
    sets: [...going.sets, { ...set, n: going.nextN }],
    nextN: going.nextN + 1,
    rest: startRest(nowMs, restSecondsFor(going, workout.current)),
    lastActiveMs: nowMs,
  };
}

/** A set added at the end, before «Save»: not live (it will not count for
 * the leaderboard), logged at the end of the workout. */
function addAfter(workout: Workout, entry: Entry, values: SetValues): Workout | null {
  const endS = workout.endedMs === null ? 0 : secondsAt(workout, workout.endedMs);
  const set = setOf(entry, values, endS, false);
  if (set === null) {
    return null;
  }
  return {
    ...workout,
    sets: [...workout.sets, { ...set, n: workout.nextN }],
    nextN: workout.nextN + 1,
  };
}

/** What «Same again» types: the last set of the current exercise. */
export function sameAgainValues(workout: Workout): SetValues | null {
  if (workout.current === null) {
    return null;
  }
  const last = setsOf(workout, workout.current).at(-1);
  return last === undefined ? null : valuesOf(last);
}

/** A set corrected; null when the values are not a set. Its time and
 * whether it was live stay. */
export function editSet(
  workout: Workout,
  n: number,
  values: SetValues,
): Workout | null {
  const old = workout.sets.find((set) => set.n === n);
  if (old === undefined) {
    return null;
  }
  const set = setOf(entryOf(old), values, old.at_s, old.live);
  if (set === null) {
    return null;
  }
  return {
    ...workout,
    sets: workout.sets.map((item) => (item.n === n ? { ...set, n } : item)),
  };
}

export function deleteSet(workout: Workout, n: number): Workout {
  return { ...workout, sets: workout.sets.filter((set) => set.n !== n) };
}

/** A rest of `seconds` now, by hand («Rest», a duration chosen): the
 * duration is remembered for the current exercise. It ends a «Pause». */
export function restNow(workout: Workout, seconds: number, nowMs: number): Workout {
  const going = endRest(closePause(workout, nowMs), nowMs);
  const rest = startRest(nowMs, seconds);
  const chosen = Math.round((rest.endsMs - rest.fromMs) / 1000);
  return {
    ...going,
    rest,
    restChoices:
      workout.current === null
        ? going.restChoices
        : { ...going.restChoices, [entryKey(workout.current)]: chosen },
    lastActiveMs: nowMs,
  };
}

/** «−15 s» / «+15 s». */
export function shiftWorkoutRest(
  workout: Workout,
  deltaS: number,
  nowMs: number,
): Workout {
  return workout.rest === null
    ? workout
    : { ...workout, rest: shiftRest(workout.rest, deltaS, nowMs), lastActiveMs: nowMs };
}

/** «Skip»: the rest ends now, counted as long as it lasted. */
export function skipRest(workout: Workout, nowMs: number): Workout {
  return { ...endRest(workout, nowMs), lastActiveMs: nowMs };
}

/** Whether to ask «Still training?» at `nowMs`. */
export function stillAsking(workout: Workout, nowMs: number): boolean {
  return (
    workout.endedMs === null &&
    (workout.rest === null || restOver(workout.rest, nowMs)) &&
    nowMs - workout.lastActiveMs >= STILL_AFTER_MS
  );
}

/** «Yes, keep going». */
export function stillTraining(workout: Workout, nowMs: number): Workout {
  return { ...workout, lastActiveMs: nowMs };
}

/** Whether nobody answered «Still training?», or it lasted the most the
 * API keeps: it ends by itself. */
export function unanswered(workout: Workout, nowMs: number): boolean {
  return (
    workout.endedMs === null &&
    (nowMs - workout.lastActiveMs >= STILL_AFTER_MS + ANSWER_MS ||
      nowMs - workout.startedMs >= MAX_WORKOUT_MS)
  );
}

/** «Finish workout» at `endMs`: the pause and the rest under way end. */
export function finishWorkout(workout: Workout, endMs: number): Workout {
  if (workout.endedMs !== null) {
    return workout;
  }
  const end = Math.min(endMs, workout.startedMs + MAX_WORKOUT_MS);
  const ended = endRest(closePause(workout, end), end);
  return { ...ended, endedMs: end };
}

/** Ended by itself, with nobody there: at its last set, or at the last
 * thing done when there is none; a second after it began at the least. */
export function closeUnanswered(workout: Workout): Workout {
  const last = workout.sets.at(-1);
  const endMs =
    last === undefined ? workout.lastActiveMs : workout.startedMs + last.at_s * 1000;
  return finishWorkout(workout, Math.max(workout.startedMs + 1000, endMs));
}

/** Whether there is anything to «Save»: a second of time at least. */
export function savable(workout: Workout): boolean {
  return workout.endedMs !== null && workout.endedMs - workout.startedMs >= 1000;
}

/** PUT /me/gym-sessions/{key} for an ended workout, in the API's terms:
 * pauses and sets in seconds since the start, within it. */
export function sessionRequest(workout: Workout): GymSessionRequest | null {
  if (workout.endedMs === null || !savable(workout)) {
    return null;
  }
  const endedMs = workout.endedMs;
  const endS = (endedMs - workout.startedMs) / 1000;
  const pauses: GymPause[] = workout.pauses
    .map((pause) => ({
      from_s: Math.max(0, (pause.fromMs - workout.startedMs) / 1000),
      to_s: Math.min(endS, ((pause.toMs ?? endedMs) - workout.startedMs) / 1000),
    }))
    .filter((pause) => pause.to_s > pause.from_s);
  return {
    started_at: new Date(workout.startedMs).toISOString(),
    ended_at: new Date(endedMs).toISOString(),
    pauses,
    rests: workout.rests,
    rest_s: workout.restS,
    show_exercises: true,
    sets: workout.sets.map(({ n: _n, ...set }) => ({
      ...set,
      at_s: Math.min(set.at_s, Math.floor(endS)),
    })),
  };
}
