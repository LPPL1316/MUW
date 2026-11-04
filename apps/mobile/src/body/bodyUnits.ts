import type { Units } from "../units/units";

/**
 * Weight and height in the app's units (TASK-182): kilograms and
 * centimetres with kilometres, pounds and feet-inches with miles. The body
 * keeps what was typed, unrounded, so going back and forth between the
 * units shows the same number again.
 */

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const IN_PER_FT = 12;

/** A number as typed, with a comma or a point; null when it is not one. */
export function readNumber(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    return null;
  }
  return Number(clean);
}

function tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The weight in `units`, to a tenth: kilograms, or pounds with miles. */
export function weightIn(kg: number, units: Units): number {
  return tenths(units === "mi" ? kg / KG_PER_LB : kg);
}

/** The kilograms of a weight typed in `units`. */
export function weightKgOf(value: number, units: Units): number {
  return units === "mi" ? value * KG_PER_LB : value;
}

/** «kg» or «lb». */
export function weightUnit(units: Units): "kg" | "lb" {
  return units === "mi" ? "lb" : "kg";
}

/** A height in whole feet and inches. */
export type FeetInches = { feet: number; inches: number };

export function feetInchesOf(cm: number): FeetInches {
  const all = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(all / IN_PER_FT), inches: all % IN_PER_FT };
}

export function cmOfFeetInches({ feet, inches }: FeetInches): number {
  return (feet * IN_PER_FT + inches) * CM_PER_IN;
}

/** The height as the app shows it: «178 cm», or «5′ 10″» with miles. */
export function heightLabel(cm: number, units: Units): string {
  if (units === "mi") {
    const { feet, inches } = feetInchesOf(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${Math.round(cm)} cm`;
}

/** The weight as the app shows it: «72.5 kg», «160 lb». */
export function weightLabel(kg: number, units: Units): string {
  return `${weightIn(kg, units)} ${weightUnit(units)}`;
}
