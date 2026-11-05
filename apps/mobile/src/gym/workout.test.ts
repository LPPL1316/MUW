import {
  activeMs,
  ANSWER_MS,
  chooseExercise,
  closeUnanswered,
  deleteSet,
  editSet,
  finishWorkout,
  isPaused,
  logSet,
  newWorkout,
  nextSetNumber,
  pauseWorkout,
  restNow,
  resumeWorkout,
  sameAgainValues,
  savable,
  sessionRequest,
  settle,
  shiftWorkoutRest,
  skipRest,
  STILL_AFTER_MS,
  stillAsking,
  stillTraining,
  unanswered,
  type Workout,
} from "./workout";

// TASK-385 part B (ADR-0327): a workout at the gym as the phone keeps it,
// with the user's choices of 2026-11-04.

const T0 = Date.UTC(2026, 10, 5, 17, 0, 0);
const S = 1000;
const MIN = 60 * S;

const BENCH = { exercise: "bench_press", kind: "load" } as const;
const PULL_UP = { exercise: "pull_up", kind: "bodyweight" } as const;

function at(workout: Workout | null): Workout {
  if (workout === null) {
    throw new Error("refused");
  }
  return workout;
}

function benchStarted(): Workout {
  return chooseExercise(newWorkout("key12345", T0), BENCH, T0 + 30 * S);
}

test("a set is logged with its time since the start, and its rest starts by itself", () => {
  const w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + 2 * MIN));
  expect(w.sets).toEqual([
    {
      exercise: "bench_press",
      kind: "load",
      reps: 10,
      load_kg: 60,
      at_s: 120,
      live: true,
      n: 1,
    },
  ]);
  expect(w.rest).toEqual({ fromMs: T0 + 2 * MIN, endsMs: T0 + 2 * MIN + 90 * S });
  expect(nextSetNumber(w)).toBe(2);
});

test("no set without an exercise, nor with numbers that are no set", () => {
  expect(logSet(newWorkout("key12345", T0), { reps: 10, load_kg: 60 }, T0)).toBeNull();
  expect(logSet(benchStarted(), { reps: 10 }, T0)).toBeNull();
});

test("Same again types the last set of the same exercise", () => {
  let w = at(logSet(benchStarted(), { reps: 8, load_kg: 70 }, T0 + MIN));
  expect(sameAgainValues(w)).toEqual({ reps: 8, load_kg: 70 });
  w = chooseExercise(w, PULL_UP, T0 + 3 * MIN);
  expect(sameAgainValues(w)).toBeNull();
  expect(nextSetNumber(w)).toBe(1);
});

test("a set before the end of the rest ends it, counted as long as it lasted", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = at(logSet(w, { reps: 10, load_kg: 60 }, T0 + MIN + 70 * S));
  expect([w.rests, w.restS]).toEqual([1, 70]);
  expect(w.rest?.fromMs).toBe(T0 + MIN + 70 * S);
});

test("a rest that ran out while nobody looked is counted to its end", () => {
  const w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  expect(settle(w, T0 + MIN + 60 * S)).toBe(w);
  const settled = settle(w, T0 + 10 * MIN);
  expect([settled.rest, settled.rests, settled.restS]).toEqual([null, 1, 90]);
});

test("a duration chosen restarts the rest and is kept for the exercise", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = restNow(w, 180, T0 + MIN + 5 * S);
  expect(w.rest).toEqual({ fromMs: T0 + MIN + 5 * S, endsMs: T0 + MIN + 185 * S });
  w = skipRest(w, T0 + 2 * MIN);
  w = at(logSet(w, { reps: 10, load_kg: 60 }, T0 + 4 * MIN));
  expect(w.rest?.endsMs).toBe(T0 + 4 * MIN + 180 * S);
});

test("−15 s, +15 s and Skip", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = shiftWorkoutRest(w, 15, T0 + MIN);
  expect(w.rest?.endsMs).toBe(T0 + MIN + 105 * S);
  w = shiftWorkoutRest(w, -15, T0 + MIN);
  expect(w.rest?.endsMs).toBe(T0 + MIN + 90 * S);
  w = skipRest(w, T0 + MIN + 40 * S);
  expect([w.rest, w.rests, w.restS]).toEqual([null, 1, 40]);
});

test("Pause stops the clock and the rest; a set ends it", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = pauseWorkout(w, T0 + 2 * MIN);
  expect(isPaused(w)).toBe(true);
  expect([w.rest, w.rests, w.restS]).toEqual([null, 1, 60]);
  expect(activeMs(w, T0 + 12 * MIN)).toBe(2 * MIN);
  w = at(logSet(w, { reps: 10, load_kg: 60 }, T0 + 12 * MIN));
  expect(isPaused(w)).toBe(false);
  expect(activeMs(w, T0 + 13 * MIN)).toBe(3 * MIN);
});

test("Resume ends a pause; the clock runs through a rest", () => {
  let w = pauseWorkout(benchStarted(), T0 + MIN);
  w = resumeWorkout(w, T0 + 6 * MIN);
  expect(w.pauses).toEqual([{ fromMs: T0 + MIN, toMs: T0 + 6 * MIN }]);
  w = restNow(w, 60, T0 + 7 * MIN);
  expect(activeMs(w, T0 + 8 * MIN)).toBe(3 * MIN);
});

test("Still training? after 30 minutes with nothing, and it ends at its last set", () => {
  const w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + 10 * MIN));
  const last = T0 + 10 * MIN;
  expect(stillAsking(w, last + STILL_AFTER_MS - 1)).toBe(false);
  expect(stillAsking(w, last + STILL_AFTER_MS)).toBe(true);
  expect(
    stillAsking(stillTraining(w, last + STILL_AFTER_MS), last + STILL_AFTER_MS + MIN),
  ).toBe(false);
  expect(unanswered(w, last + STILL_AFTER_MS + ANSWER_MS - 1)).toBe(false);
  expect(unanswered(w, last + STILL_AFTER_MS + ANSWER_MS)).toBe(true);
  const closed = closeUnanswered(w);
  expect(closed.endedMs).toBe(last);
  expect([closed.rest, closed.rests]).toEqual([null, 0]);
});

test("ended with no set, at the last thing done", () => {
  const w = closeUnanswered(
    chooseExercise(newWorkout("key12345", T0), BENCH, T0 + 5 * MIN),
  );
  expect(w.endedMs).toBe(T0 + 5 * MIN);
});

test("after the end a set can be corrected, taken away, or added not live", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = at(logSet(w, { reps: 8, load_kg: 70 }, T0 + 3 * MIN));
  w = finishWorkout(w, T0 + 20 * MIN);
  w = at(editSet(w, 1, { reps: 12, load_kg: 55 }));
  expect(w.sets[0]).toMatchObject({ reps: 12, load_kg: 55, at_s: 60, live: true });
  expect(editSet(w, 1, { reps: 12 })).toBeNull();
  w = deleteSet(w, 2);
  w = at(logSet(chooseExercise(w, PULL_UP, T0 + 30 * MIN), { reps: 6 }, T0 + 30 * MIN));
  expect(w.sets.map((set) => [set.n, set.live, set.at_s])).toEqual([
    [1, true, 60],
    [3, false, 1200],
  ]);
  expect(w.rest).toBeNull();
});

test("the request: times in seconds since the start, within the workout", () => {
  let w = at(logSet(benchStarted(), { reps: 10, load_kg: 60 }, T0 + MIN));
  w = pauseWorkout(w, T0 + 30 * MIN);
  w = finishWorkout(w, T0 + 40 * MIN);
  expect(savable(w)).toBe(true);
  expect(sessionRequest(w)).toEqual({
    started_at: "2026-11-05T17:00:00.000Z",
    ended_at: "2026-11-05T17:40:00.000Z",
    pauses: [{ from_s: 1800, to_s: 2400 }],
    rests: 1,
    rest_s: 90,
    show_exercises: true,
    sets: [
      {
        exercise: "bench_press",
        kind: "load",
        reps: 10,
        load_kg: 60,
        at_s: 60,
        live: true,
      },
    ],
  });
});

test("a workout not ended, or of less than a second, has nothing to save", () => {
  const w = benchStarted();
  expect(sessionRequest(w)).toBeNull();
  expect(savable(finishWorkout(w, T0 + 500))).toBe(false);
});
