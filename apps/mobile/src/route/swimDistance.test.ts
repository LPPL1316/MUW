import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  distanceForSport,
  distanceLimitsM,
  distanceStep,
  stepDistance,
  toDistanceM,
} from "./distance";

// A swim's distances in «Draw» (TASK-323 C2, the user's choice): 0.5 to 3
// km by half a km, 0.5 to 1.5 mi by half a mile, from 1 km.

test("a swim goes from 0.5 to 3 km, or 0.5 to 1.5 mi", () => {
  expect(APP_DISTANCE_LIMITS_KM.swimming).toEqual([0.5, 3]);
  expect(APP_DISTANCE_LIMITS_MI.swimming).toEqual([0.5, 1.5]);
  expect(distanceLimitsM("swimming", "km")).toEqual([500, 3000]);
  expect(distanceLimitsM("swimming", "mi")).toEqual([805, 2414]);
});

test("− and + go by half a km for a swim, by a whole one for the others", () => {
  expect(distanceStep("swimming")).toBe(0.5);
  expect(distanceStep("paddling")).toBe(1);
  expect(stepDistance("1", 1, "swimming", "km")).toBe("1.5");
  expect(stepDistance("1.5", 1, "swimming", "km")).toBe("2");
  expect(stepDistance("1", -1, "swimming", "km")).toBe("0.5");
  expect(stepDistance("0.5", -1, "swimming", "km")).toBe("0.5");
  expect(stepDistance("3", 1, "swimming", "km")).toBe("3");
  expect(stepDistance("1,5", 1, "swimming", "km")).toBe("2");
  expect(stepDistance("2", 1, "paddling", "km")).toBe("3");
});

test("in miles by half a mile, up to 1.5", () => {
  expect(stepDistance("0.5 mi", 1, "swimming", "mi")).toBe("1 mi");
  expect(stepDistance("1 mi", 1, "swimming", "mi")).toBe("1.5 mi");
  expect(stepDistance("1.5 mi", 1, "swimming", "mi")).toBe("1.5 mi");
});

test("a swim starts at 1 km, whatever was typed for the sport before", () => {
  expect(distanceForSport("5", "swimming", "km")).toBe("1");
  expect(distanceForSport("21", "swimming", "km")).toBe("1");
  expect(distanceForSport("3 mi", "swimming", "mi")).toBe("1 mi");
});

test("what is typed for a swim reads within its limits", () => {
  expect(toDistanceM("0.5", "swimming", "km")).toBe(500);
  expect(toDistanceM("2.5", "swimming", "km")).toBe(2500);
  expect(toDistanceM("0.4", "swimming", "km")).toBeNull();
  expect(toDistanceM("3.5", "swimming", "km")).toBeNull();
  expect(toDistanceM("1.5 mi", "swimming", "mi")).toBe(2414);
  expect(toDistanceM("2 mi", "swimming", "mi")).toBeNull();
});
