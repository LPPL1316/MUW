/**
 * A workout at the gym (TASK-385, ADR-0327, docs/API.md «Gym»): a run saved
 * without a track, its sets in place of a line. Mirrors
 * services/api/shaperoute_api/gym_sessions.py; the catalog of the exercises
 * is fixtures/gym-exercises.json, the same as gym_catalog.py.
 */

/** The kinds of set (docs/sports/gym.md): reps and kg, reps of the body
 * (with a weight added, if any), seconds, or a block on a cardio machine. */
export const GYM_SET_KINDS = ["load", "bodyweight", "timed", "cardio"] as const;
export type GymSetKind = (typeof GYM_SET_KINDS)[number];

/** One set, or one block on a cardio machine. Only the fields of its kind:
 * `reps` and `load_kg` for a load (per hand for a dumbbell), `reps` and an
 * optional `load_kg` for a set of the body, `duration_s` for a timed one,
 * `duration_s` and what its machine shows for a cardio block. */
export interface GymSet {
  /** Its key in the catalog; absent for an exercise the runner named. */
  exercise?: string;
  /** What the runner called it, 1–40 characters; absent for one of the
   * catalog. */
  name?: string;
  kind: GymSetKind;
  reps?: number;
  load_kg?: number;
  duration_s?: number;
  distance_m?: number;
  speed_kmh?: number;
  incline_pct?: number;
  level?: number;
  floors?: number;
  /** When it was logged, in seconds since the workout began. */
  at_s: number;
  /** Logged during the workout; false for one added after it ended. */
  live: boolean;
}

/** A pause («Pause»), in seconds since the workout began: out of its time.
 * A rest between two sets is no pause. */
export interface GymPause {
  from_s: number;
  to_s: number;
}

/** PUT /me/gym-sessions/{key}: fixtures/gym-session.json. */
export interface GymSessionRequest {
  started_at: string;
  ended_at: string;
  pauses?: GymPause[];
  /** How many rests the timer counted, and their seconds summed. */
  rests?: number;
  rest_s?: number;
  /** «Show exercises» on its post; true when absent. */
  show_exercises?: boolean;
  sets?: GymSet[];
}

/** The workout as saved: 201 the first time, then 200 with it unchanged.
 * `duration_s` is the API's: from start to end without the pauses. */
export interface GymSession {
  id: string;
  started_at: string;
  duration_s: number;
  rests: number;
  rest_s: number;
  show_exercises: boolean;
  sets: GymSet[];
}

/** GET /drawings/{id}/exercises: what the post of a workout shows; 404
 * when its owner hides them, or for an app that does not read `gym` and
 * `trackless` (X-MuW-Reads). */
export interface GymExercises {
  rests: number;
  rest_s: number;
  sets: GymSet[];
}

/** PUT /me/gym-sessions/{key}/show-exercises. */
export interface ShowExercisesRequest {
  show: boolean;
}
