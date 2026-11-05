import request from "@shaperoute/shared-types/fixtures/gym-session.json";
import type { GymSessionRequest } from "@shaperoute/shared-types";

import {
  GYM_OUTBOX_FILE,
  gymToSend,
  keepGymWaiting,
  loadGymOutbox,
  MAX_GYM_WAITING,
  refuseGymWaiting,
  stopGymWaiting,
} from "./gymOutbox";
import { chooseExercise, logSet, newWorkout } from "./workout";
import { isWorkout, loadWorkout, saveWorkout, WORKOUT_FILE } from "./workoutStore";

// TASK-385 part B: the workout under way and the workouts waiting for the
// API, in files of the phone.

jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");

const BODY = request as GymSessionRequest;
const T0 = Date.UTC(2026, 10, 5, 17);

beforeEach(() => {
  files.clear();
});

test("a workout under way is there at the next opening, with its sets", () => {
  expect(loadWorkout()).toBeNull();
  const going = logSet(
    chooseExercise(newWorkout("key12345", T0), { exercise: "squat", kind: "load" }, T0),
    { reps: 5, load_kg: 100 },
    T0 + 60_000,
  );
  expect(saveWorkout(going)).toBe(true);
  expect(files.has(`file:///documents/${WORKOUT_FILE}`)).toBe(true);
  expect(loadWorkout()).toEqual(going);
  saveWorkout(null);
  expect(loadWorkout()).toBeNull();
});

test("a file that is no workout is none", () => {
  files.set(`file:///documents/${WORKOUT_FILE}`, JSON.stringify([{ key: 3 }]));
  expect(loadWorkout()).toBeNull();
  expect(isWorkout(newWorkout("key12345", T0))).toBe(true);
  expect(isWorkout({ ...newWorkout("key12345", T0), sets: [{ n: 1 }] })).toBe(false);
});

test("a workout saved waits once, until the API has it", () => {
  expect(keepGymWaiting({ owner: 1, key: "a1234567", request: BODY })).toBe("kept");
  expect(keepGymWaiting({ owner: 1, key: "a1234567", request: BODY })).toBe("kept");
  keepGymWaiting({ owner: 2, key: "b1234567", request: BODY });
  expect(loadGymOutbox()).toHaveLength(2);
  expect(files.has(`file:///documents/${GYM_OUTBOX_FILE}`)).toBe(true);
  expect(gymToSend(1).map((item) => item.key)).toEqual(["a1234567"]);
  stopGymWaiting(1, "a1234567");
  expect(gymToSend(1)).toEqual([]);
  expect(gymToSend(2)).toHaveLength(1);
});

test("a workout the API will not take is not sent again", () => {
  keepGymWaiting({ owner: 1, key: "a1234567", request: BODY });
  refuseGymWaiting(1, "a1234567", { code: "invalid_request", message: "no" });
  expect(gymToSend(1)).toEqual([]);
  expect(loadGymOutbox()[0].refused).toEqual({
    code: "invalid_request",
    message: "no",
  });
});

test("an account holds at most twenty on the phone", () => {
  for (let n = 0; n < MAX_GYM_WAITING; n += 1) {
    expect(keepGymWaiting({ owner: 1, key: `k${n}aaaaaaa`, request: BODY })).toBe(
      "kept",
    );
  }
  expect(keepGymWaiting({ owner: 1, key: "overflow1", request: BODY })).toBe("full");
  expect(keepGymWaiting({ owner: 2, key: "another1", request: BODY })).toBe("kept");
});
