import { isGymSet } from "../api/gym";
import { keptList } from "../storage/keptList";
import type { Workout } from "./workout";

/**
 * The workout under way, in a file of the app's documents (TASK-385 part
 * B): an app closed in the middle, or killed by the phone, opens on it
 * again, with its time, its sets and its rest. Written so that a write cut
 * short loses nothing (keptList, TASK-252): a list of none or one.
 */

export const WORKOUT_FILE = "gym-workout.json";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { exercise, name, kind } = value as Record<string, unknown>;
  return (
    (typeof exercise === "string" || typeof name === "string") &&
    typeof kind === "string"
  );
}

export function isWorkout(value: unknown): value is Workout {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  const rest = item.rest as Record<string, unknown> | null | undefined;
  return (
    typeof item.key === "string" &&
    isNumber(item.startedMs) &&
    Array.isArray(item.pauses) &&
    item.pauses.every(
      (pause: unknown) =>
        typeof pause === "object" &&
        pause !== null &&
        isNumber((pause as Record<string, unknown>).fromMs) &&
        ((pause as Record<string, unknown>).toMs === null ||
          isNumber((pause as Record<string, unknown>).toMs)),
    ) &&
    (item.current === null || isEntry(item.current)) &&
    Array.isArray(item.sets) &&
    item.sets.every(
      (set: unknown) =>
        isGymSet(set) && isNumber((set as unknown as Record<string, unknown>).n),
    ) &&
    (rest === null ||
      (typeof rest === "object" && isNumber(rest?.fromMs) && isNumber(rest?.endsMs))) &&
    isNumber(item.rests) &&
    isNumber(item.restS) &&
    typeof item.restChoices === "object" &&
    item.restChoices !== null &&
    isNumber(item.lastActiveMs) &&
    (item.endedMs === null || isNumber(item.endedMs)) &&
    isNumber(item.nextN)
  );
}

const kept = keptList(WORKOUT_FILE, isWorkout);

/** The workout left under way (or ended and not saved yet); null when none. */
export function loadWorkout(): Workout | null {
  return kept.load()[0] ?? null;
}

/** Keeps `workout`, or with null forgets it; false when the phone refuses. */
export function saveWorkout(workout: Workout | null): boolean {
  return kept.save(workout === null ? [] : [workout]);
}
