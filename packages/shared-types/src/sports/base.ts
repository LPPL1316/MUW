/**
 * What the contract knows of a sport (TASK-376, ADR-0320): one in a file of
 * its own, sports/<activity>.ts, and the tables of index.ts (ACTIVITIES,
 * API_ACTIVITIES, RECORD_ACTIVITIES, RUN_ACTIVITIES, DISTANCE_LIMITS_M)
 * derived from them in the order of sports/index.ts. The API's side is
 * services/api/shaperoute_api/sports/. Data only: no import of index.ts.
 */

/** A sport the route engine plans: its target distances in metres. */
export interface PlannedSport {
  readonly activity: string;
  readonly distanceM: readonly [lowest: number, highest: number];
}

/** A sport recorded without a shape (TASK-375, ADR-0319): never planned. */
export interface RecordedSport {
  readonly activity: string;
  readonly recordOnly: true;
}

/** The activities of `sports`, in their order, each its own literal. */
export type ActivitiesOf<T extends readonly { readonly activity: string }[]> = {
  readonly [K in keyof T]: T[K]["activity"];
};

export function activitiesOf<const T extends readonly { readonly activity: string }[]>(
  sports: T,
): ActivitiesOf<T> {
  return sports.map((sport) => sport.activity) as unknown as ActivitiesOf<T>;
}
