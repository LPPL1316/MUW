import type { Track } from "../navigation/trackRecorder";
import { appleHealthPhone, type HealthKitModule } from "./appleHealth";
import { workoutOf } from "./workout";

// A fake of `@kingstinct/react-native-healthkit`: what the Health app
// allows, by type; paddling's distance missing as before iOS 18.

const START = Date.UTC(2026, 9, 28, 7, 0, 0);
const TRACK: Track = {
  fixes: [
    { point: [46.0679, 11.1211], timeMs: START, accuracyM: 5 },
    { point: [46.0701, 11.1243], timeMs: START + 300_000, accuracyM: 8 },
  ],
  distanceM: 1200,
};

function fakeKit(status: Record<string, number>, available = true) {
  const saveWorkoutRoute = jest.fn(async () => true);
  const kit = {
    isHealthDataAvailable: jest.fn(() => available),
    isObjectTypeAvailable: jest.fn(
      (type: string) => type !== "HKQuantityTypeIdentifierDistancePaddleSports",
    ),
    requestAuthorization: jest.fn(async () => true),
    authorizationStatusFor: jest.fn((type: string) => status[type] ?? 0),
    saveWorkoutSample: jest.fn(async () => ({ saveWorkoutRoute })),
  };
  return { kit, typed: kit as unknown as HealthKitModule, saveWorkoutRoute };
}

const ALL_ALLOWED = {
  HKWorkoutTypeIdentifier: 2,
  HKWorkoutRouteTypeIdentifier: 2,
  HKQuantityTypeIdentifierDistanceWalkingRunning: 2,
  HKQuantityTypeIdentifierDistanceCycling: 2,
  HKQuantityTypeIdentifierActiveEnergyBurned: 2,
};

test("the sheet asks to write only, what the phone has", async () => {
  const { kit, typed } = fakeKit({});
  await appleHealthPhone(typed).ask();
  expect(kit.requestAuthorization).toHaveBeenCalledWith({
    toShare: [
      "HKWorkoutTypeIdentifier",
      "HKWorkoutRouteTypeIdentifier",
      "HKQuantityTypeIdentifierDistanceWalkingRunning",
      "HKQuantityTypeIdentifierDistanceCycling",
      // A swim's (TASK-323 C2).
      "HKQuantityTypeIdentifierDistanceSwimming",
      "HKQuantityTypeIdentifierActiveEnergyBurned",
    ],
  });
});

test("the permission is the workout's", async () => {
  expect(await appleHealthPhone(fakeKit({}).typed).permission()).toBe("unasked");
  expect(
    await appleHealthPhone(fakeKit({ HKWorkoutTypeIdentifier: 1 }).typed).permission(),
  ).toBe("refused");
  expect(await appleHealthPhone(fakeKit(ALL_ALLOWED).typed).permission()).toBe(
    "allowed",
  );
  expect(await appleHealthPhone(fakeKit({}, false).typed).available()).toBe(false);
});

test("a run allowed: the workout with its samples, then its route", async () => {
  const { kit, typed, saveWorkoutRoute } = fakeKit(ALL_ALLOWED);
  const workout = workoutOf(TRACK, "running")!;
  expect(await appleHealthPhone(typed).write(workout)).toBe(true);
  expect(kit.saveWorkoutSample).toHaveBeenCalledTimes(1);
  const [type, quantities, start, end, totals, metadata] = kit.saveWorkoutSample.mock
    .calls[0] as unknown as [
    number,
    { quantityType: string }[],
    Date,
    Date,
    object,
    object,
  ];
  expect(type).toBe(37);
  expect(quantities.map((sample) => sample.quantityType)).toEqual([
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
    "HKQuantityTypeIdentifierActiveEnergyBurned",
  ]);
  expect(start).toEqual(new Date(START));
  expect(end).toEqual(new Date(START + 300_000));
  expect(totals).toEqual({ distance: 1200, energyBurned: workout.kcal });
  expect(metadata).toEqual({
    HKSyncIdentifier: workout.syncId,
    HKSyncVersion: 1,
    HKIndoorWorkout: false,
  });
  expect(saveWorkoutRoute).toHaveBeenCalledWith([
    expect.objectContaining({ latitude: 46.0679, longitude: 11.1211 }),
    expect.objectContaining({ latitude: 46.0701, longitude: 11.1243 }),
  ]);
});

test("what the Health app turned off is not written", async () => {
  const { kit, typed, saveWorkoutRoute } = fakeKit({
    ...ALL_ALLOWED,
    HKWorkoutRouteTypeIdentifier: 1,
    HKQuantityTypeIdentifierActiveEnergyBurned: 1,
  });
  await appleHealthPhone(typed).write(workoutOf(TRACK, "running")!);
  const quantities = (
    kit.saveWorkoutSample.mock.calls[0] as unknown as [
      number,
      { quantityType: string }[],
    ]
  )[1];
  expect(quantities.map((sample) => sample.quantityType)).toEqual([
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
  ]);
  expect(saveWorkoutRoute).not.toHaveBeenCalled();
});

test("a paddle before iOS 18: the workout keeps its total, no sample", async () => {
  const { kit, typed } = fakeKit(ALL_ALLOWED);
  await appleHealthPhone(typed).write(workoutOf(TRACK, "paddling")!);
  const [type, quantities, , , totals] = kit.saveWorkoutSample.mock
    .calls[0] as unknown as [number, unknown[], Date, Date, object];
  expect(type).toBe(31);
  expect(quantities).toEqual([]);
  expect(totals).toEqual({ distance: 1200 });
});

test("the workout turned off: nothing is written", async () => {
  const { kit, typed } = fakeKit({ ...ALL_ALLOWED, HKWorkoutTypeIdentifier: 1 });
  expect(await appleHealthPhone(typed).write(workoutOf(TRACK, "running")!)).toBe(false);
  expect(kit.saveWorkoutSample).not.toHaveBeenCalled();
});
