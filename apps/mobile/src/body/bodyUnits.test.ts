import {
  cmOfFeetInches,
  feetInchesOf,
  heightLabel,
  readNumber,
  weightIn,
  weightKgOf,
  weightLabel,
} from "./bodyUnits";

test("a number with a comma or a point", () => {
  expect(readNumber("72,5")).toBe(72.5);
  expect(readNumber(" 180 ")).toBe(180);
  expect(readNumber("")).toBeNull();
  expect(readNumber("7a")).toBeNull();
  expect(readNumber("-3")).toBeNull();
});

test("a weight typed in pounds shows the same pounds after kilograms", () => {
  const kg = weightKgOf(160, "mi");
  expect(weightIn(kg, "km")).toBe(72.6);
  expect(weightIn(kg, "mi")).toBe(160);
  expect(weightLabel(kg, "mi")).toBe("160 lb");
  expect(weightLabel(72.5, "km")).toBe("72.5 kg");
});

test("a height in feet and inches comes back the same", () => {
  const cm = cmOfFeetInches({ feet: 5, inches: 10 });
  expect(cm).toBeCloseTo(177.8);
  expect(feetInchesOf(cm)).toEqual({ feet: 5, inches: 10 });
  expect(heightLabel(cm, "mi")).toBe("5′ 10″");
  expect(heightLabel(178, "km")).toBe("178 cm");
  // 182.6 cm is 71.9 inches: 6 feet, not 5 feet 12.
  expect(feetInchesOf(182.6)).toEqual({ feet: 6, inches: 0 });
});
