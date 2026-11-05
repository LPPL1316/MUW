import { useEffect, useState, useSyncExternalStore } from "react";

import { gymKey } from "./gymKey";
import {
  closeUnanswered,
  newWorkout,
  settle,
  unanswered,
  type Workout,
} from "./workout";
import { loadWorkout, saveWorkout } from "./workoutStore";

/**
 * The workout at the gym under way, one for the app (TASK-385 part B): kept
 * here and in its file at every change, so «Start workout» in «Draw» and the
 * screen over the app read the same one, and an app opened again finds it.
 */

/** undefined until the file is read, at the first use. */
let held: Workout | null | undefined;
const listeners = new Set<() => void>();

function now(): Workout | null {
  if (held === undefined) {
    held = loadWorkout();
  }
  return held;
}

function put(next: Workout | null): void {
  held = next;
  saveWorkout(next);
  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** «Start workout»: a new workout, unless one is under way already. */
export function startGymWorkout(nowMs: number = Date.now()): void {
  if (now() === null) {
    put(newWorkout(gymKey(nowMs), nowMs));
  }
}

/** Changes the workout with `change` at this moment; false when there is
 * none or the change is refused (a set that is no set). */
export function changeWorkout(
  change: (workout: Workout, nowMs: number) => Workout | null,
): boolean {
  const workout = now();
  if (workout === null) {
    return false;
  }
  const next = change(workout, Date.now());
  if (next === null) {
    return false;
  }
  put(next);
  return true;
}

/** «Save» done or «Discard»: no workout any more. */
export function endGymWorkout(): void {
  put(null);
}

/** For the tests: forget what was read, as an app opened again. */
export function forgetHeldWorkout(): void {
  held = undefined;
  listeners.clear();
}

/** How often the screen ticks while a workout lasts. */
export const TICK_MS = 1000;

/**
 * The workout and the time, ticking each second while it lasts: a rest
 * that ran out is counted, and a workout nobody answered «Still training?»
 * for ends at its last set.
 */
export function useWorkout(): { workout: Workout | null; nowMs: number } {
  const workout = useSyncExternalStore(subscribe, now, now);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const going = workout !== null && workout.endedMs === null;
  useEffect(() => {
    if (!going) {
      return;
    }
    const tick = () => {
      const at = Date.now();
      setNowMs(at);
      changeWorkout((current) => {
        if (current.endedMs !== null) {
          return null;
        }
        if (unanswered(current, at)) {
          return closeUnanswered(current);
        }
        // A tick late: the rest's own alert (restAlert.ts) rings at its end
        // first; it is counted to its end all the same.
        const settled = settle(current, at - TICK_MS);
        return settled === current ? null : settled;
      });
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [going]);
  return { workout, nowMs };
}
