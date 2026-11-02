import { useSyncExternalStore } from "react";

/**
 * The page of a monthly challenge asked for from anywhere in the app
 * (TASK-343 part B): the card of «Feed», or one of the three notifications
 * touched. `ProfileLayer` shows the page over the app, and takes it down
 * when the app goes elsewhere. Nothing in `App` changes for it.
 */

/** One request: a new object each time. */
export type AskedContest = { readonly id: string };

let asked: AskedContest | null = null;
const listeners = new Set<() => void>();

function tell(): void {
  listeners.forEach((listener) => listener());
}

/** Asks the app to show the page of the challenge `id`. */
export function openContestPage(id: string): void {
  asked = { id };
  tell();
}

/** The page goes: «←», or the app going elsewhere. */
export function closeContestPage(): void {
  if (asked !== null) {
    asked = null;
    tell();
  }
}

export function askedContest(): AskedContest | null {
  return asked;
}

export function subscribeAskedContest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The challenge whose page is asked for, and a new render when it changes. */
export function useAskedContest(): AskedContest | null {
  return useSyncExternalStore(subscribeAskedContest, askedContest);
}
