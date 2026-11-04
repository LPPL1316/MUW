import { type BodyProfile, NO_BODY } from "./bodyProfile";
import { activeKcal, DEFAULT_WEIGHT_KG, metAt, restKcalPerMin } from "./energy";

// The cases are worked out by hand in ADR-0318's units: 5 kcal a litre of
// oxygen, one MET 3.5 ml/kg/min.

const YEAR = 2026;

const MAN: BodyProfile = { sex: "male", weightKg: 80, heightCm: 180, birthYear: 1990 };

describe("running", () => {
  test("with no body, a flat run is 1.0 kcal per kg and km for 70 kg", () => {
    // (3.5 × 50 + 0.2 × 10 000) ml/kg = 2.175 L/kg → 761.25 kcal; at rest
    // 1.225 kcal/min × 50 = 61.25.
    const effort = {
      activity: "running",
      metres: 10_000,
      seconds: 3000,
      climbM: 0,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(700);
  });

  test("stays within 5% of the 1.036 kcal/kg/km of before", () => {
    const before = Math.round(4.9 * DEFAULT_WEIGHT_KG * 1.036);
    const now = activeKcal(
      { activity: "running", metres: 4900, seconds: 27 * 60, climbM: null },
      NO_BODY,
      YEAR,
    );
    expect(Math.abs(now - before) / before).toBeLessThan(0.05);
  });

  test("each metre climbed adds 0.0045 kcal a kilogram", () => {
    const effort = {
      activity: "running",
      metres: 10_000,
      seconds: 3000,
      climbM: 200,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(763);
  });

  test("without its time, a run is counted from its metres", () => {
    const effort = {
      activity: "running",
      metres: 10_000,
      seconds: null,
      climbM: null,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(700);
  });

  test("the weight counts in proportion", () => {
    const effort = {
      activity: "running",
      metres: 10_000,
      seconds: null,
      climbM: null,
    } as const;
    expect(activeKcal(effort, { ...NO_BODY, weightKg: 90 }, YEAR)).toBe(900);
  });

  test("sex, age and height take off Mifflin-St Jeor at rest", () => {
    // 80 kg: 2.175 × 5 × 80 = 870 kcal. At rest, a man of 36, 180 cm:
    // 800 + 1125 − 180 + 5 = 1750 kcal a day, 60.76 in 50 minutes.
    const effort = {
      activity: "running",
      metres: 10_000,
      seconds: 3000,
      climbM: 0,
    } as const;
    expect(activeKcal(effort, MAN, YEAR)).toBe(809);
    // A woman: 1750 − 166 = 1584 a day, 55 in 50 minutes.
    expect(activeKcal(effort, { ...MAN, sex: "female" }, YEAR)).toBe(815);
  });
});

describe("cycling and paddling", () => {
  test("a ride at 20 km/h is 8.0 MET", () => {
    // 8 × 3.5 × 30 = 840 ml/kg → 294 kcal; at rest 36.75.
    const effort = {
      activity: "cycling",
      metres: 10_000,
      seconds: 1800,
      climbM: 0,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(257);
  });

  test("a paddle at 5 km/h is 2.8 MET", () => {
    // 2.8 × 3.5 × 60 = 588 ml/kg → 205.8 kcal; at rest 73.5.
    const effort = {
      activity: "paddling",
      metres: 5000,
      seconds: 3600,
      climbM: null,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(132);
  });

  test("without its time, a ride or a paddle has none", () => {
    expect(
      activeKcal(
        { activity: "cycling", metres: 30_000, seconds: null, climbM: null },
        NO_BODY,
        YEAR,
      ),
    ).toBe(0);
    expect(
      activeKcal(
        { activity: "paddling", metres: 3000, seconds: 0, climbM: null },
        NO_BODY,
        YEAR,
      ),
    ).toBe(0);
  });

  test("the speed bands of the Compendium", () => {
    expect(metAt("cycling", 15)).toBe(4.0);
    expect(metAt("cycling", 16.1)).toBe(6.8);
    expect(metAt("cycling", 21)).toBe(8.0);
    expect(metAt("cycling", 24)).toBe(10.0);
    expect(metAt("cycling", 30)).toBe(12.0);
    expect(metAt("cycling", 40)).toBe(15.8);
    expect(metAt("paddling", 3)).toBe(2.8);
    expect(metAt("paddling", 7)).toBe(5.8);
    expect(metAt("paddling", 11)).toBe(12.5);
  });
});

describe("at rest", () => {
  test("one standard MET until sex, age and height are all there", () => {
    expect(restKcalPerMin(NO_BODY, YEAR)).toBeCloseTo(1.225);
    expect(restKcalPerMin({ ...MAN, heightCm: null }, YEAR)).toBeCloseTo(1.4);
  });

  test("«Prefer not to say» takes the mean of the two", () => {
    // 1750 − 5 − 78 = 1667 a day.
    expect(restKcalPerMin({ ...MAN, sex: "unsaid" }, YEAR)).toBeCloseTo(1667 / 1440);
  });

  test("a swim has none yet (TASK-323 C2)", () => {
    const effort = {
      activity: "swimming",
      metres: 1500,
      seconds: 2700,
      climbM: null,
    } as const;
    expect(activeKcal(effort, NO_BODY, YEAR)).toBe(0);
  });

  test("no metres, no energy", () => {
    const effort = {
      activity: "running",
      metres: 0,
      seconds: 600,
      climbM: null,
    } as const;
    expect(activeKcal(effort, MAN, YEAR)).toBe(0);
  });
});
