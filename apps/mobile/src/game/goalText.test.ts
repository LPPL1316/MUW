import type { GameGoal, GameMe } from "@shaperoute/shared-types";

import { saveLanguageChoice } from "../i18n/language";
import {
  goalDistanceLabel,
  goalPaceLabel,
  goalText,
  percentText,
  progressText,
} from "./goalText";

// The phone's documents folder, in memory: the language.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

afterEach(() => {
  saveLanguageChoice("phone");
});

const FIVE_KM: GameGoal = {
  kind: "distance",
  total_m: 5000,
  distance_m: null,
  pace_s: null,
};
const HALF: GameGoal = {
  kind: "distance",
  total_m: 21097,
  distance_m: null,
  pace_s: null,
};
const FAST_KM: GameGoal = {
  kind: "pace",
  total_m: null,
  distance_m: 1000,
  pace_s: 300,
};
const FAST_FIVE: GameGoal = {
  kind: "pace",
  total_m: null,
  distance_m: 5000,
  pace_s: 330,
};

const me = (changes: Partial<GameMe> = {}): GameMe => ({
  counted_m: 14200,
  longest_m: 6000,
  best_s: {},
  shapes: [],
  ...changes,
});

test("a goal's distance is whole when it is, else to a tenth", () => {
  expect(goalDistanceLabel(5000, "km")).toBe("5 km");
  expect(goalDistanceLabel(21097, "km")).toBe("21.1 km");
  expect(goalDistanceLabel(5000, "mi")).toBe("3.1 mi");
  expect(goalDistanceLabel(1609.344, "mi")).toBe("1 mi");
});

test("a pace of seconds a kilometre is written in the units", () => {
  expect(goalPaceLabel(300, "km")).toBe("5:00 /km");
  expect(goalPaceLabel(300, "mi")).toBe("8:03 /mi");
});

test("what a shape asks, in kilometres and in miles", () => {
  expect(goalText(FIVE_KM, "km")).toBe("5 km in total");
  expect(goalText(HALF, "mi")).toBe("13.1 mi in total");
  expect(goalText(FAST_KM, "km")).toBe("1 km under 5:00 /km");
  expect(goalText(FAST_FIVE, "mi")).toBe("3.1 mi under 8:51 /mi");
});

test("how far along a distance shape is", () => {
  const twenty: GameGoal = { ...FIVE_KM, total_m: 20000 };
  expect(progressText(twenty, me(), "km")).toBe("14.2 / 20 km");
  expect(progressText(twenty, me(), "mi")).toBe("8.8 / 12.4 mi");
});

test("a pace shape shows the best time once the distance was run in one go", () => {
  expect(progressText(FAST_KM, me({ best_s: { "1000": 322 } }), "km")).toBe(
    "Best 5:22 /km · target 5:00 /km",
  );
  expect(progressText(FAST_FIVE, me({ best_s: { "5000": 1700 } }), "km")).toBe(
    "Best 5:40 /km · target 5:30 /km",
  );
  // Never that far in one run: the longest run so far.
  expect(progressText(FAST_FIVE, me({ longest_m: 3200 }), "km")).toBe(
    "Longest run 3.2 km",
  );
});

test("in Italian the words follow the language, the comma too", () => {
  saveLanguageChoice("it");
  expect(goalText(FIVE_KM, "km")).toBe("5 km in totale");
  expect(goalDistanceLabel(21097, "km")).toBe("21,1 km");
  expect(progressText(FAST_KM, me({ longest_m: 600 }), "km")).toBe(
    "Corsa più lunga 0,6 km",
  );
});

test("the share of the way is a whole percent", () => {
  expect(percentText(0.71)).toBe("71%");
  expect(percentText(0.9317)).toBe("93%");
  expect(percentText(1)).toBe("100%");
});
