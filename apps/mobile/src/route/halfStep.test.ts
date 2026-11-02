import { halfStepDistance, HOLD_DELAY_MS, repeatDelayMs } from "./halfStep";

test("− and + move half a km, keeping the comma typed", () => {
  expect(halfStepDistance("7", 1, "running", "km")).toBe("7.5");
  expect(halfStepDistance("7,3", 1, "running", "km")).toBe("7,8");
  expect(halfStepDistance("7.5", -1, "running", "km")).toBe("7");
});

test("half a mile with «Miles»", () => {
  expect(halfStepDistance("4 mi", 1, "running", "mi")).toBe("4.5 mi");
});

test("held within the sport's limits", () => {
  expect(halfStepDistance("1", -1, "running", "km")).toBe("1");
  expect(halfStepDistance("21", 1, "running", "km")).toBe("21");
  // Not a number: from the lowest.
  expect(halfStepDistance("", 1, "running", "km")).toBe("1");
});

test("held down, the steps come faster, never faster than 40 ms", () => {
  expect(HOLD_DELAY_MS).toBeGreaterThan(repeatDelayMs(0));
  expect(repeatDelayMs(0)).toBeGreaterThan(repeatDelayMs(5));
  expect(repeatDelayMs(5)).toBeGreaterThan(repeatDelayMs(20));
  expect(repeatDelayMs(1000)).toBe(40);
  // 1 to 21 km is 40 half-steps: about two seconds held.
  let total = HOLD_DELAY_MS;
  for (let count = 0; count < 40; count += 1) {
    total += repeatDelayMs(count);
  }
  expect(total).toBeLessThan(3000);
});
