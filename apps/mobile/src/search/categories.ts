import type { Shape } from "@shaperoute/shared-types";

import { tLater } from "../i18n";

/**
 * A word drawn instead of a shape, as GET /search/drawings reads it in
 * `shape` (TASK-344 part B): a run with a word and no shape.
 */
export const WORD_SHAPE = "word";

export type CategoryKey = "animals" | "hearts" | "words" | "symbols" | "emoji";

export type Category = {
  key: CategoryKey;
  /** In English: shown with `t()`. */
  label: string;
  /** The shapes of the catalogue it holds; `WORD_SHAPE` for the words. */
  shapes: readonly (Shape | typeof WORD_SHAPE)[];
};

/**
 * The categories of the search (TASK-344, the user's choice: only those the
 * catalogue's shapes really have), in the order the chips show them. Every
 * shape of the catalogue is in one of them.
 */
export const CATEGORIES: readonly Category[] = [
  {
    key: "animals",
    label: tLater("Animals"),
    shapes: ["horse", "cat", "fish", "butterfly", "snail", "dog_head", "rabbit_head"],
  },
  { key: "hearts", label: tLater("Hearts"), shapes: ["heart"] },
  { key: "words", label: tLater("Words"), shapes: [WORD_SHAPE] },
  {
    key: "symbols",
    label: tLater("Symbols"),
    shapes: ["star", "moon", "circle", "sun", "christmas_tree"],
  },
  {
    key: "emoji",
    label: tLater("Emoji"),
    shapes: ["smiley", "ghost", "donut", "pumpkin"],
  },
];

export function categoryOf(key: CategoryKey): Category {
  const found = CATEGORIES.find((category) => category.key === key);
  if (found === undefined) {
    throw new Error(`No category ${key}`);
  }
  return found;
}

/** Whether a drawing of `shape` (null: a word, or no shape) with `word` is
 * in the category. */
export function holds(
  category: Category,
  shape: string | null | undefined,
  word: string | null | undefined,
): boolean {
  if (shape === null || shape === undefined) {
    return category.shapes.includes(WORD_SHAPE) && Boolean(word);
  }
  return (category.shapes as readonly string[]).includes(shape);
}
