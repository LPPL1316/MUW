import {
  clampRestS,
  DEFAULT_REST_S,
  MAX_REST_S,
  MIN_REST_S,
  REST_CHOICES_S,
  restClock,
  restFor,
  restLeftMs,
  restOver,
  restTakenS,
  shiftRest,
  startRest,
} from "./restTimer";

// TASK-385 part B: the rest between two sets, the user's durations.

const AT = 1_000_000;

test("the durations are the user's: 30 s to 3 min, and Custom from 10 s to 10 min", () => {
  expect(REST_CHOICES_S).toEqual([30, 60, 90, 120, 180]);
  expect([MIN_REST_S, MAX_REST_S]).toEqual([10, 600]);
  expect(clampRestS(3)).toBe(10);
  expect(clampRestS(900)).toBe(600);
  expect(clampRestS(74.6)).toBe(75);
  expect(clampRestS(Number.NaN)).toBe(DEFAULT_REST_S);
});

test("a rest counts down from its start to its end", () => {
  const rest = startRest(AT, 90);
  expect(restLeftMs(rest, AT + 30_000)).toBe(60_000);
  expect(restOver(rest, AT + 89_999)).toBe(false);
  expect(restOver(rest, AT + 90_000)).toBe(true);
  expect(restLeftMs(rest, AT + 120_000)).toBe(0);
});

test("−15 s and +15 s move the end, never below now nor past 10 minutes", () => {
  const rest = startRest(AT, 30);
  expect(restLeftMs(shiftRest(rest, 15, AT), AT)).toBe(45_000);
  expect(restLeftMs(shiftRest(rest, -15, AT + 20_000), AT + 20_000)).toBe(0);
  const long = startRest(AT, 600);
  expect(restLeftMs(shiftRest(long, 15, AT), AT)).toBe(600_000);
});

test("a rest lasts until its end, or until it was cut short", () => {
  const rest = startRest(AT, 60);
  expect(restTakenS(rest, AT + 45_000)).toBe(45);
  expect(restTakenS(rest, AT + 200_000)).toBe(60);
  expect(restTakenS(rest, AT - 5_000)).toBe(0);
});

test("each exercise keeps its last rest; one never rested, 90 s", () => {
  expect(restFor({ bench_press: 120 }, "bench_press")).toBe(120);
  expect(restFor({ bench_press: 120 }, "squat")).toBe(90);
});

test("the clock rounds up, so 0:00 shows only at the end", () => {
  expect(restClock(90_000)).toBe("1:30");
  expect(restClock(4_100)).toBe("0:05");
  expect(restClock(0)).toBe("0:00");
  expect(restClock(-3)).toBe("0:00");
});
