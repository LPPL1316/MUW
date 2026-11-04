import { File, Paths } from "expo-file-system";

/**
 * The runner's body (TASK-374, ADR-0318): sex, weight, height and year of
 * birth, each one optional. Kept only on this phone (the user's choice,
 * «Solo sul telefono»); used to count the energy of an activity and the
 * heart rate zones. A field left empty counts as today's 70 kg runner.
 */

/** «Male», «Female», «Prefer not to say» (the user's choice). */
export type Sex = "male" | "female" | "unsaid";

export const SEXES: readonly Sex[] = ["male", "female", "unsaid"];

export type BodyProfile = {
  sex: Sex | null;
  /** As typed, unrounded: a weight typed in pounds shows the same pounds. */
  weightKg: number | null;
  /** As typed, unrounded, like the weight. */
  heightCm: number | null;
  birthYear: number | null;
};

export const NO_BODY: BodyProfile = {
  sex: null,
  weightKg: null,
  heightCm: null,
  birthYear: null,
};

/** The values a field takes; outside them it is not kept (ADR-0318). */
export const WEIGHT_KG = { min: 30, max: 300 } as const;
export const HEIGHT_CM = { min: 100, max: 250 } as const;
/** How old the year of birth makes someone, at most and at least. */
export const AGE_YEARS = { min: 13, max: 100 } as const;

/** The years of birth a field takes in `year`: 100 to 13 years ago. */
export function birthYears(year: number): { min: number; max: number } {
  return { min: year - AGE_YEARS.max, max: year - AGE_YEARS.min };
}

/** How old someone born in `birthYear` is in `year`, near enough for the
 * formulas: the year alone, not the date (ADR-0318). */
export function ageIn(body: BodyProfile, year: number): number | null {
  return body.birthYear === null ? null : year - body.birthYear;
}

function within(value: unknown, range: { min: number; max: number }): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max
    ? value
    : null;
}

function isSex(value: unknown): value is Sex {
  return SEXES.includes(value as Sex);
}

/** What of `data` is a body: each field that does not read is left empty. */
export function bodyOf(data: unknown, year: number): BodyProfile {
  if (typeof data !== "object" || data === null) {
    return NO_BODY;
  }
  const raw = data as Record<string, unknown>;
  const birthYear = within(raw.birthYear, birthYears(year));
  return {
    sex: isSex(raw.sex) ? raw.sex : null,
    weightKg: within(raw.weightKg, WEIGHT_KG),
    heightCm: within(raw.heightCm, HEIGHT_CM),
    birthYear: birthYear === null ? null : Math.round(birthYear),
  };
}

/** Whether no field is filled in. */
export function isEmptyBody(body: BodyProfile): boolean {
  return (
    body.sex === null &&
    body.weightKg === null &&
    body.heightCm === null &&
    body.birthYear === null
  );
}

export const BODY_FILE = "body.json";

function thisYear(): number {
  return new Date().getFullYear();
}

/** The body kept on this phone; empty when none was kept or it does not read. */
export function loadBody(year: number = thisYear()): BodyProfile {
  try {
    const file = new File(Paths.document, BODY_FILE);
    if (!file.exists) {
      return NO_BODY;
    }
    return bodyOf(JSON.parse(file.textSync()), year);
  } catch {
    return NO_BODY;
  }
}

/** The body now; read from the phone on first use. */
let current: BodyProfile | null = null;

/** The body the app counts with now. */
export function appBody(): BodyProfile {
  if (current === null) {
    current = loadBody();
  }
  return current;
}

/** Told of each new body, while the app is open. */
const listeners = new Set<(body: BodyProfile) => void>();

/** Calls `listener` with each body saved from now on, until the returned
 * function is called. */
export function subscribeBody(listener: (body: BodyProfile) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps the body for the next opening and counts with it now; an empty body
 * removes the file. A phone that refuses to keep it still has it until the
 * app closes.
 */
export function saveBody(body: BodyProfile, year: number = thisYear()): void {
  const kept = bodyOf(body, year);
  try {
    const file = new File(Paths.document, BODY_FILE);
    if (isEmptyBody(kept)) {
      if (file.exists) {
        file.delete();
      }
    } else {
      file.create({ overwrite: true });
      file.write(JSON.stringify(kept));
    }
  } catch {
    // The body still holds while the app is open.
  }
  current = kept;
  for (const listener of listeners) {
    listener(kept);
  }
}
