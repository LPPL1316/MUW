import {
  readBirthYear,
  readHeightCm,
  readHeightFeetInches,
  readWeight,
} from "./bodyFields";

// The limits of ADR-0318, said in the app's units.

test("a weight in kilograms, 30 to 300", () => {
  expect(readWeight("", "km")).toEqual({ kind: "empty" });
  expect(readWeight("72,5", "km")).toEqual({ kind: "value", value: 72.5 });
  expect(readWeight("300", "km")).toEqual({ kind: "value", value: 300 });
  expect(readWeight("29", "km")).toEqual({
    kind: "wrong",
    problem: "Enter a weight between 30 and 300 kg.",
  });
  expect(readWeight("abc", "km").kind).toBe("wrong");
});

test("a weight in pounds: the limit shown is taken", () => {
  expect(readWeight("700", "mi")).toEqual({
    kind: "wrong",
    problem: "Enter a weight between 66.1 and 661.4 lb.",
  });
  // 66.1 lb is a hair under 30 kg: kept as 30.
  expect(readWeight("66.1", "mi")).toEqual({ kind: "value", value: 30 });
  const kept = readWeight("160", "mi");
  expect(kept.kind === "value" && kept.value).toBeCloseTo(72.57472);
});

test("a height in centimetres, 100 to 250", () => {
  expect(readHeightCm("178")).toEqual({ kind: "value", value: 178 });
  expect(readHeightCm(" ")).toEqual({ kind: "empty" });
  expect(readHeightCm("99")).toEqual({
    kind: "wrong",
    problem: "Enter a height between 100 cm and 250 cm.",
  });
});

test("a height in feet and inches", () => {
  const kept = readHeightFeetInches("5", "10");
  expect(kept.kind === "value" && kept.value).toBeCloseTo(177.8);
  // No inches is a round number of feet.
  const six = readHeightFeetInches("6", "");
  expect(six.kind === "value" && six.value).toBeCloseTo(182.88);
  expect(readHeightFeetInches("", "")).toEqual({ kind: "empty" });
  const wrong = {
    kind: "wrong",
    problem: "Enter a height between 3′ 3″ and 8′ 2″.",
  };
  expect(readHeightFeetInches("5", "12")).toEqual(wrong);
  expect(readHeightFeetInches("3", "2")).toEqual(wrong);
  expect(readHeightFeetInches("", "10")).toEqual(wrong);
  expect(readHeightFeetInches("5.5", "")).toEqual(wrong);
});

test("a year of birth, 100 to 13 years ago", () => {
  expect(readBirthYear("1990", 2026)).toEqual({ kind: "value", value: 1990 });
  expect(readBirthYear("2014", 2026)).toEqual({
    kind: "wrong",
    problem: "Enter a year between 1926 and 2013.",
  });
  expect(readBirthYear("1990.5", 2026).kind).toBe("wrong");
  expect(readBirthYear("", 2026)).toEqual({ kind: "empty" });
});
