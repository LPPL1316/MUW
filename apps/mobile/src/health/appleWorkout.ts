import type {
  LocationForSaving,
  QuantitySampleForSaving,
  QuantityTypeIdentifierWriteable,
  WorkoutActivityType,
} from "@kingstinct/react-native-healthkit";
import type { Activity, RunActivity } from "@shaperoute/shared-types";

import { tableOf } from "../sports";
import { SYNC_VERSION, type Workout } from "./workout";

/**
 * A workout as Apple Health takes it (TASK-321, ADR-0281), in the shape of
 * `saveWorkoutSample` and `saveWorkoutRoute` of
 * `@kingstinct/react-native-healthkit`. Pure: only types come from the
 * library, never its code (it needs its native module).
 */

/** HKWorkoutActivityType, Apple's own numbers: each sport says its own
 * in src/sports (TASK-376 part B3). */
const ACTIVITY_TYPE = tableOf(
  (sport) => sport.appleWorkout as WorkoutActivityType,
) as Readonly<Record<RunActivity, WorkoutActivityType>>;

/** The distance of each activity, as Apple Health counts it a day. A day on
 * the snow (TASK-375) has none here: its own distances would be a new
 * permission to ask, so the workout keeps its total only. */
export const DISTANCE_TYPE = tableOf((sport) => sport.appleDistance) as Readonly<
  Record<Activity, QuantityTypeIdentifierWriteable>
>;

export const ENERGY_TYPE: QuantityTypeIdentifierWriteable =
  "HKQuantityTypeIdentifierActiveEnergyBurned";

/** Apple's «not known» for a location's height, course and speed. */
const NOT_KNOWN = -1;

export type AppleWorkout = {
  activityType: WorkoutActivityType;
  startDate: Date;
  endDate: Date;
  /** The distance and, for a run, the energy, as samples of the workout:
   * they count in the day's totals. */
  quantities: QuantitySampleForSaving[];
  /** The same, on the workout itself. */
  totals: { distance: number; energyBurned?: number };
  /** HealthKit's keys as their strings: HKMetadataKeySyncIdentifier,
   * HKMetadataKeySyncVersion, HKMetadataKeyIndoorWorkout. The library puts
   * them on the samples too. */
  metadata: {
    HKSyncIdentifier: string;
    HKSyncVersion: number;
    HKIndoorWorkout: boolean;
  };
  /** The route, for HKWorkoutRouteBuilder. */
  locations: LocationForSaving[];
};

/** One of the activities with a route, whose distance Apple Health counts. */
function isRouteActivity(activity: RunActivity): activity is Activity {
  return activity in DISTANCE_TYPE;
}

export function appleWorkout(workout: Workout): AppleWorkout {
  const startDate = new Date(workout.startMs);
  const endDate = new Date(workout.endMs);
  const quantities: QuantitySampleForSaving[] = [];
  const distanceType = isRouteActivity(workout.activity)
    ? DISTANCE_TYPE[workout.activity]
    : null;
  if (workout.distanceM > 0 && distanceType !== null) {
    quantities.push({
      quantityType: distanceType,
      quantity: workout.distanceM,
      unit: "m",
      startDate,
      endDate,
    });
  }
  if (workout.kcal !== null) {
    quantities.push({
      quantityType: ENERGY_TYPE,
      quantity: workout.kcal,
      unit: "kcal",
      startDate,
      endDate,
    });
  }
  return {
    activityType: ACTIVITY_TYPE[workout.activity],
    startDate,
    endDate,
    quantities,
    totals:
      workout.kcal === null
        ? { distance: workout.distanceM }
        : { distance: workout.distanceM, energyBurned: workout.kcal },
    metadata: {
      HKSyncIdentifier: workout.syncId,
      HKSyncVersion: SYNC_VERSION,
      // Every activity of MuW is outdoors: it follows the GPS.
      HKIndoorWorkout: false,
    },
    // MuW keeps no vertical accuracy, course or speed of a fix: Apple's −1
    // says so, and the height is then not taken as sure.
    locations: workout.route.map((place) => ({
      latitude: place.point[0],
      longitude: place.point[1],
      date: new Date(place.timeMs),
      horizontalAccuracy: place.accuracyM,
      altitude: place.altitudeM ?? 0,
      verticalAccuracy: NOT_KNOWN,
      course: NOT_KNOWN,
      speed: NOT_KNOWN,
    })),
  };
}
