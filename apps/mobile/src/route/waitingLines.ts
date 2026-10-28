import { t, tLater } from "../i18n";

/** How long each line of the wait stays (TASK-317). */
export const LINE_MS = 3000;

/** The lines that keep the wait company, in English: said with t(). */
export const FUN_LINES = [
  tLater("Lacing up the shoes…"),
  tLater("Asking the streets for directions…"),
  tLater("Sharpening the pencil…"),
  tLater("Looking for the right corners…"),
  tLater("Counting the crossroads…"),
] as const;

/** The line for a word, with the word in it. */
export const WORD_LINE = tLater("Tracing “{word}” through town…");

/** Things the app really does, told while waiting. */
export const TIP_LINES = [
  tLater("Tip: you can move the start on the map."),
  tLater("Tip: a tilted shape often finds more roads."),
] as const;

/** Fun lines between two tips. */
const FUN_BETWEEN_TIPS = 2;

/** `items` in an order drawn with `random`, which gives a number in [0, 1). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The lines of one wait, in the app's language, in an order drawn once for
 * it: the fun lines (the word's too, for a word) with a tip after every two,
 * so a tip is never the first line nor next to another.
 */
export function drawnLines(word: string | null, random: () => number): string[] {
  const fun = shuffled(
    [...FUN_LINES.map((line) => t(line)), ...(word ? [t(WORD_LINE, { word })] : [])],
    random,
  );
  const tips = shuffled(
    TIP_LINES.map((line) => t(line)),
    random,
  );
  const lines: string[] = [];
  fun.forEach((line, i) => {
    lines.push(line);
    if ((i + 1) % FUN_BETWEEN_TIPS === 0) {
      const tip = tips[(i + 1) / FUN_BETWEEN_TIPS - 1];
      if (tip !== undefined) {
        lines.push(tip);
      }
    }
  });
  return lines;
}

/**
 * The line to show at `slot`, the number of lines shown since the phase
 * began. A phase with a line of its own («Drawing a 5 km heart…») shows it
 * first and again at every third slot; one without (the request sent, or
 * in the queue) only the drawn lines.
 */
export function lineAt(
  own: string | null,
  drawn: readonly string[],
  slot: number,
): string {
  if (own !== null && slot % 3 === 0) {
    return own;
  }
  if (drawn.length === 0) {
    return own ?? "";
  }
  const shown = own === null ? slot : slot - Math.floor(slot / 3) - 1;
  return drawn[shown % drawn.length];
}
