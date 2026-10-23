import type { GameCatalog } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

import { fetchGameCatalog, isGameCatalog, noGame } from "./gameApi";

/**
 * The catalog of the shape game on this phone (TASK-296 part B, ADR-0255).
 * «Play» is shown only while the API has the game: the catalog kept here
 * says so. The app asks the API once as it opens and keeps the answer: a
 * catalog, or nothing when the API says it has no game (404). Without a
 * network the last answer stands, and a phone that never heard from the
 * API shows no «Play». Who shows the page reads it with `useGameCatalog`.
 */

export const GAME_CATALOG_FILE = "game-catalog.json";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** The catalog kept on this phone; null when none, or it does not read. */
export function loadGameCatalog(): GameCatalog | null {
  try {
    const file = new File(Paths.document, GAME_CATALOG_FILE);
    if (!file.exists) {
      return null;
    }
    const data: unknown = JSON.parse(file.textSync());
    return isGameCatalog(data) ? data : null;
  } catch {
    return null;
  }
}

/** Keeps the catalog for the next opening, or forgets it with null. False
 * when the phone refused. */
export function keepGameCatalog(catalog: GameCatalog | null): boolean {
  try {
    const file = new File(Paths.document, GAME_CATALOG_FILE);
    if (catalog === null) {
      if (file.exists) {
        file.delete();
      }
      return true;
    }
    file.create({ overwrite: true });
    file.write(JSON.stringify(catalog));
    return true;
  } catch {
    return false;
  }
}

// What the app shows: read from the phone once, then what the API said.
let loaded = false;
let current: GameCatalog | null = null;
const listeners = new Set<() => void>();

/** The catalog as the app knows it now. */
export function gameCatalog(): GameCatalog | null {
  if (!loaded) {
    current = loadGameCatalog();
    loaded = true;
  }
  return current;
}

/** A catalog the API answered, or null for an API without the game: shown
 * at once, and kept for the next opening. */
export function setGameCatalog(catalog: GameCatalog | null): void {
  loaded = true;
  current = catalog;
  keepGameCatalog(catalog);
  listeners.forEach((listener) => listener());
}

export function subscribeGameCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The catalog, and a new render when the API answers. */
export function useGameCatalog(): GameCatalog | null {
  return useSyncExternalStore(subscribeGameCatalog, gameCatalog);
}

/**
 * Asks the API for the catalog and keeps what it says: a catalog, or no
 * game. An API that cannot be reached, or answers something else, changes
 * nothing. Never throws.
 */
export async function refreshGameCatalog(
  baseUrl: string | null,
  options: Options = {},
): Promise<void> {
  if (baseUrl === null) {
    return;
  }
  const outcome = await fetchGameCatalog(baseUrl, options);
  if (outcome.kind === "ok") {
    setGameCatalog(outcome.value);
  } else if (noGame(outcome)) {
    setGameCatalog(null);
  }
}

/** For the tests: as a phone that never heard from the API. */
export function forgetGameCatalog(): void {
  keepGameCatalog(null);
  loaded = false;
  current = null;
  listeners.forEach((listener) => listener());
}
