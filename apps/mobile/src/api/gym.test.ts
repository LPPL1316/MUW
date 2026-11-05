import session from "@shaperoute/shared-types/fixtures/gym-session.json";

import { answers, apiError } from "../account/testing";
import { fetchGymExercises, isGymExercises, isGymSet } from "./gym";

const URL = "http://api";
const TOKEN = "the-token";
const ID = "0b8f8a1e-7c1d-4d2a-9f3e-2a6c5b4d3e21";
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });
const EXERCISES = { rests: session.rests, rest_s: session.rest_s, sets: session.sets };

test("the example of the API is what the app reads", () => {
  expect(isGymExercises(EXERCISES)).toBe(true);
  expect(isGymExercises({ rests: 0, rest_s: 0, sets: [] })).toBe(true);
});

test("a set that is not one is not read", () => {
  const set = {
    exercise: "bench_press",
    kind: "load",
    reps: 5,
    load_kg: 80,
    at_s: 9,
    live: true,
  };
  expect(isGymSet(set)).toBe(true);
  expect(isGymSet({ ...set, exercise: undefined })).toBe(false);
  expect(isGymSet({ ...set, name: "Bench" })).toBe(false);
  expect(isGymSet({ ...set, kind: "yoga" })).toBe(false);
  expect(isGymSet({ ...set, reps: 1.5 })).toBe(false);
  expect(isGymSet({ ...set, load_kg: Number.NaN })).toBe(false);
  expect(isGymSet({ ...set, live: undefined })).toBe(false);
  expect(isGymExercises({ rests: 1, sets: [] })).toBe(false);
});

test("the exercises are asked by the drawing's id, saying the app reads them", async () => {
  const fetchFn = answers({ status: 200, body: EXERCISES });
  expect(await fetchGymExercises(URL, TOKEN, ID, options(fetchFn))).toEqual({
    kind: "ok",
    value: EXERCISES,
  });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/drawings/${ID}/exercises`);
  const headers = init?.headers as Record<string, string>;
  expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  expect(headers["X-MuW-Reads"].split(",")).toEqual(
    expect.arrayContaining(["gym", "trackless"]),
  );
});

test("exercises hidden by their owner are an error, not exercises", async () => {
  const fetchFn = answers({ status: 404, body: apiError("not_found") });
  const outcome = await fetchGymExercises(URL, TOKEN, ID, options(fetchFn));
  expect(outcome.kind).toBe("api_error");
});
