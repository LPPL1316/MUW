import {
  ACTIVITIES,
  type Activity,
  type DrawingComplexity,
  type DrawingSort,
} from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import { activityOffered } from "../settings/sport";
import type { CategoryKey } from "./categories";

/** The distances the sheet offers, in metres: `max` null is open. */
export type DistanceBand = { key: string; min: number; max: number | null };

export const DISTANCE_BANDS: readonly DistanceBand[] = [
  { key: "0-10", min: 0, max: 10_000 },
  { key: "10-30", min: 10_000, max: 30_000 },
  { key: "30-50", min: 30_000, max: 50_000 },
  { key: "50+", min: 50_000, max: null },
];

/** What a search asks besides its words (TASK-344). */
export type SearchFilters = {
  /** A key of DISTANCE_BANDS; null: any distance. */
  distance: string | null;
  /** Empty: every sport. */
  activities: readonly Activity[];
  /** A part of a town's name; empty: anywhere. */
  place: string;
  /** Empty: any. */
  complexities: readonly DrawingComplexity[];
  /** The category chosen from the chips; null: every shape. */
  category: CategoryKey | null;
  sort: DrawingSort;
};

export const NO_FILTERS: SearchFilters = {
  distance: null,
  activities: [],
  place: "",
  complexities: [],
  category: null,
  sort: "recent",
};

/** In English: shown with `t()`. */
export const SORT_LABELS: Readonly<Record<DrawingSort, string>> = {
  recent: tLater("Most recent"),
  longest: tLater("Longest"),
  popular: tLater("Most popular"),
};

export const COMPLEXITY_LABELS: Readonly<Record<DrawingComplexity, string>> = {
  simple: tLater("Simple"),
  medium: tLater("Medium"),
  complex: tLater("Complex"),
};

/** The sports the sheet offers: a walk once «Walk» is ready, so the API
 * never answers 422 to a filter the app shows (TASK-371). */
export const SEARCH_ACTIVITIES: readonly Activity[] = ACTIVITIES.filter((activity) =>
  activityOffered(activity),
);

export const ACTIVITY_LABELS: Readonly<Record<Activity, string>> = {
  running: tLater("Run"),
  cycling: tLater("Bike"),
  paddling: tLater("Paddle"),
  swimming: tLater("Open water swim"),
  walking: tLater("Walk"),
};

export function bandOf(key: string | null): DistanceBand | null {
  return DISTANCE_BANDS.find((band) => band.key === key) ?? null;
}

/**
 * How many filters of the sheet are on, as the badge on its button says
 * it: each kind once, however many values it holds. The category is a
 * chip of its own, not the sheet's.
 */
export function activeCount(filters: SearchFilters): number {
  return [
    filters.distance !== null,
    filters.activities.length > 0,
    filters.place.trim() !== "",
    filters.complexities.length > 0,
    filters.sort !== NO_FILTERS.sort,
  ].filter(Boolean).length;
}

/** `values` with `value` in or out. */
export function toggled<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((kept) => kept !== value)
    : [...values, value];
}
