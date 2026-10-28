import type { HealthConnectRecord } from "react-native-health-connect";

import type { Track } from "../navigation/trackRecorder";
import { healthConnectPhone, type HealthConnectModule } from "./healthConnect";
import { workoutOf } from "./workout";

// A fake of `react-native-health-connect`: what Health Connect granted.

const START = Date.UTC(2026, 9, 28, 7, 0, 0);
const TRACK: Track = {
  fixes: [
    { point: [46.0679, 11.1211], timeMs: START, accuracyM: 5 },
    { point: [46.0701, 11.1243], timeMs: START + 300_000, accuracyM: 8 },
  ],
  distanceM: 1200,
};

type Permission = { accessType: "read" | "write"; recordType: string };

function write(recordType: string): Permission {
  return { accessType: "write", recordType };
}

function fakeConnect(granted: Permission[], sdkStatus = 3) {
  const inserted: HealthConnectRecord[][] = [];
  const hc = {
    getSdkStatus: jest.fn(async () => sdkStatus),
    initialize: jest.fn(async () => true),
    requestPermission: jest.fn(async (asked: Permission[]) => asked),
    getGrantedPermissions: jest.fn(async () => granted),
    insertRecords: jest.fn(async (records: HealthConnectRecord[]) => {
      inserted.push(records);
      return records.map(() => "id");
    }),
  };
  return { hc, typed: hc as HealthConnectModule, inserted };
}

const ALL = [
  write("ExerciseSession"),
  write("ExerciseRoute"),
  write("Distance"),
  write("ActiveCaloriesBurned"),
];

test("without Health Connect there is no line, and nothing is asked", async () => {
  const { hc, typed } = fakeConnect([], 1);
  const phone = healthConnectPhone(typed);
  expect(await phone.available()).toBe(false);
  await phone.ask();
  expect(hc.initialize).not.toHaveBeenCalled();
  expect(hc.requestPermission).not.toHaveBeenCalled();
});

test("the sheet asks to write only: the session, its route, distance, calories", async () => {
  const { hc, typed } = fakeConnect([]);
  const phone = healthConnectPhone(typed);
  expect(await phone.available()).toBe(true);
  await phone.ask();
  expect(hc.initialize).toHaveBeenCalledTimes(1);
  expect(hc.requestPermission).toHaveBeenCalledWith(ALL);
});

test("the permission is the session's", async () => {
  expect(await healthConnectPhone(fakeConnect([]).typed).permission()).toBe("refused");
  expect(
    await healthConnectPhone(
      fakeConnect([{ accessType: "read", recordType: "ExerciseSession" }]).typed,
    ).permission(),
  ).toBe("refused");
  expect(await healthConnectPhone(fakeConnect(ALL).typed).permission()).toBe("allowed");
});

test("a run allowed: the session with its route, the distance, the calories", async () => {
  const { typed, inserted } = fakeConnect(ALL);
  const workout = workoutOf(TRACK, "running")!;
  expect(await healthConnectPhone(typed).write(workout)).toBe(true);
  expect(inserted.map((records) => records.map((record) => record.recordType))).toEqual(
    [["ExerciseSession"], ["Distance"], ["ActiveCaloriesBurned"]],
  );
  expect(inserted[0][0]).toMatchObject({
    exerciseType: 56,
    exerciseRoute: { route: [{ latitude: 46.0679 }, { latitude: 46.0701 }] },
    metadata: { clientRecordId: workout.syncId },
  });
});

test("what Health Connect did not grant is not written", async () => {
  const { typed, inserted } = fakeConnect([write("ExerciseSession")]);
  await healthConnectPhone(typed).write(workoutOf(TRACK, "running")!);
  expect(inserted).toHaveLength(1);
  expect(inserted[0][0].recordType).toBe("ExerciseSession");
  expect(inserted[0][0]).not.toHaveProperty("exerciseRoute");
});

test("a ride: no calories", async () => {
  const { typed, inserted } = fakeConnect(ALL);
  await healthConnectPhone(typed).write(workoutOf(TRACK, "cycling")!);
  expect(inserted.map((records) => records[0].recordType)).toEqual([
    "ExerciseSession",
    "Distance",
  ]);
});

test("the session not granted: nothing is written", async () => {
  const { typed, inserted } = fakeConnect([write("Distance")]);
  expect(await healthConnectPhone(typed).write(workoutOf(TRACK, "running")!)).toBe(
    false,
  );
  expect(inserted).toEqual([]);
});
