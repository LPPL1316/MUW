import session from "@shaperoute/shared-types/fixtures/gym-session.json";

import { answers, apiError } from "../account/testing";
import type { GymSessionRequest } from "@shaperoute/shared-types";

import {
  fetchGymExercises,
  isGymExercises,
  isGymSession,
  isGymSet,
  saveGymSession,
} from "./gym";

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

// TASK-385 part B: «Save» of a workout.

const SAVED = {
  id: "key12345",
  started_at: session.started_at,
  duration_s: 3600,
  rests: session.rests,
  rest_s: session.rest_s,
  show_exercises: true,
  sets: session.sets,
};

test("a workout saved is what the API gives back", () => {
  expect(isGymSession(SAVED)).toBe(true);
  expect(isGymSession({ ...SAVED, duration_s: -1 })).toBe(false);
  expect(isGymSession({ ...SAVED, show_exercises: undefined })).toBe(false);
});

test("the workout is PUT by its key, with the account's token", async () => {
  const fetchFn = answers({ status: 201, body: SAVED });
  const outcome = await saveGymSession(
    URL,
    TOKEN,
    "key12345",
    session as GymSessionRequest,
    options(fetchFn),
  );
  expect(outcome).toEqual({ kind: "ok", value: SAVED });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/me/gym-sessions/key12345");
  expect(init?.method).toBe("PUT");
  expect(JSON.parse(init?.body as string)).toEqual(session);
  expect((init?.headers as Record<string, string>).Authorization).toBe(
    `Bearer ${TOKEN}`,
  );
});

test("a body the API will not take is its error", async () => {
  const fetchFn = answers({ status: 422, body: apiError("invalid_request") });
  const outcome = await saveGymSession(
    URL,
    TOKEN,
    "key12345",
    session as GymSessionRequest,
    options(fetchFn),
  );
  expect(outcome).toMatchObject({ kind: "api_error", code: "invalid_request" });
});
