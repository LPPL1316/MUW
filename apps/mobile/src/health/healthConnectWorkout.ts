import type { Activity } from "@shaperoute/shared-types";
import type {
  ActiveCaloriesBurnedRecord,
  DistanceRecord,
  ExerciseSessionRecord,
  RecordingMethod,
} from "react-native-health-connect";

import { SYNC_VERSION, type Workout } from "./workout";

/**
 * A workout as Health Connect takes it (TASK-321, ADR-0281), in the shape
 * of `insertRecords` of `react-native-health-connect`: an exercise session
 * with its route and pauses, its distance and, for a run, its calories.
 * Pure: only types come from the library, never its code.
 */

/** ExerciseSessionRecord.EXERCISE_TYPE_…, Health Connect's own numbers
 * (WALKING is 79, for when MuW has walks). */
const EXERCISE_TYPE: Readonly<Record<Activity, number>> = {
  running: 56,
  cycling: 8,
  paddling: 46,
  // EXERCISE_TYPE_SWIMMING_OPEN_WATER (TASK-323).
  swimming: 73,
};

/** ExerciseSegment.EXERCISE_SEGMENT_TYPE_PAUSE: right for every exercise. */
const PAUSE_SEGMENT = 39;

/** Metadata.RECORDING_METHOD_ACTIVELY_RECORDED: the phone recorded it as
 * it happened. */
const ACTIVELY_RECORDED = 1 as RecordingMethod;

export type HealthConnectWorkout = {
  session: ExerciseSessionRecord;
  /** Null without metres. */
  distance: DistanceRecord | null;
  /** Null but for a run (the user's choice). */
  calories: ActiveCaloriesBurnedRecord | null;
};

/** Each record of a run has its own client id, from the run's key: the
 * session the key itself. Health Connect keeps one record per id. */
function metadata(clientRecordId: string) {
  return {
    clientRecordId,
    clientRecordVersion: SYNC_VERSION,
    recordingMethod: ACTIVELY_RECORDED,
  };
}

export function healthConnectWorkout(workout: Workout): HealthConnectWorkout {
  const startTime = new Date(workout.startMs).toISOString();
  const endTime = new Date(workout.endMs).toISOString();
  return {
    session: {
      recordType: "ExerciseSession",
      exerciseType: EXERCISE_TYPE[workout.activity],
      startTime,
      endTime,
      segments: workout.pauses.map((pause) => ({
        startTime: new Date(pause.fromMs).toISOString(),
        endTime: new Date(pause.toMs).toISOString(),
        segmentType: PAUSE_SEGMENT,
        repetitions: 0,
      })),
      // MuW keeps no vertical accuracy of a fix: left out, as the height
      // when the phone gave none.
      exerciseRoute: {
        route: workout.route.map((place) => ({
          time: new Date(place.timeMs).toISOString(),
          latitude: place.point[0],
          longitude: place.point[1],
          horizontalAccuracy: { value: place.accuracyM, unit: "meters" },
          ...(place.altitudeM === null
            ? {}
            : { altitude: { value: place.altitudeM, unit: "meters" } }),
        })),
      },
      metadata: metadata(workout.syncId),
    },
    distance:
      workout.distanceM > 0
        ? {
            recordType: "Distance",
            startTime,
            endTime,
            distance: { value: workout.distanceM, unit: "meters" },
            metadata: metadata(`${workout.syncId}-distance`),
          }
        : null,
    calories:
      workout.kcal === null
        ? null
        : {
            recordType: "ActiveCaloriesBurned",
            startTime,
            endTime,
            energy: { value: workout.kcal, unit: "kilocalories" },
            metadata: metadata(`${workout.syncId}-calories`),
          },
  };
}
