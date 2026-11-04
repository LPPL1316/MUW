import { NO_BODY } from "./bodyProfile";
import { activeKcal } from "./energy";

// TASK-371: the ACSM walking equation, 0.1 ml/kg for each metre and 1.8 for
// each metre climbed, worked out by hand in ADR-0318's units (5 kcal a litre
// of oxygen, one MET 3.5 ml/kg/min).

const YEAR = 2026;

test("with no body, a flat walk is 0.5 kcal per kg and km for 70 kg", () => {
  // (3.5 × 60 + 0.1 × 5000) ml/kg = 0.71 L/kg → 248.5 kcal; at rest
  // 1.225 kcal/min × 60 = 73.5.
  const effort = {
    activity: "walking",
    metres: 5000,
    seconds: 3600,
    climbM: 0,
  } as const;
  expect(activeKcal(effort, NO_BODY, YEAR)).toBe(175);
});

test("each metre climbed adds 0.009 kcal a kilogram", () => {
  const effort = {
    activity: "walking",
    metres: 5000,
    seconds: 3600,
    climbM: 100,
  } as const;
  expect(activeKcal(effort, NO_BODY, YEAR)).toBe(238);
});

test("without its time, a walk is counted from its metres", () => {
  const effort = {
    activity: "walking",
    metres: 5000,
    seconds: null,
    climbM: null,
  } as const;
  expect(activeKcal(effort, NO_BODY, YEAR)).toBe(175);
});

test("a walk is about half a run of the same metres", () => {
  const walk = {
    activity: "walking",
    metres: 10_000,
    seconds: 7200,
    climbM: 0,
  } as const;
  const run = { ...walk, activity: "running", seconds: 3000 } as const;
  const ratio = activeKcal(walk, NO_BODY, YEAR) / activeKcal(run, NO_BODY, YEAR);
  expect(ratio).toBeGreaterThan(0.45);
  expect(ratio).toBeLessThan(0.55);
});
