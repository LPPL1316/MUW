import { DISTANCE_LIMITS_M } from "@shaperoute/shared-types";

import { saveUnitsChoice } from "../units/units";
import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  distanceField,
  distanceForSport,
  distanceLimits,
  distanceLimitsM,
  fitDistance,
  offeredDistanceM,
  stepDistance,
  switchDistance,
  toDistanceM,
} from "./distance";

// The distance of «Draw» with «Miles» (TASK-182 part B, the user's choice of
// 2026-10-05). `distance.test.ts` says what it is in km, unchanged.

beforeEach(() => saveUnitsChoice("mi"));
afterEach(() => saveUnitsChoice("phone"));

const ACTIVITIES = ["running", "cycling", "paddling"] as const;

test("the limits are whole miles inside today's: 1–13, 7–18, 1–3; a swim's by half", () => {
  expect(APP_DISTANCE_LIMITS_MI).toEqual({
    running: [1, 13],
    cycling: [7, 18],
    paddling: [1, 3],
    // By half a mile (TASK-323 C2): whole ones would be 1 mi alone.
    swimming: [0.5, 1.5],
  });
  expect(distanceLimits("running")).toEqual([1, 13]);
  expect(distanceLimits("running", "km")).toEqual(APP_DISTANCE_LIMITS_KM.running);
  for (const activity of ACTIVITIES) {
    const [lowestM, highestM] = distanceLimitsM(activity, "mi");
    const [lowestKm, highestKm] = APP_DISTANCE_LIMITS_KM[activity];
    // Inside what the app offers in km, and inside the contract.
    expect(lowestM).toBeGreaterThanOrEqual(lowestKm * 1000);
    expect(highestM).toBeLessThanOrEqual(highestKm * 1000);
    expect(lowestM).toBeGreaterThanOrEqual(DISTANCE_LIMITS_M[activity][0]);
    expect(highestM).toBeLessThanOrEqual(DISTANCE_LIMITS_M[activity][1]);
  }
  expect(distanceLimitsM("running", "mi")).toEqual([1609, 20921]);
  expect(distanceLimitsM("running", "km")).toEqual([1000, 21000]);
});

test.each([
  ["1 mi", 1609],
  ["3 mi", 4828],
  ["4.5 mi", 7242],
  ["4,5 mi", 7242],
  ["13 mi", 20921],
])("%j is %i whole metres for the API", (text, metres) => {
  expect(toDistanceM(text)).toBe(metres);
  // The text says its unit: the same whatever the app is in.
  expect(toDistanceM(text, "running", "km")).toBe(metres);
});

test.each([
  ["0,9 mi", "below 1 mi"],
  ["13,1 mi", "just over 13 mi"],
  ["21 mi", "a run's km, typed as miles"],
  ["4,55 mi", "two decimals"],
  [" mi", "empty"],
  ["abc mi", "not a number"],
  ["4, mi", "a comma without the decimal"],
  ["-5 mi", "negative"],
])("%j is not a distance: %s", (text) => {
  expect(toDistanceM(text)).toBeNull();
});

test("each sport has its own miles", () => {
  expect(toDistanceM("7 mi", "cycling")).toBe(11265);
  expect(toDistanceM("18 mi", "cycling")).toBe(28968);
  expect(toDistanceM("6,9 mi", "cycling")).toBeNull();
  expect(toDistanceM("18,1 mi", "cycling")).toBeNull();
  expect(toDistanceM("1 mi", "paddling")).toBe(1609);
  expect(toDistanceM("2,5 mi", "paddling")).toBe(4023);
  expect(toDistanceM("3 mi", "paddling")).toBe(4828);
  expect(toDistanceM("3,1 mi", "paddling")).toBeNull();
  expect(toDistanceM("0,9 mi", "paddling")).toBeNull();
});

test("a km text while in miles is the metres the app wrote", () => {
  // A «Try» of 3 mi, written by the screen as km to the metre.
  expect(toDistanceM("4.828")).toBe(4828);
  // A small lake's 1.5 km (TASK-240): under a mile, still what it fits at.
  expect(toDistanceM("1.5", "paddling")).toBe(1500);
  // The 5 km of before «Settings» changed.
  expect(toDistanceM("5")).toBe(5000);
  // Within the limits in km, as ever.
  expect(toDistanceM("0.5")).toBeNull();
  expect(toDistanceM("21.001")).toBeNull();
  expect(toDistanceM("abc")).toBeNull();
  // In km such a text is not a distance: nobody types three decimals.
  expect(toDistanceM("4.828", "running", "km")).toBeNull();
});

test.each([
  ["3 mi", 1, "running", "4 mi"],
  ["3 mi", -1, "running", "2 mi"],
  ["4,5 mi", 1, "running", "5,5 mi"],
  ["13 mi", 1, "running", "13 mi"],
  ["1 mi", -1, "running", "1 mi"],
  [" mi", 1, "running", "1 mi"],
  ["7 mi", -1, "cycling", "7 mi"],
  ["17,5 mi", 1, "cycling", "18 mi"],
  ["3 mi", 1, "cycling", "7 mi"],
  ["3 mi", 1, "paddling", "3 mi"],
  ["2 mi", -1, "paddling", "1 mi"],
  ["4.828", 1, "running", "4 mi"],
] as const)("%j stepped by %i for %s is %j", (text, steps, activity, expected) => {
  expect(stepDistance(text, steps, activity)).toBe(expected);
});

test("a stepped distance is asked in whole metres of whole miles", () => {
  let text = distanceForSport("5", "running");
  expect(text).toBe("3 mi");
  const asked = [];
  for (let i = 0; i < 12; i++) {
    text = stepDistance(text, 1);
    asked.push(toDistanceM(text));
  }
  expect(asked).toEqual([
    6437, 8047, 9656, 11265, 12875, 14484, 16093, 17703, 19312, 20921, 20921, 20921,
  ]);
});

test("the field starts at today's distance, to the nearest whole mile", () => {
  // A run's 5 km are 3 mi; by bike they come within 7 to 18.
  expect(distanceForSport("5", "running")).toBe("3 mi");
  expect(distanceForSport("5", "cycling")).toBe("7 mi");
  // Paddling's 2 km are 1 mi.
  expect(distanceForSport("5", "paddling")).toBe("1 mi");
  expect(distanceForSport("3 mi", "paddling")).toBe("1 mi");
  // In km, as before.
  expect(distanceForSport("5", "running", "km")).toBe("5");
  expect(distanceForSport("5", "cycling", "km")).toBe("10");
  expect(distanceForSport("5", "paddling", "km")).toBe("2");
});

test("a sport just chosen brings the miles within its limits", () => {
  expect(fitDistance("4,5 mi", "running")).toBe("4,5 mi");
  expect(fitDistance("3 mi", "cycling")).toBe("7 mi");
  expect(fitDistance("15 mi", "running")).toBe("13 mi");
  expect(fitDistance("abc mi", "cycling")).toBe("7 mi");
  // A text left in km is written in miles first.
  expect(fitDistance("10", "cycling")).toBe("7 mi");
  expect(fitDistance("25", "cycling")).toBe("16 mi");
});

test("«Settings» turned to miles, or back: the same distance, whole", () => {
  expect(switchDistance("5", "running", "mi")).toBe("3 mi");
  expect(switchDistance("21", "running", "mi")).toBe("13 mi");
  expect(switchDistance("10", "cycling", "mi")).toBe("7 mi");
  expect(switchDistance("30", "cycling", "mi")).toBe("18 mi");
  expect(switchDistance("5", "paddling", "mi")).toBe("3 mi");
  expect(switchDistance("3 mi", "running", "km")).toBe("5");
  expect(switchDistance("13 mi", "running", "km")).toBe("21");
  expect(switchDistance("7 mi", "cycling", "km")).toBe("11");
  expect(switchDistance("18 mi", "cycling", "km")).toBe("29");
  expect(switchDistance("1 mi", "paddling", "km")).toBe("2");
  // Every switched text is a distance the new unit accepts.
  for (const activity of ACTIVITIES) {
    const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
    for (let km = lowest; km <= highest; km++) {
      const miles = switchDistance(String(km), activity, "mi");
      expect(toDistanceM(miles, activity, "mi")).not.toBeNull();
      const back = switchDistance(miles, activity, "km");
      expect(toDistanceM(back, activity, "km")).not.toBeNull();
    }
  }
});

test("a distance the app writes or offers by itself", () => {
  // «Use 8 mi» under a word: the field in miles.
  expect(distanceField(12_875)).toBe("8 mi");
  expect(distanceField(12_000, "km")).toBe("12");
  expect(distanceField(7500, "km")).toBe("7.5");
  // «Try»: the nearest whole mile within the limits, in whole metres.
  expect(offeredDistanceM(8000, "running")).toBe(8047);
  expect(offeredDistanceM(21_000, "running")).toBe(20921);
  expect(offeredDistanceM(1000, "running")).toBe(1609);
  expect(offeredDistanceM(10_000, "cycling")).toBe(11265);
  expect(offeredDistanceM(8000, "running", "km")).toBe(8000);
});
