import { activityKey } from "../activities/activityKey";
import { kcal } from "../navigation/runMetrics";
import type { Track } from "../navigation/trackRecorder";
import { appleWorkout } from "./appleWorkout";
import { healthConnectWorkout } from "./healthConnectWorkout";
import { workoutOf } from "./workout";

// A run in Trento: four fixes over ten minutes, a pause in the middle, one
// fix without its accuracy and one without its height.
const START = Date.UTC(2026, 9, 28, 7, 0, 0);
const TRACK: Track = {
  fixes: [
    { point: [46.0679, 11.1211], timeMs: START, accuracyM: 5, altitudeM: 194 },
    { point: [46.0688, 11.1226], timeMs: START + 120_000, accuracyM: null },
    { point: [46.0701, 11.1243], timeMs: START + 300_000, accuracyM: 8 },
    {
      point: [46.0714, 11.1262],
      timeMs: START + 600_000,
      accuracyM: 4,
      altitudeM: 201.5,
    },
  ],
  distanceM: 2480,
  pauses: [
    { fromMs: START + 200_000, toMs: START + 260_000 },
    // Stopped while paused: after the last fix, not of the run.
    { fromMs: START + 600_000, toMs: null },
  ],
};

describe("workoutOf", () => {
  test("a run: from the first fix to the last, its metres, its calories", () => {
    const workout = workoutOf(TRACK, "running");
    expect(workout).toEqual({
      activity: "running",
      startMs: START,
      endMs: START + 600_000,
      distanceM: 2480,
      kcal: kcal(2480),
      route: [
        { point: [46.0679, 11.1211], timeMs: START, accuracyM: 5, altitudeM: 194 },
        {
          point: [46.0701, 11.1243],
          timeMs: START + 300_000,
          accuracyM: 8,
          altitudeM: null,
        },
        {
          point: [46.0714, 11.1262],
          timeMs: START + 600_000,
          accuracyM: 4,
          altitudeM: 201.5,
        },
      ],
      pauses: [{ fromMs: START + 200_000, toMs: START + 260_000 }],
      syncId: activityKey(TRACK.fixes[0]),
    });
    expect(workout?.kcal).toBe(180);
  });

  test("calories only for a run: a ride and a paddle have none", () => {
    expect(workoutOf(TRACK, "cycling")?.kcal).toBeNull();
    expect(workoutOf(TRACK, "paddling")?.kcal).toBeNull();
    expect(workoutOf(TRACK, "cycling")?.activity).toBe("cycling");
  });

  test("the same run written twice has the same key", () => {
    const again: Track = JSON.parse(JSON.stringify(TRACK));
    expect(workoutOf(again, "running")?.syncId).toBe(
      workoutOf(TRACK, "running")?.syncId,
    );
    const other: Track = {
      ...TRACK,
      fixes: [{ ...TRACK.fixes[0], timeMs: START + 1 }, ...TRACK.fixes.slice(1)],
    };
    expect(workoutOf(other, "running")?.syncId).not.toBe(
      workoutOf(TRACK, "running")?.syncId,
    );
  });

  test("nothing without two fixes and some time between them", () => {
    expect(workoutOf({ fixes: [], distanceM: 0 }, "running")).toBeNull();
    expect(workoutOf({ fixes: [TRACK.fixes[0]], distanceM: 0 }, "running")).toBeNull();
    expect(
      workoutOf(
        { fixes: [TRACK.fixes[0], { ...TRACK.fixes[3], timeMs: START }], distanceM: 9 },
        "running",
      ),
    ).toBeNull();
  });

  test("a track before TASK-169 has no pauses; a run too short no calories", () => {
    const short: Track = {
      fixes: [TRACK.fixes[0], { ...TRACK.fixes[2], timeMs: START + 3_000 }],
      distanceM: 6,
    };
    expect(workoutOf(short, "running")).toMatchObject({ pauses: [], kcal: null });
  });
});

describe("appleWorkout", () => {
  const workout = workoutOf(TRACK, "running")!;

  test("a run: HKWorkoutActivityType.running, its distance and energy", () => {
    const apple = appleWorkout(workout);
    expect(apple.activityType).toBe(37);
    expect(apple.startDate).toEqual(new Date(START));
    expect(apple.endDate).toEqual(new Date(START + 600_000));
    expect(apple.quantities).toEqual([
      {
        quantityType: "HKQuantityTypeIdentifierDistanceWalkingRunning",
        quantity: 2480,
        unit: "m",
        startDate: new Date(START),
        endDate: new Date(START + 600_000),
      },
      {
        quantityType: "HKQuantityTypeIdentifierActiveEnergyBurned",
        quantity: 180,
        unit: "kcal",
        startDate: new Date(START),
        endDate: new Date(START + 600_000),
      },
    ]);
    expect(apple.totals).toEqual({ distance: 2480, energyBurned: 180 });
    expect(apple.metadata).toEqual({
      HKSyncIdentifier: workout.syncId,
      HKSyncVersion: 1,
      HKIndoorWorkout: false,
    });
  });

  test("a ride and a paddle: their own type and distance, no energy", () => {
    const ride = appleWorkout(workoutOf(TRACK, "cycling")!);
    expect(ride.activityType).toBe(13);
    expect(ride.quantities.map((sample) => sample.quantityType)).toEqual([
      "HKQuantityTypeIdentifierDistanceCycling",
    ]);
    expect(ride.totals).toEqual({ distance: 2480 });
    const paddle = appleWorkout(workoutOf(TRACK, "paddling")!);
    expect(paddle.activityType).toBe(31);
    expect(paddle.quantities.map((sample) => sample.quantityType)).toEqual([
      "HKQuantityTypeIdentifierDistancePaddleSports",
    ]);
  });

  test("the route: Apple's −1 for what MuW does not know", () => {
    const { locations } = appleWorkout(workout);
    expect(locations).toHaveLength(3);
    expect(locations[0]).toEqual({
      latitude: 46.0679,
      longitude: 11.1211,
      date: new Date(START),
      horizontalAccuracy: 5,
      altitude: 194,
      verticalAccuracy: -1,
      course: -1,
      speed: -1,
    });
    expect(locations[1]).toMatchObject({ altitude: 0, verticalAccuracy: -1 });
  });
});

describe("healthConnectWorkout", () => {
  const workout = workoutOf(TRACK, "running")!;

  test("a run: the session with its route and pauses, the distance, the calories", () => {
    const records = healthConnectWorkout(workout);
    expect(records.session).toEqual({
      recordType: "ExerciseSession",
      exerciseType: 56,
      startTime: "2026-10-28T07:00:00.000Z",
      endTime: "2026-10-28T07:10:00.000Z",
      segments: [
        {
          startTime: "2026-10-28T07:03:20.000Z",
          endTime: "2026-10-28T07:04:20.000Z",
          segmentType: 39,
          repetitions: 0,
        },
      ],
      exerciseRoute: {
        route: [
          {
            time: "2026-10-28T07:00:00.000Z",
            latitude: 46.0679,
            longitude: 11.1211,
            horizontalAccuracy: { value: 5, unit: "meters" },
            altitude: { value: 194, unit: "meters" },
          },
          {
            time: "2026-10-28T07:05:00.000Z",
            latitude: 46.0701,
            longitude: 11.1243,
            horizontalAccuracy: { value: 8, unit: "meters" },
          },
          {
            time: "2026-10-28T07:10:00.000Z",
            latitude: 46.0714,
            longitude: 11.1262,
            horizontalAccuracy: { value: 4, unit: "meters" },
            altitude: { value: 201.5, unit: "meters" },
          },
        ],
      },
      metadata: {
        clientRecordId: workout.syncId,
        clientRecordVersion: 1,
        recordingMethod: 1,
      },
    });
    expect(records.distance).toEqual({
      recordType: "Distance",
      startTime: "2026-10-28T07:00:00.000Z",
      endTime: "2026-10-28T07:10:00.000Z",
      distance: { value: 2480, unit: "meters" },
      metadata: {
        clientRecordId: `${workout.syncId}-distance`,
        clientRecordVersion: 1,
        recordingMethod: 1,
      },
    });
    expect(records.calories).toMatchObject({
      recordType: "ActiveCaloriesBurned",
      energy: { value: 180, unit: "kilocalories" },
      metadata: { clientRecordId: `${workout.syncId}-calories` },
    });
  });

  test("a ride and a paddle: their exercise type, no calories", () => {
    const ride = healthConnectWorkout(workoutOf(TRACK, "cycling")!);
    expect(ride.session.exerciseType).toBe(8);
    expect(ride.calories).toBeNull();
    const paddle = healthConnectWorkout(workoutOf(TRACK, "paddling")!);
    expect(paddle.session.exerciseType).toBe(46);
    expect(paddle.calories).toBeNull();
  });

  test("no metres, no distance record", () => {
    const still = workoutOf({ ...TRACK, distanceM: 0 }, "running")!;
    expect(healthConnectWorkout(still).distance).toBeNull();
    expect(appleWorkout(still).quantities).toEqual([]);
  });
});
