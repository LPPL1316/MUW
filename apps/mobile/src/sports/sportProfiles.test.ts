import {
  ACTIVITIES,
  DISTANCE_LIMITS_M,
  RUN_ACTIVITIES,
} from "@shaperoute/shared-types";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { metAt } from "../body/energy";
import { NETWORKS } from "../engine/zones";
import { muwLabel } from "../feed/muwLabel";
import { DISTANCE_TYPE } from "../health/appleWorkout";
import { freeRunActivity } from "../navigation/freeSport";
import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  distanceForSport,
  distanceStep,
} from "../route/distance";
import { ACTIVITY_LABELS } from "../search/searchFilters";
import { DEFAULT_ACTIVITY, profileOf, SPORT_PROFILES, tableOf } from "./index";

// TASK-376 part B3 (ADR-0320): the tables of the app, read from the sports,
// are the ones written by hand before, value for value and in order.

const MPH_KMH = 1.609344;

it("has a profile for every activity of a saved run, in their order", () => {
  expect(SPORT_PROFILES.map((sport) => sport.activity)).toEqual([...RUN_ACTIVITIES]);
  expect(DEFAULT_ACTIVITY).toBe("running");
  expect(() => profileOf("gym" as never)).toThrow("no sport profile for gym");
});

it("gives «Draw» the distances of before", () => {
  expect(Object.entries(APP_DISTANCE_LIMITS_KM)).toEqual([
    ["running", [1, 21]],
    [
      "cycling",
      [DISTANCE_LIMITS_M.cycling[0] / 1000, DISTANCE_LIMITS_M.cycling[1] / 1000],
    ],
    [
      "paddling",
      [DISTANCE_LIMITS_M.paddling[0] / 1000, DISTANCE_LIMITS_M.paddling[1] / 1000],
    ],
    [
      "swimming",
      [DISTANCE_LIMITS_M.swimming[0] / 1000, DISTANCE_LIMITS_M.swimming[1] / 1000],
    ],
    [
      "walking",
      [DISTANCE_LIMITS_M.walking[0] / 1000, DISTANCE_LIMITS_M.walking[1] / 1000],
    ],
  ]);
  expect(Object.entries(APP_DISTANCE_LIMITS_MI)).toEqual([
    ["running", [1, 13]],
    ["cycling", [7, 18]],
    ["paddling", [1, 3]],
    ["swimming", [0.5, 1.5]],
    ["walking", [1, 18]],
  ]);
  expect(ACTIVITIES.map((activity) => distanceStep(activity))).toEqual([
    1, 1, 1, 0.5, 1,
  ]);
  expect(distanceForSport("7", "paddling", "km")).toBe("2");
  expect(distanceForSport("7", "swimming", "km")).toBe("1");
  expect(distanceForSport("7", "running", "km")).toBe("7");
  expect(distanceForSport("7", "walking", "km")).toBe("7");
});

it("gives Apple Health and Health Connect the numbers of before", () => {
  expect(tableOf((sport) => sport.appleWorkout)).toEqual({
    running: 37,
    cycling: 13,
    paddling: 31,
    swimming: 46,
    walking: 52,
    skiing: 61,
    xc_skiing: 60,
  });
  expect(Object.entries(DISTANCE_TYPE)).toEqual([
    ["running", "HKQuantityTypeIdentifierDistanceWalkingRunning"],
    ["cycling", "HKQuantityTypeIdentifierDistanceCycling"],
    ["paddling", "HKQuantityTypeIdentifierDistancePaddleSports"],
    ["swimming", "HKQuantityTypeIdentifierDistanceSwimming"],
    ["walking", "HKQuantityTypeIdentifierDistanceWalkingRunning"],
  ]);
  expect(tableOf((sport) => sport.healthConnect)).toEqual({
    running: 56,
    cycling: 8,
    paddling: 46,
    swimming: 73,
    walking: 79,
    skiing: 61,
    xc_skiing: 61,
  });
});

it("names the sports, and draws on the phone the ones of before", () => {
  expect(Object.entries(ACTIVITY_LABELS)).toEqual([
    ["running", "Run"],
    ["cycling", "Bike"],
    ["paddling", "Paddle"],
    ["swimming", "Open water swim"],
    ["walking", "Walk"],
  ]);
  expect(Object.entries(NETWORKS)).toEqual([
    ["running", "foot"],
    ["cycling", "bike"],
    ["walking", "foot"],
  ]);
});

it("counts the energy as before", () => {
  expect(tableOf((sport) => sport.energy?.kind)).toEqual({
    running: "oxygen",
    cycling: "met",
    paddling: "met",
    walking: "oxygen",
  });
  expect(profileOf("running").energy).toEqual({
    kind: "oxygen",
    mlKgPerM: 0.2,
    mlKgPerMUp: 0.9,
  });
  expect(profileOf("walking").energy).toEqual({
    kind: "oxygen",
    mlKgPerM: 0.1,
    mlKgPerMUp: 1.8,
  });
  expect(profileOf("cycling").energy).toEqual({
    kind: "met",
    bands: [
      { belowKmh: 10 * MPH_KMH, met: 4.0 },
      { belowKmh: 12 * MPH_KMH, met: 6.8 },
      { belowKmh: 14 * MPH_KMH, met: 8.0 },
      { belowKmh: 16 * MPH_KMH, met: 10.0 },
      { belowKmh: 20 * MPH_KMH, met: 12.0 },
      { belowKmh: Infinity, met: 15.8 },
    ],
  });
  expect(profileOf("paddling").energy).toEqual({
    kind: "met",
    bands: [
      { belowKmh: 4 * MPH_KMH, met: 2.8 },
      { belowKmh: 6 * MPH_KMH, met: 5.8 },
      { belowKmh: Infinity, met: 12.5 },
    ],
  });
  expect(metAt("paddling", 100)).toBe(12.5);
});

it("starts a run without a route and labels a MuW route as before", () => {
  expect(RUN_ACTIVITIES.map(freeRunActivity)).toEqual([
    undefined,
    "cycling",
    "paddling",
    "swimming",
    "walking",
    "cycling",
    undefined,
  ]);
  expect(muwLabel("running")).toBe("Route created by MuW – run it yourself");
  expect(muwLabel("paddling")).toBe("Route created by MuW – paddle it yourself");
  for (const activity of ["cycling", "walking", "swimming", "skiing", "hiking"]) {
    expect(muwLabel(activity)).toBe("Route created by MuW – ride it yourself");
  }
});

it("keeps the sport files free of screens and of each other", () => {
  // A sport file reads the contract, the texts and the profile's type: a
  // new sport is a file of its own and one line in index.ts.
  const folder = __dirname;
  for (const name of readdirSync(folder)) {
    if (name === "index.ts" || name.endsWith(".test.ts")) {
      continue;
    }
    const source = readFileSync(join(folder, name), "utf8");
    const from = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    for (const path of from) {
      expect([
        "@shaperoute/shared-types",
        "@kingstinct/react-native-healthkit",
        "../i18n",
        "../units/distanceInput",
        "./base",
      ]).toContain(path);
    }
  }
});
