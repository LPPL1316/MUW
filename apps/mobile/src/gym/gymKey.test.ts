import { gymKey } from "./gymKey";

// TASK-385 part B: the key of a workout, within the API's pattern.

const PATTERN = /^[a-z0-9]{8,40}$/;

test("its start in base 36, then eight random letters or digits", () => {
  const draws = [0, 0.5, 0.999, 1, 0.1, 0.2, 0.3, 0.4];
  let n = 0;
  const key = gymKey(Date.UTC(2026, 10, 5), () => draws[n++]);
  expect(key).toBe(`${Date.UTC(2026, 10, 5).toString(36)}0iz037ae`);
  expect(key).toMatch(PATTERN);
});

test("two workouts of the same moment have two keys", () => {
  const first = gymKey(1_000, () => 0.1);
  const second = gymKey(1_000, () => 0.9);
  expect(first).not.toBe(second);
  expect(first).toMatch(PATTERN);
});
