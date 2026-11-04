import { t } from "../i18n";
import type { Units } from "../units/units";
import { birthYears, HEIGHT_CM, WEIGHT_KG } from "./bodyProfile";
import {
  cmOfFeetInches,
  feetInchesOf,
  heightLabel,
  readNumber,
  weightIn,
  weightKgOf,
  weightUnit,
} from "./bodyUnits";

/**
 * What a field of «Body» (TASK-374) says once typed: nothing, a value to
 * keep, or why it is not kept. The limits are ADR-0318's, said in the app's
 * units: a value shown at the limit is taken.
 */
export type Read =
  | { kind: "empty" }
  | { kind: "value"; value: number }
  | { kind: "wrong"; problem: string };

const EMPTY: Read = { kind: "empty" };

function clamp(value: number, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/** A weight typed in `units`, as kilograms. */
export function readWeight(text: string, units: Units): Read {
  if (text.trim() === "") {
    return EMPTY;
  }
  const min = weightIn(WEIGHT_KG.min, units);
  const max = weightIn(WEIGHT_KG.max, units);
  const typed = readNumber(text);
  if (typed === null || typed < min || typed > max) {
    return {
      kind: "wrong",
      problem: t("Enter a weight between {min} and {max} {unit}.", {
        min,
        max,
        unit: weightUnit(units),
      }),
    };
  }
  return { kind: "value", value: clamp(weightKgOf(typed, units), WEIGHT_KG) };
}

function heightProblem(units: Units): Read {
  return {
    kind: "wrong",
    problem: t("Enter a height between {min} and {max}.", {
      min: heightLabel(HEIGHT_CM.min, units),
      max: heightLabel(HEIGHT_CM.max, units),
    }),
  };
}

/** A height typed in centimetres. */
export function readHeightCm(text: string): Read {
  if (text.trim() === "") {
    return EMPTY;
  }
  const cm = readNumber(text);
  if (cm === null || cm < HEIGHT_CM.min || cm > HEIGHT_CM.max) {
    return heightProblem("km");
  }
  return { kind: "value", value: cm };
}

/** A height typed in feet and inches, as centimetres; the inches 0 to 11. */
export function readHeightFeetInches(feetText: string, inchesText: string): Read {
  if (feetText.trim() === "" && inchesText.trim() === "") {
    return EMPTY;
  }
  const feet = readNumber(feetText);
  const inches = inchesText.trim() === "" ? 0 : readNumber(inchesText);
  const min = feetInchesOf(HEIGHT_CM.min);
  const max = feetInchesOf(HEIGHT_CM.max);
  const all = (feet ?? -1) * 12 + (inches ?? -1);
  if (
    feet === null ||
    inches === null ||
    !Number.isInteger(feet) ||
    !Number.isInteger(inches) ||
    inches > 11 ||
    all < min.feet * 12 + min.inches ||
    all > max.feet * 12 + max.inches
  ) {
    return heightProblem("mi");
  }
  return { kind: "value", value: clamp(cmOfFeetInches({ feet, inches }), HEIGHT_CM) };
}

/** A year of birth, 100 to 13 years before `year`. */
export function readBirthYear(text: string, year: number): Read {
  if (text.trim() === "") {
    return EMPTY;
  }
  const { min, max } = birthYears(year);
  const typed = readNumber(text);
  if (typed === null || !Number.isInteger(typed) || typed < min || typed > max) {
    return {
      kind: "wrong",
      problem: t("Enter a year between {min} and {max}.", { min, max }),
    };
  }
  return { kind: "value", value: typed };
}
