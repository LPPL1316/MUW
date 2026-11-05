import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

/** Where the switch of «Settings» is kept, as the tab of «Feed» is. It
 * stays on the phone: the API is never told. */
const STYLE_FILE = "style-in-feed.json";

/** On at the start: the posts are in «All» until the user turns them off. */
const FIRST_CHOICE = true;

/** The switch as the phone keeps it; on when it cannot be read. */
export function loadStyleInFeed(): boolean {
  try {
    const file = new File(Paths.document, STYLE_FILE);
    if (!file.exists) {
      return FIRST_CHOICE;
    }
    const data: unknown = JSON.parse(file.textSync());
    const on =
      typeof data === "object" && data !== null && "on" in data ? data.on : null;
    return typeof on === "boolean" ? on : FIRST_CHOICE;
  } catch {
    return FIRST_CHOICE;
  }
}

let shown: boolean | null = null;
const listeners = new Set<() => void>();

function current(): boolean {
  if (shown === null) {
    shown = loadStyleInFeed();
  }
  return shown;
}

/**
 * Turns the Style posts of «All» on or off (TASK-384, ADR-0326), at once in
 * «Feed», which stays built beside «Settings». A phone that refuses to keep
 * it keeps it while the app is open.
 */
export function saveStyleInFeed(on: boolean): void {
  shown = on;
  try {
    const file = new File(Paths.document, STYLE_FILE);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ on }));
  } catch {
    // The choice still holds while the app is open.
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Forgets the choice read: for the tests. */
export function forgetStyleInFeed(): void {
  shown = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the Style posts go in «All». The lens «Style» has them anyway. */
export function useStyleInFeed(): boolean {
  return useSyncExternalStore(subscribe, current);
}
