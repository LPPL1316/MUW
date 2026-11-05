import type { GymSessionRequest } from "@shaperoute/shared-types";

import { keptList } from "../storage/keptList";

/**
 * The workouts saved and not on the API yet (TASK-385 part B), in a file of
 * their own beside the runs' (activities/outbox.ts, whose runs have a
 * track): a workout saved without a network goes when the app next has
 * one. Each belongs to the account signed in at «Save».
 */

export const GYM_OUTBOX_FILE = "gym-outbox.json";

/** The workouts of one account the phone holds, as for the runs. */
export const MAX_GYM_WAITING = 20;

export type GymWaiting = {
  /** The account it belongs to (User.id). */
  owner: number;
  key: string;
  request: GymSessionRequest;
  /** The API will not take it (422, or 409 for a key of a run): it is not
   * sent again. */
  refused?: { code: string; message: string };
};

function isGymWaiting(value: unknown): value is GymWaiting {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  const request = item.request as Record<string, unknown> | null | undefined;
  return (
    typeof item.owner === "number" &&
    typeof item.key === "string" &&
    typeof request === "object" &&
    request !== null &&
    typeof request.started_at === "string" &&
    typeof request.ended_at === "string"
  );
}

const kept = keptList(GYM_OUTBOX_FILE, isGymWaiting);

export function loadGymOutbox(): GymWaiting[] {
  return kept.load();
}

/** What keepGymWaiting did, as keepWaiting of the runs. */
export type GymKept = "kept" | "full" | "not_written";

/** Adds `workout` to the file, once. */
export function keepGymWaiting(workout: GymWaiting): GymKept {
  const list = kept.load();
  if (list.some((item) => item.key === workout.key && item.owner === workout.owner)) {
    return "kept";
  }
  if (list.filter((item) => item.owner === workout.owner).length >= MAX_GYM_WAITING) {
    return "full";
  }
  return kept.save([...list, workout]) ? "kept" : "not_written";
}

/** Takes the workout `key` of `owner` out of the file. */
export function stopGymWaiting(owner: number, key: string): void {
  const list = kept.load();
  const next = list.filter((item) => !(item.key === key && item.owner === owner));
  if (next.length !== list.length) {
    kept.save(next);
  }
}

/** Marks the workout `key` of `owner` as one the API will not take. */
export function refuseGymWaiting(
  owner: number,
  key: string,
  refused: { code: string; message: string },
): void {
  const list = kept.load();
  kept.save(
    list.map((item) =>
      item.key === key && item.owner === owner ? { ...item, refused } : item,
    ),
  );
}

/** The workouts of `owner` still to send, the oldest first. */
export function gymToSend(owner: number): GymWaiting[] {
  return kept
    .load()
    .filter((item) => item.owner === owner && item.refused === undefined);
}
