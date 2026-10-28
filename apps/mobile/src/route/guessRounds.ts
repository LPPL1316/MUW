import { SHAPES } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";

import type { SamplePost } from "../feed/sampleFeed";
import { shuffled } from "./waitingLines";

/** The answers a round offers: the drawing's shape and two others. */
export const OPTIONS = 3;

/** The phone keeps here the best score of «Guess the shape» (TASK-317). */
export const BEST_FILE = "guess-shape-best.json";

/** One round of «Guess the shape»: a drawing, and the shapes to pick from. */
export type Round = { post: SamplePost; options: string[] };

/** The catalogue's shapes among `posts`, each once: the game's answers. */
export function shapesOf(posts: readonly SamplePost[]): string[] {
  const catalogue: readonly string[] = SHAPES;
  return [...new Set(posts.map((post) => post.shape))].filter((shape) =>
    catalogue.includes(shape),
  );
}

/** The drawings a round can show: those of a catalogue shape. */
export function guessable(posts: readonly SamplePost[]): SamplePost[] {
  const catalogue: readonly string[] = SHAPES;
  return posts.filter((post) => catalogue.includes(post.shape));
}

/** A round for `post`: its shape and two others of `shapes`, in a drawn order. */
export function roundOf(
  post: SamplePost,
  shapes: readonly string[],
  random: () => number,
): Round {
  const others = shuffled(
    shapes.filter((shape) => shape !== post.shape),
    random,
  ).slice(0, OPTIONS - 1);
  return { post, options: shuffled([post.shape, ...others], random) };
}

/**
 * The points of a right answer given with `share` of the drawing traced:
 * 100 before the first stroke, 10 less for every tenth, never under 10.
 */
export function pointsFor(share: number): number {
  return Math.max(10, Math.round((1 - share) * 10) * 10);
}

// Kept in this run of the app, for a phone that cannot write the file.
let bestNow = 0;

/** The best score kept on this phone; 0 when there is none or it does not read. */
export function loadBest(): number {
  try {
    const file = new File(Paths.document, BEST_FILE);
    if (!file.exists) {
      return bestNow;
    }
    const data: unknown = JSON.parse(file.textSync());
    const best =
      typeof data === "object" &&
      data !== null &&
      "best" in data &&
      typeof data.best === "number" &&
      Number.isFinite(data.best)
        ? Math.max(0, Math.round(data.best))
        : 0;
    bestNow = Math.max(bestNow, best);
    return bestNow;
  } catch {
    return bestNow;
  }
}

/** Keeps `best` as the best score; a phone that refuses keeps it until the
 * app closes. */
export function saveBest(best: number): void {
  bestNow = Math.max(bestNow, best);
  try {
    const file = new File(Paths.document, BEST_FILE);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ best: bestNow }));
  } catch {
    // Kept for this run of the app only.
  }
}

/** For tests: as a new opening of the app, the file aside. */
export function forgetBest(): void {
  bestNow = 0;
}
