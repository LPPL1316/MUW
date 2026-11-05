import session from "@shaperoute/shared-types/fixtures/gym-session.json";
import type { GymExercises, GymSet } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { ExerciseList, restsLabel, rowsOf, setLabel } from "./ExerciseList";

// TASK-385 B0 (ADR-0327): the exercises on the post of a workout at the gym.

const EXERCISES = {
  rests: session.rests,
  rest_s: session.rest_s,
  sets: session.sets,
} as GymExercises;

test("each exercise once, in the order first done, with its sets", () => {
  const rows = rowsOf(EXERCISES.sets, "it");
  expect(rows.map((row) => row.name)).toEqual([
    "Tapis roulant",
    "Panca piana",
    "Lat machine",
    "Trazioni",
    "Dip alle parallele",
    "Plank",
    "Sled push",
    "Curl con manubri",
  ]);
  expect(rows[1].sets).toHaveLength(3);
});

test("a set reads as its kind says, in kg or lb", () => {
  const [treadmill, bench, , , , pullUp, dips, plank] = EXERCISES.sets;
  expect(setLabel(bench, "km")).toBe("60 kg × 10");
  expect(setLabel(bench, "mi")).toBe("132.3 lb × 10");
  expect(setLabel(pullUp, "km")).toBe("×6");
  expect(setLabel(dips, "km")).toBe("+10 kg × 8");
  expect(setLabel(plank, "km")).toBe("1:30");
  expect(setLabel(treadmill, "km")).toBe("10:00 · 1.6 km");
  const bare: GymSet = {
    exercise: "stepper",
    kind: "cardio",
    duration_s: 60,
    at_s: 0,
    live: true,
  };
  expect(setLabel(bare, "km")).toBe("1:00");
});

test("the rests are told only when there were some", () => {
  expect(restsLabel(EXERCISES)).toBe("6 rests · avg 1:30 · 9:00 resting");
  expect(restsLabel({ ...EXERCISES, rests: 0, rest_s: 0 })).toBeNull();
});

test("the list says how many exercises and sets", async () => {
  await render(<ExerciseList exercises={EXERCISES} />);
  expect(screen.getByText("8 exercises · 10 sets")).toBeOnTheScreen();
  expect(screen.getByText("Bench press")).toBeOnTheScreen();
  expect(screen.getByText("60 kg × 10 · 70 kg × 8 · 80 kg × 5")).toBeOnTheScreen();
  expect(screen.getByText("6 rests · avg 1:30 · 9:00 resting")).toBeOnTheScreen();
});

test("a workout without sets shows no list", async () => {
  await render(<ExerciseList exercises={{ rests: 0, rest_s: 0, sets: [] }} />);
  expect(screen.queryByTestId("gym-exercises")).toBeNull();
});
