import { saveLanguageChoice } from "../i18n/language";
import * as freeRun from "../navigation/freeRun";
import {
  awayNumber,
  distanceLabel,
  inUnits,
  MIN_PACE_M,
  nearDistanceLabel,
  paceLabel,
  runDistanceLabel,
  shortDistanceLabel,
  wholeDistanceLabel,
} from "./format";
import { saveUnitsChoice } from "./units";

afterEach(() => {
  saveLanguageChoice("phone");
  saveUnitsChoice("phone");
});

test("a route's distance, in kilometres and in miles", () => {
  expect(distanceLabel(5200, "km")).toBe("5.2 km");
  expect(distanceLabel(5200, "mi")).toBe("3.2 mi");
  expect(distanceLabel(21_097, "km")).toBe("21.1 km");
  expect(distanceLabel(21_097, "mi")).toBe("13.1 mi");
  expect(distanceLabel(1609.344, "mi")).toBe("1.0 mi");
  expect(wholeDistanceLabel(21_000, "km")).toBe("21 km");
  expect(wholeDistanceLabel(21_000, "mi")).toBe("13 mi");
  expect(inUnits(8046.72, "mi")).toBeCloseTo(5);
});

test("the languages with a comma write the distance with a comma", () => {
  saveLanguageChoice("it");
  expect(distanceLabel(5200, "km")).toBe("5,2 km");
  expect(distanceLabel(5200, "mi")).toBe("3,2 mi");
  expect(awayNumber(2929, "km")).toBe("2,9");
  expect(awayNumber(2929, "mi")).toBe("1,8");
  expect(nearDistanceLabel(1440, "km")).toBe("1,4 km");
  saveLanguageChoice("de");
  expect(distanceLabel(21_097, "mi")).toBe("13,1 mi");
  saveLanguageChoice("en");
  expect(distanceLabel(5200, "mi")).toBe("3.2 mi");
});

test("how far a town is: a decimal under ten units, none from there", () => {
  expect(awayNumber(2929, "km")).toBe("2.9");
  expect(awayNumber(12_760, "km")).toBe("13");
  expect(awayNumber(2929, "mi")).toBe("1.8");
  expect(awayNumber(12_760, "mi")).toBe("7.9");
  expect(awayNumber(20_000, "mi")).toBe("12");
});

test("a run's distance has two decimals, as on the run's screen", () => {
  expect(runDistanceLabel(4012, "km")).toBe("4.01 km");
  expect(runDistanceLabel(4012, "mi")).toBe("2.49 mi");
  expect(runDistanceLabel(0, "mi")).toBe("0.00 mi");
  expect(runDistanceLabel(-5, "mi")).toBe("0.00 mi");
  expect(runDistanceLabel(42_195, "mi")).toBe("26.22 mi");
});

test("the average pace, a kilometre or a mile", () => {
  // 4012 m in 19:00.
  expect(paceLabel(4012, 1_140_000, "km")).toBe("4:44 /km");
  expect(paceLabel(4012, 1_140_000, "mi")).toBe("7:37 /mi");
  expect(paceLabel(10_000, 3_000_000, "km")).toBe("5:00 /km");
  expect(paceLabel(10_000, 3_000_000, "mi")).toBe("8:03 /mi");
  // Too short for a pace, in either unit.
  expect(paceLabel(MIN_PACE_M - 1, 30_000, "km")).toBeNull();
  expect(paceLabel(MIN_PACE_M - 1, 30_000, "mi")).toBeNull();
  expect(paceLabel(500, 0, "mi")).toBeNull();
});

test("a short distance is in metres, or in feet with miles", () => {
  expect(shortDistanceLabel(50, "km")).toBe("50 m");
  expect(shortDistanceLabel(50, "mi")).toBe("150 ft");
  expect(shortDistanceLabel(100, "mi")).toBe("350 ft");
  expect(shortDistanceLabel(644, "km")).toBe("640 m");
  expect(shortDistanceLabel(200, "mi")).toBe("650 ft");
  expect(shortDistanceLabel(0, "mi")).toBe("0 ft");
});

test("how far something is: short under a kilometre, or a thousand feet", () => {
  expect(nearDistanceLabel(640, "km")).toBe("640 m");
  expect(nearDistanceLabel(1440, "km")).toBe("1.4 km");
  expect(nearDistanceLabel(200, "mi")).toBe("650 ft");
  expect(nearDistanceLabel(304, "mi")).toBe("1000 ft");
  expect(nearDistanceLabel(305, "mi")).toBe("0.2 mi");
  expect(nearDistanceLabel(640, "mi")).toBe("0.4 mi");
  expect(nearDistanceLabel(1440, "mi")).toBe("0.9 mi");
});

test("without a unit passed, the app's: kilometres until «Settings» says miles", () => {
  expect(distanceLabel(5200)).toBe("5.2 km");
  expect(paceLabel(4012, 1_140_000)).toBe("4:44 /km");
  expect(shortDistanceLabel(50)).toBe("50 m");
  saveUnitsChoice("mi");
  expect(distanceLabel(5200)).toBe("3.2 mi");
  expect(wholeDistanceLabel(21_000)).toBe("13 mi");
  expect(awayNumber(2929)).toBe("1.8");
  expect(runDistanceLabel(4012)).toBe("2.49 mi");
  expect(paceLabel(4012, 1_140_000)).toBe("7:37 /mi");
  expect(shortDistanceLabel(50)).toBe("150 ft");
  expect(nearDistanceLabel(640)).toBe("0.4 mi");
});

test("in kilometres a run reads as the run's screen writes it, to the letter", () => {
  expect(MIN_PACE_M).toBe(freeRun.MIN_PACE_M);
  const runs: [number, number][] = [
    [0, 0],
    [-3, 1000],
    [77, 30_000],
    [99.9, 45_000],
    [100, 31_000],
    [4012, 1_140_000],
    [5000, 1_422_500],
    [10_000, 2_999_999],
    [21_097, 6_300_000],
    [42_195, 12_345_678],
    [1234.5, 444_444],
  ];
  // In every language: the run's screen writes a point in all of them.
  for (const language of ["en", "it"] as const) {
    saveLanguageChoice(language);
    for (const [metres, ms] of runs) {
      expect(runDistanceLabel(metres, "km")).toBe(freeRun.kmLabel(metres));
      expect(paceLabel(metres, ms, "km")).toBe(freeRun.paceLabel(metres, ms));
    }
  }
});
