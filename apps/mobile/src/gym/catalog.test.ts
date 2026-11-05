import catalog from "@shaperoute/shared-types/fixtures/gym-exercises.json";

import { LANGUAGES } from "../i18n/languages";
import { exerciseName, GYM_EXERCISES, gymExercise } from "./catalog";

// TASK-385 (ADR-0327): the app's catalog is the one the API checks sets
// against (fixtures/gym-exercises.json, gym_catalog.py), with the names of
// docs/sports/gym.md in every language of the app.

test("the catalog is the API's, in its order", () => {
  expect(GYM_EXERCISES.map(({ key, group, kind }) => ({ key, group, kind }))).toEqual(
    catalog.exercises.map(({ key, group, kind }) => ({ key, group, kind })),
  );
  expect(GYM_EXERCISES).toHaveLength(91);
});

test("every exercise has a name in every language of the app", () => {
  for (const exercise of GYM_EXERCISES) {
    for (const { id } of LANGUAGES) {
      expect(exercise.names[id].trim()).not.toBe("");
    }
  }
  expect(gymExercise("bench_press")?.names.it).toBe("Panca piana");
  expect(gymExercise("lat_pulldown")?.names.it).toBe("Lat machine");
  expect(gymExercise("treadmill")?.names.de).toBe("Laufband");
});

test("a set is named by its exercise, or by the name its runner wrote", () => {
  expect(exerciseName({ exercise: "bench_press" }, "fr")).toBe("Développé couché");
  expect(exerciseName({ name: "Sled push" }, "it")).toBe("Sled push");
  // A key newer than the app, in words.
  expect(exerciseName({ exercise: "sled_pull" }, "en")).toBe("Sled pull");
});
