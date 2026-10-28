import { act } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import {
  drawnLines,
  FUN_LINES,
  lineAt,
  shuffled,
  TIP_LINES,
  WORD_LINE,
} from "./waitingLines";

// The lines of the wait in «Draw» (TASK-317): fun lines and tips in an order
// drawn once for the wait, and the phase's own line every third.

/** The numbers a test gives as `Math.random` would, over and over. */
function numbers(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const TIPS: readonly string[] = TIP_LINES;

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("an order drawn keeps every item once", () => {
  const order = shuffled([1, 2, 3, 4, 5], numbers(0.9, 0.1, 0.5, 0.3));
  expect([...order].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(shuffled([1, 2, 3], () => 0.999999)).toEqual([1, 2, 3]);
  expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  expect(shuffled([], Math.random)).toEqual([]);
});

test("a shape's wait has the five fun lines and the two tips, a tip after every two", () => {
  for (const seed of [0, 0.2, 0.5, 0.8, 0.99]) {
    const lines = drawnLines(null, numbers(seed, 1 - seed, seed / 2));
    expect(lines).toHaveLength(7);
    expect([...lines].sort()).toEqual([...FUN_LINES, ...TIP_LINES].sort());
    const tipsAt = lines.flatMap((line, i) => (TIPS.includes(line) ? [i] : []));
    expect(tipsAt).toEqual([2, 5]);
    // Around again, the last line and the first are not two tips either.
    expect(TIPS.includes(lines[lines.length - 1])).toBe(false);
  }
});

test("a word's wait has its own line too", () => {
  const lines = drawnLines("CIAO", numbers(0.3, 0.7));
  expect(lines).toHaveLength(8);
  expect(lines).toContain("Tracing “CIAO” through town…");
  expect(lines.filter((line) => TIPS.includes(line))).toHaveLength(2);
  expect(drawnLines(null, numbers(0.3)).join()).not.toContain("Tracing");
  expect(WORD_LINE).toBe("Tracing “{word}” through town…");
});

test("the lines are in the app's language", async () => {
  await act(async () => saveLanguageChoice("it"));
  const lines = drawnLines("CIAO", numbers(0.4));
  expect(lines).toContain("Allacciando le scarpe…");
  expect(lines).toContain("Tracciando «CIAO» in città…");
  expect(lines).toContain("Consiglio: puoi spostare la partenza sulla mappa.");
});

test("a phase with its own line shows it first and at every third line", () => {
  const drawn = ["a", "b", "c", "d"];
  const shown = Array.from({ length: 10 }, (_, slot) => lineAt("own", drawn, slot));
  expect(shown).toEqual(["own", "a", "b", "own", "c", "d", "own", "a", "b", "own"]);
});

test("a phase without one shows only the drawn lines, round and round", () => {
  const drawn = ["a", "b", "c"];
  const shown = Array.from({ length: 5 }, (_, slot) => lineAt(null, drawn, slot));
  expect(shown).toEqual(["a", "b", "c", "a", "b"]);
  expect(lineAt("own", [], 4)).toBe("own");
  expect(lineAt(null, [], 4)).toBe("");
});
