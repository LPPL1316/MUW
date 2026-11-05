import {
  GYM_SET_KINDS,
  type GymExercises,
  type GymSession,
  type GymSessionRequest,
  type GymSet,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";

/**
 * The exercises of a workout at the gym (TASK-385 B0, ADR-0327, docs/API.md
 * «Gym»): given to whoever can see its post, unless its owner hides them.
 * The body is packages/shared-types/fixtures/gym-session.json's `rests`,
 * `rest_s` and `sets`.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

const COUNTS = ["reps", "duration_s", "distance_m", "level", "floors"] as const;
const AMOUNTS = ["load_kg", "speed_kmh", "incline_pct"] as const;

function isCount(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isGymSet(body: unknown): body is GymSet {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const set = body as Record<string, unknown>;
  const named =
    (typeof set.exercise === "string") !== (typeof set.name === "string") &&
    (set.exercise === undefined || typeof set.exercise === "string") &&
    (set.name === undefined || (typeof set.name === "string" && set.name !== ""));
  return (
    named &&
    (GYM_SET_KINDS as readonly unknown[]).includes(set.kind) &&
    COUNTS.every((field) => set[field] === undefined || isCount(set[field])) &&
    AMOUNTS.every(
      (field) =>
        set[field] === undefined ||
        (typeof set[field] === "number" && Number.isFinite(set[field])),
    ) &&
    isCount(set.at_s) &&
    typeof set.live === "boolean"
  );
}

export function isGymExercises(body: unknown): body is GymExercises {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { rests, rest_s, sets } = body as Record<string, unknown>;
  return (
    isCount(rests) && isCount(rest_s) && Array.isArray(sets) && sets.every(isGymSet)
  );
}

/** GET /drawings/{id}/exercises: 404 when its owner hides them. */
export function fetchGymExercises(
  baseUrl: string,
  token: string,
  drawingId: string,
  options: Options = {},
): Promise<AccountOutcome<GymExercises>> {
  return ask(
    baseUrl,
    `/drawings/${encodeURIComponent(drawingId)}/exercises`,
    { method: "GET", token },
    isGymExercises,
    options,
  );
}

export function isGymSession(body: unknown): body is GymSession {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { id, started_at, duration_s, rests, rest_s, show_exercises, sets } =
    body as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof started_at === "string" &&
    isCount(duration_s) &&
    isCount(rests) &&
    isCount(rest_s) &&
    typeof show_exercises === "boolean" &&
    Array.isArray(sets) &&
    sets.every(isGymSet)
  );
}

/** PUT /me/gym-sessions/{key} (TASK-385 part B): the workout saved; the
 * same again gives it back as it was. 422 for a body the API will not
 * take, 409 for the key of a run. */
export function saveGymSession(
  baseUrl: string,
  token: string,
  key: string,
  request: GymSessionRequest,
  options: Options = {},
): Promise<AccountOutcome<GymSession>> {
  return ask(
    baseUrl,
    `/me/gym-sessions/${encodeURIComponent(key)}`,
    { method: "PUT", body: request, token },
    isGymSession,
    options,
  );
}
