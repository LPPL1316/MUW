import { File, Paths } from "expo-file-system";

import { ageIn, type BodyProfile } from "./bodyProfile";

/**
 * The five heart rate zones (TASK-374 part B, ADR-0318 §6). The max heart
 * rate is Tanaka's 208 − 0.7 × age, or the one typed by hand; with a resting
 * heart rate the zones follow Karvonen, rest + % × (max − rest). Each zone
 * runs 10% of the way, from 50 to 100%. A limit changed by hand stays until
 * «Back to calculated zones»; the zones share their limits, so moving the top
 * of one zone moves the bottom of the next. Kept only on this phone.
 */

/** The heart rates a field takes, in beats a minute (ADR-0318 §10). */
export const MAX_BPM = { min: 100, max: 230 } as const;
export const REST_BPM = { min: 30, max: 120 } as const;

/** Where each limit sits between rest (or zero) and the max: the bottom of
 * zone 1, the tops of zones 1 to 4, and the max itself. */
export const ZONE_PERCENTS: readonly number[] = [0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** The limits that can move: the bottom of zone 1 and the tops of zones 1
 * to 4. The top of zone 5 is the max heart rate. */
export const LIMIT_COUNT = 5;

export type HeartSettings = {
  /** Typed by hand; null counts it from the age. */
  maxBpm: number | null;
  restBpm: number | null;
  /** One per limit that can move, null while it is calculated. */
  limits: readonly (number | null)[];
};

const NO_LIMITS: readonly null[] = Array.from({ length: LIMIT_COUNT }, () => null);

export const NO_HEART: HeartSettings = {
  maxBpm: null,
  restBpm: null,
  limits: NO_LIMITS,
};

export type MaxHeartRate = { bpm: number; from: "age" | "hand" };

/** Tanaka (2001): 208 − 0.7 × age, to the beat. */
export function tanakaMax(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/** The max heart rate: the one typed by hand, else the one of the age;
 * null when there is neither. */
export function maxHeartRate(
  heart: HeartSettings,
  body: BodyProfile,
  year: number,
): MaxHeartRate | null {
  if (heart.maxBpm !== null) {
    return { bpm: heart.maxBpm, from: "hand" };
  }
  const age = ageIn(body, year);
  return age === null ? null : { bpm: tanakaMax(age), from: "age" };
}

/** The six limits as calculated: % of the max, or Karvonen with a resting
 * heart rate. */
export function calculatedLimits(maxBpm: number, restBpm: number | null): number[] {
  // A resting heart rate at or over the max says nothing of the zones.
  const rest = restBpm !== null && restBpm < maxBpm ? restBpm : 0;
  return ZONE_PERCENTS.map((share) => Math.round(rest + share * (maxBpm - rest)));
}

export type Zone = {
  /** 1 to 5. */
  number: number;
  fromBpm: number;
  toBpm: number;
};

/**
 * The five zones with `maxBpm` at the top. Each limit changed by hand stays
 * where it is; each calculated one stays between them, a beat apart, so the
 * zones are in order even when the max moved under a limit set by hand.
 */
export function zonesOf(maxBpm: number, heart: HeartSettings): Zone[] {
  const calculated = calculatedLimits(maxBpm, heart.restBpm);
  const hand = heart.limits;
  const limits = calculated.slice(0, LIMIT_COUNT).map((value, i) => {
    const own = hand[i] ?? null;
    if (own !== null) {
      return own;
    }
    let low = -Infinity;
    let high = maxBpm - (LIMIT_COUNT - i);
    hand.forEach((other, j) => {
      if (other === null || j === i) {
        return;
      }
      if (j < i) {
        low = Math.max(low, other + (i - j));
      } else {
        high = Math.min(high, other - (j - i));
      }
    });
    return Math.min(high, Math.max(low, value));
  });
  // A max moved under the limits set by hand pushes them down, a beat apart.
  const top = [...limits, maxBpm];
  for (let i = LIMIT_COUNT - 1; i >= 0; i -= 1) {
    top[i] = Math.min(top[i], top[i + 1] - 1);
  }
  return Array.from({ length: LIMIT_COUNT }, (_, i) => ({
    number: i + 1,
    fromBpm: top[i],
    toBpm: top[i + 1],
  }));
}

/** The six limits of `zones`, from the bottom of zone 1 to the max. */
function limitsOf(zones: readonly Zone[]): number[] {
  return [...zones.map((zone) => zone.fromBpm), zones[zones.length - 1].toBpm];
}

/**
 * The settings with limit `index` (0 the bottom of zone 1, 1–4 the top of
 * zones 1–4) moved to `bpm`, kept between the limits around it, a beat
 * apart. The other limits stay as `zones` shows them.
 */
export function withLimit(
  heart: HeartSettings,
  zones: readonly Zone[],
  index: number,
  bpm: number,
): HeartSettings {
  const shown = limitsOf(zones);
  const low = index === 0 ? REST_BPM.min : shown[index - 1] + 1;
  const high = shown[index + 1] - 1;
  const kept = Math.min(high, Math.max(low, Math.round(bpm)));
  return {
    ...heart,
    limits: heart.limits.map((value, i) => (i === index ? kept : value)),
  };
}

/** The settings with every limit calculated again. */
export function calculatedAgain(heart: HeartSettings): HeartSettings {
  return { ...heart, limits: NO_LIMITS };
}

/** Whether a limit was changed by hand. */
export function hasHandLimits(heart: HeartSettings): boolean {
  return heart.limits.some((value) => value !== null);
}

function within(value: unknown, range: { min: number; max: number }): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max
    ? Math.round(value)
    : null;
}

/** What of `data` is heart settings: each field that does not read is left
 * calculated. */
export function heartOf(data: unknown): HeartSettings {
  if (typeof data !== "object" || data === null) {
    return NO_HEART;
  }
  const raw = data as Record<string, unknown>;
  const limits = Array.isArray(raw.limits) ? raw.limits : [];
  return {
    maxBpm: within(raw.maxBpm, MAX_BPM),
    restBpm: within(raw.restBpm, REST_BPM),
    limits: NO_LIMITS.map((_, i) =>
      within(limits[i], { min: REST_BPM.min, max: MAX_BPM.max }),
    ),
  };
}

/** Whether nothing is set by hand. */
export function isEmptyHeart(heart: HeartSettings): boolean {
  return heart.maxBpm === null && heart.restBpm === null && !hasHandLimits(heart);
}

export const HEART_FILE = "heart.json";

/** The settings kept on this phone; empty when none were kept or they do
 * not read. */
export function loadHeart(): HeartSettings {
  try {
    const file = new File(Paths.document, HEART_FILE);
    if (!file.exists) {
      return NO_HEART;
    }
    return heartOf(JSON.parse(file.textSync()));
  } catch {
    return NO_HEART;
  }
}

/** The settings now; read from the phone on first use. */
let current: HeartSettings | null = null;

/** The heart settings the app has now. */
export function appHeart(): HeartSettings {
  if (current === null) {
    current = loadHeart();
  }
  return current;
}

/** Told of each new setting, while the app is open. */
const listeners = new Set<(heart: HeartSettings) => void>();

/** Calls `listener` with each setting saved from now on, until the returned
 * function is called. */
export function subscribeHeart(listener: (heart: HeartSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps the settings for the next opening and uses them now, as
 * `saveBody` does: nothing set by hand removes the file.
 */
export function saveHeart(heart: HeartSettings): void {
  const kept = heartOf(heart);
  try {
    const file = new File(Paths.document, HEART_FILE);
    if (isEmptyHeart(kept)) {
      if (file.exists) {
        file.delete();
      }
    } else {
      file.create({ overwrite: true });
      file.write(JSON.stringify(kept));
    }
  } catch {
    // The settings still hold while the app is open.
  }
  current = kept;
  for (const listener of listeners) {
    listener(kept);
  }
}
