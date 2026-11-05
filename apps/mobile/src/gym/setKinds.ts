import type { GymSet, GymSetKind } from "@shaperoute/shared-types";

import { readNumber, weightIn, weightKgOf } from "../body/bodyUnits";
import { clockLabel } from "../navigation/freeRun";
import type { Units } from "../units/units";
import { gymExercise } from "./catalog";

/**
 * The fields of a set, by its kind (docs/sports/gym.md «I tipi di serie»,
 * TASK-385 part B): reps and kg for a load, reps and an optional weight
 * for the body, seconds for a timed one, the time and what its machine
 * shows for a block of cardio. The bounds are the API's (gym_sessions.py):
 * a set out of them would make the whole workout a 422.
 */

export type SetField =
  | "reps"
  | "load_kg"
  | "duration_s"
  | "distance_m"
  | "speed_kmh"
  | "incline_pct"
  | "level"
  | "floors";

/** What the workout is doing: an exercise of the catalog, or one named by
 * the runner with the kind chosen for it. */
export type Entry =
  { exercise: string; kind: GymSetKind } | { name: string; kind: GymSetKind };

/** The numbers of a set, in the API's units (kg, s, m, km/h). */
export type SetValues = Partial<Record<SetField, number>>;

/** What each machine of the catalog shows, besides its time
 * (fixtures/gym-exercises.json `fields`; setKinds.test.ts compares). */
export const CARDIO_FIELDS: Readonly<Record<string, readonly SetField[]>> = {
  treadmill: ["duration_s", "distance_m", "speed_kmh", "incline_pct"],
  curved_treadmill: ["duration_s", "distance_m"],
  exercise_bike: ["duration_s", "distance_m", "level"],
  spin_bike: ["duration_s", "distance_m", "level"],
  recumbent_bike: ["duration_s", "distance_m", "level"],
  air_bike: ["duration_s", "distance_m"],
  elliptical: ["duration_s", "distance_m", "level"],
  rowing_machine: ["duration_s", "distance_m", "level"],
  ski_machine: ["duration_s", "distance_m"],
  stair_climber: ["duration_s", "floors", "level"],
  stepper: ["duration_s", "level"],
  vertical_climber: ["duration_s"],
  arm_ergometer: ["duration_s", "level"],
  jump_rope: ["duration_s"],
};

/** A machine the runner named: its time and how far. */
const NAMED_CARDIO: readonly SetField[] = ["duration_s", "distance_m"];

/** The fields of a set of `entry`, in the order they are typed. */
export function fieldsOf(entry: Entry): readonly SetField[] {
  switch (entry.kind) {
    case "load":
    case "bodyweight":
      return ["reps", "load_kg"];
    case "timed":
      return ["duration_s"];
    case "cardio":
      return "exercise" in entry
        ? (CARDIO_FIELDS[entry.exercise] ?? NAMED_CARDIO)
        : NAMED_CARDIO;
  }
}

/** The fields a set of `kind` cannot do without. */
export function neededOf(kind: GymSetKind): readonly SetField[] {
  switch (kind) {
    case "load":
      return ["reps", "load_kg"];
    case "bodyweight":
      return ["reps"];
    case "timed":
    case "cardio":
      return ["duration_s"];
  }
}

/** The API's bounds, and whether the field is whole. */
const BOUNDS: Readonly<Record<SetField, { min: number; max: number; whole: boolean }>> =
  {
    reps: { min: 1, max: 10_000, whole: true },
    load_kg: { min: 0, max: 2_000, whole: false },
    duration_s: { min: 1, max: 86_400, whole: true },
    distance_m: { min: 0, max: 1_000_000, whole: true },
    speed_kmh: { min: 0, max: 60, whole: false },
    incline_pct: { min: -10, max: 40, whole: false },
    level: { min: 1, max: 100, whole: true },
    floors: { min: 0, max: 10_000, whole: true },
  };

/** `value` as the API keeps `field`: whole where it must be, kg and km/h
 * to a hundredth; null out of its bounds. */
export function boundedValue(field: SetField, value: number): number | null {
  const { min, max, whole } = BOUNDS[field];
  const kept = whole ? Math.round(value) : Math.round(value * 100) / 100;
  return Number.isFinite(kept) && kept >= min && kept <= max ? kept : null;
}

/** The entry of a set (its exercise or its name, and its kind). */
export function entryOf(set: Pick<GymSet, "exercise" | "name" | "kind">): Entry {
  return set.exercise !== undefined
    ? { exercise: set.exercise, kind: set.kind }
    : { name: set.name ?? "", kind: set.kind };
}

/** What tells two entries apart: the key of the catalog, or the name. */
export function entryKey(entry: Entry): string {
  return "exercise" in entry
    ? entry.exercise
    : `name:${entry.name.trim().toLowerCase()}`;
}

/** Whether two entries are the same exercise. */
export function sameEntry(a: Entry, b: Entry): boolean {
  return entryKey(a) === entryKey(b) && a.kind === b.kind;
}

/** The entry of an exercise of the catalog; null for a key it has not. */
export function catalogEntry(key: string): Entry | null {
  const found = gymExercise(key);
  return found === undefined ? null : { exercise: found.key, kind: found.kind };
}

/** A set of `entry` with `values`, logged `atS` seconds into the workout;
 * null when a needed field is missing or out of bounds. Fields that are
 * not of its kind are left out; a weight of 0 on the body is no weight. */
export function setOf(
  entry: Entry,
  values: SetValues,
  atS: number,
  live: boolean,
): GymSet | null {
  const set: GymSet = {
    ...("exercise" in entry
      ? { exercise: entry.exercise }
      : { name: entry.name.trim() }),
    kind: entry.kind,
    at_s: Math.max(0, Math.round(atS)),
    live,
  };
  if (
    "name" in set &&
    (set.name === undefined || set.name === "" || set.name.length > 40)
  ) {
    return null;
  }
  for (const field of fieldsOf(entry)) {
    const value = values[field];
    if (value === undefined) {
      continue;
    }
    if (field === "load_kg" && entry.kind === "bodyweight" && value === 0) {
      continue;
    }
    const kept = boundedValue(field, value);
    if (kept === null) {
      return null;
    }
    set[field] = kept;
  }
  return neededOf(entry.kind).every((field) => set[field] !== undefined) ? set : null;
}

/** The values of `set`, to type it again («Same again») or correct it. */
export function valuesOf(set: GymSet): SetValues {
  const values: SetValues = {};
  for (const field of Object.keys(BOUNDS) as SetField[]) {
    const value = set[field];
    if (value !== undefined) {
      values[field] = value;
    }
  }
  return values;
}

// --- Typing them ---

const KM_PER_MI = 1.609344;

/** A time typed: «1:30», «1:02:00», or a bare number, which is seconds for
 * a timed set and minutes for a block of cardio (nobody rows 20 seconds).
 * Null when it is no time. */
export function readDuration(text: string, kind: GymSetKind): number | null {
  const clean = text.trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(clean)) {
    const parts = clean.split(":").map(Number);
    if (parts.slice(1).some((part) => part >= 60)) {
      return null;
    }
    return parts.reduce((total, part) => total * 60 + part, 0);
  }
  const value = readNumber(clean);
  if (value === null) {
    return null;
  }
  return Math.round(kind === "cardio" ? value * 60 : value);
}

/** What `field` reads from `text` typed in `units`, in the API's units;
 * null when it is no number. A distance is km (miles with «Miles»), a
 * speed km/h (mph), a weight kg (lb); an incline may go downhill. */
export function readField(
  field: SetField,
  text: string,
  kind: GymSetKind,
  units: Units,
): number | null {
  if (field === "duration_s") {
    return readDuration(text, kind);
  }
  const trimmed = text.trim();
  const negative = field === "incline_pct" && trimmed.startsWith("-");
  const value = readNumber(negative ? trimmed.slice(1) : trimmed);
  if (value === null) {
    return null;
  }
  switch (field) {
    case "load_kg":
      return weightKgOf(value, units);
    case "distance_m":
      return Math.round(value * 1000 * (units === "mi" ? KM_PER_MI : 1));
    case "speed_kmh":
      return units === "mi" ? value * KM_PER_MI : value;
    case "incline_pct":
      return negative ? -value : value;
    default:
      return value;
  }
}

function tidy(value: number, places: number): string {
  return String(Math.round(value * 10 ** places) / 10 ** places);
}

/** `value` of `field` as it is typed again, in `units`. */
export function fieldText(field: SetField, value: number, units: Units): string {
  switch (field) {
    case "duration_s":
      // «1:30», «1:02:00»: read back by readDuration.
      return clockLabel(value * 1000);
    case "load_kg":
      return String(weightIn(value, units));
    case "distance_m":
      return tidy(value / 1000 / (units === "mi" ? KM_PER_MI : 1), 2);
    case "speed_kmh":
      return tidy(units === "mi" ? value / KM_PER_MI : value, 1);
    default:
      return tidy(value, 1);
  }
}

/** The unit written after the field, if any. */
export function fieldUnit(field: SetField, units: Units): string | null {
  switch (field) {
    case "load_kg":
      return units === "mi" ? "lb" : "kg";
    case "distance_m":
      return units === "mi" ? "mi" : "km";
    case "speed_kmh":
      return units === "mi" ? "mph" : "km/h";
    case "incline_pct":
      return "%";
    default:
      return null;
  }
}
