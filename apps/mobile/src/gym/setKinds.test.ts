import catalog from "@shaperoute/shared-types/fixtures/gym-exercises.json";

import {
  CARDIO_FIELDS,
  catalogEntry,
  entryKey,
  fieldsOf,
  fieldText,
  fieldUnit,
  readDuration,
  readField,
  sameEntry,
  setOf,
  valuesOf,
} from "./setKinds";

// TASK-385 part B: the fields of a set by its kind, within the API's bounds.

type Row = { key: string; kind: string; fields?: string[] };
const ROWS = ((catalog as { exercises?: Row[] }).exercises ??
  (catalog as unknown as Row[])) as Row[];

test("each machine shows what the API's catalog says it shows", () => {
  const cardio = ROWS.filter((row) => row.kind === "cardio");
  expect(Object.keys(CARDIO_FIELDS).sort()).toEqual(
    cardio.map((row) => row.key).sort(),
  );
  for (const row of cardio) {
    expect(CARDIO_FIELDS[row.key]).toEqual(row.fields);
  }
});

test("the fields of each kind, in the order they are typed", () => {
  expect(fieldsOf({ exercise: "bench_press", kind: "load" })).toEqual([
    "reps",
    "load_kg",
  ]);
  expect(fieldsOf({ exercise: "pull_up", kind: "bodyweight" })).toEqual([
    "reps",
    "load_kg",
  ]);
  expect(fieldsOf({ exercise: "plank", kind: "timed" })).toEqual(["duration_s"]);
  expect(fieldsOf({ exercise: "treadmill", kind: "cardio" })).toEqual([
    "duration_s",
    "distance_m",
    "speed_kmh",
    "incline_pct",
  ]);
  expect(fieldsOf({ name: "Sled", kind: "cardio" })).toEqual([
    "duration_s",
    "distance_m",
  ]);
});

test("a set needs the fields of its kind, within the API's bounds", () => {
  const bench = { exercise: "bench_press", kind: "load" } as const;
  expect(setOf(bench, { reps: 10, load_kg: 60 }, 300, true)).toEqual({
    exercise: "bench_press",
    kind: "load",
    reps: 10,
    load_kg: 60,
    at_s: 300,
    live: true,
  });
  expect(setOf(bench, { reps: 10 }, 300, true)).toBeNull();
  expect(setOf(bench, { reps: 0, load_kg: 60 }, 300, true)).toBeNull();
  expect(setOf(bench, { reps: 5, load_kg: 2_500 }, 300, true)).toBeNull();
  // Reps are whole; kg to a hundredth.
  expect(setOf(bench, { reps: 9.6, load_kg: 22.6796 }, 1, true)).toMatchObject({
    reps: 10,
    load_kg: 22.68,
  });
});

test("the body's set: reps, and a weight only when one is added", () => {
  const dips = { exercise: "dips", kind: "bodyweight" } as const;
  expect(setOf(dips, { reps: 12, load_kg: 0 }, 5, true)).toEqual({
    exercise: "dips",
    kind: "bodyweight",
    reps: 12,
    at_s: 5,
    live: true,
  });
  expect(setOf(dips, { reps: 8, load_kg: 10 }, 5, true)?.load_kg).toBe(10);
});

test("a named exercise keeps its name, 1 to 40 characters", () => {
  expect(
    setOf({ name: "  Sled push ", kind: "timed" }, { duration_s: 40 }, 0, true),
  ).toEqual({
    name: "Sled push",
    kind: "timed",
    duration_s: 40,
    at_s: 0,
    live: true,
  });
  expect(setOf({ name: " ", kind: "timed" }, { duration_s: 40 }, 0, true)).toBeNull();
  expect(
    setOf({ name: "x".repeat(41), kind: "timed" }, { duration_s: 40 }, 0, true),
  ).toBeNull();
});

test("a field that is not of the kind is left out", () => {
  const set = setOf(
    { exercise: "stepper", kind: "cardio" },
    { duration_s: 600, distance_m: 900, level: 8 },
    0,
    true,
  );
  expect(set).toEqual({
    exercise: "stepper",
    kind: "cardio",
    duration_s: 600,
    level: 8,
    at_s: 0,
    live: true,
  });
  expect(valuesOf(set!)).toEqual({ duration_s: 600, level: 8 });
});

test("a time typed: m:ss, h:mm:ss, or seconds of a timed set and minutes of cardio", () => {
  expect(readDuration("1:30", "timed")).toBe(90);
  expect(readDuration("1:02:00", "cardio")).toBe(3720);
  expect(readDuration("45", "timed")).toBe(45);
  expect(readDuration("20", "cardio")).toBe(1200);
  expect(readDuration("1:75", "timed")).toBeNull();
  expect(readDuration("soon", "timed")).toBeNull();
});

test("weights, distances and speeds are typed in the app's units and kept in the API's", () => {
  expect(readField("load_kg", "100", "load", "km")).toBe(100);
  expect(readField("load_kg", "100", "load", "mi")).toBeCloseTo(45.359, 2);
  expect(readField("distance_m", "1,6", "cardio", "km")).toBe(1600);
  expect(readField("distance_m", "1", "cardio", "mi")).toBe(1609);
  expect(readField("speed_kmh", "6", "cardio", "mi")).toBeCloseTo(9.656, 2);
  expect(readField("incline_pct", "-2.5", "cardio", "km")).toBe(-2.5);
  expect(readField("reps", "-2", "load", "km")).toBeNull();
});

test("and shown again as they were typed, with their unit", () => {
  expect(fieldText("duration_s", 90, "km")).toBe("1:30");
  expect(fieldText("load_kg", 45.359237, "mi")).toBe("100");
  expect(fieldText("distance_m", 1600, "km")).toBe("1.6");
  expect(fieldUnit("load_kg", "mi")).toBe("lb");
  expect(fieldUnit("speed_kmh", "km")).toBe("km/h");
  expect(fieldUnit("reps", "km")).toBeNull();
});

test("an exercise is told apart by its key, or by its name whatever the case", () => {
  expect(entryKey({ name: " Sled Push", kind: "timed" })).toBe(
    entryKey({ name: "sled push", kind: "timed" }),
  );
  expect(
    sameEntry({ exercise: "squat", kind: "load" }, { exercise: "squat", kind: "load" }),
  ).toBe(true);
  expect(
    sameEntry({ name: "squat", kind: "load" }, { exercise: "squat", kind: "load" }),
  ).toBe(false);
  expect(catalogEntry("treadmill")).toEqual({ exercise: "treadmill", kind: "cardio" });
  expect(catalogEntry("nothing")).toBeNull();
});
