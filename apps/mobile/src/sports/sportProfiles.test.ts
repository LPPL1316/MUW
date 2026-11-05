import {
  ACTIVITIES,
  CYCLING_BEST_DISTANCES,
  DISTANCE_LIMITS_M,
  RUN_ACTIVITIES,
  RUNNING_BEST_DISTANCES,
} from "@shaperoute/shared-types";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { sportPaceLabel } from "../activities/activityText";
import { metAt } from "../body/energy";
import { NETWORKS } from "../engine/zones";
import { muwLabel, muwSport } from "../feed/muwLabel";
import { DISTANCE_TYPE } from "../health/appleWorkout";
import { freeRunActivity } from "../navigation/freeSport";
import { paddlePaceLabel } from "../navigation/paddle";
import { swimPaceLabel } from "../navigation/swim";
import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  distanceForSport,
  distanceStep,
} from "../route/distance";
import { ACTIVITY_LABELS } from "../search/searchFilters";
import { paceLabel } from "../units/format";
import {
  DEFAULT_ACTIVITY,
  findProfile,
  profileOf,
  SPORT_PROFILES,
  tableOf,
} from "./index";

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

it("gives the screens what they told apart before (part B3b)", () => {
  expect(tableOf((sport) => sport.emoji)).toEqual({
    running: "🏃‍♂️",
    cycling: "🚴",
    paddling: "🛶",
    swimming: "🏊",
    walking: "🚶",
    skiing: "⛷️",
    xc_skiing: "🎿",
  });
  expect(tableOf((sport) => sport.pace)).toEqual({
    paddling: "paddle",
    swimming: "swim",
  });
  expect(tableOf((sport) => sport.onWater)).toEqual({ paddling: true, swimming: true });
  expect(tableOf((sport) => sport.shapesOnly)).toEqual({ paddling: true });
  expect(tableOf((sport) => sport.noWords)).toEqual({ swimming: true });
  expect(tableOf((sport) => sport.laps)).toEqual({ swimming: true });
  expect(tableOf((sport) => sport.timeAt)).toEqual({
    running: "runner",
    walking: "walker",
  });
  expect(tableOf((sport) => sport.skied)).toEqual({ skiing: true });
  expect(tableOf((sport) => sport.bests)).toEqual({
    running: { distances: RUNNING_BEST_DISTANCES, named: "race" },
    cycling: { distances: CYCLING_BEST_DISTANCES, named: "km" },
  });
  expect(tableOf((sport) => sport.partsBetween?.km)).toEqual({
    running: "{drawn} km of drawing + {between} km walking between the parts",
    cycling: "{drawn} km of drawing + {between} km riding between the parts",
    paddling: "{drawn} km of drawing + {between} km paddling between the parts",
    swimming: "{drawn} km of drawing + {between} km swimming between the parts",
  });
  expect(tableOf((sport) => sport.lettersBetween?.mi)).toEqual({
    running: "{letters} mi of letters + {between} mi walking between them",
    cycling: "{letters} mi of letters + {between} mi riding between them",
  });
  expect(findProfile("hiking")).toBeUndefined();
  expect(findProfile(undefined)).toBeUndefined();
});

it("writes a pace and shows a MuW route's sport as before", () => {
  // 5 km in 25 minutes.
  const ms = 25 * 60_000;
  expect(sportPaceLabel("paddling", 5000, ms)).toBe(paddlePaceLabel(5000, ms));
  expect(sportPaceLabel("swimming", 5000, ms)).toBe(swimPaceLabel(5000, ms));
  for (const activity of [
    "running",
    "cycling",
    "walking",
    "skiing",
    "hiking",
    undefined,
  ]) {
    expect(sportPaceLabel(activity, 5000, ms)).toBe(paceLabel(5000, ms));
  }
  expect(
    ["running", "paddling", "cycling", "walking", "swimming"].map(
      (a) => muwSport(a).activity,
    ),
  ).toEqual(["running", "paddling", "cycling", "cycling", "cycling"]);
});
