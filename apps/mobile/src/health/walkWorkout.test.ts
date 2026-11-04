import { NO_BODY } from "../body/bodyProfile";
import type { Track } from "../navigation/trackRecorder";
import { appleWorkout, DISTANCE_TYPE } from "./appleWorkout";
import { healthConnectWorkout } from "./healthConnectWorkout";
import { workoutOf } from "./workout";

// A walk of 1 km in 12 minutes (TASK-371): two fixes, no climb.
const START = Date.UTC(2026, 10, 4, 8, 0, 0);
const WALK: Track = {
  fixes: [
    { point: [46.0671, 11.1214], timeMs: START, accuracyM: 5 },
    { point: [46.0761, 11.1214], timeMs: START + 720_000, accuracyM: 5 },
  ],
  distanceM: 1000,
  pauses: [],
};

test("a walk goes to Apple Health as a walk, with its distance and energy", () => {
  const workout = workoutOf(WALK, "walking", NO_BODY);
  // (3.5 × 12 + 0.1 × 1000) ml/kg × 70 kg × 5 kcal/L − 1.225 × 12 at rest.
  expect(workout).toMatchObject({ activity: "walking", distanceM: 1000, kcal: 35 });
  const apple = appleWorkout(workout!);
  // HKWorkoutActivityType.walking.
  expect(apple.activityType).toBe(52);
  expect(apple.quantities.map((sample) => sample.quantityType)).toEqual([
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
    "HKQuantityTypeIdentifierActiveEnergyBurned",
  ]);
  expect(DISTANCE_TYPE.walking).toBe(DISTANCE_TYPE.running);
});

test("a walk goes to Health Connect as walking, with its calories", () => {
  const records = healthConnectWorkout(workoutOf(WALK, "walking", NO_BODY)!);
  // ExerciseSessionRecord.EXERCISE_TYPE_WALKING.
  expect(records.session.exerciseType).toBe(79);
  expect(records.calories).not.toBeNull();
});
