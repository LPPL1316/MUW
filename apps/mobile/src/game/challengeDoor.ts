import { useSyncExternalStore } from "react";

import { openPlay } from "./unlocks";

/**
 * A challenge asked for from outside «Play» (TASK-296 part D): a push
 * notification of the challenge touched. The app shows «Play» as for a
 * shape unlocked (`unlocks.openPlay`), and the page, built or still to be
 * built, finds the challenge here, opens its «Challenges» tab on it and
 * takes the request down. Nothing in `App` changes for it.
 */

/** One request: a new object each time, so the same challenge asked for
 * twice is two requests. */
export type RequestedChallenge = { readonly id: string };

let requested: RequestedChallenge | null = null;
const listeners = new Set<() => void>();

function tell(): void {
  listeners.forEach((listener) => listener());
}

/** Asks the app to show the challenge `id`: «Play», on its tab. */
export function openChallenge(id: string): void {
  requested = { id };
  tell();
  openPlay();
}

/** The challenge asked for and not shown yet; null without. */
export function requestedChallenge(): RequestedChallenge | null {
  return requested;
}

/** The page has opened the challenge asked for. */
export function clearRequestedChallenge(): void {
  if (requested !== null) {
    requested = null;
    tell();
  }
}

export function subscribeRequestedChallenge(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The challenge asked for, and a new render when one is. */
export function useRequestedChallenge(): RequestedChallenge | null {
  return useSyncExternalStore(subscribeRequestedChallenge, requestedChallenge);
}
